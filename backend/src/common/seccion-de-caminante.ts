import { NotFoundException } from '@nestjs/common';
import { DataSource } from 'typeorm';

/** Sección de un joven (users.rol = scout), para aplicar el candado de sección */
export async function seccionDeCaminante(ds: DataSource, caminanteId: number): Promise<string | null> {
  const row = await ds
    .createQueryBuilder()
    .select('u.seccion', 'seccion')
    .from('users', 'u')
    .where('u.id = :id', { id: caminanteId })
    .getRawOne();
  if (!row) throw new NotFoundException(`Joven #${caminanteId} no encontrado`);
  return row.seccion;
}
