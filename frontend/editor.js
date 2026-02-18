/**
 * CodeMirror 6 editor factories for the Reussir playground.
 *
 * Reussir highlighting is implemented as a CM6 StreamLanguage whose token
 * rules are derived from the authoritative TextMate grammar at
 * frontend/syntaxes/reussir.tmLanguage.json (which is also the grammar used
 * by the VS Code extension).  The scope names map to CM6 highlight tags so
 * that the oneDark theme colours them correctly.
 *
 * The Rust driver editor uses the first-class @codemirror/lang-rust parser.
 */

import { basicSetup } from 'https://esm.sh/@codemirror/basic-setup@6';
import { EditorView } from 'https://esm.sh/@codemirror/view@6';
import { EditorState } from 'https://esm.sh/@codemirror/state@6';
import { StreamLanguage } from 'https://esm.sh/@codemirror/language@6';
import { rust } from 'https://esm.sh/@codemirror/lang-rust@6';
import { oneDark } from 'https://esm.sh/@codemirror/theme-one-dark@6';

// ---------------------------------------------------------------------------
// Token sets — kept in sync with reussir.tmLanguage.json
// ---------------------------------------------------------------------------

// keyword.declaration.reussir  +  keyword.control.reussir
const KEYWORDS = new Set([
    // declaration
    'fn', 'struct', 'enum', 'pub',
    // control
    'if', 'else', 'match', 'let', 'return', 'as', 'regional',
    // FFI
    'extern', 'trampoline',
    // module
    'for', 'in', 'mod', 'use', 'type', 'impl', 'trait', 'where',
]);

// storage.type.primitive.reussir  (from TM grammar `types` repository entry)
const PRIMITIVE_TYPES = new Set([
    'bool', 'str', 'unit',
    'u8', 'u16', 'u32', 'u64',
    'i8', 'i16', 'i32', 'i64',
    'f8', 'f16', 'bf16', 'f32', 'f64',
]);

// support.type.reussir
const SUPPORT_TYPES = new Set(['Rc', 'Nullable']);

// constant.language.boolean.reussir
const BUILTINS = new Set(['true', 'false']);

// storage.modifier.capability.reussir — from TM grammar `capabilities` entry
const CAPABILITY_RE = /^\[\s*(shared|value|flex|rigid|field|regional)\s*\]/;

// ---------------------------------------------------------------------------
// Reussir StreamLanguage
// ---------------------------------------------------------------------------

const reussirLanguage = StreamLanguage.define({
    name: 'reussir',

    startState() {
        return { blockDepth: 0 };
    },

    token(stream, state) {
        // ── Inside a block comment ──────────────────────────────────────────
        if (state.blockDepth > 0) {
            while (!stream.eol()) {
                if (stream.match('/*'))       { state.blockDepth++; }
                else if (stream.match('*/')) {
                    state.blockDepth--;
                    if (state.blockDepth === 0) return 'comment';
                } else {
                    stream.next();
                }
            }
            return 'comment';
        }

        // ── Whitespace ─────────────────────────────────────────────────────
        if (stream.eatSpace()) return null;

        // ── Line comment  //…  ──────────────────────────────────────────────
        if (stream.match('//')) { stream.skipToEnd(); return 'lineComment'; }

        // ── Block comment  /* … */  ─────────────────────────────────────────
        if (stream.match('/*')) {
            state.blockDepth = 1;
            while (!stream.eol()) {
                if (stream.match('/*'))       { state.blockDepth++; }
                else if (stream.match('*/')) {
                    state.blockDepth--;
                    if (state.blockDepth === 0) return 'comment';
                } else {
                    stream.next();
                }
            }
            return 'comment';
        }

        // ── String literal ─────────────────────────────────────────────────
        if (stream.match('"')) {
            while (!stream.eol()) {
                const ch = stream.next();
                if (ch === '\\') { stream.next(); continue; }
                if (ch === '"')  break;
            }
            return 'string';
        }

        // ── Numbers ────────────────────────────────────────────────────────
        // constant.numeric.float  /  constant.numeric.integer
        if (stream.match(/^0x[0-9a-fA-F_]+/) ||
            stream.match(/^0b[01_]+/)          ||
            stream.match(/^[0-9][0-9_]*(?:\.[0-9_]+)?(?:[eE][+-]?[0-9_]+)?/)) {
            return 'number';
        }

        // ── Capability annotations  [shared], [value], [flex], …  ──────────
        // storage.modifier.capability.reussir
        if (stream.match(CAPABILITY_RE)) return 'attributeName';

        // ── Identifiers, keywords, types ───────────────────────────────────
        if (stream.match(/^[a-zA-Z_]\w*/)) {
            const word = stream.current();
            if (KEYWORDS.has(word))       return 'keyword';
            if (PRIMITIVE_TYPES.has(word)) return 'typeName';
            if (SUPPORT_TYPES.has(word))   return 'typeName';
            if (BUILTINS.has(word))        return 'atom';
            // entity.name.type.reussir — uppercase-initial
            if (word.charCodeAt(0) >= 65 && word.charCodeAt(0) <= 90) return 'typeName';
            return 'variableName';
        }

        // ── Operators ──────────────────────────────────────────────────────
        // Two-character operators first to avoid partial matches
        if (stream.match('->') || stream.match('=>')) return 'operator';
        if (stream.match(':='))                        return 'operator';
        if (stream.match('::'))                        return 'operator';
        if (stream.match('..'))                        return 'operator';
        if (stream.match('==') || stream.match('!=') ||
            stream.match('<=') || stream.match('>=')) return 'operator';
        if (stream.match('&&') || stream.match('||')) return 'operator';

        // Single-character operator / punctuation — advance one char
        stream.next();
        return null;
    },
});

// ---------------------------------------------------------------------------
// Editor factories
// ---------------------------------------------------------------------------

/** Create a Reussir source editor mounted inside `parent`. */
export function createReussirEditor(parent, initialDoc) {
    return new EditorView({
        state: EditorState.create({
            doc: initialDoc,
            extensions: [basicSetup, reussirLanguage, oneDark],
        }),
        parent,
    });
}

/** Create a Rust driver editor mounted inside `parent`. */
export function createDriverEditor(parent, initialDoc) {
    return new EditorView({
        state: EditorState.create({
            doc: initialDoc,
            extensions: [basicSetup, rust(), oneDark],
        }),
        parent,
    });
}
