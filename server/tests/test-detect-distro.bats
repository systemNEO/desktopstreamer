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

@test "detect_distro: handles quoted ID values (ID=\"ubuntu\")" {
    local fake_release
    fake_release=$(mktemp)
    cat > "$fake_release" <<'EOF'
ID="ubuntu"
VERSION_ID="22.04"
EOF
    result=$(detect_distro "$fake_release")
    rm "$fake_release"
    [[ "$result" == "ubuntu" ]]
}

@test "detect_distro: returns 'unknown' when ID is empty" {
    local fake_release
    fake_release=$(mktemp)
    cat > "$fake_release" <<'EOF'
ID=
VERSION_ID="1"
EOF
    result=$(detect_distro "$fake_release")
    rm "$fake_release"
    [[ "$result" == "unknown" ]]
}

@test "detect_distro: returns 'unknown' when ID line missing entirely" {
    local fake_release
    fake_release=$(mktemp)
    cat > "$fake_release" <<'EOF'
VERSION_ID="1"
PRETTY_NAME="Mystery Linux"
EOF
    result=$(detect_distro "$fake_release")
    rm "$fake_release"
    [[ "$result" == "unknown" ]]
}
