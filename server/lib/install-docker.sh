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
