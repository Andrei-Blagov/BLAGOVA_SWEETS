#!/usr/bin/env bash
# Sourced by the standalone Preview scripts; no Docker/network calls on load.
preview_image() {
  local value
  value=$(sed -n 's/^PREVIEW_IMAGE=//p' "$1") || return
  [[ "$value" =~ ^blagova-sweets-preview:[0-9a-f]{40}$ ]] || return 1
  printf '%s\n' "$value"
}
preview_project() {
  local value
  value=$(sed -n 's/^PREVIEW_COMPOSE_PROJECT=//p' "$1") || return
  [[ "$value" =~ ^[a-z0-9][a-z0-9_-]+$ ]] || return 1
  printf '%s\n' "$value"
}
preview_wait() {
  local container=$1 allow_running=${2:-false} status attempt
  for attempt in $(seq 1 45); do
    status=$(docker inspect --format '{{if .State.Health}}{{.State.Health.Status}}{{else}}{{.State.Status}}{{end}}' "$container") || return 1
    case "$status" in
      healthy) return 0 ;;
      running) if [ "$allow_running" = true ]; then return 0; fi ;;
      unhealthy|exited|dead) return 1 ;;
    esac
    sleep 2 || return 1
  done
  echo 'Preview health check timed out.' >&2
  return 1
}
preview_verify_image() {
  local actual
  actual=$(docker inspect --format '{{.Config.Image}}' "$1") || return 1
  [ "$actual" = "$2" ]
}
preview_atomic_text() {
  local destination=$1 value=$2
  printf '%s\n' "$value" > "$destination.next" || return
  mv -f "$destination.next" "$destination"
}
preview_snapshot() {
  local file
  for file in docker-compose.preview.yml .env; do
    cp -p "$deploy_root/$file" "$transaction/$file" || return
  done
}
# Snapshot previous pointers too: failed rotation must not leave a mixed pair.
preview_snapshot_pointers() {
  local file
  for file in docker-compose.previous.yml env.previous; do
    if [ -e "$state_dir/$file" ]; then cp -p "$state_dir/$file" "$transaction/$file" || return; fi
  done
}
preview_restore_pointers() {
  local file
  for file in docker-compose.previous.yml env.previous; do
    if [ -e "$transaction/$file" ]; then
      cp -p "$transaction/$file" "$state_dir/$file" || return
    else
      rm -f "$state_dir/$file" || return
    fi
  done
}
preview_restore_managed() {
  cp -p "$transaction/docker-compose.preview.yml" "$compose_file" || return
  cp -p "$transaction/.env" "$env_file" || return
  local image project container
  image=$(preview_image "$env_file") || return
  project=$(preview_project "$env_file") || return
  local restored=(docker compose --project-name "$project" --env-file "$env_file" -f "$compose_file")
  "${restored[@]}" up -d --no-build --remove-orphans || return
  container=$("${restored[@]}" ps -q storefront) || return
  [ -n "$container" ] || return 1
  preview_wait "$container" || return
  preview_verify_image "$container" "$image" || return
  preview_restore_pointers || return
  preview_atomic_text "$state_dir/current-release" "${image##*:}" || return
}
# EXIT handles explicit exit and command failure. Disable traps before recovery
# so recovery failure cannot recursively invoke it. Each recovery step checks RC.
preview_finish() {
  local status=$1
  trap - EXIT INT TERM
  set +e
  if [ "$operation_complete" != true ] && [ "$mutation_started" = true ]; then
    echo 'Preview operation failed; attempting one recovery.' >&2
    if preview_recover; then
      rm -f "$state_dir/recovery-required"
      echo 'Previous Preview runtime restored and verified.' >&2
    else
      rm -f "$state_dir/current-release"
      preview_atomic_text "$state_dir/recovery-required" 'Recovery failed; inspect runtime before any further release operation.'
      echo 'Preview recovery failed; manual inspection required. No healthy release marker is claimed.' >&2
    fi
    [ "$status" -ne 0 ] || status=1
  fi
  if [ "$mutation_started" = true ]; then rm -f "$state_dir/operation-in-progress"; fi
  # Private transaction snapshots are retained for diagnosis; no env is printed.
  exit "$status"
}
