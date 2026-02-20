/**
 * Minimal WASI snapshot_preview1 shim for the Reussir playground.
 *
 * Captures stdout/stderr from wasm32-wasip1 binaries compiled by the
 * playground and returns them as strings.
 */

// WASI errno constants (subset)
const ESUCCESS = 0;
const EBADF = 8;
const ENOSYS = 52;
const ENOTDIR = 54;

// WASI filetype constants
const FILETYPE_CHARACTER_DEVICE = 2;

/**
 * Thrown by `proc_exit` — callers should catch it and inspect `exitCode`.
 */
export class WasiExit extends Error {
  readonly type = "proc_exit" as const;
  readonly exitCode: number;

  constructor(code: number) {
    super(`wasi: proc_exit(${code})`);
    this.exitCode = code;
  }
}

/**
 * Instantiate one WASI context per wasm module run.
 *
 * After `WebAssembly.instantiate` resolves, call `attachMemory` with the
 * exported `memory` object so that fd_write can access the linear memory.
 */
export class WasiCapture {
  stdout = "";
  stderr = "";
  private _memory: WebAssembly.Memory | null = null;
  private _decoder = new TextDecoder("utf-8", { fatal: false });

  attachMemory(memory: WebAssembly.Memory) {
    this._memory = memory;
  }

  buildImports(): WebAssembly.Imports {
    const self = this;
    return {
      wasi_snapshot_preview1: {
        // ── Environment / arguments ─────────────────────────────────
        args_get: () => ESUCCESS,
        args_sizes_get: (argc: number, argv_buf_size: number) => {
          const view = self._view32();
          view.setUint32(argc, 0, true);
          view.setUint32(argv_buf_size, 0, true);
          return ESUCCESS;
        },
        environ_get: () => ESUCCESS,
        environ_sizes_get: (count_ptr: number, size_ptr: number) => {
          const view = self._view32();
          view.setUint32(count_ptr, 0, true);
          view.setUint32(size_ptr, 0, true);
          return ESUCCESS;
        },

        // ── Clock ────────────────────────────────────────────────────
        clock_res_get: (_id: number, res_ptr: number) => {
          const view = self._view64();
          view.setBigUint64(res_ptr, 1_000_000n, true);
          return ESUCCESS;
        },
        clock_time_get: (
          _id: number,
          _precision: bigint,
          time_ptr: number,
        ) => {
          const view = self._view64();
          const ns = BigInt(Math.round(performance.now() * 1_000_000));
          view.setBigUint64(time_ptr, ns, true);
          return ESUCCESS;
        },

        // ── File descriptors ─────────────────────────────────────────
        fd_advise: () => ESUCCESS,
        fd_allocate: () => EBADF,
        fd_close: () => ESUCCESS,
        fd_datasync: () => ESUCCESS,
        fd_sync: () => ESUCCESS,
        fd_tell: () => EBADF,
        fd_seek: () => EBADF,
        fd_renumber: () => EBADF,

        fd_fdstat_get: (fd: number, buf: number) => {
          if (fd > 2) return EBADF;
          const view = new DataView(self._memory!.buffer);
          view.setUint8(buf, FILETYPE_CHARACTER_DEVICE);
          view.setUint8(buf + 1, 0);
          view.setBigUint64(buf + 8, 0n, true);
          view.setBigUint64(buf + 16, 0n, true);
          return ESUCCESS;
        },
        fd_fdstat_set_flags: () => ESUCCESS,

        fd_filestat_get: () => EBADF,
        fd_filestat_set_size: () => EBADF,
        fd_filestat_set_times: () => EBADF,

        // Preopened directories: none.
        fd_prestat_get: () => EBADF,
        fd_prestat_dir_name: () => EBADF,

        // stdin: always return EOF
        fd_read: (
          _fd: number,
          _iovs_ptr: number,
          _iovs_len: number,
          nread_ptr: number,
        ) => {
          const view = self._view32();
          view.setUint32(nread_ptr, 0, true);
          return ESUCCESS;
        },

        fd_readdir: () => EBADF,
        fd_pread: () => EBADF,
        fd_pwrite: () => EBADF,

        // ── The important one: write to stdout / stderr ───────────────
        fd_write: (
          fd: number,
          iovs_ptr: number,
          iovs_len: number,
          nwritten_ptr: number,
        ) => {
          if (fd !== 1 && fd !== 2) return EBADF;

          const mem = self._memory!.buffer;
          const view32 = new DataView(mem);
          let total = 0;

          for (let i = 0; i < iovs_len; i++) {
            const base = view32.getUint32(iovs_ptr + i * 8, true);
            const len = view32.getUint32(iovs_ptr + i * 8 + 4, true);
            if (len === 0) continue;
            const chunk = new Uint8Array(mem, base, len);
            const text = self._decoder.decode(chunk);
            if (fd === 1) self.stdout += text;
            else self.stderr += text;
            total += len;
          }

          new DataView(mem).setUint32(nwritten_ptr, total, true);
          return ESUCCESS;
        },

        // ── Path operations: no filesystem ───────────────────────────
        path_create_directory: () => ENOTDIR,
        path_filestat_get: () => ENOTDIR,
        path_filestat_set_times: () => ENOTDIR,
        path_link: () => ENOTDIR,
        path_open: () => ENOTDIR,
        path_readlink: () => ENOTDIR,
        path_remove_directory: () => ENOTDIR,
        path_rename: () => ENOTDIR,
        path_symlink: () => ENOTDIR,
        path_unlink_file: () => ENOTDIR,

        // ── Misc ─────────────────────────────────────────────────────
        poll_oneoff: () => ENOSYS,
        sched_yield: () => ESUCCESS,

        random_get: (buf_ptr: number, buf_len: number) => {
          const bytes = new Uint8Array(
            self._memory!.buffer,
            buf_ptr,
            buf_len,
          );
          crypto.getRandomValues(bytes);
          return ESUCCESS;
        },

        // ── Process ──────────────────────────────────────────────────
        proc_exit: (code: number) => {
          throw new WasiExit(code);
        },
        proc_raise: () => ENOSYS,

        // ── Sockets: not supported ───────────────────────────────────
        sock_accept: () => ENOSYS,
        sock_recv: () => ENOSYS,
        sock_send: () => ENOSYS,
        sock_shutdown: () => ENOSYS,
      },
    };
  }

