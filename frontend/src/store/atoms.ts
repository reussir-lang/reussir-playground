import { atom } from "jotai";
import { examples } from "@/data/examples";

// --- Editor content ---
export const sourceCodeAtom = atom(examples[0]!.source);
export const driverCodeAtom = atom(examples[0]!.driver);

// --- Toolbar selections ---
export const selectedExampleIndexAtom = atom(0);

export type Mode = "run" | "llvm-ir" | "asm" | "mlir";
export const modeAtom = atom<Mode>("run");

export type OptLevel = "none" | "default" | "size" | "aggressive";
export const optLevelAtom = atom<OptLevel>("none");

// --- Compile state ---
export const isCompilingAtom = atom(false);

// --- Output state ---
export type OutputState =
  | { kind: "idle"; text: string }
  | { kind: "loading"; text: string }
  | { kind: "success"; text: string }
  | { kind: "error"; text: string };

export const outputAtom = atom<OutputState>({
  kind: "idle",
  text: 'Select an example and click "Run" to compile.',
});

// --- Derived: output panel label ---
const MODE_LABELS: Record<string, string> = {
  run: "Output",
  "llvm-ir": "LLVM IR",
  asm: "WebAssembly",
  mlir: "MLIR",
};

export const outputLabelAtom = atom(
  (get) => MODE_LABELS[get(modeAtom)] ?? "Output",
);

// --- Derived: button text ---
export const runButtonTextAtom = atom((get) =>
  get(modeAtom) === "run" ? "\u25B6 Run" : "\u25B6 Compile",
);
