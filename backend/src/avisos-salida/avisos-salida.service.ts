import { Injectable, NotFoundException } from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { Repository } from "typeorm";
import * as fs from "fs";
import * as path from "path";
import { AvisoSalidaDto, ParticipanteDto } from "./dto/aviso-salida.dto";
import { AvisoSalida } from "./aviso-salida.entity";
import { documentoAviso, documentoPermisos } from "./aviso-pdf.builder";

const PdfPrinter = require("pdfmake/js/Printer").default;
const vfsFonts = require("pdfmake/build/vfs_fonts");

@Injectable()
export class AvisosSalidaService {
  private printer: any;
  private logoGrupo: string | null = null;
  private logoCC: string | null = null;

  constructor(
    @InjectRepository(AvisoSalida)
    private readonly repo: Repository<AvisoSalida>,
  ) {
    const assetsDir = path.join(__dirname, "../../public/assets");
    const grupoPath = path.join(assetsDir, "logo_Grupo.png");
    const ccPath = path.join(assetsDir, "logo_CC.png");
    if (fs.existsSync(grupoPath))
      this.logoGrupo = `data:image/png;base64,${fs.readFileSync(grupoPath).toString("base64")}`;
    if (fs.existsSync(ccPath))
      this.logoCC = `data:image/png;base64,${fs.readFileSync(ccPath).toString("base64")}`;

    // pdfmake v0.3: resolveUrls() calls getExtendedUrl(descriptor) which does
    // descriptor.url — a Buffer is an object, so it'd read Buffer.url = undefined.
    // Fix: use string keys + virtualfs so resolveUrls treats them as plain paths.
    const fontBuffers: Record<string, Buffer> = {
      "Roboto-Regular.ttf": Buffer.from(
        vfsFonts["Roboto-Regular.ttf"],
        "base64",
      ),
      "Roboto-Medium.ttf": Buffer.from(vfsFonts["Roboto-Medium.ttf"], "base64"),
      "Roboto-Italic.ttf": Buffer.from(vfsFonts["Roboto-Italic.ttf"], "base64"),
      "Roboto-MediumItalic.ttf": Buffer.from(
        vfsFonts["Roboto-MediumItalic.ttf"],
        "base64",
      ),
    };
    const fonts = {
      Roboto: {
        normal: "Roboto-Regular.ttf",
        bold: "Roboto-Medium.ttf",
        italics: "Roboto-Italic.ttf",
        bolditalics: "Roboto-MediumItalic.ttf",
      },
    };
    const virtualfs = {
      existsSync: (key: string) => key in fontBuffers,
      readFileSync: (key: string) => fontBuffers[key],
    };
    const urlResolver = {
      resolve: (_url: any, _headers: any) => {},
      resolved: () => Promise.resolve(),
    };
    this.printer = new PdfPrinter(fonts, virtualfs, urlResolver);
  }

  // ── Parsear coordenadas de un link de Google Maps ────────────────────────────
  private parseCoords(
    url: string,
  ): { lat: number; lon: number; zoom: number } | null {
    // Formato: @lat,lon,zoomz  (el más común en links compartidos)
    const at = url.match(/@(-?\d+\.?\d+),(-?\d+\.?\d+),(\d+)/);
    if (at) return { lat: +at[1], lon: +at[2], zoom: Math.min(+at[3], 17) };
    // Formato: ?q=lat,lon  o  &query=lat,lon
    const q = url.match(/[?&](?:q|query)=(-?\d+\.?\d+),(-?\d+\.?\d+)/);
    if (q) return { lat: +q[1], lon: +q[2], zoom: 15 };
    return null;
  }

  // ── Resolver links cortos (maps.app.goo.gl → URL completa) ───────────────────
  private async resolveShortUrl(url: string): Promise<string> {
    try {
      const res = await fetch(url, {
        method: "GET",
        redirect: "follow",
        signal: AbortSignal.timeout(5000),
      });
      return res.url || url;
    } catch {
      return url;
    }
  }

