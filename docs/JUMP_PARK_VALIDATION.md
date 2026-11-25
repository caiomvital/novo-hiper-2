# Parque dos Saltos, fachada frontal e carregamento

## Resultado

O botão **Parque** no bairro abre uma área alternativa de 7200 × 720 px, separada do percurso curto de 2400 px. Há nove trechos de chão, oito valas com largura segura, vinte plataformas altas/pontes, treze flores opcionais, nove bandeiras e três trampolins. O caminho de chão continua disponível; trilhas elevadas são opcionais. Composição procedural por semente, mantida durante quedas e zoom.

A exploração usa campinas abertas, céu, nuvens e colinas em parallax. O treino curto também ganha esse cenário aberto, com pequenas casas distantes. A arte da floresta foi preservada no projeto, mas deixou de ser importada pelo jogo.

A casa de chegada é uma nova fachada frontal: sem parede lateral ou base inclinada, preservando telhas, porta, janelas e jardineiras da referência. Gerada com a ferramenta integrada `image_gen`; original em `final-assets/buildings/platform-house-front-master.png`, prompt em `platform-house-front-prompts.json` e versão de distribuição em `final-assets/runtime/platform-house.webp`. A imagem principal do bairro continua usando a perspectiva própria da vista de cima.

O parque pode ser visitado carregando uma planta. Sua chegada só retorna ao bairro: não conclui a entrega nem baixa estoque ou credita dinheiro. A rota curta continua disponível para concluir o pedido na casa oficial.

## Carregamento

O conjunto anterior de oito imagens de bairro/NPCs totalizava **13.515.393 bytes**. Os derivados de distribuição equivalentes somam **1.848.312 bytes**, redução de **86,3%**. A nova fachada frontal adiciona cerca de 51 KB, totalizando **1.899.080 bytes** para nove imagens WebP. Originais preservados; produção usa os derivados. Os atlas dos NPCs conservam exatamente suas dimensões e coordenadas, sem mudar a escala dos personagens.

As imagens do bairro têm recortes alfa calculados no script de preparação, em vez de varrer seus pixels no celular a cada criação do jogo. `scripts/sprites/build-runtime-art.cjs` reproduz os derivados e `world-art.json`. A tela exibe progresso enquanto prepara o bairro.

O build produz JavaScript/CSS em Brotli e gzip. O servidor negocia a versão pré-comprimida e usa cache imutável para assets; HTML e service worker exigem revalidação. O cache PWA não baixa o conjunto legado duplicado de sprites, que não é usado pelo código atual. Imagens e JavaScript continuam disponíveis offline após instalação do cache.

Esses números medem bytes dos arquivos; tempo real de carregamento depende da rede, dispositivo e cache. Medidas de duração em Chrome headless com WebGL por software não representam Android físico.

## Validação em execução

156 testes unitários e TypeScript aprovados. Incluem 600 sementes do parque e 1200 sementes das rotas curtas, margens de salto, áreas de nascimento e chegada, pontos seguros, geometria dos atlas e limite de tamanho dos derivados.

O primeiro teste de navegador passou pela entrada no parque carregando uma planta, subida real de três degraus, impulso do trampolim, recuperação de queda e chegada sem transação. Depois completou a entrega pela rota curta, com um único crédito e débito de estoque. A execução final atravessou o parque inteiro com controles reais e passou em 1,9 minuto. Usou a semente 3946347154, capturas após estabilizar a câmera, tela 760×440 e 480×360 durante a travessia. O primeiro ensaio completo detectou uma limitação do piloto de testes: após uma queda ele não tentava novamente um salto já marcado. O helper agora repete após resgate e só aciona salto ao estar apoiado; a mesma semente passou sem alterar as valas do mapa. Fotos em `docs/evidence/jump-park/`, incluindo a casa frontal com base alinhada ao chão.

Regressões finais aprovadas: retirada real na loja, colisões, sprites loiros, plataforma curta, confirmação e entrega única (3,2 minutos); mapa estável após queda/zoom/resize e outro mapa ao reentrar, com as nove imagens leves carregadas (1,3 minuto). Duas regressões em 4,6 minutos, além do teste completo do parque. TypeScript final sem erros. As duas falhas anteriores foram de sintaxe no novo teste unitário e de recuperação do piloto E2E; corrigidas e repetidas com sucesso. Nenhuma alteração financeira ou de esquema.

## Build e produção

Builds local e Docker aprovados, com **30 arquivos idênticos**, incluindo imagens, atlas, JS/CSS e versões Brotli/gzip. Bundles somam 2.346.529 bytes sem compressão e 523.863 bytes em Brotli (**78% menos bytes**). Precache passou de 16.770,22 KiB (versão anterior) para 4.837,52 KiB (**71% menor**, 41 entradas); o corpo descomprimido fica no cache, e o transporte aproveita compressão.

Publicado em 18/10/2026 às 03:56 UTC em https://novohiper.fluxos.dev.br. Imagem `sha256:c4f0b6fcfdbba3d05243901529183fd06c7d79e85acf1de0cfc2b12c6568de95`, contêiner healthy. Verificação pública aprovada: 22 assets, 16 imagens, os nove WebP byte a byte, os sete sprites loiros, os dois atlas e o service worker. Negociação Brotli e gzip verificada para quatro bundles, com bytes descomprimidos iguais ao build e cache imutável. Recursos do parque, casa frontal e campina presentes no JavaScript servido; floresta ausente do bundle.

Backup `backups/jump-park/20261018T035555Z/`; rollback `novo-hiper-rollback:before-jump-park`. Banco íntegro e mesmos totais antes/depois: 1 planta, 20 pedidos, 19 entregas e 21 transações de caixa. Validação em Android físico continua necessária para medir tempo e fluidez reais. Usuários com aba antiga devem aceitar **Atualizar aplicativo**.
