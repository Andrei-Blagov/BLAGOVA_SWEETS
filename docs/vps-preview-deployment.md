# Preview deployment on OVH VPS

The preview is served by an Nginx container without a public host port. Caddy reaches it
through the existing external Docker network `n8n_n8n_net` and terminates HTTPS for
`preview.blagovasweets.com`.

## First deployment

```bash
sudo mkdir -p /opt/blagova-sweets
sudo chown andrei:andrei /opt/blagova-sweets
git clone --branch sites/pattaya-preview --single-branch \
  https://github.com/Andrei-Blagov/BLAGOVA_SWEETS.git /opt/blagova-sweets
cd /opt/blagova-sweets
sudo docker compose -f docker-compose.preview.yml up -d --build
sudo docker compose -f docker-compose.preview.yml ps
```

Append the contents of `deploy/Caddyfile.preview` to `/opt/n8n/caddy/Caddyfile`, validate,
and reload Caddy:

```bash
sudo cp /opt/n8n/caddy/Caddyfile /opt/n8n/caddy/Caddyfile.bak-before-blagova-preview
sudo sh -c 'printf "\n" >> /opt/n8n/caddy/Caddyfile'
sudo sh -c 'cat /opt/blagova-sweets/deploy/Caddyfile.preview >> /opt/n8n/caddy/Caddyfile'
sudo docker exec n8n-caddy caddy validate --config /etc/caddy/Caddyfile
sudo docker exec n8n-caddy caddy reload --config /etc/caddy/Caddyfile
```

Create an OVH DNS `A` record for `preview` pointing to `135.125.199.21`. After DNS has
propagated, Caddy will obtain the certificate automatically.

## Update

```bash
cd /opt/blagova-sweets
git pull --ff-only
sudo docker compose -f docker-compose.preview.yml up -d --build
sudo docker image prune -f
```

## Verification

```bash
sudo docker inspect blagova-sweets-preview --format '{{.State.Health.Status}}'
sudo docker exec n8n-caddy wget -qO- http://blagova-preview/health
curl -I https://preview.blagovasweets.com
```
