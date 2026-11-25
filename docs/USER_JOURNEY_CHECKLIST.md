# Checklist da jornada completa — Novo Hiper

Data: 12/10/2026. Escopo: sistema atual de loja de plantas e jogo Aventura.

Ordem de execução: [marcos da jornada](USER_JOURNEY_MILESTONES.md), com objetivos,
dependências e critérios de conclusão para os 108 itens desta checklist.

Usuário principal: Bernardo, administrando a loja e fazendo entregas; adulto
responsável pode ajudar no cadastro e no uso do sistema. O caixa é virtual e
as vendas são lúdicas. Não há checkout com pagamento real nesta jornada.

Esta é uma checklist de revisão do produto e validação, não uma lista de
missões a ser colocada na interface do jogador. A01–A06 e B01–B06 foram
concluídos na validação técnica e revisão textual do marco 1. C01–C07,
D01/D03–D06 e E01–E08 foram validados no marco 2; D02 aguarda câmera física.
F01–F08 e H01–H06 foram validados no marco 3.
G01–G07, I01–I08 e K01–K05 foram validados no marco 4; P01–P07 no marco 5.
L01–L07 e M01–M06 foram validados no marco 6 ([evidências](MILESTONE_SIX_VALIDATION.md)).
J01–J08 foram validados no marco 7 ([evidências](MILESTONE_SEVEN_VALIDATION.md)).
N01–N06 foram validados no marco 8 ([evidências](MILESTONE_EIGHT_VALIDATION.md)).
O01/O03–O05/O07 foram validados no marco 9 ([evidências e pendências físicas](MILESTONE_NINE_VALIDATION.md)).
O02/O06 e D02 aguardam verificação em aparelho físico. A leitura do código e a existência de testes não equivalem a uma
aprovação manual da jornada completa com Bernardo.

Marcar `[x]` somente após executar o cenário e conferir o resultado. Registrar
falhas na tabela ao final. Itens **P0** protegem acesso, dados, estoque e dinheiro;
os demais cobrem o fluxo principal e a clareza de uso. Executar cadastros,
compras, exclusões e entregas de teste em dados descartáveis, sem alterar a loja
real apenas para preencher esta checklist.

## 1. Acesso e sessão

- [x] A01 **P0** — Entrar com credenciais válidas abre a loja com seus dados.
- [x] A02 — Credenciais incorretas mostram orientação clara e permitem tentar novamente.
- [x] A03 — Campos vazios, envio repetido e resposta lenta não travam a tela nem duplicam o envio.
- [x] A04 **P0** — Recarregar e fechar/reabrir o navegador mantém a sessão enquanto ela for válida.
- [x] A05 **P0** — Sessão expirada volta ao acesso; operações protegidas não aparecem como concluídas.
- [x] A06 **P0** — Sair encerra o acesso; o botão voltar não permite continuar operando como autenticado.

## 2. Primeiro contato e orientação

- [x] B01 — A primeira tela deixa claro onde cadastrar plantas e onde começar a jogar.
- [x] B02 — Catálogo vazio oferece uma ação para cadastrar a primeira planta.
- [x] B03 — Pedidos sem catálogo explicam que é preciso cadastrar plantas.
- [x] B04 — Aventura diferencia sem plantas, plantas sem estoque e ausência momentânea de pedidos.
- [x] B05 — Navegar entre Catálogo, Pedidos, Entregas, Aventura e Caixa mantém o contexto compreensível.
- [x] B06 — Nomes, textos e instruções são compreensíveis para uma criança de 8 anos.

## 3. Cadastro de plantas

- [x] C01 — Cadastrar nome, fotografia, preço e quantidade cria uma planta visível no catálogo.
- [x] C02 — Espécie e indicação de cuidados podem ser preenchidas sem bloquear campos opcionais vazios.
- [x] C03 — Nome vazio, preço inválido/negativo, estoque inválido/negativo e falta de foto impedem salvar com mensagem específica.
- [x] C04 — Preço com vírgula, centavos, preço zero e estoque zero têm comportamento consistente entre formulário e servidor.
- [x] C05 — Estoque fracionário não é silenciosamente aceito como outra quantidade.
- [x] C06 **P0** — Salvar duas vezes ou receber uma resposta lenta não cria plantas duplicadas; recarregar confirma a persistência.
- [x] C07 — Cancelar ou fechar o formulário não cadastra uma planta incompleta.

