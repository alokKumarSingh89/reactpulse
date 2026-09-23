import { IsEnum, IsOptional, IsString, Length } from 'class-validator';
import { ProjectStatus } from '@reactpulse/database';

export class UpdateProjectDto {
  @IsOptional()
  @IsString()
  @Length(2, 100)
  name?: string;

  @IsOptional()
  @IsEnum(ProjectStatus)
  status?: ProjectStatus;
}
