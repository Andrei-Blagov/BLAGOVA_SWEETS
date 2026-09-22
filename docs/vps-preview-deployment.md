# Preview deployment on a VPS

The preview is served by an Nginx container without a public host port. The host reverse proxy reaches it through an existing external Docker network and terminates HTTPS for the preview domain.

Keep host-specific values outside git:

```bash
export BLAGOVA_APP_DIR=/path/to/blagova-sweets
export BLAGOVA_PREVIEW_DOMAIN=preview.example.com
export BLAGOVA_PROXY_CONTAINER=your-proxy-container
export BLAGOVA_PROXY_CONFIG=/path/to/proxy/config
```

## First deployment

```bash
git clone --branch prototype/pattaya-atelier --single-branch \
  https://github.com/Andrei-Blagov/BLAGOVA_SWEETS.git "$BLAGOVA_APP_DIR"
cd "$BLAGOVA_APP_DIR"
sudo docker compose -f docker-compose.preview.yml up -d --build
sudo docker compose -f docker-compose.preview.yml ps
```

Create a DNS record for BLAGOVA_PREVIEW_DOMAIN pointing to the VPS. Configure the existing reverse proxy using deploy/Caddyfile.preview or an equivalent host-local configuration. Keep real IP addresses, internal paths and network names in the VPS environment rather than this repository.

Before reloading the proxy, validate its host-local configuration. The exact commands depend on the installed proxy and container names.

## Update

```bash
cd "$BLAGOVA_APP_DIR"
git checkout prototype/pattaya-atelier
git pull --ff-only
sudo docker compose -f docker-compose.preview.yml up -d --build
sudo docker image prune -f
```

## Verification

```bash
sudo docker compose -f docker-compose.preview.yml ps
curl -I "https://$BLAGOVA_PREVIEW_DOMAIN"
```

Do not merge or deploy main until the owner explicitly approves the production transition. Never place Supabase service-role keys, Resend keys or OpenAI API keys in the repository or the static client bundle.
