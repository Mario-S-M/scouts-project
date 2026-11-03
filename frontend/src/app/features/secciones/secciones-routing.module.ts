import { NgModule } from '@angular/core';
import { RouterModule, Routes } from '@angular/router';
import { ConfigSeccionesComponent } from './pages/config-secciones/config-secciones.component';

const routes: Routes = [{ path: '', component: ConfigSeccionesComponent }];

@NgModule({
  imports: [RouterModule.forChild(routes)],
  exports: [RouterModule],
})
export class SeccionesRoutingModule {}
