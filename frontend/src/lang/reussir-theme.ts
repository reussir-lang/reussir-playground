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

export const reussirLightTheme: editor.IStandaloneThemeData = {
  base: "vs",
  inherit: true,
  rules: [
    { token: "keyword", foreground: "AF00DB" },
    { token: "type", foreground: "267F99" },
    { token: "constant", foreground: "0000FF" },
    { token: "string", foreground: "A31515" },
    { token: "string.quote", foreground: "A31515" },
    { token: "string.escape", foreground: "EE0000" },
    { token: "number", foreground: "098658" },
    { token: "number.hex", foreground: "098658" },
    { token: "number.binary", foreground: "098658" },
    { token: "comment", foreground: "008000" },
    { token: "operator", foreground: "333333" },
    { token: "annotation", foreground: "795E26" },
    { token: "identifier", foreground: "001080" },
    { token: "delimiter", foreground: "333333" },
  ],
  colors: {
    "editor.background": "#ffffff",
    "editor.foreground": "#333333",
  },
};
