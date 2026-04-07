import { Pipe, PipeTransform } from '@angular/core';

@Pipe({ name: 'estadoFilter' })
export class EstadoBadgePipe implements PipeTransform {
  transform(items: any[], estado: string): any[] {
    if (!items) return [];
    if (!estado) return items;
    return items.filter(item => item.estado === estado);
  }
}
