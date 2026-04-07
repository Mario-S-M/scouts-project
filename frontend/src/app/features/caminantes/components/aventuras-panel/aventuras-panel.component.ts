import { Component, Input } from '@angular/core';
import { AventuraProgress } from '../../../../core/models/caminante.model';

@Component({
  selector: 'app-aventuras-panel',
  templateUrl: './aventuras-panel.component.html',
})
export class AventurasPanelComponent {
  @Input() aventuras: AventuraProgress[] = [];
  @Input() terraNova: boolean = false;

  aventuraIcons: Record<string, string> = {
    TerraNova: '🏕️',
    KonTiki: '⛵',
    '7Cimas': '🏔️',
    Discovery: '🧭',
  };
}
