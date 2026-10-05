/**
 * Serviço de Autenticação do Novo Hiper
 * 
 * A validação de credenciais é realizada exclusivamente no servidor Node.js.
 * Nenhuma senha ou hash de senha é exposta no bundle do frontend.
 */

export const AUTH_SESSION_KEY = 'novo_hiper_session_auth';

export interface AuthSession {
  user: string;
  loggedInAt: number;
}

export interface LoginResult {
  success: boolean;
  error?: string;
  user?: string;
}

/**
 * Verifica se existe uma sessão ativa válida salva localmente.
 */
export function checkIsAuthenticated(): boolean {
  try {
    const raw = localStorage.getItem(AUTH_SESSION_KEY);
    if (!raw) return false;
    const session: AuthSession = JSON.parse(raw);
    return Boolean(session && session.user);
  } catch {
    return false;
  }
}

/**
 * Obtém o nome do usuário atualmente conectado.
 */
export function getCurrentUser(): string {
  try {
    const raw = localStorage.getItem(AUTH_SESSION_KEY);
    if (!raw) return 'Bernardo';
    const session: AuthSession = JSON.parse(raw);
    return session.user || 'Bernardo';
  } catch {
    return 'Bernardo';
  }
}

/**
 * Valida o usuário e a senha fornecidos contra o backend Node.js.
 * O hash seguro é verificado exclusivamente no servidor.
 */
export async function login(usernameInput: string, passwordInput: string): Promise<LoginResult> {
  const trimmedUser = usernameInput.trim();
  const trimmedPassword = passwordInput.trim();

  if (!trimmedUser || !trimmedPassword) {
    return {
      success: false,
      error: 'Por favor, preencha o nome de usuário e a senha para entrar.',
    };
  }

  const apiBase = import.meta.env.VITE_API_URL || '/api';

  try {
    const res = await fetch(`${apiBase}/auth/login`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        username: trimmedUser,
        password: trimmedPassword,
      }),
    });

    const data = await res.json().catch(() => ({}));

    if (res.ok && data.success) {
      const session: AuthSession = {
        user: data.user || trimmedUser,
        loggedInAt: Date.now(),
      };
      localStorage.setItem(AUTH_SESSION_KEY, JSON.stringify(session));
      return { success: true, user: session.user };
    }

    return {
      success: false,
      error: data.error || 'Usuário ou senha incorretos. Verifique e tente novamente.',
    };
  } catch (err) {
    console.error('Erro ao conectar com servidor de autenticação:', err);
    return {
      success: false,
      error: 'Não foi possível conectar ao servidor para validar o acesso. Verifique sua conexão.',
    };
  }
}

/**
 * Encerra a sessão atual removendo os dados de autenticação do localStorage,
 * sem apagar nenhuma planta, pedido, estoque ou caixa da loja.
 */
export function logout(): void {
  try {
    localStorage.removeItem(AUTH_SESSION_KEY);
  } catch (err) {
    console.error('Erro ao encerrar sessão no localStorage:', err);
  }
}
