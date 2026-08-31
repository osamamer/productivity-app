# Production deployment

This deployment keeps local development unchanged. Local development continues to use
`./run-app.sh` and `deployment/docker-compose.yml`; production uses the separate
`deployment/docker-compose.production.yml` stack.

## Recommended size and cost

For a personal or small invite-only installation, use one Linux VPS with at least 2
vCPUs and 4 GB RAM. Build images on the server initially, or use CI to build them if
you want the smaller server to have less build-time memory pressure. A 4 GB instance
is enough for low traffic; move to 8 GB if Keycloak, Maven builds, or concurrent users
start causing memory pressure.

The cheapest practical paid option is a low-cost VPS. Hetzner's Germany/Finland
cost-optimized plans currently list 4 GB instances around $6.49-$6.99/month before
VAT and IPv4 charges, subject to availability. DigitalOcean is simpler for beginners,
but its current 4 GB Basic Droplet is listed at $24/month. Oracle Cloud's Always Free
Ampere allowance can provide up to 2 OCPUs and 12 GB RAM, but capacity and account
availability make it a better experiment than a dependable first production host.

You also need a domain. The VPS, domain, and backups are the real costs; the software
stack itself is open source.

## 1. Create the server

Create an Ubuntu or Debian VPS in a European region reasonably close to your users.
Add an SSH key during creation. Then connect as the provider's initial user:

```sh
ssh root@SERVER_IP
```

Create a non-root deployment user and enable a firewall. If your provider gives you a
different initial user, substitute it for `root`:

```sh
adduser deploy
usermod -aG sudo deploy
apt update
apt install -y ca-certificates curl git ufw
ufw allow OpenSSH
ufw allow 80/tcp
ufw allow 443/tcp
ufw --force enable
```

Install Docker Engine and the Compose plugin using the official Docker instructions,
then verify:

```sh
docker --version
docker compose version
```

Log in as `deploy` for the remaining steps:

```sh
su - deploy
sudo usermod -aG docker "$USER"
```

Log out and back in once so the Docker group change takes effect.

## 2. Point DNS at the server

Create these DNS records, both pointing to `SERVER_IP`:

```text
app.example.com   A   SERVER_IP
auth.example.com  A   SERVER_IP
```

Wait until both names resolve before starting Caddy. Caddy will obtain and renew the
HTTPS certificates automatically.

## 3. Install the application

Clone the repository into `/opt`:

```sh
sudo mkdir -p /opt/productivity-app
sudo chown deploy:deploy /opt/productivity-app
git clone YOUR_REPOSITORY_URL /opt/productivity-app
cd /opt/productivity-app
```

Create the production environment file outside Git:

```sh
cp deployment/.env.production.example /opt/productivity-app/.env
chmod 600 /opt/productivity-app/.env
```

Edit `/opt/productivity-app/.env`. Use real domains and strong, different passwords.
For random values, run this locally or on the server:

```sh
openssl rand -hex 32
```

Set `IMAGE_PREFIX` to the lowercase GHCR prefix for this repository, for example:

```dotenv
IMAGE_PREFIX=ghcr.io/your-github-owner/productivity-app
IMAGE_TAG=latest
```

The production compose file pulls `${IMAGE_PREFIX}-backend` and
`${IMAGE_PREFIX}-edge`; it does not build application images on the VPS.

Validate the Compose file before starting anything:

```sh
docker compose \
  --env-file /opt/productivity-app/.env \
  -f deployment/docker-compose.production.yml config >/dev/null
```

## 4. Configure GitHub deployment

The workflow in `.github/workflows/build.yml` verifies every pull request and every
push to `master`. A successful push to `master` builds both production images, publishes
them to GHCR under the commit SHA, and deploys that exact SHA over SSH. The server
fetches the same commit before running the deployment script, so deployment files and
images cannot silently come from different revisions.

Create a GitHub repository environment named `production` for the deployment secrets.
Add these non-secret repository variables under Settings → Secrets and variables →
Actions → Variables (the Keycloak values are optional and default as shown):

```text
APP_DOMAIN=app.example.com
AUTH_DOMAIN=auth.example.com
KEYCLOAK_REALM=productivity-app
KEYCLOAK_CLIENT_ID=productivity-app-frontend
```

Add these environment secrets:

```text
PRODUCTION_HOST=your-server-hostname
PRODUCTION_USER=deploy
PRODUCTION_PATH=/opt/productivity-app
PRODUCTION_SSH_KEY=<private key whose public key is authorized for deploy>
PRODUCTION_KNOWN_HOSTS=<verified output of ssh-keyscan -H your-server-hostname>
```

