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
docker compose up -d --build
```

Open:

```text
http://<tower-ip>:3000
```

The default stack starts the neural TTS bridge immediately; there is no voice-model download step.

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

- **CPU (software)**: always available and uses software H.264 encoding.
- **Intel GPU (VAAPI)**: uses the Intel render device exposed through `/dev/dri` and FFmpeg's `h264_vaapi` encoder.
- **NVIDIA NVENC**: uses Remotion's native H.264 NVENC path.

StudyTube detects the hardware available **inside the running container**. Missing GPU options are disabled in the web interface with a short explanation. Selecting Intel or NVIDIA is therefore a per-job choice, but Docker must still expose the relevant hardware to the container once when the stack is configured.

### Intel `/dev/dri`

On a host with Intel integrated graphics, use the Intel override:

```bash
docker compose -f docker-compose.yml -f docker-compose.qsv.yml up -d --build
```

The StudyTube image contains the Intel media VAAPI driver. Check the device inside the container with:

```bash
docker exec studytube ls -la /dev/dri
```

After the container is running, the Create → Render step should show **Intel GPU (VAAPI)** as available.

### NVIDIA NVENC

NVIDIA requires the NVIDIA driver and NVIDIA Container Toolkit on the Unraid host. Start StudyTube with:

```bash
docker compose -f docker-compose.yml -f docker-compose.nvidia.yml up -d --build
```

The override exposes the NVIDIA GPU and enables the `video` driver capability required by NVENC. After startup, **NVIDIA NVENC** should show as available in the Render step.

### Expose Intel and NVIDIA together

If the server has both GPUs, expose both to the same StudyTube container:

```bash
docker compose \
  -f docker-compose.yml \
  -f docker-compose.qsv.yml \
  -f docker-compose.nvidia.yml \
  up -d --build
```

You then keep one StudyTube stack running and choose **CPU**, **Intel** or **NVIDIA** separately for each video from the web interface. You no longer need to recreate the container merely to switch the encoder used by the next job.

If you always want the same override files applied, Docker Compose also supports configuring `COMPOSE_FILE` in your shell or deployment configuration so ordinary `docker compose up -d` and update commands reuse them.

## Configuration

Copy `.env.example` to `.env` and adjust as needed:

```dotenv
STUDYTUBE_PORT=3000
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

CPU-only deployment:

```bash
cd /mnt/user/appdata/studytube/repo
git pull
docker compose build --pull
docker compose up -d
```

For GPU-enabled deployments, use the same override files you used at installation. For example, with both Intel and NVIDIA:

```bash
cd /mnt/user/appdata/studytube/repo
git pull
docker compose -f docker-compose.yml -f docker-compose.qsv.yml -f docker-compose.nvidia.yml build --pull
docker compose -f docker-compose.yml -f docker-compose.qsv.yml -f docker-compose.nvidia.yml up -d
```

Persistent job data and the narration cache are not removed by rebuilding the containers.

## Stop / restart

Use the same Compose files that were used to create the stack. For a CPU-only deployment:

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

### A GPU option shows as unavailable

Open the Render step and press **Detect** again. For Intel, verify `/dev/dri` exists inside the container. For NVIDIA, verify the NVIDIA Container Toolkit is working and the NVIDIA device is visible inside the container. StudyTube deliberately disables unavailable engines instead of silently falling back to CPU.

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