  // ── Componer mapa estático desde tiles de OSM ────────────────────────────────
  private async fetchMapImage(googleUrl: string): Promise<string | null> {
    try {
      // 1. Resolver link corto si aplica
      const resolvedUrl = /goo\.gl\/|maps\.app\.goo\.gl/.test(googleUrl)
        ? await this.resolveShortUrl(googleUrl)
        : googleUrl;

      const coords = this.parseCoords(resolvedUrl);
      if (!coords) return null;

      const sharp = require("sharp");
      const { lat, lon } = coords;
      // Fetchar tiles en zoom 15 (área de zoom 13, 4× resolución para PDF nítido)
      const displayZoom = Math.min(coords.zoom, 13);
      const fetchZoom = displayZoom + 2;
      // Imagen final grande: pdfmake la escala hacia abajo → muy nítida en impresión
      const W = 1500,
        H = 780,
        TILE = 256;
      const W2 = W,
        H2 = H; // sin segundo escale, directo al tamaño final

      // 2. Posición flotante del punto en cuadrícula de tiles (al zoom de fetch)
      const n = Math.pow(2, fetchZoom);
      const tileX = ((lon + 180) / 360) * n;
      const latRad = (lat * Math.PI) / 180;
      const tileY =
        ((1 - Math.log(Math.tan(latRad) + 1 / Math.cos(latRad)) / Math.PI) /
          2) *
        n;

      // 3. Rango de tiles
      const pad = 3;
      const minTX = Math.floor(tileX) - pad;
      const maxTX = Math.floor(tileX) + pad;
      const minTY = Math.floor(tileY) - pad;
      const maxTY = Math.floor(tileY) + pad;

      // 4. Descargar tiles en paralelo
      const fetchTile = async (tx: number, ty: number) => {
        const url = `https://tile.openstreetmap.org/${fetchZoom}/${tx}/${ty}.png`;
        const res = await fetch(url, {
          headers: { "User-Agent": "ScoutsApp/1.0 (educational use)" },
          signal: AbortSignal.timeout(6000),
        });
        if (!res.ok) return null;
        return { tx, ty, buf: Buffer.from(await res.arrayBuffer()) };
      };

      const jobs: Promise<any>[] = [];
      for (let ty = minTY; ty <= maxTY; ty++) {
        for (let tx = minTX; tx <= maxTX; tx++) {
          jobs.push(fetchTile(tx, ty));
        }
      }
      const tiles = (await Promise.all(jobs)).filter(Boolean);

      // 5. Componer grid completo
      const gridW = (maxTX - minTX + 1) * TILE;
      const gridH = (maxTY - minTY + 1) * TILE;
      const composites = tiles.map(({ tx, ty, buf }) => ({
        input: buf,
        left: (tx - minTX) * TILE,
        top: (ty - minTY) * TILE,
      }));
      const grid = await sharp({
        create: {
          width: gridW,
          height: gridH,
          channels: 3,
          background: "#e8e0d8",
        },
      })
        .png()
        .composite(composites)
        .toBuffer();

      // 6. Recortar W2×H2 centrado en el punto (canvas 2×)
      const centerPxX = Math.round((tileX - minTX) * TILE);
      const centerPxY = Math.round((tileY - minTY) * TILE);
      const left = Math.min(
        Math.max(0, centerPxX - Math.floor(W2 / 2)),
        gridW - W2,
      );
      const top = Math.min(
        Math.max(0, centerPxY - Math.floor(H2 / 2)),
        gridH - H2,
      );
      const cropped2x = await sharp(grid)
        .extract({ left, top, width: W2, height: H2 })
        .toBuffer();

      // 7. Marcador rojo proporcional al canvas grande
      const mx = Math.floor(W / 2),
        my = Math.floor(H / 2);
      const markerSvg = Buffer.from(
        `<svg width="${W}" height="${H}" xmlns="http://www.w3.org/2000/svg">` +
          `<circle cx="${mx}" cy="${my}" r="22" fill="#DC2626" stroke="white" stroke-width="6"/>` +
          `<circle cx="${mx}" cy="${my}" r="8" fill="white"/>` +
          `</svg>`,
      );

      // 8. Componer marcador — sin resize, entregamos imagen grande directamente
      const result = await sharp(cropped2x)
        .composite([{ input: markerSvg, left: 0, top: 0 }])
        .png({ compressionLevel: 6 })
        .toBuffer();

      return `data:image/png;base64,${result.toString("base64")}`;
    } catch (e) {
      console.error("[MAP] fetchMapImage error:", e);
      return null;
    }
  }

  async generatePdf(dto: AvisoSalidaDto): Promise<Buffer> {
    const mapImage = dto.mapUrl ? await this.fetchMapImage(dto.mapUrl) : null;
    const docDef = documentoAviso(dto, { logoGrupo: this.logoGrupo, logoCC: this.logoCC, mapImage });
    // In pdfmake v0.3, createPdfKitDocument returns a Promise<PDFDocument>
    const doc = await this.printer.createPdfKitDocument(docDef);
    return new Promise((resolve, reject) => {
      const chunks: Buffer[] = [];
      doc.on("data", (c: Buffer) => chunks.push(c));
      doc.on("end", () => resolve(Buffer.concat(chunks)));
      doc.on("error", reject);
      doc.end();
    });
  }

  // ── Permisos de Salida ────────────────────────────────────────────────────────

  async generatePermisos(id: number): Promise<Buffer> {
    const aviso = await this.findOne(id);
    const docDef = this.buildPermisosDocument(aviso.data as AvisoSalidaDto);
    const doc = await this.printer.createPdfKitDocument(docDef);
    return new Promise((resolve, reject) => {
      const chunks: Buffer[] = [];
      doc.on("data", (c: Buffer) => chunks.push(c));
      doc.on("end", () => resolve(Buffer.concat(chunks)));
      doc.on("error", reject);
      doc.end();
    });
  }

