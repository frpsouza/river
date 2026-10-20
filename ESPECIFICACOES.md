# River Raid (clone) — especificações e mudanças

Arquivos: `index.html` (página), `js/` (o jogo, em módulos — veja **Arquitetura**), `android/` (app Android, veja `ANDROID.md`), `scripts/export-android.sh`, `manifest.webmanifest` + `sw.js` + `icons/` (PWA).

O material de referência de terceiros usado no início (mapa original, sprites recortados dele e a transcrição de comentários do código original) **não faz parte do repositório**: fica só na pasta local `referencias/`, ignorada pelo git. O jogo não usa nenhum desses arquivos; todos os desenhos são originais.
Para jogar: abrir `index.html` no navegador e apertar **Enter**.

## Arquitetura (pasta `js/`)

O jogo é dividido em módulos pequenos, cada um com um cabeçalho explicando o que faz e de quem depende. São scripts comuns, carregados em ordem pelo `index.html`, e não módulos ES (`import`/`export`). Assim o jogo continua abrindo com dois cliques, direto do disco, sem servidor. Tudo o que um arquivo declara fica visível para os carregados depois dele.

| Ordem | Arquivo | Responsabilidade |
|---|---|---|
| 1 | `config.js` | constantes: tamanhos da tela, grade do mapa (linhas, blocos, seções) e escalas dos sprites |
| 2 | `util.js` | gerador aleatório com semente (`mulberry32`) e `clamp` |
| 3 | `audio.js` | bipes sintetizados (Web Audio) |
| 4 | `terrain.js` | geração procedural do rio: blocos, seções, ponte, ilhas, dificuldade |
| 5 | `objects.js` | objetos de cada bloco (inimigos, combustível, casas, tanques, balões) e altitude dos helicópteros |
| 5b | `cliffs.js` | paredões de rocha do modo moderno, ao longo da beira do rio: geração e colisão |
| 5d | `ocean.js` | modo oceano: mar com ilhas, esquadrilhas acrobáticas, porta-aviões, chefes, nuvens e desenhos vistos de cima |
| 5c | `powerups.js` | power-ups do modo moderno: sorteio, coleta, efeitos, som, desenho e ícones no painel |
| 6 | `state.js` | estado da partida e modo de jogo (`mode`): começar, renascer no checkpoint, pontuar, morrer |
| 7 | `effects.js` | explosões: receitas por tipo, física das partículas e desenho |
| 8 | `gameover.js` | tela de fim de jogo navegável (rolagem, pontes, velocidade) |
| 9 | `update.js` | um passo da simulação: controles, colisões, inimigos, míssil |
| 10 | `render/canvas.js` | canvas em 2×, primitivas (`poly`, `ell`, `rrect`, `mix`) e paleta |
| 11 | `render/terrain.js` | desenho da água, margens, ilhas, ponte e decoração (bosques, campos, vacas) |
| 12 | `render/sprites.js` | sprites vetoriais flat: combustível, helicóptero, navio, avião, casa, tanque, balão, jato |
| 13c | `render/pico.js` | modo CLASSIC - PICO-8: o clássico em 128×128 com a paleta de 16 cores, sprites em pixel art e fonte 3×5 |
| 13b | `render/retro.js` | modo Retro Oceano: pixel art em 240×320, quadros intermediários, paleta de 32 cores com pontilhado e fonte bitmap 5×7 |
| 13 | `render/frame.js` | monta cada quadro (`draw`), painel, telas de título e de fim de jogo |
| 14 | `main.js` | teclado e laço principal (`update` a 60 passos/s, `draw` a cada quadro) |
| 14b | `gamepad.js` | joystick/controle físico (Gamepad API): analógico, direcional e botões nas mesmas entradas do teclado |
| 15 | `touch.js` | controles na tela para celular/Android: joystick analógico (`stick`) e botões que escrevem nas mesmas `keys`/`taps` do teclado |

**Fluxo de um quadro:** `main.js` chama `update()`, que usa `state`, `terrain`, `objects`, `effects` e `gameover`. Depois chama `draw()`, que usa os módulos de `render/` e o `effects`.

**Por onde começar a ler:**
1. `config.js` e `terrain.js` mostram como o mapa nasce.
2. `update.js` mostra as regras do jogo.
3. `render/frame.js` mostra como tudo aparece na tela.

## Especificações do jogo

### Tela
- Área de jogo: 304 × 320 px, mais um painel de 48 px com placar, medidor de combustível e vidas.
- O jato fica na parte de baixo da área de jogo, na linha logo acima do placar. A tela rola de baixo para cima.

### Controles
| Tecla | Ação |
|---|---|
| ← → (A D) | mover o jato |
| ↑ (W) | clássico: acelerar · moderno: subir na tela |
| ↓ (S) | clássico: frear · moderno: descer na tela |
| Espaço (Z) | atirar (um míssil por vez) |
| X ou B | soltar uma bomba do estoque (modo oceano) |
| Enter ou Espaço | iniciar (na tela de título) |
| setas, 1–5 ou clique | escolher o modo na tela de título (clicar de novo na opção escolhida começa) |

**Com joystick/controle (gamepad)** — vale para **todos os modos** (Classic, Modern, Ocean, Retro Ocean, PICO-8), no título e no fim de jogo, no navegador e no app Android:

| Controle | Ação |
|---|---|
| analógico esquerdo | mover (analógico: quanto mais inclinado, mais forte) · nos menus, escolher |
| direcional em cruz (d-pad) | mover (digital) · nos menus, escolher |
| A ou RT (gatilho direito) | atirar · no fim de jogo, voltar |
| B ou LT (gatilho esquerdo) | soltar bomba (oceano e retro; nos outros modos não faz nada) |
| Start | começar (título) |
| LB / RB | ponte anterior / próxima (fim de jogo) |
| X / Y | − / + velocidade da rolagem (fim de jogo) |

**No fim de jogo** o mapa continua rolando sob o quadro "FIM DE JOGO":

| Tecla | Ação |
|---|---|
| Espaço | voltar ao título |
| ↑ / ↓ | rolar para a frente / para trás (inverte a direção) |
| PgUp ou Shift+↑ | ir para a próxima ponte |
| PgDn ou Shift+↓ | voltar para a ponte anterior |
| + (ou =) / − | aumentar / diminuir a velocidade da rolagem (passos de 1,5×, de 0,23× a 11×) |

