import { NgModule } from '@angular/core';
import { RouterModule, Routes } from '@angular/router';
import { AuthGuard } from './core/guards/auth.guard';
import { JefeGrupoGuard } from './core/guards/role.guard';

const routes: Routes = [
  {
    path: 'login',
    loadChildren: () => import('./features/auth/auth.module').then(m => m.AuthModule),
  },
  {
    path: '',
    canActivate: [AuthGuard],
    loadChildren: () => import('./features/dashboard/dashboard.module').then(m => m.DashboardModule),
  },
  {
    path: 'caminantes',
    canActivate: [AuthGuard],
    loadChildren: () => import('./features/caminantes/caminantes.module').then(m => m.CaminantesModule),
  },
  {
    path: 'evidencias',
    canActivate: [AuthGuard],
    loadChildren: () => import('./features/evidencias/evidencias.module').then(m => m.EvidenciasModule),
  },
  {
    path: 'validacion',
    canActivate: [AuthGuard],
    loadChildren: () => import('./features/validacion/validacion.module').then(m => m.ValidacionModule),
  },
  {
    path: 'insignias',
    canActivate: [AuthGuard],
    loadChildren: () => import('./features/insignias/insignias.module').then(m => m.InsigniasModule),
  },
  {
    path: 'usuarios',
    canActivate: [AuthGuard, JefeGrupoGuard],
    loadChildren: () => import('./features/usuarios/usuarios.module').then(m => m.UsuariosModule),
  },
  {
    path: 'avisos-salida',
    canActivate: [AuthGuard],
    loadChildren: () => import('./features/avisos-salida/avisos-salida.module').then(m => m.AvisosSalidaModule),
  },
  {
    path: 'mi-comunidad',
    canActivate: [AuthGuard],
    loadChildren: () => import('./features/mi-comunidad/mi-comunidad.module').then(m => m.MiComunidadModule),
  },
  {
    path: 'informes',
    canActivate: [AuthGuard],
    loadChildren: () => import('./features/informes/informes.module').then(m => m.InformesModule),
  },
  {
    path: 'ciclos-programa',
    canActivate: [AuthGuard],
    loadChildren: () => import('./features/ciclos-programa/ciclos-programa.module').then(m => m.CiclosProgramaModule),
  },
  { path: '**', redirectTo: '' },
];

@NgModule({
  imports: [RouterModule.forRoot(routes, { useHash: false })],
  exports: [RouterModule],
})
export class AppRoutingModule {}
