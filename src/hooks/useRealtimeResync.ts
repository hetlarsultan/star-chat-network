import { useEffect, useRef } from "react";

/**
 * Calls `resync()` when the browser regains connectivity, when the tab becomes visible,
 * or when the supabase realtime channel reports an error/timeout.
 * Pass the channel status via `bindStatus` so the hook can react to realtime drops.
 */
export function useRealtimeResync(resync: () => void) {
  const resyncRef = useRef(resync);
  resyncRef.current = resync;

  useEffect(() => {
    const onOnline = () => resyncRef.current();
    const onVisible = () => {
      if (document.visibilityState === "visible") resyncRef.current();
    };
    window.addEventListener("online", onOnline);
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      window.removeEventListener("online", onOnline);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, []);
}