Store the complete private key, including its `BEGIN` and `END` lines. Verify the
server fingerprint independently before adding `PRODUCTION_KNOWN_HOSTS`; strict host
key checking is intentional. If the repository is private, give the server's Git
remote a read-only deploy key so `git fetch origin master` can update the checkout.

Protect `master` and require the verification checks before merging. This keeps the
automatic deployment path limited to reviewed, green changes while still allowing a
manual `workflow_dispatch` run for a redeploy.

## 5. Start production

Validate the Compose file and start the infrastructure services. The first application
deployment is normally performed by GitHub Actions after the GHCR package is published:

```sh
docker compose \
  --env-file /opt/productivity-app/.env \
  -f deployment/docker-compose.production.yml config >/dev/null

docker compose \
  --env-file /opt/productivity-app/.env \
  -f deployment/docker-compose.production.yml up -d postgres keycloak
```

For a manual first deployment after an image has been published, log in to GHCR with
a token that has package read access and run:

```sh
echo GHCR_READ_TOKEN | docker login ghcr.io --username YOUR_GITHUB_USERNAME --password-stdin
./deployment/deploy-production.sh latest
```

The deployment script pulls the requested immutable tag, starts the backend, waits for
its health check, then starts Caddy. It records the last successful tag and restores
the previous container images if a later rollout fails health checks. Database
migrations are forward-only; a container rollback does not undo a migration.

Watch startup logs:

```sh
docker compose \
  --env-file /opt/productivity-app/.env \
  -f deployment/docker-compose.production.yml logs -f backend keycloak edge
```

The backend runs Liquibase with `ddl-auto=validate`; it applies new migrations without
dropping existing data. Do not use `docker compose down -v` in production.

## 6. Configure Keycloak

Open `https://auth.example.com` and sign in to the administrator console using the
credentials from `.env`.

Create realm `productivity-app`, then create a public client:

- Client ID: `productivity-app-frontend`
- Client authentication: off
- Standard flow: on
- Valid redirect URI: `https://app.example.com/*`
- Web origin: `https://app.example.com`

Ensure the client token includes `email`, `given_name`, `family_name`, and
`preferred_username` claims. In Realm settings → Themes, select `productivity` as
the Login Theme. The theme is mounted into the Keycloak container from
`deployment/keycloak-theme`. Create a test user and verify that login, task creation,
password changes, and logout all work.

The backend's issuer URL must remain the public Keycloak URL because it must match the
issuer in the JWT: `https://auth.example.com/realms/productivity-app`.

## 7. Verify the application

Check the public health endpoint:

```sh
curl -fsS https://app.example.com/actuator/health
```

Then test in the browser:

1. Login and refresh the page.
2. Create and complete a task.
3. Start and stop a Pomodoro session.
4. Confirm browser notifications and the WebSocket-driven timer updates.
5. Restart the backend and confirm data remains present.

## 8. Backups

The Docker volume is persistence, not a backup. The repository includes
`deployment/backup-production.sh` to dump both databases:

```sh
sudo mkdir -p /opt/productivity-backups
sudo chown deploy:deploy /opt/productivity-backups
PRODUCTIVITY_BACKUP_DIR=/opt/productivity-backups \
  /opt/productivity-app/deployment/backup-production.sh
```

Schedule it daily with cron, for example:

```sh
crontab -e
```

```cron
17 3 * * * PRODUCTIVITY_BACKUP_DIR=/opt/productivity-backups /opt/productivity-app/deployment/backup-production.sh >> /opt/productivity-backups/backup.log 2>&1
```

Copy backups to a separate machine or object-storage bucket and periodically test a
restore. The VPS provider's snapshot/backup feature is useful as a second layer, but
should not be the only copy.

## Updating the deployment

After merging a tested change to `master`, GitHub Actions automatically:

1. Runs backend verification and frontend lint/build.
2. Builds and publishes backend and edge images tagged with the commit SHA.
3. SSHes to the VPS, fetches that exact commit, and runs
   `deployment/deploy-production.sh <commit-sha>`.
4. Waits for the backend health check before bringing up the new edge image.

Use the workflow's `workflow_dispatch` action for a manual redeploy of the current
`master` commit. Keep the daily database dump and an off-server copy of those backups;
an image rollback cannot recover deleted or migrated data.
