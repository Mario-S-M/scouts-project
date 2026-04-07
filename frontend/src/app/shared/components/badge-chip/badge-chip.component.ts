import { Component, Input } from '@angular/core';

@Component({
  selector: 'app-badge-chip',
  templateUrl: './badge-chip.component.html',
})
export class BadgeChipComponent {
  @Input() estado: 'pendiente' | 'aprobada' | 'rechazada' = 'pendiente';

  get severity(): string {
    const map: Record<string, string> = {
      pendiente: 'warning',
      aprobada: 'success',
      rechazada: 'danger',
    };
    return map[this.estado] || 'info';
  }
}
