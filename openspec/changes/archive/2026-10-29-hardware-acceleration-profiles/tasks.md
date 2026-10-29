# Tasks

## 1. Environment & Compose Infrastructure

- [x] 1.1 Update `.env.example` to define `COMPOSE_PROFILES=nvidia|rocm|cpu` with clear documentation for NVIDIA CUDA, AMD ROCm, and CPU fallback profiles; verify `.env.example` contents.
- [x] 1.2 Refactor `docker-compose.yml` to define profiled Ollama services (`ollama-nvidia`, `ollama-rocm`, and `ollama-cpu`) sharing network alias `ollama`, host port `11434`, and persistent volume `ollama_data`; verify compose syntax via `docker compose config`.

## 2. Profile Verification & Integration

- [x] 2.1 Verify container profile activation with `COMPOSE_PROFILES=nvidia` on the local GPU environment; verify GPU offload and sub-2s query latency on `docker compose exec app bun run eval`.
- [x] 2.2 Verify fallback behavior with `COMPOSE_PROFILES=cpu` to ensure zero-regression on environments lacking GPU drivers; verify `docker compose config` and container startup.

## 3. Documentation

- [x] 3.1 Update `README.md` with a dedicated Hardware Acceleration guide covering NVIDIA CUDA, AMD ROCm, and CPU profiles, Docker prerequisites, and troubleshooting; verify documented commands.
