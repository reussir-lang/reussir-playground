import { examples } from './examples.js';
import { runWasm } from './wasi.js';
import { createReussirEditor, createDriverEditor } from './editor.js';

// ---------------------------------------------------------------------------
// CodeMirror editor instances
// ---------------------------------------------------------------------------

const sourceView = createReussirEditor(
    document.getElementById('reussir-editor'),
    examples[0].source,
);

const driverView = createDriverEditor(
    document.getElementById('driver-editor'),
    examples[0].driver,
);

/** Read the current document text from a CM6 EditorView. */
const getText = (view) => view.state.doc.toString();

/** Replace the entire document text in a CM6 EditorView. */
function setText(view, text) {
    view.dispatch({
        changes: { from: 0, to: view.state.doc.length, insert: text },
    });
}

// ---------------------------------------------------------------------------
// Toolbar DOM references
// ---------------------------------------------------------------------------

const exampleSelect = document.getElementById('example-select');
const modeSelect    = document.getElementById('mode-select');
const optSelect     = document.getElementById('opt-select');
const runBtn        = document.getElementById('run-btn');
const output        = document.getElementById('output');
const outputLabel   = document.getElementById('output-label');

// ---------------------------------------------------------------------------
// Resizable dividers
// ---------------------------------------------------------------------------

const main        = document.querySelector('.main');
const editorPane  = document.getElementById('editor-pane');
const outputPane  = document.getElementById('output-pane');
const sideDivider = document.getElementById('side-divider');
const editorDivider = document.getElementById('editor-divider');
const sourcePanel = document.getElementById('source-panel');
const driverPanel = document.getElementById('driver-panel');

const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));

function installDividerHandlers() {
    if (!sideDivider || !editorDivider) return;

    sideDivider.addEventListener('mousedown', (e) => {
        if (e.button !== 0) return;
        e.preventDefault();
        const startX = e.clientX;
        const startW = editorPane.getBoundingClientRect().width;
        const move = (ev) => {
            const divW = sideDivider.offsetWidth;
            const total = main.clientWidth;
            const next = clamp(startW + (ev.clientX - startX), 220, total - divW - 220);
            editorPane.style.flex = '0 0 auto';
            editorPane.style.flexBasis = `${next}px`;
            outputPane.style.flex = '1 1 auto';
        };
        const up = () => {
            document.body.classList.remove('resizing-horizontal');
            document.removeEventListener('mousemove', move);
            document.removeEventListener('mouseup', up);
        };
        document.body.classList.add('resizing-horizontal');
        document.addEventListener('mousemove', move);
        document.addEventListener('mouseup', up);
    });

    editorDivider.addEventListener('mousedown', (e) => {
        if (e.button !== 0) return;
        e.preventDefault();
        const startY = e.clientY;
        const startH = sourcePanel.getBoundingClientRect().height;
        const move = (ev) => {
            const divH = editorDivider.offsetHeight;
            const total = editorPane.clientHeight;
            const next = clamp(startH + (ev.clientY - startY), 100, total - divH - 100);
            sourcePanel.style.flex = '0 0 auto';
            sourcePanel.style.flexBasis = `${next}px`;
            driverPanel.style.flex = '1 1 auto';
        };
        const up = () => {
            document.body.classList.remove('resizing-vertical');
            document.removeEventListener('mousemove', move);
            document.removeEventListener('mouseup', up);
        };
        document.body.classList.add('resizing-vertical');
        document.addEventListener('mousemove', move);
        document.addEventListener('mouseup', up);
    });
}

// ---------------------------------------------------------------------------
// Example selector
// ---------------------------------------------------------------------------

examples.forEach((ex, i) => {
    const opt = document.createElement('option');
    opt.value = i;
    opt.textContent = ex.name;
    exampleSelect.appendChild(opt);
});

exampleSelect.addEventListener('change', () => {
    const ex = examples[exampleSelect.value];
    setText(sourceView, ex.source);
    setText(driverView, ex.driver);
    output.textContent = 'Select a mode and click Run to compile.';
    output.className = '';
});

modeSelect.addEventListener('change', () => {
    runBtn.textContent = modeSelect.value === 'run' ? '\u25B6 Run' : '\u25B6 Compile';
});

runBtn.addEventListener('click', compile);

document.addEventListener('keydown', (e) => {
    if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
        e.preventDefault();
        compile();
    }
});

// ---------------------------------------------------------------------------
// Compile / run
// ---------------------------------------------------------------------------

const MODE_LABELS = { run: 'Output', 'llvm-ir': 'LLVM IR', asm: 'WebAssembly', mlir: 'MLIR' };

async function compile() {
    const source = getText(sourceView);
    const driver = getText(driverView);
    const mode   = modeSelect.value;
    const opt    = optSelect.value;

    output.textContent = mode === 'run' ? 'Compiling to wasm\u2026' : 'Compiling\u2026';
    output.className = 'loading';
    runBtn.disabled = true;
    outputLabel.textContent = MODE_LABELS[mode] ?? 'Output';

    try {
        const resp = await fetch('/api/compile', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ source, driver, mode, opt }),
        });

        if (!resp.ok) throw new Error(`server error ${resp.status}: ${resp.statusText}`);

        const data = await resp.json();

        if (!data.success) {
            output.textContent = data.error ?? 'Unknown compilation error.';
            output.className = 'error';
            return;
        }

        if (data.output !== undefined) {
            output.textContent = data.output || '(empty output)';
            output.className = '';
            return;
        }

        if (data.wasm !== undefined) {
            output.textContent = 'Running in browser\u2026';
            const wasmBytes = b64ToBytes(data.wasm);
            let result;
            try {
                result = await runWasm(wasmBytes);
            } catch (e) {
                output.textContent = `WASI error: ${e.message}`;
                output.className = 'error';
                return;
            }
            let text = result.stdout;
            if (result.stderr) {
                if (text) text += '\n';
                text += `--- stderr ---\n${result.stderr}`;
            }
            if (result.exitCode !== 0) {
                if (text) text += '\n';
                text += `\nProcess exited with code ${result.exitCode}.`;
            }
            output.textContent = text || '(no output)';
            output.className = result.exitCode !== 0 ? 'error' : '';
            return;
        }

        output.textContent = 'Unexpected response from server.';
        output.className = 'error';

    } catch (e) {
        output.textContent = `Request failed: ${e.message}`;
        output.className = 'error';
    } finally {
        runBtn.disabled = false;
    }
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function b64ToBytes(b64) {
    const binary = atob(b64);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
    return bytes;
}

// ---------------------------------------------------------------------------

installDividerHandlers();
