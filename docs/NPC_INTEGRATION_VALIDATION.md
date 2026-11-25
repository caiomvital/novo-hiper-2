# Moradores aplicados ao jogo

Os oito clientes do primeiro arco usam suas identidades visuais: Dona Maria, Seu João, Ana, Carlos, Dona Lúcia, representante da Floricultura, Seu Antônio e Bia. O nome e o endereço continuam vindo do pedido oficial. Clientes personalizados recebem uma aparência estável sem alterar sua identidade no cadastro.

Perto de Bernardo, o cliente escolhe a pose voltada para ele. Os pés ficam alinhados ao ponto de interação; a profundidade acompanha os pés. As roupas e a pele preservam as cores da arte, sem o tingimento dos bonecos provisórios. Os três vizinhos ambientais também usam a folha nova, mantendo sua progressão e seus pontos nas calçadas.

A imagem e o atlas são carregados pelo Phaser. O atlas usa recortes reais dos personagens, e o cache PWA inclui JSON além das imagens, para conservar os quadros offline. São poses paradas: há mudança de direção, mas ainda não há caminhada.

## Verificação

TypeScript e 138 testes unitários passaram. O navegador confirmou os oito IDs, suas poses, escala e nomes, e uma entrega por interação com um único crédito e o agradecimento oficial. O estoque refletiu exatamente oito entregas. As preparações e dados são de banco descartável.

Evidências: [Dona Maria](evidence/npcs/cust_dona_maria.png), [Seu João](evidence/npcs/cust_seu_joao.png), [Carlos](evidence/npcs/cust_carlos.png). Tela de 480 × 500 com toque habilitado; Android físico permanece pendente.

Backend, migrations, regras de pedido e pagamento permanecem iguais.

## Próximo marco proposto — NPCs vivos

Preparar ciclos de caminhada em quatro direções; estabelecer percursos curtos e seguros nas calçadas; fazer moradores pararem e reagirem quando Bernardo se aproxima. Clientes de entrega continuam reconhecíveis e próximos da casa correta. Critério: movimentação sem atravessar construções, bloquear entradas ou perder o ponto de entrega.

A compilação de produção passou. A imagem dos moradores e o atlas foram emitidos como assets versionados; ambos estão no precache do PWA. A versão anterior foi preservada na imagem `novo-hiper-rollback:before-npc-integration`.

## Empacotamento

A primeira imagem Docker omitiu a folha por causa da regra `*-master.png` do `.dockerignore`. A verificação por hash detectou a diferença. A versão anterior foi restaurada enquanto se preparou `moradores-v1.png`, cópia idêntica do master, para o carregamento no jogo. O master continua preservado.

## Publicação final

O pacote corrigido foi comparado antes da troca: 19 assets idênticos à compilação local, incluindo a imagem e o atlas. Publicado em 14/10/2026 em https://novohiper.fluxos.dev.br . Imagem ativa `sha256:c26eb066733e8b9a9507ac5ba9c7a11577d66b1f1112e5adaa533e826771c099`, container saudável, API `ok`.

A conferência pública passou: HTML, scripts, CSS, 14 imagens, atlas e service worker por hash; imagem e atlas estão no precache. Backup final imediatamente anterior: `backups/npc-integration/20261014T221938Z/`. Banco íntegro, migration 7, contagens preservadas: uma planta, onze pedidos, dez entregas e onze transações.