### Geração automática do mapa (inspirada na estrutura do jogo original)
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
- Logo depois de cada ponte há uma **zona de respiro**: rio largo, sem ilhas, paredões nem inimigos, e o jato renasce protegido por 2,5 s (veja a mudança 31).

### Sprites
Todos os objetos são desenhados em vetor no próprio `game.js`: combustível, helicóptero (hélice animada), navio, avião, casa com árvore, tanque visto de lado (esteiras e rodas animadas), balão, árvores, cercas, vacas e o jato do jogador. (Os PNGs de referência do início saíram do repositório; ver o topo do documento.)

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

## Mudanças da versão 9 — código dividido em módulos

### 18. `game.js` dividido em 14 arquivos
- **Antes:** um único `game.js` com ~960 linhas.
- **Agora:** 14 arquivos em `js/` e `js/render/`, separando a lógica do jogo do desenho (veja **Arquitetura** no topo). Cada arquivo começa com um cabeçalho didático: o que faz, as funções principais e de quais outros módulos depende.
- O código foi movido sem mudar nenhuma linha. Saíram apenas os separadores de seção, que viraram os cabeçalhos. O comportamento é o mesmo.
- Os nomes de arquivo citados nas mudanças anteriores (`game.js`) agora correspondem a estes módulos. Por exemplo, `genBlock()` está em `terrain.js`, `drawJet()` em `render/sprites.js` e `FX` em `effects.js`.

## Mudanças da versão 10 — modos clássico e moderno, montanhas e versão Android

### 19. Modos de jogo, escolhidos na tela de início
- A tela de título mostra as duas opções. As setas (ou as teclas 1 e 2) escolhem o modo, e Enter ou Espaço começa. No celular, um toque na opção escolhe e outro toque começa. O modo atual aparece no painel.
- **Clássico:** como antes. Margens, ilhas e a ponte inteira matam, e o míssil para ao chegar na terra.
- **Moderno:** o jato voa por cima das margens e das ilhas, e só não pode sair da tela.
  - Casas e tanques em terra ficam lá embaixo e não colidem. O míssil voa sobre a terra, então dá para acertar os tanques das margens.
  - A ponte não bloqueia o voo, mas continua valendo pontos se for destruída.
  - O jato projeta uma sombra no chão, para dar a sensação de altura.

### 20. Montanhas (só no modo moderno)
- Surgem a partir da 3ª seção (`MTN_FROM = 2`). A chance (30% → 75% por margem) e a altura (24–40 px → 24–62 px) crescem com a dificuldade.
- São vistas de lado, como as casas: rocha em dois tons, neve no topo, um pico menor atrás e sombra no chão.
- A colisão usa o mesmo triângulo do desenho, testando o bico, as asas e a cauda do jato. O míssil também para nelas.
- Casas e tanques não nascem dentro de montanhas.
- Para ajustar: `js/mountains.js`.

### 21. Versão Android com controles na tela
- **Controles na tela** (`js/touch.js`): botões grandes que mudam conforme a tela (título, jogo, fim de jogo). Eles aparecem em aparelhos com toque ou com `?touch=1` na URL.
- **PWA:** manifesto, ícone próprio e service worker. Instala no Android pelo Chrome e funciona offline quando servido por http(s).
- **App Android** (`android/`): um WebView em tela cheia, em retrato, com a tela sempre acesa.
- **Exportação:** `scripts/export-android.sh` copia o jogo para o app e gera `dist/river-raid.apk` quando há JDK 17 e Android SDK. A máquina ainda não tem esses dois. Veja o `ANDROID.md`.

## Mudanças da versão 11 — paredões de rocha, power-ups e APK

### 22. Montanhas viram paredões de rocha ao longo do rio
- **Antes:** havia picos isolados no meio da terra.
- **Agora:** as formações rochosas acompanham a beira do rio, como margens mais altas, numa faixa de 14 a 44 px colada na água, do lado da terra.
  - Onde há paredão dos dois lados, o rio vira um cânion e o jogador precisa voar sobre a água.
  - Os paredões continuam de um bloco para o outro sem degraus, têm borda recortada e se abrem antes de cada ponte.
- **Quando aparecem:** a partir da 3ª seção. A chance de começar um paredão vai de 22% a 62%, e a largura cresce com a dificuldade. Um paredão existente continua no bloco seguinte com 75% de chance.
- **Visual:** topo de rocha claro, face voltada para o rio (escura do lado esquerdo e iluminada do direito), aresta iluminada, pedras salientes vistas de lado e sombra projetada.
- **Colisão:** a faixa mata o jato e detém o míssil. Casas, tanques e power-ups não nascem dentro dela.

### 23. Power-ups (modo moderno)
- Aparecem em ~16% dos blocos, flutuando com um halo pulsante. São coletados assim que encostam no avião, sem precisar atirar.

| Power-up | Cor | Efeito |
|---|---|---|
| Escudo | azul | 8 s: inimigos e projéteis explodem no escudo (que pisca ao acabar). Não protege de paredões nem da falta de combustível. |
| Tiro triplo | laranja | 10 s: cada disparo sai em leque de três mísseis |
| Tiro rápido | amarelo | 10 s: dispara a cada 9 quadros, sem esperar o míssil anterior |
| Bomba | vermelho | destrói na hora todos os inimigos na tela (com pontos) e os projéteis |
| Vida extra | verde | +1 vida |

- **Animação de coleta:** clarão, dois anéis (um na cor do power-up e um branco), faíscas coloridas, oito estrelinhas girando e o nome do power-up subindo e sumindo.
- **Som:** um arpejo de quatro notas próprio de cada um. A bomba desce, e os outros sobem.
- **Painel:** os efeitos ativos aparecem com ícone e uma barra de tempo restante. O tiro rápido muda a cor dos mísseis.
- O jogo agora controla vários mísseis ao mesmo tempo (`missiles`).

### 24. APK Android gerado
- O JDK 17, o Gradle 8.7 e o Android SDK 34 foram instalados na pasta pessoal (`~/.local`, `~/Android/Sdk`), sem `sudo`. As licenças do SDK foram aceitas na instalação.
- `scripts/export-android.sh` agora gera `dist/river-raid.apk`, com ~100 KB, em modo debug.

## Mudanças da versão 12 — voo livre no moderno e clique no título

