"""
Genera templates/protocolo-traslado.docx a partir del formato oficial de CNAR
("Protocolo de transporte eventos 2026 CNAR.docx"), insertando marcadores de
docxtemplater ({campo}) en cada casilla sin alterar el diseño del formato.

Uso:  python3 scripts/crear-plantilla-protocolo.py <formato-oficial.docx>
Solo hace falta volver a correrlo si CNAR cambia el formato.
"""
import copy
import sys
from pathlib import Path

import docx
from docx.oxml.ns import qn

SALIDA = Path(__file__).resolve().parent.parent / 'templates' / 'protocolo-traslado.docx'


def celdas(fila):
    """Celdas únicas de una fila (python-docx repite las celdas combinadas)."""
    vistas, out = set(), {}
    for i, c in enumerate(fila.cells):
        if id(c._tc) in vistas:
            continue
        vistas.add(id(c._tc))
        out[i] = c
    return out


def agregar(celda, texto, separador=' '):
    """Agrega el marcador al final del último párrafo de la celda, con su mismo estilo."""
    p = celda.paragraphs[-1]
    if p.runs:
        r = p.add_run((separador if p.text.strip() else '') + texto)
        base = p.runs[-2]._r.find(qn('w:rPr'))
        if base is not None:
            r._r.insert(0, copy.deepcopy(base))
            # Sin resaltado amarillo heredado de los textos de ejemplo
            for h in r._r.iter(qn('w:highlight')):
                h.getparent().remove(h)
    else:
        p.add_run(texto)


def reemplazar_parrafo(p, viejo, nuevo):
    """Reemplaza texto aunque Word lo haya partido en varios runs."""
    if viejo not in p.text:
        return False
    texto = p.text.replace(viejo, nuevo)
    for r in p.runs[1:]:
        r._r.getparent().remove(r._r)
    p.runs[0].text = texto
    for h in p.runs[0]._r.iter(qn('w:highlight')):
        h.getparent().remove(h)
    return True


