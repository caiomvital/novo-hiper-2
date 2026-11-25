# Composição e movimento no bairro

Passe de 18/10/2026: recortes internos no tileset para retirar linhas de registro; praça com gramado menos repetitivo; expositores de mudas em madeira, vasos e canteiros na Novo Hiper; grupos diferentes de vasos e flores nos quintais; fonte desenhada em perspectiva com quedas d’água e ondulações; seis borboletas animadas.

Decoração sem corpos físicos. Soleiras, pontos de entrega, colisões, progressão oficial, estoque e caixa mantidos. Animação da fonte registrada no evento da cena e removida no shutdown; tweens pertencem à cena.

Validação: TypeScript sem erros; 148 testes unitários em 20 arquivos; teste Playwright touch 900×620 aprovado em 3,4 minutos, incluindo colisão da loja, retirada, seis animações de plataforma, retorno e entrega com exatamente um débito de estoque e um crédito. Capturas revisadas em `docs/evidence/map-blond/loja.png` e `praca.png`. Movimento nativo no Android ainda depende de teste físico.

Publicação em 18/10/2026 às 02:41 UTC: imagem `sha256:044f7b0f18b5c601079db8dc06aec9dde417848ba4f04916e46edd525c92b445`, contêiner healthy. Build local e imagem com 21 arquivos idênticos; verificação pública de HTML, JS/CSS, 15 imagens, dois atlas e service worker aprovada em https://novohiper.fluxos.dev.br. Backup `backups/neighborhood-life/20261018T024055Z/`. Banco íntegro antes e depois, com 1 planta, 20 pedidos, 19 entregas e 20 transações. Rollback `novo-hiper-rollback:before-neighborhood-life`.

Limite visual: a malha de ruas continua regular e as demais fachadas ainda usam o conjunto anterior. Este passe corrige emendas e acrescenta composição e movimento; não representa uma reconstrução completa do mapa.
