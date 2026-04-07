import { Component, Input } from '@angular/core';

@Component({
  selector: 'app-stat-card',
  templateUrl: './stat-card.component.html',
})
export class StatCardComponent {
  @Input() label: string = '';
  @Input() value: number | string = 0;
  @Input() icon: string = '';
  @Input() color: string = '#2E7D32';
}