### 25. Modo moderno: o jato voa livre pela tela
- **Antes:** o jato ficava preso embaixo, e ↑/↓ só aceleravam ou freavam a rolagem.
- **Agora, no moderno:**
  - A câmera anda numa velocidade constante (1,25 × o nível da seção).
  - ↑/↓ movem o jato na vertical, entre o fundo da tela e 24 px abaixo do topo, a 2 px por quadro, como o movimento lateral.
  - O jato ocupa qualquer ponto da tela. A sombra no chão, o escudo, o disparo e as colisões acompanham a posição.
  - Ao renascer, o jato volta para baixo.
- **No clássico:** nada muda.
- O consumo de combustível no moderno é constante, porque não há mais aceleração.
- Para ajustar: a variável `py` (`state.js`) e o bloco "moderno" dos controles em `update.js`.

### 26. Clique do mouse escolhe o modo
- Na tela de título, clicar numa opção a escolhe, e clicar de novo na opção já escolhida começa o jogo. O cursor vira mãozinha sobre as opções.
- Antes isso só funcionava com toque. Agora vale para mouse e toque, além das setas e das teclas 1 e 2.

## Mudanças da versão 13 — direcional em cruz

### 27. Controles na tela com direcional em cruz
- **Antes:** quatro botões soltos (◀ ▶ ▲ ▼) numa grade, ao lado de um FOGO retangular.
- **Agora:** um direcional em cruz à esquerda, como num controle físico, e um botão de FOGO redondo à direita.
  - O direcional é um bloco só, que lê onde o dedo está em relação ao centro.
  - São 8 setores de 45°: as 4 direções e as 4 diagonais, como ▲+▶ para subir e ir para a direita no modo moderno. Há uma zona morta pequena no meio.
  - O polegar pode deslizar de uma direção para outra sem levantar.
  - Cada braço da cruz acende em azul enquanto está ativo.
  - Direcional e FOGO funcionam ao mesmo tempo, com dois dedos.
- As telas de título e de fim de jogo continuam com os botões próprios.
- Para ajustar: `buildDpad()` em `js/touch.js` e o CSS `#pad .dpad` / `.arm` em `index.html`.

## Mudanças da versão 14 — cantos do direcional para as diagonais

### 28. Cantos do direcional viram áreas de diagonal
- **Antes:** as diagonais funcionavam só pelo ângulo do dedo, e os cantos entre os braços ficavam vazios.
- **Agora:** os quatro cantos são áreas visíveis, com setas ◤ ◥ ◣ ◢.
  - Tocar em qualquer ponto de um canto aciona aquela diagonal (por exemplo, o canto superior direito = ▲ + ▶).
  - O canto e os dois braços correspondentes acendem juntos.
  - Fora dos cantos vale o braço tocado, ou seja, o eixo dominante. O centro continua sendo uma zona morta.
- A área total de toque é o quadrado inteiro do direcional, sem nenhuma parte "morta" nos cantos.

## Mudanças da versão 15 — tiros inimigos mais visíveis

### 29. Projéteis dos tanques em laranja, branco e vermelho
- **Antes:** uma bolinha escura de 1,4 px com um brilho laranja fraco, fácil de perder sobre a água.
- **Agora:** um projétil incandescente com quatro camadas:
  - um rastro de três gotas atrás, na direção oposta ao movimento, indo do amarelo ao vermelho;
  - um halo vermelho translúcido que pulsa;
  - um corpo laranja de raio 3,2 px, com contorno azul-marinho, que destaca tanto na água clara quanto na terra verde;
  - um núcleo branco, como metal em brasa.
- A área de colisão não mudou. Só o desenho ficou maior e mais contrastado.
- Para ajustar: `drawShell()` em `js/render/frame.js`.

## Mudanças da versão 16 — joystick analógico na tela

### 30. Direcional em cruz vira joystick analógico
- **Antes:** uma cruz digital, em que cada direção estava ligada ou desligada, com cantos para as diagonais.
- **Agora:** uma área circular com um botão azul que segue o dedo, em qualquer direção (360°).
  - A distância do centro dá a intensidade: 0 no meio e 1 na borda. Um toque leve faz um ajuste fino, e o dedo na borda dá o movimento máximo.
  - O botão fica limitado ao círculo. Com o dedo fora dele, o valor fica em 1 na direção do dedo.
  - Há uma zona morta pequena no centro (12%). Ao soltar, o botão volta deslizando para o meio.
  - A borda da base acende enquanto o joystick está em uso, e há marcas discretas indicando as quatro direções.
- **No jogo** (`stick.x`, `stick.y`, de −1 a 1, somados às teclas):
  - **Horizontal:** a velocidade lateral e a inclinação das asas são proporcionais ao desvio.
  - **Vertical no moderno:** o jato sobe e desce na tela proporcionalmente.
  - **Vertical no clássico:** a rolagem varia continuamente entre 0,6 (freando) e 1,9 (acelerando).
- O teclado continua igual: cada tecla vale ±1.
- **Medido no teste:** toque leve à direita = 0,23, borda = 1,00, diagonal a 45° = 0,71 em cada eixo (a velocidade total não passa de 1).
- Para ajustar: `buildStick()` em `js/touch.js` (`DEAD`, `REACH`) e o CSS `#pad .stick` / `.knob` em `index.html`.

## Mudanças da versão 17 — zona de respiro depois dos checkpoints

### 31. Sem armadilhas logo depois da ponte
- **Antes:** o jogador renascia na saída da ponte, num vão de 64 px. O primeiro bloco podia estreitar ainda mais, ter ilha, paredão ou um inimigo bem na frente, o que muitas vezes era morte certa.
- **Agora**, nos três primeiros blocos de cada seção (`CALM_BLOCKS = 3`, ~190 px de rio depois da ponte):
  - **Rio largo e quase reto:** pelo menos 180 px de largura sorteada, com o centro andando no máximo ±12 px por bloco.
  - **Saída rápida:** ao sair da ponte, as margens abrem até 60 px por lado (em vez de 40) e numa transição mais curta.
  - **Sem obstáculos:** nada de ilhas, paredões de rocha nem inimigos (navio, helicóptero, avião, tanque, balão). Combustível, casas e power-ups continuam aparecendo.
