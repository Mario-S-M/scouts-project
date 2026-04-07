import { Component, Input } from '@angular/core';
import { InsigniaProgress } from '../../../../core/models/caminante.model';

@Component({
  selector: 'app-insignias-caminante',
  templateUrl: './insignias-caminante.component.html',
})
export class InsigniasCaminanteComponent {
  @Input() insignias: InsigniaProgress[] = [];
  @Input() camisola: boolean = false;

  insigniaIcons: Record<string, { emoji: string; color: string; desc: string }> = {
    Obsidiana: { emoji: '🖤', color: '#546E7A', desc: '3 Senderos + 1.5 años' },
    Jade: { emoji: '💚', color: '#2E7D32', desc: '4 Senderos + 2 años' },
    Opalo: { emoji: '💜', color: '#7B1FA2', desc: '4 Senderos + 2.5 años' },
    Diamante: { emoji: '💎', color: '#0D47A1', desc: '4 Senderos + 3 años' },
  };
}
