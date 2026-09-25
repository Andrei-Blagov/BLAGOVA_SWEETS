#!/usr/bin/env bash
set -Eeuo pipefail

deploy_root=${1:-/opt/blagova-sweets-preview}
[[ "$deploy_root" =~ ^/[A-Za-z0-9._/-]+$ ]]

state_dir="$deploy_root/state"
compose_file="$deploy_root/docker-compose.preview.yml"
env_file="$deploy_root/.env"
previous_compose="$state_dir/docker-compose.previous.yml"
previous_env="$state_dir/env.previous"
legacy_state="$state_dir/legacy-container"

exec 9>"$deploy_root/.deploy.lock"
flock -n 9 || { echo 'Another preview deployment is running.' >&2; exit 1; }

current_compose="$state_dir/docker-compose.before-rollback.yml"
current_env="$state_dir/env.before-rollback"
cp -p "$compose_file" "$current_compose"
cp -p "$env_file" "$current_env"

if [ ! -s "$previous_compose" ] || [ ! -s "$previous_env" ]; then
  test -s "$legacy_state"
  legacy_name=$(cat "$legacy_state")
  [[ "$legacy_name" =~ ^blagova-sweets-preview-legacy-[0-9]{8}-[0-9]{6}$ ]]
  docker inspect "$legacy_name" >/dev/null

  compose_project=$(sed -n 's/^PREVIEW_COMPOSE_PROJECT=//p' "$env_file")
  [[ "$compose_project" =~ ^[a-z0-9][a-z0-9_-]+$ ]]
  compose=(docker compose --project-name "$compose_project" --env-file "$env_file" -f "$compose_file")
  "${compose[@]}" down --remove-orphans
  docker rename "$legacy_name" blagova-sweets-preview
  docker start blagova-sweets-preview >/dev/null
  for attempt in $(seq 1 45); do
    status=$(docker inspect --format '{{if .State.Health}}{{.State.Health.Status}}{{else}}{{.State.Status}}{{end}}' blagova-sweets-preview)
    { [ "$status" = healthy ] || [ "$status" = running ]; } && break
    [ "$status" = unhealthy ] && exit 1
    sleep 2
  done
  printf '%s\n' "$legacy_name" > "$state_dir/legacy-container.restored"
  rm -f "$legacy_state"
  echo 'Preview rollback restored the preserved legacy container.'
  exit 0
fi

cp -p "$previous_compose" "$compose_file"
cp -p "$previous_env" "$env_file"

compose_project=$(sed -n 's/^PREVIEW_COMPOSE_PROJECT=//p' "$env_file")
[[ "$compose_project" =~ ^[a-z0-9][a-z0-9_-]+$ ]]
compose=(docker compose --project-name "$compose_project" --env-file "$env_file" -f "$compose_file")

restore_current() {
  cp -p "$current_compose" "$compose_file"
  cp -p "$current_env" "$env_file"
  "${compose[@]}" up -d --no-build --remove-orphans || true
}
trap restore_current ERR

"${compose[@]}" up -d --no-build --remove-orphans
container_id=$("${compose[@]}" ps -q storefront)
test -n "$container_id"
for attempt in $(seq 1 45); do
  status=$(docker inspect --format '{{if .State.Health}}{{.State.Health.Status}}{{else}}{{.State.Status}}{{end}}' "$container_id")
  [ "$status" = healthy ] && break
  [ "$status" = unhealthy ] && exit 1
  sleep 2
done
[ "$(docker inspect --format '{{.State.Health.Status}}' "$container_id")" = healthy ]

trap - ERR
cp -p "$current_compose" "$previous_compose"
cp -p "$current_env" "$previous_env"
echo 'Preview rollback completed and is healthy.'
