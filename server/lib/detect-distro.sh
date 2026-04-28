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
