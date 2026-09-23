import { Module } from '@nestjs/common';

import { ProjectsModule } from '../projects/projects.module';
import { EnvironmentsController } from './environments.controller';
import { EnvironmentsService } from './environments.service';
import { AuthModule } from '../auth/auth.module';

@Module({
  imports: [AuthModule, ProjectsModule],
  controllers: [EnvironmentsController],
  providers: [EnvironmentsService],
})
export class EnvironmentsModule {}
