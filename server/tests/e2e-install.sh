#!/usr/bin/env bash
# End-to-End-Test: install.sh in frischem Ubuntu-Container ausführen.
# DSKT_SKIP_COMPOSE überspringt den eigentlichen Compose-Up (das wird in
# Task 11 separat gegen Live-MediaMTX getestet, weil DinD-Volume-Pfade
# mit dem hier gewählten Sibling-Pattern kollidieren würden).
#
# Verifiziert:
#   - install.sh läuft ohne Fehler durch
#   - Distro wird als Tier-1 erkannt (kein Override-Prompt)
#   - Configs werden nach /opt/desktopstreamer-server/ gerendert
#   - .env, mediamtx.yml, Caddyfile sind korrekt befüllt
set -euo pipefail

REPO_DIR="$(cd "$(dirname "$0")/../.." && pwd)"
CONTAINER_NAME="dskt-server-e2e-test"

cleanup() {
    docker rm -f "$CONTAINER_NAME" 2>/dev/null >/dev/null || true
}
trap cleanup EXIT

echo "==> Starte Test-Container (Ubuntu 22.04 mit Docker-CLI)..."
docker rm -f "$CONTAINER_NAME" >/dev/null 2>&1 || true
docker run -d --name "$CONTAINER_NAME" \
    ubuntu:22.04 sleep 3600 >/dev/null

echo "==> Installiere Pre-Reqs (curl, sudo, openssl, xxd, docker-cli) im Container..."
docker exec "$CONTAINER_NAME" bash -c "
    apt-get update -qq >/dev/null
    apt-get install -y -qq curl sudo openssl xxd ca-certificates >/dev/null
    # Fake-Docker-CLI: install.sh prüft 'docker compose version' — wir installieren
    # nur das CLI als Marker, ohne echte Docker-Engine, weil wir Compose-Up
    # ohnehin via DSKT_SKIP_COMPOSE auslassen.
    apt-get install -y -qq docker.io docker-compose-v2 >/dev/null 2>&1 || \
    apt-get install -y -qq docker.io >/dev/null
" 2>&1 | tail -3

echo "==> Kopiere Server-Source ins Container..."
docker cp "$REPO_DIR/server" "$CONTAINER_NAME:/opt/source"

echo "==> Führe install.sh aus (IP-Modus, skip compose)..."
# Eingabe '2' = IP-Modus; DSKT_SKIP_COMPOSE überspringt den Container-Start
docker exec -e DSKT_SKIP_COMPOSE=1 "$CONTAINER_NAME" bash -c "
    cd /opt/source
    chmod +x install.sh
    echo '2' | bash install.sh
" 2>&1 | tail -20

echo ""
echo "==> Verifiziere gerenderte Configs..."

docker exec "$CONTAINER_NAME" bash -c "
    set -e
    cd /opt/desktopstreamer-server

    # Pflicht-Files vorhanden
    for f in mediamtx.yml docker-compose.yml Caddyfile .env; do
        [[ -f \$f ]] || { echo \"FEHLT: \$f\"; exit 1; }
    done
    echo '[OK] Alle Pflicht-Files vorhanden'

    # .env enthält STREAM_KEY (24 Hex-Zeichen)
    if grep -qE 'STREAM_KEY=\"[0-9a-f]{24}\"' .env; then
        echo '[OK] STREAM_KEY ist 24-Hex'
    else
        echo '[FEHLER] STREAM_KEY nicht im erwarteten Format'
        cat .env
        exit 1
    fi

    # IP-Modus: Caddyfile enthält 'tls internal'
    if grep -q 'tls internal' Caddyfile; then
        echo '[OK] Caddyfile ist IP-Variante'
    else
        echo '[FEHLER] Caddyfile nicht IP-Variante'
        cat Caddyfile
        exit 1
    fi
"

echo ""
echo "============================================"
echo " E2E-Test bestanden!"
echo "============================================"
