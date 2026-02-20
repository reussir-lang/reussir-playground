import { useAtom, useAtomValue, useSetAtom } from "jotai";
import {
  selectedExampleIndexAtom,
  sourceCodeAtom,
  driverCodeAtom,
  modeAtom,
  optLevelAtom,
  isCompilingAtom,
  runButtonTextAtom,
  outputAtom,
  type Mode,
  type OptLevel,
} from "@/store/atoms";
import { examples } from "@/data/examples";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { useCompile } from "@/hooks/use-compile";
import { useTheme } from "@/hooks/use-theme";
import { Sun, Moon } from "lucide-react";

export function Toolbar() {
  const [selectedExample, setSelectedExample] = useAtom(
    selectedExampleIndexAtom,
  );
  const setSourceCode = useSetAtom(sourceCodeAtom);
  const setDriverCode = useSetAtom(driverCodeAtom);
  const [mode, setMode] = useAtom(modeAtom);
  const [optLevel, setOptLevel] = useAtom(optLevelAtom);
  const isCompiling = useAtomValue(isCompilingAtom);
  const buttonText = useAtomValue(runButtonTextAtom);
  const setOutput = useSetAtom(outputAtom);
  const compile = useCompile();
  const { theme, toggleTheme } = useTheme();

  const handleExampleChange = (value: string) => {
    const index = parseInt(value, 10);
    const example = examples[index];
    if (!example) return;
    setSelectedExample(index);
    setSourceCode(example.source);
    setDriverCode(example.driver);
    setOutput({
      kind: "idle",
      text: "Select a mode and click Run to compile.",
    });
  };

  return (
    <div className="flex items-center gap-3 px-4 py-2 bg-bg-secondary border-b border-border shrink-0">
      <span className="text-base font-bold text-text-heading mr-auto whitespace-nowrap flex items-center gap-2">
        <img src="/image.png" alt="Reussir" className="h-5 w-5" />
        Reussir Playground
      </span>

      <Select
        value={String(selectedExample)}
        onValueChange={handleExampleChange}
      >
        <SelectTrigger className="h-8 bg-bg-input border-border-input text-text-primary text-[13px] hover:bg-bg-input-hover">
          <SelectValue placeholder="Load example" />
        </SelectTrigger>
        <SelectContent className="bg-bg-input border-border-input">
          {examples.map((ex, i) => (
            <SelectItem
              key={i}
              value={String(i)}
              className="text-text-primary text-[13px] focus:bg-bg-input-hover focus:text-text-primary"
            >
              {ex.name}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      <Select value={mode} onValueChange={(v) => setMode(v as Mode)}>
        <SelectTrigger className="h-8 bg-bg-input border-border-input text-text-primary text-[13px] hover:bg-bg-input-hover">
          <SelectValue />
        </SelectTrigger>
        <SelectContent className="bg-bg-input border-border-input">
          <SelectItem
            value="run"
            className="text-text-primary text-[13px] focus:bg-bg-input-hover focus:text-text-primary"
          >
            Run
          </SelectItem>
          <SelectItem
            value="llvm-ir"
            className="text-text-primary text-[13px] focus:bg-bg-input-hover focus:text-text-primary"
          >
            LLVM IR
          </SelectItem>
          <SelectItem
            value="asm"
            className="text-text-primary text-[13px] focus:bg-bg-input-hover focus:text-text-primary"
          >
            WebAssembly
          </SelectItem>
          <SelectItem
            value="mlir"
            className="text-text-primary text-[13px] focus:bg-bg-input-hover focus:text-text-primary"
          >
            MLIR
          </SelectItem>
        </SelectContent>
      </Select>

      <Select
        value={optLevel}
        onValueChange={(v) => setOptLevel(v as OptLevel)}
      >
        <SelectTrigger className="h-8 bg-bg-input border-border-input text-text-primary text-[13px] hover:bg-bg-input-hover">
          <SelectValue />
        </SelectTrigger>
        <SelectContent className="bg-bg-input border-border-input">
          <SelectItem
            value="none"
            className="text-text-primary text-[13px] focus:bg-bg-input-hover focus:text-text-primary"
          >
            No optimization
          </SelectItem>
          <SelectItem
            value="default"
            className="text-text-primary text-[13px] focus:bg-bg-input-hover focus:text-text-primary"
          >
            Default
          </SelectItem>
          <SelectItem
            value="size"
            className="text-text-primary text-[13px] focus:bg-bg-input-hover focus:text-text-primary"
          >
            Size
          </SelectItem>
          <SelectItem
            value="aggressive"
            className="text-text-primary text-[13px] focus:bg-bg-input-hover focus:text-text-primary"
          >
            Aggressive
          </SelectItem>
        </SelectContent>
      </Select>

      <Button
        onClick={compile}
        disabled={isCompiling}
        className="h-8 px-3 text-[13px] font-semibold bg-accent border-accent text-white hover:bg-accent-hover disabled:opacity-60 disabled:cursor-not-allowed"
        title="Compile and run (Ctrl+Enter)"
      >
        {buttonText}
      </Button>

      <button
        onClick={toggleTheme}
        className="ml-auto h-8 w-8 inline-flex items-center justify-center rounded text-text-secondary hover:text-text-primary hover:bg-bg-input-hover transition-colors"
        title={theme === "dark" ? "Switch to light mode" : "Switch to dark mode"}
      >
        {theme === "dark" ? <Sun size={16} /> : <Moon size={16} />}
      </button>
    </div>
  );
}
