# Primeira história de morador — O cantinho de Dona Maria

Dona Maria tem uma conversa de apresentação e um cantinho inicialmente vazio em frente à casa. O jogador aceita ajudá-la pelo botão **História** ou conversando com ela com E/interação. A próxima vaga de encomenda passa a ser dela; um pedido em andamento continua intacto. O servidor usa uma planta com estoque livre no catálogo, com preço oficial congelado no pedido. Se faltar planta ou estoque, a história aguarda o cadastro/reposição.

A encomenda participa da retirada e das entregas existentes, incluindo a rota pela plataforma. O jardim só fica plantado após a confirmação oficial com o morador. A conversa final é apresentada uma vez até ser reconhecida e pode ser revista nas visitas seguintes. O vaso, o nome da planta e a identidade fotográfica persistem após recarga, reinício e edição/exclusão posterior da planta. A história não paga recompensa adicional: a venda comum usa estoque e caixa uma única vez.

## Implementação

- Migration 008 adiciona apenas `resident_stories`, com vínculo único a um pedido. Não altera linhas de estoque, caixa ou histórico.
- Aceitação idempotente; história aguardando ganha prioridade na próxima vaga de pedidos. Autogeração comum segue suas regras; aceitar explicitamente uma história também funciona com autogeração desabilitada.
- Conclusão é derivada do status oficial do pedido, sem contador paralelo. Nome e foto são guardados ao vincular a encomenda.
- O React controla API, conversa e suspensão dos controles; o Phaser desenha o jardim e emite a intenção de conversar. Jardim e moradora não acrescentam obstáculos de colisão.
- Fechar uma interface confere novamente o pedido, permitindo que a encomenda recém-aceita apareça imediatamente.
- Nenhuma imagem pesada nova: vaso, canteiro e identificação usam desenho e texturas já disponíveis.

## Verificação

- 305 testes de backend passaram, incluindo migrações, preservação de dados, sessão, fila atrás do pedido atual, espera por estoque, aceitação concorrente, entrega idempotente e persistência após reinício.
- 160 testes unitários passaram em 23 arquivos, incluindo a rodada final.
- E2E `resident-story.routes.isolated.spec.ts`: passou em 2,5 min com banco descartável. Conversa por proximidade, aceitação, planta do catálogo, retirada, percurso completo de plataforma por teclado, chegada sem crédito, entrega única, agradecimento com foto, jardim plantado e nova conversa após recarregar sem repetição de estoque/dinheiro.
- Evidências: `docs/evidence/resident-story/01-cantinho-vazio.png` a `04-cantinho-plantado.png`.
- A primeira tentativa de testes de API no sandbox sem permissão de listener foi recusada com EPERM; todos os 305 passaram no executor autorizado a abrir portas locais. Não era falha do aplicativo.

A validação de navegador usa toque emulado; teste em Android físico e avaliação com Bernardo continuam sendo verificações manuais.

- Regressão de orientação, compra/instalação, cancelamento e abandono da plataforma: passou. Junto ao teste de abertura sem CDNs e mapa sob demanda, foram três testes em 2,2 min.
- TypeScript passou; as verificações finais de compilação, imagem e publicação estão registradas abaixo.

## Publicação verificada

- URL: https://novohiper.fluxos.dev.br
- Imagem saudável: `sha256:5b70c669862c9af61d16036475446fe53bae8970730565dfde9affc6e14cdb26`.
- Backup completo do banco e uploads: `backups/resident-story/20261018T185233Z/`.
- Imagem anterior preservada: `novo-hiper-rollback:before-resident-story`. Ela conhece schema 7: uma reversão exige planejar a restauração do backup correspondente, preservando quaisquer alterações feitas pelos usuários após a publicação; trocar apenas a imagem antiga sobre schema 8 é recusado pelo runner.
- Antes de publicar, a imagem nova aplicou a migration 8 em cópia isolada do banco. Integridade e FKs ok; comparação por digest confirmou todas as linhas das dez tabelas de negócio intactas. O primeiro script de conferência precisou ser ajustado para aceitar tabelas cuja chave não se chama `id`; a simulação concluída passou.
- Depois de publicar: schema 8, integridade ok, zero violações de FK e as dez tabelas de negócio idênticas ao backup. Contagens antes/depois: 1 planta, 28 pedidos, 27 entregas e 30 transações de caixa; zero histórias aceitas automaticamente. A história começa por ação explícita do usuário.
- Build local e Docker passaram; 50 arquivos idênticos. TypeScript final passou depois do build.
- Índice, service worker e 32 assets públicos conferidos byte a byte; nove bundles verificados com Brotli/gzip, incluindo os marcadores da história nova. Nenhuma imagem pesada adicional.
- Precache: 51 entradas, 4975,41 KiB. Abertura pública desktop em perfil novo, sem service worker: 1112 ms com rede normal, 427 ms com CDNs abortados e 466 ms ao simular 8 s de demora nesses CDNs, que já não são solicitados na abertura. São amostras de diagnóstico, não garantia por dispositivo.
- Abas antigas podem usar **Atualizar aplicativo**. Início: Aventura → **História** → aceitar o pedido de Dona Maria. Uma encomenda já ativa continua primeiro.
