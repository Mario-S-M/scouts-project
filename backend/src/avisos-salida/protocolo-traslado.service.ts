import { Injectable } from '@nestjs/common';
import * as fs from 'fs';
import * as path from 'path';
import { AvisoSalidaDto } from './dto/aviso-salida.dto';
import { fechaHora } from './aviso-formato';
import { PROTOCOLO_DEFAULTS, ProtocoloTraslado } from './protocolo-traslado.types';

const PizZip = require('pizzip');
const Docxtemplater = require('docxtemplater');

const SECCION_COLUMNA: Record<string, string> = { manada: 'ml', tropa: 'ts', comunidad: 'cc', clan: 'cr' };

/**
 * Llena el formato oficial de CNAR (templates/protocolo-traslado.docx, generado
 * por scripts/crear-plantilla-protocolo.py) con los datos del aviso.
 */
@Injectable()
export class ProtocoloTrasladoService {
  private plantilla: Buffer | null = null;

  private leerPlantilla(): Buffer {
    if (!this.plantilla) {
      this.plantilla = fs.readFileSync(path.join(__dirname, '../../templates/protocolo-traslado.docx'));
    }
    return this.plantilla;
  }

  defaults() {
    return PROTOCOLO_DEFAULTS;
  }

  /** Campos obligatorios que faltan para poder enviar el protocolo a CNAR */
  faltantes(dto: AvisoSalidaDto): string[] {
    const p: ProtocoloTraslado = dto.protocolo ?? {};
    const falta: string[] = [];
    const req = (valor: any, etiqueta: string) => {
      if (valor === undefined || valor === null || String(valor).trim() === '') falta.push(etiqueta);
    };
    req(dto.nombre, 'Nombre del evento');
    req(dto.lugarDescripcion, 'Lugar del evento');
    req(dto.salida?.fecha, 'Fecha de salida');
    req(dto.salida?.hora, 'Hora de salida');
    req(dto.salida?.lugar, 'Punto de salida');
    req(dto.llegada?.fecha, 'Fecha de regreso');
    req(dto.llegada?.hora, 'Hora de regreso');
    req(dto.llegada?.lugar, 'Punto de llegada');
    req(p.coordinador?.nombre, 'Coordinador de seguridad: nombre');
    req(p.coordinador?.telLocal || p.coordinador?.celular, 'Coordinador de seguridad: teléfono');
    req(p.enlace?.nombre, 'Enlace de seguridad: nombre');
    req(p.enlace?.celular1, 'Enlace de seguridad: celular');
    req(p.llegadaDestino?.fecha, 'Llegada estimada al evento: fecha');
    req(p.llegadaDestino?.hora, 'Llegada estimada al evento: hora');
    req(p.llegadaOrigen?.fecha, 'Llegada estimada a Morelia: fecha');
    req(p.llegadaOrigen?.hora, 'Llegada estimada a Morelia: hora');
    req(p.transporte, 'Medio de transporte');
    switch (p.transporte) {
      case 'autobus':
        req(p.autobus?.lineaSalida, 'Autobús: línea de ida');
        req(p.autobus?.salidaFecha, 'Autobús: fecha de salida');
        req(p.autobus?.salidaHora, 'Autobús: hora de salida');
        req(p.autobus?.lineaRegreso, 'Autobús: línea de regreso');
        req(p.autobus?.regresoFecha, 'Autobús: fecha de regreso');
        req(p.autobus?.regresoHora, 'Autobús: hora de regreso');
        req(p.autobus?.trasladoTerminal, 'Autobús: cómo van de la terminal al evento');
        break;
      case 'contratado':
        req(p.contratado?.empresa, 'Transporte contratado: empresa');
        req(p.contratado?.telefonos, 'Transporte contratado: teléfonos');
        req(p.contratado?.placas, 'Transporte contratado: placas');
        req(p.contratado?.operador, 'Transporte contratado: operador');
        break;
      case 'particular':
        req(p.particular?.marca, 'Vehículo particular: marca');
        req(p.particular?.placas, 'Vehículo particular: placas');
        req(p.particular?.conductor, 'Vehículo particular: conductor');
        req(p.particular?.licencia, 'Vehículo particular: número de licencia');
        break;
      case 'aereo':
        req(p.aereo?.salida?.aerolinea, 'Avión: aerolínea de ida');
        req(p.aereo?.salida?.vuelo, 'Avión: vuelo de ida');
        req(p.aereo?.salida?.fecha, 'Avión: fecha del vuelo de ida');
        req(p.aereo?.regreso?.aerolinea, 'Avión: aerolínea de regreso');
        req(p.aereo?.regreso?.vuelo, 'Avión: vuelo de regreso');
        req(p.aereo?.regreso?.fecha, 'Avión: fecha del vuelo de regreso');
        break;
    }
    return falta;
  }

  /** Genera el .docx oficial lleno */
  generarDocx(dto: AvisoSalidaDto): Buffer {
    const doc = new Docxtemplater(new PizZip(this.leerPlantilla()), {
      paragraphLoop: true,
      linebreaks: true,
      nullGetter: () => '',
    });
    doc.render(this.datos(dto));
    return doc.getZip().generate({ type: 'nodebuffer', compression: 'DEFLATE' });
  }

