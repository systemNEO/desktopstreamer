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

# write_env_file <work-dir> <stream-key> <domain>
# Schreibt .env mit STREAM_KEY und DOMAIN ins Work-Dir.
write_env_file() {
    local work_dir="$1"
    local stream_key="$2"
    local domain="$3"

    cat > "$work_dir/.env" <<EOF
STREAM_KEY=${stream_key}
DOMAIN=${domain}
EOF
}
