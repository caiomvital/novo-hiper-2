# Interior da Novo Hiper — volume e leitura

## Resultado

O interior recebeu piso de madeira com juntas alternadas, paredes verdes com rodapé, tapete de entrada e sombras. Prateleiras, estoque, balcão e preparo têm tampo, frente e lateral; vasos, gavetas, livro de pedidos e caixa ajudam a reconhecer cada função.

Móveis e Bernardo usam a posição dos pés para a sobreposição. As placas pertencem aos móveis e podem ser cobertas pelo personagem quando ele está à frente. A planta carregada acompanha a mesma camada de Bernardo.

O desenho conserva a planta baixa, as colisões e os pontos de interação. Não altera o catálogo, estoque, caixa ou pedidos. Não foram adicionadas imagens raster: o desenho usa gráficos do próprio Phaser e a arte existente do personagem.

## Aviso em telas pequenas

Na revisão visual, o aviso de preparo manteve a posição antiga após reduzir a tela, ficando parcialmente cortado e perto dos controles. Agora recalcula posição e quebra de linhas ao redimensionar. Em telas pequenas fica abaixo do caixa e acima dos controles; em telas largas permanece na parte inferior central. A dica de teclado ocupa apenas telas com espaço suficiente.

## Validação

TypeScript e 138 testes unitários passaram. O navegador verificou colisão pelos dois lados do balcão, retirada real do pedido após reduzir de 740 × 580 para 480 × 500 e retorno ao bairro mantendo o pedido. A retirada não debitou estoque nem creditou saldo.

Evidências: [interior geral](evidence/interior-art/interior-geral.png), [atrás do balcão](evidence/interior-art/balcao-por-tras.png) e [preparo no celular](evidence/interior-art/preparo-celular.png). Toque habilitado no navegador; Android físico não foi testado nesta etapa.

Backend e migrations permanecem iguais. A última suíte completa do servidor passou com 301 testes na publicação da jornada.

A verificação final após corrigir o aviso passou: além de repetir colisão e retirada, o teste conferiu os limites do texto na tela reduzida e sua distância dos controles. O aviso fica totalmente visível após a mudança de tamanho.

A posição do aviso é aplicada após criar todos os textos da visita atual, para não atualizar um texto destruído ao voltar à loja.

O roteiro de reentrada precisou respeitar a proteção já existente da porta: depois de sair, Bernardo se afasta antes de voltar. A primeira tentativa sem afastamento excedeu o tempo do teste; a regra do jogo foi preservada e o roteiro passou a caminhar antes de reentrar.

A execução final com reentrada passou em 1,4 minuto: colisões, retirada, aviso dentro da tela, saída, afastamento, volta à loja e planta ainda carregada. TypeScript e a compilação de produção passaram após o ajuste de criação dos textos.

## Publicação

Publicado em 14/10/2026 em https://novohiper.fluxos.dev.br . Imagem ativa `sha256:d34875f3b91d6d9386b6ec06be842dcd256fbf80026bda0913b2ca786a239f61`. Container saudável, API pública `ok`; HTML, JavaScript, CSS, service worker e 13 imagens conferidos por hash.

Banco com integridade `ok`, migration 7 e contagens preservadas: uma planta, nove pedidos, oito entregas e nove transações. Backup imediatamente anterior: `backups/interior-art/20261014T201047Z/`. Retorno disponível por `novo-hiper-rollback:before-interior-art`.
