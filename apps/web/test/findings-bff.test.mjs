import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import { createRequire } from 'node:module';
import ts from 'typescript';
const requireModule = createRequire(import.meta.url);
const id='12345678-1234-1234-1234-123456789abc';
const canaries=['bff-findings-email-canary@example.com','bff-findings-token-canary-9182','bff-findings-query-secret-7712','bff-findings-dom-secret-6631','bff-findings-header-secret-5520'];
const secret=canaries.join(' ');
function load(file,mocks={},globals={}) {
 const context={exports:{},URL,URLSearchParams,Headers,Buffer,...globals,require:name=>name in mocks?mocks[name]:requireModule(name)};
 vm.runInNewContext(ts.transpileModule(fs.readFileSync(new URL('../src/'+file,import.meta.url),'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText,context);
 return context.exports;
}
function fixture() {
 return {id,scanId:id,category:'NETWORK',ruleId:'network.request-failure-observed',ruleVersion:1,severity:'INFO',confidence:'HIGH',status:'OPEN',title:secret,description:secret,recommendation:secret,affectedResource:{kind:'MAIN_DOCUMENT'},evidence:{version:1,context:'SYNTHETIC',failureKind:'REQUEST_FAILED',observedFailureCount:1,raw:secret},firstDetectedAt:'2026-01-01T00:00:00.000Z',lastDetectedAt:'2026-01-01T00:00:00.000Z',createdAt:'2026-01-01T00:00:00.000Z',updatedAt:'2026-01-01T00:00:00.000Z'};
}
function setup() {
 const state={token:'jwt-secret-canary',status:200,response:{items:[fixture()],nextCursor:null},failure:null,memberships:[{organization:{id:'server-org'}}]};
 const calls=[];
 const {ApiError}=load('lib/api/api-error.ts');
 const server=load('lib/api/server-api-client.ts',{'server-only':{},'./api-error':{ApiError}},{process:{env:{API_URL:'https://internal.test/api/v1'}},fetch:async(url,options)=>{
   calls.push({url,options}); if(state.failure)throw state.failure;
   return {ok:state.status===200,status:state.status,json:async()=>state.status!==200?{message:secret}:url.endsWith('/auth/me')?{memberships:state.memberships}:state.response};
 }});
 const auth=load('lib/api/authenticated-api.ts',{'server-only':{},'next/headers':{cookies:async()=>({get:name=>{assert.equal(name,'reactpulse_access');return state.token?{value:state.token}:undefined;}})},'@/features/auth/auth-cookie':{AUTH_COOKIE_NAME:'reactpulse_access'},'./api-error':{ApiError},'./server-api-client':server});
 const projection=load('lib/api/findings.ts');
 const helper=load('lib/api/findings-bff.ts',{'server-only':{},'next/server':{NextResponse:{json:(body,options={})=>({body,...options,status:options.status??200})}},'@/features/organizations/get-active-organization':load('features/organizations/get-active-organization.ts'),'./authenticated-api':auth,'./api-error':{ApiError},'./findings':projection});
 const routes={};
 for(const [key,file]of Object.entries({list:'app/api/findings/route.ts',detail:'app/api/findings/[findingId]/route.ts',acknowledge:'app/api/findings/[findingId]/acknowledge/route.ts',ignore:'app/api/findings/[findingId]/ignore/route.ts'}))routes[key]=load(file,{'@/lib/api/findings-bff':helper});
 const invoke=(key='list',query='',options={})=>{
   const method=key==='acknowledge'||key==='ignore'?'POST':'GET';
   const request=new Request('https://web.test/api/findings'+(key==='list'?'':'/'+id)+query,{method,...(method==='POST'?{headers:{origin:'https://web.test'}}:{}),...options});
   return routes[key][method](request,{params:Promise.resolve({findingId:id})});
 };
 return {state,calls,invoke,projection};
}
function privateResponse(response) {
 assert.equal(response.headers['Cache-Control'],'no-store');
 for(const c of [...canaries,'jwt-secret-canary','internal.test'])assert.ok(!JSON.stringify(response.body).includes(c));
}
test('authenticated list forwards validated filters and preserves pagination without JWT exposure',async()=>{
 const h=setup(); const cursor=Buffer.from(JSON.stringify(['2026-01-01T00:00:00.000Z',id])).toString('base64url');
 h.state.response.nextCursor=cursor;
 const r=await h.invoke('list',`?limit=1&scanId=${id}&category=NETWORK&severity=INFO&confidence=HIGH&status=OPEN&ruleId=network.request-failure-observed&cursor=${cursor}`);
 assert.equal(r.status,200);assert.equal(r.body.nextCursor,cursor);privateResponse(r);
 const call=h.calls.at(-1);assert.ok(call.url.includes('/organizations/server-org/findings?'));
 const params=new URL(call.url).searchParams;assert.equal(params.get('limit'),'1');assert.equal(params.get('cursor'),cursor);assert.equal(params.get('scanId'),id);
 for(const call of h.calls){assert.equal(call.options.cache,'no-store');assert.equal(call.options.headers.get('Authorization'),'Bearer jwt-secret-canary');}
});
test('detail and explicit actions forward safely without browser body or organization',async()=>{
 for(const key of ['detail','acknowledge','ignore']){
  const h=setup();h.state.response=fixture();const r=await h.invoke(key);assert.equal(r.status,200);privateResponse(r);
  assert.equal(h.calls.at(-1).url,`https://internal.test/api/v1/organizations/server-org/findings/${id}${key==='detail'?'':'/'+key}`);
  assert.equal(h.calls.at(-1).options.method,key==='detail'?undefined:'POST');assert.equal(h.calls.at(-1).options.body,undefined);
 }
});
test('missing authentication and active membership fail closed on all routes',async()=>{
 for(const key of ['list','detail','acknowledge','ignore']){
  const h=setup();h.state.token='';assert.equal((await h.invoke(key)).status,401);assert.equal(h.calls.length,0);
  h.state.token='token';h.state.memberships=[];assert.equal((await h.invoke(key)).status,403);
 }
});
test('invalid, duplicate and unknown query inputs never reach upstream',async()=>{
 for(const query of ['limit=101','limit=0','cursor=invalid','category=bad','status=bad','severity=bad','confidence=bad','scanId=bad','ruleId=secret','organizationId=foreign','search=secret','limit=1&limit=2']){
  const h=setup();const r=await h.invoke('list','?'+query);assert.equal(r.status,400);assert.equal(h.calls.length,0);privateResponse(r);
 }
});
test('mutation requires exact Origin and no arbitrary body',async()=>{
 for(const key of ['acknowledge','ignore']){
  for(const headers of [{},{origin:'null'},{origin:'https://evil.test'},{origin:'https://sub.web.test'},{origin:'https://web.test','sec-fetch-site':'cross-site'}]){
   const h=setup();assert.equal((await h.invoke(key,'',{headers})).status,403);assert.equal(h.calls.length,0);
  }
  const h=setup();assert.equal((await h.invoke(key,'',{body:JSON.stringify({status:'RESOLVED'})})).status,400);assert.equal(h.calls.length,0);
 }
});
test('upstream expected statuses, malformed evidence and outages are bounded errors',async()=>{
 for(const status of [400,401,403,404,409,500]){
  const h=setup();h.state.status=status;const r=await h.invoke();assert.equal(r.status,status===500?502:status);privateResponse(r);
 }
 for(const key of ['list','detail','acknowledge','ignore']){
  const h=setup();const bad={...fixture(),evidence:{raw:secret}};h.state.response=key==='list'?{items:[bad],nextCursor:null}:bad;
  const r=await h.invoke(key);assert.equal(r.status,502);privateResponse(r);
 }
 const h=setup();h.state.failure=new Error(secret);const r=await h.invoke();assert.equal(r.status,502);privateResponse(r);
});
test('transport validates all category evidence and rejects mixed categories',()=>{
 const h=setup();const variants=[fixture(),{...fixture(),category:'PERFORMANCE',ruleId:'performance.lcp.above-good-threshold',severity:'MEDIUM',evidence:{version:1,context:'SYNTHETIC',metric:'lcp',unit:'ms',measuredValue:3000,threshold:2500,comparison:'GT'}},{...fixture(),category:'SECURITY',ruleId:'security.csp.missing',severity:'LOW',confidence:'MEDIUM',evidence:{version:1,ruleVersion:1,outcome:'POSTURE',reason:'ENFORCED_CSP_ABSENT',source:'csp',subject:{kind:'MAIN_DOCUMENT'}}},{...fixture(),category:'ACCESSIBILITY',ruleId:'accessibility.axe-core.label',severity:'HIGH',confidence:'MEDIUM',evidence:{version:1,ruleVersion:1,mappingVersion:1,engine:'axe-core',engineVersion:'4.13.0',rulesetVersion:1,profileId:'main-document-v1',ruleId:'label',outcome:'VIOLATION',engineImpact:'SERIOUS',occurrenceCount:1,countPrecision:'EXACT',samplesTruncated:false,sampledReferences:[],wcagTags:[],wcagCriteria:[]}}];
 for(const v of variants){assert.ok(h.projection.projectFindingResponse(v));assert.equal(h.projection.projectFindingResponse({...v,evidence:{secret}}),null);}
 assert.equal(h.projection.projectFindingListResponse({items:[fixture(),fixture()],nextCursor:null},2),null);
 assert.equal(h.projection.projectFindingListResponse({items:[fixture()],nextCursor:secret},1),null);
});
