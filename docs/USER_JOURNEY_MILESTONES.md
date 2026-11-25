# Marcos da jornada — Novo Hiper

Data: 12/10/2026. Estes marcos organizam a revisão e as correções do sistema
descritas na [checklist completa](USER_JOURNEY_CHECKLIST.md). São marcos de
trabalho do projeto; a progressão do jogador continua sendo tratada no jogo.

Os **marcos 1, 3, 4 e 5 estão concluídos na validação técnica**. O marco 2
tem **20 de 21 itens validados**, com câmera física pendente; os demais marcos
estão pendentes. Cada item da checklist pertence a um
único marco, preservando os 108 itens existentes. A ordem prioriza completar
a primeira venda, comprovar a consistência dos dados e ampliar a experiência.

| Marco | Resultado esperado | Itens | Quantidade | Depende de |
| --- | --- | --- | ---: | --- |
| 1. Entrar e entender a loja | Bernardo consegue acessar e identificar o que fazer primeiro | A01–A06, B01–B06 | 12 | — |
| 2. Preparar o catálogo | Plantas, fotos e estoque ficam prontos para vender | C01–C07, D01–D06, E01–E08 | 21 | 1 |
| 3. Receber e retirar um pedido | Um pedido válido chega à loja e pode ser retirado | F01–F08, H01–H06 | 14 | 2 |
| 4. Completar a primeira venda | Explorar o bairro, entregar e conferir estoque e caixa | G01–G07, I01–I08, K01–K05 | 20 | 3 |
| 5. Garantir continuidade e recuperação | A jornada suporta recarga, falhas e uso simultâneo sem perder consistência | P01–P07 | 7 | 4 |
| 6. Melhorar a loja e avançar no bairro | Comprar, instalar e reconhecer os efeitos da progressão | L01–L07, M01–M06 | 13 | 5 |
| 7. Validar mapa e destinos | Entender os destinos e concluir o fluxo pelo mapa | J01–J08 | 8 | 5 |
| 8. Validar a fase de plataforma | Jogar a fase, recuperar-se e retornar ao bairro | N01–N06 | 6 | 4 |
| 9. Fechar a experiência no celular | Completar a jornada com toque, telas pequenas e instalação PWA | O01–O07 | 7 | 5, 6, 7 e 8 |

## Marco 1 — Entrar e entender a loja

Validar login, sessão, saída, estados vazios e orientação inicial. Ajustar os
textos para que Bernardo reconheça as ações sem depender de explicações externas.

**Concluído quando:** acesso e saída funcionam, a sessão tem comportamento claro
e o usuário sabe onde cadastrar uma planta e iniciar uma entrega.

## Marco 2 — Preparar o catálogo

**Estado:** implementado, 20/21 itens validados. D02 aguarda conferência no
celular físico. [Correções e evidências](MILESTONE_TWO_VALIDATION.md).

Validar cadastro, câmera/acervo, edição, busca, reposição e exclusão. Conferir
persistência e respostas a entradas inválidas ou falhas de upload.

**Concluído quando:** uma planta de teste com foto, preço de R$ 20 e estoque de
5 unidades reaparece corretamente após recarregar; editar e excluir mantêm os
dados e o histórico coerentes.

## Marco 3 — Receber e retirar um pedido

**Estado:** concluído, 14/14 itens validados em 13/10/2026.
[Correções e evidências](MILESTONE_THREE_VALIDATION.md).

Validar geração do pedido, disponibilidade de estoque, estados do pedido e
retirada no interior do Novo Hiper. Conferir identificação da planta e do cliente.

**Concluído quando:** o usuário recebe um pedido válido, encontra a bancada e
sai da loja carregando a planta certa para o destino indicado.

## Marco 4 — Completar a primeira venda

**Estado:** concluído, 20/20 itens validados em 13/10/2026.
[Correções e evidências](MILESTONE_FOUR_VALIDATION.md).

Validar movimento, orientação no bairro, entrega na casa correta e atualização
do caixa. Conferir recusas no destino errado e proteção contra entrega repetida.

**Concluído quando:** uma única entrega da planta de teste reduz o estoque de
5 para 4, acrescenta R$ 20 ao saldo inicial e cria uma única venda no histórico;
os valores continuam corretos após recarregar.

Este é o primeiro marco com uma jornada completa: entrar → cadastrar → receber
pedido → retirar → entregar → conferir o resultado.

## Marco 5 — Garantir continuidade e recuperação

**Estado:** concluído, 7/7 itens validados em 13/10/2026.
[Correções e evidências](MILESTONE_FIVE_VALIDATION.md).

