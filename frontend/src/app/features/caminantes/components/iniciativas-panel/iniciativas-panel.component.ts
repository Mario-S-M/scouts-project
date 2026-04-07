import { Component, Input } from '@angular/core';
import { IniciativaProgress } from '../../../../core/models/caminante.model';

@Component({
  selector: 'app-iniciativas-panel',
  templateUrl: './iniciativas-panel.component.html',
})
export class IniciativasPanelComponent {
  @Input() iniciativas: IniciativaProgress[] = [];

  iniciativaLabels: Record<string, string> = {
    MOP: 'Mensajeros de la Paz',
    ChampionsForNature: 'Champions for Nature',
    PlasticTideTurners: 'Plastic Tide Turners',
    ScoutsGoSolar: 'Scouts Go Solar',
    AccionesHumanitarias: 'Acciones Humanitarias',
  };
}
