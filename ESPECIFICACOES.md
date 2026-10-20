# River Raid (clone) — especificações e mudanças

Arquivos: `index.html` (página), `game.js` (jogo), `sprites/` (sprites extraídos de `river.png`).
Para jogar: abrir `index.html` no navegador e apertar **Enter**.

## Especificações do jogo

### Tela
- Área de jogo: 304 × 320 px, mais um painel de 48 px com placar, medidor de combustível e vidas.
- O jato fica na parte de baixo da área de jogo, na linha logo acima do placar. A tela rola de baixo para cima.

### Controles
| Tecla | Ação |
|---|---|
| ← → (A D) | mover o jato |
| ↑ (W) | acelerar |
| ↓ (S) | frear |
| Espaço (Z) | atirar (um míssil por vez) |
| Enter ou Espaço | iniciar (na tela de título) |

**No fim de jogo** o mapa continua rolando sob o quadro "FIM DE JOGO":

| Tecla | Ação |
|---|---|
| Espaço | voltar ao título |
| ↑ / ↓ | rolar para a frente / para trás (inverte a direção) |
| PgUp ou Shift+↑ | ir para a próxima ponte |
| PgDn ou Shift+↓ | voltar para a ponte anterior |
| + (ou =) / − | aumentar / diminuir a velocidade da rolagem (passos de 1,5×, de 0,23× a 11×) |

### Geração automática do mapa (segundo `river-raid-comentarios.md`)
- Uma **seção** tem 16 blocos; o último é a **ponte**.
- Cada **bloco** tem 32 linhas de 2 px (64 px de altura) e sorteia o formato do rio: largura, posição e, às vezes, uma ilha.
- Cada bloco recebe um objeto sorteado: combustível, navio, helicóptero, casa, tanque ou balão. Aviões aparecem de vez em quando, e a ponte pode ter um tanque atravessando.
- O rio começa largo e estreita conforme a dificuldade sobe (veja a mudança 6).
- As margens de blocos vizinhos se emendam. Cada margem anda no máximo 40 px por bloco, para o jato conseguir seguir o rio.
- O bloco antes da ponte afunila o rio (cerca de 94 px), e a ponte tem uma abertura de 64 px.
- O verde da margem alterna entre claro e escuro a cada seção.

### Objetos e pontuação
| Objeto | Comportamento | Pontos |
|---|---|---|
| Navio | patrulha na horizontal | 30 |
| Helicóptero | patrulha na horizontal | 60 |
| Avião | cruza a tela rápido quando o jogador se aproxima | 100 |
| Combustível | atirar destrói; passar por cima reabastece | 80 |
| Ponte | destruída com um míssil | 500 |
| Casa | só cenário; o míssil passa, mas bater nela mata | — |
| Tanque na margem | visto de lado; patrulha em terra e atira projéteis na direção do rio; não dá para acertá-lo | — |
| Tanque na ponte | atravessa a estrada; dá para acertá-lo sobre o rio, e ele cai se a ponte for destruída | 250 |
| Balão | flutua devagar, balançando, sobre o rio e a terra | 60 |

- Ganha-se uma vida extra a cada 10.000 pontos. Começa-se com 3 vidas.
- Morre-se ao bater em margem, ilha, ponte ou inimigo, ou ao ficar sem combustível.
- Depois de passar por uma ponte, o jogador recomeça dali ao morrer. Antes disso, recomeça no início da seção.

### Sprites
Todos os objetos são desenhados em vetor no próprio `game.js`: combustível, helicóptero (hélice animada), navio, avião, casa com árvore, tanque visto de lado (esteiras e rodas animadas), balão, árvores, cercas, vacas e o jato do jogador. Os PNGs extraídos de `river.png` continuam em `sprites/` como referência, mas o jogo não os usa mais.

## Mudanças desta versão

### 1. Margens e ilhas em curva, sem pixels
- **Antes:** as margens eram desenhadas em degraus de 2 px, e as ilhas eram retângulos aproximados.
- **Agora:**
  - A transição entre blocos usa uma curva suave (smoothstep), sem arredondar em degraus. A margem sai e chega na horizontal, sem quebra de inclinação entre blocos.
  - As margens são desenhadas como polígonos contínuos, e a rolagem é sub-pixel.
  - As ilhas têm formato de elipse com pontas arredondadas, que começa e termina com largura zero.
  - A colisão usa a mesma geometria suave que é desenhada.
