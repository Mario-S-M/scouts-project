import { NgModule } from '@angular/core';
import { SharedModule } from '../../shared/shared.module';
import { CaminantesRoutingModule } from './caminantes-routing.module';

// Pages
import { ListaCaminantesComponent } from './pages/lista-caminantes/lista-caminantes.component';
import { PerfilCaminanteComponent } from './pages/perfil-caminante/perfil-caminante.component';
import { RegistroCaminanteComponent } from './pages/registro-caminante/registro-caminante.component';

// Components
import { SenderosPanelComponent } from './components/senderos-panel/senderos-panel.component';
import { EspecialidadesPanelComponent } from './components/especialidades-panel/especialidades-panel.component';
import { AventurasPanelComponent } from './components/aventuras-panel/aventuras-panel.component';
import { IniciativasPanelComponent } from './components/iniciativas-panel/iniciativas-panel.component';
import { InsigniasCaminanteComponent } from './components/insignias-caminante/insignias-caminante.component';

@NgModule({
  declarations: [
    ListaCaminantesComponent,
    PerfilCaminanteComponent,
    RegistroCaminanteComponent,
    SenderosPanelComponent,
    EspecialidadesPanelComponent,
    AventurasPanelComponent,
    IniciativasPanelComponent,
    InsigniasCaminanteComponent,
  ],
  imports: [SharedModule, CaminantesRoutingModule],
})
export class CaminantesModule {}
