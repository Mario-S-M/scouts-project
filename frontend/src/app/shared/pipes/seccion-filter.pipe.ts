import { Pipe, PipeTransform } from '@angular/core';

@Pipe({ name: 'seccionFilter' })
export class SeccionFilterPipe implements PipeTransform {
  transform(items: any[], seccion: string): any[] {
    if (!items || !seccion) return items ?? [];
    return items.filter(c => c.seccion === seccion);
  }
}
