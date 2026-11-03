import { Component } from '@angular/core';
import { Router } from '@angular/router';
import { MessageService } from 'primeng/api';
import { AuthService } from '../../../core/services/auth.service';

@Component({
  selector: 'app-login',
  templateUrl: './login.component.html',
  styleUrls: ['./login.component.scss'],
})
export class LoginComponent {
  email = '';
  password = '';
  loading = false;
  year = new Date().getFullYear();

  constructor(
    private authService: AuthService,
    private router: Router,
    private messageService: MessageService,
  ) {}

  login() {
    if (!this.email || !this.password) {
      this.messageService.add({ severity: 'warn', summary: 'Campos requeridos', detail: 'Ingresa tu correo y contraseña' });
      return;
    }
    this.loading = true;
    this.authService.login(this.email, this.password).subscribe({
      next: () => {
        this.loading = false;
        const user = this.authService.getUser();
        if (user?.rol === 'scout') {
          // "Mi progreso" es la progresión de Caminantes; las demás secciones entran al calendario
          this.router.navigate([(user.seccion ?? 'comunidad') === 'comunidad' ? '/mi-comunidad' : '/calendario']);
        } else {
          this.router.navigate(['/']);
        }
      },
      error: (err) => {
        this.loading = false;
        const msg = err?.error?.message ?? 'Correo o contraseña incorrectos';
        this.messageService.add({ severity: 'error', summary: 'Acceso denegado', detail: msg });
      },
    });
  }
}
