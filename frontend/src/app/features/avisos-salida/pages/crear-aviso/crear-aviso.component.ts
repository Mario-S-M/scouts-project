import { Component, OnInit } from '@angular/core';
import { FormBuilder, FormGroup, FormArray, Validators } from '@angular/forms';
import { Router, ActivatedRoute } from '@angular/router';
import { AuthService, ROL_INFO } from '../../../../core/services/auth.service';
import { CaminanteService } from '../../../../core/services/caminante.service';
import { AvisoService, StaffContacto } from '../../../../core/services/aviso.service';
import { Caminante } from '../../../../core/models/caminante.model';
import { MessageService } from 'primeng/api';

export const SECCION_COLORS: Record<string, { bg: string; text: string; label: string }> = {
  manada:    { bg: '#FBBF24', text: '#000000', label: 'Lobatos' },
  tropa:     { bg: '#16A34A', text: '#FFFFFF', label: 'Scouts' },
  comunidad: { bg: '#2563EB', text: '#FFFFFF', label: 'Caminantes' },
  clan:      { bg: '#DC2626', text: '#FFFFFF', label: 'Rovers' },
};

const GRUPO_ROLES = ['jefe_grupo', 'sub_jefe_grupo', 'colaborador_grupo', 'contador_grupo', 'secretario_grupo'];

@Component({
  selector: 'app-crear-aviso',
  templateUrl: './crear-aviso.component.html',
})
export class CrearAvisoComponent implements OnInit {
  form: FormGroup;
  caminantes: Caminante[] = [];
  staff: StaffContacto[] = [];
  staffOptions: { label: string; nombre: string; cargo: string }[] = [];
  loadingCaminantes = false;
  generandoPdf = false;
  guardando = false;
  esGrupo = false;
  editMode = false;
  editId: number | null = null;
  seccionUsuario: string | null = null;

  readonly seccionColors = SECCION_COLORS;

  readonly secciones = [
    { key: 'manada',    label: 'Lobatos' },
    { key: 'tropa',     label: 'Scouts' },
    { key: 'comunidad', label: 'Caminantes' },
    { key: 'clan',      label: 'Rovers' },
  ];

  readonly tiposActividad = [
    'Excursión', 'Campamento', 'Hike', 'Actividad de Sección',
    'Reunión Intergrupal', 'Evento Provincial', 'Jamboree', 'Otro',
  ].map(v => ({ label: v, value: v }));

  constructor(
    private fb: FormBuilder,
    public authService: AuthService,
    private caminanteService: CaminanteService,
    private avisoService: AvisoService,
    private messageService: MessageService,
    private router: Router,
    private route: ActivatedRoute,
  ) {}

  ngOnInit() {
    const user = this.authService.getUser();
    const rolInfo = user ? ROL_INFO[user.rol] : null;
    this.esGrupo = GRUPO_ROLES.includes(user?.rol ?? '');
    this.seccionUsuario = !this.esGrupo && rolInfo?.seccion !== 'scout' ? rolInfo?.seccion ?? null : null;

    this.form = this.fb.group({
      tipo: ['Excursión', Validators.required],
      nombre: ['', Validators.required],
      salida: this.fb.group({
        lugar: ['', Validators.required],
        fecha: [null, Validators.required],
        hora: [''],
      }),
      llegada: this.fb.group({
        lugar: [''],
        fecha: [null],
        hora: [''],
      }),
      transporte: [''],
      contactoLocal: this.fb.group({
        nombre: [''],
        cargo: [''],
        telefono: [''],
      }),
      contactoActividad: this.fb.group({
        nombre: [user?.nombre ?? ''],
        cargo: [user ? this.authService.getRolLabel(user.rol) : ''],
        telefono: [''],
      }),
      lugarDescripcion: [''],
      mapUrl: [''],
      participantes: [[] as Caminante[]],
      scoutersSeleccionados: [[] as StaffContacto[]],
      invitados: this.fb.array([]),
    });

    this.loadCaminantes();
    this.loadStaff();

    const idParam = this.route.snapshot.paramMap.get('id');
    if (idParam) {
      this.editMode = true;
      this.editId = +idParam;
      this.loadAviso(this.editId);
    }
  }

