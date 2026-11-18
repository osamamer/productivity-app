#!/usr/bin/env bash
# Builds the desktop .deb from a commit on master and installs it on this computer, so a change is
# in the installed app minutes after it is committed instead of after the GitHub release.
#
# Usage: desktop/scripts/install-local.sh [commit]   (default: HEAD)
#
# The version is computed exactly as release-desktop.yml does (<major.minor from VERSION>.<commit
# count>), so when CI later publishes the same commit, the installed app already has that version
# and the updater skips it. This only holds for a commit that reaches GitHub unchanged: build after
# pushing, or alongside the push, never a commit that may still be amended or rebased.
#
# Safe to run from several agents at once: builds take a lock and run one at a time, each builds
# the newest master commit that contains its own, and a build that is no newer than the installed
# version is skipped. Builds run in a separate worktree under the cache directory, so uncommitted
# work in any checkout never ends up in the package.
#
# Installing asks for the password through the desktop's polkit agent. A running Claritard is
# quit first and started again afterwards.
set -euo pipefail

PACKAGE=claritard-desktop
APP_BINARY=/opt/Claritard/claritard
CACHE_DIR="${XDG_CACHE_HOME:-$HOME/.cache}"
BUILD_DIR="$CACHE_DIR/claritard-local-build"
SOURCE_DIR="$BUILD_DIR/src"
UPDATER_CACHE="$CACHE_DIR/claritard-desktop-updater"
# Must match installMarkerPath and SCRIPT_NAME in src/debInstall.js: a Claritard launched while
# the marker names a live installer waits for it instead of having its files replaced under it.
INSTALL_MARKER="${XDG_RUNTIME_DIR:-/tmp}/claritard-update.pid"
INSTALLER_NAME=claritard-update

GIT_DIR="$(git rev-parse --path-format=absolute --git-common-dir)"
git_() { git --git-dir="$GIT_DIR" "$@"; }

log() { echo "==> $*"; }

installed_version() { dpkg-query -W -f='${Version}' "$PACKAGE" 2>/dev/null || true; }

# True when version $1 is strictly newer than $2 (an empty $2 counts as nothing installed).
newer_than() { [[ -z "$2" ]] || dpkg --compare-versions "$1" gt "$2"; }

on_master() {
    local commit="$1" ref
    for ref in refs/heads/master refs/remotes/origin/master; do
        git_ rev-parse -q --verify "$ref" >/dev/null && git_ merge-base --is-ancestor "$commit" "$ref" && return 0
    done
    return 1
}

version_of() {
    local commit="$1"
    echo "$(git_ show "$commit:VERSION" | cut -d. -f1,2).$(git_ rev-list --count "$commit")"
}

checkout_source() {
    local commit="$1"
    if [[ ! -e "$SOURCE_DIR/.git" ]]; then
        git_ worktree prune
        git_ worktree add --detach "$SOURCE_DIR" "$commit"
    else
        git -C "$SOURCE_DIR" checkout -q --detach --force "$commit"
    fi
}

# npm ci only when the lockfile changed since the last build, which keeps repeat builds fast.
install_dependencies() {
    local dir name stamp sum
    for dir in frontend/react desktop; do
        name="${dir//\//-}"
        stamp="$BUILD_DIR/npm-$name.sha256"
        sum="$(sha256sum "$SOURCE_DIR/$dir/package-lock.json" | cut -d' ' -f1)"
        if [[ ! -d "$SOURCE_DIR/$dir/node_modules" || "$(cat "$stamp" 2>/dev/null)" != "$sum" ]]; then
            log "Installing $dir dependencies"
            npm ci --prefix "$SOURCE_DIR/$dir" --no-audit --no-fund
            echo "$sum" > "$stamp"
        fi
    done
}

build_deb() {
    local version="$1" deb
    (cd "$SOURCE_DIR/desktop" && npm run build:resources)
    rm -rf "$SOURCE_DIR/desktop/dist"
    (
        cd "$SOURCE_DIR/desktop"
        npm version --no-git-tag-version --allow-same-version "$version" >/dev/null
        npx electron-builder --linux deb --publish never
    )
    git -C "$SOURCE_DIR" checkout -q -- desktop/package.json desktop/package-lock.json
    deb="$SOURCE_DIR/desktop/dist/${PACKAGE}_${version}_amd64.deb"
    # The repack makes this .deb a good base for the next differential update (see debDifferential.js).
    printf 'files:\n  - url: %s\n    sha512: none\n    size: 0\n' "$(basename "$deb")" > "$BUILD_DIR/latest-linux.yml"
    (cd "$SOURCE_DIR/desktop" && node scripts/debDifferential.js "$deb" "$BUILD_DIR/latest-linux.yml")
}

