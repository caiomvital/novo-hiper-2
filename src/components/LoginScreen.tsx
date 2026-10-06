import React, { useState } from 'react';
import { Leaf, Lock, User, Eye, EyeOff, LogIn, AlertCircle, Sparkles } from 'lucide-react';
import { login } from '../services/auth';
import { sounds } from '../services/sound';
import { PWAInstallButton } from './PWAInstallButton';
import { OfflineBanner } from './OfflineBanner';

interface LoginScreenProps {
  onLoginSuccess: () => void;
}

export const LoginScreen: React.FC<LoginScreenProps> = ({ onLoginSuccess }) => {
  const [username, setUsername] = useState('Bernardo');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);
    setIsSubmitting(true);

    try {
      const result = await login(username, password);

      if (result.success) {
        sounds.playBellRing();
        onLoginSuccess();
      } else {
        sounds.playDeleteConfirm();
        setErrorMessage(result.error || 'Usuário ou senha incorretos.');
      }
    } catch {
      sounds.playDeleteConfirm();
      setErrorMessage('Erro de comunicação com o servidor.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-stone-100 flex flex-col justify-between items-center select-none">
      <OfflineBanner />
      
      {/* Container principal */}
      <div className="w-full max-w-md p-4 sm:p-6 my-auto">
        {/* Topo com Logo e Boas-vindas */}
        <div className="text-center mb-6">
          <div className="inline-flex items-center justify-center w-16 h-16 sm:w-20 sm:h-20 rounded-3xl bg-emerald-800 text-white shadow-md mb-3 border-2 border-emerald-700/60">
            <Leaf className="w-9 h-9 sm:w-11 sm:h-11 text-emerald-300" />
          </div>
          <h1 className="text-2xl sm:text-3xl font-bold font-display tracking-tight text-stone-900">
            Novo Hiper
          </h1>
          <div className="inline-flex items-center gap-1.5 px-3 py-1 mt-1 rounded-full text-xs font-semibold bg-emerald-100 text-emerald-900 border border-emerald-200">
            <Sparkles className="w-3.5 h-3.5 text-emerald-700" />
            <span>Loja de Plantas e Jardinagem</span>
          </div>
          <p className="text-xs sm:text-sm text-stone-500 mt-2 font-medium">
            Digite a senha para abrir a portaria do viveiro
          </p>
        </div>

        {/* Card do Formulário de Acesso */}
        <div className="bg-white rounded-3xl p-6 sm:p-8 border border-stone-200/90 shadow-sm">
          <form onSubmit={handleSubmit} className="space-y-4">
            {/* Mensagem de Erro */}
            {errorMessage && (
              <div 
                id="login-error-message"
                role="alert"
                className="bg-rose-50 border border-rose-200 text-rose-800 text-xs sm:text-sm rounded-2xl p-3.5 flex items-start gap-2.5 animate-shake"
              >
                <AlertCircle className="w-5 h-5 text-rose-600 flex-shrink-0 mt-0.5" />
                <span className="font-medium">{errorMessage}</span>
              </div>
            )}

            {/* Campo Usuário */}
            <div>
              <label 
                htmlFor="login-username" 
                className="block text-xs font-display font-bold text-stone-700 mb-1.5"
              >
                Nome ou Usuário
              </label>
              <div className="relative flex items-center">
                <div className="absolute left-3.5 pointer-events-none text-stone-400">
                  <User className="w-4 h-4" />
                </div>
                <input
                  id="login-username"
                  type="text"
                  value={username}
                  onChange={(e) => {
                    setUsername(e.target.value);
                    if (errorMessage) setErrorMessage(null);
                  }}
                  placeholder="Nome do lojista (ex: Bernardo)"
                  autoComplete="username"
                  required
                  className="w-full pl-10 pr-3 py-3 rounded-xl border border-stone-200 text-stone-900 placeholder:text-stone-400 text-sm font-medium focus:outline-none focus:ring-2 focus:ring-emerald-700 focus:border-emerald-700 transition-all bg-stone-50/50 hover:bg-white"
                />
              </div>
            </div>

            {/* Campo Senha */}
            <div>
              <label 
                htmlFor="login-password" 
                className="block text-xs font-display font-bold text-stone-700 mb-1.5"
              >
                Senha de Acesso
              </label>
              <div className="relative flex items-center">
                <div className="absolute left-3.5 pointer-events-none text-stone-400">
                  <Lock className="w-4 h-4" />
                </div>
                <input
                  id="login-password"
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={(e) => {
                    setPassword(e.target.value);
                    if (errorMessage) setErrorMessage(null);
                  }}
                  placeholder="Digite a senha da loja"
                  autoComplete="current-password"
                  required
                  className="w-full pl-10 pr-11 py-3 rounded-xl border border-stone-200 text-stone-900 placeholder:text-stone-400 text-sm font-medium focus:outline-none focus:ring-2 focus:ring-emerald-700 focus:border-emerald-700 transition-all bg-stone-50/50 hover:bg-white"
                />
                <button
                  id="btn-toggle-password"
                  type="button"
                  onClick={() => {
                    sounds.playPlim();
                    setShowPassword(!showPassword);
                  }}
                  aria-label={showPassword ? 'Ocultar senha' : 'Exibir senha'}
                  title={showPassword ? 'Ocultar senha' : 'Exibir senha'}
                  className="absolute right-2.5 p-1.5 text-stone-400 hover:text-stone-700 rounded-lg transition-colors cursor-pointer"
                >
                  {showPassword ? (
                    <EyeOff className="w-4 h-4" />
                  ) : (
                    <Eye className="w-4 h-4" />
                  )}
                </button>
              </div>
            </div>

            {/* Botão Entrar */}
            <div className="pt-2">
              <button
                id="btn-submit-login"
                type="submit"
                disabled={isSubmitting}
                className="w-full flex items-center justify-center gap-2 bg-emerald-800 hover:bg-emerald-900 active:bg-emerald-950 text-white font-display font-bold text-sm sm:text-base py-3.5 px-4 rounded-xl shadow-xs transition-all cursor-pointer disabled:opacity-75"
              >
                <LogIn className="w-4 h-4" />
                <span>Entrar na Loja 🪴</span>
              </button>
            </div>
          </form>
        </div>

        {/* Botão de Instalar PWA para quem abre a tela inicial */}
        <div className="mt-4 flex justify-center">
          <PWAInstallButton />
        </div>

        {/* Rodapé sutil */}
        <p className="text-center text-[11px] text-stone-500 mt-4">
          Novo Hiper • Presente especial de aniversário
        </p>
      </div>
    </div>
  );
};
