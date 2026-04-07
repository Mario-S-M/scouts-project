import { NgModule } from '@angular/core';
import { SharedModule } from '../../shared/shared.module';
import { MiComunidadRoutingModule } from './mi-comunidad-routing.module';
import { MiComunidadComponent } from './pages/mi-comunidad.component';

@NgModule({
  declarations: [MiComunidadComponent],
  imports: [SharedModule, MiComunidadRoutingModule],
})
export class MiComunidadModule {}
