import { Pipe, PipeTransform } from '@angular/core';

@Pipe({ name: 'completasFilter' })
export class CompletasFilterPipe implements PipeTransform {
  transform(actividades: any[]): number {
    if (!actividades) return 0;
    return actividades.filter(a => !!a.nombre && !!a.ejeTematico).length;
  }
}
