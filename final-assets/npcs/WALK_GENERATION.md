# Caminhada dos moradores — v1

Gerado com a ferramenta integrada `image_gen`, usando `moradores-v1.png` como referência. Arquivo final: `moradores-walk-v1.png`, PNG RGBA 1536×1024. São 24 poses (Ana, Carlos e Bia × esquerda/direita/frente/costas × dois passos). O runtime intercala os passos com a pose neutra da folha original. Os demais cinco moradores continuam como clientes parados junto ao destino.

O recorte acompanha a silhueta e os pés de cada pose. `node scripts/sprites/catalog-npc-walk.cjs` lê a transparência e gera `moradores-walk-v1-atlas.json`, sem alterar a imagem. O PNG usado no jogo não tem sufixo `-master`, para entrar no pacote Docker.

Prompt final de edição (após a geração da folha referenciada pelos três personagens):

> Use case: precise-object-edit. Edit this 3 rows by 8 columns sprite sheet. CRITICAL output must have genuinely transparent alpha everywhere outside the 24 character silhouettes. Remove ALL brown/gray backdrop and ALL glow/shadows between characters. No solid background. Preserve 24 isolated characters and exact layout, colors, faces, clothes and row identities. Also correct walking cycle: each adjacent pair shows two OPPOSITE leg strides. In columns2,4,6,8 of EVERY row swap which leg is forward and which arm is forward compared with columns1,3,5,7. Show distinct alternating feet, not two copies of same pose. Keep character bodies fully inside cells. Maintain clean alpha edges, no floor shadows. Output transparent PNG sprite sheet.

Validação visual feita sobre fundo verde, além da leitura de alpha e contagem de 24 silhuetas. Os pares de perfil têm variação discreta; a pose neutra intercalada ajuda a distinguir os passos.
