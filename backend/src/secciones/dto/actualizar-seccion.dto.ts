import { IsBoolean, IsOptional, IsString, Matches, MaxLength } from 'class-validator';

const HEX = /^#[0-9A-Fa-f]{6}$/;

export class ActualizarSeccionDto {
  @IsOptional() @IsString() @MaxLength(80) nombreCompleto?: string;
  @IsOptional() @IsString() @MaxLength(40) nombreCorto?: string;
  @IsOptional() @IsString() @MaxLength(60) jovenSingular?: string;
  @IsOptional() @IsString() @MaxLength(60) jovenPlural?: string;
  @IsOptional() @IsString() @MaxLength(80) cargoJefe?: string;
  @IsOptional() @IsString() @MaxLength(80) cargoSubjefe?: string;
  @IsOptional() @Matches(HEX, { message: 'colorPrincipal debe ser #RRGGBB' }) colorPrincipal?: string;
  @IsOptional() @Matches(HEX, { message: 'colorOscuro debe ser #RRGGBB' }) colorOscuro?: string;
  @IsOptional() @Matches(HEX, { message: 'colorAcento debe ser #RRGGBB' }) colorAcento?: string;
  @IsOptional() @Matches(HEX, { message: 'colorTextoAcento debe ser #RRGGBB' }) colorTextoAcento?: string;
  @IsOptional() @IsBoolean() progresionHabilitada?: boolean;
}
