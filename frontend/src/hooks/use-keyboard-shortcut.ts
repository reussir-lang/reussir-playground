import { useEffect } from "react";

export function useKeyboardShortcut(
  key: string,
  modifier: "ctrl" | "meta" | "ctrlOrMeta",
  callback: () => void,
) {
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      const match =
        modifier === "ctrl"
          ? e.ctrlKey
          : modifier === "meta"
            ? e.metaKey
            : e.ctrlKey || e.metaKey;

      if (match && e.key === key) {
        e.preventDefault();
        callback();
      }
    };
    document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  }, [key, modifier, callback]);
}