## 4. Fotografias

- [x] D01 — Escolher uma foto do dispositivo mostra prévia e salva a imagem correta.
- [ ] D02 — Usar a câmera no celular funciona; cancelar a câmera permite continuar.
- [x] D03 — Selecionar uma fotografia do acervo associa a imagem à planta certa.
- [x] D04 — Arquivo inválido, imagem grande, permissão negada e falha de upload produzem orientação útil.
- [x] D05 **P0** — Uma falha no upload não gera confirmação falsa de foto salva; tentar novamente funciona.
- [x] D06 — Fotos continuam carregando após recarregar e em outra sessão; imagem indisponível não quebra a tela.

## 5. Catálogo, edição e estoque

- [x] E01 — Buscar por nome e espécie encontra as plantas; busca sem resultado oferece uma saída clara.
- [x] E02 — Abrir detalhes mostra foto, nome, preço, cuidados e estoque coerentes com o catálogo.
- [x] E03 **P0** — Editar nome, preço e foto persiste após recarregar e sair/entrar.
- [x] E04 **P0** — Repor estoque libera pedidos/entregas possíveis; diminuir estoque nunca o torna negativo.
- [x] E05 — Baixo estoque e estoque zerado são legíveis e orientam o próximo passo.
- [x] E06 **P0** — Excluir exige confirmação; cancelar mantém a planta; confirmar remove do catálogo sem apagar o histórico de vendas.
- [x] E07 **P0** — Excluir ou alterar uma planta com pedido aberto tem mensagem e tratamento coerentes; não permite venda impossível.
- [x] E08 — Remover a última planta deixa a loja realmente vazia após recarregar, sem ressuscitar dados do navegador.

## 6. Recebimento e preparação de pedidos

- [x] F01 **P0** — Com planta e estoque disponíveis, o servidor gera um pedido com cliente, número, planta, quantidade e valor corretos.
- [x] F02 — A tela permite identificar quem pediu, o que pediu, o estado atual e o próximo passo.
- [x] F03 — O contador e os filtros Todos, Recebidos, Preparando, Prontos e Entregues correspondem aos pedidos exibidos.
- [x] F04 **P0** — Preparar e marcar como pronto persistem; falha no servidor não é apresentada como mudança definitiva.
- [x] F05 **P0** — A capacidade atual de um pedido ativo é respeitada ao recarregar, reabrir ou repetir verificações.
- [x] F06 **P0** — Alterar o preço da planta não muda o valor de um pedido já recebido.
- [x] F07 **P0** — Reduzir o estoque abaixo da necessidade mantém o pedido aberto e orienta reposição; não cria outro pedido para contornar a falta.
- [x] F08 — Após a entrega, o próximo pedido aparece quando as regras permitem, sem exigir um botão de geração manual.

## 7. Entrada na Aventura e exploração

- [x] G01 — Abrir a Aventura apresenta Bernardo, bairro, controles e orientação do pedido atual.
- [x] G02 — Setas/WASD e controles de toque permitem andar, parar e interagir sem movimento preso.
- [x] G03 — A câmera acompanha o personagem; redimensionar e usar tela cheia mantêm posição e pedido.
- [x] G04 — Casas, loja, árvores sólidas, fonte e limites do bairro impedem atravessar áreas bloqueadas.
- [x] G05 — Portas, entradas e caminhos são reconhecíveis; sombras, telhados e sobreposição não escondem ações importantes.
- [x] G06 — Trocar de aba e voltar não duplica o jogo, os controles, os sons ou a entrega.
- [x] G07 — Sem pedido, o bairro permanece explorável e nenhuma entrega é disparada.

## 8. Interior da Novo Hiper e retirada da planta

- [x] H01 — Entrar pela porta abre o interior; sair retorna a uma posição segura sem entrar de novo automaticamente.
- [x] H02 — Balcão leva aos pedidos; prateleira/estoque levam ao catálogo; os atalhos deixam claro para onde levam.
- [x] H03 — A bancada permite retirar a planta do pedido atual e apresenta o item carregado.
- [x] H04 **P0** — Interagir várias vezes na bancada não duplica o item nem altera estoque/caixa indevidamente.
- [x] H05 — Sem pedido ou com falta de estoque, a bancada explica o problema e não entrega uma planta ficticiamente.
- [x] H06 **P0** — Sair, voltar e recarregar preservam o estado do pedido pronto/retirado.

