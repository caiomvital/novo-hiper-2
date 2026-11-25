# Marco 3 — Pedido e retirada na loja

Data: 13/10/2026. **Concluído na validação técnica: 14/14 itens**.
Escopo: F01–F08 e H01–H06 da [checklist](USER_JOURNEY_CHECKLIST.md).

## Correções realizadas

- Preparar e marcar como pronto aguardam a API e a leitura do estado confirmado.
  Durante o envio, os botões ficam bloqueados. Falhas mostram uma mensagem e
  permitem repetir; sons de confirmação só tocam após sucesso.
- Consultas da lista iniciadas antes de uma mudança de estado não sobrescrevem
  o preparo confirmado com uma resposta antiga.
- A lista verifica pedidos e estoque a cada 10 segundos enquanto está aberta
  e visível. O próximo pedido aparece após a venda e o intervalo do servidor,
  sem botão de geração manual. Consultas não se sobrepõem nem competem com preparo.
- “Continuar na Aventura” abre o jogo. A rota pelo mapa continua disponível
  como uma ação separada, com rótulo coerente.
- Falta de estoque considera a quantidade exigida e o indicador oficial do
  servidor. A API também recusa marcar como pronto sem estoque. O pedido segue
  aberto, com o preço recebido preservado, até repor a planta.
- Pedidos entregues não podem ser reabertos por uma atualização concorrente.
- A bancada mostra “Pegando a planta… Aguarde a confirmação”, bloqueia retirada
  repetida e informa falhas com orientação para tentar novamente.
- Retirada confirmada atualiza o pedido e as outras telas. O item carregado
  é recuperado do estado oficial ao sair, voltar e recarregar.
- Entregas iniciadas deixam de aparecer como entregas feitas no painel.
  Retirar o vaso não baixa estoque nem credita o caixa.

## Evidências por item

| Itens | Resultado |
| --- | --- |
| F01/F02 | Planta com preço R$ 20 e estoque 5 gera pedido automático com cliente/destino, planta, quantidade 1 e valor 20; tela identifica o próximo passo. Botão de pedido pronto abre a Aventura. |
| F03 | Filtros Recebidos, Em Preparo, Prontos e Entregues correspondem aos estados oficiais, inclusive após o próximo pedido. Todos mantém o histórico e a lista completa. |
| F04 | Preparo lento conserva “Recebido” até confirmação; falha de pronto conserva “Preparando” e permite repetir. Recarga preserva “Pronto”. Resposta de consulta antiga não desfaz o preparo. |
| F05 | Verificações simultâneas, recarga e reabertura preservam um único pedido automático ativo. |
| F06/F07 | Alterar preço de 20 para 99 não muda o pedido recebido; estoque zero mantém o mesmo pedido e bloqueia início de entrega. Reposição libera sem criar pedido substituto. |
| F08 | Após finalizar pela API oficial, a própria lista pede a verificação e exibe o próximo pedido; nenhum comando manual de geração é usado nesse cenário. |
| H01 | Entrada e saída pela porta retornam a posição segura, sem reentrada automática ou duplicação de cena. |
| H02 | Balcão abre pedidos; prateleira e estoque abrem catálogo. |
| H03/H04 | Bancada retira a planta do pedido, mostra espera/confirmação e não duplica registro com interação repetida. Estoque e caixa permanecem iguais; retirada não entra na lista de entregas feitas. |
| H05 | Sem pedido ou sem estoque, a bancada orienta e não entrega item. Retirada com falha mostra mensagem e permite nova tentativa. |
| H06 | Sair, voltar e recarregar preservam a planta carregada e o pedido pronto no servidor. |

Capturas: [pedido pronto](evidence/milestone-three/pedido-confirmado.png) e
[retirada confirmada](evidence/milestone-three/retirada-confirmada.png).

## Verificação e limites

- `npm run lint`: aprovado.
- `npm run test:backend -- --maxWorkers=2`: **298 testes aprovados em 14 arquivos**.
- Playwright: **13 cenários distintos aprovados** entre `interior.spec.ts`,
  `milestone-three.spec.ts` e `milestone-three-orders.isolated.spec.ts`.
  A retirada lenta foi repetida após a correção da contagem de entregas feitas.
- `npm run build`: aprovado, com geração do PWA. Permanece o aviso de tamanho
  dos bundles; não houve erro de compilação.

Testes usam Chromium e APIs reais com bancos descartáveis em `/tmp`; geração
automática fica ligada no grupo `orders` e desligada no grupo `general`.
Respostas lentas, erros e uma consulta antiga são simulados no navegador.
Os testes do interior posicionam Bernardo junto às portas/móveis por diagnóstico
e usam as ações reais do jogo. A revisão dos caminhos caminhando pelo bairro
pertence ao marco 4.

O modelo atual usa `pronto` também para representar a planta retirada: marcar
pronto pelo painel e retirar na bancada levam ao mesmo estado persistente.
Nenhuma venda ocorre apenas por preparar/retirar. O teste de F08 finaliza uma
entrega pela API para verificar a chegada do próximo pedido; não aprova a jornada
visual completa de entrega, que será executada no marco 4.

Não houve rodada de uso com Bernardo. A câmera física do marco 2 continua
pendente (D02); este trabalho não alterou esse resultado.

## Publicação

- Backup íntegro de banco e uploads: `backups/milestone-three/20261013T133521Z/`.
- Rollback preservado: `novo-hiper-rollback:before-milestone-three`.
- Sem migração de schema; volumes `data` e `uploads` preservados.
- Imagem publicada: `sha256:eb0ff490d6d103e51891d1a6eba5dd2090a882392fe94b358d59593814508234`.
- Site `https://novohiper.fluxos.dev.br` conferido: container `healthy`, API
  saudável, bundles e 13 imagens iguais ao build local, service worker atualizado.
  Banco íntegro; plantas, pedidos, entregas e caixa preservados. Nenhum login ou
  operação de teste foi realizado com os dados de produção.

## Próximo marco

Marco 4: explorar o bairro, entregar na casa correta e conferir estoque,
caixa e histórico após a primeira venda.