  /** Aplana los datos con claves 'a.b' porque el parser por defecto no resuelve puntos */
  private datos(dto: AvisoSalidaDto): Record<string, any> {
    const p: ProtocoloTraslado = dto.protocolo ?? {};
    const participantes = dto.participantes ?? [];
    const scouters = (dto.scouters ?? []).filter((s) => s.nombre?.trim());
    const invitados = (dto.invitados ?? []).filter((s) => s.nombre?.trim());
    const cuenta = (sec: string) => participantes.filter((x) => x.seccion === sec).length;
    const x = (b: boolean) => (b ? 'X' : '');
    const siNo = (prefijo: string, docs: Record<string, boolean | undefined> | undefined, claves: string[]) =>
      Object.fromEntries(claves.flatMap((k) => [
        [`${prefijo}.si.${k}`, x(docs?.[k] === true)],
        [`${prefijo}.no.${k}`, x(docs?.[k] === false)],
      ]));
    const prefijar = (prefijo: string, obj: Record<string, any> | undefined) =>
      Object.fromEntries(Object.entries(obj ?? {})
        .filter(([, v]) => typeof v !== 'object')
        .map(([k, v]) => [`${prefijo}.${k}`, v ?? '']));

    const pasajeros = [
      ...participantes.map((j) => ({
        nombre: `${j.nombre ?? ''} ${j.apellidos ?? ''}`.trim(),
        cum: j.cum ?? '',
        col: SECCION_COLUMNA[j.seccion] ?? 'otro',
      })),
      ...scouters.map((s) => ({ nombre: s.nombre, cum: s.cum ?? '', col: 's' })),
      ...invitados.map((s) => ({ nombre: s.nombre, cum: s.cum ?? '', col: 'otro' })),
    ].map((pas, i) => ({
      np: i + 1, nombre: pas.nombre, cum: pas.cum,
      ...Object.fromEntries(['ml', 'ts', 'cc', 'cr', 's', 'd', 'otro'].map((c) => [c, x(pas.col === c)])),
    }));

    const jovenes = participantes.length;
    const adultos = scouters.length + invitados.length;

    return {
      evento: dto.nombre ?? '',
      lugar: dto.lugarDescripcion ?? '',
      provincia: PROTOCOLO_DEFAULTS.provincia,
      grupo: PROTOCOLO_DEFAULTS.grupo,
      ...prefijar('coordinador', p.coordinador),
      ...prefijar('enlace', p.enlace),
      'conteo.manada': cuenta('manada') || '',
      'conteo.tropa': cuenta('tropa') || '',
      'conteo.comunidad': cuenta('comunidad') || '',
      'conteo.clan': cuenta('clan') || '',
      'conteo.scouters': scouters.length || '',
      'conteo.dirigentes': '',
      'conteo.noScouts': invitados.length || '',
      'conteo.jovenes': jovenes,
      'conteo.adultos': adultos,
      salidaFechaHora: fechaHora(dto.salida?.fecha, dto.salida?.hora),
      regresoFechaHora: fechaHora(dto.llegada?.fecha, dto.llegada?.hora),
      llegadaDestinoFechaHora: fechaHora(p.llegadaDestino?.fecha, p.llegadaDestino?.hora),
      llegadaOrigenFechaHora: fechaHora(p.llegadaOrigen?.fecha, p.llegadaOrigen?.hora),
      puntoSalida: dto.salida?.lugar ?? '',
      puntoLlegada: dto.llegada?.lugar ?? '',
      xContratado: x(p.transporte === 'contratado'),
      xParticular: x(p.transporte === 'particular'),
      xAutobus: x(p.transporte === 'autobus'),
      xAereo: x(p.transporte === 'aereo'),
      ...prefijar('contratado', p.contratado),
      ...siNo('contratado', p.contratado?.documentos, ['contrato', 'feMecanica', 'seguroViajero', 'licencia', 'tarjetaCirculacion']),
      ...prefijar('particular', p.particular),
      ...siNo('particular', p.particular?.documentos, ['poliza', 'licencia', 'tarjetaCirculacion']),
      'autobus.lineaSalida': p.autobus?.lineaSalida ?? '',
      'autobus.lineaRegreso': p.autobus?.lineaRegreso ?? '',
      'autobus.salidaFechaHora': fechaHora(p.autobus?.salidaFecha, p.autobus?.salidaHora),
      'autobus.regresoFechaHora': fechaHora(p.autobus?.regresoFecha, p.autobus?.regresoHora),
      'autobus.trasladoTerminal': p.autobus?.trasladoTerminal ?? '',
      ...Object.fromEntries((['salida', 'regreso'] as const).flatMap((t) => {
        const v = p.aereo?.[t];
        return [
          [`aereo.${t}.aerolinea`, v?.aerolinea ?? ''],
          [`aereo.${t}.aeropuerto`, v?.aeropuerto ?? ''],
          [`aereo.${t}.vuelo`, v?.vuelo ?? ''],
          [`aereo.${t}.fechaHora`, fechaHora(v?.fecha, v?.hora)],
        ];
      })),
      'aereo.trasladoDestino': p.aereo?.trasladoDestino ?? '',
      'aereo.trasladoOrigen': p.aereo?.trasladoOrigen ?? '',
      pasajeros,
    };
  }
}
