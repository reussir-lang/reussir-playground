import type { Mode, OptLevel } from "@/store/atoms";

export interface SharedState {
  source: string;
  driver: string;
  mode: Mode;
  opt: OptLevel;
}

/** Encode playground state into a URL-safe hash string. */
export function encodeState(state: SharedState): string {
  const json = JSON.stringify(state);
  const bytes = new TextEncoder().encode(json);
  let binary = "";
  for (const b of bytes) binary += String.fromCharCode(b);
  // URL-safe base64: replace +/= with -_
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

/** Decode a hash string back into playground state, or null if invalid. */
export function decodeState(hash: string): SharedState | null {
  try {
    // Restore standard base64
    let b64 = hash.replace(/-/g, "+").replace(/_/g, "/");
    while (b64.length % 4) b64 += "=";
    const binary = atob(b64);
    const bytes = Uint8Array.from(binary, (c) => c.charCodeAt(0));
    const json = new TextDecoder().decode(bytes);
    const data = JSON.parse(json);
    if (
      typeof data.source === "string" &&
      typeof data.driver === "string" &&
      typeof data.mode === "string" &&
      typeof data.opt === "string"
    ) {
      return data as SharedState;
    }
    return null;
  } catch {
    return null;
  }
}

/** Build a shareable URL with the state encoded in the hash. */
export function buildShareUrl(state: SharedState): string {
  const url = new URL(window.location.href);
  url.hash = encodeState(state);
  return url.toString();
}
