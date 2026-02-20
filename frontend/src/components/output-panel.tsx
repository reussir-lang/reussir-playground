import { useAtomValue } from "jotai";
import { outputAtom, outputLabelAtom } from "@/store/atoms";
import { cn } from "@/lib/utils";

export function OutputPanel() {
  const output = useAtomValue(outputAtom);
  const label = useAtomValue(outputLabelAtom);

  return (
    <div className="flex flex-col min-h-0 h-full">
      <div className="px-3 py-1.5 bg-bg-elevated text-[11px] font-semibold text-text-secondary uppercase tracking-wider border-b border-border shrink-0">
        {label}
      </div>
      {output.kind === "idle" ? (
        <div className="flex-1 flex items-center justify-center p-6 min-h-0">
          <p className="text-text-secondary text-sm text-center">
            {output.text}
          </p>
        </div>
      ) : (
        <pre
          className={cn(
            "flex-1 p-3 font-mono text-[13px] leading-[1.5] whitespace-pre-wrap break-words overflow-auto bg-bg-primary text-text-primary min-h-0",
            output.kind === "error" && "text-error",
            output.kind === "loading" && "text-text-secondary italic",
          )}
        >
          {output.text}
        </pre>
      )}
    </div>
  );
}