## 9. Entrega no bairro

- [x] I01 — Indicador, distância, cliente e destaque apontam para a casa associada ao pedido.
- [x] I02 — Aproximar-se da casa correta apresenta a ação de entrega; visitar outra casa não conclui o pedido.
- [x] I03 **P0** — Entregar conclui o pedido, registra uma entrega, baixa a quantidade vendida e credita exatamente o valor congelado.
- [x] I04 **P0** — Duplo clique, tecla repetida ou tentativa após resposta lenta não duplicam entrega, débito de estoque ou crédito.
- [x] I05 — Confirmação, agradecimento do cliente e saldo atualizado são legíveis; o jogador entende que terminou.
- [x] I06 **P0** — Falha de conexão ou estoque insuficiente mantém o pedido recuperável e permite tentar novamente sem perdas.
- [x] I07 — Destino desconhecido mostra orientação e não permite entregar em qualquer casa.
- [x] I08 — Ao voltar para Pedidos, Catálogo, Caixa e Entregas, todas as telas refletem o resultado confirmado.

## 10. Entregas pelo mapa e endereços

- [x] J01 — Abrir Entregas mostra os destinos, a loja e a rota selecionada, sem confundir o mapa geográfico com o bairro fictício.
- [x] J02 — Despachar um pedido pronto leva ao mapa com o pedido correto vinculado.
- [x] J03 **P0** — Concluir pelo mapa produz o mesmo resultado financeiro e de estoque esperado para esse pedido, persistente após recarregar.
- [x] J04 **P0** — Uma entrega avulsa sem pedido não gera crédito nem baixa estoque.
- [x] J05 — Cadastrar, editar, buscar e excluir endereço funciona; cancelar exclusão mantém o endereço.
- [x] J06 — Excluir o destino selecionado atualiza a seleção; não há rota apontando para um registro removido.
- [x] J07 — Confirmar onde endereços personalizados persistem e comunicar os limites de uso em outro navegador/dispositivo.
- [x] J08 — Falha de mapas externos ou localização não bloqueia as outras áreas do sistema.

## 11. Caixa e histórico

- [x] K01 — Caixa vazio tem uma explicação útil, sem parecer erro.
- [x] K02 **P0** — Após vender, saldo, total vendido, quantidade de vendas e histórico correspondem às operações confirmadas.
- [x] K03 — Registros permitem reconhecer planta, cliente/destino, valor e data da venda.
- [x] K04 **P0** — Após comprar melhorias, o saldo desconta gastos e continua distinguível do total acumulado de vendas.
- [x] K05 **P0** — Recarregar, sair/entrar e abrir em outra sessão preservam o caixa oficial e não recontam vendas.

## 12. Compra e instalação de melhorias

- [x] L01 — Encontrar a Loja de Utilidades e abrir seu painel é compreensível no teclado e por toque.
- [x] L02 — Placa, jardineiras e banco mostram preço e estado: disponível, aguardando instalação ou instalado.
- [x] L03 **P0** — Sem saldo, a compra não debita dinheiro e informa quanto falta.
- [x] L04 **P0** — Comprar debita uma vez; repetir a compra não produz novo débito ou item duplicado.
- [x] L05 — O usuário entende que comprar e instalar são etapas diferentes e sabe voltar à Novo Hiper.
- [x] L06 **P0** — Instalar muda a loja e persiste; tentar instalar novamente não cobra nem duplica a melhoria.
- [x] L07 — Fechar o painel devolve os controles ao jogo; teclas usadas no painel não movimentam Bernardo ao fundo.

## 13. Progressão e continuidade

- [x] M01 — Os primeiros pedidos usam moradores do grupo inicial e as casas correspondentes.
- [x] M02 — Novos moradores aparecem conforme as condições do servidor são alcançadas, ampliando os percursos.
- [x] M03 — Presença de vizinhos e estágio da obra correspondem à progressão confirmada.
- [x] M04 **P0** — Gastar saldo, excluir uma planta ou reabrir o jogo não desfaz marcos conquistados.
- [x] M05 — A progressão é percebida por acontecimentos e mudanças no mundo; não exige ler contadores técnicos.
- [x] M06 — A barreira continua fechada no estado atual; a interface não promete uma região que ainda não existe.

