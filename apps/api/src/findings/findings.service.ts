import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  isFindingUuid,
  projectFindingListQuery,
  projectPublicFinding,
  type FindingLifecycleAction,
  type FindingListResponse,
} from '@reactpulse/contracts';
import type { Prisma } from '@reactpulse/database';
import { DatabaseService } from '../database/database.service';

const select = {
  id: true,
  scanId: true,
  category: true,
  ruleId: true,
  severity: true,
  confidence: true,
  status: true,
  evidence: true,
  firstDetectedAt: true,
  lastDetectedAt: true,
  createdAt: true,
  updatedAt: true,
} as const satisfies Prisma.FindingSelect;
type Row = Prisma.FindingGetPayload<{ select: typeof select }>;
function project(row: Row) {
  const safe = projectPublicFinding({
    ...row,
    firstDetectedAt: row.firstDetectedAt.toISOString(),
    lastDetectedAt: row.lastDetectedAt.toISOString(),
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  });
  if (!safe) throw new ConflictException('Finding data is unavailable');
  return safe;
}
function scope(organizationId: string): Prisma.FindingWhereInput {
  return { scan: { environment: { project: { organizationId } } } };
}
function decodeCursor(value: string): { id: string; createdAt: Date } {
  try {
    const decoded: unknown = JSON.parse(
      Buffer.from(value, 'base64url').toString('utf8'),
    );
    if (
      !Array.isArray(decoded) ||
      decoded.length !== 2 ||
      !isFindingUuid(decoded[1]) ||
      typeof decoded[0] !== 'string'
    )
      throw new Error();
    const date = new Date(decoded[0]);
    if (!Number.isFinite(date.getTime()) || date.toISOString() !== decoded[0])
      throw new Error();
    return { id: decoded[1], createdAt: date };
  } catch {
    throw new BadRequestException('Invalid findings cursor');
  }
}
@Injectable()
export class FindingsService {
  constructor(private readonly database: DatabaseService) {}
  async list(
    organizationId: string,
    rawQuery: unknown,
  ): Promise<FindingListResponse> {
    const query = projectFindingListQuery(rawQuery);
    if (!query) throw new BadRequestException('Invalid findings query');
    const { cursor, limit, ...filters } = query;
    const anchor = cursor ? decodeCursor(cursor) : null;
    const where: Prisma.FindingWhereInput = {
      ...scope(organizationId),
      ...filters,
      ...(anchor
        ? {
            OR: [
              { createdAt: { lt: anchor.createdAt } },
              { createdAt: anchor.createdAt, id: { lt: anchor.id } },
            ],
          }
        : {}),
    };
    // Ownership remains relational even with scanId/cursor filters: foreign and
    // nonexistent scan IDs both produce empty pages, never an existence oracle.
    const rows = await this.database.client.finding.findMany({
      where,
      select,
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
      take: limit + 1,
    });
    const page = rows.slice(0, limit);
    const items = page.map(project);
    const last = page.at(-1);
    return {
      items,
      nextCursor:
        rows.length > limit && last
          ? Buffer.from(
              JSON.stringify([last.createdAt.toISOString(), last.id]),
            ).toString('base64url')
          : null,
    };
  }
  async detail(organizationId: string, id: string) {
    if (!isFindingUuid(id)) throw new NotFoundException('Finding not found');
    const row = await this.database.client.finding.findFirst({
      where: { ...scope(organizationId), id },
      select,
    });
    if (!row) throw new NotFoundException('Finding not found');
    return project(row);
  }
  async act(
    organizationId: string,
    id: string,
    action: FindingLifecycleAction,
  ) {
    if (!isFindingUuid(id)) throw new NotFoundException('Finding not found');
    const target = action === 'acknowledge' ? 'ACKNOWLEDGED' : 'IGNORED';
    return this.database.client.$transaction(async (tx) => {
      const where = { ...scope(organizationId), id };
      const row = await tx.finding.findFirst({ where, select });
      if (!row) throw new NotFoundException('Finding not found');
      const safe = project(row);
      if (row.status === 'RESOLVED' || row.status === 'REGRESSION')
        throw new ConflictException(
          'Finding status does not allow this action',
        );
      if (row.status === target) return safe;
      // Compare-and-set includes tenant ownership and the observed status. A
      // concurrent action or system transition cannot be overwritten silently.
      const changed = await tx.finding.updateMany({
        where: { ...where, status: row.status },
        data: { status: target },
      });
      if (changed.count !== 1)
        throw new ConflictException('Finding changed; retry the action');
      const updated = await tx.finding.findFirst({ where, select });
      if (!updated) throw new NotFoundException('Finding not found');
      return project(updated);
    });
  }
}
