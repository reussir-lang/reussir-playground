import { useAtomValue } from "jotai";
import { outputAtom, outputLabelAtom } from "@/store/atoms";
import { cn } from "@/lib/utils";

export function OutputPanel() {
  const output = useAtomValue(outputAtom);
  const label = useAtomValue(outputLabelAtom);

  return (
    <div className="flex flex-col min-h-0 h-full">
      <div className="px-3 py-1 bg-bg-elevated text-[11px] text-text-secondary uppercase tracking-wider border-b border-border-subtle shrink-0">
        {label}
      </div>
      <pre
        className={cn(
          "flex-1 p-3 font-mono text-[13px] leading-[1.5] whitespace-pre-wrap break-words overflow-auto bg-bg-primary text-text-primary min-h-0",
          output.kind === "error" && "text-error",
          output.kind === "loading" && "text-text-secondary italic",
        )}
      >
        {output.text}
      </pre>
    </div>
  );
}
