import { NgModule, Optional, SkipSelf } from '@angular/core';
import { CommonModule } from '@angular/common';
import { HttpClientModule } from '@angular/common/http';
import { CaminanteService } from './services/caminante.service';
import { EvidenciaService } from './services/evidencia.service';
import { InsigniaService } from './services/insignia.service';
import { DashboardService } from './services/dashboard.service';
import { AuthService } from './services/auth.service';
import { AuthGuard } from './guards/auth.guard';

@NgModule({
  imports: [CommonModule, HttpClientModule],
  providers: [
    CaminanteService,
    EvidenciaService,
    InsigniaService,
    DashboardService,
    AuthService,
    AuthGuard,
  ],
})
export class CoreModule {
  static forRoot() {
    return {
      ngModule: CoreModule,
      providers: [
        CaminanteService,
        EvidenciaService,
        InsigniaService,
        DashboardService,
        AuthService,
        AuthGuard,
      ],
    };
  }

  constructor(@Optional() @SkipSelf() parentModule: CoreModule) {
    if (parentModule) {
      throw new Error('CoreModule is already loaded. Import it in the AppModule only.');
    }
  }
}