- **Renascimento:** o jogador renasce 40 px depois da saída da ponte, onde o rio já abriu.
- **Proteção ao renascer:** por 2,5 s (`SPAWN_SAFE = 150` quadros), inimigos e tiros não derrubam o jato, que pisca. Margens e paredões continuam valendo.
- **Medido em 30 seções:**
  - Na zona de respiro, a largura mínima foi de 152 px no clássico e 169 px no moderno, com 0 ilhas, 0 paredões e 0 inimigos.
  - No ponto de renascimento, o mínimo foi de 159 px.
  - No resto da seção a dificuldade não mudou, com trechos de até ~72 px.
- Para ajustar: `CALM_BLOCKS` e `SPAWN_SAFE` em `js/config.js`.

## Mudanças da versão 18 — modo Oceano

### 32. Modo Oceano (3ª opção do título)
Baseado no moderno: voo livre pela tela, power-ups e combustível. O jato sobrevoa o mar aberto, sem margens nem pontes.
- **Mar e ilhas:** a água é azul-oceano, com ilhas de contorno orgânico em ~40% dos blocos. As ilhas têm praia de areia e árvores, e o jato voa por cima delas. A zona de respiro continua valendo no começo de cada seção.
- **Nuvens:** passam numa camada alta, 1,6× mais rápido que o mar (paralaxe), e projetam sombra na água. Ficam translúcidas quando o jato está embaixo, para não esconder o jogador. Aparecem em ~38% dos blocos.
- **Porta-aviões:** navegam devagar e aguentam 10 tiros, com barra de vida e clarão a cada acerto. A cada ~3 s lançam um caça que decola do convés. Valem 800 pontos e têm uma explosão própria, maior. O jato passa por cima deles.
- **Esquadrilhas acrobáticas:** chegam a cada ~4–7 s, mais rápido com a dificuldade, e atiram mirando no jogador. Os caças são vermelhos, apontam o nariz para onde voam e valem 120. Derrubar a esquadrilha inteira dá +500 com aviso na tela.
  - **Looping:** 5 aviões descem em fila, fazem um looping completo e mergulham.
  - **Leque em V:** formação em V que serpenteia e se abre em leque.
  - **Varredura:** 6 aviões cruzam a tela de lado, em onda.
  - **Espiral:** 4 aviões girando juntos enquanto descem.
  - **Oito:** 5 aviões desenhando uma figura de oito.
- **Chefes de fase:** no bloco 12 de cada seção chega um bombardeiro gigante de quatro motores (desenho original). Ele tem barra de vida no topo, com 60 + 20 por seção (até 180), e hélices girando.
  - Durante a luta, a câmera quase para.
  - Ele alterna três ataques: um leque de 7 tiros, rajadas mirando o jogador e o lançamento de caças das asas.
  - Abaixo de 50% de vida, os motores soltam fumaça.
  - Derrotado, cai numa cadeia de explosões e vale 3000 + 1000 por seção. **Derrotar o chefe é o checkpoint**, no lugar da ponte.
  - Se o jogador morre durante a luta, renasce no início da seção e o chefe volta inteiro.
- **Barra de vida do jato:** só existe neste modo e aparece no painel e sobre o jato quando ele está ferido. Cada dano tira conforme a gravidade:

| Dano | Vida |
|---|---|
| tiro inimigo | −12 |
| trombada num caça | −30 |
| trombada num helicóptero ou balão | −35 |
| trombada no chefe | −50 |

  - Depois de cada dano há 0,75 s de invulnerabilidade, com o jato piscando.
  - A vida zerada custa uma vida, e o power-up de vida extra também recupera a barra.
  - Ficar sem combustível continua derrubando na hora.
- **Tiros inimigos:** agora podem voar em qualquer direção, e o rastro acompanha o movimento.
- **A bomba (power-up), no oceano:** derruba todos os caças, tira 15 de vida do chefe e 5 de cada porta-aviões.

### 33. Sprites do oceano vistos de cima
- No oceano, tudo o que está sobre o mar é desenhado em planta, no mesmo tamanho das versões de lado (as áreas de colisão não mudam):
  - balsa de combustível com dois tanques;
  - navio com proa afilada, ponte de comando, canhão e esteira;
  - helicóptero com disco do rotor girando e sombra que se afasta conforme a altitude;
  - balão em gomos visto do alto;
  - árvores das ilhas como copas redondas;
  - aviões que cruzam a tela.
- O jato, os caças, o porta-aviões e o chefe já são desenhados vistos de cima.
- Nos modos clássico e moderno continua a vista de lado.

## Mudanças da versão 19 — navios do oceano atiram

### 34. No oceano, o jato sobrevoa os navios, e eles atiram
- **Antes:** no oceano, encostar num navio derrubava 35 de vida, e os navios não atacavam.
- **Agora:**
  - O jato passa por cima dos navios sem colidir, como já fazia com os porta-aviões.
  - Cada navio tem um canhão giratório na proa que acompanha o jato o tempo todo e dispara um tiro mirado, com clarão na boca do cano e um som curto.
  - O primeiro disparo vem entre 0,7 e 2 s depois que o navio entra na tela. Depois, um a cada ~2–4 s, e mais rápido com a dificuldade.
  - O navio só atira quando está na tela, à frente do jato.
  - O tiro faz o dano normal de tiro inimigo (−12 de vida).
- O navio continua valendo 30 pontos ao ser destruído com o míssil.
- Nos modos clássico e moderno, os navios não mudaram: não atiram e colidem.
- Para ajustar: `shipFire()` em `js/ocean.js` e o canhão em `drawShipTop()`.

## Mudanças da versão 20 — ilhas e nuvens variadas e alongadas

### 35. Ilhas do oceano de quatro tipos, que atravessam vários blocos
- **Antes:** uma ilha oval por bloco, com no máximo ~50 px de altura.
- **Agora:** a ilha em curso passa de um bloco para o seguinte (`blk.isle`), então ela pode ser muito mais comprida no sentido do voo:

| Tipo | Forma | Altura típica |
|---|---|---|
| longa | espinha sinuosa e largura que "respira" | 140–320 px (2 a 5 blocos) |
| arquipélago | cadeia de 3 a 5 ilhotas em zigue-zague, separadas por canais | 180–300 px no total |
| atol | anel de mato e areia com lagoa turquesa no meio, que afina nas pontas | 80–130 px |
| redonda | pequena e arredondada | 45–80 px |

