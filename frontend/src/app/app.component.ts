import { Component } from '@angular/core';
import { Router, NavigationEnd } from '@angular/router';
import { MenuItem } from 'primeng/api';
import { ThemeService } from './core/theme.service';
import { AuthService } from './core/services/auth.service';
import { filter } from 'rxjs/operators';

@Component({
  selector: 'app-root',
  templateUrl: './app.component.html',
  styleUrls: ['./app.component.scss'],
})
export class AppComponent {
  currentYear = new Date().getFullYear();
  isLoginPage = false;
  menuItems: MenuItem[] = [];
  themeClass = 'theme-comunidad';

  constructor(
    private themeService: ThemeService,
    public authService: AuthService,
    private router: Router,
  ) {
    this.router.events.pipe(filter(e => e instanceof NavigationEnd)).subscribe((e: any) => {
      this.isLoginPage = e.urlAfterRedirects.startsWith('/login');
      this.buildMenu();
    });
    this.authService.user$.subscribe((user) => {
      this.themeClass = user ? this.authService.getThemeClass(user.rol) : 'theme-comunidad';
      this.buildMenu();
    });
  }

  buildMenu() {
    const user = this.authService.getUser();

    // Scouts: menú propio
    if (user?.rol === 'scout') {
      this.menuItems = [
        { label: 'Mi Progreso', icon: 'pi pi-compass', routerLink: ['/mi-comunidad'] },
      ];
      return;
    }

    const seccion = user ? this.authService.getSeccion(user.rol) : 'comunidad';
    const seccionLabel = this.authService.getSeccionLabel(seccion);

    const items: MenuItem[] = [
      { label: 'Dashboard', icon: 'pi pi-home', routerLink: ['/'] },
      {
        label: seccionLabel, icon: 'pi pi-users',
        items: [
          { label: 'Lista de Miembros', icon: 'pi pi-list', routerLink: ['/caminantes'] },
          { label: 'Registrar Miembro', icon: 'pi pi-user-plus', routerLink: ['/caminantes/registro'] },
        ],
      },
      {
        label: 'Evidencias', icon: 'pi pi-file',
        items: [
          { label: 'Subir Evidencia', icon: 'pi pi-upload', routerLink: ['/evidencias/nueva'] },
          { label: 'Panel de Validación', icon: 'pi pi-shield', routerLink: ['/validacion'] },
        ],
      },
      { label: 'Insignias', icon: 'pi pi-star', routerLink: ['/insignias'] },
      { label: 'Avisos de Salida', icon: 'pi pi-file-export', routerLink: ['/avisos-salida'] },
      { label: 'Ciclo de Programa', icon: 'pi pi-calendar', routerLink: ['/ciclos-programa'] },
      { label: 'Informe Mensual',   icon: 'pi pi-file-pdf', routerLink: ['/informes'] },
    ];
    if (user?.rol === 'jefe_grupo') {
      items.push({ label: 'Usuarios', icon: 'pi pi-lock', routerLink: ['/usuarios'] });
    }
    this.menuItems = items;
  }

  toggleTheme() {
    this.themeService.toggle();
  }

  /**
   * Obtiene el icono actual del tema
   */
  getThemeIcon(): string {
    const theme = this.themeService.getCurrentTheme();
    return theme.includes('dark') ? 'pi pi-sun' : 'pi pi-moon';
  }

  logout() { this.authService.logout(); }
}
