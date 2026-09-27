import { Test } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { JwtModule, JwtService } from '@nestjs/jwt';
import { PassportModule } from '@nestjs/passport';
import type { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { DatabaseService } from '../database/database.service';
import { ScanQueueService } from '../queue/scan-queue.service';
import { JwtStrategy } from '../auth/strategies/jwt.strategy';
import { OrganizationScansController } from './organization-scans.controller';
import { ScansService } from './scans.service';

const canaries = [
  'accessibility-email-canary@example.com',
  'accessibility-token-canary-9182',
  'accessibility-input-secret-7712',
  'accessibility-dom-text-secret-6631',
  'accessibility-id-secret-5520',
];
const secret = canaries.join(' ');
function marker(state = 'COMPLETE') {
  return {
    kind: 'ACCESSIBILITY_ASSESSMENT',
    version: 1,
    raw: secret,
    assessment: {
      version: 1,
      state,
      scope: 'MAIN_DOCUMENT',
      engine: {
        name: 'axe-core',
        version: '4.13.0',
        rulesetVersion: 1,
        profileId: 'main-document-v1',
        error: secret,
      },
      mainDocumentEvaluated: state !== 'UNAVAILABLE',
      excludedFrameCount: 0,
      reasons:
        state === 'COMPLETE'
          ? []
          : [state === 'PARTIAL' ? 'REFERENCE_UNAVAILABLE' : 'ENGINE_TIMEOUT'],
      durationMs: 10,
      configuredRuleCount: 19,
      html: secret,
    },
  };
}
function finding(id = 'label') {
  return {
    category: 'ACCESSIBILITY',
    ruleId: `accessibility.axe-core.${id}`,
    severity: 'HIGH',
    confidence: 'MEDIUM',
    status: 'OPEN',
    title: secret,
    description: secret,
    recommendation: secret,
    affectedUrl: secret,
    affectedResource: secret,
    evidence: {
      version: 1,
      mappingVersion: 1,
      engine: 'axe-core',
      engineVersion: '4.13.0',
      rulesetVersion: 1,
      profileId: 'main-document-v1',
      ruleId: id,
      ruleVersion: 1,
      outcome: 'VIOLATION',
      engineImpact: 'SERIOUS',
      occurrenceCount: 1,
      countPrecision: 'EXACT',
      samplesTruncated: false,
      sampledReferences: [
        {
          ordinal: 0,
          tag: 'input',
          role: 'textbox',
          path: [{ tag: 'main', index: 0, id: secret }],
          html: secret,
          selector: secret,
        },
      ],
      wcagTags: ['wcag2a'],
      wcagCriteria: ['1.3.1'],
      raw: secret,
      debug: secret,
      metadata: secret,
      text: secret,
      value: secret,
      ariaLabel: secret,
      href: secret,
    },
  };
}

describe('organization accessibility report HTTP boundary', () => {
  let app: INestApplication;
  let token: string;
  const findScan = jest.fn();
  const findSession = jest.fn();
  const findMember = jest.fn();
  beforeAll(async () => {
    const module = await Test.createTestingModule({
      imports: [
        PassportModule.register({ defaultStrategy: 'jwt' }),
        JwtModule.register({ secret: 'test-only-secret' }),
      ],
      controllers: [OrganizationScansController],
      providers: [
        ScansService,
        JwtStrategy,
        {
          provide: ConfigService,
          useValue: { getOrThrow: () => 'test-only-secret' },
        },
        { provide: ScanQueueService, useValue: {} },
        {
          provide: DatabaseService,
          useValue: {
            client: {
              scan: { findFirst: findScan },
              session: { findFirst: findSession },
              organizationMember: { findUnique: findMember },
            },
          },
        },
      ],
    }).compile();
    app = module.createNestApplication();
    app.setGlobalPrefix('api/v1');
    await app.init();
    token = module.get(JwtService).sign({ sub: 'user', sid: 'session' });
  });
  beforeEach(() => {
    jest.clearAllMocks();
    findSession.mockResolvedValue({ id: 'session', userId: 'user' });
    findMember.mockResolvedValue({ role: 'MEMBER' });
    findScan.mockImplementation(
      ({
        where,
      }: {
        where: {
          id: string;
          environment: { project: { organizationId: string } };
        };
      }) =>
        Promise.resolve(
          where.id === 'own' &&
            where.environment.project.organizationId === 'org'
            ? {
                id: 'own',
                status: 'COMPLETED',
                completedAt: null,
                evidence: [],
                findings: [],
              }
            : null,
        ),
    );
  });
  afterAll(async () => {
    await app.close();
  });
  const path = (org = 'org', id = 'own') =>
    `/api/v1/organizations/${org}/scans/${id}/accessibility`;
  it('rejects unauthenticated requests before loading data', async () => {
    await request(app.getHttpServer()).get(path()).expect(401);
    expect(findScan).not.toHaveBeenCalled();
  });
  it('rejects revoked sessions', async () => {
    findSession.mockResolvedValue(null);
    await request(app.getHttpServer())
      .get(path())
      .auth(token, { type: 'bearer' })
      .expect(401);
    expect(findScan).not.toHaveBeenCalled();
  });
  it('allows members and scopes the database query and evidence selection', async () => {
    const response = await request(app.getHttpServer())
      .get(path())
      .auth(token, { type: 'bearer' })
      .expect(200);
    expect(response.body.assessment.state).toBe('NOT_ASSESSED');
    expect(findScan).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          id: 'own',
          environment: { project: { organizationId: 'org' } },
        },
        select: expect.objectContaining({
          findings: expect.objectContaining({
            where: { category: 'ACCESSIBILITY' },
          }),
          evidence: expect.objectContaining({
            where: { type: 'DOCUMENT_RESPONSE', sequence: 2 },
          }),
        }),
      }),
    );
  });
  it('projects persisted canaries at the actual HTTP boundary', async () => {
    findScan.mockResolvedValue({
      id: 'own',
      status: 'COMPLETED',
      completedAt: null,
      evidence: [{ data: marker() }],
      findings: [finding()],
      targetUrl: secret,
    });
    const response = await request(app.getHttpServer())
      .get(path())
      .auth(token, { type: 'bearer' })
      .expect(200);
    expect(response.body.assessment.state).toBe('COMPLETE');
    expect(response.body.findings).toHaveLength(1);
    for (const canary of canaries)
      expect(JSON.stringify(response.body)).not.toContain(canary);
    findScan.mockResolvedValue({
      id: 'own',
      status: 'COMPLETED',
      completedAt: null,
      evidence: [
        {
          data: {
            ...marker(),
            assessment: { ...marker().assessment, reasons: [secret] },
          },
        },
      ],
      findings: [finding()],
    });
    const invalid = await request(app.getHttpServer())
      .get(path())
      .auth(token, { type: 'bearer' })
      .expect(200);
    expect(invalid.body.assessment.state).toBe('NOT_ASSESSED');
    for (const canary of canaries)
      expect(JSON.stringify(invalid.body)).not.toContain(canary);
  });
  it('distinguishes COMPLETE with no findings from legacy at the HTTP boundary', async () => {
    findScan.mockResolvedValue({
      id: 'own',
      status: 'COMPLETED',
      completedAt: null,
      evidence: [{ data: marker() }],
      findings: [],
    });
    const response = await request(app.getHttpServer())
      .get(path())
      .auth(token, { type: 'bearer' })
      .expect(200);
    expect(response.body).toMatchObject({
      assessment: { state: 'COMPLETE' },
      summary: { findingCount: 0 },
    });
  });
  it('rejects nonmembers', async () => {
    findMember.mockResolvedValue(null);
    await request(app.getHttpServer())
      .get(path())
      .auth(token, { type: 'bearer' })
      .expect(403);
    expect(findScan).not.toHaveBeenCalled();
  });
  it('makes wrong-organization scans indistinguishable from missing scans', async () => {
    const foreign = await request(app.getHttpServer())
      .get(path('other'))
      .auth(token, { type: 'bearer' })
      .expect(404);
    const missing = await request(app.getHttpServer())
      .get(path('org', 'missing'))
      .auth(token, { type: 'bearer' })
      .expect(404);
    expect(foreign.body).toEqual(missing.body);
  });
});
