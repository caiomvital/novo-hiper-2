# Pendências de testes

| # | Item | Observação | Estado |
|---|---|---|---|
| T1 | Isolar os dados do E2E da Aventura | A suíte E2E usa o **mesmo backend/`data-dev`** do teste manual, e `closeOpenOrders()` (`tests/e2e/delivery-slice.spec.ts`) **finaliza todos os pedidos abertos**, inclusive os criados à mão. Isso entregou os pedidos DEV #161 e #162 durante a validação do bairro. Solução futura: isolar os dados E2E (banco/backend próprio) **ou** limpar somente o que a própria suíte criou (ids com prefixo). **Não corrigir neste momento.** Enquanto isso: não rodar o E2E enquanto houver pedido manual de teste aberto. | pendente |
