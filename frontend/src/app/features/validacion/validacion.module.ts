import { NgModule } from '@angular/core';
import { SharedModule } from '../../shared/shared.module';
import { ValidacionRoutingModule } from './validacion-routing.module';
import { PanelValidacionComponent } from './pages/panel-validacion/panel-validacion.component';

@NgModule({
  declarations: [PanelValidacionComponent],
  imports: [SharedModule, ValidacionRoutingModule],
})
export class ValidacionModule {}
