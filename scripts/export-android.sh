#!/usr/bin/env bash
# export-android.sh — exporta o jogo para a versão Android.
#  1. copia o jogo web (index.html, js/, ícones, manifesto) para android/app/src/main/assets/www
#  2. se houver JDK 17 e Android SDK, compila o APK em dist/river-raid.apk
#     (e, com um celular ligado por USB com depuração ativa, instala com: adb install -r dist/river-raid.apk)
set -euo pipefail
cd "$(dirname "$0")/.."

WWW=android/app/src/main/assets/www
rm -rf "$WWW"; mkdir -p "$WWW"
cp -r index.html manifest.webmanifest sw.js icons js "$WWW"/
echo "✔ jogo copiado para $WWW"

SDK="${ANDROID_HOME:-${ANDROID_SDK_ROOT:-$HOME/Android/Sdk}}"
if ! command -v java >/dev/null 2>&1 || [ ! -d "$SDK/platforms" ]; then
  echo "⚠ APK não gerado: falta o JDK 17 e/ou o Android SDK (veja ANDROID.md)."
  exit 0
fi
echo "sdk.dir=$SDK" > android/local.properties
cd android
if [ -x ./gradlew ]; then ./gradlew -q assembleDebug; else gradle -q assembleDebug; fi
cd ..
mkdir -p dist && cp android/app/build/outputs/apk/debug/app-debug.apk dist/river-raid.apk
echo "✔ APK: dist/river-raid.apk"
