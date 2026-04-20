import { NgModule } from '@angular/core';
import { SharedModule } from '../../shared/shared.module';
import { CiclosProgramaRoutingModule } from './ciclos-programa-routing.module';
import { ListaCiclosComponent } from './pages/lista-ciclos/lista-ciclos.component';
import { CrearCicloComponent } from './pages/crear-ciclo/crear-ciclo.component';
import { CompletasFilterPipe } from './pipes/completas-filter.pipe';
import { ConfirmationService } from 'primeng/api';
import { ConfirmDialogModule } from 'primeng/confirmdialog';

@NgModule({
  declarations: [
    ListaCiclosComponent,
    CrearCicloComponent,
    CompletasFilterPipe,
  ],
  imports: [
    SharedModule,
    CiclosProgramaRoutingModule,
    ConfirmDialogModule,
  ],
  providers: [ConfirmationService],
})
export class CiclosProgramaModule {}
