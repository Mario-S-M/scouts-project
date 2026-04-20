import { Injectable } from '@angular/core';

@Injectable({
  providedIn: 'root',
})
export class ThemeService {
  private currentTheme = 'aura-dark-blue'; // Tema oscuro por defecto
  private themeStyleId = 'prime-theme-css';

  // CSS de ambos temas (extraído de los archivos de PrimeNG)
  private darkThemeCSS = `
    :root {
      --surface-0: #18181b;
      --surface-900: #ffffff;
      --surface-ground: #09090b;
      --surface-section: #18181b;
      --surface-card: #18181b;
      --surface-50: #27272a;
      --surface-100: #3f3f46;
      --surface-200: #52525b;
      --surface-300: #71717a;
      --surface-400: #a1a1aa;
      --surface-border: #27272a;
      --text-color: #e4e4e7;
      --text-color-secondary: #a1a1aa;
      --color-surface-0: #18181b;
      color-scheme: dark;
    }
  `;

  private lightThemeCSS = `
    :root {
      --surface-0: #f5f5f5;
      --surface-900: #18181b;
      --surface-ground: #f9fafb;
      --surface-section: #f9fafb;
      --surface-card: #ffffff;
      --surface-50: #e4e4e7;
      --surface-100: #d4d4d8;
      --surface-200: #a1a1aa;
      --surface-300: #71717a;
      --surface-400: #52525b;
      --surface-border: #d1d5db;
      --text-color: #18181b;
      --text-color-secondary: #52525b;
      --color-surface-0: #f5f5f5;
      color-scheme: light;
    }
  `;

  constructor() {
    this.applyTheme(this.currentTheme);
  }

  /**
   * Aplica el tema especificado insertando CSS dinámicamente
   */
  applyTheme(themeName: string) {
    const head = document.head;
    const body = document.body;

    // Buscar o actualizar el elemento de estilo
    let style = document.getElementById(this.themeStyleId) as HTMLStyleElement | null;
    if (!style) {
      style = document.createElement('style');
      style.id = this.themeStyleId;
      head.appendChild(style);
    }

    // Actualizar el CSS según el tema
    const css = themeName === 'aura-dark-blue' ? this.darkThemeCSS : this.lightThemeCSS;
    style.textContent = css;

    // Eliminar todas las clases de tema anteriores (con y sin prefijo)
    ['aura-dark-blue', 'aura-light-blue',
     'p-theme-aura-dark-blue', 'p-theme-aura-light-blue',
     'p-theme-lara-dark-blue',  'p-theme-lara-light-blue'].forEach(c => body.classList.remove(c));

    // Añadir con prefijo p-theme- para que coincida con los selectores CSS
    body.classList.add('p-theme-' + themeName);

    this.currentTheme = themeName;
  }

  /**
   * Cambia entre tema claro y oscuro
   */
  toggle() {
    const isDark = this.currentTheme.includes('dark');
    const nextTheme = isDark ? 'aura-light-blue' : 'aura-dark-blue';
    this.applyTheme(nextTheme);
  }

  /**
   * Retorna el tema actual
   */
  getCurrentTheme(): string {
    return this.currentTheme;
  }
}
