# Running StudyTube on Unraid

StudyTube is designed to run as two local containers:

- `studytube`: Next.js UI, job worker and Remotion renderer
- `studytube-piper`: local Piper HTTP text-to-speech service

No paid generation API is required.

## Recommended Unraid paths

Keep the repository and persistent data on cache-backed appdata storage where possible:

```text
/mnt/user/appdata/studytube/repo
/mnt/user/appdata/studytube/data
/mnt/user/appdata/studytube/piper
```

`data` contains jobs, cached narration, logs and finished renders. `piper` contains the downloaded voice model. Both survive container replacement.

## First install

```bash
mkdir -p /mnt/user/appdata/studytube
cd /mnt/user/appdata/studytube
git clone https://github.com/remco59/StudyTube.git repo
cd repo
cp .env.example .env
mkdir -p /mnt/user/appdata/studytube/data /mnt/user/appdata/studytube/piper
docker compose up -d --build
```

Open:

```text
http://<tower-ip>:3000
```

The first Piper startup downloads the configured Dutch voice. Later starts reuse the persistent model directory.

## Intel `/dev/dri` access

The base compose file deliberately does not require a GPU device. It therefore works with CPU rendering only.

On Tower, where Intel UHD graphics exposes `/dev/dri`, start with the optional override:

```bash
docker compose -f docker-compose.yml -f docker-compose.qsv.yml up -d --build
```

This makes `/dev/dri` available inside StudyTube so Intel media acceleration can be evaluated and used by future FFmpeg optimizations. The current render pipeline remains CPU-compatible and does not require Quick Sync.

Check the device inside the container with:

```bash
docker exec studytube ls -la /dev/dri
```

If the host has no `/dev/dri`, use only the base compose file.

## Configuration

Copy `.env.example` to `.env` and adjust as needed:

```dotenv
STUDYTUBE_PORT=3000
STUDYTUBE_DATA_PATH=/mnt/user/appdata/studytube/data
PIPER_DATA_PATH=/mnt/user/appdata/studytube/piper
PIPER_VOICE=nl_NL-mls-medium
PIPER_LENGTH_SCALE=1
```

The container itself always uses `/data` for StudyTube persistence and `/app/apps/renderer/src/index.ts` for the Remotion entry point. The host paths above are mounted into those container paths.

## Health checks

StudyTube:

```bash
curl http://127.0.0.1:3000/api/health
```

Piper from the Docker network:

```bash
docker exec studytube-piper python -c "import urllib.request; print(urllib.request.urlopen('http://127.0.0.1:5000/info').read().decode())"
```

Container state:

```bash
docker compose ps
```

## Logs

```bash
docker compose logs -f studytube
docker compose logs -f piper
```

Every render also keeps job-specific diagnostics under:

```text
/mnt/user/appdata/studytube/data/jobs/<job-id>/
```

including `status.json` and `logs.ndjson`.

## Update

CPU-safe deployment:

```bash
cd /mnt/user/appdata/studytube/repo
git pull
docker compose build --pull
docker compose up -d
```

With the Intel device override:

```bash
cd /mnt/user/appdata/studytube/repo
git pull
docker compose -f docker-compose.yml -f docker-compose.qsv.yml build --pull
docker compose -f docker-compose.yml -f docker-compose.qsv.yml up -d
```

Persistent `data` and Piper voice files are not removed by rebuilding the containers.

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

Do not add `-v` to `docker compose down` if you later switch from bind mounts to named volumes and want to keep them.

## Troubleshooting

### Piper stays unhealthy

Check:

```bash
docker compose logs piper
```

The most common first-start cause is still downloading the voice or a network failure while retrieving it.

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

Long 1080p renders can use substantial memory because Chromium renders frames in parallel. Avoid running multiple full renders at once on a small server. StudyTube v1 assumes a single-user, single-server workflow.
