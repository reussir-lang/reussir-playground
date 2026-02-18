/**
 * Minimal WASI snapshot_preview1 shim for the Reussir playground.
 *
 * Goals
 * -----
 *  - Capture stdout / stderr from wasm32-wasip1 binaries compiled by the
 *    playground and return them as strings — no DOM side-effects.
 *  - Implement enough of the WASI surface that a standard Rust binary
 *    (compiled with `panic = "abort"`) can boot and run to completion.
 *  - Remain self-contained: no CDN imports, no bundler required.
 *
 * Non-goals
 * ---------
 *  - Full POSIX file-system, networking, or threading support.
 *  - Spec-perfect error codes for every edge case.
 *
 * Usage
 * -----
 *  import { WasiCapture, runWasm } from './wasi.js';
 *
 *  // High-level helper:
 *  const { stdout, stderr, exitCode } = await runWasm(wasmBytes);
 *
 *  // Low-level:
 *  const wasi = new WasiCapture();
 *  const module = await WebAssembly.compile(wasmBytes);
 *  const instance = await WebAssembly.instantiate(module, wasi.buildImports());
 *  wasi.attachMemory(instance.exports.memory);
 *  try {
 *      instance.exports._start();
 *  } catch (e) {
 *      if (e?.type !== 'proc_exit') throw e;
 *  }
 *  console.log(wasi.stdout);
 */

// WASI errno constants (subset)
const ESUCCESS = 0;
const EBADF    = 8;
const EINVAL   = 28;
const ENOSYS   = 52;
const ENOTDIR  = 54;

// WASI filetype constants
const FILETYPE_UNKNOWN          = 0;
const FILETYPE_CHARACTER_DEVICE = 2;

/**
 * Thrown by `proc_exit` — callers should catch it and inspect `exitCode`.
 */
