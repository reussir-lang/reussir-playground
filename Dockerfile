# syntax=docker/dockerfile:1.7

ARG UBUNTU_VERSION=24.04
ARG LLVM_VERSION=22
ARG REUSSIR_REF=main
ARG RUST_NIGHTLY=nightly-2025-12-01

FROM ubuntu:${UBUNTU_VERSION} AS reussir-builder
ARG DEBIAN_FRONTEND=noninteractive
ARG LLVM_VERSION
ARG REUSSIR_REF
ARG RUST_NIGHTLY

ENV PATH=/root/.cargo/bin:/root/.ghcup/bin:$PATH

RUN apt-get update && apt-get install -y --no-install-recommends \
    ca-certificates \
    curl \
    git \
    gnupg \
    lsb-release \
    python3 \
    python3-pip \
    cmake \
    ninja-build \
    wget \
    build-essential \
    pkg-config \
    xz-utils \
    libgtest-dev \
    libgmock-dev \
    libspdlog-dev \
    libgmp-dev \
    && rm -rf /var/lib/apt/lists/*

# Match reussir CI LLVM installation on Ubuntu.
RUN wget -qO- https://apt.llvm.org/llvm-snapshot.gpg.key | tee /etc/apt/trusted.gpg.d/apt.llvm.org.asc >/dev/null \
    && CODENAME="$(. /etc/os-release && echo "${UBUNTU_CODENAME}")" \
    && echo "deb http://apt.llvm.org/${CODENAME}/ llvm-toolchain-${CODENAME}-${LLVM_VERSION} main" > /etc/apt/sources.list.d/llvm.list \
    && apt-get update \
    && apt-get install -y --no-install-recommends \
       clang-${LLVM_VERSION} \
       lldb-${LLVM_VERSION} \
       lld-${LLVM_VERSION} \
       clangd-${LLVM_VERSION} \
       libmlir-${LLVM_VERSION}-dev \
       mlir-${LLVM_VERSION}-tools \
       llvm-${LLVM_VERSION}-dev \
       llvm-${LLVM_VERSION}-tools \
    && rm -rf /var/lib/apt/lists/*

RUN pip3 install --no-cache-dir --break-system-packages lit

RUN curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs \
    | sh -s -- -y --profile minimal --default-toolchain "${RUST_NIGHTLY}" \
    && rustup component add rust-src rustfmt clippy

RUN curl --proto '=https' --tlsv1.2 -sSf https://get-ghcup.haskell.org \
    | BOOTSTRAP_HASKELL_NONINTERACTIVE=1 \
      BOOTSTRAP_HASKELL_GHC_VERSION=9.14.1 \
      BOOTSTRAP_HASKELL_CABAL_VERSION=latest \
      sh

RUN bash -lc "source /root/.ghcup/env && cabal update"

# Bust Docker layer cache for git clone when the upstream ref changes.
# Pass --build-arg CACHEBUST=$(date +%s) (or a commit SHA) to force a fresh clone.
ARG CACHEBUST
RUN git clone --depth 1 --branch "${REUSSIR_REF}" https://github.com/reussir-lang/reussir.git /opt/reussir
WORKDIR /opt/reussir

RUN bash -lc "source /root/.ghcup/env \
 && cmake -B build \
    -G Ninja \
    -DLLVM_USE_LINKER=lld \
    -DCMAKE_CXX_COMPILER=clang++-${LLVM_VERSION} \
    -DCMAKE_C_COMPILER=clang-${LLVM_VERSION} \
    -DCMAKE_BUILD_TYPE=Release \
    -DREUSSIR_ENABLE_PEDANTIC=OFF \
    -DREUSSIR_ENABLE_TESTS=OFF \
    -DLLVM_DIR=/usr/lib/llvm-${LLVM_VERSION}/lib/cmake/llvm \
    -DMLIR_DIR=/usr/lib/llvm-${LLVM_VERSION}/lib/cmake/mlir \
 && cmake --build build --parallel --target reussir-compiler"

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
ARG LLVM_VERSION
ARG RUST_NIGHTLY

RUN apt-get update && apt-get install -y --no-install-recommends \
    ca-certificates \
    curl \
    tini \
    wget \
    libgmp10 \
    libstdc++6 \
    zlib1g \
    libzstd1 \
    libtinfo6 \
    libffi8 \
    && rm -rf /var/lib/apt/lists/*

# Install the same LLVM runtime packages expected by the compiler build.
RUN wget -qO- https://apt.llvm.org/llvm-snapshot.gpg.key | tee /etc/apt/trusted.gpg.d/apt.llvm.org.asc >/dev/null \
    && CODENAME="$(. /etc/os-release && echo "${UBUNTU_CODENAME}")" \
    && echo "deb http://apt.llvm.org/${CODENAME}/ llvm-toolchain-${CODENAME}-${LLVM_VERSION} main" > /etc/apt/sources.list.d/llvm.list \
    && apt-get update \
    && apt-get install -y --no-install-recommends \
       clang-${LLVM_VERSION} \
       libmlir-${LLVM_VERSION}-dev \
       llvm-${LLVM_VERSION}-dev \
    && rm -rf /var/lib/apt/lists/*

RUN useradd --create-home --uid 10001 --shell /usr/sbin/nologin app

ENV RUSTUP_HOME=/opt/rustup
ENV CARGO_HOME=/opt/cargo
ENV PATH=/opt/cargo/bin:$PATH

RUN curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs \
    | sh -s -- -y --profile minimal --default-toolchain "${RUST_NIGHTLY}" \
    && rustup target add wasm32-wasip1 \
    && chown -R app:app /opt/rustup /opt/cargo

WORKDIR /opt/reussir-playground

COPY --from=playground-builder /workspace/target/release/reussir-playground /usr/local/bin/reussir-playground
COPY --from=reussir-builder /opt/reussir/build/bin /opt/reussir/build/bin
COPY --from=reussir-builder /opt/reussir/build/lib /opt/reussir/build/lib
COPY --from=reussir-builder /opt/reussir/runtime /opt/reussir/runtime

COPY --from=frontend-builder /workspace/frontend/dist frontend/dist
COPY docker/config.landlock.toml /etc/reussir-playground/config.toml

RUN mkdir -p /var/lib/reussir-playground/playground-target /tmp/reussir-playground \
    && chown -R app:app /var/lib/reussir-playground /tmp/reussir-playground /opt/reussir-playground \
    && chmod -R a+rX /opt/reussir

RUN ln -sf /usr/bin/clang-${LLVM_VERSION} /usr/bin/cc

ENV LD_LIBRARY_PATH=/opt/reussir/build/lib:/usr/lib/llvm-${LLVM_VERSION}/lib
ENV TMPDIR=/tmp/reussir-playground
ENV RUST_LOG=info

USER app
EXPOSE 3000

ENTRYPOINT ["/usr/bin/tini", "--"]
CMD ["reussir-playground", "--config", "/etc/reussir-playground/config.toml"]