- Para ajustar: `smooth()` e o laço da ilha em `genBlock()`, e `drawTerrain()` no `game.js`.

### 2. Jato mais abaixo
- A base do jato passou de 54 px para 6 px acima do painel (`PLAYER_Y`). Ele fica na linha logo acima do placar e o jogador enxerga mais rio à frente.
- Os míssils, colisões e o ponto de recomeço acompanham a nova posição.

### 3. Início mais lento
| | Antes | Agora |
|---|---|---|
| Velocidade normal | 2 px/quadro | 1,1 px/quadro |
| Acelerando | 3 | 1,9 |
| Freando | 1 | 0,6 |
| Movimento lateral | 2,5 | 2 |
| Consumo de combustível | 0,045 por quadro | 0,04 por quadro (1,2× acelerando) |

- A velocidade aumenta 7% a cada seção, até a 8ª seção (+56%). O jogo começa tranquilo e fica mais difícil conforme se avança.

## Mudanças da versão 3 — visual vetorial e inclinação do jato

### 4. Sprites e terreno em estilo vetorial / flat design
- **Antes:** os sprites eram PNGs em pixel art copiados do mapa original, e o terreno era de cor chapada.
- **Agora:** tudo é desenhado com formas vetoriais. O canvas é renderizado em resolução 2× para as bordas ficarem nítidas.
- **Sombreamento:**
  - Os objetos têm um lado iluminado e outro sombreado, além de sombra projetada no chão ou na água.
  - O tanque de combustível tem brilho cilíndrico. O helicóptero tem barriga escura e cabine de vidro. O navio tem casco em dois tons e esteira. O avião tem a asa de baixo mais escura.
- **Margens e ilhas:** ganharam uma faixa de água rasa mais clara, sombra escura na beira e uma faixa de luz no lado da terra. Há arbustos com sombra e destaque, e marolas na água em posições fixas por bloco.
- **Ponte:** estrada com meio-fio, faixa amarela tracejada e deck de madeira com tábuas e sombra na água. Quando a ponte é destruída, sobram só as pontas quebradas.
- **Painel:** fundo em degradê, medidor de combustível arredondado (vermelho → amarelo → verde) com marcações e ponteiro, e vidas com o jato em miniatura.
- **Explosões:** círculos concêntricos que somem aos poucos.
- O desenho é feito em 3 passadas: água e sombras, depois a terra, depois luz e detalhes. Isso evita marcas nas emendas entre blocos.

### 5. O jato inclina as asas
- Ao mover para a esquerda ou para a direita, o jato gira sobre o eixo cabine–bocal, com transição suave (`bank` vai de −1 a 1).
- A asa que desce fica mais curta, por causa da perspectiva, e mais escura, porque mostra a parte de baixo. A asa que sobe fica mais longa e mais clara.
- A cabine e a deriva se deslocam para o lado da curva, e a chama do bocal pisca.
- Para ajustar: `drawJet()` no `game.js` (o ângulo é `bank × 0,9 rad`).

## Mudanças da versão 4 — tanques, balões e rio que estreita com a dificuldade

### 6. Rio largo no início, estreito só com a dificuldade
- **Antes:** qualquer bloco podia sortear um rio de 70 px desde a primeira seção.
- **Agora:** a largura mínima sorteada depende da dificuldade `d` (seção 0 → 0, seção 8 em diante → 1). Ela vai de 150 px no começo até 70 px na dificuldade máxima. Com a dificuldade, o sorteio também favorece larguras menores (`rng()^(1+d)`).
- Num teste, o trecho mais estreito de cada seção ficou entre ~145 e 175 px nas primeiras seções e caiu para ~65–75 px por volta da 7ª–8ª.
- A ponte (64 px) e o afunilamento antes dela não mudaram.
- Para ajustar: `wMin` em `genBlock()`.

### 7. Tanques de guerra
- **Na margem:** patrulham em terra, com esteiras animadas e o canhão virado para o rio. De tempos em tempos (a cada ~2–3 s) disparam um projétil na horizontal, e ser atingido mata.
- **Na ponte:** atravessam pela estrada. Dá para acertá-los com o míssil quando passam sobre o rio (250 pontos). Se a ponte for destruída com o tanque sobre o vão, ele cai.
- O míssil agora testa os objetos antes da ponte, para poder acertar o tanque que está em cima dela.

