# Tela cheia no celular — 15/10/2026

Controles de toque elevados permanentemente em tela cheia: faixa inferior de 72px (60px em paisagem curta), além do padding e safe-area do aparelho. A mesma regra atende bairro, interior e plataforma. Altura do container usa 100dvh; canvas flexível com min-height:0. Orientação paisagem limita a barra de orientação a 64px, com rolagem. Nenhuma mudança no ciclo financeiro ou na instância Phaser.

Verificação: TypeScript e builds host/Docker passaram; 19 assets idênticos antes da publicação. Playwright `mobile-fullscreen.routes.isolated.spec.ts`: 1 passou, 2,5min. Viewports 412×820 e 820×412 com toque; entrada/saída de fullscreen real no Chromium, faixa inferior simulada de 60px, botões inteiramente visíveis e sem obstrução no centro, movimento por touchstart/touchend, mesma instância da cena após orientação e saída.

O aviso nativo do Android fica fora do DOM e não é reproduzido pelo teste headless. Validação no aparelho permanece necessária; avisos de tamanhos diferentes podem requerer ajuste da margem.

Publicado em https://novohiper.fluxos.dev.br. Imagem `sha256:92af09290986b05fe18fb62a038e987f5591f1572b55a936db256a2cb980c842`, container saudável. Health, index, JS/CSS, 14 imagens, atlas e service worker verificados no endereço público.

Backup: `backups/mobile-fullscreen-fix/20261015T182639Z/`. Integridade SQLite ok antes/depois; 1 planta, 14 pedidos, 13 entregas, 14 lançamentos preservados. Rollback: `novo-hiper-rollback:before-mobile-fullscreen`.
