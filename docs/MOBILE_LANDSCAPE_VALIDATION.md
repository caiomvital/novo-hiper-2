# Navegação no celular horizontal — 19/10/2026

## Problema reproduzido

Chrome com toque, viewport 844×390, sem tela cheia nativa:

- Bairro: contêiner 331,5 px, cabeçalho 69 px e orientação 69 px. O canvas chegava a 260 px de altura para uma área efetivamente menor, com corte no final.
- Interior: orientação e vitrine ocupavam 146 px; sobravam apenas 114 px para o canvas. O direcional, com 178 px incluindo margens, começava acima da área do jogo.
- Plataforma: a posição do contêiner chegou a y=333; canvas e botões ficaram abaixo da tela, exigindo rolar a página.

Medições e capturas anteriores: `/tmp/mobile-landscape-baseline.log` e `docs/evidence/mobile-landscape/before-*.png`. O teste temporário de medição foi guardado em `tmp/landscape-baseline.routes.isolated.spec.ts` para não sobrescrever as evidências anteriores numa execução de rotina.

## Alteração

- Em celular horizontal de pouca altura, a Aventura ocupa a área disponível com CSS, inclusive sem suporte a fullscreen nativo. O cabeçalho da página não cobre mais os controles do jogo.
- Cabeçalho compacto, resumo da missão e ação principal acessíveis. **Missão** abre instruções e vitrine em sobreposição rolável, mantendo a área do mapa.
- Canvas acompanha o tamanho real do contêiner via ResizeObserver, sem recriar o jogo. A sala da Novo Hiper fica centralizada quando a tela é maior que ela.
- Direcional de 132 px com alvos de 44 px, ação de 56 px e respeito às margens de segurança. É possível arrastar o mesmo dedo entre direções e fazer diagonal; cancelar ou trocar de cena limpa o movimento.
- Na plataforma, os botões de movimento e pulo continuam independentes para dois dedos. Rotação e zoom preservam semente e visita do percurso.
- O espaço de 60 px para aviso de fullscreen nativo continua reservado no horizontal; no modo CSS sem fullscreen não há essa margem artificial.
- Cabeçalho do painel compacto no horizontal, com navegação rolável quando necessário e acesso a caixa/ações. Sair do jogo restaura a rolagem da página.
- Conversa de Dona Maria tem botão de fechar no topo, evitando focar automaticamente uma ação distante e pular a apresentação em telas baixas.
- Nenhuma alteração de banco, entrega, estoque, caixa ou regras das histórias.

## Verificação

- Proteção do aviso de fullscreen: teste existente passou nas duas orientações, incluindo movimento real no jogo.
- Testes unitários novos passaram para arrastar/diagonal, cancelamento/troca de cena e movimento/pulo independentes.
- Primeira rodada de navegador: fullscreen e plataforma passaram. O teste de bairro/interior percorreu os controles, os painéis e a tela pequena, mas tinha uma comparação incorreta entre contadores independentes das cenas. Corrigido para comparar a mesma cena antes/depois da rotação; não foi alteração de regra do jogo.
- Conferência final e publicação registradas abaixo.

Os testes usam Chrome com toque emulado. Verificação em Android físico continua sendo manual.

## Continuidade da jornada

Depois do cantinho de Dona Maria, **Missão** apresenta a próxima melhoria com preço e saldo oficiais da Loja de Utilidades. Se faltar dinheiro, mostra quanto falta; se a compra já foi feita, orienta a instalação no balcão. Quando todas estão instaladas, propõe fotografar outra planta e ampliar a vitrine. Esta orientação não cria recompensas nem movimenta o caixa.

A rodada final de bairro/interior precisou de mais tempo no Chrome por software enquanto o runner unitário também usava CPU. O roteiro passou a conferir os botões em uma única leitura do DOM, preservando os testes de tamanho, posição e ponto de toque. A repetição completa de bairro/interior passou em 2 min. A plataforma também passou na rodada final anterior; o teste do aviso de fullscreen passou em 2 min. Os 163 testes unitários passaram em 24 arquivos.

## Publicação e resultado final

- Bairro/interior/conversa/gestos/retorno ao catálogo: passou na conferência final em 2 min. Inclui 844×390 e 568×320, alvos de pelo menos 44 px, ponto de toque desobstruído, canvas igual à área disponível e mais de 280 px de altura em 844×390. No interior havia 114 px antes.
- Plataforma: passou na última rodada com a versão final de layout e centralização. Andar e pular por toque simultâneo, rotação 412×820 ↔ 844×390, zoom e mesma semente/visita confirmados.
- História → próxima conquista: teste novo passou em 1,8 min. Preço de R$ 60 e saldo de R$ 80 vindos do servidor; orientação até Utilidades sem movimentação de caixa; após compra oficial, objetivo muda para instalação e a seta aponta à Novo Hiper. Evidência `next-goal.png`.
- A rodada intermediária de bairro/interior atingiu o limite de 180 s durante a renderização por software, sem falha nas verificações já percorridas. A leitura dos botões foi agrupada e a execução completa final passou com limite de 300 s. Correções de tipagem TouchList e do import do medidor temporário foram conferidas pelo TypeScript final.
- 163 testes unitários, 24 arquivos; TypeScript e builds local/Docker passaram. 50 arquivos de produção idênticos.
- URL: https://novohiper.fluxos.dev.br
- Imagem saudável: `sha256:e46921282b19476581b419112b5a661d919af9eaa52da012a77be2f31d284b40`.
- Backup do banco e das fotos: `backups/mobile-landscape/20261019T033222Z/`.
- Reversão: `novo-hiper-rollback:before-mobile-landscape` (mesmo schema 8).
- SQLite: integridade ok, zero violações de FK e onze tabelas de negócio idênticas ao backup. Antes/depois: 1 planta, 31 pedidos, 30 entregas, 33 transações de caixa e 1 história aceita. Nenhuma migration nova.
- Índice, service worker e 32 assets públicos conferidos byte a byte. Nove bundles verificados com Brotli/gzip; marcadores de missão, direcional, layout compacto e próxima conquista presentes.
- Precache: 51 entradas, 4983,24 KiB. Abertura pública desktop em perfil novo sem SW: 967 ms com rede normal; 609 ms abortando CDNs e 608 ms com atraso externo simulado de 8 s, que não afeta mais a abertura. Amostras de diagnóstico, não garantia para cada dispositivo.
- Abas antigas: voltar ao catálogo e usar **Atualizar aplicativo** quando oferecido. No horizontal, **Missão** abre/fecha os detalhes. O botão de voltar retorna ao painel com rolagem restaurada.
