/** "R$ 12,50" (espaço comum, sem NBSP, para ficar estável em testes e no canvas). */
export function formatBRL(value: number): string {
  return value.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' }).replace(/ /g, ' ');
}