## 14. Trecho de plataforma

- [x] N01 — A entrada do bairro leva à plataforma e apresenta os controles de movimento e salto.
- [x] N02 — Andar, pular e aterrissar funcionam no teclado e por toque, com animações coerentes.
- [x] N03 — Cair recupera Bernardo em um ponto seguro; não deixa o usuário preso fora da fase.
- [x] N04 — Chegar ao destino apresenta confirmação e permite voltar ao bairro sem repetir a entrada automaticamente.
- [x] N05 — Segurar uma tecla ao chegar não pula a confirmação; reentrar depois continua funcionando.
- [x] N06 **P0** — O trecho experimental não registra uma venda ou altera caixa/estoque só por alcançar seu marcador de destino.

## 15. Celular, acessibilidade e aplicação instalada

- [x] O01 — Login, formulários, catálogo, pedidos, caixa e jogo cabem em celular sem botões essenciais cortados.
- [ ] O02 — Teclado virtual não esconde erros ou o botão de salvar; campos numéricos são confortáveis de preencher.
- [x] O03 — Botões têm tamanho adequado para toque; modais permitem fechar e mantêm o foco/teclado utilizáveis.
- [x] O04 — Textos, avisos e balões têm contraste e tamanho suficientes; informação não depende só de cor ou som.
- [x] O05 — Alternar som funciona e sua preferência é mantida; abrir uma tela não produz sons duplicados.
- [ ] O06 — Instalar a aplicação quando suportado funciona; quando não suportado, não há uma ação quebrada.
- [x] O07 — Atualizar a versão instalada carrega arte e código compatíveis e preserva os dados do usuário.

## 16. Falhas, retomada e confiança nos dados

- [x] P01 **P0** — Uma operação recusada pelo servidor mostra falha e recupera a interface; não deixa uma confirmação de sucesso permanente.
- [x] P02 **P0** — Interromper a rede durante cadastro, preparação, entrega ou compra não deixa resultados parciais incoerentes.
- [x] P03 — Offline distingue o que pode ser consultado do que depende do servidor; reconectar recupera o uso.
- [x] P04 **P0** — Reiniciar com listas vazias no servidor remove registros antigos da interface, em vez de recuperar cópias locais obsoletas.
- [x] P05 **P0** — Duas abas não criam pedidos/entregas/compras duplicados; conferir separadamente a atualização visual entre abas.
- [x] P06 **P0** — Navegador novo recupera plantas, pedidos, entregas, saldo e melhorias oficiais sem depender do armazenamento local anterior.
- [x] P07 **P0** — Em ambiente descartável, reiniciar o serviço preserva os dados e restaurar um backup recupera banco e fotografias compatíveis.

## Roteiro principal para a primeira rodada

Usar uma loja de teste e anotar o saldo inicial **S**. Cadastrar uma planta com
preço de **R$ 20,00**, foto e **5 unidades**. A geração atual usa pedidos de uma
unidade. Não concluir o próximo pedido automático antes de fazer a conferência.

| Passo | Ação | Conferência |
|---|---|---|
| 1 | Entrar e cadastrar a planta | Cadastro persiste; estoque 5; saldo S. |
| 2 | Abrir Pedidos | Existe um pedido ativo; registrar seu número, cliente, destino e valor. |
| 3 | Abrir Aventura e entrar na Novo Hiper | Encontrar bancada e retirar a planta; nenhum crédito de venda ainda. |
| 4 | Sair e ir à casa indicada | Caminho, distância e ação de entrega são claros. |
| 5 | Entregar uma vez | Pedido entregue; estoque 4; saldo S + R$ 20,00; uma entrega e uma venda novas. |
| 6 | Conferir as telas e recarregar | Os mesmos resultados permanecem; o próximo pedido não reconta a venda anterior. |
| 7 | Repetir até ter saldo para uma melhoria | Cada pedido altera estoque e caixa exatamente uma vez; repor quando necessário. |
| 8 | Comprar e instalar uma melhoria | Um débito pelo preço exibido; estado instalado e mudança visual persistentes. |
| 9 | Sair e entrar novamente | Loja, histórico, saldo, pedidos e melhorias continuam coerentes. |

