import { IsEnum, IsString, Length } from 'class-validator';
import { EnvironmentType } from '@reactpulse/database';

export class CreateEnvironmentDto {
  @IsString()
  @Length(2, 60)
  name!: string;

  @IsString()
  url!: string;

  @IsEnum(EnvironmentType)
  type!: EnvironmentType;
}
