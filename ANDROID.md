# Versão Android

O jogo é HTML/JS. A versão Android é um app mínimo: um WebView em tela cheia que abre o jogo a partir de `android/app/src/main/assets/www`. Ela usa os controles na tela de `js/touch.js`.

## Exportar (a cada alteração)

```bash
scripts/export-android.sh
```

1. Copia `index.html`, `js/`, `icons/`, `manifest.webmanifest` e `sw.js` para os assets do app.
2. Se houver **JDK 17** e **Android SDK**, compila `dist/river-raid.apk`. Sem eles, só faz a cópia e avisa.

Para instalar num celular ligado por USB, com a depuração USB ativa:

```bash
adb install -r dist/river-raid.apk
```

## Preparar a máquina (uma vez)

São necessários o JDK 17, o Android SDK (platform 34 e build-tools) e o Gradle 8.7. Os downloads somam alguns GB.

```bash
sudo apt install openjdk-17-jdk
# Android SDK: instale o Android Studio, ou só as command-line tools:
#   https://developer.android.com/studio#command-line-tools-only
#   sdkmanager "platforms;android-34" "build-tools;34.0.0" "platform-tools"
export ANDROID_HOME=$HOME/Android/Sdk
# Gradle: pelo Android Studio, ou "sdk install gradle 8.7" (SDKMAN),
# depois "cd android && gradle wrapper" para criar o ./gradlew
```

## Sem compilar: PWA

Servido por http(s), o jogo é um PWA: tem manifesto, ícone e service worker, e funciona offline. Ele pode ser instalado no Android pelo Chrome, em "Adicionar à tela inicial", e roda em tela cheia com os mesmos controles.

Para testar na rede local:

```bash
python3 -m http.server 8000
```

No celular, abra `http://<ip-do-pc>:8000`.

Ao publicar uma versão nova do PWA, troque `VERSION` em `sw.js` para os aparelhos baixarem os arquivos novos.

## Controles na tela

| Tela | Botões |
|---|---|
| Título | **◀ ▶ modo** alterna Clássico/Moderno · **JOGAR**. Também dá para tocar direto na opção: o primeiro toque escolhe e o segundo começa. |
| Jogo | **joystick analógico** (o botão segue o polegar; quanto mais longe do centro, mais forte): lados movem · cima/baixo aceleram/freiam (clássico) ou sobem/descem (moderno) · **FOGO** redondo |
| Fim de jogo | **▲ ▼** direção da rolagem · **ponte ▲/▼** · **− +** velocidade · **VOLTAR** |
