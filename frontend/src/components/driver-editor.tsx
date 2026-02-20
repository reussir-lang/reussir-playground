import { useRef, useCallback } from "react";
import Editor, { type Monaco, type OnMount } from "@monaco-editor/react";
import { useAtom, useAtomValue } from "jotai";
import { driverCodeAtom, themeAtom } from "@/store/atoms";
import { reussirDarkTheme, reussirLightTheme } from "@/lang/reussir-theme";
import type { editor } from "monaco-editor";

let themeRegistered = false;

function ensureTheme(monaco: Monaco) {
  if (themeRegistered) return;
  themeRegistered = true;
  monaco.editor.defineTheme("reussir-dark", reussirDarkTheme);
  monaco.editor.defineTheme("reussir-light", reussirLightTheme);
}

export function DriverEditor() {
  const [driverCode, setDriverCode] = useAtom(driverCodeAtom);
  const theme = useAtomValue(themeAtom);
  const editorRef = useRef<editor.IStandaloneCodeEditor | null>(null);

  const handleBeforeMount = useCallback((monaco: Monaco) => {
    ensureTheme(monaco);
  }, []);

  const handleMount: OnMount = useCallback((ed) => {
    editorRef.current = ed;
  }, []);

  const handleChange = useCallback(
    (value: string | undefined) => {
      if (value !== undefined) {
        setDriverCode(value);
      }
    },
    [setDriverCode],
  );

  return (
    <Editor
      language="rust"
      theme={theme === "dark" ? "reussir-dark" : "reussir-light"}
      value={driverCode}
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
