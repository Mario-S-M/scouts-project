import { NgModule } from '@angular/core';
import { SharedModule } from '../../shared/shared.module';
import { AvisosSalidaRoutingModule } from './avisos-salida-routing.module';
import { CrearAvisoComponent } from './pages/crear-aviso/crear-aviso.component';
import { ListaAvisosComponent } from './pages/lista-avisos/lista-avisos.component';
import { ConfirmationService } from 'primeng/api';
import { ConfirmDialogModule } from 'primeng/confirmdialog';
import { TableModule } from 'primeng/table';
import { TooltipModule } from 'primeng/tooltip';
import { TagModule } from 'primeng/tag';

@NgModule({
  declarations: [CrearAvisoComponent, ListaAvisosComponent],
  imports: [
    SharedModule,
    AvisosSalidaRoutingModule,
    ConfirmDialogModule,
    TableModule,
    TooltipModule,
    TagModule,
  ],
  providers: [ConfirmationService],
})
export class AvisosSalidaModule {}
