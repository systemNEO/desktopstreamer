#!/usr/bin/env bash
# desktopstreamer-server Installer
# Aufruf:
#   curl -fsSL https://raw.githubusercontent.com/systemNEO/desktopstreamer/main/server/install.sh | bash
# oder lokal:
#   ./install.sh
set -euo pipefail

REPO_URL="https://github.com/systemNEO/desktopstreamer"
RAW_BASE="https://raw.githubusercontent.com/systemNEO/desktopstreamer/main/server"
INSTALL_DIR="/opt/desktopstreamer-server"

# ---------- helpers ----------

# Erkennt, ob das Skript via "curl | bash" ausgeführt wird (Pipe-Modus)
# vs. lokal mit checkoutem Repo.
is_piped() {
    local self_dir
    self_dir=$(dirname "$(realpath "${BASH_SOURCE[0]}" 2>/dev/null || echo /dev/stdin)")
    [[ ! -f "$self_dir/lib/detect-distro.sh" ]]
}

# Wenn piped: alle benötigten Dateien aus GitHub ziehen.
# Wenn lokal: aus dem Source-Verzeichnis quellen.
fetch_or_source_libs() {
    local src_dir
    if is_piped; then
        src_dir=$(mktemp -d)
        echo "==> Lade Skript-Komponenten von $RAW_BASE ..." >&2
        for f in lib/detect-distro.sh lib/install-docker.sh lib/render-configs.sh \
                 docker-compose.yml mediamtx.yml \
                 Caddyfile.domain Caddyfile.ip; do
            mkdir -p "$src_dir/$(dirname "$f")"
            curl -fsSL "$RAW_BASE/$f" -o "$src_dir/$f"
        done
    else
        src_dir="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
    fi
    echo "$src_dir"
}

# ---------- main flow ----------

echo "============================================"
echo " desktopstreamer-server Installer"
echo " $REPO_URL"
echo "============================================"
echo ""

# 1. Quellen laden
SRC_DIR=$(fetch_or_source_libs)
# shellcheck disable=SC1091
source "$SRC_DIR/lib/detect-distro.sh"
# shellcheck disable=SC1091
source "$SRC_DIR/lib/install-docker.sh"
# shellcheck disable=SC1091
source "$SRC_DIR/lib/render-configs.sh"

# 2. Distro-Check
DISTRO=$(detect_distro)
echo "Erkannte Distribution: $DISTRO"
if ! is_tier1_distro "$DISTRO"; then
    echo ""
    echo "WARNUNG: '$DISTRO' ist nicht offiziell unterstützt (Tier-1: ubuntu, debian, fedora)."
    echo "Die Installation kann trotzdem klappen, aber wir geben keine Garantien."
    read -rp "Trotzdem fortfahren? (j/N) " confirm
    [[ "${confirm,,}" == "j" ]] || exit 1
fi

# 3. Docker installieren
install_docker

# 4. Modus wählen: Domain oder IP
echo ""
echo "Wie soll der Server erreichbar sein?"
echo "  1) Über eine Domain (empfohlen, automatisches HTTPS via Let's Encrypt)"
echo "  2) Nur über IP (selbst-signiertes Cert, Browser-Warnung bei VRChat-URL)"
read -rp "Wahl [1/2]: " mode_choice

case "$mode_choice" in
    1)
        MODE="domain"
        read -rp "Domain (z. B. stream.example.com): " DOMAIN
        if [[ -z "$DOMAIN" ]]; then
            echo "FEHLER: Domain darf nicht leer sein." >&2
            exit 1
        fi
        ;;
    2)
        MODE="ip"
        DOMAIN=""
        ;;
    *)
        echo "FEHLER: Ungültige Wahl." >&2
        exit 1
        ;;
esac

# 5. Install-Dir vorbereiten
echo ""
echo "==> Lege $INSTALL_DIR an..."
sudo mkdir -p "$INSTALL_DIR"
sudo chown "$USER:$USER" "$INSTALL_DIR"

# Templates und Configs in Install-Dir kopieren
cp "$SRC_DIR/mediamtx.yml" "$INSTALL_DIR/"
cp "$SRC_DIR/docker-compose.yml" "$INSTALL_DIR/"
cp "$SRC_DIR/Caddyfile.domain" "$INSTALL_DIR/"
cp "$SRC_DIR/Caddyfile.ip" "$INSTALL_DIR/"

# 6. Stream-Key generieren und Configs rendern
STREAM_KEY=$(generate_stream_key)
render_caddyfile "$INSTALL_DIR" "$MODE" "$DOMAIN"
write_env_file "$INSTALL_DIR" "$STREAM_KEY" "$DOMAIN"

# 7. Compose starten
echo ""
echo "==> Starte Container..."
cd "$INSTALL_DIR"
docker compose up -d

# Kurz warten und Health prüfen
sleep 3
if ! docker compose ps --status running --quiet | grep -q .; then
    echo "FEHLER: Container laufen nicht. Logs:" >&2
    docker compose logs --tail 50 >&2
    exit 1
fi

# 8. Output: Connection-URLs
PUBLIC_HOST="${DOMAIN:-$(curl -fsSL https://api.ipify.org 2>/dev/null || echo 'YOUR-SERVER-IP')}"

echo ""
echo "============================================"
echo " Installation abgeschlossen!"
echo "============================================"
echo ""
echo " Trage diese Werte im Custom-RTMP-Modus der Desktop-App ein:"
echo ""
echo "   RTMP-URL:    rtmp://${PUBLIC_HOST}:1935/live"
echo "   Stream-Key:  ${STREAM_KEY}"
echo "   Output-URL:  https://${PUBLIC_HOST}/live/${STREAM_KEY}/index.m3u8"
echo ""
if [[ "$MODE" == "ip" ]]; then
    echo " HINWEIS: IP-Modus nutzt ein selbst-signiertes TLS-Zertifikat."
    echo "          VRChat zeigt deshalb beim ersten Aufruf eine Warnung."
fi
echo ""
echo " Server-Verzeichnis: $INSTALL_DIR"
echo " Logs anzeigen:      cd $INSTALL_DIR && docker compose logs -f"
echo " Server stoppen:     cd $INSTALL_DIR && docker compose down"
echo " Server updaten:     cd $INSTALL_DIR && docker compose pull && docker compose up -d"
echo ""
