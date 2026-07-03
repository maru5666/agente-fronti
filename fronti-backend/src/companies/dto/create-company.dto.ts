import {
  IsEmail,
  IsNotEmpty,
  IsOptional,
  Matches,
  IsString,
  MinLength,
} from 'class-validator';

export class CreateCompanyDto {
  @IsString()
  @IsNotEmpty()
  name: string;

  @IsString()
  @IsNotEmpty()
  @Matches(/^[a-z0-9]{3,20}$/, {
    message:
      'El ID de la empresa debe tener solo letras minusculas y numeros, sin espacios, entre 3 y 20 caracteres.',
  })
  workspaceCode: string;

  @IsString()
  @IsNotEmpty()
  rif: string;

  @IsString()
  @IsNotEmpty()
  phone: string;

  @IsString()
  @IsOptional()
  address?: string;

  @IsEmail()
  email: string;

  @IsString()
  @MinLength(8, { message: 'La contraseña debe tener al menos 8 caracteres.' })
  password: string;
}
