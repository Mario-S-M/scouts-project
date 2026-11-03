import { NgModule } from '@angular/core';
import { ConfirmationService } from 'primeng/api';
import { SharedModule } from '../../shared/shared.module';
import { InsigniasRoutingModule } from './insignias-routing.module';
import { GaleriaInsigniasComponent } from './pages/galeria-insignias/galeria-insignias.component';
import { ListadoSolicitudesComponent } from './pages/listado-solicitudes/listado-solicitudes.component';
import { CrearSolicitudComponent } from './pages/crear-solicitud/crear-solicitud.component';
import { CatalogoInsigniasComponent } from './pages/catalogo-insignias/catalogo-insignias.component';

@NgModule({
  declarations: [
    GaleriaInsigniasComponent,
    ListadoSolicitudesComponent,
    CrearSolicitudComponent,
    CatalogoInsigniasComponent,
  ],
  imports: [SharedModule, InsigniasRoutingModule],
  // ConfirmationService no está provisto en el AppModule, a diferencia de
  // MessageService, así que el feature lo aporta para sus p-confirmDialog
  providers: [ConfirmationService],
})
export class InsigniasModule {}
