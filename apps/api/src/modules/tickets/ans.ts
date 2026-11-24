export type Unidad = 'MINUTOS' | 'HORAS' | 'DIAS_HABILES';

export type HorarioHabil = {
  inicioMinuto: number;
  finMinuto: number;
  dias: number[];
};

export const HORARIO_DEFECTO: HorarioHabil = {
  inicioMinuto: 8 * 60,
  finMinuto: 17 * 60,
  dias: [1, 2, 3, 4, 5],
};

export function prioridadPorImpacto(impacto: {
  puedeTrabajar: boolean;
  personas: number;
  areaCompleta: boolean;
}): 'CRITICA' | 'ALTA' | 'MEDIA' | 'BAJA' {
  if (impacto.areaCompleta || (!impacto.puedeTrabajar && impacto.personas >= 5)) {
    return 'CRITICA';
  }
  if (!impacto.puedeTrabajar) {
    return 'ALTA';
  }
  if (impacto.personas > 1) {
    return 'MEDIA';
  }
  return 'BAJA';
}

export function sumarTiempoHabil(desde: Date, valor: number, unidad: Unidad, horario: HorarioHabil = HORARIO_DEFECTO): Date {
  const minutos = aMinutosHabiles(valor, unidad, horario);
  let cursor = new Date(desde.getTime());
  cursor = saltarAHorario(cursor, horario);
  let restantes = minutos;
  while (restantes > 0) {
    const minutoDelDia = cursor.getHours() * 60 + cursor.getMinutes();
    const hastaCierre = horario.finMinuto - minutoDelDia;
    const paso = Math.min(restantes, hastaCierre);
    cursor = new Date(cursor.getTime() + paso * 60_000);
    restantes -= paso;
    if (restantes > 0) {
      cursor = saltarAHorario(cursor, horario);
    }
  }
  return cursor;
}

function aMinutosHabiles(valor: number, unidad: Unidad, horario: HorarioHabil): number {
  if (unidad === 'MINUTOS') return valor;
  if (unidad === 'HORAS') return valor * 60;
  return valor * (horario.finMinuto - horario.inicioMinuto);
}

function saltarAHorario(fecha: Date, horario: HorarioHabil): Date {
  const cursor = new Date(fecha.getTime());
  for (let i = 0; i < 14; i += 1) {
    const dia = cursor.getDay();
    const minuto = cursor.getHours() * 60 + cursor.getMinutes();
    if (horario.dias.includes(dia) && minuto >= horario.inicioMinuto && minuto < horario.finMinuto) {
      return cursor;
    }
    if (horario.dias.includes(dia) && minuto < horario.inicioMinuto) {
      cursor.setHours(Math.floor(horario.inicioMinuto / 60), horario.inicioMinuto % 60, 0, 0);
      return cursor;
    }
    cursor.setDate(cursor.getDate() + 1);
    cursor.setHours(Math.floor(horario.inicioMinuto / 60), horario.inicioMinuto % 60, 0, 0);
  }
  return cursor;
}
