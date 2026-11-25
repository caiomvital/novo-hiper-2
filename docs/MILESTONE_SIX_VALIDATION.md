# Marco 6 — Melhorar a loja e avançar no bairro

Concluído em 13/10/2026: 13/13 itens, L01–L07 e M01–M06.

Verificações: 11 cenários no navegador, 83 testes de backend e 134 testes
unitários aprovados; TypeScript sem erros.

## Correções

- O bairro consulta a progressão após operações confirmadas, inclusive a
  instalação. Também atualiza ao reconectar, retornar à janela, receber aviso
  de outra aba e a cada 10 segundos enquanto visível. Uma resposta antiga não
  substitui a consulta mais recente; falhas conservam o estágio confirmado.
- O painel explica a volta à Novo Hiper: entrar na loja e instalar no balcão.
  A confirmação da compra usa a mesma orientação.

## Cenários

| Itens | Conferência |
| --- | --- |
| L01–L02 | Painel aberto por teclado e controle de toque; catálogo com placa R$ 60, jardineiras R$ 90 e banco R$ 120; estados disponíveis, comprados e instalados. |
| L03–L04 | Compra sem saldo informa a diferença e não grava débito; clique duplo, repetição e concorrência produzem uma aquisição e uma cobrança. |
| L05–L06 | Compra deixa melhoria pendente, sem visual instalado; instalação no balcão muda a fachada e persiste após reentrada e recarga. Repetir preserva saldo e data da instalação. |
| L07 | Painel suspende movimento; Escape e botão de fechar devolvem os controles. |
| M01–M02 | API real gera pedidos iniciais somente para Dona Maria, Seu João e Ana nas casas do roster. Grupo 2 exige primeira melhoria instalada e três entregas; grupo 3 exige duas melhorias instaladas, seis entregas e duas plantas cadastradas historicamente. Pedidos dos novos grupos usam suas casas. |
| M03 | Instalação atualiza vizinhos sem recarga; grupo 2 mostra dois vizinhos; grupo 3 mostra três e obra ativa. Dez entregas, quatro casas, três plantas históricas e três melhorias instaladas levam à obra quase pronta. |
| M04 | Marcos e datas permanecem ao gastar saldo, excluir plantas, recarregar e reiniciar o servidor. |
| M05–M06 | HUD continua com saldo e orientação da entrega, sem níveis ou contadores de progressão. Obra e vizinhos representam os marcos oficiais; colisão impede atravessar a barreira nos estágios ativo e quase pronto. |

## Evidências

- [Vizinhos e placa instalada](evidence/milestone-six/vizinhos.png).
- [Obra ativa](evidence/milestone-six/obra-ativa.png).
- [Obra quase pronta](evidence/milestone-six/obra-quase-pronta.png).
- `tests/e2e/shop.isolated.spec.ts`: jornada das três melhorias.
- `tests/e2e/milestone-six.spec.ts`: toque, instalação, estágios, barreira e recarga.
- `tests/backend/shop.test.ts`, `progress.test.ts` e `order-generation.test.ts`:
  regras, idempotência, concorrência, moradores e permanência.
- `tests/unit/worldProgressSync.test.ts`: atualização confirmada, outra aba,
  reconexão, resposta antiga, falha e limpeza ao desmontar.

## Limites

Chrome automatizado e bancos descartáveis; não houve rodada com Bernardo nem
teste em celular físico. Toque foi exercitado em contexto de navegador com
suporte a toque. Banco e jardineiras mantêm os visuais provisórios existentes.
As obras não abrem uma nova região nesta versão.

## Publicação

Publicada em `https://novohiper.fluxos.dev.br` em 13/10/2026.
Imagem: `sha256:26c75013b0bf4cdce38662a9359907cf87e513d5eea37d2f197a59fa8c59a279`.
Container em execução e saudável. Integridade do SQLite: `ok`; contagens
preservadas: uma planta, quatro pedidos, três entregas e quatro transações.
Backup: `backups/milestone-six/20261013T175129Z/`; imagem anterior preservada
em `novo-hiper-rollback:before-milestone-six`.
