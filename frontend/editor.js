import { EditorView, basicSetup } from 'https://esm.sh/codemirror@6';
import { EditorState } from 'https://esm.sh/@codemirror/state@6';
import { StreamLanguage } from 'https://esm.sh/@codemirror/language@6';
import { rust } from 'https://esm.sh/@codemirror/lang-rust@6';
import { oneDark } from 'https://esm.sh/@codemirror/theme-one-dark@6';

const reussirKeywords = new Set([
    'fn', 'pub', 'struct', 'enum', 'if', 'else', 'match', 'let',
    'return', 'as', 'extern', 'trampoline', 'for', 'in', 'mod',
    'use', 'type', 'impl', 'trait', 'where', 'regional',
]);

const reussirTypes = new Set([
    'bool', 'u8', 'u16', 'u32', 'u64', 'i8', 'i16', 'i32', 'i64',
    'f16', 'f32', 'f64', 'str', 'unit', 'Rc', 'Nullable',
]);

const reussirBuiltins = new Set(['true', 'false']);

const reussirLanguage = StreamLanguage.define({
    startState() {
        return { inBlockComment: 0 };
    },
    token(stream, state) {
        // Block comment
        if (state.inBlockComment > 0) {
            while (!stream.eol()) {
                if (stream.match('/*')) {
                    state.inBlockComment++;
                } else if (stream.match('*/')) {
                    state.inBlockComment--;
                    if (state.inBlockComment === 0) return 'comment';
                } else {
                    stream.next();
                }
            }
            return 'comment';
        }

        // Whitespace
        if (stream.eatSpace()) return null;

        // Line comment
        if (stream.match('//')) {
            stream.skipToEnd();
            return 'lineComment';
        }

        // Block comment start
        if (stream.match('/*')) {
            state.inBlockComment = 1;
            while (!stream.eol()) {
                if (stream.match('/*')) {
                    state.inBlockComment++;
                } else if (stream.match('*/')) {
                    state.inBlockComment--;
                    if (state.inBlockComment === 0) return 'comment';
                } else {
                    stream.next();
                }
            }
            return 'comment';
        }

        // String
        if (stream.match('"')) {
            while (!stream.eol()) {
                const ch = stream.next();
                if (ch === '\\') stream.next();
                else if (ch === '"') break;
            }
            return 'string';
        }

        // Number
        if (stream.match(/^0x[0-9a-fA-F_]+/) ||
            stream.match(/^0b[01_]+/) ||
            stream.match(/^[0-9][0-9_]*(\.[0-9_]+)?([eE][+-]?[0-9_]+)?/)) {
            return 'number';
        }

        // Capability annotation [value], [shared], etc.
        if (stream.match(/^\[(?:value|shared|regional)\]/)) {
            return 'attributeName';
        }

        // Identifier or keyword
        if (stream.match(/^[a-zA-Z_]\w*/)) {
            const word = stream.current();
            if (reussirKeywords.has(word)) return 'keyword';
            if (reussirTypes.has(word)) return 'typeName';
            if (reussirBuiltins.has(word)) return 'atom';
            // Type names start with uppercase
            if (word[0] >= 'A' && word[0] <= 'Z') return 'typeName';
            return 'variableName';
        }

        // Operators and punctuation
        stream.next();
        return null;
    },
});

export function createReussirEditor(parent, initialDoc) {
    return new EditorView({
        state: EditorState.create({
            doc: initialDoc,
            extensions: [basicSetup, reussirLanguage, oneDark],
        }),
        parent,
    });
}

export function createDriverEditor(parent, initialDoc) {
    return new EditorView({
        state: EditorState.create({
            doc: initialDoc,
            extensions: [basicSetup, rust(), oneDark],
        }),
        parent,
    });
}
