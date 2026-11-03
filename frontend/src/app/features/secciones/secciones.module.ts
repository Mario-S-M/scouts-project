import { NgModule } from '@angular/core';
import { SharedModule } from '../../shared/shared.module';
import { SeccionesRoutingModule } from './secciones-routing.module';
import { ConfigSeccionesComponent } from './pages/config-secciones/config-secciones.component';

@NgModule({
  declarations: [ConfigSeccionesComponent],
  imports: [SharedModule, SeccionesRoutingModule],
})
export class SeccionesModule {}
