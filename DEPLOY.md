# Deploying Recall to AWS (Lightsail)

A step-by-step guide to host Recall publicly on a single small AWS instance.
Same idea works on EC2 (`t4g.small`, Ubuntu) — only the console screens differ.

- **Compute:** AWS Lightsail
- **Region:** `eu-north-1` (Stockholm) — closest to Oslo
- **OS:** Ubuntu 24.04 LTS (Noble)
- **App:** Docker Compose (`recall` container serves SPA + API on port 8787)
- **Data:** SQLite file on the instance disk (EBS). Optional S3 backup via Litestream.

> 💡 Read the **Troubleshooting** section at the bottom first — it lists the real issues
> hit during the first deploy (build freezing the instance, a `.gitignore` bug, the firewall,
> the `scp` colon). Knowing them up front saves a lot of time.

---

## 0. Before you start

- Code is on GitHub: https://github.com/nimeshdilshan96/recall
  **Make sure the repo is complete** — every file under `src/` must be present, including
  `src/data/types.ts` and `src/data/seed.ts`. (These were once dropped by a `.gitignore` bug;
  see Troubleshooting.) If you uploaded via the browser, also confirm the dotfiles
  (`.gitignore`, `.dockerignore`, `.env.example`) made it — drag-and-drop skips hidden files.
- You have the SSH `.pem` key you downloaded, saved and locked down:
  ```bash
  chmod 400 ~/.ssh/recall.pem
  ```
- **Instance size:** the smallest plans (512 MB–1 GB RAM) **cannot build the image** without
  running out of memory and freezing. Either use a **≥ 2 GB** plan, or add **swap** (step 4) —
  swap is free and works fine.

---

## 1. Create the Lightsail instance

In the Lightsail console:

- **Region:** Stockholm (`eu-north-1`)
- **Platform:** Linux/Unix → **Ubuntu 24.04 LTS**
- **Launch script:** leave blank (or paste the Docker pre-install from step 3)
- **SSH key:** create/download a key pair → save the `.pem`
- **Network:** `dualstack` (IPv4 + IPv6)
- **Plan:** ≥ 2 GB recommended (or smallest + swap, see step 4)
- **Name:** `recall-prod`

Create it, then **attach a static IP** (Networking tab) so the address never changes.
Call the address `<IP>` below.

**Firewall** (Networking → IPv4 Firewall, *and* the IPv6 Firewall section since you're dualstack):
open **22** (SSH), **80** (HTTP), **443** (HTTPS), each with source **Any** (`0.0.0.0/0` and `::/0`).
- To type a non-preset port, set the rule's **Application = Custom**, then enter the port.
- The app listens on **8787**. You have two choices for reaching it (see step 8):
  either **map the app to port 80** (already open — cleanest), or **add a Custom rule for 8787**.

---

## 2. Connect via SSH

From your Mac:
```bash
ssh -i ~/.ssh/recall.pem ubuntu@<IP>
```
(`ubuntu` is the default user. If you get `Permission denied (publickey)`, you're using the
wrong key or username — see Troubleshooting.)

---

## 3. Install Docker (skip if you used the launch script)

```bash
curl -fsSL https://get.docker.com | sh
sudo usermod -aG docker ubuntu
```
Log out and back in so the group change takes effect:
```bash
exit
ssh -i ~/.ssh/recall.pem ubuntu@<IP>
docker --version   # confirm it works without sudo
```

---

## 4. Add swap — ⚠️ do this BEFORE building

Building the image compiles the SPA and the native `better-sqlite3` addon, which needs more
RAM than a small instance has. Without swap it **runs out of memory and freezes the whole
instance** (SSH included). Add 2 GB of swap first:

```bash
free -h                                # check current memory (likely no swap)
sudo fallocate -l 2G /swapfile
sudo chmod 600 /swapfile
sudo mkswap /swapfile
sudo swapon /swapfile
echo '/swapfile none swap sw 0 0' | sudo tee -a /etc/fstab   # survives reboots
free -h                                # should now show Swap: 2.0Gi
```

> Skip this only if your plan has ≥ 2 GB RAM. Even then, swap does no harm.

---

## 5. Clone the repo and create `.env`

```bash
git clone https://github.com/nimeshdilshan96/recall.git
cd recall
cp .env.example .env
openssl rand -hex 32          # copy this output
nano .env                     # paste into RECALL_SECRET= ; leave LITESTREAM_* blank
```
Save in nano: `Ctrl-O`, `Enter`, `Ctrl-X`.

> `RECALL_SECRET` signs the login cookie. If left at the default, anyone can forge a session.
> Use a strong random value, and keep a copy in your password manager.

---

## 6. (Optional) Bring your existing data

Skip this to start with an empty DB (register fresh on the live site). To carry your local
account over:

**a) Switch the DB to a bind mount** so it's a plain file at `~/recall/data/recall.db`.
Edit `docker-compose.yml` on the instance — in the `recall` service (and `litestream`, if used),
change the volume line:
```yaml
    volumes:
      - ./data:/app/data        # was:  - recall-data:/app/data
```

