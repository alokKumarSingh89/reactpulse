import { IsEnum, IsOptional, IsString, Length } from 'class-validator';
import { EnvironmentType } from '@reactpulse/database';

export class UpdateEnvironmentDto {
  @IsOptional()
  @IsString()
  @Length(2, 60)
  name?: string;

  @IsOptional()
  @IsString()
  url?: string;

  @IsOptional()
  @IsEnum(EnvironmentType)
  type?: EnvironmentType;
}
