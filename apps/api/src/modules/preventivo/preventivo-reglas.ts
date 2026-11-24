export type Frecuencia = 'TRIMESTRAL' | 'SEMESTRAL' | 'ANUAL';
export type ItemChecklist = {
  id: string;
  texto: string;
  obligatorio: boolean;
  tipo: 'casilla' | 'valor' | 'estado' | 'foto';
  unidad?: string;
};
export type ResultadoItem = { itemId: string; valor?: string; foto?: boolean };

const DIAS: Record<Frecuencia, number> = { TRIMESTRAL: 90, SEMESTRAL: 182, ANUAL: 365 };

export function sumarFrecuencia(desde: Date, frecuencia: Frecuencia): Date {
  const siguiente = new Date(desde);
  siguiente.setDate(siguiente.getDate() + DIAS[frecuencia]);
  return siguiente;
}

export function dentroDeAnticipacion(fecha: Date, ahora: Date, dias: number): boolean {
  const limite = ahora.getTime() + dias * 86_400_000;
  return fecha.getTime() <= limite;
}

export function faltanObligatorios(items: ItemChecklist[], resultados: ResultadoItem[]): string[] {
  return items
    .filter((item) => item.obligatorio)
    .filter((item) => {
      const resultado = resultados.find((fila) => fila.itemId === item.id);
      if (!resultado) {
        return true;
      }
      if (item.tipo === 'foto') {
        return resultado.foto !== true;
      }
      if (item.tipo === 'casilla') {
        return resultado.valor !== 'si';
      }
      return !resultado.valor?.trim();
    })
    .map((item) => item.texto);
}

export function cumplimiento(programadas: number, conActaFirmada: number): number {
  if (programadas <= 0) {
    return 0;
  }
  return Math.round((conActaFirmada / programadas) * 1000) / 10;
}
