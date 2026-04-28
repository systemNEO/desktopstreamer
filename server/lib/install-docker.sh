#!/usr/bin/env bash
# Installiert Docker via offiziellem get.docker.com-Skript, falls nicht schon vorhanden.

# Globale Flag: wird auf 1 gesetzt, wenn install_docker tatsächlich Docker
# frisch installiert hat (Gruppe ist dann im aktuellen Prozess noch nicht
# aktiv und der Caller muss `docker compose` mit elevation ausführen).
# shellcheck disable=SC2034  # used by install.sh after sourcing
export DOCKER_FRESHLY_INSTALLED=0

# _sudo_or_root <cmd...>
# Führt cmd via sudo aus, oder direkt wenn EUID=0.
# Failed sauber wenn sudo gebraucht aber nicht verfügbar.
_sudo_or_root() {
    if [[ $EUID -eq 0 ]]; then
        "$@"
    elif command -v sudo >/dev/null 2>&1; then
        sudo "$@"
    else
        echo "FEHLER: sudo nicht verfügbar und Skript läuft nicht als root." >&2
        return 1
    fi
}

# is_docker_installed
# Exit 0 wenn Docker und Compose-Plugin vorhanden, sonst Exit 1.
is_docker_installed() {
    command -v docker >/dev/null 2>&1 && docker compose version >/dev/null 2>&1
}

# can_run_docker
# Exit 0 wenn der aktuelle Prozess Docker nutzen darf (Mitglied der
# docker-Gruppe ODER root). Wichtig: die Gruppe muss zur Prozess-Erstellung
# bereits aktiv gewesen sein — frisch via usermod hinzugefügte Gruppen
# greifen erst nach Re-Login.
can_run_docker() {
    [[ $EUID -eq 0 ]] && return 0
    id -nG "$USER" 2>/dev/null | grep -qw docker
}

# install_docker
# Lädt und führt das offizielle Docker-Installations-Skript aus.
# Fügt den aktuellen User zur docker-Gruppe hinzu (greift erst nach Re-Login).
# Aktiviert und startet den docker-Service.
# Setzt DOCKER_FRESHLY_INSTALLED=1 bei erfolgreicher Frisch-Installation.
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

    echo "==> Installiere Docker (erfordert Root-Rechte)..."
    if ! _sudo_or_root sh /tmp/get-docker.sh; then
        echo "FEHLER: Docker-Installation fehlgeschlagen." >&2
        rm -f /tmp/get-docker.sh
        return 1
    fi
    rm -f /tmp/get-docker.sh

    if [[ $EUID -ne 0 ]]; then
        echo "==> Füge $USER zur docker-Gruppe hinzu..."
        _sudo_or_root usermod -aG docker "$USER"
    fi

    echo "==> Aktiviere und starte docker-Service..."
    _sudo_or_root systemctl enable --now docker

    DOCKER_FRESHLY_INSTALLED=1
    echo "Docker erfolgreich installiert: $(docker --version)"
}
