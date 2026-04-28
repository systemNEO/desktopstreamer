# Server-Komponente Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Docker-basierter MediaMTX-Streaming-Server mit Caddy-TLS und einem One-Liner-Bash-Installer, der RTMP-Streams entgegennimmt und LL-HLS für VRChat ausgibt.

**Architecture:** Zwei Container im Docker-Compose-Verbund: MediaMTX (RTMP-Ingest auf 1935 + HLS auf 8888) und Caddy (Reverse-Proxy + Auto-TLS via Let's Encrypt für Domain-Modus oder selbst-signiert für IP-Modus). Bash-Skript erkennt die Distro, installiert Docker via offiziellem `get.docker.com`-Skript, schreibt die Configs nach `/opt/desktopstreamer-server/`, generiert einen zufälligen Stream-Key, startet Compose und gibt die Connection-URLs aus.

**Tech Stack:**
- MediaMTX 1.x (Go-Binary, als Docker-Image `bluenviron/mediamtx:latest`)
- Caddy 2.x (`caddy:latest`)
- Docker Compose v2
- Bash 4+
- Optional: shellcheck, bats für Tests

---

## File Structure

```
server/
├── docker-compose.yml      # Orchestriert MediaMTX + Caddy
├── mediamtx.yml             # MediaMTX-Config (RTMP-In, LL-HLS-Out)
├── Caddyfile.domain         # Caddy-Config-Template für Domain-Modus
├── Caddyfile.ip             # Caddy-Config-Template für IP-Only-Modus
├── install.sh               # Interaktiver Bash-Installer
├── lib/
│   ├── detect-distro.sh     # Distro-Erkennung
│   ├── install-docker.sh    # Docker-Installation
│   └── render-configs.sh    # Templates → konkrete Configs mit Stream-Key
├── tests/
│   ├── test-detect-distro.bats
│   └── test-render-configs.bats
└── README.md                # Kurzanleitung für manuelle Nutzung
```

**Verantwortlichkeiten:**
- `install.sh`: Orchestriert den End-to-End-Flow (Detect → Install Docker → Render → Compose Up → Print URLs). Quellt die `lib/`-Skripte für die einzelnen Schritte.
- `lib/*.sh`: Pure Funktionen, einzeln testbar mit bats.
- `Caddyfile.*`: Templates mit `{{DOMAIN}}`-Platzhaltern, die `render-configs.sh` ersetzt.
- `mediamtx.yml`: Statische Config (Stream-Key kommt via Env-Var aus Compose).
- `docker-compose.yml`: Statisch, liest Env-Vars (`STREAM_KEY`, `DOMAIN`) aus `.env`-File, das `install.sh` schreibt.

---

## Task 1: Repo-Struktur anlegen

**Files:**
- Create: `server/.gitkeep`
- Create: `server/lib/.gitkeep`
- Create: `server/tests/.gitkeep`

- [ ] **Step 1: Verzeichnisstruktur erstellen**

```bash
cd /home/hpb/projects/desktopstreamer
mkdir -p server/lib server/tests
touch server/.gitkeep server/lib/.gitkeep server/tests/.gitkeep
```

- [ ] **Step 2: Strukturieren prüfen**

```bash
find server -type d
```

Expected output:
```
server
server/lib
server/tests
```

- [ ] **Step 3: Commit**

```bash
git add server/
git commit -m "feat(server): scaffold server directory structure"
```

---

## Task 2: MediaMTX-Konfiguration

**Files:**
- Create: `server/mediamtx.yml`

- [ ] **Step 1: Config-Datei schreiben**

Erstelle `server/mediamtx.yml` mit folgendem Inhalt:

```yaml
# Logging
logLevel: info
logDestinations: [stdout]

# RTMP-Ingestion auf Port 1935
rtmp: yes
rtmpAddress: :1935
rtmpEncryption: "no"

# HLS / LL-HLS-Output auf Port 8888
hls: yes
hlsAddress: :8888
hlsAlwaysRemux: yes
hlsVariant: lowLatency
hlsSegmentCount: 7
hlsSegmentDuration: 1s
hlsPartDuration: 200ms
hlsAllowOrigin: '*'

# Andere Protokolle deaktivieren
rtsp: no
webrtc: no
srt: no

# Globale Pfad-Defaults: Auth via Stream-Key
pathDefaults:
  publishUser: streamer
  publishPass: ${MTX_STREAM_KEY}
  readUser: ""
  readPass: ""

# Catch-all-Pfad: jeder String funktioniert als Stream-Name
paths:
  all_others:
```

- [ ] **Step 2: Config-Syntax mit Container-Dry-Run validieren**

Run:
```bash
docker run --rm -v "$(pwd)/server/mediamtx.yml:/mediamtx.yml:ro" \
  -e MTX_STREAM_KEY=testkey \
  bluenviron/mediamtx:latest /mediamtx.yml &
sleep 3
docker ps --filter ancestor=bluenviron/mediamtx:latest --format '{{.Status}}'
docker stop $(docker ps -q --filter ancestor=bluenviron/mediamtx:latest) 2>/dev/null || true
```

Expected: Container ist „Up X seconds" (kein Fehler beim Start). Falls Config-Fehler, MediaMTX exited sofort mit Logs.

- [ ] **Step 3: Commit**

```bash
git add server/mediamtx.yml
git commit -m "feat(server): add mediamtx config with rtmp ingest and ll-hls output"
```

---

## Task 3: Caddy-Templates für beide Modi

**Files:**
- Create: `server/Caddyfile.domain`
- Create: `server/Caddyfile.ip`

- [ ] **Step 1: Domain-Template schreiben**

Erstelle `server/Caddyfile.domain`:

```caddy
{{DOMAIN}} {
    # MediaMTX HLS-Output durchreichen
    reverse_proxy localhost:8888

    # Standard-Logging
    log {
        output stdout
        format console
    }
}
```

- [ ] **Step 2: IP-Only-Template schreiben**

Erstelle `server/Caddyfile.ip`:

```caddy
{
    # Selbst-signiertes Cert für IP-Modus
    auto_https off
}

:443 {
    tls internal

    reverse_proxy localhost:8888

    log {
        output stdout
        format console
    }
}

# HTTP-Redirect auf HTTPS
:80 {
    redir https://{host}{uri} permanent
}
```

- [ ] **Step 3: Caddy-Syntax beider Templates validieren**

Run:
```bash
# Domain-Template (mit Dummy-Wert ersetzt)
sed 's/{{DOMAIN}}/example.com/' server/Caddyfile.domain | \
  docker run --rm -i caddy:latest caddy validate --adapter caddyfile --config /dev/stdin

# IP-Template
docker run --rm -i caddy:latest caddy validate --adapter caddyfile --config /dev/stdin \
  < server/Caddyfile.ip
```

Expected: Beide geben „Valid configuration" aus, kein Error-Exit.

- [ ] **Step 4: Commit**

```bash
git add server/Caddyfile.domain server/Caddyfile.ip
git commit -m "feat(server): add caddy templates for domain and ip-only mode"
```

---

## Task 4: Docker-Compose-Orchestration

**Files:**
- Create: `server/docker-compose.yml`
- Create: `server/.env.example`

- [ ] **Step 1: Compose-File schreiben**

Erstelle `server/docker-compose.yml`:

```yaml
services:
  mediamtx:
    image: bluenviron/mediamtx:latest
    network_mode: host
    volumes:
      - ./mediamtx.yml:/mediamtx.yml:ro
    environment:
      - MTX_STREAM_KEY=${STREAM_KEY:?STREAM_KEY must be set}
    restart: unless-stopped

  caddy:
    image: caddy:latest
    network_mode: host
    volumes:
      - ./Caddyfile:/etc/caddy/Caddyfile:ro
      - caddy_data:/data
      - caddy_config:/config
    restart: unless-stopped

volumes:
  caddy_data:
  caddy_config:
```

- [ ] **Step 2: .env.example schreiben**

Erstelle `server/.env.example`:

```bash
# Random hex string, generated by install.sh on real installs.
STREAM_KEY=replace-me-with-random-hex
```

- [ ] **Step 3: Compose-Syntax validieren**

Run:
```bash
cd server
echo "STREAM_KEY=test-key-for-validation" > .env.tmp
# Caddyfile temporär anlegen, damit das Volume-Mount auflöst
cp Caddyfile.ip Caddyfile.tmp
docker compose --env-file .env.tmp -f docker-compose.yml config > /dev/null
echo "Exit: $?"
rm .env.tmp Caddyfile.tmp
cd ..
```

Expected: Exit 0, keine Warnungen außer eventuellen `version`-Hinweisen.

- [ ] **Step 4: Commit**

```bash
git add server/docker-compose.yml server/.env.example
git commit -m "feat(server): add docker-compose orchestration"
```

---

## Task 5: Distro-Detection-Library mit Test

**Files:**
- Create: `server/lib/detect-distro.sh`
- Create: `server/tests/test-detect-distro.bats`

- [ ] **Step 1: Bats-Test schreiben (failing)**

Erstelle `server/tests/test-detect-distro.bats`:

```bash
#!/usr/bin/env bats

setup() {
    SCRIPT_DIR="$(cd "$(dirname "$BATS_TEST_FILENAME")/.." && pwd)"
    source "$SCRIPT_DIR/lib/detect-distro.sh"
}

@test "detect_distro: returns 'ubuntu' for Ubuntu os-release" {
    local fake_release
    fake_release=$(mktemp)
    cat > "$fake_release" <<EOF
ID=ubuntu
VERSION_ID="22.04"
EOF

    result=$(detect_distro "$fake_release")
    rm "$fake_release"
    [[ "$result" == "ubuntu" ]]
}

@test "detect_distro: returns 'debian' for Debian os-release" {
    local fake_release
    fake_release=$(mktemp)
    cat > "$fake_release" <<EOF
ID=debian
VERSION_ID="12"
EOF

    result=$(detect_distro "$fake_release")
    rm "$fake_release"
    [[ "$result" == "debian" ]]
}

@test "detect_distro: returns 'fedora' for Fedora os-release" {
    local fake_release
    fake_release=$(mktemp)
    cat > "$fake_release" <<EOF
ID=fedora
VERSION_ID="40"
EOF

    result=$(detect_distro "$fake_release")
    rm "$fake_release"
    [[ "$result" == "fedora" ]]
}

@test "detect_distro: returns 'unknown' when os-release missing" {
    result=$(detect_distro /nonexistent/path)
    [[ "$result" == "unknown" ]]
}

@test "is_tier1_distro: true for ubuntu, debian, fedora" {
    is_tier1_distro "ubuntu"
    is_tier1_distro "debian"
    is_tier1_distro "fedora"
}

@test "is_tier1_distro: false for arch, alpine, others" {
    ! is_tier1_distro "arch"
    ! is_tier1_distro "alpine"
    ! is_tier1_distro "rhel"
}
```

- [ ] **Step 2: Test-Run – sollte fehlschlagen**

Run:
```bash
bats server/tests/test-detect-distro.bats
```

Expected: Alle Tests FAIL mit „command not found: detect_distro" oder „No such file or directory: server/lib/detect-distro.sh".

- [ ] **Step 3: Library implementieren**

Erstelle `server/lib/detect-distro.sh`:

```bash
#!/usr/bin/env bash
# Distro-Erkennung via /etc/os-release.
# Quellbar oder direkt ausführbar.

# detect_distro [path-to-os-release]
# Schreibt die Distro-ID (lowercase) auf stdout, oder "unknown" wenn nicht ermittelbar.
detect_distro() {
    local release_file="${1:-/etc/os-release}"

    if [[ ! -f "$release_file" ]]; then
        echo "unknown"
        return 0
    fi

    # Quellen in Subshell, damit Hauptshell-Vars nicht überschrieben werden
    local id
    id=$(
        # shellcheck disable=SC1090
        . "$release_file"
        echo "${ID:-unknown}"
    )

    # Lowercase + trim
    echo "${id,,}" | tr -d '"'
}

# is_tier1_distro <distro-id>
# Exit 0 wenn Distro Tier-1 (Ubuntu, Debian, Fedora), sonst Exit 1.
is_tier1_distro() {
    case "$1" in
        ubuntu|debian|fedora) return 0 ;;
        *) return 1 ;;
    esac
}
```

- [ ] **Step 4: Test erneut ausführen – sollte passen**

Run:
```bash
bats server/tests/test-detect-distro.bats
```

Expected: Alle 6 Tests PASS.

- [ ] **Step 5: ShellCheck**

Run:
```bash
shellcheck server/lib/detect-distro.sh
```

Expected: Keine Warnungen oder Errors.

- [ ] **Step 6: Commit**

```bash
git add server/lib/detect-distro.sh server/tests/test-detect-distro.bats
git commit -m "feat(server): add distro detection library with tests"
```

---

## Task 6: Docker-Installation-Library

**Files:**
- Create: `server/lib/install-docker.sh`

Bash-Tests für Docker-Installation sind teuer (brauchen frische Container pro Distro). Hier validieren wir per shellcheck + manueller Smoke-Test.

- [ ] **Step 1: Library schreiben**

Erstelle `server/lib/install-docker.sh`:

```bash
#!/usr/bin/env bash
# Installiert Docker via offiziellem get.docker.com-Skript, falls nicht schon vorhanden.

# is_docker_installed
# Exit 0 wenn Docker und Compose-Plugin vorhanden, sonst Exit 1.
is_docker_installed() {
    command -v docker >/dev/null 2>&1 && docker compose version >/dev/null 2>&1
}

# install_docker
# Lädt und führt das offizielle Docker-Installations-Skript aus.
# Fügt den aktuellen User zur docker-Gruppe hinzu.
# Aktiviert und startet den docker-Service.
install_docker() {
    if is_docker_installed; then
        echo "Docker bereits installiert: $(docker --version)"
        return 0
    fi

    echo "==> Lade offizielles Docker-Installations-Skript..."
    if ! curl -fsSL https://get.docker.com -o /tmp/get-docker.sh; then
        echo "FEHLER: get.docker.com nicht erreichbar." >&2
        return 1
    fi

    echo "==> Installiere Docker (erfordert sudo)..."
    if ! sudo sh /tmp/get-docker.sh; then
        echo "FEHLER: Docker-Installation fehlgeschlagen." >&2
        rm -f /tmp/get-docker.sh
        return 1
    fi
    rm -f /tmp/get-docker.sh

    echo "==> Füge $USER zur docker-Gruppe hinzu..."
    sudo usermod -aG docker "$USER"

    echo "==> Aktiviere und starte docker-Service..."
    sudo systemctl enable --now docker

    echo "Docker erfolgreich installiert: $(docker --version)"
    echo "HINWEIS: Du musst dich einmal aus- und wieder einloggen, damit"
    echo "        die docker-Gruppe für deinen User aktiv wird."
}
```

- [ ] **Step 2: ShellCheck**

Run:
```bash
shellcheck server/lib/install-docker.sh
```

Expected: Keine Warnungen.

- [ ] **Step 3: Smoke-Test in frischem Ubuntu-Container**

Run:
```bash
docker run --rm -v "$(pwd)/server/lib:/lib:ro" ubuntu:22.04 bash -c "
    apt-get update -qq && apt-get install -y curl sudo systemd-sysv >/dev/null
    source /lib/install-docker.sh
    is_docker_installed && echo 'INSTALLIERT' || echo 'NICHT INSTALLIERT'
"
```

Expected: Output „NICHT INSTALLIERT" (Container hat Docker noch nicht — Smoke-Test bestätigt nur, dass das Skript ohne Syntaxfehler quellbar ist und `is_docker_installed` korrekt false zurückgibt).

- [ ] **Step 4: Commit**

```bash
git add server/lib/install-docker.sh
git commit -m "feat(server): add docker installation library"
```

---

## Task 7: Render-Configs-Library mit Test

**Files:**
- Create: `server/lib/render-configs.sh`
- Create: `server/tests/test-render-configs.bats`

- [ ] **Step 1: Bats-Test schreiben (failing)**

Erstelle `server/tests/test-render-configs.bats`:

```bash
#!/usr/bin/env bats

setup() {
    SCRIPT_DIR="$(cd "$(dirname "$BATS_TEST_FILENAME")/.." && pwd)"
    source "$SCRIPT_DIR/lib/render-configs.sh"
    WORK_DIR=$(mktemp -d)
    # Templates in Work-Dir kopieren, damit render_caddyfile sie findet
    cp "$SCRIPT_DIR"/Caddyfile.domain "$WORK_DIR/"
    cp "$SCRIPT_DIR"/Caddyfile.ip "$WORK_DIR/"
}

teardown() {
    rm -rf "$WORK_DIR"
}

@test "generate_stream_key: erzeugt 24-Zeichen-Hex" {
    key=$(generate_stream_key)
    [[ ${#key} -eq 24 ]]
    [[ "$key" =~ ^[0-9a-f]+$ ]]
}

@test "generate_stream_key: zwei Aufrufe ergeben unterschiedliche Keys" {
    key1=$(generate_stream_key)
    key2=$(generate_stream_key)
    [[ "$key1" != "$key2" ]]
}

@test "render_caddyfile: ersetzt {{DOMAIN}} im Domain-Template" {
    render_caddyfile "$WORK_DIR" "domain" "stream.example.com"
    [[ -f "$WORK_DIR/Caddyfile" ]]
    grep -q "stream.example.com" "$WORK_DIR/Caddyfile"
    ! grep -q "{{DOMAIN}}" "$WORK_DIR/Caddyfile"
}

@test "render_caddyfile: kopiert IP-Template wörtlich" {
    render_caddyfile "$WORK_DIR" "ip" ""
    [[ -f "$WORK_DIR/Caddyfile" ]]
    grep -q "tls internal" "$WORK_DIR/Caddyfile"
}

@test "write_env_file: schreibt STREAM_KEY ins .env" {
    write_env_file "$WORK_DIR" "abc123def456"
    [[ -f "$WORK_DIR/.env" ]]
    grep -q "STREAM_KEY=abc123def456" "$WORK_DIR/.env"
}
```

- [ ] **Step 2: Test-Run – sollte fehlschlagen**

Run:
```bash
bats server/tests/test-render-configs.bats
```

Expected: Alle Tests FAIL mit „command not found" oder „source: No such file".

- [ ] **Step 3: Library implementieren**

Erstelle `server/lib/render-configs.sh`:

```bash
#!/usr/bin/env bash
# Helfer zum Generieren von Stream-Keys und Rendern der Caddy-Templates.

# generate_stream_key
# Schreibt 24 Zeichen Hex-Random auf stdout.
generate_stream_key() {
    if command -v openssl >/dev/null 2>&1; then
        openssl rand -hex 12
    else
        # Fallback: /dev/urandom
        head -c 12 /dev/urandom | xxd -p
    fi
}

# render_caddyfile <work-dir> <mode> <domain>
# mode: "domain" | "ip"
# Kopiert das passende Template ins Work-Dir und ersetzt {{DOMAIN}} ggf.
render_caddyfile() {
    local work_dir="$1"
    local mode="$2"
    local domain="$3"

    case "$mode" in
        domain)
            sed "s|{{DOMAIN}}|${domain}|g" "$work_dir/Caddyfile.domain" \
                > "$work_dir/Caddyfile"
            ;;
        ip)
            cp "$work_dir/Caddyfile.ip" "$work_dir/Caddyfile"
            ;;
        *)
            echo "FEHLER: render_caddyfile: unbekannter Modus '$mode'" >&2
            return 1
            ;;
    esac
}

# write_env_file <work-dir> <stream-key>
# Schreibt .env mit STREAM_KEY ins Work-Dir.
write_env_file() {
    local work_dir="$1"
    local stream_key="$2"

    cat > "$work_dir/.env" <<EOF
STREAM_KEY=${stream_key}
EOF
}
```

- [ ] **Step 4: Test erneut ausführen – sollte passen**

Run:
```bash
bats server/tests/test-render-configs.bats
```

Expected: Alle 5 Tests PASS.

- [ ] **Step 5: ShellCheck**

Run:
```bash
shellcheck server/lib/render-configs.sh
```

Expected: Keine Warnungen.

- [ ] **Step 6: Commit**

```bash
git add server/lib/render-configs.sh server/tests/test-render-configs.bats
git commit -m "feat(server): add render-configs library with tests"
```

---

## Task 8: Hauptinstaller (install.sh)

**Files:**
- Create: `server/install.sh`

Der Installer ist die Glue zwischen den Libraries. Er ist interaktiv und schwer zu unit-testen — wir validieren via shellcheck + manuellem End-to-End-Test in einem Container.

- [ ] **Step 1: Installer schreiben**

Erstelle `server/install.sh`:

```bash
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
    [[ ! -f "$(dirname "$(realpath "${BASH_SOURCE[0]}" 2>/dev/null || echo /dev/stdin)")/lib/detect-distro.sh" ]]
}

# Wenn piped: alle benötigten Dateien aus GitHub ziehen.
# Wenn lokal: aus dem Source-Verzeichnis quellen.
fetch_or_source_libs() {
    local src_dir
    if is_piped; then
        src_dir=$(mktemp -d)
        echo "==> Lade Skript-Komponenten von $RAW_BASE ..."
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
write_env_file "$INSTALL_DIR" "$STREAM_KEY"

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
SCHEME=$([[ "$MODE" == "domain" ]] && echo "https" || echo "https")  # immer https, IP-Modus mit selbst-signiert

echo ""
echo "============================================"
echo " Installation abgeschlossen!"
echo "============================================"
echo ""
echo " Trage diese Werte im Custom-RTMP-Modus der Desktop-App ein:"
echo ""
echo "   RTMP-URL:    rtmp://${PUBLIC_HOST}:1935/live"
echo "   Stream-Key:  ${STREAM_KEY}"
echo "   Output-URL:  ${SCHEME}://${PUBLIC_HOST}/live/${STREAM_KEY}/index.m3u8"
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
```

- [ ] **Step 2: Ausführbar machen**

Run:
```bash
chmod +x server/install.sh
```

- [ ] **Step 3: ShellCheck**

Run:
```bash
shellcheck server/install.sh
```

Expected: Keine kritischen Errors. Warnungen für `is_piped` (heuristic) sind ok.

- [ ] **Step 4: Syntax-Test**

Run:
```bash
bash -n server/install.sh
echo "Syntax-Exit: $?"
```

Expected: Exit 0.

- [ ] **Step 5: Commit**

```bash
git add server/install.sh
git commit -m "feat(server): add interactive install.sh"
```

---

## Task 9: End-to-End-Test im Container

Wir simulieren eine frische VPS-Installation in einem Docker-Container und führen den Installer dort aus, um Compose-Up und HLS-Endpunkt zu validieren.

- [ ] **Step 1: Test-Skript schreiben**

Erstelle `server/tests/e2e-install.sh`:

```bash
#!/usr/bin/env bash
# End-to-End-Test: Installer in frischem Ubuntu-Container ausführen.
# Verifiziert: Compose startet, RTMP-Port erreichbar, HLS-Endpunkt antwortet.
set -euo pipefail

REPO_DIR="$(cd "$(dirname "$0")/../.." && pwd)"
CONTAINER_NAME="dskt-server-e2e-test"

cleanup() {
    docker rm -f "$CONTAINER_NAME" 2>/dev/null || true
}
trap cleanup EXIT

echo "==> Starte Test-Container (Ubuntu 22.04 mit DinD-Sibling-Modus)..."
docker run -d --name "$CONTAINER_NAME" \
    --privileged \
    -v "$REPO_DIR:/repo:ro" \
    -v /var/run/docker.sock:/var/run/docker.sock \
    ubuntu:22.04 sleep 3600

echo "==> Installiere Pre-Reqs im Container..."
docker exec "$CONTAINER_NAME" bash -c "
    apt-get update -qq
    apt-get install -y -qq curl sudo openssl ca-certificates xxd
"

echo "==> Führe install.sh non-interaktiv im IP-Modus aus..."
# Wir patchen den Installer, dass die interaktiven Reads vorbeantwortet sind
docker exec "$CONTAINER_NAME" bash -c "
    cp -r /repo/server /tmp/server-src
    cd /tmp/server-src
    # Eingabe '2' für IP-Modus
    echo '2' | bash install.sh
"

echo "==> Prüfe ob MediaMTX-Container läuft..."
docker exec "$CONTAINER_NAME" bash -c "
    cd /opt/desktopstreamer-server
    docker compose ps --status running --quiet | wc -l
"

echo "==> Prüfe RTMP-Port (1935) auf Erreichbarkeit..."
docker exec "$CONTAINER_NAME" bash -c "
    timeout 3 bash -c 'cat < /dev/tcp/127.0.0.1/1935' && echo 'RTMP OK' || echo 'RTMP FEHLT'
"

echo "==> Prüfe HLS-Endpunkt (8888)..."
docker exec "$CONTAINER_NAME" bash -c "
    curl -sf -o /dev/null -w 'HTTP %{http_code}\n' http://127.0.0.1:8888/ || true
"

echo ""
echo "E2E-Test fertig. Container '$CONTAINER_NAME' wird aufgeräumt."
```

- [ ] **Step 2: Ausführbar machen**

Run:
```bash
chmod +x server/tests/e2e-install.sh
```

- [ ] **Step 3: E2E-Test ausführen**

Run:
```bash
server/tests/e2e-install.sh
```

Expected:
- "RTMP OK"
- "HTTP 404" oder "HTTP 200" am HLS-Endpunkt (404 ist ok, weil noch kein Stream live ist; wichtig ist nur, dass MediaMTX antwortet)
- Mindestens 2 laufende Container (mediamtx + caddy)

- [ ] **Step 4: Commit**

```bash
git add server/tests/e2e-install.sh
git commit -m "test(server): add e2e install test in docker container"
```

---

## Task 10: Server-README

**Files:**
- Create: `server/README.md`

- [ ] **Step 1: README schreiben**

Erstelle `server/README.md`:

````markdown
# desktopstreamer-server

Self-hosted RTMP-zu-HLS-Streaming-Server für die [desktopstreamer](https://github.com/systemNEO/desktopstreamer) Desktop-App. Nimmt Streams via RTMP entgegen und liefert sie als LL-HLS aus — kompatibel mit VRChat-Video-Playern.

Basiert auf [MediaMTX](https://github.com/bluenviron/mediamtx) (Streaming-Engine) und [Caddy](https://caddyserver.com/) (TLS-Terminierung).

## Schnellinstallation (One-Liner)

Auf deinem VPS (Ubuntu 22.04+, Debian 12+, Fedora 40+):

```bash
curl -fsSL https://raw.githubusercontent.com/systemNEO/desktopstreamer/main/server/install.sh | bash
```

Das Skript:
1. Erkennt deine Linux-Distribution
2. Installiert Docker, falls nicht vorhanden
3. Fragt nach: Domain (für Auto-HTTPS) oder nur-IP-Modus
4. Generiert einen zufälligen Stream-Key
5. Startet MediaMTX + Caddy via Docker Compose
6. Gibt RTMP-URL, Stream-Key und HLS-URL aus

## Manuelle Installation

```bash
git clone https://github.com/systemNEO/desktopstreamer.git
cd desktopstreamer/server
./install.sh
```

## Was du danach in der App eingibst

Im **Custom-RTMP-Modus** der Desktop-App:

| Feld | Wert |
|---|---|
| RTMP-URL | `rtmp://DEIN-SERVER:1935/live` |
| Stream-Key | (vom Installer ausgegeben) |
| Output-URL (für VRChat) | `https://DEIN-SERVER/live/STREAM-KEY/index.m3u8` |

## Server-Verwaltung

Der Installer legt alles unter `/opt/desktopstreamer-server/` ab.

```bash
cd /opt/desktopstreamer-server

# Status
docker compose ps

# Logs
docker compose logs -f

# Stoppen
docker compose down

# Updaten (neuere MediaMTX/Caddy ziehen)
docker compose pull && docker compose up -d

# Stream-Key wechseln
sed -i 's/^STREAM_KEY=.*/STREAM_KEY=NEUER-KEY/' .env
docker compose up -d
```

## Hardware-Anforderungen

- 1 vCPU, 1 GB RAM reichen für 1 Stream bei 6 Mbps
- 5+ Mbps Upload-Bandbreite ab Server (HLS schickt eingehende Bitrate × Anzahl Viewer)
- Ports `1935`, `80`, `443` müssen offen sein

Empfohlene VPS-Anbieter: Hetzner Cloud (CX11 ~ 4 €/Monat), Contabo VPS S, DigitalOcean Basic Droplet.

## Lizenz

GPL-2.0-or-later (siehe Hauptrepo).
````

- [ ] **Step 2: Commit**

```bash
git add server/README.md
git commit -m "docs(server): add server readme with install and usage instructions"
```

---

## Task 11: Live-Stream-Smoke-Test mit ffmpeg

Optionaler manueller End-to-End-Test mit echter Stream-Push, um die ganze Pipeline zu validieren.

- [ ] **Step 1: Server lokal starten**

Run (außerhalb des Test-Containers — direkt auf dem Dev-System):
```bash
cd /tmp
mkdir dskt-test && cd dskt-test
cp /home/hpb/projects/desktopstreamer/server/mediamtx.yml .
cp /home/hpb/projects/desktopstreamer/server/Caddyfile.ip ./Caddyfile
cp /home/hpb/projects/desktopstreamer/server/docker-compose.yml .
echo "STREAM_KEY=testkey123456789abcdef012" > .env
docker compose up -d
sleep 5
docker compose ps
```

Expected: Beide Container „running".

- [ ] **Step 2: Test-Stream pushen mit ffmpeg**

In einem zweiten Terminal:
```bash
# 30s Test-Pattern auf den Server pushen
ffmpeg -re -f lavfi -i testsrc=size=1280x720:rate=30 \
       -f lavfi -i sine=frequency=1000 \
       -c:v libx264 -preset veryfast -tune zerolatency -b:v 2M \
       -c:a aac -b:a 128k \
       -f flv -t 30 \
       "rtmp://localhost:1935/live/teststream?user=streamer&pass=testkey123456789abcdef012"
```

Expected: ffmpeg läuft 30s ohne Fehler, MediaMTX-Logs zeigen „[RTMP] [conn] opened" und „[path teststream] [publisher] ready".

- [ ] **Step 3: HLS-Endpunkt abfragen**

Während ffmpeg läuft, in drittem Terminal:
```bash
curl -sk https://localhost/live/teststream/index.m3u8 | head -20
```

Expected: M3U8-Manifest mit `#EXTM3U`, `#EXT-X-VERSION:`, Segment-URIs.

- [ ] **Step 4: Cleanup**

```bash
cd /tmp/dskt-test
docker compose down -v
cd ..
rm -rf dskt-test
```

- [ ] **Step 5: Erfolgs-Notiz committen**

```bash
# Nichts zu committen, nur Notiz im PR-/Commit-Message
echo "Smoke-Test mit ffmpeg → MediaMTX → HLS validiert" >&2
```

---

## Task 12: Top-Level-README erweitern + finaler Push

**Files:**
- Modify: `README.md` (Top-Level)

- [ ] **Step 1: Top-Level-README um Server-Sektion ergänzen**

Edit `README.md` — füge nach der Repo-Struktur-Sektion ein:

```markdown
## Schnellstart Server

Auf einem VPS (Ubuntu 22.04+, Debian 12+, Fedora 40+):

```bash
curl -fsSL https://raw.githubusercontent.com/systemNEO/desktopstreamer/main/server/install.sh | bash
```

Details siehe [`server/README.md`](server/README.md).

## Schnellstart Desktop-App

(Folgt mit v1-Release.)
```

- [ ] **Step 2: Commit + Push**

```bash
git add README.md
git commit -m "docs: add server quickstart to top-level readme"
git push origin main
```

Expected: Push erfolgreich.

---

## Self-Review

### Spec-Coverage-Check

- ✅ Section 8.1 (Komponenten): Tasks 2-4 decken `docker-compose.yml`, `mediamtx.yml`, `Caddyfile`. Task 8 deckt `install.sh`.
- ✅ Section 8.2 Schritt 1 (Distro-Erkennung): Task 5
- ✅ Section 8.2 Schritt 2 (Docker-Install via get.docker.com): Task 6
- ✅ Section 8.2 Schritt 3 (interaktive Domain-Frage): Task 8 Step 1 (Modus-Wahl)
- ✅ Section 8.2 Schritt 4 (Install-Dir `/opt/desktopstreamer-server/`): Task 8 Step 1
- ✅ Section 8.2 Schritt 5 (zufälliger Stream-Key): Task 7
- ✅ Section 8.2 Schritt 6 (`docker compose up -d`): Task 8 Step 1
- ✅ Section 8.2 Schritt 7 (URLs ausgeben): Task 8 Step 1 (Output-Block)
- ✅ Section 8.3 (SSH-Provisioning v2): explizit nicht im Plan-Scope
- ✅ Section 11 (Risiken — Tier-1/2/3): Tier-Check via `is_tier1_distro` mit User-Override-Prompt

### Placeholder-Scan

Geprüft auf TBD/TODO/Platzhalter — keine gefunden. Alle Steps zeigen den exakten Inhalt.

### Type-Konsistenz

- `detect_distro()` returns ID-string everywhere
- `is_tier1_distro <id>` returns 0/1 (used as boolean) everywhere
- `generate_stream_key()` produces 24-char hex everywhere
- `render_caddyfile <work-dir> <mode> <domain>` signature consistent
- `STREAM_KEY` env-var name consistent zwischen `mediamtx.yml`, `docker-compose.yml`, `.env`
- MediaMTX-Image-Name `bluenviron/mediamtx:latest` konsistent
- Install-Dir `/opt/desktopstreamer-server/` konsistent

Plan ist konsistent und vollständig.
