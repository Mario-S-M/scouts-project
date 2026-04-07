import { Injectable } from '@angular/core';

@Injectable({
  providedIn: 'root',
})
export class ThemeService {
  private currentTheme = 'lara-light-green';
  private linkId = 'primeng-theme';

  constructor() {
    this.loadTheme(this.currentTheme);
  }

  loadTheme(themeName: string) {
    const head = document.head;
    let link = document.getElementById(this.linkId) as HTMLLinkElement | null;
    if (!link) {
      link = document.createElement('link');
      link.id = this.linkId;
      link.rel = 'stylesheet';
      head.appendChild(link);
    }
    link.href = `node_modules/primeng/resources/themes/${themeName}/theme.css`;
    this.currentTheme = themeName;
  }

  toggle() {
    const next = this.currentTheme.includes('dark') ? 'lara-light-green' : 'lara-dark-blue';
    this.loadTheme(next);
  }
}