export class WasiExit extends Error {
    /** @param {number} code */
    constructor(code) {
        super(`wasi: proc_exit(${code})`);
        this.type = 'proc_exit';
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
    constructor() {
        this.stdout = '';
        this.stderr = '';
        this._memory = null;
        this._decoder = new TextDecoder('utf-8', { fatal: false });
    }

    /**
     * Must be called before `_start` so fd_write can read iov buffers.
     * @param {WebAssembly.Memory} memory
     */
    attachMemory(memory) {
        this._memory = memory;
    }

    /**
     * Returns the imports object to pass to `WebAssembly.instantiate`.
     */
    buildImports() {
        // All methods are bound so they can be destructured by the caller.
        const self = this;
        return {
            wasi_snapshot_preview1: {
                // ── Environment / arguments ─────────────────────────────────
                args_get:           () => ESUCCESS,
                args_sizes_get:     (argc, argv_buf_size) => {
                    const view = self._view32();
                    view.setUint32(argc, 0, true);
                    view.setUint32(argv_buf_size, 0, true);
                    return ESUCCESS;
                },
                environ_get:        () => ESUCCESS,
                environ_sizes_get:  (count_ptr, size_ptr) => {
                    const view = self._view32();
                    view.setUint32(count_ptr, 0, true);
                    view.setUint32(size_ptr, 0, true);
                    return ESUCCESS;
                },

                // ── Clock ────────────────────────────────────────────────────
                clock_res_get: (id, res_ptr) => {
                    const view = self._view64();
                    view.setBigUint64(res_ptr, 1_000_000n, true); // 1 ms resolution
                    return ESUCCESS;
                },
                clock_time_get: (id, precision, time_ptr) => {
                    const view = self._view64();
                    const ns = BigInt(Math.round(performance.now() * 1_000_000));
                    view.setBigUint64(time_ptr, ns, true);
                    return ESUCCESS;
                },

                // ── File descriptors ─────────────────────────────────────────
                fd_advise:   (fd, offset, len, advice)       => ESUCCESS,
                fd_allocate: (fd, offset, len)               => EBADF,
                fd_close:    (fd)                            => ESUCCESS,
                fd_datasync: (fd)                            => ESUCCESS,
                fd_sync:     (fd)                            => ESUCCESS,
                fd_tell:     (fd, offset_ptr)                => EBADF,
                fd_seek:     (fd, offset, whence, pos_ptr)   => EBADF,
                fd_renumber: (fd, to)                        => EBADF,

                fd_fdstat_get: (fd, buf) => {
                    if (fd > 2) return EBADF;
                    const view = new DataView(self._memory.buffer);
                    view.setUint8(buf, FILETYPE_CHARACTER_DEVICE); // fs_filetype
                    view.setUint8(buf + 1, 0);                     // fs_flags
                    view.setBigUint64(buf + 8,  0n, true);         // fs_rights_base
                    view.setBigUint64(buf + 16, 0n, true);         // fs_rights_inheriting
                    return ESUCCESS;
                },
                fd_fdstat_set_flags: (fd, flags) => ESUCCESS,

                fd_filestat_get:     (fd, buf)               => EBADF,
                fd_filestat_set_size:(fd, size)              => EBADF,
                fd_filestat_set_times:(fd,atim,mtim,fflags)  => EBADF,

                // Preopened directories: none.
                fd_prestat_get:      (fd, buf)               => EBADF,
                fd_prestat_dir_name: (fd, path, path_len)    => EBADF,

                // stdin: always return EOF
                fd_read: (fd, iovs_ptr, iovs_len, nread_ptr) => {
                    const view = self._view32();
                    view.setUint32(nread_ptr, 0, true);
                    return ESUCCESS;
                },

                fd_readdir: (fd, buf, buf_len, cookie, bufused_ptr) => EBADF,
                fd_pread:   (fd, iovs, iovs_len, offset, nread)     => EBADF,
                fd_pwrite:  (fd, iovs, iovs_len, offset, nwritten)  => EBADF,

                // ── The important one: write to stdout / stderr ───────────────
                fd_write: (fd, iovs_ptr, iovs_len, nwritten_ptr) => {
                    if (fd !== 1 && fd !== 2) return EBADF;

                    const mem = self._memory.buffer;
                    const view32 = new DataView(mem);
                    let total = 0;

                    for (let i = 0; i < iovs_len; i++) {
                        const base = view32.getUint32(iovs_ptr + i * 8,     true);
                        const len  = view32.getUint32(iovs_ptr + i * 8 + 4, true);
                        if (len === 0) continue;
                        const chunk = new Uint8Array(mem, base, len);
                        const text  = self._decoder.decode(chunk);
                        if (fd === 1) self.stdout += text;
                        else          self.stderr += text;
                        total += len;
                    }

                    new DataView(mem).setUint32(nwritten_ptr, total, true);
                    return ESUCCESS;
                },

                // ── Path operations: no filesystem ───────────────────────────
                path_create_directory:   () => ENOTDIR,
                path_filestat_get:       () => ENOTDIR,
                path_filestat_set_times: () => ENOTDIR,
                path_link:               () => ENOTDIR,
                path_open:               () => ENOTDIR,
                path_readlink:           () => ENOTDIR,
                path_remove_directory:   () => ENOTDIR,
                path_rename:             () => ENOTDIR,
                path_symlink:            () => ENOTDIR,
                path_unlink_file:        () => ENOTDIR,

                // ── Misc ─────────────────────────────────────────────────────
                poll_oneoff: (in_ptr, out_ptr, nsubs, nevents_ptr) => ENOSYS,
                sched_yield: () => ESUCCESS,

                random_get: (buf_ptr, buf_len) => {
                    const bytes = new Uint8Array(self._memory.buffer, buf_ptr, buf_len);
                    crypto.getRandomValues(bytes);
                    return ESUCCESS;
                },

                // ── Process ──────────────────────────────────────────────────
                proc_exit: (code) => { throw new WasiExit(code); },
                proc_raise: (sig) => ENOSYS,

                // ── Sockets: not supported ───────────────────────────────────
                sock_accept:   () => ENOSYS,
                sock_recv:     () => ENOSYS,
                sock_send:     () => ENOSYS,
                sock_shutdown: () => ENOSYS,
            },
        };
    }

    // Internal: DataView over current linear memory (32-bit accessors)
    _view32() { return new DataView(this._memory.buffer); }
    _view64() { return new DataView(this._memory.buffer); }
}

/**
 * Compile and run a wasm32-wasip1 binary, returning its captured output.
 *
 * @param {BufferSource} wasmBytes  Raw `.wasm` bytes
 * @param {number} [timeoutMs=10000] Wall-clock execution limit in ms
 * @returns {Promise<{stdout: string, stderr: string, exitCode: number}>}
 */
export async function runWasm(wasmBytes, timeoutMs = 10_000) {
    const wasi = new WasiCapture();
    const module = await WebAssembly.compile(wasmBytes);
    const instance = await WebAssembly.instantiate(module, wasi.buildImports());

    // The memory export must exist for any non-trivial Rust binary.
    const memory = instance.exports.memory;
    if (!(memory instanceof WebAssembly.Memory)) {
        throw new Error('wasm module does not export a memory object');
    }
    wasi.attachMemory(memory);

    const _start = instance.exports._start;
    if (typeof _start !== 'function') {
        throw new Error('wasm module does not export `_start`');
    }

    let exitCode = 0;

    // Run with a wall-clock timeout so a tight loop can't hang the tab.
    await Promise.race([
        (async () => {
            try {
                _start();
            } catch (e) {
                if (e instanceof WasiExit) {
                    exitCode = e.exitCode;
                } else {
                    throw e;
                }
            }
        })(),
        new Promise((_, reject) =>
            setTimeout(() => reject(new Error('wasm execution timed out')), timeoutMs)
        ),
    ]);

    return { stdout: wasi.stdout, stderr: wasi.stderr, exitCode };
}
