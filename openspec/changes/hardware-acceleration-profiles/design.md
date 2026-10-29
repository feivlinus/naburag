# Design

## Context

NabuRAG orchestrates local dependencies via Docker Compose (`app`, `postgres`, `qdrant`, `ollama`). Currently, `ollama` is defined as a single static service without device reservations, forcing inference and embedding (`bge-m3`, `llama3.2`) to execute exclusively on host CPU cores.

Modern host hardware frequently includes dedicated GPUs (NVIDIA CUDA or AMD ROCm) capable of cutting inference latency from 20–40 seconds to under 2 seconds. However, hardcoding GPU device blocks into `docker-compose.yml` breaks environments that lack GPU pass-through or the NVIDIA Container Toolkit.

See `proposal.md` for background and `specs/hardware-acceleration/spec.md` for behavioral requirements.

## Goals / Non-Goals

**Goals:**
- Provide a declarative `.env` control (`COMPOSE_PROFILES=nvidia|rocm|cpu`) that activates the appropriate Ollama acceleration profile.
- Enable full GPU offloading (CUDA) with FlashAttention for NVIDIA architectures.
- Enable ROCm device mounting for AMD Radeon GPUs.
- Provide a zero-configuration CPU fallback profile for standard dev environments and CI runners.
- Maintain consistent internal service networking (`http://ollama:11434`) so that the `app` container configuration requires no changes regardless of active profile.

**Non-Goals:**
- Supporting Apple Silicon Metal within Linux Docker containers (macOS users running Ollama natively outside Docker connect via `host.docker.internal`).
- Multi-node distributed GPU orchestration.

## Decisions

### 1. Docker Compose Profiles with Shared Network Aliases
**Choice:** Use native Docker Compose Profiles (`profiles: ["nvidia"]`, `profiles: ["rocm"]`, `profiles: ["cpu"]`) with a shared network alias `ollama`.

```yaml
  ollama-nvidia:
    image: ollama/ollama:latest
    container_name: local-rag-ollama
    profiles: ["nvidia"]
    ports:
      - "11434:11434"
    volumes:
      - ollama_data:/root/.ollama
    environment:
      - OLLAMA_FLASH_ATTENTION=1
      - OLLAMA_NUM_PARALLEL=2
    deploy:
      resources:
        reservations:
          devices:
            - driver: nvidia
              count: all
              capabilities: [gpu]
    networks:
      default:
        aliases:
          - ollama

  ollama-rocm:
    image: ollama/ollama:rocm
    container_name: local-rag-ollama
    profiles: ["amd", "rocm"]
    ports:
      - "11434:11434"
    volumes:
      - ollama_data:/root/.ollama
    devices:
      - /dev/kfd
      - /dev/dri
    group_add:
      - video
    networks:
      default:
        aliases:
          - ollama

  ollama-cpu:
    image: ollama/ollama:latest
    container_name: local-rag-ollama
    profiles: ["cpu"]
    ports:
      - "11434:11434"
    volumes:
      - ollama_data:/root/.ollama
    networks:
      default:
        aliases:
          - ollama
```

*Rationale:*
- Docker Compose natively respects `COMPOSE_PROFILES` defined in `.env`.
- Regardless of which profile is active, the container exposes host port `11434` and resolves internally as `http://ollama:11434` for the `app` container.
- Avoids brittle shell wrapper scripts or dynamic file generation.

*Alternatives Considered:*
- *Compose override files (`docker-compose.override.yml`)*: Requires running file-copy or symlink setup scripts, which are error-prone across Windows, macOS, and Linux.
- *Single service with conditional environment variables*: Compose does not support conditionally mounting `deploy.resources.reservations.devices` via environment variables; invalid device drivers crash the entire stack.

### 2. Environment Configuration & Safe Defaults
**Choice:**
In `.env.example`:
```bash
# Hardware Acceleration Profile: nvidia | rocm | cpu
COMPOSE_PROFILES=cpu
```
For users with NVIDIA GPUs, setting `COMPOSE_PROFILES=nvidia` in `.env` immediately provisions CUDA without further configuration.

### 3. Diagnostic & Verification Script
**Choice:** Provide a lightweight diagnostic task in `package.json` (`bun run check:hardware` or via `infra:up` notes) that verifies whether Ollama is utilizing GPU VRAM.

## Risks / Trade-offs

- **[Risk] Missing NVIDIA Container Toolkit on Host** → If `COMPOSE_PROFILES=nvidia` is selected on a host where the Docker NVIDIA runtime is not configured, Docker Compose throws `could not select device driver "" with capabilities: [[gpu]]`.
  - *Mitigation*: Document clear prerequisites in `README.md` and provide immediate guidance to switch `.env` to `COMPOSE_PROFILES=cpu`.
- **[Risk] Multiple Profiles Active Simultaneously** → If `COMPOSE_PROFILES=nvidia,cpu` is passed, port conflict `11434` would occur.
  - *Mitigation*: Explicitly document single-profile selection in `.env.example` comments.
