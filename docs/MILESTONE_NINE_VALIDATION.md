# Marco 9 — Experiência no celular

14/10/2026: cinco dos sete itens aprovados tecnicamente. O02 e O06 aguardam
confirmação em aparelho físico; o marco não está encerrado.

## Melhorias publicadas

- Zoom permitido; campos de entrada com fonte de 16 px no toque, controles
  com pelo menos 44 px e cabeçalho que reorganiza suas linhas em telas estreitas.
- Formulários usam a área visível do navegador, com rolagem interna quando
  ela diminui. Erros de cadastro são trazidos para a área visível.
- Modais de planta, endereço, caixa, exclusão e melhorias mantêm o foco dentro
  do painel, fecham com Escape quando permitido e restauram o foco ao sair.
- Legendas pequenas e textos claros em fundo branco ganharam legibilidade.
  Estados continuam identificados por texto, inclusive sem som.
- Orientação da aplicação instalada permite retrato e paisagem.
- Um convite de instalação só é consumido uma vez, inclusive entre as barras
  móvel e desktop. Cancelar ou falhar não reutiliza o convite. Aceitar informa
  “Instalação solicitada”; somente o evento do navegador ou modo standalone
  confirma que está instalada.
- A partir desta versão, atualizações aguardam confirmação. A faixa orienta
  salvar a edição antes de aplicar a versão nova, preservando os dados oficiais.
  Enquanto um modal está aberto, o aviso fica oculto para não cobrir suas ações.

## Resultado por item

| Item | Resultado e evidência |
| --- | --- |
| O01 | Aprovado em Chrome com emulação móvel e toque. Jornada de cadastro com foto, preparo, retirada, venda, caixa e instalação de placa. Sem excesso horizontal nas larguras 320, 390 e 640 px. Jogo exercitado em tela cheia. |
| O02 | Espaço reduzido a 360 px de altura: erro e ações alcançáveis, campos decimal/numeric e formulário preservado. **Falta teclado virtual nativo em celular físico.** |
| O03 | Botões de fechar com 44 px, Escape, foco dentro dos modais e ações por toque validados no navegador. |
| O04 | Revisão visual da jornada, instruções e estados; contraste de legendas ajustado, valores e confirmação legíveis. Feedback de venda e melhoria não depende do som. Não é auditoria completa de conformidade WCAG. |
| O05 | Preferência de som preservada após recarga; abrir Pedidos dispara um único efeito, sem duplicação das barras de navegação. |
| O06 | Simulação do convite nativo: cancelamento, consumo único e ausência de botão sem suporte. Manifesto standalone conferido. **Falta instalar e abrir pelo sistema operacional em celular físico.** |
| O07 | Service worker real com duas variantes controladas do build: nova versão aguarda confirmação, edição aberta conserva texto, código novo executa após atualizar. Sessão, estoque 4, saldo R$ 40, placa instalada e armazenamento local preservados. Arte do bairro e Bernardo presentes no cache. |

## Testes

- `tests/e2e/milestone-nine.spec.ts`: três cenários com API/banco descartáveis.
  Login, foto pela galeria, preço e estoque, pedido, retirada e entrega por toque,
  caixa, compra/instalação, recarga, som, layouts e convite de instalação.
  Percursos pontuais usam teleporte de diagnóstico; interações são por toque.
- `scripts/verify-pwa-update.mjs`: servidor local, duas variantes de artefatos
  compilados e API em banco temporário. A segunda altera HTML e JavaScript e
  gera um service worker novo. Não altera a publicação ou dados reais.
- 134 testes unitários aprovados; TypeScript sem erros.
- [Jornada por toque](evidence/milestone-nine/jornada-toque.png).
- [Aplicação atualizada](evidence/milestone-nine/pwa-atualizada.png).

## Para encerrar no aparelho físico

1. Abrir em celular e editar preço/estoque com o teclado nativo: conferir erro,
   rolagem, botão de salvar e de fechar, em retrato e paisagem (O02).
2. Instalar quando oferecido pelo navegador, ou seguir o guia do Safari, fechar
   o navegador e abrir pelo ícone instalado. Repetir login, venda e melhoria;
   conferir dados e orientação (O06).
3. Conferir câmera real ao cadastrar uma planta: D02 do marco 2 segue pendente.

A migração da versão anterior, que usava atualização automática, pode exigir
fechar todas as abas/janelas do Novo Hiper e abrir novamente para ativar esta
versão. As próximas atualizações usam a faixa de confirmação. Dados oficiais
ficam no servidor; endereços personalizados e som permanecem neste navegador.

## Publicação

Publicada em `https://novohiper.fluxos.dev.br` em 14/10/2026.
Imagem: `sha256:eda3847fa8a76583555eb2443e7f76ddcf642efaff5e24db18a10d4abe843370`.
Container saudável e arquivos públicos conferidos por hash. SQLite com
integridade `ok`; contagens preservadas: uma planta, quatro pedidos,
três entregas e quatro transações.
Backup: `backups/milestone-nine/20261014T123200Z/`.
Imagem anterior em `novo-hiper-rollback:before-milestone-nine`.
