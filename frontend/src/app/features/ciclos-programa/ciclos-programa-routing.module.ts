import { NgModule } from '@angular/core';
import { RouterModule, Routes } from '@angular/router';
import { ListaCiclosComponent } from './pages/lista-ciclos/lista-ciclos.component';
import { CrearCicloComponent } from './pages/crear-ciclo/crear-ciclo.component';

const routes: Routes = [
  { path: '',           component: ListaCiclosComponent },
  { path: 'nuevo',      component: CrearCicloComponent },
  { path: 'editar/:id', component: CrearCicloComponent },
];

@NgModule({
  imports: [RouterModule.forChild(routes)],
  exports: [RouterModule],
})
export class CiclosProgramaRoutingModule {}
