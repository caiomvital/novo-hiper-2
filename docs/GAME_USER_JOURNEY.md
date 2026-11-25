# Jornada do jogo — primeiro arco implementado

Pedidos, plataforma, entregas, caixa, melhorias e progressão agora formam uma jornada. A orientação na Aventura indica o próximo passo e o percurso termina junto à casa oficial do cliente.

## Integração com o catálogo — 18/10/2026

[Validação do ciclo completo e evidências](STORE_JOURNEY_VALIDATION.md).

O ponto de partida é a loja cadastrada por Bernardo. No catálogo, o cartão **Da sua planta ao bairro** mostra uma ação atual e o caminho cadastro → pedido → preparo → entrega → cuidado da loja. A foto, o nome, a quantidade e o total do pedido acompanham a orientação na Aventura. Dentro da Novo Hiper, a vitrine mostra as plantas do catálogo, seus preços e seu estoque atual; o botão de edição volta ao painel.

Antes de retirar uma encomenda, a seta do bairro aponta para a Novo Hiper. A orientação do interior indica a bancada PREPARO. Após confirmar a entrega, o resultado permanece na orientação de retorno, mesmo se houver outro pedido. O catálogo mostra a última entrega registrada e oferece conferir o caixa e ampliar a vitrine.

O cadastro não força uma encomenda: o backend continua decidindo conforme estoque, capacidade e disponibilidade. Retirar a planta ou concluir uma plataforma não gera crédito. A confirmação no morador usa o mesmo estoque e o mesmo caixa virtual do painel, uma única vez; não há pagamento real. O parque e o treino livre continuam acessíveis, e a entrega direta pelo bairro permanece disponível.

A jornada retoma pedidos já retirados após recarregar. Plantas e vendas existentes são aproveitadas: esta interface não reinicia a loja, não duplica marcos e não cria recompensas novas. A celebração maior do bairro continua dependendo do marco oficial descrito abaixo.

## Uma história no bairro: o cantinho de Dona Maria

A primeira história própria de morador está disponível na Aventura pelo botão **História** ou conversando com Dona Maria na entrada de casa. Ela pede uma planta da Novo Hiper para começar um cantinho verde. Aceitar reserva a próxima encomenda, preservando o pedido que já estiver em andamento. Cadastro e estoque reais do painel determinam a planta e o preço; não há espécie obrigatória nem prêmio financeiro extra.

Após retirar a planta, Bernardo pode usar o percurso de plataforma para chegar à casa dela. Confirmar a entrega muda o jardim e apresenta uma conversa de agradecimento. O jardim, o nome da planta e o registro da conversa permanecem nas próximas visitas. A história aparece identificada na orientação do pedido e pode ser revista sem repetir a venda.

[Validação, migração e evidências](RESIDENT_STORY_VALIDATION.md).

## Começo: abrir a Novo Hiper

Bernardo recebe uma apresentação curta: cuidar da loja e levar plantas aos
moradores para deixar o bairro mais vivo. A primeira tarefa é cadastrar uma
planta com estoque. Quando chega o primeiro pedido, o balcão explica quem pediu,
qual planta levar e quanto a venda renderá. A bancada permite retirar o vaso.

O jogador recebe uma orientação por vez. Cadastro, pedido, bancada e entrada
da plataforma devem ser alcançáveis por ações claras, sem depender de explorar
menus para descobrir o próximo passo.

## Meio: atravessar, entregar e melhorar

Ciclo principal:

1. Receber um pedido e retirar a planta na Novo Hiper.
2. Escolher partir para a entrega; a plataforma representa o percurso até o
   cliente desse pedido, com nome, planta e objetivo apresentados na entrada.
3. Atravessar obstáculos e recuperar-se em pontos seguros quando cair.
4. Ao concluir, chegar à casa do destinatário correto no bairro. O cliente
   recebe Bernardo; interagir confirma a entrega pelo servidor.
5. Ver o agradecimento e o dinheiro da venda, depois voltar à loja.
6. Comprar na Loja de Utilidades, instalar no balcão e perceber a loja mudar.
7. Receber pedidos de novos moradores e repetir o ciclo.

Concluir a plataforma não credita dinheiro por si só. A venda acontece uma vez,
na confirmação da entrega. Uma fase sem pedido continua sendo treino de saltos.
Abandonar o percurso preserva o pedido e o vaso para uma nova tentativa.

