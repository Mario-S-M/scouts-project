import { NgModule } from '@angular/core';
import { RouterModule, Routes } from '@angular/router';
import { ListaCaminantesComponent } from './pages/lista-caminantes/lista-caminantes.component';
import { PerfilCaminanteComponent } from './pages/perfil-caminante/perfil-caminante.component';
import { RegistroCaminanteComponent } from './pages/registro-caminante/registro-caminante.component';

const routes: Routes = [
  { path: '', component: ListaCaminantesComponent },
  { path: 'registro', component: RegistroCaminanteComponent },
  { path: ':id', component: PerfilCaminanteComponent },
];

@NgModule({
  imports: [RouterModule.forChild(routes)],
  exports: [RouterModule],
})
export class CaminantesRoutingModule {}
