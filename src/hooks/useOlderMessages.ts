import { useCallback, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Tables } from "@/integrations/supabase/types";

const PAGE_SIZE = 30;

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

/**
 * Hook: load older messages on scroll-to-top while preserving scroll position.
 * Returns onScroll handler to attach to the scroll container.
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
  const lockRef = useRef(false);

  const loadOlder = useCallback(async () => {
    if (!roomId || lockRef.current || !hasMore) return;
    if (messages.length === 0) return;
    const container = scrollRef.current;
    if (!container) return;

    lockRef.current = true;
    setLoading(true);

    const oldest = messages[0].created_at;
    const prevScrollHeight = container.scrollHeight;
    const prevScrollTop = container.scrollTop;

    const { data } = await supabase
      .from("messages")
      .select("*")
      .eq("room_id", roomId)
      .lt("created_at", oldest)
      .order("created_at", { ascending: false })
      .limit(PAGE_SIZE);

    if (!data || data.length === 0) {
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
      const { data: profs } = await supabase
        .from("profiles")
        .select("*")
        .in("user_id", missingIds);
      profs?.forEach(p => { profilesCacheRef.current[p.user_id] = p; });
    }

    const withProfiles = ordered.map(m => ({
      ...m,
      profile: profilesCacheRef.current[m.user_id] || null,
    }));

    setMessages(prev => [...withProfiles, ...prev]);
    if (data.length < PAGE_SIZE) setHasMore(false);

    // Restore scroll position after DOM update
    requestAnimationFrame(() => {
      if (!container) return;
      const newScrollHeight = container.scrollHeight;
      container.scrollTop = newScrollHeight - prevScrollHeight + prevScrollTop;
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

  return { onScroll, loading, hasMore };
}