Depois, repetir uma entrega pelo mapa com **outro pedido**, e executar os casos
de falta de estoque, falha de rede e envio repetido. Não concluir o mesmo pedido
pelas duas rotas esperando receber duas vendas.

## Pontos de atenção encontrados na leitura do sistema

Estes são riscos ou decisões a validar, não resultados de testes executados nesta revisão.

1. **Confirmações antecipadas no painel.** Cadastro, edição e exclusão de plantas
   foram corrigidos e validados no marco 2. Preparo e pedido pronto foram
   corrigidos e validados no marco 3 (F04). Priorizar P01/P02 nos demais fluxos.
2. **Duas rotas de entrega.** A Aventura usa um fluxo confirmado pelo backend;
   o mapa também tem atualizações locais e posterior persistência. Priorizar
   J03, I08 e a conciliação com o Caixa após recarregar.
3. **Listas vazias e dados antigos.** Cargas inicial, pós-operação e manual agora
   respeitam listas vazias. E08 foi validado; P04 permanece aberto para sua
   execução completa no marco 5.
4. **Endereços personalizados.** Os handlers observados atualizam o estado do
   navegador, sem uma chamada de persistência equivalente à das plantas.
   Validar J07; decidir se a jornada requer compartilhar esses endereços entre dispositivos.
5. **Dados demonstrativos.** A ação de adicionar amostra usa estado local.
   Conferir se fica clara a diferença entre amostra visual e planta persistida
   que participa de pedidos oficiais.
6. **Abas simultâneas.** Proteção transacional contra duplicidade e atualização
   visual imediata entre abas são comportamentos diferentes. A sincronização
   automática entre abas permanece uma decisão pendente de produto.
7. **Fronteiras do produto.** Plataforma experimental, bairro fictício e mapa
   geográfico precisam ter papéis claros. Pagamento real, fila de vários pedidos,
   nova região e caminhada dos templates de NPCs não estão implementados nesta jornada.

## Registro de execução

| Item | Data / dispositivo | Resultado | Problema observado / evidência | Próxima ação |
|---|---|---|---|---|
| A01–A06 | 12/10/2026 / Chromium + API isolada | Aprovados | [Execução do marco 1](MILESTONE_ONE_VALIDATION.md). | Seguir para o marco 2. |
| B01–B05 | 12/10/2026 / Chromium + API isolada | Aprovados | Navegação e estados vazios executados sem erros. | Seguir para o marco 2. |
| B06 | 12/10/2026 / revisão textual | Aprovado editorialmente | Textos simplificados; não houve rodada com Bernardo. | Observar compreensão durante o uso. |
| C01–C07, D01/D03–D06, E01–E08 | 12/10/2026 / Chromium + API isolada | 20 itens aprovados | [Validação do marco 2](MILESTONE_TWO_VALIDATION.md). | Seguir para pedido e retirada. |
| D02 | 12/10/2026 / celular emulado | Pendente no aparelho físico | Fluxo emulado aprovado; captura/permissões reais não executadas. | Conferir Câmera no celular. |
| F01–F08, H01–H06 | 13/10/2026 / Chromium + APIs isoladas | 14 itens aprovados | [Validação do marco 3](MILESTONE_THREE_VALIDATION.md). | Seguir para entrega e primeira venda no bairro. |

Para cada falha, registrar a ação que a provocou, o resultado esperado, o
resultado observado e o que aconteceu após recarregar. Priorizar perda de dados,
estoque incorreto, dinheiro duplicado e bloqueio da jornada antes de refinamentos visuais.

## Referências do sistema

- Telas e navegação: `src/App.tsx`, `src/components/` e `src/phaser-game/ui/`.
- Regras de pedidos e marcos: [PROGRESSION.md](PROGRESSION.md).
- Acesso e sessão: [AUTH_AND_SESSIONS.md](AUTH_AND_SESSIONS.md).
- Melhorias: [SHOP_UPGRADES.md](SHOP_UPGRADES.md).
- Exclusão e histórico: [PLANTS_SOFT_DELETE.md](PLANTS_SOFT_DELETE.md).
- Cobertura automatizada existente: `tests/e2e/` e `tests/unit/`.
- Arte e perspectiva ainda em avaliação: [VISUAL_BACKLOG.md](VISUAL_BACKLOG.md).
