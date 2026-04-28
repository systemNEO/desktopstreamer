# desktopstreamer-server

Self-hosted RTMP-zu-HLS-Streaming-Server für die [desktopstreamer](https://github.com/systemNEO/desktopstreamer) Desktop-App. Nimmt Streams via RTMP entgegen und liefert sie als LL-HLS aus — kompatibel mit VRChat-Video-Playern.

Basiert auf [MediaMTX](https://github.com/bluenviron/mediamtx) (Streaming-Engine) und [Caddy](https://caddyserver.com/) (TLS-Terminierung).

## Schnellinstallation (One-Liner)

Auf deinem VPS (Ubuntu 22.04+, Debian 12+, Fedora 40+):

```bash
curl -fsSL https://raw.githubusercontent.com/systemNEO/desktopstreamer/main/server/install.sh | bash
```

Das Skript:
1. Erkennt deine Linux-Distribution (Tier-1: Ubuntu, Debian, Fedora)
2. Installiert Docker, falls nicht vorhanden
3. Fragt: Domain (für Auto-HTTPS) oder nur-IP-Modus (selbst-signiertes Cert)
4. Generiert einen zufälligen 24-Zeichen-Stream-Key
5. Startet MediaMTX + Caddy via Docker Compose
6. Gibt RTMP-URL, Stream-Key und HLS-URL aus

## Manuelle Installation

```bash
git clone https://github.com/systemNEO/desktopstreamer.git
cd desktopstreamer/server
./install.sh
```

## Auth-Modell

**Path-as-Secret** (wie Twitch und YouTube): der Stream-Key ist Teil des RTMP-Pfads. Beispiel:

- Du publishst nach: `rtmp://server:1935/live` mit Stream-Key `abc123...`
- MediaMTX sieht das als Pfad: `live/abc123...`
- HLS-Output: `https://server/live/abc123.../index.m3u8`

24 Zeichen Hex (96 Bits) sind brute-force-sicher — niemand wird den Pfad erraten.

## Was du danach in der Desktop-App eingibst

Im **Custom-RTMP-Modus**:

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
sed -i 's/^STREAM_KEY=.*/STREAM_KEY="NEUER-KEY"/' .env
docker compose restart mediamtx
```

## Re-Run-Verhalten

Wenn du das Install-Skript erneut ausführst, **bleibt der bestehende Stream-Key erhalten** (wird aus der `.env` gelesen). Caddy-Konfiguration und Compose-Definition werden neu gerendert — laufende Streams brechen also nicht ab, du kannst aber zwischen Domain- und IP-Modus wechseln, ohne den Key zu verlieren.

## Hardware-Anforderungen

- 1 vCPU, 1 GB RAM reichen für 1 Stream bei 6 Mbps
- 5+ Mbps Upload-Bandbreite ab Server (HLS schickt eingehende Bitrate × Anzahl Viewer)
- Ports `1935` (RTMP), `80` und `443` (HTTP/HTTPS) müssen offen sein

Empfohlene VPS-Anbieter: Hetzner Cloud (CX11 ~ 4 €/Monat), Contabo VPS S, DigitalOcean Basic Droplet.

## Datei-Struktur

```
server/
├── docker-compose.yml      # Orchestriert MediaMTX + Caddy
├── mediamtx.yml             # Streaming-Engine-Config (RTMP-In, HLS-Out)
├── Caddyfile.domain         # Caddy-Template für Domain-Modus
├── Caddyfile.ip             # Caddy-Template für IP-Only-Modus
├── install.sh               # Interaktiver Bash-Installer
├── lib/                     # Sourcing-Modules vom Installer
│   ├── detect-distro.sh
│   ├── install-docker.sh
│   └── render-configs.sh
└── tests/                   # bats-Unit-Tests + E2E-Container-Test
```

## Tests

Voraussetzungen: `bats`, `shellcheck`, `docker`.

```bash
# Unit-Tests (Bash-Libraries)
bats server/tests/test-detect-distro.bats
bats server/tests/test-render-configs.bats

# Lint
shellcheck server/lib/*.sh server/install.sh

# E2E-Test (frischer Ubuntu-Container, runs install.sh)
server/tests/e2e-install.sh
```

## Lizenz

GPL-2.0-or-later (siehe [Hauptrepo](https://github.com/systemNEO/desktopstreamer)).