  private toDate(v: any): Date | null {
    if (!v) return null;
    if (v instanceof Date) return v;
    // ISO string "2025-06-15T..." or date-only "2025-06-15"
    const d = new Date(typeof v === 'string' && v.length === 10 ? v + 'T12:00:00' : v);
    return isNaN(d.getTime()) ? null : d;
  }

  private loadAviso(id: number) {
    this.avisoService.getOne(id).subscribe({
      next: (aviso) => {
        const d = aviso.data;
        this.form.patchValue({
          tipo: d.tipo,
          nombre: d.nombre,
          salida: {
            lugar: d.salida?.lugar ?? '',
            fecha: this.toDate(d.salida?.fecha),
            hora: d.salida?.hora ?? '',
          },
          llegada: {
            lugar: d.llegada?.lugar ?? '',
            fecha: this.toDate(d.llegada?.fecha),
            hora: d.llegada?.hora ?? '',
          },
          transporte: d.transporte,
          contactoLocal: d.contactoLocal,
          contactoActividad: d.contactoActividad,
          lugarDescripcion: d.lugarDescripcion,
          mapUrl: d.mapUrl ?? '',
        });

        // Participantes: se restauran cuando caminantes ya estén cargados
        if (d.participantes?.length) {
          const restoreParticipantes = () => {
            if (this.caminantes.length) {
              const ids = new Set((d.participantes as any[]).map((p: any) => p.id).filter(Boolean));
              const byNombre = (nombre: string, apellidos: string) =>
                this.caminantes.find(c => c.nombre === nombre && c.apellidos === apellidos);
              const seleccionados = (d.participantes as any[])
                .map((p: any) => ids.has(p.id)
                  ? this.caminantes.find(c => c.id === p.id)
                  : byNombre(p.nombre, p.apellidos))
                .filter(Boolean) as Caminante[];
              this.form.get('participantes').setValue(seleccionados);
            } else {
              setTimeout(restoreParticipantes, 200);
            }
          };
          restoreParticipantes();
        }

        // Scouters: se restauran cuando staff ya esté cargado
        if (d.scouters?.length) {
          const restoreScouters = () => {
            if (this.staff.length) {
              const seleccionados = (d.scouters as any[])
                .map((s: any) => this.staff.find(u => u.nombre === s.nombre))
                .filter(Boolean) as StaffContacto[];
              this.form.get('scoutersSeleccionados').setValue(seleccionados);
            } else {
              setTimeout(restoreScouters, 200);
            }
          };
          restoreScouters();
        }

        // Invitados
        if (d.invitados?.length) {
          const arr = this.invitadosArray;
          arr.clear();
          (d.invitados as any[]).forEach((inv: any) => arr.push(this.newRow(inv.nombre, inv.cum)));
        }
      },
      error: () => {
        this.messageService.add({ severity: 'error', summary: 'Error', detail: 'No se pudo cargar el aviso.' });
      },
    });
  }

  private newRow(nombre = '', cum = '') {
    return this.fb.group({ nombre: [nombre], cum: [cum] });
  }

  loadStaff() {
    this.avisoService.getStaff().subscribe({
      next: (data) => {
        this.staff = data;
        this.staffOptions = data.map(u => ({
          label: `${u.nombre} — ${this.authService.getRolLabel(u.rol)}`,
          nombre: u.nombre,
          cargo: this.authService.getRolLabel(u.rol),
        }));
      },
      error: () => {
        this.messageService.add({
          severity: 'warn', summary: 'Aviso',
          detail: 'No se pudo cargar la lista de personal. Ingresa los contactos manualmente.',
        });
      },
    });
  }

  onSelectContacto(target: 'local' | 'actividad', option: { nombre: string; cargo: string } | null) {
    if (!option) return;
    const group = target === 'local' ? 'contactoLocal' : 'contactoActividad';
    this.form.get(group).patchValue({ nombre: option.nombre, cargo: option.cargo });
  }

