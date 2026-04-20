import { NgModule } from '@angular/core';
import { RouterModule, Routes } from '@angular/router';
import { ListaInformesComponent } from './pages/lista-informes/lista-informes.component';
import { CrearInformeComponent } from './pages/crear-informe/crear-informe.component';

const routes: Routes = [
  { path: '',           component: ListaInformesComponent },
  { path: 'nuevo',      component: CrearInformeComponent },
  { path: 'editar/:id', component: CrearInformeComponent },
];

@NgModule({
  imports: [RouterModule.forChild(routes)],
  exports: [RouterModule],
})
export class InformesRoutingModule {}