**b) On your Mac**, make a clean single-file snapshot (`.backup` merges the WAL so nothing is
lost) and copy it up. **Note the `:` after `<IP>`** — leaving it out makes `scp` fail:
```bash
cd ~/Documents/anki
sqlite3 data/recall.db ".backup data/recall-prod.db"

ssh -i ~/.ssh/recall.pem ubuntu@<IP> "mkdir -p ~/recall/data"
scp -i ~/.ssh/recall.pem data/recall-prod.db ubuntu@<IP>:~/recall/data/recall.db
#                                                        ^ colon is required
```

> Do this **before** the first build. If you already started with an empty DB, it's fine —
> the bind mount points at `./data`, so the old volume is simply ignored.

---

## 7. Build and run

```bash
cd ~/recall
docker compose up -d --build recall
```
The build **maxes CPU and takes several minutes** — that's normal (with swap it won't freeze).
Don't cancel it. When it finishes:
```bash
docker compose ps                              # recall should be "Up"
curl -s -o /dev/null -w "%{http_code}\n" localhost:8787   # expect 200
```
A `200` from `localhost:8787` means the app itself works. If the browser still can't reach it,
that's the firewall/port (next step), not the app.

---

## 8. Make it reachable in the browser

The app is on **8787**. Two options:

**Option A (recommended — reuse the already-open port 80):** edit `docker-compose.yml`:
```yaml
    ports:
      - "80:8787"        # was "8787:8787"
```
then `docker compose up -d recall`, and browse **http://<IP>** (no port, no new firewall rule).

**Option B (keep 8787):** add a firewall rule — Networking → **Add rule** → Application **Custom**,
Protocol **TCP**, Port **8787**, source **Any** (IPv4 + IPv6). Then browse **http://<IP>:8787**.

Log in as your user — if you did step 6 you should see your decks.

---

## 9. HTTPS + a real address (do once it's working)

Plain HTTP is fine for a first test, but **don't stay on HTTP publicly**. You need a domain name
to get an HTTPS certificate. Two paths:

- **Free:** **DuckDNS** — sign in at duckdns.org, create `something.duckdns.org`, point it at `<IP>`.
- **Paid (~$1–2/yr):** a `.xyz` from Porkbun/Cloudflare (watch the *renewal* price), or a `.com`.

Then put **Caddy** in front — it auto-provisions a free Let's Encrypt certificate. Minimal `Caddyfile`:
```
your-name.duckdns.org {
    reverse_proxy localhost:8787
}
```
Run Caddy (as a container or `apt install caddy`), keep the app on 8787 internally, and make sure
the firewall allows **80 + 443**. Remove any public **8787** rule so traffic only comes via HTTPS.

---

## 10. S3 backup with Litestream (optional, recommended)

