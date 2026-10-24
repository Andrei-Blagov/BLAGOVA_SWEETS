#!/usr/bin/env bash
set -eu
# Strict fixture executable: never forwards a call to real Docker.
printf '%s\n' "$*" >> "$MOCK_DIR/docker.calls"
case "$1" in
  network) [ "$2" = inspect ]; exit 0 ;;
  load) cat >/dev/null; exit 0 ;;
  tag) exit 0 ;;
  save) printf 'synthetic image archive'; exit 0 ;;
  image) [ "$2" = inspect ]; printf '{}\n'; exit 0 ;;
  compose)
    shift
    while [ $# -gt 0 ]; do
      case "$1" in
        --project-name) [ "$2" = blagova-test-preview ] || exit 96; shift 2 ;;
        --env-file) env_file=$2; shift 2 ;;
        -f) shift 2 ;;
        *) break ;;
      esac
    done
    case "$1" in
      up)
        image=$(sed -n 's/^PREVIEW_IMAGE=//p' "$env_file")
        count=0; [ ! -e "$MOCK_DIR/up.count" ] || count=$(cat "$MOCK_DIR/up.count")
        printf '%s\n' "$((count+1))" > "$MOCK_DIR/up.count"
        printf '%s\n' "$image" > "$MOCK_DIR/runtime.image"
        touch "$MOCK_DIR/managed.exists"
        if [ "$image" = "$MOCK_TARGET_IMAGE" ] && [ "$MOCK_SCENARIO" = up-fail ]; then exit 42; fi
        if [ "$image" != "$MOCK_TARGET_IMAGE" ] && [ "$MOCK_SCENARIO" = recovery-up-fail ]; then exit 43; fi
        exit 0 ;;
      ps)
        if [ "$MOCK_SCENARIO" = empty-id ] && [ "$(cat "$MOCK_DIR/runtime.image")" = "$MOCK_TARGET_IMAGE" ]; then exit 0; fi
        printf 'managed-id\n'; exit 0 ;;
      down) rm -f "$MOCK_DIR/managed.exists"; exit 0 ;;
      *) echo 'Unexpected mock compose call' >&2; exit 97 ;;
    esac ;;
  inspect)
    shift
    if [ "${1:-}" = --format ]; then format=$2; container=$3; else format=json; container=$1; fi
    if [ "$container" = managed-id ]; then
      [ -e "$MOCK_DIR/managed.exists" ] || exit 1
      image=$(cat "$MOCK_DIR/runtime.image")
      case "$format" in
        '{{.Config.Image}}')
          if [ "$MOCK_SCENARIO" = image-mismatch ] && [ "$image" = "$MOCK_TARGET_IMAGE" ]; then echo wrong-image; else echo "$image"; fi ;;
        *)
          if [ "$image" = "$MOCK_TARGET_IMAGE" ]; then
            case "$MOCK_SCENARIO" in
              unhealthy|recovery-up-fail) echo unhealthy ;;
              timeout) echo starting ;;
              inspect-fail) exit 44 ;;
              *) echo healthy ;;
            esac
          else echo healthy; fi ;;
      esac
    else
      [ -e "$MOCK_DIR/$container.exists" ] || exit 1
      case "$format" in
        '{{.Image}}') echo synthetic-legacy-image-id ;;
        json) echo '{}' ;;
        *)
          case "$MOCK_SCENARIO" in
            legacy-unhealthy) echo unhealthy ;;
            legacy-timeout) echo starting ;;
            legacy-running) echo running ;;
            *) echo healthy ;;
          esac ;;
      esac
    fi
    exit 0 ;;
  stop) container=${@: -1}; [ -e "$MOCK_DIR/$container.exists" ]; exit 0 ;;
  rename)
    [ -e "$MOCK_DIR/$2.exists" ]
    [ ! -e "$MOCK_DIR/$3.exists" ]
    mv "$MOCK_DIR/$2.exists" "$MOCK_DIR/$3.exists"; exit 0 ;;
  start) [ -e "$MOCK_DIR/$2.exists" ]; exit 0 ;;
  *) echo 'Unexpected mock Docker command; refusing real invocation.' >&2; exit 97 ;;
esac
