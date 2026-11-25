# NPC após retirada da planta

## Causa e correção

Ao recriar `WorldScene`, os objetos gráficos eram novos, mas `placedFor` conservava o destino da visita anterior. Como o pedido continuava na mesma casa, `placeDestination` pulava a posição, a profundidade e os marcadores do NPC novo. O sprite permanecia no ponto padrão, podendo desaparecer da casa esperada ou ficar sob outros elementos do cenário.

A criação da cena agora limpa `placedFor`, `destination` e a referência do tween antigo. O snapshot oficial reaplica a casa e a profundidade do cliente em toda reentrada, mantendo o cache para as atualizações normais da mesma visita.

O diagnóstico passou a expor posição e profundidade do sprite real. Antes, `delivery.customer` indicava apenas o alvo lógico da entrega, o que não detectava a diferença entre o lugar correto e a imagem exibida.

## Validação

TypeScript passou. O teste de regressão usa uma casa diferente do ponto padrão e verifica textura, visibilidade, coordenadas e profundidade do sprite real antes da retirada, depois de pegar a planta na bancada e sair, após abandonar a plataforma e após concluir o percurso. A entrega por interação credita uma única venda; retirada e percurso preservam saldo e estoque.

Execução em tela 480 × 500 com toque habilitado, banco descartável: passou em 1,3 minuto. [Evidência após retirar](evidence/npc-pickup/apos-retirar.png). Android físico não foi testado nesta etapa.

Não há alteração no backend, no estoque, nos pedidos ou nas regras financeiras.

A captura final aguarda o NPC entrar no enquadramento da câmera após o deslocamento do teste. A execução completa passou novamente em 1,4 minuto.

## Publicação

Publicado em 14/10/2026 em https://novohiper.fluxos.dev.br . Imagem ativa `sha256:f259bcc6bdd8418831f6bea956b2188c80a859d42769de8202de6d0cf6bfb958`. Antes da publicação, 19 assets da imagem Docker foram comparados à compilação local. Após publicar, HTML, scripts, CSS, 14 imagens, atlas e service worker passaram na conferência por hash; aplicação saudável.

Backup imediatamente anterior: `backups/npc-pickup-fix/20261014T231348Z/`. Banco com integridade `ok` e contagens preservadas: uma planta, doze pedidos, onze entregas e doze transações. Retorno por `novo-hiper-rollback:before-npc-pickup-fix`.
