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

describe('organization security report HTTP boundary', () => {
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
    `/api/v1/organizations/${org}/scans/${id}/security`;
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
            where: { category: 'SECURITY' },
          }),
          evidence: expect.objectContaining({
            where: { type: 'DOCUMENT_RESPONSE', sequence: 1 },
          }),
        }),
      }),
    );
  });
  it('projects secret-bearing stored JSON before HTTP serialization', async () => {
    const secrets = [
      'authorization-secret-canary',
      'cookie-secret-canary',
      'query-secret-canary',
      'nonce-secret-canary',
      'console-secret-canary',
    ];
    findScan.mockResolvedValue({
      id: 'own',
      status: 'COMPLETED',
      completedAt: null,
      evidence: [
        {
          data: {
            kind: 'PASSIVE_SECURITY_ASSESSMENT',
            coverage: {
              version: 1,
              rulesetVersion: 1,
              state: 'COMPLETE',
              reasons: [],
              raw: secrets,
            },
            headers: secrets,
          },
        },
      ],
      findings: [
        {
          category: 'SECURITY',
          ruleId: 'security.csp.missing',
          severity: 'MEDIUM',
          confidence: 'HIGH',
          status: 'OPEN',
          title: secrets.join(' '),
          evidence: {
            version: 1,
            ruleVersion: 1,
            outcome: 'POSTURE',
            reason: 'ENFORCED_CSP_ABSENT',
            source: 'csp',
            subject: { kind: 'MAIN_DOCUMENT', cookies: secrets },
            headers: secrets,
          },
        },
      ],
    });
    const response = await request(app.getHttpServer())
      .get(path())
      .auth(token, { type: 'bearer' })
      .expect(200);
    expect(response.body.findings).toHaveLength(1);
    for (const secret of secrets)
      expect(JSON.stringify(response.body)).not.toContain(secret);
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
