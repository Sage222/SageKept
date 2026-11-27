#!/bin/sh
set -eu

DATA_DIR="${DATA_DIR:-/app/data}"

check_writable() {
  probe="$DATA_DIR/.write-probe-$$"
  if ! ( : > "$probe" ) 2>/dev/null; then
    uid="$(id -u)"
    gid="$(id -g)"
    echo "SageKept / Kept cannot write to $DATA_DIR as UID $uid / GID $gid. Ensure the host directory or volume is writable by this user/group." >&2
    exit 1
  fi
  rm -f "$probe" 2>/dev/null || true
}

if [ "$(id -u)" = "0" ]; then
  TARGET_UID="${PUID:-1000}"
  TARGET_GID="${PGID:-1000}"

  case "$TARGET_UID" in
    ''|*[!0-9]*)
      echo "Invalid PUID: $TARGET_UID" >&2
      exit 1
      ;;
  esac
  case "$TARGET_GID" in
    ''|*[!0-9]*)
      echo "Invalid PGID: $TARGET_GID" >&2
      exit 1
      ;;
  esac

  mkdir -p "$DATA_DIR" "$DATA_DIR/uploads" "$DATA_DIR/attachments" "$DATA_DIR/imports/tmp" "$DATA_DIR/backups"
  chown -R "$TARGET_UID:$TARGET_GID" "$DATA_DIR"

  if command -v su-exec >/dev/null 2>&1; then
    exec su-exec "$TARGET_UID:$TARGET_GID" "$@"
  elif command -v gosu >/dev/null 2>&1; then
    exec gosu "$TARGET_UID:$TARGET_GID" "$@"
  else
    exec setpriv --reuid="$TARGET_UID" --regid="$TARGET_GID" --clear-groups "$@"
  fi
fi

mkdir -p "$DATA_DIR" 2>/dev/null || true
check_writable
mkdir -p "$DATA_DIR/uploads" "$DATA_DIR/attachments" "$DATA_DIR/imports/tmp" "$DATA_DIR/backups" 2>/dev/null || true

exec "$@"
