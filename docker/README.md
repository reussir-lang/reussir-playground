# Dockerized Reussir Playground (Landlock)

This setup builds:
- `reussir-playground` (webserver)
- `reussir-compiler` from `reussir-lang/reussir` (using the upstream Ubuntu CI stack)

It configures the server with `sandbox.kind = "landlock"` via `docker/config.landlock.toml`.

## 1. Build the image

```bash
docker build -t reussir-playground:landlock .
```

Optional build args:

```bash
docker build \
  --build-arg REUSSIR_REF=main \
  --build-arg LLVM_VERSION=22 \
  --build-arg RUST_NIGHTLY=nightly-2025-12-01 \
  -t reussir-playground:landlock .
```

## 2. Run with the Landlock-aware seccomp profile

Landlock syscalls are blocked by many default container seccomp policies.
Use the provided `docker/seccomp-landlock.json` profile when running.

```bash
docker run --rm \
  -p 3000:3000 \
  --security-opt no-new-privileges:true \
  --security-opt seccomp=$(pwd)/docker/seccomp-landlock.json \
  reussir-playground:landlock
```

Then open `http://127.0.0.1:3000`.

## Notes

- Host kernel must support Landlock (`>= 5.13`).
- The compiler/runtime cache is stored at `/var/lib/reussir-playground/playground-target` inside the container.
- The default runtime config path is `/etc/reussir-playground/config.toml`.