Validar falhas de rede, resposta lenta, tentativas repetidas, recarga e uso em
mais de uma aba/sessão. Confrontar o que a interface mostra com os dados salvos.

**Concluído quando:** os cenários P01–P07 passam, operações falhas não parecem
concluídas e novas tentativas não duplicam vendas, débitos ou créditos.

Executar os cenários de falha relevantes desde os marcos anteriores. Este marco
consolida a revisão; ele não adia a correção de problemas críticos encontrados.

## Marco 6 — Melhorar a loja e avançar no bairro

**Estado:** concluído, 13/13 itens validados em 13/10/2026.
[Correções e evidências](MILESTONE_SIX_VALIDATION.md).

Validar compra e instalação de melhorias, saldo insuficiente, desbloqueio de
moradores e mudanças visíveis do bairro. Conferir permanência após nova sessão.

**Concluído quando:** comprar e instalar produzem os efeitos previstos, cobram
uma única vez e os desbloqueios refletem os critérios documentados de progressão.

## Marco 7 — Validar mapa e destinos

**Estado:** concluído, 8/8 itens validados em 13/10/2026.
[Correções e evidências](MILESTONE_SEVEN_VALIDATION.md).

Validar navegação pelo mapa, seleção/cadastro de destinos e entrega por esse
fluxo. Conferir a consistência com pedidos, estoque, caixa e histórico.

**Concluído quando:** o usuário entende a relação entre o mapa e o bairro do
jogo; destinos e entregas têm comportamento claro e persistência conforme o
escopo definido, sem resultados divergentes entre os fluxos.

## Marco 8 — Validar a fase de plataforma

**Estado:** concluído, 6/6 itens validados em 14/10/2026.
[Correções e evidências](MILESTONE_EIGHT_VALIDATION.md).

Validar entrada, controles, obstáculos, recuperação e retorno ao bairro.
Revisar a comunicação do objetivo e do resultado da fase.

**Concluído quando:** a fase pode ser concluída e abandonada sem travar a jornada,
e retornar ao bairro preserva o pedido e os dados. O resultado deve corresponder
ao comportamento atual: terminar a fase não registra uma venda automaticamente.

## Marco 9 — Fechar a experiência no celular

**Estado:** 5/7 itens validados tecnicamente em 14/10/2026. O02 e O06
aguardam teclado nativo e instalação em aparelho físico.
[Correções e roteiro físico](MILESTONE_NINE_VALIDATION.md).

Validar legibilidade, toque, formulários, câmera, orientação da tela, instalação
PWA e comunicação sobre conexão. Repetir a jornada principal no celular.

**Concluído quando:** os itens O01–O07 passam e o usuário consegue completar
a primeira venda e instalar uma melhoria no celular, sem controles inacessíveis
ou confirmação falsa de operações sem conexão.

## Regra para encerrar cada marco

- Executar todos os itens associados e registrar resultado/evidência na checklist.
- Corrigir falhas e repetir os cenários afetados antes de marcar os itens.
- Não encerrar com item P0 aberto ou falha que impeça o resultado esperado.
- Se um item sair do escopo, registrar a decisão e a limitação explicitamente;
  não marcá-lo como aprovado sem execução.

Os marcos 6, 7 e 8 podem avançar separadamente após suas dependências. A revisão
no celular começa desde o primeiro marco e termina com a rodada completa do 9.
Não há estimativas de prazo nesta divisão.

## Acompanhamento

| Marco | Estado | Evidência / pendência |
| --- | --- | --- |
| 1 | Concluído | [Validação e evidências](MILESTONE_ONE_VALIDATION.md), 12/10/2026; sem rodada de uso com Bernardo. |
| 2 | 20/21 validados | [Correções e evidências](MILESTONE_TWO_VALIDATION.md); câmera no celular físico pendente (D02). |
| 3 | Concluído | [Validação e evidências](MILESTONE_THREE_VALIDATION.md), 13/10/2026. |
| 4 | Concluído | [Validação e evidências](MILESTONE_FOUR_VALIDATION.md), 13/10/2026. |
| 5 | Concluído | [Validação e evidências](MILESTONE_FIVE_VALIDATION.md), 13/10/2026. |
| 6 | Concluído | [Validação e evidências](MILESTONE_SIX_VALIDATION.md), 13/10/2026. |
| 7 | Concluído | [Validação e evidências](MILESTONE_SEVEN_VALIDATION.md), 13/10/2026. |
| 8 | Concluído | [Validação e evidências](MILESTONE_EIGHT_VALIDATION.md), 14/10/2026. |
| 9 | 5/7 validados | [Correções e evidências](MILESTONE_NINE_VALIDATION.md); teclado nativo e instalação em celular físico pendentes (O02/O06). |
