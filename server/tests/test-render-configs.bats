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
    write_env_file "$WORK_DIR" "abc123def456" ""
    [[ -f "$WORK_DIR/.env" ]]
    grep -q 'STREAM_KEY="abc123def456"' "$WORK_DIR/.env"
}

@test "write_env_file: schreibt DOMAIN ins .env" {
    write_env_file "$WORK_DIR" "xyz" "stream.example.com"
    grep -q 'DOMAIN="stream.example.com"' "$WORK_DIR/.env"
}

@test "render_caddyfile: ungültiger Modus liefert Exit 1" {
    run render_caddyfile "$WORK_DIR" "bogus" ""
    [[ "$status" -eq 1 ]]
    [[ "$output" =~ "unbekannter Modus" ]]
}

@test "read_existing_stream_key: liefert leeren String wenn .env fehlt" {
    result=$(read_existing_stream_key "$WORK_DIR")
    [[ -z "$result" ]]
}

@test "read_existing_stream_key: liefert STREAM_KEY aus existierender .env" {
    write_env_file "$WORK_DIR" "preserved-key-123" "example.com"
    result=$(read_existing_stream_key "$WORK_DIR")
    [[ "$result" == "preserved-key-123" ]]
}

@test "read_existing_stream_key: leerer STREAM_KEY in .env liefert leeren String" {
    cat > "$WORK_DIR/.env" <<EOF
STREAM_KEY=""
DOMAIN=""
EOF
    result=$(read_existing_stream_key "$WORK_DIR")
    [[ -z "$result" ]]
}
