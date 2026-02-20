import { useAtom } from "jotai";
import { useEffect } from "react";
import { themeAtom, type Theme } from "@/store/atoms";

export function useTheme() {
  const [theme, setTheme] = useAtom(themeAtom);

  useEffect(() => {
    document.documentElement.classList.toggle("dark", theme === "dark");
  }, [theme]);

  const toggleTheme = () => {
    setTheme((prev: Theme) => (prev === "dark" ? "light" : "dark"));
  };

  return { theme, toggleTheme } as const;
}