Na conclusão, apresentar “Chegamos à casa de [cliente]”, com uma ação para
continuar à entrega. Nunca usar a casa genérica da fase como se fosse a casa
oficial de qualquer cliente. Mudanças de pedido em outra aba precisam ser
conferidas antes de permitir a entrega; não se entrega um pedido diferente do
que motivou o percurso.

A plataforma é o caminho principal apresentado na orientação. A entrega direta pelo bairro continua disponível. Não há requisito de conclusão da plataforma no servidor.

## Fim do primeiro arco: uma loja que ganhou vida

Um aviso de encerramento celebra a conquista
“Novo Hiper ganhou vida”. A loja mostra suas melhorias, os moradores aparecem
e Bernardo recebe agradecimentos pelo que construiu.

O encerramento reutiliza o marco histórico `bairro_vivo`, já decidido no servidor:
dez entregas concluídas, quatro casas atendidas, três plantas cadastradas
historicamente e três melhorias instaladas. Não depende do saldo disponível,
e gastar dinheiro ou remover uma planta não desfaz a conquista.

Este encerramento não é Game Over. Depois da celebração, o usuário pode
continuar recebendo pedidos, repondo plantas, entregando e jogando a plataforma.
A região em obras continua fechada até existir conteúdo para ela. Não anunciar
uma nova região jogável antes de implementá-la.

## Implementação e próximos passos

1. Ligação plataforma → destinatário do pedido, com entrega explícita e segura.
2. Introdução e orientação contextual do primeiro pedido.
3. Retorno à loja e orientação da primeira compra/instalação.
4. Celebração persistente do primeiro arco, sem repetir a cada recarga.

Os itens 1–4 foram implementados. A confirmação da celebração fica salva no servidor e não movimenta o caixa.

Variações implementadas: rua inicial com dois saltos; caminho do jardim após o marco de clientela 2; passeio da praça após o marco de clientela 3. Jardim e praça têm três saltos, paisagens e valas em posições diferentes. O treino sem pedido continua na rua inicial. A escolha fica fixa durante o percurso; alterações de progressão só afetam a próxima saída.

Os marcos reutilizados são oficiais: clientela 2 exige três entregas e uma melhoria instalada; clientela 3 exige seis entregas, duas melhorias instaladas e duas plantas cadastradas historicamente. Não existe região nova nem recompensa adicional por percurso.

Critério da primeira etapa: um pedido real percorre retirada → plataforma →
casa correta → confirmação → uma venda. Quedas, saída, recarga e tentativas
repetidas não perdem nem duplicam pedido, estoque ou saldo.

## Volta orientada à loja

Após a entrega, “Melhorar minha loja” mostra direção e distância até a Loja de Utilidades. Após a compra, “Voltar à Novo Hiper para instalar” fecha o painel e aponta para a loja. A orientação pode ser cancelada e não muda o pedido ativo nem reposiciona o jogador. Chegar à loja/abrir as utilidades limpa a orientação. Quando as três melhorias já estão instaladas, a volta aponta para a Novo Hiper para continuar cuidando da loja.

## Interior com volume

Prateleiras, estoque, balcão e preparo têm tampo, frente, lateral e sombras. Piso, paredes e tapete foram refinados. Personagem e móveis se sobrepõem conforme os pés, mantendo a circulação e os pontos de interação. O aviso de preparo se adapta a telas pequenas e à reentrada na loja.

## Plataforma horizontal e exploração opcional

No celular, “Jogar na horizontal” solicita tela cheia e paisagem, com orientação para girar manualmente quando o navegador não permite. O zoom da plataforma pode ser afastado e restaurado pelos controles de visão, preservando a partida. Os três percursos incluem tablados em alturas diferentes, flores opcionais e um carrinho móvel que devolve ao ponto seguro quando tocado. Flores são um desafio da visita e não movimentam dinheiro ou estoque. Chegar ao destino continua exigindo a confirmação e a entrega oficial no bairro.

## Continuidade após o cantinho e celular horizontal — 19/10/2026

A orientação **Missão** liga a história concluída à próxima melhoria da loja, usando preço, saldo e estado de compra/instalação oficiais. Loja já equipada recebe a sugestão de ampliar a vitrine com outra planta cadastrada pelo usuário. Não há alteração financeira por seguir a orientação.

No celular horizontal, a Aventura ocupa a tela disponível; detalhes da missão e vitrine abrem sem reduzir o mapa. Direcionais aceitam arrastar e diagonal, e a plataforma mantém movimento/pulo com dois dedos. Rotação e zoom preservam a partida. [Verificação e evidências](MOBILE_LANDSCAPE_VALIDATION.md).