### 8. Balões
- Balões de ar quente listrados (vermelho e branco ou amarelo), com cesto e sombra deslocada na água, porque estão no ar.
- Flutuam devagar de um lado para o outro, balançando. Valem 60 pontos, e bater neles mata.

## Mudanças da versão 5 — vista lateral, bosques e campos com vacas

### 9. Tanques vistos de lado
- **Antes:** os tanques eram vistos de cima.
- **Agora:** aparecem de perfil, como as casas, com esteira, cinco rodas, casco em dois tons, torre em cúpula com escotilha e canhão. As marcas da esteira andam conforme o tanque se move.
- O tanque fica virado para onde aponta o canhão: para o rio, na margem, ou para o sentido da marcha, na ponte. O projétil sai da boca do canhão.

### 10. Árvores de lado, bosques e campos com vacas
- **Antes:** a terra tinha arbustos redondos vistos de cima.
- **Agora:** as árvores são vistas de lado, com tronco, sombra no chão e copa com luz em cima à esquerda e sombra embaixo à direita. Há dois tipos: copa redonda e pinheiro em três camadas.
- Cada margem de cada bloco sorteia uma paisagem:
  - **bosque (40%):** de 8 a 16 árvores agrupadas;
  - **campo (32%):** um pasto cercado com faixas de capim cortado, de 1 a 4 vacas e árvores nos cantos;
  - **árvores soltas (28%):** de 2 a 5 árvores espalhadas.
- As vacas são malhadas, vistas de lado, e de vez em quando abaixam a cabeça para pastar.
- As ilhas também ganharam árvores de lado.
- A decoração é gerada uma vez por bloco, sempre igual para o mesmo bloco. Os elementos são desenhados de cima para baixo, para os da frente cobrirem os de trás. Nada é colocado sobre a estrada da ponte.
- Para ajustar: `getDeco()`, `drawTree()`, `drawField()` e `drawCow()` no `game.js`.

## Mudanças da versão 6 — sprites minimalistas e ondas animadas

### 11. Sprites minimalistas (flat design)
- **Antes:** os sprites tinham degradês, reflexos, janelas, rodas, marcas de esteira e contornos.
- **Agora:** cada sprite é feito de poucas formas geométricas chapadas. Cada parte tem uma cor de base e uma cor de sombra, sem degradês nem contornos. A luz vem de cima à esquerda, e a sombra fica no lado direito ou embaixo.
- A paleta é única para todos: vermelho `#e5484d`/`#b8363b`, creme `#f5f2ea`/`#ddd8cc`, azul `#3b63e0`/`#2c4bb5`, amarelo `#ffc93c`/`#c9901c`, verde-oliva para os tanques e azul-marinho `#26334f` para detalhes.
- **Como cada sprite ficou:**
  - Combustível: galão vermelho com faixa creme e "FUEL".
  - Helicóptero: corpo oval com janela e hélice de um traço.
  - Navio: casco em trapézio com cabine e chaminé.
  - Avião: flecha em dois tons.
  - Casa: parede e telhado triangular. Uma variação tem telhado escuro e a outra, vermelho.
  - Tanque: esteira em pílula com rodas lisas, casco, cúpula e canhão.
  - Balão: gota com uma listra e o cesto.
  - Árvore: círculo ou triângulo metade claro, metade sombreado.
  - Vaca: corpo, uma mancha, cabeça e duas pernas.
  - Campo: retângulo arredondado com cerca fina.
  - Jato: fuselagem e asas em dois tons, cabine e chama. A inclinação das asas continua.
- O deck da ponte perdeu as tábuas.

### 12. Ondas animadas no rio
- **Antes:** a água tinha marolas fixas, riscos retos.
- **Agora:** a água tem 9 pequenas ondas por bloco, desenhadas como senoides. Elas correm ao longo do traço, balançam de um lado para o outro e pulsam de opacidade, cada uma com fase e velocidade próprias.
- As posições são sempre iguais para o mesmo bloco, e as ondas não encostam nas margens nem nas ilhas.
- Para ajustar: o laço "ondas animadas" em `drawTerrain()`, fase 0.

## Mudanças da versão 7 — fim de jogo navegável e proporções consistentes

