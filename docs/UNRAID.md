# Running StudyTube on Unraid

StudyTube normally runs as two containers:

- `studytube`: Next.js UI, job worker and Remotion renderer
- `studytube-neural-tts`: lightweight neural-TTS bridge used for the default Dutch voice

The default neural voice needs internet access while narration is synthesized. No speech API key is configured by StudyTube. The older local Piper service remains available through the optional `offline-tts` Compose profile.

## Recommended Unraid paths

Keep the repository and persistent data on cache-backed appdata storage where possible:

```text
/mnt/user/appdata/studytube/repo
/mnt/user/appdata/studytube/data
/mnt/user/appdata/studytube/piper
```

`data` contains jobs, cached narration, logs and finished renders. `piper` is only used when the offline fallback is enabled.

## First install

```bash
mkdir -p /mnt/user/appdata/studytube
cd /mnt/user/appdata/studytube
git clone https://github.com/remco59/StudyTube.git repo
cd repo
cp .env.example .env
mkdir -p /mnt/user/appdata/studytube/data /mnt/user/appdata/studytube/piper
```

Generate a strong access password:

```bash
openssl rand -base64 32
```

Put that value in `.env` as `STUDYTUBE_AUTH_PASSWORD`. StudyTube deliberately fails closed when this value is empty, so the UI and API are not exposed accidentally.

Then start the stack:

```bash
docker compose up -d --build
```

If this host has an Intel GPU and you want VAAPI rendering, opt in to the Intel device mapping with the supplied Compose override:

```bash
docker compose -f docker-compose.yml -f docker-compose.intel.yml up -d --build
```

Open:

```text
http://<tower-ip>:3000
```

Your browser will prompt for HTTP Basic credentials. The default username is `admin` unless `STUDYTUBE_AUTH_USER` is changed in `.env`.

The standard StudyTube Compose configuration does **not** require an NVIDIA runtime or `/dev/dri`, so a normal `docker compose up -d --build` starts on hosts without either GPU family. Intel `/dev/dri` is only mapped when `docker-compose.intel.yml` is included.

NVIDIA is optional. StudyTube checks whether NVIDIA devices are actually visible inside the running container. If they are not, NVIDIA NVENC is simply shown as unavailable in the web interface while CPU rendering keeps working.

## Access control

StudyTube protects the UI and all application API routes with HTTP Basic authentication. `/api/health` is intentionally left unauthenticated so Docker can perform health checks.

Configure access in `.env`:

```dotenv
STUDYTUBE_AUTH_USER=admin
STUDYTUBE_AUTH_PASSWORD=<long-random-password>
```

If `STUDYTUBE_AUTH_PASSWORD` is missing or empty, StudyTube returns `503` for protected routes instead of running without authentication.

Basic authentication must be transported over a trusted network or HTTPS. If you expose StudyTube outside your LAN, terminate HTTPS in a reverse proxy or tunnel; do not port-forward the plain HTTP service directly to the public internet.

## Credential storage security

Credentials entered through StudyTube's settings UI are persisted on disk under the configured credentials directory (by default `credentials/`) as JSON files. The files are created with owner-only mode `0600`, but their contents are **not encrypted at rest**.

Treat the credentials directory as secret data:

- do not put it in a publicly readable share or repository;
- restrict filesystem and backup access to trusted administrators;
- remember that snapshots and backups can contain historical copies of API keys or service-account credentials;
- rotate the affected provider credential if a credentials file, backup, or host account is exposed.

For deployments with stricter secret-management requirements, prefer injecting credentials through protected environment/secrets mechanisms where supported, and avoid sharing the StudyTube data/credentials volumes between untrusted users or tenants.

## Narration provider

The recommended default is:

```dotenv
STUDYTUBE_TTS_PROVIDER=edge
EDGE_TTS_VOICE=nl-NL-MaartenNeural
EDGE_TTS_RATE=+0%
```

To use fully local/offline Piper instead, change `.env` to:

```dotenv
STUDYTUBE_TTS_PROVIDER=piper
PIPER_VOICE=nl_NL-mls-medium
PIPER_LENGTH_SCALE=1
```

Then recreate the stack with the Piper profile enabled:

```bash
docker compose --profile offline-tts up -d --build
```

The first Piper start downloads its configured voice into `/mnt/user/appdata/studytube/piper`; later starts reuse it.

## Render engine selection

The Create workflow lets you choose the encoder for every individual video:

- **CPU (software)**: software H.264 encoding.
- **Intel GPU (VAAPI)**: Intel `/dev/dri` with FFmpeg `h264_vaapi`. Start Compose with `docker-compose.intel.yml` to expose the device.
- **NVIDIA NVENC**: Remotion's H.264 NVENC path when NVIDIA is exposed to the container.

