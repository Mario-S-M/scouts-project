import { NgModule } from '@angular/core';
import { BrowserModule } from '@angular/platform-browser';
import { BrowserAnimationsModule } from '@angular/platform-browser/animations';
import { CommonModule } from '@angular/common';
import { HTTP_INTERCEPTORS } from '@angular/common/http';

import { MessageService } from 'primeng/api';

import { AppRoutingModule } from './app-routing.module';
import { AppComponent } from './app.component';
import { CoreModule } from './core/core.module';
import { AuthInterceptor } from './core/interceptors/auth.interceptor';

// PrimeNG needed at root level for p-toast and p-menubar
import { MenubarModule } from 'primeng/menubar';
import { ToastModule } from 'primeng/toast';
import { ButtonModule } from 'primeng/button';
import { TooltipModule } from 'primeng/tooltip';

@NgModule({
  declarations: [AppComponent],
  imports: [
    BrowserModule,
    BrowserAnimationsModule,
    CommonModule,
    AppRoutingModule,
    CoreModule.forRoot(),
    MenubarModule,
    ToastModule,
    ButtonModule,
    TooltipModule,
  ],
  providers: [
    MessageService,
    { provide: HTTP_INTERCEPTORS, useClass: AuthInterceptor, multi: true },
  ],
  bootstrap: [AppComponent],
})
export class AppModule {}