- **Medido em 4 mapas:** as ilhas chegaram a 316 px de altura (10% passam de 240 px).
- **Desenho:**
  - Um bloco pode ter vários trechos de ilha.
  - Quando um trecho continua no bloco vizinho, o contorno fica aberto ali, sem costura.
  - Cada camada da ilha é desenhada em todos os blocos antes da seguinte: água rasa e sombra, depois a praia, a terra e por fim os detalhes. Assim não aparecem marcas nas emendas.
  - As pontas ganharam um bico arredondado (as ilhas do rio também).
  - As árvores são distribuídas ao longo de toda a ilha, nas duas margens da lagoa no caso do atol.
- **Correção:** uma ilha que passa da borda esquerda da tela tem a beira em posição negativa, e antes ela era tratada como "sem ilha" nas colisões e no posicionamento de navios. Agora conta normalmente.

### 36. Nuvens de quatro tipos, compridas na vertical
- **Antes:** um grupo de flocos redondo, de 40–110 px.
- **Agora:** as nuvens aparecem em 45% dos blocos, e a altura mediana é ~165 px (até ~300 px).

| Tipo | Forma |
|---|---|
| flocos | grupo pequeno e redondo |
| faixa | banco comprido (120–260 px) que serpenteia no sentido do voo, com flocos laterais |
| fiapos | véus finos esticados na vertical, mais transparentes e com sombra mais fraca |
| torre | cúmulo alto e empilhado, mais largo embaixo |

- As nuvens altas começam abaixo da tela e se estendem para cima, por isso o desenho considera blocos um pouco antes da tela, para elas não "brotarem" de repente.
- Continuam translúcidas sobre o jato, agora com o teste levando em conta o formato esticado.

## Mudanças da versão 21 — sem combustível no voo livre, HUD no topo e controle físico

### 37. Moderno (e oceano): sem combustível, os postos recuperam a vida
- **Antes:** o moderno tinha combustível como o clássico, e qualquer dano derrubava o jato.
- **Agora, nos modos de voo livre (moderno e oceano):**
  - O combustível não existe mais, e não há como cair por falta dele.
  - Os postos de abastecimento recuperam a **vida**: +0,8 por quadro enquanto o jato está sobre eles, com um bipe que sobe de tom.
  - O moderno ganhou a mesma barra de vida do oceano, com dano conforme a gravidade e 0,75 s de invulnerabilidade depois de cada dano.
  - **Paredão de rocha:** em vez de derrubar, tira 40 de vida e empurra o jato 8 px para fora da rocha.
- **No clássico:** nada muda. Continua com combustível e qualquer dano derruba.

### 38. HUD no topo da tela, sobre o cenário
- **Nos modos de voo livre:**
  - O painel de baixo sai e o cenário ocupa a tela inteira: `VIEW_H` passa de 320 para 368 px, definido por modo em `newGame()`.
  - O HUD fica no alto, por cima do cenário, em pílulas translúcidas:
    - à esquerda, o placar e o nome do modo;
    - no centro, a barra de vida, que pisca quando está abaixo de 25%;
    - à direita, as vidas restantes;
    - logo abaixo da vida, os ícones dos power-ups ativos.
  - A barra do chefe (oceano) desceu para ficar abaixo do HUD.
  - O jato não sobe por baixo do HUD.
- **No clássico:** continua o painel embaixo, como no original.

### 39. Joystick / controle físico
- Funciona com qualquer controle que o navegador reconheça no mapeamento padrão (Xbox, PlayStation e a maioria dos genéricos, por USB ou Bluetooth). Os botões estão na tabela de controles.
- O analógico é contínuo, como o joystick da tela, e nos menus vira "toques" de seta.
- Os botões usam as mesmas entradas do teclado, então valem no título, no jogo e no fim de jogo.
- Testado com um controle simulado:
  - o direcional e o analógico trocaram o modo no título;
  - o Start começou o jogo;
  - o analógico na diagonal moveu o jato 60 px para o lado e 60 px para cima em 0,5 s;
  - o botão A disparou.
- Para ajustar: o mapa `GP_BUTTONS` em `js/gamepad.js`.

## Mudanças da versão 22 — oceano: vida única, inimigos mais vivos, altitude e quatro chefes

### 40. Vida única no oceano
- **Antes:** 3 vidas, cada uma com a barra de vida cheia.
- **Agora:** uma vida só, e o que vale é a barra. Zerou, é fim de jogo.
- O power-up de vida vira **REPARO TOTAL**: cura a barra inteira e não dá vida extra.
- O bônus de 10.000 pontos, que nos outros modos dá uma vida, aqui dá +30 de reparo.
- Derrotar um chefe recupera +40 de vida.

### 41. Inimigos mais vivos
- **Navios:** navegam com rumo que oscila até ±29° em torno da horizontal, desenhados girados no sentido do rumo. Dão meia-volta ao encontrar ilha ou a borda da tela, e o canhão continua mirando o jato.
- **Helicópteros:** "pegam carona" na câmera, ficando um tempo na metade de cima da tela. Perseguem o jato pelos lados ziguezagueando e atiram (a cada ~2–3 s) quando o voo está baixo.
- **Balões:** derivam com o vento e sobem devagar.
- **Caças:** de tempos em tempos dão um parafuso, girando no próprio eixo.
- **Três esquadrilhas novas:**
  - **pinça:** 6 caças, metade de cada lado, que se cruzam;
  - **mergulho:** 4 caças que mergulham no ponto onde o jato estava e arremetem para o lado;
  - **zigue-zague:** 5 caças em fila.

### 42. Altitude: voo rasante × acima das nuvens
- O voo alterna sozinho entre **rasante** (14 s) e **alto** (10 s). As lutas com chefes acontecem sempre no alto, e depois de cada chefe o voo volta ao rasante.
- A transição dura 2,5 s e é anunciada no topo da tela ("▲ ACIMA DAS NUVENS" / "▼ VOO RASANTE"), com um arpejo que sobe ou desce. O HUD mostra a altitude atual.

| | Rasante | Alto |
|---|---|---|
| mar | tamanho normal, passa mais rápido (+15%) | encolhe até 72% para o centro, enevoado, passa mais devagar |
| nuvens | por cima de tudo (translúcidas sobre o jato) | abaixo do jato, com um convés de nuvens a mais cobrindo o mar |
| jato | tamanho normal, sombra perto | 12% maior (mais perto da câmera), sombra longe e fraca |
| superfície (navios, helicópteros, postos de combustível) | atira, colide, pode ser atingida e cura | fora de alcance: não atira, não colide, não é atingida |
| esquadrilhas | ritmo normal | chegam no dobro do ritmo |

