#!/usr/bin/env bash
set -Eeuo pipefail

deploy_root=${1:?deploy root is required}
image_ref=${2:?image reference is required}
release_sha=${3:?release sha is required}
proxy_network=${4:?proxy network is required}
compose_project=${5:?compose project is required}

[[ "$deploy_root" =~ ^/[A-Za-z0-9._/-]+$ ]]
[[ "$image_ref" =~ ^blagova-sweets-preview:[0-9a-f]{40}$ ]]
[[ "$release_sha" =~ ^[0-9a-f]{40}$ ]]
[[ "$proxy_network" =~ ^[A-Za-z0-9._-]+$ ]]
[[ "$compose_project" =~ ^[a-z0-9][a-z0-9_-]+$ ]]

release_dir="$deploy_root/releases/$release_sha"
state_dir="$deploy_root/state"
compose_file="$deploy_root/docker-compose.preview.yml"
env_file="$deploy_root/.env"
previous_compose="$state_dir/docker-compose.previous.yml"
previous_env="$state_dir/env.previous"
incoming_compose="$release_dir/docker-compose.preview.yml"
image_archive="$release_dir/preview-image.tar.gz"

install -d -m 750 "$deploy_root" "$deploy_root/releases" "$state_dir"
exec 9>"$deploy_root/.deploy.lock"
flock -n 9 || { echo 'Another preview deployment is running.' >&2; exit 1; }

test -s "$incoming_compose"
test -s "$image_archive"
docker network inspect "$proxy_network" >/dev/null

had_previous=false
if [ -s "$compose_file" ] && [ -s "$env_file" ]; then
  cp -p "$compose_file" "$previous_compose"
  cp -p "$env_file" "$previous_env"
  had_previous=true
fi

gzip -dc "$image_archive" | docker load >/dev/null
install -m 640 "$incoming_compose" "$compose_file"
env_tmp="$state_dir/env.next"
printf 'PREVIEW_IMAGE=%s\nPREVIEW_PROXY_NETWORK=%s\nPREVIEW_COMPOSE_PROJECT=%s\n' \
  "$image_ref" "$proxy_network" "$compose_project" > "$env_tmp"
chmod 640 "$env_tmp"
mv "$env_tmp" "$env_file"

compose=(docker compose --project-name "$compose_project" --env-file "$env_file" -f "$compose_file")

rollback() {
  echo 'Preview health check failed; restoring the previous release.' >&2
  "${compose[@]}" logs --tail 120 storefront >&2 || true
  if [ "$had_previous" = true ]; then
    cp -p "$previous_compose" "$compose_file"
    cp -p "$previous_env" "$env_file"
    "${compose[@]}" up -d --no-build --remove-orphans
  fi
}
trap rollback ERR

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
printf '%s\n' "$release_sha" > "$state_dir/current-release"
echo "Preview release $release_sha is healthy."
