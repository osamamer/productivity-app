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

Validate the Compose file before starting anything:

```sh
docker compose \
  --env-file /opt/productivity-app/.env \
  -f deployment/docker-compose.production.yml config >/dev/null
```

## 4. Start production

Build and start the stack:

```sh
docker compose \
  --env-file /opt/productivity-app/.env \
  -f deployment/docker-compose.production.yml build --pull

docker compose \
  --env-file /opt/productivity-app/.env \
  -f deployment/docker-compose.production.yml up -d
```

Watch startup logs:

```sh
docker compose \
  --env-file /opt/productivity-app/.env \
  -f deployment/docker-compose.production.yml logs -f backend keycloak edge
```

The backend runs Liquibase with `ddl-auto=validate`; it applies new migrations without
dropping existing data. Do not use `docker compose down -v` in production.

## 5. Configure Keycloak

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

## 6. Verify the application

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

## 7. Backups

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

After merging a tested change:

```sh
cd /opt/productivity-app
git pull --ff-only
docker compose --env-file /opt/productivity-app/.env \
  -f deployment/docker-compose.production.yml build --pull
docker compose --env-file /opt/productivity-app/.env \
  -f deployment/docker-compose.production.yml up -d
```

For a more repeatable release process later, have GitHub Actions build and publish the
backend and edge images tagged with the commit SHA, then have the server pull that
immutable tag and restart only the changed services.
