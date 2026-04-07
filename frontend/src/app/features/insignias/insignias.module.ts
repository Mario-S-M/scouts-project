import { NgModule } from '@angular/core';
import { SharedModule } from '../../shared/shared.module';
import { InsigniasRoutingModule } from './insignias-routing.module';
import { GaleriaInsigniasComponent } from './pages/galeria-insignias/galeria-insignias.component';

@NgModule({
  declarations: [GaleriaInsigniasComponent],
  imports: [SharedModule, InsigniasRoutingModule],
})
export class InsigniasModule {}
