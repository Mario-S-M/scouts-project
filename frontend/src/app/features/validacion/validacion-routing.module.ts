import { NgModule } from '@angular/core';
import { RouterModule, Routes } from '@angular/router';
import { PanelValidacionComponent } from './pages/panel-validacion/panel-validacion.component';

const routes: Routes = [
  { path: '', component: PanelValidacionComponent },
];

@NgModule({
  imports: [RouterModule.forChild(routes)],
  exports: [RouterModule],
})
export class ValidacionRoutingModule {}
