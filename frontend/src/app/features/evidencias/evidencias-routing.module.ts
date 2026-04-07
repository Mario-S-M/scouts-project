import { NgModule } from '@angular/core';
import { RouterModule, Routes } from '@angular/router';
import { SubirEvidenciaComponent } from './pages/subir-evidencia/subir-evidencia.component';

const routes: Routes = [
  { path: 'nueva', component: SubirEvidenciaComponent },
  { path: '', redirectTo: 'nueva', pathMatch: 'full' },
];

@NgModule({
  imports: [RouterModule.forChild(routes)],
  exports: [RouterModule],
})
export class EvidenciasRoutingModule {}
