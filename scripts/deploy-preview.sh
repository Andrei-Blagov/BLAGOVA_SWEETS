#!/usr/bin/env bash
set -Eeuo pipefail
umask 077
source "$(dirname "${BASH_SOURCE[0]}")/preview-release-lib.sh"
deploy_root=${1:?deploy root is required}
image_ref=${2:?image reference is required}
release_sha=${3:?release sha is required}
proxy_network=${4:?proxy network is required}
compose_project=${5:?compose project is required}
[[ "$deploy_root" =~ ^/[A-Za-z0-9._/-]+$ ]]
[[ "$release_sha" =~ ^[0-9a-f]{40}$ ]]
[[ "$image_ref" = "blagova-sweets-preview:$release_sha" ]]
[[ "$proxy_network" =~ ^[A-Za-z0-9._-]+$ ]]
[[ "$compose_project" =~ ^[a-z0-9][a-z0-9_-]+$ ]]
release_dir="$deploy_root/releases/$release_sha"
state_dir="$deploy_root/state"
backups_dir="$deploy_root/backups"
compose_file="$deploy_root/docker-compose.preview.yml"
env_file="$deploy_root/.env"
previous_compose="$state_dir/docker-compose.previous.yml"
previous_env="$state_dir/env.previous"
incoming_compose="$release_dir/docker-compose.preview.yml"
image_archive="$release_dir/preview-image.tar.gz"
legacy_name=blagova-sweets-preview
legacy_backup_name=
legacy_image_id=
had_previous=false
had_legacy=false
mutation_started=false
operation_complete=false
runtime_may_have_changed=false
timestamp=$(date -u +%Y%m%d-%H%M%S)
install -d -m 750 "$deploy_root" "$deploy_root/releases" "$state_dir" "$backups_dir"
exec 9>"$deploy_root/.deploy.lock"
flock -n 9 || { echo 'Another preview deployment is running.' >&2; exit 1; }
if [ -e "$state_dir/recovery-required" ] || [ -e "$state_dir/operation-in-progress" ]; then
  echo 'Unresolved Preview operation; inspect state before retrying.' >&2
  exit 1
fi
test -s "$incoming_compose"
test -s "$image_archive"
docker network inspect "$proxy_network" >/dev/null
transaction=$(mktemp -d "$state_dir/deploy-transaction.XXXXXXXX")
preview_snapshot_pointers
if [ -e "$compose_file" ] || [ -e "$env_file" ]; then
  test -s "$compose_file"
  test -s "$env_file"
  [ "$(preview_project "$env_file")" = "$compose_project" ]
  preview_image "$env_file" >/dev/null
  preview_snapshot
  had_previous=true
elif docker inspect "$legacy_name" >/dev/null 2>&1; then
  had_legacy=true
  legacy_image_id=$(docker inspect --format '{{.Image}}' "$legacy_name")
fi
compose=(docker compose --project-name "$compose_project" --env-file "$env_file" -f "$compose_file")
preview_recover() {
  if [ "$had_previous" = true ]; then
    preview_restore_managed || return
  elif [ "$had_legacy" = true ]; then
    if [ "$runtime_may_have_changed" = true ]; then "${compose[@]}" down --remove-orphans || return; fi
    if [ -n "$legacy_backup_name" ] && docker inspect "$legacy_backup_name" >/dev/null 2>&1; then
      docker rename "$legacy_backup_name" "$legacy_name" || return
    fi
    docker start "$legacy_name" >/dev/null || return
    preview_wait "$legacy_name" true || return
    [ "$(docker inspect --format '{{.Image}}' "$legacy_name")" = "$legacy_image_id" ] || return 1
    preview_restore_pointers || return
    rm -f "$compose_file" "$env_file" "$state_dir/current-release" "$state_dir/legacy-container" "$state_dir/legacy-image" || return
    preview_atomic_text "$state_dir/legacy-container.restored" "$legacy_name" || return
  else
    if [ "$runtime_may_have_changed" = true ]; then "${compose[@]}" down --remove-orphans || return; fi
    preview_restore_pointers || return
    rm -f "$compose_file" "$env_file" "$state_dir/current-release" || return
    echo 'No previous Preview release existed; empty baseline restored.' >&2
  fi
}
trap 'preview_finish $?' EXIT
trap 'exit 130' INT
trap 'exit 143' TERM
# Loading an image does not switch runtime. Arm recovery before config writes.
gzip -dc "$image_archive" | docker load >/dev/null
preview_atomic_text "$state_dir/operation-in-progress" "deploy:$release_sha"
mutation_started=true
install -m 640 "$incoming_compose" "$compose_file"
env_tmp="$state_dir/env.next"
printf 'PREVIEW_IMAGE=%s\nPREVIEW_PROXY_NETWORK=%s\nPREVIEW_COMPOSE_PROJECT=%s\n' "$image_ref" "$proxy_network" "$compose_project" > "$env_tmp"
chmod 640 "$env_tmp"
mv "$env_tmp" "$env_file"
if [ "$had_legacy" = true ]; then
  legacy_backup_name="${legacy_name}-legacy-${timestamp}"
  legacy_tag="blagova-sweets-preview:legacy-${timestamp}"
  docker inspect "$legacy_name" > "$backups_dir/${timestamp}-legacy-container.json"
  docker image inspect "$legacy_image_id" > "$backups_dir/${timestamp}-legacy-image.json"
  docker tag "$legacy_image_id" "$legacy_tag"
  docker save "$legacy_tag" | gzip -9 > "$backups_dir/${timestamp}-legacy-image.tar.gz.tmp"
  mv "$backups_dir/${timestamp}-legacy-image.tar.gz.tmp" "$backups_dir/${timestamp}-legacy-image.tar.gz"
  docker stop --time 30 "$legacy_name" >/dev/null
  docker rename "$legacy_name" "$legacy_backup_name"
  preview_atomic_text "$state_dir/legacy-container" "$legacy_backup_name"
  preview_atomic_text "$state_dir/legacy-image" "$legacy_tag"
fi
runtime_may_have_changed=true
"${compose[@]}" up -d --no-build --remove-orphans
container_id=$("${compose[@]}" ps -q storefront)
test -n "$container_id"
preview_wait "$container_id"
preview_verify_image "$container_id" "$image_ref"
if [ "$had_previous" = true ]; then
  cp -p "$transaction/docker-compose.preview.yml" "$previous_compose"
  cp -p "$transaction/.env" "$previous_env"
fi
preview_atomic_text "$state_dir/current-release" "$release_sha"
rm -f "$state_dir/recovery-required" "$state_dir/legacy-container.restored"
operation_complete=true
echo "Preview release $release_sha is healthy."
