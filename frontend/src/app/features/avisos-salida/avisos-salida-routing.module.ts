import { NgModule } from '@angular/core';
import { RouterModule, Routes } from '@angular/router';
import { CrearAvisoComponent } from './pages/crear-aviso/crear-aviso.component';
import { ListaAvisosComponent } from './pages/lista-avisos/lista-avisos.component';

const routes: Routes = [
  { path: '',             component: ListaAvisosComponent },
  { path: 'nuevo',        component: CrearAvisoComponent },
  { path: 'editar/:id',   component: CrearAvisoComponent },
];

@NgModule({
  imports: [RouterModule.forChild(routes)],
  exports: [RouterModule],
})
export class AvisosSalidaRoutingModule {}
