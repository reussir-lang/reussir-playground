import { useRef, useCallback } from "react";
import Editor, { type Monaco, type OnMount } from "@monaco-editor/react";
import { useAtom, useAtomValue } from "jotai";
import { sourceCodeAtom, themeAtom } from "@/store/atoms";
import {
  reussirLanguage,
  reussirLanguageConfig,
} from "@/lang/reussir-monarch";
import { reussirDarkTheme, reussirLightTheme } from "@/lang/reussir-theme";
import type { editor } from "monaco-editor";

let languageRegistered = false;

function registerReussirLanguage(monaco: Monaco) {
  if (languageRegistered) return;
  languageRegistered = true;

  monaco.languages.register({ id: "reussir" });
  monaco.languages.setMonarchTokensProvider("reussir", reussirLanguage);
  monaco.languages.setLanguageConfiguration("reussir", reussirLanguageConfig);
  monaco.editor.defineTheme("reussir-dark", reussirDarkTheme);
  monaco.editor.defineTheme("reussir-light", reussirLightTheme);
}

export function SourceEditor() {
  const [sourceCode, setSourceCode] = useAtom(sourceCodeAtom);
  const theme = useAtomValue(themeAtom);
  const editorRef = useRef<editor.IStandaloneCodeEditor | null>(null);

  const handleBeforeMount = useCallback((monaco: Monaco) => {
    registerReussirLanguage(monaco);
  }, []);

  const handleMount: OnMount = useCallback((ed) => {
    editorRef.current = ed;
  }, []);

  const handleChange = useCallback(
    (value: string | undefined) => {
      if (value !== undefined) {
        setSourceCode(value);
      }
    },
    [setSourceCode],
  );

  return (
    <Editor
      language="reussir"
      theme={theme === "dark" ? "reussir-dark" : "reussir-light"}
      value={sourceCode}
      beforeMount={handleBeforeMount}
      onMount={handleMount}
      onChange={handleChange}
      options={{
        fontSize: 13,
        fontFamily:
          "'Fira Code', 'Cascadia Code', 'Consolas', 'Monaco', monospace",
        lineHeight: 20,
        minimap: { enabled: false },
        scrollBeyondLastLine: false,
        automaticLayout: true,
        padding: { top: 8 },
      }}
    />
  );
}
