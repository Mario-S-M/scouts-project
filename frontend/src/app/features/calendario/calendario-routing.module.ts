import { NgModule } from '@angular/core';
import { RouterModule, Routes } from '@angular/router';
import { VistaCalendarioComponent } from './pages/vista-calendario/vista-calendario.component';
import { ConfiguracionRecordatoriosComponent } from './pages/configuracion-recordatorios/configuracion-recordatorios.component';

const routes: Routes = [
  { path: '',               component: VistaCalendarioComponent },
  { path: 'recordatorios',  component: ConfiguracionRecordatoriosComponent },
];

@NgModule({
  imports: [RouterModule.forChild(routes)],
  exports: [RouterModule],
})
export class CalendarioRoutingModule {}