1. Create an **S3 bucket** in `eu-north-1` (e.g. `nimesh-recall-backups`).
2. Create an **IAM user** with read/write access to just that bucket; note its access key + secret.
3. On the instance, edit `.env`:
   ```
   LITESTREAM_BUCKET=nimesh-recall-backups
   LITESTREAM_ACCESS_KEY_ID=...
   LITESTREAM_SECRET_ACCESS_KEY=...
   ```
   and set the region in `litestream.yml`:
   ```yaml
   region: eu-north-1
   ```
4. Start the backup service too:
   ```bash
   docker compose up -d
   ```

**Restore** on a fresh instance (before starting the app):
```bash
litestream restore -o ~/recall/data/recall.db s3://nimesh-recall-backups/recall.db
```

---

## 11. Day-to-day

**Deploy code updates:**
```bash
cd ~/recall
git pull
docker compose up -d --build
```
(`git pull` is safe — it won't touch your `.env` or `data/`. If you edited a tracked file on the
server, e.g. the compose volume/port, a pull touching that file will conflict; keep server-only
tweaks minimal or move them into a `docker-compose.override.yml`.)

**Add cards later via the API** (from anywhere): log in, then POST to `/api/cards`
against `https://your-domain/api/...`.

**Manual backup** (if not using Litestream): stop the app, copy the DB, restart:
```bash
docker compose stop recall
cp ~/recall/data/recall.db ~/recall-backup-$(date +%F).db
docker compose start recall
```

**Logs / restart:**
```bash
docker compose logs -f recall
docker compose restart recall
```

**Reboots:** containers use `restart: unless-stopped`, so the app auto-starts after any reboot.
Your `.env` and `data/` persist on the disk — you only redo setup if you destroy and recreate
the instance.

---

## Troubleshooting (issues hit during the first deploy)

**Build freezes / instance becomes unreachable during `docker compose up --build`.**
Out of memory. The instance is alive but CPU-pegged/OOM. Recover by **rebooting from the Lightsail
console** (Stop → Start; works without SSH). Then **add swap** (step 4) before building again.

**Build fails: `Cannot find module './data/types.ts'` (and cascading TS errors).**
Source files under `src/data/` are missing from the repo. Cause: a `.gitignore` line `data`
(unanchored) also ignored `src/data/`. Fix: change it to `/data` (anchors to the root), and make
sure `src/data/types.ts` and `src/data/seed.ts` are committed. Then `git pull` + rebuild.

**Can't open the app in a browser, but `curl localhost:8787` on the instance returns 200.**
The app works; the port isn't reachable. Either map the app to port 80 (step 8A) or add a Custom
firewall rule for 8787 (step 8B). Remember the IPv6 firewall section too (dualstack).

**`scp` says `No such file or directory` / falls back to `cp:`.**
You dropped the colon between the host and path. It must be
`ubuntu@<IP>:~/recall/data/recall.db` (colon right after the IP). Also ensure `~/recall/data`
exists on the instance first (`mkdir -p ~/recall/data`).

**`Permission denied (publickey)` on SSH.**
Wrong username or key. Use `ubuntu@<IP>`, and the exact `.pem` the instance was created with
(the instance's **Connect** tab shows which key). A wrong *IP* would time out instead — publickey
means you reached the box but the key was rejected. The Lightsail **browser SSH** always works.

**Dotfiles missing after a browser upload** (`.env.example`, `.gitignore`, `.dockerignore`).
GitHub's drag-and-drop skips hidden files. Add them via **Add file → Create new file** and type
the filename (e.g. `.gitignore`). On your Mac, `⌘⇧.` reveals hidden files in Finder.

---

## Security checklist before going public

- [ ] `RECALL_SECRET` is a strong random value (not the default), backed up in a password manager
- [ ] HTTPS enabled (Caddy); no public rule for 8787 (only 80/443)
- [ ] Firewall: 22 (ideally restricted to your IP), 80, 443
- [ ] Consider rate-limiting the auth routes / disabling open registration if it's just for you
- [ ] Backups working (Litestream to S3, or a scheduled manual copy)
- [ ] Swap enabled so future rebuilds don't OOM
