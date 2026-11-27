import PDFDocument from 'pdfkit';
import QRCode from 'qrcode';
import type { BloquesActa } from './bloques';

export async function construirPdf(entrada: {
  bloques: BloquesActa;
  firmas: { nombre: string; rol: string; metodo: string; fecha: string }[];
  codigo: string;
  hash: string;
  urlVerificacion: string;
}): Promise<Buffer> {
  const qr = await QRCode.toBuffer(entrada.urlVerificacion, { width: 140, margin: 1, color: { dark: '#000000', light: '#ffffff' } });
  const doc = new PDFDocument({ size: 'A4', margin: 48 });
  const trozos: Buffer[] = [];
  doc.on('data', (trozo: Buffer) => trozos.push(trozo));
  const listo = new Promise<Buffer>((resolve) => {
    doc.on('end', () => resolve(Buffer.concat(trozos)));
  });
  doc.rect(0, 0, doc.page.width, doc.page.height).fill('#ffffff');
  doc.fillColor('#111111').fontSize(18).text('ACTA DE CIERRE DE SERVICIO', 48, 48);
  doc.rect(48, 78, 500, 3).fill('#14a3a3');
  doc.fillColor('#111111').fontSize(11);
  const b = entrada.bloques;
  const lineas = [
    `Ticket ${b.identificacion.referencia}${b.identificacion.ticketId ? ` · ID ${b.identificacion.ticketId}` : ''} · Acta ${b.identificacion.numero} v${b.identificacion.version}`,
    `Solicitante: ${b.personas.solicitante} · Técnico: ${b.personas.tecnico ?? '—'}`,
    `${b.personas.sede} · ${b.personas.ubicacion}`,
    `Equipo ${b.equipo.nombre ?? b.equipo.placa ?? 'sin nombre'} · Serial ${b.equipo.serial ?? 'sin serial'}`,
    `Creación ${b.fechas.apertura} · Atención ${b.fechas.atencion ?? '—'} · Solución ${b.fechas.solucion ?? 'pendiente'} · Cierre ${b.fechas.cierre ?? '—'}`,
    `Problema / diagnóstico: ${b.trabajo.diagnostico}`,
    `Solución / actividades: ${b.trabajo.actividades}`,
    `Repuestos: ${b.trabajo.repuestos || 'ninguno'}`,
    `Estado final: ${b.trabajo.estadoFinal}`,
    `Evidencias: ${(b.evidencias ?? []).join(', ') || 'ninguna'}`,
    `Confirmación del solicitante: ${b.confirmacionSolicitante ?? 'pendiente'}`,
    `Observaciones: ${b.observaciones || 'sin observaciones'}`,
  ];
  let y = 100;
  for (const linea of lineas) {
    doc.text(linea, 48, y, { width: 500 });
    y += 28;
  }
  doc.text('Firmas', 48, y);
  y += 18;
  for (const firma of entrada.firmas) {
    doc.text(`${firma.nombre} · ${firma.rol} · ${firma.metodo} · ${firma.fecha}`, 48, y, { width: 500 });
    y += 16;
  }
  doc.rect(48, 680, 500, 90).stroke('#14a3a3');
  doc.fontSize(10).text(`Código ${entrada.codigo}`, 160, 692, { width: 370 });
  doc.text(`SHA-256 ${entrada.hash}`, 160, 710, { width: 370 });
  doc.text('No es una firma digital certificada.', 160, 742, { width: 370 });
  doc.image(qr, 56, 688, { width: 72, height: 72 });
  doc.end();
  return listo;
}
