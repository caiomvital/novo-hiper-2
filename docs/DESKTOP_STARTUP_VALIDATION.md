# Abertura no desktop — 2026-10-18

A tela inicial aguardava duas folhas de estilo externas (Google Fonts e unpkg/Leaflet), mesmo no login. Reprodução no Chrome desktop, perfil novo e service worker bloqueado: ao atrasar esses pedidos por 8 segundos, o login levou 8,5 segundos na primeira medição e 9,8 segundos na segunda. O servidor permaneceu acessível; o atraso era anterior à interface utilizável.

Correção: fontes variáveis WOFF2 locais, com `font-display: swap` e licenças SIL anexas; CSS Leaflet da dependência instalada, importado junto ao mapa; mapa e minijogo antigo carregados por importação dinâmica ao abrir as respectivas telas. A aventura Phaser continua sob demanda. Sessão, sincronização, estoque e regras de entrega não foram alterados.

## Verificação

- TypeScript: passou. Uma execução concorrente com a compilação encontrou arquivos antigos de dist removidos durante o build; nova execução após o build passou.
- 156 testes unitários, 22 arquivos: passaram.
- `startup.routes.isolated.spec.ts`: passou em Chrome 1366×768, com domínios externos bloqueados, login real em backend descartável, restauração da sessão após recarregar, abertura do mapa com CSS local e retorno ao catálogo sem erro de JavaScript.
- Build local e Docker: passaram; 50 arquivos idênticos, incluindo fontes, compressões, sprites e atlas.
- Produção: saúde ok; índice, service worker e 32 assets conferidos byte a byte, incluindo seis fontes locais; nove bundles com Brotli/gzip conferidos.

## Medições públicas

Script: `node scripts/measure-startup.cjs [URL]`. Navegação pública sem autenticação, Chrome novo por rodada, 1366×768, sem service worker. Modos: rede normal; abortar CDNs imediatamente; atrasar CDNs por 8 segundos e abortar. O perfil é novo, mas caches de DNS/sistema e a carga de CPU variam; são amostras de diagnóstico, não garantia para todo computador. A segunda medição anterior coincidiu com builds locais.

| Condição | Antes, segunda rodada | Depois |
| --- | ---: | ---: |
| Rede normal | 2146 ms | 921 ms |
| CDNs abortados imediatamente | 2014 ms | 474 ms |
| CDNs atrasados em 8 s | 9793 ms | 534 ms |

Após a correção não há pedidos aos CDNs de estilos, portanto a demora simulada não afeta mais a abertura. As linhas de evidência estão em `docs/evidence/desktop-startup/`. O script mede visibilidade do campo de login; não mede a inicialização do mundo Phaser nem o tempo de um computador Android.

Código de entrada: 387314 bytes sem compressão; 104020 em Brotli. Na navegação medida, transferência gzip do JS inicial caiu de 186115 para 111716 bytes (aproximadamente 40%). O cache offline completo inclui agora as fontes locais: 51 entradas, 4958,12 KiB.

## Publicação

- URL: https://novohiper.fluxos.dev.br
- Imagem: `sha256:e360e16dcbb87596a33d5c209714cbbf713ef16c3e631ddf4f0d09125bdb8a65`, saudável.
- Backup: `backups/desktop-startup/20261018T164531Z/`.
- Reversão: `novo-hiper-rollback:before-desktop-startup`.
- Integridade SQLite ok. Antes/depois: 1 planta, 21 pedidos, 20 entregas, 22 transações de caixa.
- Abas já abertas podem precisar do botão **Atualizar aplicativo** para trocar o service worker antigo.