### 13. Fim de jogo com o mapa rolando
- **Antes:** a tela parava, e Enter voltava ao título.
- **Agora:** o mapa segue rolando e os inimigos continuam se movendo, sem colisões. O quadro "FIM DE JOGO" fica por cima com as instruções e a velocidade atual.
- **Teclas:** as setas ↑/↓ escolhem a direção da rolagem. PgUp/PgDn ou Shift+↑/↓ deslizam até a próxima ponte ou a anterior, que para no meio da tela. −/+ (ou =) mudam a velocidade.
- **Voltar ao título:** Espaço volta ao título. Ele só responde depois de ~0,7 s, para quem estava atirando ao morrer não pular o quadro sem querer.
- As teclas são lidas por toque, sem a repetição automática de tecla segurada, inclusive na tela de título.

### 14. Proporções consistentes com as casas
- **Antes:** veículos, árvores e vacas tinham tamanhos arbitrários. O tanque era quase do tamanho da casa e a vaca, metade dela.
- **Agora:** todos seguem uma escala única, com a parede da casa (24 px) valendo ~10 m, ou seja, ~2,4 px/m. Os tamanhos ficam aproximados onde a jogabilidade pede.

| Objeto | Antes (px) | Agora (px) | Referência |
|---|---|---|---|
| Tanque | 26 × 14 | 19 × 10 | ~7 m, menor que a casa |
| Navio | 36 × 12 | 43 × 14 | lancha-patrulha, maior que a casa |
| Helicóptero | 20 × 14 | 27 × 19 | ~12 m |
| Avião inimigo | 20 × 10 | 25 × 13 | caça, mesmo porte do jato |
| Jato do jogador | 15 × 16 | 19 × 20 | caça |
| Balão | 16 × 24 | 24 × 36 | mais alto que a casa |
| Árvores | 12–19 de altura | 15–24 de altura | mais altas que a casa |
| Vaca | ~11 de comprimento | ~7 de comprimento | ~2,5 m |

- As áreas de colisão acompanham os novos tamanhos. O jato maior deixa as passagens estreitas um pouco mais difíceis.
- Para ajustar: as constantes `SC` e `JET_SC` no topo do `game.js`.

## Mudanças da versão 8 — altitude dos helicópteros, ilhas e explosões

### 15. Helicópteros mudam de altitude
- Cada helicóptero sobe e desce devagar, com ritmo próprio, entre 0,55× e 1,15× do tamanho normal. Quanto mais alto, maior ele parece. A sombra também fica mais longe, menor e mais clara.
- A área de colisão acompanha o tamanho, e o centro do helicóptero não se desloca.
- Para ajustar: `heliAltitude()`.

### 16. Ilhas mais raras no início e menores
- **Antes:** havia 50% de chance de ilha em qualquer trecho largo, desde o começo. As ilhas mediam até 90 px de largura e 52 px de altura.
- **Agora:**
  - A chance de ilha vai de 10% no começo até 55% na dificuldade máxima.
  - As ilhas têm 16–34 px de largura no início, e o limite sobe até 60 px com a dificuldade. A altura vai de 24 a 44 px.
  - A quantidade de árvores (1 a 3) acompanha o tamanho da ilha.

### 17. Uma explosão para cada tipo de inimigo
| Tipo | Efeito |
|---|---|
| Navio | bola de fogo pequena, anel achatado de respingo, gotas de água subindo e caindo, destroços vermelho e creme |
| Helicóptero | as duas pás do rotor saem girando, faíscas e fumaça cinza que sobe depois |
| Avião | clarão na tela, fogo curto e faíscas lançadas no sentido do voo, com pedaços azuis |
| Combustível | clarão, duas bolas de fogo grandes, anel de choque, coluna de chamas subindo e destroços vermelhos |
| Tanque | a torre voa girando, terra e pedaços de esteira caem, e sobe fumaça preta |
| Balão | estouro sem fogo: um anel pequeno, retalhos listrados que caem balançando e o cesto caindo |
| Ponte | três explosões em sequência ao longo do vão, tábuas voando e poeira |
| Jato do jogador | clarão, bola de fogo dupla, anel de choque, faíscas, destroços amarelos e fumaça escura |

- Cada tipo tem também um som próprio.
- As partículas ficam presas ao mapa e rolam junto com ele.
- Para ajustar: a tabela `FX` e o `drawExplosion()`.

## Observações
- Testei sem navegador com um robô simples, e a geração do mapa não gerou erros. Conferi o visual por captura de tela, mas não joguei uma partida inteira. A dificuldade só se avalia jogando.
- O som são só bipes simples.