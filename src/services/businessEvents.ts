/** Invalida consultas antigas e avisa outras abas; dados oficiais continuam na API. */
export const BUSINESS_MUTATION = 'novo-hiper-business-mutation';
export const BUSINESS_CHANGED = 'novo-hiper-business-changed';
export const BUSINESS_STORAGE_KEY = 'novo_hiper_business_changed';
export const API_UNAVAILABLE = 'novo-hiper-api-unavailable';
export function notifyBusinessChanged() {
  window.dispatchEvent(new Event(BUSINESS_CHANGED));
  try { localStorage.setItem(BUSINESS_STORAGE_KEY, `${Date.now()}-${Math.random()}`); } catch { /* API continua disponível sem storage */ }
}
