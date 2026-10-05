/**
 * Serviço de Barreira de Acesso Local do Novo Hiper
 * 
 * ATENÇÃO: Esta é uma barreira de acesso simples para a experiência lúdica infantil,
 * não devendo ser tratada como um sistema de autenticação de segurança avançada.
 * A validação é realizada localmente no navegador.
 */

export const AUTH_SESSION_KEY = 'novo_hiper_session_auth';

/**
 * Credenciais iniciais padrão para acesso ao Novo Hiper.
 * Para alterar a credencial no código, basta atualizar os valores abaixo.
 */
export const INITIAL_AUTH_CREDENTIALS = {
  username: (import.meta.env.VITE_AUTH_USERNAME as string) || 'Bernardo',
  password: (import.meta.env.VITE_AUTH_PASSWORD as string) || 'NovoHiper2026',
};

export interface AuthSession {
  user: string;
  loggedInAt: number;
}

export interface LoginResult {
  success: boolean;
  error?: string;
}

/**
 * Verifica se existe uma sessão ativa válida salva no localStorage.
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
 * Valida o usuário e a senha fornecidos contra as credenciais configuradas.
 */
export function login(usernameInput: string, passwordInput: string): LoginResult {
  const trimmedUser = usernameInput.trim();
  const trimmedPassword = passwordInput.trim();

  if (!trimmedUser || !trimmedPassword) {
    return {
      success: false,
      error: 'Por favor, preencha o nome de usuário e a senha para entrar.',
    };
  }

  const isUserValid = trimmedUser.toLowerCase() === INITIAL_AUTH_CREDENTIALS.username.toLowerCase();
  const isPasswordValid = trimmedPassword === INITIAL_AUTH_CREDENTIALS.password;

  if (isUserValid && isPasswordValid) {
    try {
      const session: AuthSession = {
        user: INITIAL_AUTH_CREDENTIALS.username,
        loggedInAt: Date.now(),
      };
      localStorage.setItem(AUTH_SESSION_KEY, JSON.stringify(session));
    } catch (err) {
      console.error('Erro ao salvar sessão de login no localStorage:', err);
    }
    return { success: true };
  }

  return {
    success: false,
    error: 'Usuário ou senha incorretos. Verifique e tente novamente.',
  };
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
