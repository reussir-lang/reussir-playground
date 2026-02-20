import type { editor } from "monaco-editor";

export const reussirDarkTheme: editor.IStandaloneThemeData = {
  base: "vs-dark",
  inherit: true,
  rules: [
    { token: "keyword", foreground: "C586C0" },
    { token: "type", foreground: "4EC9B0" },
    { token: "constant", foreground: "569CD6" },
    { token: "string", foreground: "CE9178" },
    { token: "string.quote", foreground: "CE9178" },
    { token: "string.escape", foreground: "D7BA7D" },
    { token: "number", foreground: "B5CEA8" },
    { token: "number.hex", foreground: "B5CEA8" },
    { token: "number.binary", foreground: "B5CEA8" },
    { token: "comment", foreground: "6A9955" },
    { token: "operator", foreground: "D4D4D4" },
    { token: "annotation", foreground: "DCDCAA" },
    { token: "identifier", foreground: "9CDCFE" },
    { token: "delimiter", foreground: "D4D4D4" },
  ],
  colors: {
    "editor.background": "#1e1e1e",
    "editor.foreground": "#d4d4d4",
  },
};