- Para curar nos postos de combustível é preciso descer, o que cria um ritmo de jogo.

### 43. Quatro chefes, cada um com ataque e defesa próprios
- Os chefes agora aparecem **a cada duas seções** (~25 s de viagem entre eles), sempre na sequência abaixo e com mais vida a cada volta.
- Eles patrulham mais abaixo do HUD (y = 92).
- A barra do chefe mostra o nome e o estado da defesa (ESCUDO, BLINDADO (n torres), INTOCÁVEL).

| Chefe | Ataques | Defesa |
|---|---|---|
| **Bombardeiro** (4 motores) | leque de 7 tiros, rajadas mirando o jato, lança caças das asas | nenhuma (resistência alta) |
| **Canhoneira** (asa delta, motores ciano) | espiral de dois braços, muralha de tiros com uma brecha, foguetes teleguiados | escudo frontal em arco por 3 s a cada 7 s: tiros vindos de baixo são rebatidos |
| **Dirigível** (envelope listrado, gôndola) | 4 torres que miram sozinhas, minas flutuantes que detonam perto do jato em 8 tiros, escolta em pinça | núcleo blindado enquanto houver torre viva: primeiro destrua as torres (+300 cada) |
| **Interceptador** (caça enflechado, pós-combustão) | rajadas de 3 tiros; investida em mergulho até onde o jato está, com aviso de mira tracejado, terminando numa onda de choque de 14 tiros | esquiva-se de mísseis que vêm por baixo e é intocável durante a investida |

- **Tiros especiais novos:**
  - o foguete teleguiado persegue o jato por ~1,7 s;
  - a mina detona perto do jato.
  - Os dois podem ser derrubados com o míssil (+20). A bomba (power-up) também os elimina e tira 5 de cada torre do dirigível.
- **Testado:** cada chefe foi derrotado com tiros certeiros simulados, e cada vitória virou checkpoint.
  - O escudo da canhoneira rebateu 117 tiros.
  - As torres do dirigível caíram com 77 tiros, e só então o núcleo pôde ser ferido.
  - **Correção:** na vista de cima, um míssil acertava a blindagem do envelope antes de chegar a uma torre. As torres foram para a borda da frente, e um tiro alinhado com uma torre agora a acerta.
- **Outra correção:** no voo alto, com o mar encolhido, apareciam faixas verdes nas laterais, porque as "margens" do rio eram desenhadas fora da tela. No oceano as margens não são mais desenhadas.

## Mudanças da versão 23 — bombas em estoque no oceano e ajuda nos chefes

### 44. Bomba no 2º botão (modo oceano)
- **Antes:** pegar o power-up de bomba detonava na hora e destruía todos os inimigos da tela.
- **Agora, no oceano:**
  - Cada power-up de bomba guarda **uma bomba no estoque**, até 5 (`BOMB_MAX`). O jogo começa com 1.
  - O estoque aparece no HUD, no canto direito (onde nos outros modos ficam as vidas), com as bombas disponíveis acesas.
  - A bomba é solta pelo **2º botão**: **X** ou **B** no teclado, **B** no controle e o botão **BOMBA** na tela do celular, embaixo do FOGO.
  - Sem bomba no estoque, o botão só faz um "clique" vazio.
- **Poder limitado:** cada bomba tem um orçamento de **40 pontos de dano** (`BOMB_POWER`), aplicado nesta ordem:
  1. apaga todos os tiros inimigos da tela (de graça);
  2. derruba os inimigos pequenos (caças, navios, helicópteros, balões, aviões), dos mais próximos do jato para os mais distantes, gastando 1 ponto cada;
  3. com o que sobrar, fere os porta-aviões (até 6 cada);
  4. por fim, o chefe (até 15). No dirigível, ela pega as torres primeiro.
- No voo alto, a bomba não alcança a superfície.
- **Efeito:** clarão, dois anéis de choque saindo do jato e um estrondo grave descendo.
- **Medido:** com 50 caças na tela, uma bomba derrubou 39, apagou os 12 tiros e não sobrou dano para o porta-aviões. No chefe, tirou exatamente 15.
- **Nos modos clássico e moderno:** nada muda. A bomba continua imediata ao ser coletada.

### 45. Power-ups de ajuda durante os chefes
- Durante cada luta com chefe cai um power-up perto do jato a cada ~7 s, com brilho e um aviso sonoro.
- **Sorteio:** bomba 30%, escudo 20%, tiro triplo 20%, tiro rápido 15%, reparo 15%.
- Como a câmera quase para durante a luta, eles descem devagar e dá tempo de pegar.
- **Medido:** em 30 s de luta caíram 6 power-ups.
- Para ajustar: `BOSS_DROPS` e o intervalo em `updateBoss()` (`js/ocean.js`).

## Mudanças da versão 24 — modo Retro Oceano (pixel art 240×320)

### 46. Retro Oceano (4ª opção do título)
- **Jogo:** é o modo Oceano, com a mesma lógica: ilhas, nuvens, altitude, esquadrilhas, porta-aviões, quatro chefes, bombas em estoque e vida única. Muda o desenho.
  - O código trata os dois como oceano por meio de `isOcean()`.
- **Resolução real de 240×320:**
  - A área de jogo tem 240 px de largura (`W`, que agora varia por modo) e 320 de altura.
  - O canvas é desenhado em 1× e a página amplia os pixels sem suavizar (`image-rendering: pixelated`): 480×640 no PC e a largura toda no celular, na proporção 3:4.
  - A tela de título continua a normal (`syncCanvas()` troca o canvas ao entrar e sair do retro).
- **Sprites em pixel art (originais, gerados por código, com contorno escuro automático):** jato do jogador, caça inimigo, navio visto de cima, helicóptero, balão em gomos, balsa de combustível, power-ups com ícone, tiros e míssil.
- **Animações intermediárias (para o movimento ficar fluido):**

