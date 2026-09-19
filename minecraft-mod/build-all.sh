#!/usr/bin/env bash
# Build the mod for both supported Minecraft lines and collect the jars in dist/.
#
#   JAVA_HOME_121  JDK 21+ used for the 1.21.11 build   (defaults to $JAVA_HOME)
#   JAVA_HOME_261  JDK 25+ used for the 26.1.x build    (defaults to $JAVA_HOME)
#
# 1.21.11 -> yarn mappings, class names like MinecraftClient (src/yarn/java)
# 26.1.x  -> unobfuscated game, official class names  (src/mojmap/java)
set -euo pipefail
cd "$(dirname "$0")"

JAVA_HOME_121="${JAVA_HOME_121:-${JAVA_HOME:-}}"
JAVA_HOME_261="${JAVA_HOME_261:-${JAVA_HOME:-}}"

mkdir -p dist

echo "==> Building 1.21.11 (JDK 21)"
JAVA_HOME="$JAVA_HOME_121" ./gradlew clean build
cp build/libs/*.jar dist/

echo "==> Building 26.1.2 (JDK 25)"
(
  cd mc26
  JAVA_HOME="$JAVA_HOME_261" ./gradlew clean build
)
cp mc26/build/libs/*.jar dist/

echo
echo "Artifacts in dist/:"
ls -1 dist/
