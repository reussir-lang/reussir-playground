import { useAtom, useAtomValue, useSetAtom } from "jotai";
import { BookOpen, ChevronDown, FileCode, Gauge, LucideGithub, Moon, Settings, Share2, Sun } from "lucide-react";
import { DropdownMenu } from "radix-ui";
import { toast } from "sonner";

import { examples } from "@/data/examples";
import { useCompile } from "@/hooks/use-compile";
import { useTheme } from "@/hooks/use-theme";
import { buildShareUrl } from "@/lib/share";
import {
  isCompilingAtom,
  modeAtom,
  optLevelAtom,
  outputAtom,
  reuseAcrossCallAtom,
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
  "menu-content z-50 min-w-[230px] rounded-xl p-1.5";
const MENU_ITEM_CLASS =
  "menu-item flex flex-col gap-0.5 rounded-lg px-2.5 py-2 text-[13px] cursor-default outline-none transition-colors";
const TRIGGER_CLASS =
  "control-trigger h-8 min-w-0 px-3 inline-flex items-center gap-1.5 rounded-xl text-text-primary text-[13px] transition-all";
const ICON_BUTTON_CLASS =
  "toolbar-icon h-8 w-8 inline-flex items-center justify-center rounded-lg transition-all";

export function Toolbar() {
  const [selectedExample, setSelectedExample] = useAtom(
    selectedExampleIndexAtom,
  );
  const setSourceCode = useSetAtom(sourceCodeAtom);
  const [mode, setMode] = useAtom(modeAtom);
  const [optLevel, setOptLevel] = useAtom(optLevelAtom);
  const [reuseAcrossCall, setReuseAcrossCall] = useAtom(reuseAcrossCallAtom);
  const isCompiling = useAtomValue(isCompilingAtom);
  const buttonText = useAtomValue(runButtonTextAtom);
  const setOutput = useSetAtom(outputAtom);
  const compile = useCompile();
  const { theme, toggleTheme } = useTheme();

  const sourceCode = useAtomValue(sourceCodeAtom);

  const handleShare = async () => {
    const url = buildShareUrl({
      source: sourceCode,
      mode,
      opt: optLevel,
      reuseAcrossCall: reuseAcrossCall || undefined,
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
    setOutput({
      kind: "idle",
      text: "Select a mode and click Run to compile.",
    });
  };

  const handleModeSelect = (value: Mode) => {
    setMode(value);
  };

  return (
    <header className="playground-toolbar flex flex-wrap items-center gap-2 sm:gap-3 px-2.5 sm:px-4 py-2 shrink-0">
      <span className="text-text-heading whitespace-nowrap flex items-center gap-2">
        <span className="brand-wordmark text-base sm:text-lg font-bold">Reussir</span>
        <span className="brand-tag hidden sm:inline-flex items-center rounded-full px-2 py-1 text-[9px] font-semibold">
          Playground
        </span>
      </span>

      <div className="hidden sm:block h-4 w-px bg-border-subtle" />

      {/* Split run button: main action + mode dropdown */}
      <div className="flex items-center">
        <button
          type="button"
          onClick={compile}
          disabled={isCompiling}
          className="run-button h-8 px-3 text-[13px] font-bold disabled:opacity-60 disabled:cursor-not-allowed rounded-l-xl border transition-all"
          title="Compile and run (Ctrl+Enter)"
        >
          {buttonText}
        </button>
        <DropdownMenu.Root>
          <DropdownMenu.Trigger asChild>
            <button
              type="button"
              disabled={isCompiling}
              className="run-menu-button h-8 px-1.5 disabled:opacity-60 disabled:cursor-not-allowed rounded-r-xl border border-l-0 transition-all flex items-center"
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
      <div className="toolbar-config flex flex-wrap items-center gap-1.5">
        <DropdownMenu.Root>
          <DropdownMenu.Trigger asChild>
            <button
              type="button"
              className={`${TRIGGER_CLASS} max-w-[18rem] flex-1 sm:flex-none`}
            >
              <FileCode size={14} />
              <span className="truncate">
                {examples[selectedExample]?.name ?? "Example"}
              </span>
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
            <button type="button" className={`${TRIGGER_CLASS} flex-1 sm:flex-none`}>
              <Gauge size={14} />
              <span className="truncate">
                {OPT_OPTIONS.find((o) => o.value === optLevel)?.label ??
                  "Optimization"}
              </span>
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

        <DropdownMenu.Root>
          <DropdownMenu.Trigger asChild>
            <button type="button" className={`${TRIGGER_CLASS} flex-1 sm:flex-none`}>
              <Settings size={14} />
              Options
              <ChevronDown size={14} className="opacity-50" />
            </button>
          </DropdownMenu.Trigger>
          <DropdownMenu.Portal>
            <DropdownMenu.Content
              className={MENU_CONTENT_CLASS}
              sideOffset={4}
              align="start"
            >
              <DropdownMenu.CheckboxItem
                checked={reuseAcrossCall}
                onCheckedChange={(v) => setReuseAcrossCall(!!v)}
                onSelect={(e) => e.preventDefault()}
                className={MENU_ITEM_CLASS}
              >
                <span className="font-medium text-text-primary flex items-center gap-2">
                  <span
                    className={`inline-flex items-center justify-center h-4 w-4 rounded border text-[10px] ${reuseAcrossCall ? "bg-accent border-accent text-accent-contrast" : "border-border-input bg-bg-input"}`}
                  >
                    {reuseAcrossCall && "✓"}
                  </span>
                  Reuse across call
                </span>
                <span className="text-[11px] text-text-secondary pl-6">
                  Allow the compiler to reuse memory across function calls for
                  regional allocations
                </span>
              </DropdownMenu.CheckboxItem>
            </DropdownMenu.Content>
          </DropdownMenu.Portal>
        </DropdownMenu.Root>
      </div>

      <div className="toolbar-actions flex items-center gap-1 sm:ml-auto">
        <button
          type="button"
          onClick={handleShare}
          className={ICON_BUTTON_CLASS}
          title="Copy source code"
        >
          <Share2 size={16} />
        </button>

        <a
          href="https://reussir-lang.github.io/"
          target="_blank"
          rel="noopener noreferrer"
          className={ICON_BUTTON_CLASS}
          title="Documentation"
        >
          <BookOpen size={16} />
        </a>

        <a
          href="https://github.com/reussir-lang/reussir"
          target="_blank"
          rel="noopener noreferrer"
          className={ICON_BUTTON_CLASS}
          title="Source code"
        >
          <LucideGithub size={16} />
        </a>

        <button
          type="button"
          onClick={toggleTheme}
          className={ICON_BUTTON_CLASS}
          title={theme === "dark" ? "Switch to light mode" : "Switch to dark mode"}
        >
          {theme === "dark" ? <Sun size={16} /> : <Moon size={16} />}
        </button>
      </div>
    </header>
  );
}
