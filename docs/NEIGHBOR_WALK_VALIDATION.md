# Marco: NPCs vivos no bairro

Ana, Carlos e Bia percorrem rotas curtas de ida e volta perto da Novo Hiper, a 28px/s, com espera nas extremidades. A população continua derivada de `primeira_melhoria`, `vizinhos_2` e `vizinhos_3`; nenhum desbloqueio novo foi criado.

Ao chegar a menos de 100px, Bernardo recebe o olhar do morador, que para. O passeio retoma após 132px, evitando alternância brusca perto do limite. Painéis abertos e confirmação de entrega pausam os passeios. O delta é limitado para evitar saltos ao retornar à aba.

Os moradores não têm corpos físicos, portanto não bloqueiam o jogador. As rotas mantêm os pés nas calçadas, os corpos fora dos sólidos e distância superior a 80px das portas/pontos de entrega. Quando a aparência do cliente ativo corresponde a um dos passeantes, o passeante fica oculto: o cliente continua na casa oficial, sem se deslocar.

Arte integrada: `final-assets/npcs/moradores-walk-v1.png` e `moradores-walk-v1-atlas.json`, 24 poses, preservando a folha original para as poses paradas. Geração e prompt em `final-assets/npcs/WALK_GENERATION.md`. Atlas obtido das 24 silhuetas reais, sem pressupor células de tamanho uniforme. A animação intercala duas poses de passo e a pose neutra; alinhamento pelos pés e profundidade seguem a posição atual.

Testes unitários: rotas completas contra sólidos/calçadas/portas/destinos, aproximação e histerese, retomada após grande delta, pausa e muitas voltas sem extrapolar as pontas. Suíte completa: 141 testes em 18 arquivos passaram. TypeScript passou.


Validação no navegador: `neighbor-walk.routes.isolated.spec.ts`, 1 passou em 45,7s (40,2s de teste), viewport 480×500 com toque. Verificados passos reais no atlas, deslocamento, olhar e parada, retomada, pausa em painel, exclusão da duplicata de Ana quando cliente, posição real na casa e recriação após entrar/sair da loja. Estoque e caixa não mudaram durante a visita. Evidência: `docs/evidence/neighbor-walk/olha-para-bernardo.png`.

A execução inicial foi interrompida pelo ambiente; a repetição revelou a necessidade de escolher o eixo predominante ao olhar para Bernardo, corrigida e coberta no teste unitário (inclusive com deslocamento horizontal de 1px). Os ajustes seguintes foram do roteiro: resolver endereço legado do cliente com `resolveDestination` e afastar Bernardo da porta interna para rearmar a saída. Nenhuma proteção das portas foi removida. Após a correção, os três testes de passeios passaram novamente; TypeScript final passou.

Builds host e Docker passaram. Comparação antes da publicação: 21 assets idênticos, incluindo as duas folhas e os dois atlas dos NPCs. Publicado em 15/10/2026 às 19:22 UTC em https://novohiper.fluxos.dev.br. Imagem `sha256:b3ca74e2e646b8cb59f6bd1d4d92fe6032ebe14bb95a437aec3336c2da818f0e`, container saudável. Health, index, JS/CSS, 15 imagens, dois atlas e service worker conferidos no endereço público, com hashes iguais ao build.

Backup: `backups/neighbor-walk/20261015T192220Z/`. SQLite íntegro antes/depois; 1 planta, 14 pedidos, 13 entregas e 14 lançamentos preservados. Rollback: `novo-hiper-rollback:before-neighbor-walk`.

Não houve teste físico em Android; o teste de navegador usa emulação de toque. Cinco identidades permanecem somente como clientes parados: este marco anima os três moradores ambientais existentes.
