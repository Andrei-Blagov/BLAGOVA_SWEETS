#!/usr/bin/env bash
set -Eeuo pipefail
umask 077
source "$(dirname "${BASH_SOURCE[0]}")/preview-release-lib.sh"
deploy_root=${1:-/opt/blagova-sweets-preview}
[[ "$deploy_root" =~ ^/[A-Za-z0-9._/-]+$ ]]
state_dir="$deploy_root/state"
compose_file="$deploy_root/docker-compose.preview.yml"
env_file="$deploy_root/.env"
previous_compose="$state_dir/docker-compose.previous.yml"
previous_env="$state_dir/env.previous"
legacy_state="$state_dir/legacy-container"
mutation_started=false
operation_complete=false
legacy_renamed=false
exec 9>"$deploy_root/.deploy.lock"
flock -n 9 || { echo 'Another preview deployment is running.' >&2; exit 1; }
if [ -e "$state_dir/recovery-required" ] || [ -e "$state_dir/operation-in-progress" ]; then
  echo 'Unresolved Preview operation; inspect state before retrying.' >&2
  exit 1
fi
test -s "$compose_file"
test -s "$env_file"
current_image=$(preview_image "$env_file")
current_project=$(preview_project "$env_file")
transaction=$(mktemp -d "$state_dir/rollback-transaction.XXXXXXXX")
preview_snapshot
preview_snapshot_pointers
compose=(docker compose --project-name "$current_project" --env-file "$env_file" -f "$compose_file")
preview_recover() {
  if [ "$legacy_renamed" = true ]; then
    docker stop --time 30 blagova-sweets-preview >/dev/null || return
    docker rename blagova-sweets-preview "$legacy_name" || return
  fi
  preview_restore_managed || return
}
trap 'preview_finish $?' EXIT
trap 'exit 130' INT
trap 'exit 143' TERM
if [ ! -s "$previous_compose" ] || [ ! -s "$previous_env" ]; then
  # A half pointer pair is corruption, not permission to fall back to legacy.
  [ ! -e "$previous_compose" ]
  [ ! -e "$previous_env" ]
  test -s "$legacy_state"
  legacy_name=$(cat "$legacy_state")
  [[ "$legacy_name" =~ ^blagova-sweets-preview-legacy-[0-9]{8}-[0-9]{6}$ ]]
  legacy_image_id=$(docker inspect --format '{{.Image}}' "$legacy_name")
  preview_atomic_text "$state_dir/operation-in-progress" 'rollback:legacy'
  mutation_started=true
  "${compose[@]}" down --remove-orphans
  docker rename "$legacy_name" blagova-sweets-preview
  legacy_renamed=true
  docker start blagova-sweets-preview >/dev/null
  preview_wait blagova-sweets-preview true
  [ "$(docker inspect --format '{{.Image}}' blagova-sweets-preview)" = "$legacy_image_id" ]
  preview_atomic_text "$state_dir/legacy-container.restored" "$legacy_name"
  # Legacy has no verified Git SHA. Record it separately from managed releases.
  rm -f "$compose_file" "$env_file" "$state_dir/current-release" "$legacy_state" "$state_dir/recovery-required"
  operation_complete=true
  echo 'Preview rollback restored the preserved legacy container.'
  exit 0
fi
target_image=$(preview_image "$previous_env")
[ "$(preview_project "$previous_env")" = "$current_project" ]
preview_atomic_text "$state_dir/operation-in-progress" "rollback:${target_image##*:}"
mutation_started=true
cp -p "$previous_compose" "$compose_file"
cp -p "$previous_env" "$env_file"
"${compose[@]}" up -d --no-build --remove-orphans
container_id=$("${compose[@]}" ps -q storefront)
test -n "$container_id"
preview_wait "$container_id"
preview_verify_image "$container_id" "$target_image"
cp -p "$transaction/docker-compose.preview.yml" "$previous_compose"
cp -p "$transaction/.env" "$previous_env"
preview_atomic_text "$state_dir/current-release" "${target_image##*:}"
rm -f "$state_dir/recovery-required" "$state_dir/legacy-container.restored"
operation_complete=true
echo 'Preview rollback completed and is healthy.'
