/**
 * Serviço de Autenticação do Novo Hiper
 *
 * A AUTORIDADE é o servidor: a sessão é um cookie HttpOnly (SameSite=Strict) emitido no login e validado a cada
 * requisição /api. Nada de token, senha ou flag de "logado" é guardado no navegador (nem em localStorage).
 * O frontend apenas PERGUNTA ao servidor se a sessão atual é válida.
 */

/** Chave do antigo flag de login em localStorage (removida: nunca mais é autoridade). */
const LEGACY_AUTH_FLAG_KEY = 'novo_hiper_session_auth';

/** Disparado pelo cliente da API quando qualquer chamada recebe 401 (sessão inválida/expirada). */
export const UNAUTHORIZED_EVENT = 'novo-hiper:unauthorized';

const API_BASE = import.meta.env.VITE_API_URL || '/api';

export interface LoginResult {
  success: boolean;
  error?: string;
  user?: string;
}

export interface SessionInfo {
  authenticated: boolean;
  user?: string;
}

/** Remove o resquício do modelo antigo (flag em localStorage). Não toca em dados do negócio. */
export function clearLegacyAuthFlag(): void {
  try {
    localStorage.removeItem(LEGACY_AUTH_FLAG_KEY);
  } catch {
    /* ignore */
  }
}

/** Pergunta ao servidor se há sessão válida. Erro de rede ≠ sessão inválida (devolve `unknown`). */
export async function checkSession(): Promise<SessionInfo | 'unknown'> {
  try {
    const res = await fetch(`${API_BASE}/auth/session`, { credentials: 'same-origin', cache: 'no-store' });
    if (res.status === 401) return { authenticated: false };
    if (!res.ok) return 'unknown';
    const data = await res.json();
    return { authenticated: Boolean(data.authenticated), user: data.user };
  } catch {
    return 'unknown';
  }
}

/** Valida usuário/senha NO SERVIDOR; em caso de sucesso o servidor já define o cookie de sessão. */
export async function login(usernameInput: string, passwordInput: string): Promise<LoginResult> {
  const username = usernameInput.trim();
  const password = passwordInput.trim();
  if (!username || !password) {
    return { success: false, error: 'Por favor, preencha o nome de usuário e a senha para entrar.' };
  }
  try {
    const res = await fetch(`${API_BASE}/auth/login`, {
      method: 'POST',
      credentials: 'same-origin',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username, password }),
    });
    const data = await res.json().catch(() => ({}));
    if (res.ok && data.success) return { success: true, user: data.user || username };
    if (res.status === 429) return { success: false, error: data.error || 'Muitas tentativas. Aguarde alguns minutos.' };
    return { success: false, error: data.error || 'Usuário ou senha incorretos. Verifique e tente novamente.' };
  } catch (err) {
    console.error('Erro ao conectar com servidor de autenticação');
    return { success: false, error: 'Não foi possível conectar ao servidor para validar o acesso. Verifique sua conexão.' };
  }
}

/** Invalida a sessão NO SERVIDOR e limpa o cookie. Não apaga plantas, pedidos, estoque nem caixa. */
export async function logout(): Promise<void> {
  try {
    await fetch(`${API_BASE}/auth/logout`, { method: 'POST', credentials: 'same-origin' });
  } catch {
    /* sem rede: o cookie expira sozinho; a UI volta ao login de qualquer forma */
  }
}
