import { IsString, Length, Matches } from 'class-validator';

export class CreateProjectDto {
  @IsString()
  @Length(2, 100)
  name!: string;

  @IsString()
  @Length(2, 60)
  @Matches(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, {
    message: 'slug must contain lowercase letters, numbers and hyphens only',
  })
  slug!: string;
}
