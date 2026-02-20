import { useAtom, useAtomValue, useSetAtom } from "jotai";
import { BookOpen, ChevronDown, LucideGithub, Moon, Share2, Sun } from "lucide-react";
import { DropdownMenu } from "radix-ui";
import { toast } from "sonner";

import { examples } from "@/data/examples";
import { useCompile } from "@/hooks/use-compile";
import { useTheme } from "@/hooks/use-theme";
import { buildShareUrl } from "@/lib/share";
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

const OPT_OPTIONS: {
  value: OptLevel;
  label: string;
  description: string;
}[] = [
  {
    value: "none",
    label: "No optimization",
    description: "No compiler optimizations applied",
  },
  {
    value: "default",
    label: "Default",
    description: "Standard optimization level",
  },
  { value: "size", label: "Size", description: "Optimize for binary size" },
  {
    value: "aggressive",
    label: "Aggressive",
    description: "Maximum optimization level",
  },
];

const MENU_CONTENT_CLASS =
  "z-50 min-w-[220px] rounded-md border border-border bg-bg-elevated p-1 shadow-lg";
const MENU_ITEM_CLASS =
  "flex flex-col gap-0.5 rounded-sm px-2 py-1.5 text-[13px] cursor-default outline-none focus:bg-bg-input-hover data-highlighted:bg-bg-input-hover";
const TRIGGER_CLASS =
  "h-8 px-3 inline-flex items-center gap-1.5 rounded-md border border-border-input bg-bg-input text-text-primary text-[13px] hover:bg-bg-input-hover transition-colors";

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

  const sourceCode = useAtomValue(sourceCodeAtom);
  const driverCode = useAtomValue(driverCodeAtom);

  const handleShare = async () => {
    const url = buildShareUrl({
      source: sourceCode,
      driver: driverCode,
      mode,
      opt: optLevel,
    });
    window.history.replaceState(null, "", url);
    await navigator.clipboard.writeText(url);
    toast.success("Link copied to clipboard");
  };

  const handleExampleSelect = (index: number) => {
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
    <div className="flex flex-wrap items-center gap-2 sm:gap-3 px-2 sm:px-4 py-2 bg-bg-secondary border-b border-border shrink-0">
      <span className="text-base font-bold text-text-heading whitespace-nowrap flex items-center gap-2">
        <img src="/image.png" alt="Reussir" className="h-6 w-6" />
        <span className="hidden sm:inline">Reussir Playground</span>
      </span>

      <div className="hidden sm:block h-4 w-px bg-border-subtle" />

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
              className={MENU_CONTENT_CLASS}
              sideOffset={4}
              align="start"
            >
              {MODE_OPTIONS.map((opt) => (
                <DropdownMenu.Item
                  key={opt.value}
                  onSelect={() => handleModeSelect(opt.value)}
                  className={MENU_ITEM_CLASS}
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

      <div className="hidden sm:block h-4 w-px bg-border-subtle" />

      {/* Config group: example + optimization */}
      <div className="flex items-center gap-1.5">
        <DropdownMenu.Root>
          <DropdownMenu.Trigger asChild>
            <button type="button" className={TRIGGER_CLASS}>
              {examples[selectedExample]?.name ?? "Example"}
              <ChevronDown size={14} className="opacity-50" />
            </button>
          </DropdownMenu.Trigger>
          <DropdownMenu.Portal>
            <DropdownMenu.Content
              className={MENU_CONTENT_CLASS}
              sideOffset={4}
              align="start"
            >
              {examples.map((ex, i) => (
                <DropdownMenu.Item
                  key={ex.name}
                  onSelect={() => handleExampleSelect(i)}
                  className={MENU_ITEM_CLASS}
                >
                  <span className="font-medium text-text-primary flex items-center gap-2">
                    {ex.name}
                    {selectedExample === i && (
                      <span className="text-[10px] text-accent font-normal">
                        current
                      </span>
                    )}
                  </span>
                  <span className="text-[11px] text-text-secondary">
                    {ex.description}
                  </span>
                </DropdownMenu.Item>
              ))}
            </DropdownMenu.Content>
          </DropdownMenu.Portal>
        </DropdownMenu.Root>

        <DropdownMenu.Root>
          <DropdownMenu.Trigger asChild>
            <button type="button" className={TRIGGER_CLASS}>
              {OPT_OPTIONS.find((o) => o.value === optLevel)?.label ??
                "Optimization"}
              <ChevronDown size={14} className="opacity-50" />
            </button>
          </DropdownMenu.Trigger>
          <DropdownMenu.Portal>
            <DropdownMenu.Content
              className={MENU_CONTENT_CLASS}
              sideOffset={4}
              align="start"
            >
              {OPT_OPTIONS.map((opt) => (
                <DropdownMenu.Item
                  key={opt.value}
                  onSelect={() => setOptLevel(opt.value)}
                  className={MENU_ITEM_CLASS}
                >
                  <span className="font-medium text-text-primary flex items-center gap-2">
                    {opt.label}
                    {optLevel === opt.value && (
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

      <div className="flex items-center gap-1 sm:ml-auto">
        <button
          type="button"
          onClick={handleShare}
          className="h-8 w-8 inline-flex items-center justify-center rounded text-text-secondary hover:text-text-primary hover:bg-bg-input-hover transition-colors"
          title="Copy source code"
        >
          <Share2 size={16} />
        </button>

        <a
          href="https://reussir-lang.github.io/"
          target="_blank"
          rel="noopener noreferrer"
          className="h-8 w-8 inline-flex items-center justify-center rounded text-text-secondary hover:text-text-primary hover:bg-bg-input-hover transition-colors"
          title="Documentation"
        >
          <BookOpen size={16} />
        </a>

        <a
          href="https://github.com/reussir-lang/reussir"
          target="_blank"
          rel="noopener noreferrer"
          className="h-8 w-8 inline-flex items-center justify-center rounded text-text-secondary hover:text-text-primary hover:bg-bg-input-hover transition-colors"
          title="Source code"
        >
          <LucideGithub size={16} />
        </a>

        <button
          type="button"
          onClick={toggleTheme}
          className="h-8 w-8 inline-flex items-center justify-center rounded text-text-secondary hover:text-text-primary hover:bg-bg-input-hover transition-colors"
          title={theme === "dark" ? "Switch to light mode" : "Switch to dark mode"}
        >
          {theme === "dark" ? <Sun size={16} /> : <Moon size={16} />}
        </button>
      </div>
    </div>
  );
}