  loadCaminantes() {
    this.loadingCaminantes = true;
    this.caminanteService.getAll().subscribe({
      next: (data) => {
        this.caminantes = !this.esGrupo && this.seccionUsuario
          ? data.filter(c => c.seccion === this.seccionUsuario)
          : data;
        this.loadingCaminantes = false;
      },
      error: () => { this.loadingCaminantes = false; },
    });
  }

  // ── Scouters (selección desde staff registrado) ─────────────────────────────
  get scoutersSeleccionados(): StaffContacto[] {
    return this.form.get('scoutersSeleccionados').value ?? [];
  }

  isScouterSelected(s: StaffContacto): boolean {
    return this.scoutersSeleccionados.some(x => x.id === s.id);
  }

  toggleScouter(s: StaffContacto) {
    const current = [...this.scoutersSeleccionados];
    const idx = current.findIndex(x => x.id === s.id);
    if (idx >= 0) current.splice(idx, 1); else current.push(s);
    this.form.get('scoutersSeleccionados').setValue(current);
  }

  // ── Invitados (FormArray manual) ─────────────────────────────────────────────
  get invitadosArray(): FormArray { return this.form.get('invitados') as FormArray; }
  addInvitado() { this.invitadosArray.push(this.newRow()); }
  removeInvitado(i: number) { this.invitadosArray.removeAt(i); }

  // ── Participantes ───────────────────────────────────────────────────────────
  get participantesSeleccionados(): Caminante[] {
    return this.form.get('participantes').value ?? [];
  }

  isSelected(c: Caminante): boolean {
    return this.participantesSeleccionados.some(p => p.id === c.id);
  }

  toggleParticipante(c: Caminante) {
    const current = [...this.participantesSeleccionados];
    const idx = current.findIndex(p => p.id === c.id);
    if (idx >= 0) {
      current.splice(idx, 1);
    } else {
      current.push(c);
    }
    this.form.get('participantes').setValue(current);
  }

  selectAllSeccion(seccion: string) {
    const current = [...this.participantesSeleccionados];
    this.caminantes
      .filter(c => c.seccion === seccion && !current.some(p => p.id === c.id))
      .forEach(c => current.push(c));
    this.form.get('participantes').setValue(current);
  }

  deselectAllSeccion(seccion: string) {
    this.form.get('participantes').setValue(
      this.participantesSeleccionados.filter(c => c.seccion !== seccion),
    );
  }

  caminantesPorSeccion(seccion: string): Caminante[] {
    return this.caminantes.filter(c => c.seccion === seccion);
  }

  selectedPorSeccion(seccion: string): number {
    return this.participantesSeleccionados.filter(c => c.seccion === seccion).length;
  }

  // ── Cálculos ────────────────────────────────────────────────────────────────
  get counts() {
    const p = this.participantesSeleccionados;
    const lobatos    = p.filter(c => c.seccion === 'manada').length;
    const scouts     = p.filter(c => c.seccion === 'tropa').length;
    const caminantes = p.filter(c => c.seccion === 'comunidad').length;
    const rovers     = p.filter(c => c.seccion === 'clan').length;
    return { lobatos, scouts, caminantes, rovers, total: lobatos + scouts + caminantes + rovers };
  }

  get scouterCount(): number {
    return this.scoutersSeleccionados.length;
  }

  get totalAsistentes(): number {
    return this.participantesSeleccionados.length + this.scouterCount +
           this.invitadosArray.controls.filter(i => i.get('nombre').value?.trim()).length;
  }

  // ── Helpers ─────────────────────────────────────────────────────────────────
  seccionBadgeStyle(seccion: string): Record<string, string> {
    const c = SECCION_COLORS[seccion];
    if (!c) return {};
    return { background: c.bg, color: c.text, 'border-radius': '4px', padding: '1px 8px', 'font-weight': '700', 'font-size': '0.78rem' };
  }

  formatDate(d: Date | null): string {
    if (!d) return '—';
    return new Date(d).toLocaleDateString('es-MX', { day: '2-digit', month: '2-digit', year: 'numeric' });
  }

