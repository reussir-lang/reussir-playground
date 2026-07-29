# Docker image

The root `Dockerfile` downloads the matching Linux artifact from the public
Reussir `nightly` release, then builds only the playground server and frontend.
It supports `linux/amd64` and `linux/arm64`.

```bash
docker build -t reussir-playground .
docker run --rm -p 3000:3000 reussir-playground
```

The runtime image uses Landlock, keeps Rene/Cargo caches under
`/var/lib/reussir-playground`, and strips each generated WASM module before it
is returned to the browser.
