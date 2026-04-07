import { PartialType } from '@nestjs/mapped-types';
import { CreateCaminanteDto } from './create-caminante.dto';

export class UpdateCaminanteDto extends PartialType(CreateCaminanteDto) {}
