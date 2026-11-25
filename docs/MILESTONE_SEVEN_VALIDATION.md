# Marco 7 — Mapa e destinos

Concluído em 13/10/2026: 8/8 itens, J01–J08.

Quatro cenários no navegador, 32 testes de backend e 134 testes unitários
aprovados. TypeScript sem erros e build de produção concluído.

## Correções

- O mapa de Olinda explica que é diferente do bairro fictício da Aventura.
  Pinos, trajetos e distâncias são ilustrativos: não há geocodificação real,
  navegação por ruas nem uso da localização do aparelho.
- Pedidos mantêm planta e destinatário fixos. Um destino do bairro sem ponto
  geográfico não recebe a rota de outro endereço. Continua sendo possível
  concluir o pedido pela API ou entregar na casa correspondente da Aventura.
- Após concluir, o resumo conserva o valor congelado e o destinatário da venda,
  mesmo que o catálogo tenha outro preço. Consultar outro endereço/planta ou
  dispensar o aviso volta ao modo de consulta.
- Excluir o endereço selecionado troca a seleção; excluir o último limpa a
  rota. Alterar o texto do endereço recalcula seu pino ilustrativo.
- Cadastro e edição só fecham após confirmar o armazenamento local. Se o
  navegador recusar a gravação, o formulário conserva os dados e permite repetir.
  A exclusão também conserva o registro se não puder salvar a lista atualizada.
- Nome, endereço e observações aparecem como texto nos pinos e popups.
- Falha dos mapas externos tem aviso e preserva a lista, os pedidos e o acesso
  às outras áreas.

## Cenários por item

| Item | Evidência |
| --- | --- |
| J01 | Loja, pinos e rota de um endereço geográfico disponíveis; texto diferencia Olinda e Aventura. Pedido sem ponto geográfico não recebe rota para o primeiro endereço. |
| J02 | Abrir o mapa a partir de um pedido pronto conserva o pedido, a planta e o destinatário. Clicar em outro endereço não altera o pedido. |
| J03 | Pedido de duas unidades a R$ 20, posteriormente reprecificado para R$ 99: entrega credita R$ 40, estoque 5 → 3 e uma transação. Recarga conserva saldo e estado. Falha/retentativa não duplicam a venda. |
| J04 | Consulta avulsa mostra botão desabilitado; tentar acioná-lo não faz requisição de entrega nem altera estoque/caixa. |
| J05 | Cadastro, edição, busca por nome, exclusão cancelada e confirmada. Alteração do endereço muda o pino; marcação HTML no nome permanece texto. Falha de armazenamento mantém formulário e permite retentar. |
| J06 | Remover destino selecionado remove seu pino e conserva rota para o destino restante. Remover o último deixa lista e rota vazias, inclusive após recarga. |
| J07 | Endereço personalizado reaparece após recarga no mesmo contexto e não aparece em outro navegador/contexto. Limite explicado na lista e no formulário. |
| J08 | Bloqueio de imagens do mapa externo exibe aviso; entrega oficial, catálogo e pedidos continuam acessíveis. O produto não solicita a localização do aparelho. |

## Persistência e limites

Endereços personalizados usam `novo_hiper_destinos_olinda_v1` no `localStorage`.
Não são cadastro de clientes sincronizado na API, não geram pedidos automáticos
e não se transferem para outro navegador/aparelho. Limpar os dados do site pode
apagá-los. Pedidos, estoque, caixa e entregas oficiais permanecem no servidor.

Validação em Chrome automatizado, com API e bancos descartáveis. Não houve
rodada com Bernardo nem teste em aparelho físico. O mapa externo foi bloqueado
intencionalmente; esta rodada não valida exatidão de endereços geográficos.

## Arquivos de evidência

- [Entrega pelo mapa](evidence/milestone-seven/venda-mapa.png).
- [Mapa sem destinos](evidence/milestone-seven/mapa-sem-destinos.png).
- `tests/e2e/milestone-seven.spec.ts`: três cenários do marco.
- `tests/e2e/milestone-five-map.spec.ts`: falha, espera e retentativa da venda.

## Publicação

Publicada em `https://novohiper.fluxos.dev.br` em 13/10/2026.
Imagem: `sha256:a5efc231c59f6e960a0755f8d264ee0d39539d64e3e69b5fee4bd377d0abf676`.
Container saudável, API pública respondendo e arquivos públicos conferidos
por hash, incluindo o service worker. Integridade do SQLite: `ok`.
Contagens preservadas: uma planta, quatro pedidos, três entregas e quatro
transações. Backup: `backups/milestone-seven/20261013T213738Z/`.
Imagem anterior preservada em `novo-hiper-rollback:before-milestone-seven`.
