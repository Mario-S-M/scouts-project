import { Component, Input } from '@angular/core';
import { EspecialidadProgress } from '../../../../core/models/caminante.model';

@Component({
  selector: 'app-especialidades-panel',
  templateUrl: './especialidades-panel.component.html',
})
export class EspecialidadesPanelComponent {
  @Input() especialidades: EspecialidadProgress[] = [];
}