  private async generateSinglePermisoPdf(
    dto: AvisoSalidaDto,
    p: ParticipanteDto | null,
  ): Promise<Buffer> {
    const docDef = documentoPermisos(dto, [p], { logoGrupo: this.logoGrupo, logoCC: this.logoCC });
    const doc = await this.printer.createPdfKitDocument(docDef);
    return new Promise((resolve, reject) => {
      const chunks: Buffer[] = [];
      doc.on("data", (c: Buffer) => chunks.push(c));
      doc.on("end", () => resolve(Buffer.concat(chunks)));
      doc.on("error", reject);
      doc.end();
    });
  }

  private createZip(
    entries: { name: string; buffer: Buffer }[],
  ): Promise<Buffer> {
    const archiver = require("archiver");
    return new Promise((resolve, reject) => {
      const archive = archiver("zip", { zlib: { level: 6 } });
      const chunks: Buffer[] = [];
      archive.on("data", (chunk: Buffer) => chunks.push(chunk));
      archive.on("end", () => resolve(Buffer.concat(chunks)));
      archive.on("error", reject);
      for (const { name, buffer } of entries) {
        archive.append(buffer, { name });
      }
      archive.finalize();
    });
  }

  async generatePermisosZip(id: number): Promise<{ zip: Buffer; nombre: string }> {
    const aviso = await this.findOne(id);
    const dto = aviso.data as AvisoSalidaDto;
    const participantes = (dto.participantes ?? []).filter((p) =>
      p.nombre?.trim(),
    );

    if (!participantes.length) {
      const pdfBuffer = await this.generateSinglePermisoPdf(dto, null);
      const zip = await this.createZip([
        { name: "permiso-en-blanco.pdf", buffer: pdfBuffer },
      ]);
      return { zip, nombre: aviso.nombre };
    }

    const entries = await Promise.all(
      participantes.map(async (p, i) => {
        const slug = `${p.nombre || ""} ${p.apellidos || ""}`
          .trim()
          .normalize("NFD")
          .replace(/[̀-ͯ]/g, "")
          .replace(/[^a-zA-Z0-9 ]/g, "")
          .replace(/\s+/g, "_");
        const name = `${String(i + 1).padStart(2, "0")}_${slug || "participante"}.pdf`;
        const buffer = await this.generateSinglePermisoPdf(dto, p);
        return { name, buffer };
      }),
    );

    const zip = await this.createZip(entries);
    return { zip, nombre: aviso.nombre };
  }

  async generatePermisoEnBlanco(id: number): Promise<Buffer> {
    const aviso = await this.findOne(id);
    const dto = { ...(aviso.data as AvisoSalidaDto), participantes: [] };
    const docDef = this.buildPermisosDocument(dto);
    const doc = await this.printer.createPdfKitDocument(docDef);
    return new Promise((resolve, reject) => {
      const chunks: Buffer[] = [];
      doc.on("data", (c: Buffer) => chunks.push(c));
      doc.on("end", () => resolve(Buffer.concat(chunks)));
      doc.on("error", reject);
      doc.end();
    });
  }

  private buildPermisosDocument(dto: AvisoSalidaDto): any {
    const participantes = dto.participantes ?? [];
    const targets: (ParticipanteDto | null)[] = participantes.length > 0 ? participantes : [null];
    return documentoPermisos(dto, targets, { logoGrupo: this.logoGrupo, logoCC: this.logoCC });
  }

  // ── CRUD ─────────────────────────────────────────────────────────────────────

  async save(
    dto: AvisoSalidaDto,
    userId: number,
    userName: string,
  ): Promise<AvisoSalida> {
    const entity = this.repo.create({
      tipo: dto.tipo || "Otro",
      nombre: dto.nombre || "Sin nombre",
      fechaSalida: dto.salida?.fecha ? dto.salida.fecha.slice(0, 10) : null,
      creadoPorId: userId,
      creadoPorNombre: userName,
      data: dto,
    });
    return this.repo.save(entity);
  }

  findAll(): Promise<AvisoSalida[]> {
    return this.repo.find({ order: { createdAt: "DESC" } });
  }

  async findOne(id: number): Promise<AvisoSalida> {
    const aviso = await this.repo.findOne({ where: { id } });
    if (!aviso) throw new NotFoundException("Aviso no encontrado");
    return aviso;
  }

  async update(id: number, dto: AvisoSalidaDto): Promise<AvisoSalida> {
    const aviso = await this.findOne(id);
    aviso.tipo = dto.tipo || aviso.tipo;
    aviso.nombre = dto.nombre || aviso.nombre;
    aviso.fechaSalida = dto.salida?.fecha
      ? dto.salida.fecha.slice(0, 10)
      : aviso.fechaSalida;
    aviso.data = dto;
    return this.repo.save(aviso);
  }

  async remove(id: number): Promise<void> {
    await this.repo.delete(id);
  }
}
