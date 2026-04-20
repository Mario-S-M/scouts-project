import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';
import { FormsModule, ReactiveFormsModule } from '@angular/forms';

// PrimeNG Modules
import { MenubarModule } from 'primeng/menubar';
import { CardModule } from 'primeng/card';
import { ButtonModule } from 'primeng/button';
import { InputTextModule } from 'primeng/inputtext';
import { InputTextareaModule } from 'primeng/inputtextarea';
import { DropdownModule } from 'primeng/dropdown';
import { CalendarModule } from 'primeng/calendar';
import { TableModule } from 'primeng/table';
import { TabViewModule } from 'primeng/tabview';
import { ProgressBarModule } from 'primeng/progressbar';
import { ProgressSpinnerModule } from 'primeng/progressspinner';
import { TagModule } from 'primeng/tag';
import { BadgeModule } from 'primeng/badge';
import { ChipModule } from 'primeng/chip';
import { DialogModule } from 'primeng/dialog';
import { ToastModule } from 'primeng/toast';
import { FileUploadModule } from 'primeng/fileupload';
import { SelectButtonModule } from 'primeng/selectbutton';
import { TooltipModule } from 'primeng/tooltip';
import { DividerModule } from 'primeng/divider';
import { MessageModule } from 'primeng/message';
import { MessagesModule } from 'primeng/messages';
import { AvatarModule } from 'primeng/avatar';
import { TimelineModule } from 'primeng/timeline';
import { AccordionModule } from 'primeng/accordion';
import { CheckboxModule } from 'primeng/checkbox';
import { MultiSelectModule } from 'primeng/multiselect';

// Shared Components
import { PageHeaderComponent } from './components/page-header/page-header.component';
import { StatCardComponent } from './components/stat-card/stat-card.component';
import { BadgeChipComponent } from './components/badge-chip/badge-chip.component';

// Shared Pipes
import { EstadoBadgePipe } from './pipes/estado-badge.pipe';
import { SeccionFilterPipe } from './pipes/seccion-filter.pipe';

const PRIMENG_MODULES = [
  MenubarModule,
  CardModule,
  ButtonModule,
  InputTextModule,
  InputTextareaModule,
  DropdownModule,
  CalendarModule,
  TableModule,
  TabViewModule,
  ProgressBarModule,
  ProgressSpinnerModule,
  TagModule,
  BadgeModule,
  ChipModule,
  DialogModule,
  ToastModule,
  FileUploadModule,
  SelectButtonModule,
  TooltipModule,
  DividerModule,
  MessageModule,
  MessagesModule,
  AvatarModule,
  TimelineModule,
  AccordionModule,
  CheckboxModule,
  MultiSelectModule,
];

const SHARED_COMPONENTS = [
  PageHeaderComponent,
  StatCardComponent,
  BadgeChipComponent,
];

const SHARED_PIPES = [EstadoBadgePipe, SeccionFilterPipe];

@NgModule({
  declarations: [...SHARED_COMPONENTS, ...SHARED_PIPES],
  imports: [
    CommonModule,
    RouterModule,
    FormsModule,
    ReactiveFormsModule,
    ...PRIMENG_MODULES,
  ],
  exports: [
    CommonModule,
    RouterModule,
    FormsModule,
    ReactiveFormsModule,
    ...PRIMENG_MODULES,
    ...SHARED_COMPONENTS,
    ...SHARED_PIPES,
  ],
})
export class SharedModule {}
