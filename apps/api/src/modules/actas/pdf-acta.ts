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
    `${b.identificacion.numero} · versión ${b.identificacion.version} · ${b.identificacion.referencia}`,
    `${b.personas.solicitante} · ${b.personas.sede} · ${b.personas.ubicacion}`,
    `Equipo ${b.equipo.placa ?? 'sin placa'} · ${b.equipo.serial ?? 'sin serial'}`,
    `Apertura ${b.fechas.apertura} · solución ${b.fechas.solucion ?? 'pendiente'}`,
    `Diagnóstico: ${b.trabajo.diagnostico}`,
    `Actividades: ${b.trabajo.actividades}`,
    `Repuestos: ${b.trabajo.repuestos || 'ninguno'}`,
    `Estado final: ${b.trabajo.estadoFinal}`,
    `Observaciones: ${b.observaciones || 'sin observaciones'}`,
    `Checklist: ${b.checklist.length} ítems`,
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
