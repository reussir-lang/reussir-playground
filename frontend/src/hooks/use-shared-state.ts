import { useSetAtom } from "jotai";
import { useEffect } from "react";

import { decodeState } from "@/lib/share";
import {
  driverCodeAtom,
  modeAtom,
  optLevelAtom,
  sourceCodeAtom,
} from "@/store/atoms";

/** On mount, check the URL hash for shared playground state and apply it. */
export function useSharedState() {
  const setSourceCode = useSetAtom(sourceCodeAtom);
  const setDriverCode = useSetAtom(driverCodeAtom);
  const setMode = useSetAtom(modeAtom);
  const setOptLevel = useSetAtom(optLevelAtom);

  useEffect(() => {
    const hash = window.location.hash.slice(1);
    if (!hash) return;
    const state = decodeState(hash);
    if (!state) return;
    setSourceCode(state.source);
    setDriverCode(state.driver);
    setMode(state.mode);
    setOptLevel(state.opt);
  }, [setSourceCode, setDriverCode, setMode, setOptLevel]);
}
