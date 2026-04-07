import { NgModule } from '@angular/core';
import { SharedModule } from '../../shared/shared.module';
import { EvidenciasRoutingModule } from './evidencias-routing.module';
import { SubirEvidenciaComponent } from './pages/subir-evidencia/subir-evidencia.component';

@NgModule({
  declarations: [SubirEvidenciaComponent],
  imports: [SharedModule, EvidenciasRoutingModule],
})
export class EvidenciasModule {}
