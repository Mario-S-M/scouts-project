import { Component, Input } from '@angular/core';
import { SenderoProgress } from '../../../../core/models/caminante.model';

@Component({
  selector: 'app-senderos-panel',
  templateUrl: './senderos-panel.component.html',
})
export class SenderosPanelComponent {
  @Input() senderos: SenderoProgress[] = [];

  senderoColors: Record<string, { bg: string; border: string; icon: string; label: string }> = {
    Cenit: { bg: '#FF704322', border: '#FF7043', icon: 'pi-heart', label: 'Salud y Bienestar' },
    Cima: { bg: '#43A04722', border: '#43A047', icon: 'pi-globe', label: 'Medio Ambiente' },
    Cumbre: { bg: '#1E88E522', border: '#1E88E5', icon: 'pi-flag', label: 'Paz y Participación' },
    Cuspide: { bg: '#8E24AA22', border: '#8E24AA', icon: 'pi-bolt', label: 'Habilidades para la Vida' },
  };
}
