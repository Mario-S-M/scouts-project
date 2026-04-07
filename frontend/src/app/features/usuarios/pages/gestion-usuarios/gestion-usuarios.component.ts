import { Component, OnInit } from '@angular/core';
import { MessageService, ConfirmationService } from 'primeng/api';
import { UsuariosService, UsuarioAdmin } from '../../../../core/services/usuarios.service';

export const ROLES = [
  // Grupo
  { label: '── Grupo ──────────────', value: '', disabled: true },
  { label: 'Jefe de Grupo',        value: 'jefe_grupo' },
  { label: 'Subjefe de Grupo',     value: 'sub_jefe_grupo' },
  { label: 'Colaborador de Grupo', value: 'colaborador_grupo' },
  { label: 'Contador de Grupo',    value: 'contador_grupo' },
  { label: 'Secretario de Grupo',  value: 'secretario_grupo' },
  // Manada
  { label: '── Manada ─────────────', value: '', disabled: true },
  { label: 'Jefe de Manada',       value: 'jefe_manada' },
  { label: 'Subjefe de Manada',    value: 'sub_jefe_manada' },
  // Tropa
  { label: '── Tropa ──────────────', value: '', disabled: true },
  { label: 'Jefe de Tropa',        value: 'jefe_tropa' },
  { label: 'Subjefe de Tropa',     value: 'sub_jefe_tropa' },
  // Comunidad
  { label: '── Comunidad ──────────', value: '', disabled: true },
  { label: 'Jefe de Comunidad',    value: 'jefe_comunidad' },
  { label: 'Subjefe de Comunidad', value: 'sub_jefe_comunidad' },
  // Clan
  { label: '── Clan ───────────────', value: '', disabled: true },
  { label: 'Jefe de Clan',         value: 'jefe_clan' },
  { label: 'Subjefe de Clan',      value: 'sub_jefe_clan' },
  // Joven
  { label: '── Joven ──────────────', value: '', disabled: true },
  { label: 'Scout',                value: 'scout' },
];

@Component({
  selector: 'app-gestion-usuarios',
  templateUrl: './gestion-usuarios.component.html',
  styleUrls: ['./gestion-usuarios.component.scss'],
})
export class GestionUsuariosComponent implements OnInit {
  usuarios: UsuarioAdmin[] = [];
  loading = false;
  roles = ROLES;

  // Diálogo editar
  editDialogVisible = false;
  editUser: Partial<UsuarioAdmin & { newPassword: string }> = {};
  editLoading = false;
  cambiarPassword = false;

  // Diálogo nuevo usuario
  newDialogVisible = false;
  newUser = { nombre: '', email: '', password: '', rol: 'scout' };
  newLoading = false;

  constructor(
    private usuariosService: UsuariosService,
    private messageService: MessageService,
    private confirmationService: ConfirmationService,
  ) {}

  ngOnInit() {
    this.load();
  }

  load() {
    this.loading = true;
    this.usuariosService.getAll().subscribe({
      next: (data) => { this.usuarios = data; this.loading = false; },
      error: () => { this.loading = false; },
    });
  }

  getRolLabel(rol: string): string {
    return this.roles.find(r => r.value === rol)?.label ?? rol;
  }

  getRolStyle(rol: string): Record<string, string> {
    // Colores idénticos a los temas del navbar
    if (['jefe_grupo','sub_jefe_grupo','colaborador_grupo','contador_grupo','secretario_grupo'].includes(rol))
      return { background: '#6B7280', color: '#fff' };                   // Gris Oxford
    if (['jefe_manada','sub_jefe_manada'].includes(rol))
      return { background: '#EAB308', color: '#422006' };                // Amarillo
    if (['jefe_tropa','sub_jefe_tropa'].includes(rol))
      return { background: '#15803D', color: '#fff' };                   // Verde bandera
    if (['jefe_comunidad','sub_jefe_comunidad'].includes(rol))
      return { background: '#002CFF', color: '#fff' };                   // Azul comunidad
    if (['jefe_clan','sub_jefe_clan'].includes(rol))
      return { background: '#B91C1C', color: '#fff' };                   // Rojo
    return { background: '#6B7280', color: '#fff' };
  }

  openEdit(user: UsuarioAdmin) {
    this.editUser = { ...user, newPassword: '' };
    this.cambiarPassword = false;
    this.editDialogVisible = true;
  }

  saveEdit() {
    if (!this.editUser.nombre || !this.editUser.email) {
      this.messageService.add({ severity: 'warn', summary: 'Campos requeridos', detail: 'Nombre y correo son obligatorios' });
      return;
    }
    this.editLoading = true;
    const dto: any = {
      nombre: this.editUser.nombre,
      email: this.editUser.email,
      rol: this.editUser.rol,
      activo: this.editUser.activo,
    };
    if (this.cambiarPassword && this.editUser.newPassword) {
      dto.password = this.editUser.newPassword;
    }
    this.usuariosService.update(this.editUser.id!, dto).subscribe({
      next: (updated) => {
        const idx = this.usuarios.findIndex(u => u.id === updated.id);
        if (idx !== -1) this.usuarios[idx] = updated;
        this.editLoading = false;
        this.editDialogVisible = false;
        this.messageService.add({ severity: 'success', summary: 'Guardado', detail: 'Usuario actualizado correctamente' });
      },
      error: (err) => {
        this.editLoading = false;
        this.messageService.add({ severity: 'error', summary: 'Error', detail: err?.error?.message ?? 'No se pudo actualizar' });
      },
    });
  }

  toggleActivo(user: UsuarioAdmin) {
    const accion = user.activo ? 'desactivar' : 'activar';
    this.confirmationService.confirm({
      message: `¿Deseas ${accion} la cuenta de <strong>${user.nombre}</strong>?`,
      header: 'Confirmar',
      icon: 'pi pi-exclamation-triangle',
      accept: () => {
        this.usuariosService.update(user.id, { activo: !user.activo }).subscribe({
          next: (updated) => {
            const idx = this.usuarios.findIndex(u => u.id === updated.id);
            if (idx !== -1) this.usuarios[idx] = updated;
            this.messageService.add({ severity: 'success', summary: 'Listo', detail: `Cuenta ${updated.activo ? 'activada' : 'desactivada'}` });
          },
          error: () => this.messageService.add({ severity: 'error', summary: 'Error', detail: 'No se pudo actualizar' }),
        });
      },
    });
  }

  openNew() {
    this.newUser = { nombre: '', email: '', password: '', rol: 'scout' };
    this.newDialogVisible = true;
  }

  saveNew() {
    if (!this.newUser.nombre || !this.newUser.email || !this.newUser.password) {
      this.messageService.add({ severity: 'warn', summary: 'Campos requeridos', detail: 'Nombre, correo y contraseña son obligatorios' });
      return;
    }
    this.newLoading = true;
    this.usuariosService.create(this.newUser as any).subscribe({
      next: (created) => {
        this.usuarios.push(created as any);
        this.newLoading = false;
        this.newDialogVisible = false;
        this.messageService.add({ severity: 'success', summary: 'Creado', detail: `Usuario ${created.nombre} creado` });
      },
      error: (err) => {
        this.newLoading = false;
        this.messageService.add({ severity: 'error', summary: 'Error', detail: err?.error?.message ?? 'No se pudo crear' });
      },
    });
  }
}