running_installer() {
    local pid
    pid="$(cat "$INSTALL_MARKER" 2>/dev/null)" || return 1
    [[ "$pid" =~ ^[0-9]+$ ]] && tr '\0' '\n' < "/proc/$pid/cmdline" 2>/dev/null | grep -qx "$INSTALLER_NAME"
}

wait_for_other_installer() {
    while running_installer; do
        log "Waiting for an update the app started installing"
        sleep 2
    done
}

# The app's main process: started from the binary, but neither one of its --type= helpers nor a
# script it runs as plain Node (ELECTRON_RUN_AS_NODE), such as the Firefox native messaging host.
app_pid() {
    local pid
    for pid in $(pgrep -f "^$APP_BINARY( |$)"); do
        tr '\0' '\n' < "/proc/$pid/cmdline" 2>/dev/null | grep -q -- '^--type=' && continue
        tr '\0' '\n' < "/proc/$pid/environ" 2>/dev/null | grep -q '^ELECTRON_RUN_AS_NODE=' && continue
        echo "$pid"
        return 0
    done
}

# Quits Claritard (SIGTERM runs its normal quit, which stops the local backend) and writes the
# command line it was started with to $1, empty when it was not running.
quit_app() {
    local relaunch_file="$1" pid
    : > "$relaunch_file"
    pid="$(app_pid)"
    [[ -z "$pid" ]] && return 0
    cp "/proc/$pid/cmdline" "$relaunch_file"
    kill -TERM "$pid"
    for _ in $(seq 60); do
        kill -0 "$pid" 2>/dev/null || return 0
        sleep 0.5
    done
    echo "Claritard did not quit within 30 s; installing anyway" >&2
}

relaunch_app() {
    local relaunch_file="$1"
    [[ -s "$relaunch_file" ]] || return 0
    local argv=()
    mapfile -d '' -t argv < "$relaunch_file"
    # 9>&-: the app must not inherit the build lock, or it holds it for as long as it runs.
    setsid -f "${argv[@]}" >/dev/null 2>&1 < /dev/null 9>&-
    log "Started Claritard again"
}

install_deb() {
    local deb="$1"
    # Run under the installer's name and announce it in the marker, as debInstall.js does.
    /bin/sh -c 'pkexec --disable-internal-agent dpkg -i "$1"' "$INSTALLER_NAME" "$deb" &
    local installer=$!
    echo "$installer" > "$INSTALL_MARKER"
    local status=0
    wait "$installer" || status=$?
    rm -f "$INSTALL_MARKER"
    return "$status"
}

keep_as_update_base() {
    local deb="$1"
    mkdir -p "$UPDATER_CACHE"
    cp -f "$deb" "$UPDATER_CACHE/installer.deb"
    cp -f "$deb.blockmap" "$UPDATER_CACHE/installer.deb.blockmap"
}

main() {
    local commit
    commit="$(git_ rev-parse --verify "${1:-HEAD}^{commit}")"
    if ! on_master "$commit"; then
        echo "$commit is not on master; only master commits are released with this version." >&2
        exit 1
    fi

    mkdir -p "$BUILD_DIR"
    exec 9> "$BUILD_DIR/lock"
    if ! flock -n 9; then
        log "Another local build is running; waiting for it"
        flock 9
    fi

    # Build the newest master commit that contains this one: queued builds collapse into one.
    local tip
    tip="$(git_ rev-parse -q --verify refs/heads/master || true)"
    if [[ -n "$tip" ]] && git_ merge-base --is-ancestor "$commit" "$tip"; then commit="$tip"; fi

    local version installed
    version="$(version_of "$commit")"
    installed="$(installed_version)"
    if ! newer_than "$version" "$installed"; then
        log "Installed $installed is already at or past $version; nothing to do"
        exit 0
    fi

    log "Building $version from ${commit:0:7}"
    checkout_source "$commit"
    install_dependencies
    build_deb "$version"
    local deb="$SOURCE_DIR/desktop/dist/${PACKAGE}_${version}_amd64.deb"

    wait_for_other_installer
    local relaunch_file="$BUILD_DIR/relaunch"
    quit_app "$relaunch_file"
    # Quitting can start an update the app had downloaded; let it finish before installing over it.
    wait_for_other_installer
    installed="$(installed_version)"
    if newer_than "$version" "$installed"; then
        log "Installing $version"
        if ! install_deb "$deb"; then
            # Start it again even when the password prompt was cancelled, so the app never just vanishes.
            relaunch_app "$relaunch_file"
            echo "Installing $version failed" >&2
            exit 1
        fi
        keep_as_update_base "$deb"
        log "Installed $version"
    else
        log "Installed $installed is already at or past $version; not installing"
    fi
    relaunch_app "$relaunch_file"
}

main "$@"
