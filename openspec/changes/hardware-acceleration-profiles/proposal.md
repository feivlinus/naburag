# Proposal

## Why

Currently, Ollama is deployed in Docker without hardware resource reservations, defaulting to CPU-only inference. On systems equipped with modern GPUs (such as NVIDIA GeForce/RTX or AMD Radeon), CPU execution results in 15–40 second latency per query instead of sub-second inference. Developers and operators require a declarative, environment-driven configuration via `.env` to select their hardware target (`nvidia`, `amd`, or `cpu`) so that Docker Compose automatically provisions the appropriate device drivers, runtime images, and memory optimizations without manual manifest edits.

## What Changes

- Add configurable hardware profile options to `.env.example`:
  - Support Docker Compose profiles via `COMPOSE_PROFILES=nvidia|rocm|cpu` (defaulting safely to `cpu`).
- Update `docker-compose.yml` to define multi-profile Ollama service configurations:
  - **NVIDIA CUDA Profile**: Declares `deploy.resources.reservations.devices` with `driver: nvidia`, `count: all`, `capabilities: [gpu]`, and enables `OLLAMA_FLASH_ATTENTION=1` for modern architectures (e.g. RTX 30/40-series).
  - **AMD ROCm Profile**: Uses `ollama/ollama:rocm` with Linux device passthrough (`/dev/kfd`, `/dev/dri`) and video/render group permissions.
  - **CPU Profile**: Retains the zero-dependency standard `ollama/ollama:latest` container configured for host CPU execution.
- Document hardware acceleration setup, prerequisites (NVIDIA Container Toolkit / AMD ROCm), and verification steps in `README.md`.

## Capabilities

### New Capabilities

- `hardware-acceleration`: Declarative environment-based configuration for containerized LLM and embedding hardware acceleration, supporting NVIDIA CUDA, AMD ROCm, and CPU execution modes.

### Modified Capabilities

<!-- None: Existing ingestion, retrieval, API, and UI behavior and schemas remain unchanged. -->

## Impact

- **Infrastructure Files**: `docker-compose.yml`, `.env.example`, `.env`.
- **Scripts & Package Configuration**: `package.json` (`infra:up` and diagnostic check).
- **Documentation**: `README.md` updated with hardware acceleration matrix and configuration guides.
- **Compatibility**: Fully backwards-compatible; environments lacking GPU pass-through default cleanly to CPU execution without runtime errors.
