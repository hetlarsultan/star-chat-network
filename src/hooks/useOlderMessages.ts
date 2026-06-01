import { useCallback, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Tables } from "@/integrations/supabase/types";

const PAGE_SIZE = 30;
const MAX_RETRIES = 3;

export interface MessageWithProfile {
  id: string;
  text: string;
  created_at: string;
  user_id: string;
  room_id: string;
  reply_to_username?: string | null;
  reply_to_text?: string | null;
  profile?: Tables<"profiles"> | null;
}

const sleep = (ms: number) => new Promise(r => setTimeout(r, ms));

/**
 * Loads older messages on scroll-to-top with scroll-position preservation,
 * exponential-backoff retry on failure, and an `error` flag for manual retry UI.
 */
export function useOlderMessages(
  roomId: string | undefined,
  scrollRef: React.RefObject<HTMLDivElement>,
  messages: MessageWithProfile[],
  setMessages: React.Dispatch<React.SetStateAction<MessageWithProfile[]>>,
  profilesCacheRef: React.MutableRefObject<Record<string, Tables<"profiles">>>,
) {
  const [loading, setLoading] = useState(false);
  const [hasMore, setHasMore] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const lockRef = useRef(false);

  const loadOlder = useCallback(async () => {
    if (!roomId || lockRef.current || !hasMore) return;
    if (messages.length === 0) return;
    const container = scrollRef.current;
    if (!container) return;

    lockRef.current = true;
    setLoading(true);
    setError(null);

    const oldest = messages[0].created_at;
    const prevScrollHeight = container.scrollHeight;
    const prevScrollTop = container.scrollTop;

    let data: any[] | null = null;
    let lastErr: any = null;
    for (let attempt = 0; attempt < MAX_RETRIES; attempt++) {
      const { data: d, error: e } = await supabase
        .from("messages")
        .select("*")
        .eq("room_id", roomId)
        .lt("created_at", oldest)
        .order("created_at", { ascending: false })
        .limit(PAGE_SIZE);
      if (!e) { data = d; break; }
      lastErr = e;
      await sleep(400 * Math.pow(2, attempt)); // 400, 800, 1600ms
    }

    if (data === null) {
      setError(lastErr?.message || "فشل تحميل الرسائل الأقدم");
      setLoading(false);
      lockRef.current = false;
      return;
    }

    if (data.length === 0) {
      setHasMore(false);
      setLoading(false);
      lockRef.current = false;
      return;
    }

    const ordered = [...data].reverse();
    const missingIds = [...new Set(ordered.map(m => m.user_id))].filter(
      id => !profilesCacheRef.current[id],
    );
    if (missingIds.length) {
      try {
        const { data: profs } = await supabase
          .from("profiles")
          .select("*")
          .in("user_id", missingIds);
        profs?.forEach(p => { profilesCacheRef.current[p.user_id] = p; });
      } catch {
        // non-fatal: messages still render without profile
      }
    }

    const withProfiles = ordered.map(m => ({
      ...m,
      profile: profilesCacheRef.current[m.user_id] || null,
    }));

    setMessages(prev => [...withProfiles, ...prev]);
    if (data.length < PAGE_SIZE) setHasMore(false);

    // Preserve scroll position after DOM update (avoids jump on iOS/Android)
    requestAnimationFrame(() => {
      const c = scrollRef.current;
      if (c) {
        const newScrollHeight = c.scrollHeight;
        c.scrollTop = newScrollHeight - prevScrollHeight + prevScrollTop;
      }
      setLoading(false);
      lockRef.current = false;
    });
  }, [roomId, messages, hasMore, scrollRef, setMessages, profilesCacheRef]);

  const onScroll = useCallback(
    (e: React.UIEvent<HTMLDivElement>) => {
      const el = e.currentTarget;
      if (el.scrollTop < 80) loadOlder();
    },
    [loadOlder],
  );

  const retry = useCallback(() => {
    setError(null);
    loadOlder();
  }, [loadOlder]);

  return { onScroll, loading, hasMore, error, retry };
}
