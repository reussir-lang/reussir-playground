import { useAtom, useAtomValue, useSetAtom } from "jotai";
import { ChevronDown, Moon, Sun } from "lucide-react";
import { DropdownMenu } from "radix-ui";

import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { examples } from "@/data/examples";
import { useCompile } from "@/hooks/use-compile";
import { useTheme } from "@/hooks/use-theme";
import {
  driverCodeAtom,
  isCompilingAtom,
  modeAtom,
  optLevelAtom,
  outputAtom,
  runButtonTextAtom,
  selectedExampleIndexAtom,
  sourceCodeAtom,
  type Mode,
  type OptLevel,
} from "@/store/atoms";

const MODE_OPTIONS: { value: Mode; label: string; description: string }[] = [
  { value: "run", label: "Run", description: "Execute the compiled program" },
  {
    value: "llvm-ir",
    label: "LLVM IR",
    description: "Show LLVM intermediate representation",
  },
  {
    value: "asm",
    label: "WebAssembly",
    description: "Show WebAssembly text format",
  },
  {
    value: "mlir",
    label: "MLIR",
    description: "Show MLIR intermediate representation",
  },
];

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

  const handleModeSelect = (value: Mode) => {
    setMode(value);
    compile();
  };

  return (
    <div className="flex items-center gap-3 px-4 py-2 bg-bg-secondary border-b border-border shrink-0">
      <span className="text-base font-bold text-text-heading whitespace-nowrap flex items-center gap-2">
        <img src="/image.png" alt="Reussir" className="h-6 w-6" />
        Reussir Playground
      </span>

      <div className="h-4 w-px bg-border-subtle" />

      {/* Split run button: main action + mode dropdown */}
      <div className="flex items-center">
        <button
          type="button"
          onClick={compile}
          disabled={isCompiling}
          className="h-8 px-3 text-[13px] font-semibold bg-accent text-white hover:bg-accent-hover disabled:opacity-60 disabled:cursor-not-allowed rounded-l-md border border-accent transition-colors"
          title="Compile and run (Ctrl+Enter)"
        >
          {buttonText}
        </button>
        <DropdownMenu.Root>
          <DropdownMenu.Trigger asChild>
            <button
              type="button"
              disabled={isCompiling}
              className="h-8 px-1.5 bg-accent text-white hover:bg-accent-hover disabled:opacity-60 disabled:cursor-not-allowed rounded-r-md border border-l-0 border-accent transition-colors flex items-center"
              title="Change mode"
            >
              <ChevronDown size={14} />
            </button>
          </DropdownMenu.Trigger>
          <DropdownMenu.Portal>
            <DropdownMenu.Content
              className="z-50 min-w-[200px] rounded-md border border-border bg-bg-elevated p-1 shadow-lg"
              sideOffset={4}
              align="start"
            >
              {MODE_OPTIONS.map((opt) => (
                <DropdownMenu.Item
                  key={opt.value}
                  onSelect={() => handleModeSelect(opt.value)}
                  className="flex flex-col gap-0.5 rounded-sm px-2 py-1.5 text-[13px] cursor-default outline-none focus:bg-bg-input-hover data-[highlighted]:bg-bg-input-hover"
                >
                  <span className="font-medium text-text-primary flex items-center gap-2">
                    {opt.label}
                    {mode === opt.value && (
                      <span className="text-[10px] text-accent font-normal">
                        current
                      </span>
                    )}
                  </span>
                  <span className="text-[11px] text-text-secondary">
                    {opt.description}
                  </span>
                </DropdownMenu.Item>
              ))}
            </DropdownMenu.Content>
          </DropdownMenu.Portal>
        </DropdownMenu.Root>
      </div>

      <div className="h-4 w-px bg-border-subtle" />

      {/* Config group: example + optimization */}
      <div className="flex items-center gap-1.5">
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
                key={ex.name}
                value={String(i)}
                className="text-text-primary text-[13px] focus:bg-bg-input-hover focus:text-text-primary"
              >
                {ex.name}
              </SelectItem>
            ))}
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
      </div>

      <button
        type="button"
        onClick={toggleTheme}
        className="ml-auto h-8 w-8 inline-flex items-center justify-center rounded text-text-secondary hover:text-text-primary hover:bg-bg-input-hover transition-colors"
        title={theme === "dark" ? "Switch to light mode" : "Switch to dark mode"}
      >
        {theme === "dark" ? <Sun size={16} /> : <Moon size={16} />}
      </button>
    </div>
  );
}
