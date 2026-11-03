// Smoke test del PDF anual de Ciclos de Programa (sin base de datos).
// Requiere haber compilado antes: `npm run build`.
const assert = require('assert');
const { CiclosProgramaService } = require('../dist/ciclos-programa/ciclos-programa.service');

const ciclo = (nombre, mesInicio, tipo = 'trimestral') => ({
  nombre, mesInicio, tipo, anio: 2026, seccion: 'comunidad',
  actividades: [1, 2, 3].map((n) => ({
    fechaSabado: `2026-${String(mesInicio).padStart(2, '0')}-0${n}`,
    nombre: `Actividad ${n}`,
    ejeTematico: 'Salud y Bienestar',
    descripcion: 'Notas',
  })),
});

const paginas = (buf) => (buf.toString('latin1').match(/\/Type \/Page\b/g) || []).length;

(async () => {
  // Sin base de datos: identidad de la Comunidad con su logo horizontal
  const { identidadPdf } = require('../dist/secciones/identidad-pdf');
  const secciones = { identidadPdf: async () => identidadPdf({ clave: 'comunidad', nombreCompleto: 'Comunidad de Caminantes', colorPrincipal: '#14265C', colorAcento: '#EFC02F' }, null) };
  const svc = new CiclosProgramaService({}, {}, secciones);

  // Período: el mes final debe ser el último mes del ciclo
  assert.strictEqual(svc.periodoLabel(ciclo('a', 1)), 'Enero – Marzo 2026');
  assert.strictEqual(svc.periodoLabel(ciclo('b', 4, 'cuatrimestral')), 'Abril – Julio 2026');
  assert.strictEqual(svc.periodoLabel(ciclo('c', 10)), 'Octubre – Diciembre 2026');
  assert.strictEqual(svc.periodoLabel(ciclo('d', 11, 'cuatrimestral')), 'Noviembre 2026 – Febrero 2027');

  // PDF individual y anual válidos; el anual con más ciclos tiene más páginas
  const uno = await svc.generatePdf(ciclo('Solo', 1), 'CI');
  const anual1 = await svc.generatePdfAnual([ciclo('C1', 1)], 2026, 'comunidad', 'CI');
  const anual3 = await svc.generatePdfAnual(
    [ciclo('C1', 1), ciclo('C2', 4), ciclo('C3', 7)], 2026, 'comunidad', 'CI',
  );
  for (const [n, b] of [['individual', uno], ['anual 1 ciclo', anual1], ['anual 3 ciclos', anual3]]) {
    assert.ok(b.slice(0, 5).toString() === '%PDF-', `${n}: no es un PDF`);
  }
  assert.ok(paginas(anual3) > paginas(anual1), `anual 3 ciclos (${paginas(anual3)} págs) debe tener más páginas que 1 ciclo (${paginas(anual1)})`);

  console.log(`OK — páginas: anual 1 ciclo=${paginas(anual1)}, anual 3 ciclos=${paginas(anual3)}`);
})().catch((e) => { console.error(e); process.exit(1); });
