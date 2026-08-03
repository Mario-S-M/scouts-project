import { NgModule } from '@angular/core';
import { FullCalendarModule } from '@fullcalendar/angular';
import { ConfirmDialogModule } from 'primeng/confirmdialog';
import { ConfirmationService } from 'primeng/api';
import { SharedModule } from '../../shared/shared.module';
import { CalendarioRoutingModule } from './calendario-routing.module';
import { VistaCalendarioComponent } from './pages/vista-calendario/vista-calendario.component';
import { ConfiguracionRecordatoriosComponent } from './pages/configuracion-recordatorios/configuracion-recordatorios.component';

@NgModule({
  declarations: [VistaCalendarioComponent, ConfiguracionRecordatoriosComponent],
  imports: [SharedModule, CalendarioRoutingModule, FullCalendarModule, ConfirmDialogModule],
  providers: [ConfirmationService],
})
export class CalendarioModule {}
