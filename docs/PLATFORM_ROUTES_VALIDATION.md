# Variações dos percursos de entrega

## Resultado

A primeira clientela usa a Rua das primeiras entregas, com duas valas. O marco oficial `vizinhos_2` libera o Caminho do jardim (três entregas e uma melhoria instalada); `vizinhos_3` libera o Passeio da praça (seis entregas, duas melhorias e duas plantas cadastradas historicamente).

Jardim e praça têm três valas com posições diferentes, além de cores e elementos de cenário próprios. A física mantém velocidade, altura do salto e corpo do Bernardo. Todas as valas preservam a margem de segurança de 25% já usada no jogo.

O percurso é escolhido na entrada e permanece fixo até a saída. Treino sem pedido usa a rua inicial. A recuperação de quedas verifica os segmentos do percurso atual. Concluir continua exigindo conferência do pedido e confirmação de entrega na casa oficial, sem crédito antecipado.

Não altera banco, estoque, preços, recompensas ou condições de progressão. Os elementos de paisagem são decorativos; não criam obstáculos ocultos.

## Validação

TypeScript passou. A suíte unitária passou com 138 testes, incluindo segurança dos saltos e pontos de nascimento, pouso, chegada e checkpoints de todos os percursos.

Os três cenários de navegador passaram em 480 × 500 com toque habilitado. Cada cenário usa marcos reais, atravessa todas as valas com a física do jogo, recupera uma queda no segundo trecho, chega à casa oficial sem crédito antecipado e confirma uma única venda. O pedido já é retirado pela API na preparação; a retirada pela bancada foi validada na jornada anterior. Nenhuma resposta de progressão foi simulada.

Evidências: [rua](evidence/platform-routes/rua.png), [jardim](evidence/platform-routes/jardim.png) e [praça](evidence/platform-routes/praca.png). O Android físico permanece pendente; toque habilitado no navegador não substitui o aparelho.

A primeira execução longa foi interrompida pelo ambiente antes de terminar. Seus servidores descartáveis foram encerrados e a suíte foi dividida em três casos independentes. A execução final passou em 2,6 minutos.

Não há alterações no backend nesta etapa; a última suíte completa do servidor passou com 301 testes na publicação da jornada.

Os testes ficam em `platform-routes.isolated.spec.ts`, no projeto Playwright `routes` (API 4324, interface 5183). Esse banco é temporário e separado para que os marcos permanentes conquistados por outras suítes não alterem os cenários de rua e jardim. Execução: `E2E_STACKS=routes DISABLE_HMR=true npx playwright test tests/e2e/platform-routes.isolated.spec.ts --project=routes`.

## Publicação

Publicado em 14/10/2026 em https://novohiper.fluxos.dev.br . Imagem ativa: `sha256:2eb186c6a3e26fcc09f0e5afd3be1c53783852bf741561cddd9f190707980158`.

Container saudável, banco com integridade `ok` e migration 7. Contagens preservadas: uma planta, nove pedidos, oito entregas, nove transações. Backup imediatamente anterior: `backups/platform-routes/20261014T184303Z/`. Retorno disponível pela imagem `novo-hiper-rollback:before-platform-routes` (mesmo schema 7).

HTML, JavaScript, CSS, service worker e 13 imagens públicas conferidos por hash contra a compilação local; API pública `ok`.

A execução final no projeto isolado `routes` passou: três testes em 2,5 minutos. A praça também confirmou checkpoint, travessia e venda única. Nenhum teste ficou pendente nesta etapa.
