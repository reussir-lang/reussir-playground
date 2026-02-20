import type { languages } from "monaco-editor";

export const llvmIrLanguage: languages.IMonarchLanguage = {
  defaultToken: "",
  keywords: [
    "define", "declare", "global", "constant", "internal", "external",
    "private", "linkonce", "weak", "appending", "common", "available_externally",
    "unnamed_addr", "local_unnamed_addr", "align", "to", "nuw", "nsw",
    "ret", "br", "switch", "invoke", "resume", "unreachable", "indirectbr",
    "add", "sub", "mul", "udiv", "sdiv", "urem", "srem",
    "fadd", "fsub", "fmul", "fdiv", "frem",
    "and", "or", "xor", "shl", "lshr", "ashr",
    "icmp", "fcmp", "select", "call", "tail", "musttail",
    "alloca", "load", "store", "getelementptr", "extractvalue", "insertvalue",
    "trunc", "zext", "sext", "fptrunc", "fpext", "fptoui", "fptosi",
    "uitofp", "sitofp", "ptrtoint", "inttoptr", "bitcast", "addrspacecast",
    "phi", "landingpad", "freeze",
    "eq", "ne", "ugt", "uge", "ult", "ule", "sgt", "sge", "slt", "sle",
    "oeq", "ogt", "oge", "olt", "ole", "one", "ord", "ueq", "une", "uno",
    "nonnull", "dereferenceable", "inbounds", "exact", "volatile",
    "target", "datalayout", "triple", "source_filename",
    "attributes", "metadata", "module", "comdat",
  ],
  typeKeywords: [
    "void", "i1", "i8", "i16", "i32", "i64", "i128",
    "half", "bfloat", "float", "double", "fp128", "x86_fp80", "ppc_fp128",
    "ptr", "label", "token", "metadata", "opaque",
  ],
  tokenizer: {
    root: [
      [/;.*$/, "comment"],
      [/[!@#%][-\w$.]+/, "variable"],
      [/\b(?:true|false|null|undef|zeroinitializer|poison)\b/, "constant"],
      [/\b\d[\d.]*(?:e[+-]?\d+)?\b/, "number"],
      [/0x[0-9a-fA-F]+/, "number.hex"],
      [/"[^"]*"/, "string"],
      [/\b(?:define|declare)\b/, "keyword.definition"],
      [/[a-zA-Z_]\w*/, {
        cases: {
          "@typeKeywords": "type",
          "@keywords": "keyword",
          "@default": "identifier",
        },
      }],
      [/[{}()\[\],=*]/, "delimiter"],
    ],
  },
};

export const watLanguage: languages.IMonarchLanguage = {
  defaultToken: "",
  keywords: [
    "module", "type", "func", "param", "result", "local", "global",
    "table", "memory", "elem", "data", "start", "import", "export",
    "block", "loop", "if", "then", "else", "end", "br", "br_if", "br_table",
    "return", "call", "call_indirect", "drop", "select", "unreachable", "nop",
    "mut", "offset", "align",
  ],
  typeKeywords: ["i32", "i64", "f32", "f64", "v128", "funcref", "externref"],
  tokenizer: {
    root: [
      [/;;.*$/, "comment"],
      [/\(;/, "comment", "@blockComment"],
      [/\$[-\w!#$%&'*+./:<=>?@\\^`|~]+/, "variable"],
      [/"(?:[^"\\]|\\.)*"/, "string"],
      [/\b\d[\d.]*(?:e[+-]?\d+)?\b/, "number"],
      [/0x[0-9a-fA-F]+/, "number.hex"],
      [/\b(?:i32|i64|f32|f64)\.[a-z_]+\b/, "keyword"],
      [/\b(?:memory|local|global)\.[a-z_]+\b/, "keyword"],
      [/[a-zA-Z_]\w*/, {
        cases: {
          "@typeKeywords": "type",
          "@keywords": "keyword",
          "@default": "identifier",
        },
      }],
      [/[()=]/, "delimiter"],
    ],
    blockComment: [
      [/[^(;]+/, "comment"],
      [/;\)/, "comment", "@pop"],
      [/[;(]/, "comment"],
    ],
  },
};

export const mlirLanguage: languages.IMonarchLanguage = {
  defaultToken: "",
  keywords: [
    "func", "return", "br", "cond_br", "call", "module", "builtin",
    "arith", "cf", "memref", "tensor", "vector", "scf", "affine",
    "linalg", "gpu", "llvm", "index",
    "for", "if", "else", "yield", "iter_args",
  ],
  typeKeywords: [
    "i1", "i8", "i16", "i32", "i64", "i128",
    "f16", "f32", "f64", "bf16",
    "index", "none", "memref", "tensor", "vector", "complex", "tuple",
  ],
  tokenizer: {
    root: [
      [/\/\/.*$/, "comment"],
      [/[%#@!][-\w$.#]+/, "variable"],
      [/\^[-\w$.]+/, "variable"],
      [/"[^"]*"/, "string"],
      [/\b\d[\d.]*(?:e[+-]?\d+)?\b/, "number"],
      [/0x[0-9a-fA-F]+/, "number.hex"],
      [/\b(?:true|false)\b/, "constant"],
      [/[a-zA-Z_][\w.]*/, {
        cases: {
          "@typeKeywords": "type",
          "@keywords": "keyword",
          "@default": "identifier",
        },
      }],
      [/[{}()\[\]<>,=:->]/, "delimiter"],
    ],
  },
};
