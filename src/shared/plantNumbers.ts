/** Mesmas regras no formulário e na API: reais com até dois centavos e vasos inteiros. */
export function parsePlantPrice(value: unknown): number | null {
  if (typeof value !== 'string' && typeof value !== 'number') return null;
  const text = String(value).trim();
  if (!/^\d+(?:[.,]\d{1,2})?$/.test(text)) return null;
  const price = Number(text.replace(',', '.'));
  return Number.isFinite(price) && Number.isSafeInteger(Math.round(price * 100))
    ? Math.round(price * 100) / 100 : null;
}

export function parsePlantStock(value: unknown): number | null {
  if (typeof value !== 'string' && typeof value !== 'number') return null;
  const text = String(value).trim();
  if (!/^\d+$/.test(text)) return null;
  const stock = Number(text);
  return Number.isSafeInteger(stock) ? stock : null;
}
