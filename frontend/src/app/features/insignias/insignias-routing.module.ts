import { NgModule } from '@angular/core';
import { RouterModule, Routes } from '@angular/router';
import { JefeSeccionGuard } from '../../core/guards/role.guard';
import { GaleriaInsigniasComponent } from './pages/galeria-insignias/galeria-insignias.component';
import { ListadoSolicitudesComponent } from './pages/listado-solicitudes/listado-solicitudes.component';
import { CrearSolicitudComponent } from './pages/crear-solicitud/crear-solicitud.component';
import { CatalogoInsigniasComponent } from './pages/catalogo-insignias/catalogo-insignias.component';

// AuthGuard ya protege la ruta padre 'insignias' en app-routing.module.ts
const routes: Routes = [
  { path: '', component: GaleriaInsigniasComponent },
  {
    path: 'solicitudes',
    component: ListadoSolicitudesComponent,
    canActivate: [JefeSeccionGuard],
  },
  // 'nueva' va antes que ':id' o se interpretaría como un identificador
  {
    path: 'solicitudes/nueva',
    component: CrearSolicitudComponent,
    canActivate: [JefeSeccionGuard],
  },
  {
    path: 'solicitudes/:id',
    component: CrearSolicitudComponent,
    canActivate: [JefeSeccionGuard],
  },
  {
    path: 'catalogo',
    component: CatalogoInsigniasComponent,
    canActivate: [JefeSeccionGuard],
  },
];

@NgModule({
  imports: [RouterModule.forChild(routes)],
  exports: [RouterModule],
})
export class InsigniasRoutingModule {}
