import { NgModule } from '@angular/core';
import { SharedModule } from '../../shared/shared.module';
import { InformesRoutingModule } from './informes-routing.module';
import { ListaInformesComponent } from './pages/lista-informes/lista-informes.component';
import { CrearInformeComponent } from './pages/crear-informe/crear-informe.component';
import { ConfirmationService } from 'primeng/api';
import { ConfirmDialogModule } from 'primeng/confirmdialog';

@NgModule({
  declarations: [ListaInformesComponent, CrearInformeComponent],
  imports: [SharedModule, InformesRoutingModule, ConfirmDialogModule],
  providers: [ConfirmationService],
})
export class InformesModule {}
