import { NgModule } from '@angular/core';
import { RouterModule, Routes } from '@angular/router';
import { MiComunidadComponent } from './pages/mi-comunidad.component';

const routes: Routes = [
  { path: '', component: MiComunidadComponent },
];

@NgModule({
  imports: [RouterModule.forChild(routes)],
  exports: [RouterModule],
})
export class MiComunidadRoutingModule {}
