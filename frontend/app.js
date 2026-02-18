import { examples } from './examples.js';
import { runWasm } from './wasi.js';

const sourceEditor = document.getElementById('reussir-editor');
const driverEditor = document.getElementById('driver-editor');
const exampleSelect = document.getElementById('example-select');
const modeSelect = document.getElementById('mode-select');
const runBtn = document.getElementById('run-btn');
const output = document.getElementById('output');
const outputLabel = document.getElementById('output-label');

const main = document.querySelector('.main');
const editorPane = document.getElementById('editor-pane');
const outputPane = document.getElementById('output-pane');
const sideDivider = document.getElementById('side-divider');
const editorDivider = document.getElementById('editor-divider');
const sourcePanel = document.getElementById('source-panel');
const driverPanel = document.getElementById('driver-panel');

const clamp = (value, min, max) => Math.max(min, Math.min(max, value));

const installDividerHandlers = () => {
    if (!sideDivider || !editorDivider) return;

    const initSideDrag = (startX, startWidth, minLeftWidth, minRightWidth) => {
        const dividerWidth = sideDivider.offsetWidth;
        const totalWidth = main.clientWidth;
        const maxLeftWidth = totalWidth - dividerWidth - minRightWidth;
        const applyWidth = (width) => {
            const nextWidth = clamp(width, minLeftWidth, maxLeftWidth);
            editorPane.style.flex = '0 0 auto';
            editorPane.style.flexBasis = `${nextWidth}px`;
            outputPane.style.flex = '1 1 auto';
            return nextWidth;
        };

        applyWidth(startWidth);

        const onMouseMove = (e) => { applyWidth(startWidth + (e.clientX - startX)); };
        const stop = () => {
            document.body.classList.remove('resizing-horizontal');
            document.removeEventListener('mousemove', onMouseMove);
            document.removeEventListener('mouseup', stop);
        };
        document.body.classList.add('resizing-horizontal');
        document.addEventListener('mousemove', onMouseMove);
        document.addEventListener('mouseup', stop);
    };

    const initEditorDrag = (startY, startHeight, minSourceHeight, minDriverHeight) => {
        const dividerHeight = editorDivider.offsetHeight;
        const totalHeight = editorPane.clientHeight;
        const maxSourceHeight = totalHeight - dividerHeight - minDriverHeight;
        const applyHeight = (height) => {
            const nextHeight = clamp(height, minSourceHeight, maxSourceHeight);
            sourcePanel.style.flex = '0 0 auto';
            sourcePanel.style.flexBasis = `${nextHeight}px`;
            driverPanel.style.flex = '1 1 auto';
            return nextHeight;
        };

        applyHeight(startHeight);

        const onMouseMove = (e) => { applyHeight(startHeight + (e.clientY - startY)); };
        const stop = () => {
            document.body.classList.remove('resizing-vertical');
            document.removeEventListener('mousemove', onMouseMove);
            document.removeEventListener('mouseup', stop);
        };
        document.body.classList.add('resizing-vertical');
        document.addEventListener('mousemove', onMouseMove);
        document.addEventListener('mouseup', stop);
    };

    sideDivider.addEventListener('mousedown', (event) => {
        if (event.button !== 0) return;
        event.preventDefault();
        initSideDrag(event.clientX, editorPane.getBoundingClientRect().width, 220, 220);
    });

    editorDivider.addEventListener('mousedown', (event) => {
        if (event.button !== 0) return;
        event.preventDefault();
        initEditorDrag(event.clientY, sourcePanel.getBoundingClientRect().height, 100, 100);
    });
};

// ---------------------------------------------------------------------------
// Example selector
// ---------------------------------------------------------------------------

examples.forEach((ex, i) => {
    const opt = document.createElement('option');
    opt.value = i;
    opt.textContent = ex.name;
    exampleSelect.appendChild(opt);
});

sourceEditor.value = examples[0].source;
driverEditor.value = examples[0].driver;

exampleSelect.addEventListener('change', () => {
    const ex = examples[exampleSelect.value];
    sourceEditor.value = ex.source;
    driverEditor.value = ex.driver;
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

const MODE_LABELS = { run: 'Output', 'llvm-ir': 'LLVM IR', asm: 'Assembly', mlir: 'MLIR' };

async function compile() {
    const source = sourceEditor.value;
    const driver = driverEditor.value;
    const mode = modeSelect.value;

    output.textContent = mode === 'run' ? 'Compiling to wasm\u2026' : 'Compiling\u2026';
    output.className = 'loading';
    runBtn.disabled = true;
    outputLabel.textContent = MODE_LABELS[mode] ?? 'Output';

    try {
        const resp = await fetch('/api/compile', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ source, driver, mode }),
        });

        if (!resp.ok) {
            throw new Error(`server error ${resp.status}: ${resp.statusText}`);
        }

        const data = await resp.json();

        if (!data.success) {
            output.textContent = data.error ?? 'Unknown compilation error.';
            output.className = 'error';
            return;
        }

        // Text modes — display the returned text directly.
        if (data.output !== undefined) {
            output.textContent = data.output || '(empty output)';
            output.className = '';
            return;
        }

        // Run mode — server compiled to wasm, now we execute it in the browser.
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

        // Should not happen.
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

/**
 * Decode a base64 string to a Uint8Array without a dependency on atob.
 * @param {string} b64
 * @returns {Uint8Array}
 */
function b64ToBytes(b64) {
    const binary = atob(b64);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
    return bytes;
}

// ---------------------------------------------------------------------------

installDividerHandlers();
