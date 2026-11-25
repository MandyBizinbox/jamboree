# WSJ Staging Deployment · Forge VPS

**Environment:** Node.js 22+, Python 3.10+, Nginx, systemd. No npm install is required for this build (all runtime modules are built in). `npm test` runs the full test suite using Node built-ins.

Use a separate *staging* domain, such as `wsj-staging.<your-actual-domain>`; do **not** assume the Raiza domain until its DNS and ownership are confirmed. Never route the current Manus site to this service.

## 1. Upload from your local workstation

```bash
scp -r wsj_release forge-vps:/home/madness/wsj-registration
ssh forge-vps
```

If the folder already exists on the VPS, **do not** overwrite its `data/` or `.env` files. Back up before updating.

## 2. Server setup (over SSH)

```bash
node -v
python3 --version
sudo install -d -m 700 -o madness -g madness /var/lib/wsj-registration
sudo cp /home/madness/wsj-registration/.env.example /etc/wsj-registration.env
sudo chmod 600 /etc/wsj-registration.env
sudo nano /etc/wsj-registration.env
```

Generate keys using `openssl rand -hex 32` twice; use different values for `APP_ENCRYPTION_KEY` and `SESSION_SECRET`. Set the actual CMT owner email and password. Keep both secrets backed up securely. **Never publish the environment file or commit it to Git.**

Run synthetic test suite before starting:

```bash
cd /home/madness/wsj-registration
npm test
```

## 3. Service

```bash
sudo cp deploy/wsj.service /etc/systemd/system/wsj-registration.service
sudo systemctl daemon-reload
sudo systemctl enable --now wsj-registration
sudo systemctl status wsj-registration --no-pager
curl -I http://127.0.0.1:3017/
```

Adjust the node binary path in the service if `which node` isn't `/usr/bin/node`.

## 4. Hostname and HTTPS

Point the **chosen** subdomain A record to the VPS IP using your DNS service. Copy and edit `deploy/nginx.conf.template`, replace `DOMAIN_PLACEHOLDER` with the real FQDN, then:

```bash
sudo cp deploy/nginx.conf.template /etc/nginx/sites-available/wsj-registration
sudo nano /etc/nginx/sites-available/wsj-registration
sudo ln -s /etc/nginx/sites-available/wsj-registration /etc/nginx/sites-enabled/wsj-registration
sudo nginx -t && sudo systemctl reload nginx
sudo certbot --nginx -d YOUR_ACTUAL_STAGING_DOMAIN
```

Before real registrations, verify HTTPS and the secure cookie behavior. The direct HTTP port 3017 should only be bound to the loopback interface by firewalling; reverse proxy public access over HTTPS only.

## 5. Acceptance gate

- Public `/register` works in a fresh browser without login.
- `/cmt` demands named admin login; unauthenticated `/api/admin/list` returns 401.
- Create **synthetic** youth and adult records, navigate all applicable steps, save and resume via private credential.
- Guardian `Other` field only when selected; use guardian and emergency address reuse.
- Allergy No hides all 17 detailed questions; allergy Yes reveals them and severity only when each is Yes.
- Medical, mobility and disability conditions work; full final review refuses incomplete records.
- CMT can approve, request correction, issue fresh correction code, assign patrol and set travel dates.
- Download **UNVERIFIED** Excel test preview and compare sheet name, 197 columns, hidden tabs, row 5 and source dropdown data.
- Confirm Poland's UUID-vs-label import semantics, health/accessibility fields and legal consent policy **before** turning on production export or admitting real participant data.

## 6. Backups and rollback

Back up `/var/lib/wsj-registration/wsj.sqlite` with SQLite's online `.backup` command or an atomic snapshot, and back up `/etc/wsj-registration.env` separately in secure storage. The encryption key is essential to data recovery. Keep a versioned deployment directory and an easy rollback; never migrate production database without a verified backup.