| Elemento | Quadros |
|---|---|
| jato | 9 quadros de inclinação: a asa que desce encurta e escurece, a cabine desliza para o lado; chama em 2 quadros |
| caças | 32 rotações (a cada 11,25°) × 5 quadros de parafuso (achatamento e inversão) |
| navios | 32 rumos; o canhão é uma linha de pixels que mira o jato, com clarão |
| helicóptero | 4 quadros de rotor |
| balão | 8 quadros dos gomos girando |
| power-ups e tiros | brilho e pulso em 2 quadros |

  - As rotações usam "vizinho mais próximo", então os pixels continuam duros. Os quadros são gerados uma vez e guardados em cache.
- **Pixelização do resto:** mar, ilhas, nuvens, névoa, porta-aviões, chefes e explosões são desenhados em 1× e depois o quadro inteiro passa por **quantização**. Cada pixel vai para a cor mais próxima de uma paleta fixa de **32 cores**, com **pontilhado ordenado (Bayer 4×4)**, o que dá o pontilhado clássico nas nuvens, na névoa do voo alto e nas sombras. Uma tabela de 32.768 entradas torna isso uma consulta por pixel.
- **HUD em pixel:**
  - Os textos usam uma **fonte bitmap 5×7** própria (letras sem acento, números e símbolos ▲ ▼ ♥ ×), desenhada depois da quantização, com cores puras.
  - O HUD mostra placar, barra de vida, bombas, modo e altitude, os power-ups ativos com tempo, o aviso de altitude e a barra do chefe com a defesa atual.
  - Os rótulos dos power-ups e o quadro de fim de jogo também usam a fonte bitmap.
- **Controles:** iguais aos do oceano, inclusive a BOMBA no 2º botão e na tela do celular.
- **A verificar no aparelho:** o desempenho em celulares mais fracos. A quantização percorre os 76.800 pixels a cada quadro, e não foi possível medir o tempo no navegador de teste.

## Mudanças da versão 25 — interface em inglês, modo CLASSIC - PICO-8 e bomba espetacular

### 47. Interface padronizada em inglês
- Todos os textos que aparecem no jogo passaram para o inglês. O código e esta documentação continuam em português.

| Onde | Agora |
|---|---|
| modos (título) | CLASSIC, MODERN, OCEAN, RETRO OCEAN, CLASSIC - PICO-8, com descrições em inglês |
| título | "arrows or click to choose · ENTER or 2nd click to play" |
| HUD | CLASSIC / MODERN / OCEAN · ▲ HIGH / ▼ LOW |
| avisos de altitude | ▲ ABOVE THE CLOUDS / ▼ LOW-LEVEL FLIGHT |
| chefes | BOMBER, GUNSHIP, AIRSHIP, INTERCEPTOR — "BOSS — SECTION n", estados SHIELD / ARMORED (n turrets) / UNTOUCHABLE |
| power-ups | SHIELD, TRIPLE SHOT, RAPID FIRE, BOMB!, +1 LIFE, FULL REPAIR, BOMB +1 (n) |
| bônus | SQUADRON +500, BOSS DOWN! +40 |
| fim de jogo | GAME OVER, SPACE to return, "↑ ↓ reverse scrolling · PgUp/PgDn or Shift+↑↓: bridges", "− / + scroll speed" |
| botões de toque | FIRE, BOMB, BACK, PLAY, ◀ ▶ mode, bridge ▲ / bridge ▼ |
| legenda da página | em inglês; `lang="en"` |

### 48. Modo CLASSIC - PICO-8 (5ª opção do título)
- O modo **clássico** (margens e ilhas matam, combustível, pontes) no estilo do console de fantasia PICO-8: **128×128 pixels** e a **paleta de 16 cores** do PICO-8, ampliado sem suavização (512×512 no PC, largura toda no celular, proporção 1:1).
- **Escala:** a lógica do clássico roda numa escala interna 2× (`W = 256`, `VIEW_H = 224`) e é desenhada pela metade. Isso dá exatamente **128×112 de área de jogo + 16 px de HUD**. O código trata os dois como clássico por meio de `isClassic()`.
- **Mapa em pixels:** cada linha do mapa vira 1 pixel, então margens, beiradas, ilhas, estrada, faixa amarela e o deck da ponte são desenhados linha a linha, nítidos. As marolas são fixas por linha e a ponte destruída mostra a água.
- **Sprites em pixel art originais, só com as 16 cores:**
  - jato com **5 quadros de inclinação**;
  - navio, helicóptero com **2 quadros de rotor** (e a altitude mudando o tamanho);
  - avião, duas casas com árvore, tanque com canhão, tambor de combustível listrado e balões (vermelho e amarelo);
  - árvores redondas e pinheiros, campos com cerca e vacas.
- **Explosões:** círculos que esfriam (branco → amarelo → laranja → vermelho) e faíscas de 1 pixel na cor mais próxima da paleta.
- **HUD na faixa de baixo, com fonte 3×5 própria:** placar, medidor de combustível E–F (vermelho e piscando no fim), mini-jatos das vidas e a etiqueta PICO-8. O quadro de fim de jogo usa a mesma fonte.

### 49. Bomba espetacular (oceano e retro)
- **Pausa de impacto:** a simulação congela 7 quadros no instante da detonação, como nos fliperamas.
- **Clarão e tingimento:** a tela fica quase toda branca e depois esmaece num tingimento laranja.
- **Tremor de tela:** ~0,8 s, diminuindo aos poucos. Vale para os dois renderizadores.
- **Três ondas de choque:** branca, amarela e ciano, grossas e com atraso entre elas, varrendo a tela inteira.
- **Partículas:** 28 raios de luz saindo do jato, bola de fogo tripla, anel de fumaça que se expande, 40 faíscas e estrelinhas.
- **Destruição em cascata:** cada alvo só é atingido quando a onda de choque chega até ele (6 px por quadro), do mais perto ao mais longe. As explosões se espalham pela tela em sequência, em vez de tudo sumir de uma vez. O orçamento de dano continua o mesmo.
- **Som:** estrondo em cinco notas descendo, seguido de um ronco grave prolongado.
- **Medido:** com 12 caças espalhados, eles caíram em sequência entre ~0,5 s e 1 s depois da detonação.
- Para ajustar: `useBomb()` (`js/powerups.js`), `BOMB_WAVE` (`js/ocean.js`) e `shake()` / `freezeT` (`js/effects.js`).

## Mudanças da versão 26 — controle físico em todas as versões

