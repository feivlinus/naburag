# Spec Delta

## Purpose

Enables declarative, environment-driven configuration for LLM and embedding hardware acceleration, allowing seamless deployment across NVIDIA GPUs, AMD ROCm devices, and standard CPU environments.

## ADDED Requirements

### Requirement: Declarative Acceleration Configuration
The system SHALL parse hardware acceleration target settings from `.env` through `COMPOSE_PROFILES`, supporting `nvidia`, `amd` (or `rocm`), and `cpu` options, defaulting to `cpu` in `.env.example`.

#### Scenario: Sourcing configured profile from .env
- **WHEN** `.env` contains `COMPOSE_PROFILES=nvidia`
- **THEN** container startup commands activate the NVIDIA hardware acceleration profile

#### Scenario: Defaulting when acceleration is initialized from template
- **WHEN** `.env.example` is copied to `.env`
- **THEN** container startup defaults to the CPU profile without raising driver errors

### Requirement: NVIDIA GPU Acceleration Profile
When configured for NVIDIA, the container infrastructure SHALL request NVIDIA GPU device reservations with all CUDA capabilities, pass VRAM optimizations, and enable FlashAttention on compatible architectures.

#### Scenario: Running Ollama with NVIDIA GPU
- **WHEN** the NVIDIA profile is launched on a host with NVIDIA GPU and container toolkit
- **THEN** Ollama detects CUDA devices and offloads embedding and inference layers to GPU VRAM

### Requirement: AMD ROCm Acceleration Profile
When configured for AMD, the container infrastructure SHALL launch the ROCm-enabled Ollama image with necessary device bindings (`/dev/kfd` and `/dev/dri`).

#### Scenario: Running Ollama with AMD ROCm
- **WHEN** the AMD profile is activated on an AMD ROCm supported host
- **THEN** Ollama boots using the ROCm container image with access to host ROCm devices

### Requirement: CPU Fallback Execution Profile
When configured for CPU, the container infrastructure SHALL run the standard CPU container image with optimal multi-thread allocation and zero GPU device dependencies.

#### Scenario: Running Ollama on standard CPU
- **WHEN** the CPU profile is activated
- **THEN** Ollama runs using host CPU cores and memory without requiring GPU driver mounts
