# desktopstreamer

Discord-artige Desktop-Streaming-App für Windows 11 — Bildschirm, Fenster oder reines Audio mit zwei Klicks an Twitch oder einen lokalen Server streamen, perfekt für die Anzeige in VRChat.

## Status

🚧 **Pre-Alpha** — aktuell in der Konzept-/Design-Phase. Implementation startet in Kürze.

Spec: [`docs/superpowers/specs/2026-04-28-desktopstreamer-design.md`](docs/superpowers/specs/2026-04-28-desktopstreamer-design.md)

## Was es macht

Drei Streaming-Ziele in einer schlanken Oberfläche:

- **Twitch** — direkt verbunden via OAuth, Channel-URL für VRChat wird automatisch zurückgegeben
- **Lokal** — App startet einen eingebauten MediaMTX-Server, optional mit Cloudflare-Tunnel für externen Zugriff (kein VPS nötig)
- **Custom RTMP** — beliebige andere Plattformen oder eigene Remote-Server

Drei Schritte: *Quelle wählen → Ziel wählen → Live*. Keine Szenen, keine Filter, keine 100-Knöpfe-UI. Wer das braucht, soll [OBS Studio](https://obsproject.com/) nehmen.

## Repo-Struktur

```
app/      Electron-Desktop-App (TypeScript + React + libobs)
server/   Optionales Remote-Server-Setup (Docker-Compose + install.sh)
docs/     Spec, User-Doku, Setup-Anleitungen
```

## Schnellstart Server

Auf einem VPS (Ubuntu 22.04+, Debian 12+, Fedora 40+):

```bash
curl -fsSL https://raw.githubusercontent.com/systemNEO/desktopstreamer/main/server/install.sh | bash
```

Details und manuelle Installation siehe [`server/README.md`](server/README.md).

## Schnellstart Desktop-App

(Folgt mit v1-Release.)

## Plattformen

| Target | Tier | Status |
|---|---|---|
| Windows 11 x64 | 1 | geplant für v1 |
| Windows 11 arm64 | 2 | geplant für v1 |
| Windows 11 x86 (32-bit) | 3 | best-effort |
| macOS | — | v2 |
| Linux | — | v2 |

## Lizenz

MIT — frei verwendbar. OBS Studio (GPL-2.0) wird zur Laufzeit als
unabhängiger Prozess gestartet, nicht eingebettet — die Lizenzen
beeinflussen sich daher nicht.