  formatTime(v: any): string {
    if (!v) return '—';
    if (typeof v === 'string' && /^\d{2}:\d{2}/.test(v)) {
      const [h, m] = v.split(':').map(Number);
      const ampm = h >= 12 ? 'PM' : 'AM';
      return `${h % 12 || 12}:${String(m).padStart(2, '0')} ${ampm}`;
    }
    const d = new Date(v);
    return isNaN(d.getTime()) ? '—'
      : d.toLocaleTimeString('es-MX', { hour: '2-digit', minute: '2-digit', hour12: true });
  }

  guardar() {
    const v = this.form.value;
    const toISO = (v: any) => { if (!v) return null; if (v instanceof Date) return v.toISOString(); return v; };
    const dto = {
      tipo: v.tipo, nombre: v.nombre,
      salida:   { lugar: v.salida.lugar,   fecha: toISO(v.salida.fecha),   hora: toISO(v.salida.hora) },
      llegada:  { lugar: v.llegada.lugar,  fecha: toISO(v.llegada.fecha),  hora: toISO(v.llegada.hora) },
      transporte: v.transporte,
      contactoLocal: v.contactoLocal, contactoActividad: v.contactoActividad,
      lugarDescripcion: v.lugarDescripcion, mapUrl: v.mapUrl || null,
      participantes: this.participantesSeleccionados.map(c => ({
        nombre: c.nombre, apellidos: c.apellidos, cum: c.cum,
        fechaNacimiento: c.fechaNacimiento, seccion: c.seccion,
      })),
      scouters: this.scoutersSeleccionados.map(s => ({ nombre: s.nombre, cum: (s as any).cum ?? '' })),
      invitados: v.invitados.filter((i: any) => i.nombre?.trim()),
    };

    this.guardando = true;
    const request$ = this.editMode && this.editId
      ? this.avisoService.update(this.editId, dto)
      : this.avisoService.save(dto);

    request$.subscribe({
      next: () => {
        this.messageService.add({ severity: 'success', summary: 'Guardado', detail: this.editMode ? 'Aviso actualizado correctamente.' : 'Aviso guardado correctamente.' });
        this.guardando = false;
        this.router.navigate(['/avisos-salida']);
      },
      error: () => {
        this.messageService.add({ severity: 'error', summary: 'Error', detail: 'No se pudo guardar el aviso.' });
        this.guardando = false;
      },
    });
  }

  imprimir() { window.print(); }

  descargarPdf() {
    const v = this.form.value;
    const toISO = (v: any) => { if (!v) return null; if (v instanceof Date) return v.toISOString(); return v; };
    const dto = {
      tipo:        v.tipo,
      nombre:      v.nombre,
      salida:      { lugar: v.salida.lugar, fecha: toISO(v.salida.fecha), hora: toISO(v.salida.hora) },
      llegada:     { lugar: v.llegada.lugar, fecha: toISO(v.llegada.fecha), hora: toISO(v.llegada.hora) },
      transporte:  v.transporte,
      contactoLocal:      v.contactoLocal,
      contactoActividad:  v.contactoActividad,
      lugarDescripcion:   v.lugarDescripcion,
      mapUrl:             v.mapUrl || null,
      participantes: this.participantesSeleccionados.map(c => ({
        nombre: c.nombre, apellidos: c.apellidos, cum: c.cum,
        fechaNacimiento: c.fechaNacimiento, seccion: c.seccion,
      })),
      scouters: this.scoutersSeleccionados.map(s => ({
        nombre: s.nombre, cum: (s as any).cum ?? '',
      })),
      invitados: v.invitados.filter((i: any) => i.nombre?.trim()),
    };

    this.generandoPdf = true;
    this.avisoService.generatePdf(dto).subscribe({
      next: (blob) => {
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `aviso-salida-${(v.nombre || 'actividad').replace(/\s+/g, '-')}.pdf`;
        a.click();
        URL.revokeObjectURL(url);
        this.generandoPdf = false;
      },
      error: () => {
        this.messageService.add({ severity: 'error', summary: 'Error', detail: 'No se pudo generar el PDF.' });
        this.generandoPdf = false;
      },
    });
  }
}
