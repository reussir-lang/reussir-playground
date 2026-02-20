import type { languages } from "monaco-editor";

export const reussirLanguage: languages.IMonarchLanguage = {
  defaultToken: "",
  ignoreCase: false,

  keywords: [
    "fn",
    "struct",
    "enum",
    "pub",
    "if",
    "else",
    "match",
    "let",
    "return",
    "as",
    "regional",
    "extern",
    "trampoline",
    "for",
    "in",
    "mod",
    "use",
    "type",
    "impl",
    "trait",
    "where",
  ],

  typeKeywords: [
    "bool",
    "str",
    "unit",
    "u8",
    "u16",
    "u32",
    "u64",
    "i8",
    "i16",
    "i32",
    "i64",
    "f8",
    "f16",
    "bf16",
    "f32",
    "f64",
  ],

  supportTypes: ["Rc", "Nullable"],
  builtinConstants: ["true", "false"],

  operators: [
    "->",
    "=>",
    ":=",
    "::",
    "..",
    "==",
    "!=",
    "<=",
    ">=",
    "&&",
    "||",
    "+",
    "-",
    "*",
    "/",
    "%",
    "=",
    "<",
    ">",
    "!",
  ],

  symbols: /[=><!~?:&|+\-*/^%]+/,

  tokenizer: {
    root: [
      // Capability annotations: [shared], [value], etc.
      [
        /\[\s*(shared|value|flex|rigid|field|regional)\s*\]/,
        "annotation",
      ],

      // Identifiers and keywords
      [
        /[a-zA-Z_]\w*/,
        {
          cases: {
            "@keywords": "keyword",
            "@typeKeywords": "type",
            "@supportTypes": "type",
            "@builtinConstants": "constant",
            "@default": {
              token: "@rematch",
              next: "@checkTypeName",
            },
          },
        },
      ],

      { include: "@whitespace" },

      // Numbers
      [/0x[0-9a-fA-F_]+/, "number.hex"],
      [/0b[01_]+/, "number.binary"],
      [/[0-9][0-9_]*(?:\.[0-9_]+)?(?:[eE][+-]?[0-9_]+)?/, "number"],

      // Strings
      [/"/, { token: "string.quote", next: "@string" }],

      // Operators
      [
        /@symbols/,
        {
          cases: {
            "@operators": "operator",
            "@default": "",
          },
        },
      ],

      // Delimiters and punctuation
      [/[{}()\[\]]/, "@brackets"],
      [/[;,.]/, "delimiter"],
    ],

    checkTypeName: [
      [
        /[A-Z]\w*/,
        { token: "type", next: "@pop" },
      ],
      [
        /[a-z_]\w*/,
        { token: "identifier", next: "@pop" },
      ],
    ],

    string: [
      [/[^\\"]+/, "string"],
      [/\\./, "string.escape"],
      [/"/, { token: "string.quote", next: "@pop" }],
    ],

    whitespace: [
      [/[ \t\r\n]+/, "white"],
      [/\/\*/, "comment", "@comment"],
      [/\/\/.*$/, "comment"],
    ],

    comment: [
      [/[^/*]+/, "comment"],
      [/\/\*/, "comment", "@push"], // nested block comments
      [/\*\//, "comment", "@pop"],
      [/[/*]/, "comment"],
    ],
  },
};

export const reussirLanguageConfig: languages.LanguageConfiguration = {
  comments: {
    lineComment: "//",
    blockComment: ["/*", "*/"],
  },
  brackets: [
    ["{", "}"],
    ["[", "]"],
    ["(", ")"],
  ],
  autoClosingPairs: [
    { open: "{", close: "}" },
    { open: "[", close: "]" },
    { open: "(", close: ")" },
    { open: '"', close: '"', notIn: ["string"] },
  ],
  surroundingPairs: [
    { open: "{", close: "}" },
    { open: "[", close: "]" },
    { open: "(", close: ")" },
    { open: '"', close: '"' },
  ],
};