### 50. Joystick/controle em todos os modos e no app Android
- **No navegador:** o controle já alimentava as mesmas entradas do teclado, então funciona em todos os modos. Ganhou dois complementos:
  - **Aviso de conexão:** "🎮 Controller connected" / "disconnected" no topo da tela por 2,5 s, em qualquer tela e modo.
  - **Botões de toque:** com um controle conectado, os botões somem no celular e o jogo fica centralizado na tela. Voltam quando o controle desconecta.
- **No app Android:**
  - O `MainActivity.java` agora captura os eventos do controle (Bluetooth ou USB) e os repassa ao jogo. A captura usa `dispatchKeyEvent` para os botões e `dispatchGenericMotionEvent` para o analógico e o direcional do tipo "hat".
  - Assim o controle funciona mesmo em aparelhos cujo WebView não oferece a Gamepad API. Quando os eventos vêm do Java, a leitura pela Gamepad API é desligada, para não duplicar os toques.
  - O botão **B** (que no Android costuma ser "voltar") não fecha mais o app: no oceano, é a bomba.
- **Mapeamento no Android:** A/R2/centro do direcional = atirar · B = bomba · X/Y = −/+ · L1/R1 = ponte anterior/próxima · Start = começar · direcional = setas · analógico esquerdo = movimento contínuo.
- **Testado com um controle simulado nos 5 modos:** o Start começou o jogo, o analógico moveu o jato e o A atirou em todos eles, e o aviso apareceu. A parte nativa do Android compila, mas ainda precisa ser testada num aparelho com controle.

## Mudanças da versão 27 — rio simétrico com quebras pontuais

### 51. Rio simétrico (Classic, Modern e PICO-8)
- **Antes:** a cada bloco o rio sorteava largura **e** posição, e serpenteava de um lado para o outro o tempo todo.
- **Agora:** o rio fica **centralizado e espelhado**. A largura continua sorteada por bloco, e as duas margens alargam e estreitam juntas, como uma respiração.
  - As ilhas já nascem no centro do rio, então também ficam simétricas.
  - No moderno, os paredões de rocha passam a ser **espelhados** (mesmo sorteio, mesma largura e mesmo recorte dos dois lados).
- **Quebras de simetria pontuais:** de vez em quando começa um **episódio de assimetria**.
  - O rio desvia 28–73 px para um lado durante 1 a 3 blocos e depois volta ao centro.
  - A chance de começar um episódio é de 14% por bloco no começo e chega a 26% na dificuldade máxima.
  - Nunca acontece na zona de respiro (início da seção) nem nos 3 blocos antes da ponte, que sempre chega centralizada.
  - Durante o episódio, cada margem sorteia o seu paredão.
- **Medido em 30 seções por modo:** ~80% dos blocos simétricos, cerca de 1 episódio de assimetria por seção, com duração média de 2,4 blocos. A largura mínima e a jogabilidade não mudaram.
- O oceano e o retro não têm margens, por isso não mudam.
- Para ajustar: o bloco "rio SIMÉTRICO" em `genBlock()` (`js/terrain.js`).

## Mudanças da versão 28 — cruz e gatilhos no controle

### 52. Direcional em cruz e gatilhos
- **Direcional em cruz:** move o jato (digital) em todos os modos, além de navegar nos menus.
  - Controles no mapeamento padrão (botões 12–15) já funcionavam.
  - Agora também a cruz de controles **fora do padrão**, que chega como eixos: eixos 6/7 ou o "POV" no eixo 9, comum em controles genéricos.
  - No app Android, a cruz vale tanto como teclas DPAD quanto como eixo HAT.
- **Gatilho direito (RT/R2):** atirar.
- **Gatilho esquerdo (LT/L2):** **bomba**, no oceano e no retro. Nos modos sem bomba não faz nada.
  - No Android os gatilhos são lidos como botão (L2/R2) e também como eixos analógicos (LTRIGGER/RTRIGGER ou BRAKE/GAS), que é como muitos controles os enviam.
- **Sem conflito entre fontes:** cada tecla do controle guarda quais fontes a seguram (botão, gatilho, cruz em eixo). Assim, A e RT juntos não "soltam" o tiro quando só um deles é solto.
- **Testado com controles simulados:** a cruz moveu o jato ±40 px em 20 quadros; o RT atirou; A+RT soltando só A manteve o fogo; o LT soltou a bomba no oceano e foi ignorado no clássico; a cruz por eixos (fora do padrão) moveu o jato na diagonal. A parte do Android compila, mas ainda precisa ser testada num aparelho com controle.

## Mudanças da versão 29 — mais bombas e power-ups no oceano

### 53. Começa com 3 bombas e há mais prêmios (Ocean e Retro Ocean)
- **Estoque de bombas:** o jogo começa com **3 bombas** (antes 1), e o estoque vai até **9** (antes 5). O HUD mostra todas.
- **Power-ups no mapa:** aparecem em ~**32%** dos blocos (antes ~16%). No oceano a bomba é a mais comum.

| Power-up | Chance no oceano |
|---|---|
| bomba | 32% |
| escudo | 20% |
| tiro triplo | 20% |
| tiro rápido | 16% |
| reparo | 12% |

- **Recompensas novas:**
  - **esquadrilha inteira derrubada:** além dos +500, solta um power-up onde caiu o último caça (50% de chance de ser bomba);
  - **porta-aviões afundado:** solta uma **bomba** e mais um power-up sorteado, pelo míssil ou pela bomba.
- **Lutas com chefes:** cai um power-up a cada **~5 s** (antes ~7 s), sorteando bomba 34%, escudo 20%, tiro triplo 20%, tiro rápido 14% e reparo 12%.
- **Medido:**
  - em 161 blocos gerados, 52 power-ups no oceano (16 bombas) e 59 no retro (20 bombas);
  - a esquadrilha derrubada soltou exatamente 1 power-up;
  - o porta-aviões afundado soltou bomba + reparo.
- Os modos clássico e moderno não mudam.
- Para ajustar: `BOMB_START`, `BOMB_MAX`, `OCEAN_PU_CHANCE` e `OCEAN_PU_W` (`js/powerups.js`); `BOSS_DROPS`, `dropPowerup()` e `carrierDrops()` (`js/ocean.js`).

## Observações
- Testei sem navegador com um robô simples, e a geração do mapa não gerou erros. Conferi o visual por captura de tela, mas não joguei uma partida inteira. A dificuldade só se avalia jogando.
- O som são só bipes simples.