def main(origen):
    d = docx.Document(origen)
    lugar_txt = '(AQUÍ EL LUGAR DONDE SERÁ EL EVENTO)'

    for p in d.paragraphs:
        reemplazar_parrafo(p, '(AQUÍ EL NOMBRE DEL EVENTO)', '{evento}')
        reemplazar_parrafo(p, lugar_txt, '{lugar}')

    t0, t1, t2, t3, t4, t5 = d.tables[:6]

    # ── Datos generales, coordinador y enlace ────────────────────────────────
    f = [celdas(r) for r in t0.rows]
    agregar(f[0][2], '{provincia}')
    agregar(f[0][9], '{grupo}')
    agregar(f[1][3], '{coordinador.nombre}')
    agregar(f[1][10], '{coordinador.cargo}')
    agregar(f[2][3], '{coordinador.telLocal}')
    agregar(f[3][3], '{coordinador.celular}')
    agregar(f[5][3], '{enlace.nombre}')
    agregar(f[5][11], '{enlace.cargo}')
    agregar(f[6][3], '{enlace.celular1}')
    agregar(f[7][3], '{enlace.celular2}')
    for col, campo in zip([1, 3, 4, 5, 7, 8, 12],
                          ['manada', 'tropa', 'comunidad', 'clan', 'scouters', 'dirigentes', 'noScouts']):
        agregar(f[10][col], '{conteo.' + campo + '}')
    agregar(f[11][5], '{conteo.jovenes}')
    agregar(f[12][5], '{conteo.adultos}')

    # ── Salida y regreso ─────────────────────────────────────────────────────
    for c in celdas(t1.rows[2]).values():
        for p in c.paragraphs:
            reemplazar_parrafo(p, lugar_txt, '{lugar}')
    f = [celdas(r) for r in t1.rows]
    agregar(f[1][0], '{salidaFechaHora}', ': ')
    agregar(f[1][1], '{regresoFechaHora}', ': ')
    agregar(f[2][0], '{llegadaDestinoFechaHora}', ' ')
    agregar(f[2][1], '{llegadaOrigenFechaHora}', ' ')
    agregar(f[3][0], '{puntoSalida}', ': ')
    agregar(f[3][1], '{puntoLlegada}', ': ')

    # ── Medio de transporte ──────────────────────────────────────────────────
    f = [celdas(r) for r in t2.rows]
    for fila, campo in zip(range(4), ['xContratado', 'xParticular', 'xAutobus', 'xAereo']):
        agregar(f[fila][8], '{' + campo + '}')
    for fila, campo in zip(range(6, 11), ['empresa', 'telefonos', 'marcaModelo', 'placas', 'operador']):
        agregar(f[fila][3], '{contratado.' + campo + '}')
    for fila, doc in zip(range(11, 16), ['contrato', 'feMecanica', 'seguroViajero', 'licencia', 'tarjetaCirculacion']):
        agregar(f[fila][9], '{contratado.si.' + doc + '}')
        agregar(f[fila][10], '{contratado.no.' + doc + '}')
    agregar(f[18][3], '{particular.marca}', ': ')
    agregar(f[18][7], '{particular.modelo}', ': ')
    agregar(f[19][3], '{particular.anio}', ': ')
    agregar(f[19][5], '{particular.capacidad}', ': ')
    agregar(f[20][3], '{particular.placas}', ': ')
    agregar(f[20][6], '{particular.color}', ': ')
    agregar(f[21][0], '{particular.conductor}')
    agregar(f[22][0], '{particular.licencia}')
    agregar(f[22][4], '{particular.expedidaPor}')
    for fila, doc in zip(range(23, 26), ['poliza', 'licencia', 'tarjetaCirculacion']):
        agregar(f[fila][9], '{particular.si.' + doc + '}')
        agregar(f[fila][10], '{particular.no.' + doc + '}')

    # ── Autobús ──────────────────────────────────────────────────────────────
    for p in t3.rows[1].cells[0].paragraphs:
        reemplazar_parrafo(p, lugar_txt, '{lugar}')
    for p in t3.rows[5].cells[0].paragraphs:
        reemplazar_parrafo(p, lugar_txt, '{lugar}')
    f = [celdas(r) for r in t3.rows]
    agregar(f[3][1], '{autobus.lineaSalida}')
    agregar(f[3][2], '{autobus.lineaRegreso}')
    agregar(f[4][1], '{autobus.salidaFechaHora}')
    agregar(f[4][2], '{autobus.regresoFechaHora}')
    agregar(f[6][0], '{autobus.trasladoTerminal}')

    # ── Avión ────────────────────────────────────────────────────────────────
    for r in t4.rows:
        for c in celdas(r).values():
            for p in c.paragraphs:
                reemplazar_parrafo(p, lugar_txt, '{lugar}')
    f = [celdas(r) for r in t4.rows]
    for base, tramo in [(2, 'salida'), (12, 'regreso')]:
        agregar(f[base][1], '{aereo.' + tramo + '.aerolinea}')
        agregar(f[base + 1][1], '{aereo.' + tramo + '.aeropuerto}')
        agregar(f[base + 5][1], '{aereo.' + tramo + '.vuelo}')
        agregar(f[base + 6][1], '{aereo.' + tramo + '.fechaHora}')
    agregar(f[10][0], '{aereo.trasladoDestino}')
    agregar(f[20][0], '{aereo.trasladoOrigen}')

    # ── Lista de pasajeros: una fila plantilla que docxtemplater repite ──────
    filas = t5.rows
    plantilla = celdas(filas[2])
    campos = ['np', 'nombre', 'cum', 'ml', 'ts', 'cc', 'cr', 's', 'd', 'otro']
    for (i, c), campo in zip(sorted(plantilla.items()), campos):
        for p in c.paragraphs:
            for r in p.runs:
                r.text = ''
        txt = '{' + campo + '}'
        if campo == 'np':
            txt = '{#pasajeros}' + txt
        if campo == 'otro':
            txt = txt + '{/pasajeros}'
        agregar(c, txt)
    for r in list(filas)[3:]:
        r._tr.getparent().remove(r._tr)

    SALIDA.parent.mkdir(parents=True, exist_ok=True)
    d.save(SALIDA)
    print(f'Plantilla creada: {SALIDA}')


if __name__ == '__main__':
    main(sys.argv[1])
