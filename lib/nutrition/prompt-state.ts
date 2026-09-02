export function normalizarDescripcionComida(texto: string): string {
  return texto.trim().replace(/\s+/g, " ");
}

/** Impide guardar macros calculados para una descripción anterior. */
export function descripcionNecesitaAnalisis(texto: string, textoAnalizado: string, editando: boolean): boolean {
  const actual = normalizarDescripcionComida(texto);
  const previo = normalizarDescripcionComida(textoAnalizado);
  return actual !== previo && (previo.length > 0 || editando);
}