  private _view32() {
    return new DataView(this._memory!.buffer);
  }
  private _view64() {
    return new DataView(this._memory!.buffer);
  }
}

export interface WasmResult {
  stdout: string;
  stderr: string;
  exitCode: number;
}

/**
 * Compile and run a wasm32-wasip1 binary, returning its captured output.
 */
export async function runWasm(
  wasmBytes: ArrayBuffer | Uint8Array,
  timeoutMs = 10_000,
): Promise<WasmResult> {
  const wasi = new WasiCapture();
  const buffer: ArrayBuffer =
    wasmBytes instanceof ArrayBuffer
      ? wasmBytes
      : (wasmBytes.buffer.slice(
          wasmBytes.byteOffset,
          wasmBytes.byteOffset + wasmBytes.byteLength,
        ) as ArrayBuffer);
  const module = await WebAssembly.compile(buffer);
  const instance = await WebAssembly.instantiate(module, wasi.buildImports());

  const memory = instance.exports.memory;
  if (!(memory instanceof WebAssembly.Memory)) {
    throw new Error("wasm module does not export a memory object");
  }
  wasi.attachMemory(memory);

  const _start = instance.exports._start;
  if (typeof _start !== "function") {
    throw new Error("wasm module does not export `_start`");
  }

  let exitCode = 0;

  await Promise.race([
    (async () => {
      try {
        (_start as () => void)();
      } catch (e) {
        if (e instanceof WasiExit) {
          exitCode = e.exitCode;
        } else {
          throw e;
        }
      }
    })(),
    new Promise<never>((_, reject) =>
      setTimeout(
        () => reject(new Error("wasm execution timed out")),
        timeoutMs,
      ),
    ),
  ]);

  return { stdout: wasi.stdout, stderr: wasi.stderr, exitCode };
}
