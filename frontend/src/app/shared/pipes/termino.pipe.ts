import { Pipe, PipeTransform } from '@angular/core';
import { SeccionService, Termino } from '../../core/services/seccion.service';

/**
 * Vocabulario de la sección: {{ 'Plural' | termino }} → "Lobatos y lobeznas".
 * Impuro porque la configuración llega de la API después del primer render.
 */
@Pipe({ name: 'termino', pure: false })
export class TerminoPipe implements PipeTransform {
  constructor(private secciones: SeccionService) {}

  transform(tipo: Termino, clave?: string | null): string {
    return this.secciones.termino(tipo, clave);
  }
}
