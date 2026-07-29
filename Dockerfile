# syntax=docker/dockerfile:1.7

ARG UBUNTU_VERSION=24.04
ARG RUST_NIGHTLY=nightly-2025-12-01

# ---------------------------------------------------------------------------
# Stage 1: Download the self-contained Reussir nightly toolchain
# ---------------------------------------------------------------------------

FROM ubuntu:${UBUNTU_VERSION} AS reussir-nightly
ARG TARGETARCH
ARG REUSSIR_NIGHTLY_SHA=nightly

RUN apt-get update && apt-get install -y --no-install-recommends \
    ca-certificates \
    curl \
    xz-utils \
    && rm -rf /var/lib/apt/lists/*

# REUSSIR_NIGHTLY_SHA is intentionally consumed as a cache key. The public
# `nightly` release URL is stable while its assets are replaced on every build.
RUN echo "nightly=${REUSSIR_NIGHTLY_SHA}" \
    && case "${TARGETARCH}" in \
         amd64) REUSSIR_ARCH=x86_64 ;; \
         arm64) REUSSIR_ARCH=aarch64 ;; \
         *) echo "unsupported Docker architecture: ${TARGETARCH}" >&2; exit 1 ;; \
       esac \
    && ASSET="reussir-nightly-linux-${REUSSIR_ARCH}.tar.xz" \
    && curl --fail --location --retry 5 \
       "https://github.com/reussir-lang/reussir/releases/download/nightly/${ASSET}" \
       --output /tmp/reussir-nightly.tar.xz \
    && mkdir -p /opt/reussir \
    && tar -xJf /tmp/reussir-nightly.tar.xz --strip-components=1 -C /opt/reussir \
    && rm /tmp/reussir-nightly.tar.xz \
    && /opt/reussir/bin/rrc --help >/dev/null \
    && /opt/reussir/bin/rene --help >/dev/null

# ---------------------------------------------------------------------------
# Stage 2: Build the Rust server
# ---------------------------------------------------------------------------

FROM ubuntu:${UBUNTU_VERSION} AS playground-builder
ARG DEBIAN_FRONTEND=noninteractive

RUN apt-get update && apt-get install -y --no-install-recommends \
    ca-certificates \
    curl \
    build-essential \
    pkg-config \
    libssl-dev \
    && rm -rf /var/lib/apt/lists/*

ENV RUSTUP_HOME=/usr/local/rustup
ENV CARGO_HOME=/usr/local/cargo
ENV PATH=/usr/local/cargo/bin:$PATH

RUN curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs \
    | sh -s -- -y --profile minimal --default-toolchain stable

WORKDIR /workspace
COPY Cargo.toml Cargo.lock ./
COPY server/Cargo.toml server/Cargo.toml
COPY server server
RUN cargo build --release --locked -p reussir-playground \
    && ./target/release/reussir-playground --help | grep -q "Reussir language playground server"

# ---------------------------------------------------------------------------
# Stage 3: Build the React frontend
# ---------------------------------------------------------------------------

FROM node:22-slim AS frontend-builder
WORKDIR /workspace/frontend
COPY frontend/package.json frontend/pnpm-lock.yaml ./
RUN corepack enable && pnpm install --frozen-lockfile
COPY frontend/ .
RUN pnpm run build

# ---------------------------------------------------------------------------
# Stage 4: Runtime image
# ---------------------------------------------------------------------------

FROM ubuntu:${UBUNTU_VERSION} AS runtime
ARG DEBIAN_FRONTEND=noninteractive
ARG RUST_NIGHTLY

RUN apt-get update && apt-get install -y --no-install-recommends \
    ca-certificates \
    curl \
    tini \
    build-essential \
    llvm \
    && rm -rf /var/lib/apt/lists/*

RUN useradd --create-home --uid 10001 --shell /usr/sbin/nologin app

ENV RUSTUP_HOME=/opt/rustup
ENV CARGO_HOME=/opt/cargo
ENV PATH=/opt/cargo/bin:$PATH

RUN curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs \
    | sh -s -- -y --profile minimal --default-toolchain "${RUST_NIGHTLY}" \
    && rustup target add wasm32-wasip1

WORKDIR /opt/reussir-playground

COPY --from=playground-builder /workspace/target/release/reussir-playground /usr/local/bin/reussir-playground
COPY --from=reussir-nightly /opt/reussir/bin /opt/reussir/bin
RUN ln -s /opt/reussir/bin/rrc /usr/local/bin/rrc \
    && ln -s /opt/reussir/bin/rene /usr/local/bin/rene

COPY --from=frontend-builder /workspace/frontend/dist frontend/dist
COPY docker/config.landlock.toml /etc/reussir-playground/config.toml

RUN mkdir -p \
      /var/lib/reussir-playground/rene \
      /tmp/reussir-playground \
    && chown -R app:app \
      /var/lib/reussir-playground \
      /tmp/reussir-playground \
      /opt/reussir-playground \
    && chmod -R a+rX /opt/reussir /opt/rustup /opt/cargo

ENV TMPDIR=/tmp/reussir-playground
ENV RUST_LOG=info

USER app
EXPOSE 3000

ENTRYPOINT ["/usr/bin/tini", "--"]
CMD ["reussir-playground", "--config", "/etc/reussir-playground/config.toml"]
