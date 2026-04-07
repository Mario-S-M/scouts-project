import { NgModule } from '@angular/core';
import { RouterModule, Routes } from '@angular/router';
import { GaleriaInsigniasComponent } from './pages/galeria-insignias/galeria-insignias.component';

const routes: Routes = [
  { path: '', component: GaleriaInsigniasComponent },
];

@NgModule({
  imports: [RouterModule.forChild(routes)],
  exports: [RouterModule],
})
export class InsigniasRoutingModule {}
