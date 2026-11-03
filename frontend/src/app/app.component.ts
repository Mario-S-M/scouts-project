import { Component } from '@angular/core';
import { Router, NavigationEnd } from '@angular/router';
import { MenuItem } from 'primeng/api';
import { TieredMenu } from 'primeng/tieredmenu';
import { ThemeService } from './core/theme.service';
import { AuthService } from './core/services/auth.service';
import { SeccionService } from './core/services/seccion.service';
import { ROLES_JEFE_SECCION } from './core/models/solicitud-insignias.model';
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

  submenuItems: MenuItem[] = [];
  submenuAbierto: string | null = null;

  /** Debajo del nombre del grupo: la sección del usuario */
  get subtituloNav(): string {
    return this.authService.getUser() ? this.seccionService.termino('seccion') : 'Scouts México';
  }

  /** Nombre corto para la pestaña: "Comunidad de Caminantes" → "Comunidad" */
  etiquetaCorta(it: MenuItem): string {
    if (it.label === 'Dashboard') return 'Inicio';
    // La pestaña de la sección usa su nombre corto configurado ("Grupo", "Manada"…)
    if (it.label === this.seccionService.termino('seccion')) return this.seccionService.termino('corto');
    return (it.label ?? '').split(' de ')[0];
  }

  abrirSubmenu(ev: MouseEvent, it: MenuItem, menu: TieredMenu) {
    if (this.submenuAbierto === it.label) {
      menu.hide();
      return;
    }
    const pestana = ev.currentTarget as HTMLElement;
    menu.hide();
    this.submenuItems = it.items ?? [];
    this.submenuAbierto = it.label ?? null;
    // Tras cerrar el anterior, abrir anclado a la pestaña clicada
    setTimeout(() => menu.show({ currentTarget: pestana, target: pestana } as any));
  }

  /** Logo del navbar: el de la sección (lo configura el administrador) o el del Grupo */
  get logoNav(): string {
    return this.seccionService.logo();
  }

  constructor(
    private themeService: ThemeService,
    public authService: AuthService,
    private seccionService: SeccionService,
    private router: Router,
  ) {
    this.router.events.pipe(filter(e => e instanceof NavigationEnd)).subscribe((e: any) => {
      this.isLoginPage = e.urlAfterRedirects.startsWith('/login');
      this.buildMenu();
    });
    this.authService.user$.subscribe((user) => {
      this.themeClass = user ? this.authService.getThemeClass(user.rol) : 'theme-comunidad';
      // Los menús emergentes se montan en <body>: también ahí van los colores de la sección
      document.body.classList.forEach(c => c.startsWith('theme-') && document.body.classList.remove(c));
      document.body.classList.add(this.themeClass);
      this.seccionService.aplicarTema();
      this.buildMenu();
      // Nombres, colores y logo vigentes de las secciones
      if (user) this.seccionService.cargar().subscribe({ next: () => this.buildMenu(), error: () => undefined });
    });
  }

  buildMenu() {
    const user = this.authService.getUser();

    // Scouts: menú propio
    // Progresión (senderos, especialidades, insignias): por ahora solo Comunidad
    const conProgresion = this.seccionService.progresion() || ['administrador', 'jefe_grupo', 'sub_jefe_grupo'].includes(user?.rol ?? '');

    if (user?.rol === 'scout') {
      this.menuItems = this.marcarActivo([
        ...(conProgresion ? [{ label: 'Mi Progreso', icon: 'pi pi-compass', routerLink: ['/mi-comunidad'] }] : []),
        { label: 'Calendario', icon: 'pi pi-calendar-plus', routerLink: ['/calendario'] },
      ]);
      return;
    }

    const seccionLabel = this.seccionService.termino('seccion');

    // Solicitudes y catálogo solo para los nueve roles con mando de sección;
    // la galería la ve cualquiera que llegue a este menú
    const insigniasItems: MenuItem[] = [
      { label: 'Galería de Insignias', icon: 'pi pi-star', routerLink: ['/insignias'] },
    ];
    if (user && ROLES_JEFE_SECCION.includes(user.rol)) {
      insigniasItems.push(
        { label: 'Solicitudes', icon: 'pi pi-send', routerLink: ['/insignias/solicitudes'] },
        { label: 'Catálogo',    icon: 'pi pi-book', routerLink: ['/insignias/catalogo'] },
      );
    }

    const items: MenuItem[] = [
      { label: 'Dashboard', icon: 'pi pi-home', routerLink: ['/'], routerLinkActiveOptions: { exact: true } },
      {
        label: seccionLabel, icon: 'pi pi-users',
        items: [
          { label: this.seccionService.termino('Plural'), icon: 'pi pi-list', routerLink: ['/caminantes'] },
          { label: `Registrar ${this.seccionService.termino('singular')}`, icon: 'pi pi-user-plus', routerLink: ['/caminantes/registro'] },
          ...(conProgresion ? [
            { separator: true },
            { label: 'Subir Evidencia', icon: 'pi pi-upload', routerLink: ['/evidencias/nueva'] },
            { label: 'Panel de Validación', icon: 'pi pi-shield', routerLink: ['/validacion'] },
            { separator: true },
            { label: 'Insignias', icon: 'pi pi-star', items: insigniasItems },
          ] : []),
        ],
      },
      {
        label: 'Documentos', icon: 'pi pi-folder',
        items: [
          { label: 'Avisos de Salida', icon: 'pi pi-file-export', routerLink: ['/avisos-salida'] },
          { label: 'Ciclo de Programa', icon: 'pi pi-calendar', routerLink: ['/ciclos-programa'] },
          { label: 'Informe Mensual', icon: 'pi pi-file-pdf', routerLink: ['/informes'] },
        ],
      },
      {
        label: 'Calendario', icon: 'pi pi-calendar-plus',
        items: [
          { label: 'Ver Calendario',   icon: 'pi pi-calendar-plus', routerLink: ['/calendario'] },
          { label: 'Recordatorios',    icon: 'pi pi-bell',          routerLink: ['/calendario/recordatorios'] },
        ],
      },
    ];
    if (user?.rol === 'administrador') {
      items.push({
        label: 'Administración', icon: 'pi pi-cog',
        items: [
          { label: 'Usuarios', icon: 'pi pi-users', routerLink: ['/usuarios'] },
          { label: 'Secciones', icon: 'pi pi-palette', routerLink: ['/secciones'] },
        ],
      });
    } else if (user?.rol === 'jefe_grupo') {
      items.push({ label: 'Usuarios', icon: 'pi pi-lock', routerLink: ['/usuarios'] });
    }
    this.menuItems = this.marcarActivo(items);
  }

  /**
   * Resalta en el navbar la opción de primer nivel que contiene la página
   * actual (p. ej. "Documentos" estando en /informes); PrimeNG solo marca el
   * enlace exacto y no a su menú padre.
   */
  private marcarActivo(items: MenuItem[]): MenuItem[] {
    const url = this.router.url.split('?')[0];
    const coincide = (link: any) => {
      const ruta = '/' + [].concat(link ?? []).join('/').replace(/^\/+/, '');
      return ruta === '/' ? url === '/' : url === ruta || url.startsWith(ruta + '/');
    };
    const contiene = (it: MenuItem): boolean =>
      coincide(it.routerLink) && !!it.routerLink || (it.items ?? []).some(contiene);
    return items.map(it => ({ ...it, styleClass: contiene(it) ? 'nav-activo' : undefined }));
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
