import {
  Controller,
  Get,
  HttpCode,
  Param,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { OrganizationRole } from '@reactpulse/database';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { OrganizationAccessGuard } from '../organizations/guards/organization-access.guard';
import { OrganizationRoles } from '../organizations/decorators/organization-roles.decorator';
import { FindingsService } from './findings.service';

@Controller('organizations/:organizationId/findings')
@UseGuards(JwtAuthGuard, OrganizationAccessGuard)
export class FindingsController {
  constructor(private readonly findings: FindingsService) {}
  @Get()
  list(
    @Param('organizationId') organizationId: string,
    @Query() query: Record<string, unknown>,
  ) {
    return this.findings.list(organizationId, query);
  }
  @Get(':findingId')
  detail(
    @Param('organizationId') organizationId: string,
    @Param('findingId') findingId: string,
  ) {
    return this.findings.detail(organizationId, findingId);
  }
  @Post(':findingId/acknowledge')
  @HttpCode(200)
  @OrganizationRoles(
    OrganizationRole.OWNER,
    OrganizationRole.ADMIN,
    OrganizationRole.DEVELOPER,
  )
  acknowledge(
    @Param('organizationId') organizationId: string,
    @Param('findingId') findingId: string,
  ) {
    return this.findings.act(organizationId, findingId, 'acknowledge');
  }
  @Post(':findingId/ignore')
  @HttpCode(200)
  @OrganizationRoles(
    OrganizationRole.OWNER,
    OrganizationRole.ADMIN,
    OrganizationRole.DEVELOPER,
  )
  ignore(
    @Param('organizationId') organizationId: string,
    @Param('findingId') findingId: string,
  ) {
    return this.findings.act(organizationId, findingId, 'ignore');
  }
}
