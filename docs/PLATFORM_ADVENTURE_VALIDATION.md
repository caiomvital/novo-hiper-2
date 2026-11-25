# Plataforma: horizontal, zoom e caminho opcional

A plataforma oferece o botão “Jogar na horizontal” em aparelhos de toque. Ele solicita tela cheia e orientação paisagem quando o navegador permite. Se a orientação ou fullscreen forem recusados, a fase continua utilizável e o aviso em retrato orienta a girar o aparelho. Ao sair da plataforma, sair de fullscreen ou desmontar a Aventura, o bloqueio adquirido pelo jogo é liberado.

A visão inicial usa zoom 1,5 (antes 2). Os controles −, percentual/restaurar e + permitem zoom 0,75, 1 e 1,5. O percentual é relativo à visão inicial (50%, 67%, 100%). A escolha dura enquanto a Aventura está aberta e é mantida nas visitas à plataforma. Mudanças de zoom e tamanho não recriam o Phaser nem alteram corpos, velocidade, pedido ou progresso do percurso. Os controles HTML e a câmera do HUD não recebem zoom.

Cada um dos três percursos existentes recebeu dois tablados em alturas diferentes, atravessáveis por baixo, formando um caminho alto opcional; três flores coletáveis por visita; um carrinho que vai e volta no segundo trecho; e bandeiras visíveis nos pontos seguros. As plataformas são alcançáveis com a física atual. A rota do chão e os saltos originais continuam disponíveis.

As flores são um desafio local, com contagem durante o percurso e na chegada. Não geram dinheiro, estoque, compra ou desbloqueio no servidor. Tocar no carrinho devolve Bernardo à última bandeira ativada, com um breve intervalo para evitar contatos repetidos. Cair continua usando o último chão seguro. Não se perde a planta nem o pedido.

A confirmação de chegada acompanha a rotação e permanece na câmera sem zoom. O fluxo de confirmação oficial de pedido e a entrega explícita no bairro são preservados.

A primeira validação revelou uma interferência de foco: Enter confirmava a chegada e também acionava o botão HTML de zoom ainda focado. A confirmação agora previne a ação padrão de Enter. O teste mantém o zoom focado e confirma a chegada por Enter, cobrindo a regressão. As solicitações de orientação são feitas uma vez por entrada em fullscreen; uma promessa atrasada de lock é coberta pelo mock do navegador.

O teste de subida usa KeyboardEvents reais e aguarda contato com cada tablado, em vez de depender de duração fixa de tecla. A primeira execução desse roteiro foi interrompida para ajustar a espera de pouso. Uma execução durante preparação do build encontrou falha transitória de importação do Vite; a verificação final é realizada sem builds concorrentes ao navegador.

## Verificação final

- 145 testes unitários em 19 arquivos passaram: limites do carrinho, alcance dos degraus e pontos seguros de todos os percursos incluídos.
- 5 testes de navegador passaram em 3,5min: novo percurso completo (horizontal/zoom/degraus/flor/carrinho/bandeira/entrega única/reentrada), recusa de fullscreen e orientação com rotação manual, e percursos reais da rua, jardim e praça com queda, checkpoint e entrega oficial.
- O bloqueio de orientação foi simulado com promessa assíncrona, conferindo uma única chamada por entrada e liberação ao voltar ao bairro. Não houve teste em aparelho Android físico; a permissão real de bloqueio depende do navegador.
- Evidência visual: `docs/evidence/platform-adventure/caminho-alto-horizontal.png`, viewport 844×390, toque, HUD e controles inteiramente visíveis. Redução de zoom não muda o tamanho do corpo nem recria a visita/cena.

## Publicação

TypeScript final e builds host/Docker passaram. Antes da publicação, 21 assets de produção foram comparados e eram idênticos. Publicado em 17/10/2026 às 10:43 UTC em https://novohiper.fluxos.dev.br, imagem `sha256:ea7a1a5ebc4d57b3e18d9dc2ee8a48e85ef61c2d9c530c93a36ee5cdb3d8ed25`, container saudável.

Verificação no endereço público: health ok; index, JS/CSS, 15 imagens, dois atlas e service worker com hashes iguais ao build. O JS servido contém os controles `btn-platform-landscape`, `btn-platform-zoom-out`, o evento de zoom e o desafio de flores. Portanto a conferência inclui o código novo no servidor público, além dos testes locais.

Backup: `backups/platform-adventure/20261017T104353Z/`. Integridade SQLite ok antes/depois, com 1 planta, 17 pedidos, 16 entregas e 17 lançamentos preservados. Rollback: `novo-hiper-rollback:before-platform-adventure`.