StudyTube checks the hardware available inside the running container. If an encoder is not usable, its option is disabled in the web interface with a short explanation instead of silently falling back to CPU or preventing the app from starting.

You can verify the hardware exposed to the container with:

```bash
docker exec studytube ls -la /dev/dri
docker exec studytube ffmpeg -hide_banner -encoders | grep -E 'h264_vaapi|h264_nvenc'
```

If `/dev/dri` does not exist inside the container on an Intel-capable host, recreate the stack with:

```bash
docker compose -f docker-compose.yml -f docker-compose.intel.yml up -d --build
```

For NVIDIA specifically, the web UI only enables NVENC when `/dev/nvidia0` or `/dev/nvidiactl` is visible inside the container. Hosts without an NVIDIA runtime can ignore this entirely.

## Configuration

Copy `.env.example` to `.env` and adjust as needed:

```dotenv
STUDYTUBE_PORT=3000
STUDYTUBE_AUTH_USER=admin
STUDYTUBE_AUTH_PASSWORD=<long-random-password>
STUDYTUBE_DATA_PATH=/mnt/user/appdata/studytube/data
STUDYTUBE_RENDER_CONCURRENCY=2
STUDYTUBE_RENDER_TIMEOUT_MS=120000
STUDYTUBE_TTS_PROVIDER=edge
EDGE_TTS_VOICE=nl-NL-MaartenNeural
EDGE_TTS_RATE=+0%
```

The StudyTube container itself always uses `/data` for persistence and `/app/apps/renderer/src/index.ts` for the Remotion entry point.

## Health checks

StudyTube:

```bash
curl http://127.0.0.1:3000/api/health
```

Neural TTS:

```bash
docker exec studytube-neural-tts curl --fail --silent http://127.0.0.1:5050/health
```

Container state:

```bash
docker compose ps
```

## Logs

```bash
docker compose logs -f studytube
docker compose logs -f neural-tts
```

For the optional offline service:

```bash
docker compose --profile offline-tts logs -f piper
```

Every render also keeps job-specific diagnostics under:

```text
/mnt/user/appdata/studytube/data/jobs/<job-id>/
```

including `status.json` and `logs.ndjson`. The selected render engine is stored with the job and included in the render log metadata.

## Update

Updating remains the normal Compose workflow regardless of which encoder you use in the web interface:

```bash
cd /mnt/user/appdata/studytube/repo
git pull
docker compose build --pull
docker compose up -d
```

If you use Intel VAAPI, include the Intel override in the build/recreate commands as well:

```bash
docker compose -f docker-compose.yml -f docker-compose.intel.yml build --pull
docker compose -f docker-compose.yml -f docker-compose.intel.yml up -d
```

Persistent job data and the narration cache are not removed by rebuilding the containers.

## Stop / restart

```bash
docker compose stop
docker compose start
```

To recreate containers without deleting persistent data:

```bash
docker compose down
docker compose up -d
```

When running with the Intel override, use the same `-f docker-compose.yml -f docker-compose.intel.yml` arguments for lifecycle commands that recreate the stack.

Do not add `-v` to `docker compose down` if you later switch from bind mounts to named volumes and want to keep them.

## Troubleshooting

### The UI returns 503 instead of asking for a password

Set a non-empty `STUDYTUBE_AUTH_PASSWORD` in `.env`, then recreate the StudyTube container:

```bash
docker compose up -d --force-recreate studytube
```

### A GPU option shows as unavailable

Open the Render step and press **Detect** again. For Intel, verify the host has `/dev/dri` and that the stack was started with `docker-compose.intel.yml`. For NVIDIA, verify an NVIDIA device is actually exposed inside the container. StudyTube deliberately disables unavailable engines instead of silently falling back to CPU.

### Neural narration fails

Check:

```bash
docker compose logs neural-tts
docker compose logs studytube
```

The neural provider needs outbound internet access during synthesis. If that is unavailable, switch to the Piper fallback described above.

### StudyTube render fails but the UI stays up

Inspect the job directory and container logs:

```bash
docker compose logs studytube
ls -la /mnt/user/appdata/studytube/data/jobs
```

A failed job intentionally keeps its status and NDJSON logs.

### Chromium / Remotion errors

The StudyTube image installs Chrome Headless Shell during the image build using Remotion's `browser ensure` command. Rebuild the image after changing Remotion versions:

```bash
docker compose build --no-cache studytube
```

### Memory pressure

Long 1080p renders can use substantial memory because Chromium renders frames in parallel. Avoid running multiple full renders at once on a small server. StudyTube assumes a single-user, single-server workflow.
