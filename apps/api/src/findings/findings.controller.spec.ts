import { Test } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { JwtModule, JwtService } from '@nestjs/jwt';
import { PassportModule } from '@nestjs/passport';
import type { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { DatabaseService } from '../database/database.service';
import { JwtStrategy } from '../auth/strategies/jwt.strategy';
import { FindingsController } from './findings.controller';
import { FindingsService } from './findings.service';

const id = (n: number) =>
  `00000000-0000-4000-8000-${String(n).padStart(12, '0')}`;
const secret = [
  'api-findings-email-canary@example.com',
  'api-findings-token-canary-9182',
  'api-findings-query-secret-7712',
  'api-findings-dom-secret-6631',
  'api-findings-header-secret-5520',
];
function fixture(n = 1, org = 'a') {
  return {
    id: id(n),
    scanId: id(100),
    org,
    category: 'NETWORK',
    ruleId: 'network.request-failure-observed',
    severity: 'INFO',
    confidence: 'HIGH',
    status: 'OPEN',
    title: secret[0],
    description: secret[1],
    recommendation: secret[2],
    fingerprint: secret[3],
    affectedUrl: secret[4],
    evidence: {
      version: 1,
      ruleVersion: 1,
      context: 'SYNTHETIC',
      failureKind: 'REQUEST_FAILED',
      observedFailureCount: 1,
      raw: secret,
    } as Record<string, unknown>,
    firstDetectedAt: new Date('2026-01-01T00:00:00.000Z'),
    lastDetectedAt: new Date('2026-01-01T00:00:00.000Z'),
    createdAt: new Date('2026-01-01T00:00:00.000Z'),
    updatedAt: new Date('2026-01-01T00:00:00.000Z'),
  };
}
type Row = ReturnType<typeof fixture>;
type Where = {
  id?: string;
  scan: { environment: { project: { organizationId: string } } };
  scanId?: string;
  category?: string;
  severity?: string;
  confidence?: string;
  status?: string;
  ruleId?: string;
  OR?: [{ createdAt: { lt: Date } }, { createdAt: Date; id: { lt: string } }];
};
function matches(r: Row, w: Where) {
  return (
    r.org === w.scan.environment.project.organizationId &&
    (!w.id || r.id === w.id) &&
    (
      [
        'scanId',
        'category',
        'severity',
        'confidence',
        'status',
        'ruleId',
      ] as const
    ).every((k) => w[k] === undefined || r[k] === w[k]) &&
    (!w.OR ||
      r.createdAt < w.OR[0].createdAt.lt ||
      (+r.createdAt === +w.OR[1].createdAt && r.id < w.OR[1].id.lt))
  );
}
describe('Findings HTTP boundary', () => {
  let app: INestApplication, token: string, rows: Row[];
  let roles: Record<string, string>, race: boolean;
  const session = jest.fn(),
    member = jest.fn(),
    findMany = jest.fn(),
    findFirst = jest.fn(),
    updateMany = jest.fn();
  const findingDelegate = { findMany, findFirst, updateMany };
  const client = {
    session: { findFirst: session },
    organizationMember: { findUnique: member },
    finding: { findMany, findFirst, updateMany },
    $transaction: async (
      fn: (tx: { finding: typeof findingDelegate }) => Promise<unknown>,
    ): Promise<unknown> => {
      const before = structuredClone(rows);
      try {
        return await fn({ finding: client.finding });
      } catch (error) {
        rows = before;
        throw error;
      }
    },
  };
  beforeAll(async () => {
    const module = await Test.createTestingModule({
      imports: [
        PassportModule.register({ defaultStrategy: 'jwt' }),
        JwtModule.register({ secret: 'test-only-secret' }),
      ],
      controllers: [FindingsController],
      providers: [
        FindingsService,
        JwtStrategy,
        {
          provide: ConfigService,
          useValue: { getOrThrow: () => 'test-only-secret' },
        },
        { provide: DatabaseService, useValue: { client } },
      ],
    }).compile();
    app = module.createNestApplication();
    app.setGlobalPrefix('api/v1');
    await app.init();
    token = module.get(JwtService).sign({ sub: 'user', sid: 'session' });
  });
  afterAll(async () => {
    await app.close();
  });
  beforeEach(() => {
    jest.clearAllMocks();
    rows = [fixture()];
    roles = { a: 'DEVELOPER' };
    race = false;
    session.mockResolvedValue({ id: 'session', userId: 'user' });
    member.mockImplementation(
      ({
        where,
      }: {
        where: { organizationId_userId: { organizationId: string } };
      }) =>
        Promise.resolve(
          roles[where.organizationId_userId.organizationId]
            ? { role: roles[where.organizationId_userId.organizationId] }
            : null,
        ),
    );
    findMany.mockImplementation(
      ({ where, take }: { where: Where; take: number }) =>
        Promise.resolve(
          rows
            .filter((r) => matches(r, where))
            .sort(
              (a, b) => +b.createdAt - +a.createdAt || (a.id < b.id ? 1 : -1),
            )
            .slice(0, take),
        ),
    );
    findFirst.mockImplementation(({ where }: { where: Where }) =>
      Promise.resolve(rows.find((r) => matches(r, where)) ?? null),
    );
    updateMany.mockImplementation(
      ({ where, data }: { where: Where; data: { status: string } }) => {
        if (race) return Promise.resolve({ count: 0 });
        let count = 0;
        rows = rows.map((r) =>
          matches(r, where) ? (count++, { ...r, ...data }) : r,
        );
        return Promise.resolve({ count });
      },
    );
  });
  const path = (suffix = '', org = 'a') =>
    `/api/v1/organizations/${org}/findings${suffix}`;
  const get = (suffix = '', org = 'a') =>
    request(app.getHttpServer())
      .get(path(suffix, org))
      .auth(token, { type: 'bearer' });
  const post = (action: string, org = 'a', finding = id(1)) =>
    request(app.getHttpServer())
      .post(path(`/${finding}/${action}`, org))
      .auth(token, { type: 'bearer' });
  it('rejects absent and revoked sessions before finding queries', async () => {
    await request(app.getHttpServer()).get(path()).expect(401);
    session.mockResolvedValue(null);
    await get().expect(401);
    expect(findMany).not.toHaveBeenCalled();
  });
  it.each(['OWNER', 'ADMIN', 'DEVELOPER', 'VIEWER'])(
    '%s reads list and detail safely',
    async (role) => {
      roles.a = role;
      const list = await get().expect(200),
        detail = await get(`/${id(1)}`).expect(200);
      expect(list.body.items[0]).toEqual(detail.body);
      expect(detail.body).not.toHaveProperty('fingerprint');
      expect(detail.body).not.toHaveProperty('fingerprintIdentity');
      for (const c of secret)
        expect(JSON.stringify(list.body)).not.toContain(c);
    },
  );
  it.each(['OWNER', 'ADMIN', 'DEVELOPER'])(
    '%s may execute all approved transitions',
    async (role) => {
      roles.a = role;
      for (const [initial, action, target] of [
        ['OPEN', 'acknowledge', 'ACKNOWLEDGED'],
        ['OPEN', 'ignore', 'IGNORED'],
        ['ACKNOWLEDGED', 'ignore', 'IGNORED'],
        ['IGNORED', 'acknowledge', 'ACKNOWLEDGED'],
      ]) {
        rows[0].status = initial;
        const response = await post(action).expect(200);
        expect(response.body.status).toBe(target);
        expect(rows[0].status).toBe(target);
      }
    },
  );
  it('VIEWER cannot mutate; requested organization membership decides the role', async () => {
    roles = { a: 'OWNER', b: 'VIEWER' };
    rows.push(fixture(2, 'b'));
    await get('', 'b').expect(200);
    await get(`/${id(2)}`, 'b').expect(200);
    await post('acknowledge', 'b', id(2)).expect(403);
    await post('ignore', 'b', id(2)).expect(403);
    expect(updateMany).not.toHaveBeenCalled();
  });
  it('conceals foreign/missing findings and foreign scan filters', async () => {
    rows.push({ ...fixture(2, 'b'), scanId: id(200) });
    for (const finding of [id(2), id(999)]) {
      await get(`/${finding}`).expect(404);
      await post('acknowledge', 'a', finding).expect(404);
      await post('ignore', 'a', finding).expect(404);
    }
    for (const scanId of [id(200), id(999)])
      expect((await get(`?scanId=${scanId}`).expect(200)).body.items).toEqual(
        [],
      );
    await get('', 'b').expect(403);
    expect(updateMany).not.toHaveBeenCalled();
  });
  it.each(['RESOLVED', 'REGRESSION'])(
    'protects %s from both actions',
    async (status) => {
      rows[0].status = status;
      await post('acknowledge').expect(409);
      await post('ignore').expect(409);
      expect(updateMany).not.toHaveBeenCalled();
    },
  );
  it.each([
    ['ACKNOWLEDGED', 'acknowledge'],
    ['IGNORED', 'ignore'],
  ])('idempotent %s', async (status, action) => {
    rows[0].status = status;
    await post(action).expect(200);
    await post(action).expect(200);
    expect(updateMany).not.toHaveBeenCalled();
  });
  it('uses tenant/status compare-and-set and reports concurrent change', async () => {
    race = true;
    await post('acknowledge').expect(409);
    expect(updateMany).toHaveBeenCalledWith({
      where: {
        id: id(1),
        status: 'OPEN',
        scan: { environment: { project: { organizationId: 'a' } } },
      },
      data: { status: 'ACKNOWLEDGED' },
    });
    expect(rows[0].status).toBe('OPEN');
  });
  it('offers no arbitrary status or reopen route', async () => {
    await request(app.getHttpServer())
      .patch(path(`/${id(1)}`))
      .auth(token, { type: 'bearer' })
      .send({ status: 'RESOLVED' })
      .expect(404);
    await post('reopen').expect(404);
    const response = await post('acknowledge')
      .send({ status: 'REGRESSION' })
      .expect(200);
    expect(response.body.status).toBe('ACKNOWLEDGED');
  });
  it('paginates ties deterministically without duplicates and preserves filters', async () => {
    rows = Array.from({ length: 7 }, (_, i) => fixture(i + 1));
    rows.push(fixture(99, 'b'));
    const seen: string[] = [];
    let cursor: string | null = null;
    do {
      const response: request.Response = await get(
        `?limit=2&category=NETWORK&severity=INFO&confidence=HIGH&status=OPEN&scanId=${id(100)}&ruleId=network.request-failure-observed${cursor ? '&cursor=' + cursor : ''}`,
      ).expect(200);
      seen.push(...response.body.items.map((r: { id: string }) => r.id));
      cursor = response.body.nextCursor;
    } while (cursor);
    expect(seen).toEqual([7, 6, 5, 4, 3, 2, 1].map(id));
    expect(new Set(seen).size).toBe(7);
    for (const q of [
      'category=RESOURCE',
      'severity=HIGH',
      'confidence=LOW',
      'status=RESOLVED',
      'ruleId=performance.lcp.above-good-threshold',
    ])
      expect((await get('?' + q).expect(200)).body.items).toEqual([]);
  });
  it.each([
    'limit=101',
    'limit=0',
    'limit=-1',
    'limit=1.5',
    'category=NOPE',
    'status=NOPE',
    'confidence=99',
    'severity=99',
    'scanId=bad',
    'ruleId=secret',
    'cursor=bad',
    'search=secret',
  ])('rejects invalid query %s', async (query) => {
    await get('?' + query).expect(400);
    expect(findMany).not.toHaveBeenCalled();
  });
  it('fails closed on malformed evidence for list/detail/actions', async () => {
    rows[0].evidence = { version: 99, raw: secret };
    for (const suffix of ['', `/${id(1)}`]) {
      const response = await get(suffix).expect(409);
      for (const c of secret)
        expect(JSON.stringify(response.body)).not.toContain(c);
    }
    await post('ignore').expect(409);
    expect(updateMany).not.toHaveBeenCalled();
  });
});
