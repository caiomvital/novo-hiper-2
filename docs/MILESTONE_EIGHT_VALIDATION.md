# Marco 8 — Fase de plataforma

Concluído em 14/10/2026: 6/6 itens, N01–N06.

18 cenários distintos no navegador e 134 testes unitários aprovados.
Os dois cenários novos também passaram em tela cheia; evidências visuais
conferidas. TypeScript sem erros e build de produção concluído.

## Correções

- A fase comunica que é um treino de saltos. O marcador final diz “Fim do
  percurso”, e a confirmação informa que nenhuma venda foi registrada.
- O botão “Voltar ao bairro” permite abandonar a fase antes de concluir.
  Usa o ponto de retorno já guardado pelo bairro, suspende os controles durante
  a transição e evita disparos repetidos.
- Enter repetido não confirma a conclusão; seu listener é removido ao sair
  da cena. Espaço já exige soltar e apertar novamente após o atraso de proteção.
- A orientação cita teclado e toque, com quebra de linha. Ao concluir, a
  orientação inicial some para deixar a confirmação legível.

## Cenários

| Item | Conferência |
| --- | --- |
| N01 | Entrada pelo bairro percorrida com controles reais; instruções de setas/A/D, Espaço e toque na fase. |
| N02 | Esquerda, direita, salto e aterrissagem; animações idle, caminhada, salto e comemoração. Collider preservado, sem salto duplo. Controles de toque exercitados em contexto com suporte a toque. |
| N03 | Queda real na vala e queda abaixo do limite recuperam em checkpoint seguro. Depois de cair, é possível atravessar o percurso completo. |
| N04 | Conclusão permite voltar por Espaço, Enter e botão do canvas. Retorno fica fora da entrada, sem ciclo automático, tanto pela borda norte quanto pela sul. Saída antes de concluir também retorna ao bairro. |
| N05 | Espaço segurado e Enter repetido não pulam a confirmação. Após soltar e pressionar de novo, retorno funciona. Afastar-se rearma a entrada para outra visita. |
| N06 | Com pedido já retirado, comparação de plantas, pedidos, entregas e caixa antes/depois da conclusão e abandono permanece idêntica. Recarga recupera o mesmo pedido pronto, sem baixa, crédito ou venda por concluir o treino. |

## Evidências

- `tests/e2e/adventure.spec.ts`: percurso real, controles, quedas, confirmação e reentradas.
- `tests/e2e/sprites.spec.ts`: animações e collider do sprite de plataforma.
- `tests/e2e/milestone-eight.spec.ts`: toque, Enter repetido, saída e dados oficiais.
- [Controles de toque](evidence/milestone-eight/controles-toque.png).
- [Percurso concluído](evidence/milestone-eight/percurso-concluido.png).

## Limites

Chrome automatizado, API real e bancos descartáveis. O percurso completo e as
quedas usam movimento real; cenários de confirmação e preservação usam teleporte
de diagnóstico para alcançar o marcador. Não houve rodada com Bernardo nem em
celular físico. O treino não é uma entrega e não modifica os dados da loja.

## Publicação

Publicada em `https://novohiper.fluxos.dev.br` em 14/10/2026.
Imagem: `sha256:16fd7563570bae23b87d65e80828d33a58aed4096a74a771a640e8f0faff1052`.
Container saudável e arquivos públicos conferidos por hash, incluindo o service
worker. Integridade do SQLite: `ok`; contagens preservadas: uma planta,
quatro pedidos, três entregas e quatro transações.
Backup: `backups/milestone-eight/20261014T104522Z/`.
Imagem anterior em `novo-hiper-rollback:before-milestone-eight`.

## Evolução posterior

A plataforma passou a conduzir pedidos retirados à casa oficial do cliente; veja [validação da jornada](GAME_JOURNEY_VALIDATION.md). A chegada continua sem crédito automático: a venda exige confirmação de entrega.
