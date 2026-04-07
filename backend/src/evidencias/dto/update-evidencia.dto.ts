import { PartialType } from '@nestjs/mapped-types';
import { CreateEvidenciaDto } from './create-evidencia.dto';

export class UpdateEvidenciaDto extends PartialType(CreateEvidenciaDto) {}
