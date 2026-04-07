import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';

import { TableModule } from 'primeng/table';
import { ButtonModule } from 'primeng/button';
import { DialogModule } from 'primeng/dialog';
import { InputTextModule } from 'primeng/inputtext';
import { DropdownModule } from 'primeng/dropdown';
import { TagModule } from 'primeng/tag';
import { AvatarModule } from 'primeng/avatar';
import { TooltipModule } from 'primeng/tooltip';
import { InputSwitchModule } from 'primeng/inputswitch';
import { ConfirmDialogModule } from 'primeng/confirmdialog';
import { ConfirmationService } from 'primeng/api';

import { UsuariosRoutingModule } from './usuarios-routing.module';
import { GestionUsuariosComponent } from './pages/gestion-usuarios/gestion-usuarios.component';

@NgModule({
  declarations: [GestionUsuariosComponent],
  imports: [
    CommonModule,
    FormsModule,
    UsuariosRoutingModule,
    TableModule,
    ButtonModule,
    DialogModule,
    InputTextModule,
    DropdownModule,
    TagModule,
    AvatarModule,
    TooltipModule,
    InputSwitchModule,
    ConfirmDialogModule,
  ],
  providers: [ConfirmationService],
})
export class UsuariosModule {}
