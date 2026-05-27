import { useRef, useState, useCallback, useEffect } from "react";

const SCROLL_POS_KEY = "chat_scroll_positions";

interface UseChatScrollOptions {
  /** Unique conversation ID for scroll position persistence */
  conversationId: string;
  /** Total message count — triggers scroll logic */
  messageCount: number;
  /** Called when user scrolls near top to load older messages */
  onLoadMore?: () => Promise<void>;
  /** Whether there are more older messages to load */
  hasMore?: boolean;
}

interface UseChatScrollReturn {
  scrollRef: React.RefObject<HTMLDivElement>;
  handleScroll: () => void;
  scrollToBottom: () => void;
  scrollToTop: () => void;
  showScrollDown: boolean;
  showScrollUp: boolean;
  showNewMessages: boolean;
  dismissNewMessages: () => void;
  isLoadingMore: boolean;
}

function getSavedPositions(): Record<string, { position: number; atBottom: boolean }> {
  try {
    return JSON.parse(localStorage.getItem(SCROLL_POS_KEY) || "{}");
  } catch { return {}; }
}

function savePosition(convId: string, position: number, atBottom: boolean) {
  const all = getSavedPositions();
  all[convId] = { position, atBottom };
  // Keep max 50 entries
  const keys = Object.keys(all);
  if (keys.length > 50) delete all[keys[0]];
  localStorage.setItem(SCROLL_POS_KEY, JSON.stringify(all));
}

/** Cache messages locally for offline access */
export function cacheMessages(conversationId: string, messages: any[]) {
  try {
    // Store last 200 messages per conversation
    const slice = messages.slice(-200);
    localStorage.setItem(`chat_cache_${conversationId}`, JSON.stringify(slice));
  } catch { /* quota exceeded — ignore */ }
}

export function getCachedMessages<T>(conversationId: string): T[] {
  try {
    const raw = localStorage.getItem(`chat_cache_${conversationId}`);
    return raw ? JSON.parse(raw) : [];
  } catch { return []; }
}

export function useChatScroll({
  conversationId,
  messageCount,
  onLoadMore,
  hasMore = false,
}: UseChatScrollOptions): UseChatScrollReturn {
  const scrollRef = useRef<HTMLDivElement>(null);
  const isNearBottomRef = useRef(true);
  const initialScrollDone = useRef(false);
  const prevMessageCount = useRef(0);
  const prevScrollHeight = useRef(0);
  const [showScrollDown, setShowScrollDown] = useState(false);
  const [showScrollUp, setShowScrollUp] = useState(false);
  const [showNewMessages, setShowNewMessages] = useState(false);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const loadingMoreRef = useRef(false);

  const scrollToBottom = useCallback(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
    setShowNewMessages(false);
  }, []);

  const scrollToTop = useCallback(() => {
    scrollRef.current?.scrollTo({ top: 0, behavior: "smooth" });
  }, []);

  const dismissNewMessages = useCallback(() => setShowNewMessages(false), []);

  const handleScroll = useCallback(() => {
    if (!scrollRef.current) return;
    const { scrollTop, scrollHeight, clientHeight } = scrollRef.current;
    const nearBottom = scrollHeight - scrollTop - clientHeight < 100;
    isNearBottomRef.current = nearBottom;
    setShowScrollDown(!nearBottom);
    setShowScrollUp(scrollTop > 300);

    if (nearBottom) {
      setShowNewMessages(false);
    }

    // Save scroll position
    savePosition(conversationId, scrollTop, nearBottom);

    // Load more when near top
    if (scrollTop < 150 && hasMore && onLoadMore && !loadingMoreRef.current) {
      loadingMoreRef.current = true;
      setIsLoadingMore(true);
      prevScrollHeight.current = scrollHeight;
      onLoadMore().finally(() => {
        loadingMoreRef.current = false;
        setIsLoadingMore(false);
      });
    }
  }, [conversationId, hasMore, onLoadMore]);

  // Reset on conversation change
  useEffect(() => {
    initialScrollDone.current = false;
    prevMessageCount.current = 0;
  }, [conversationId]);

  // Auto-scroll logic
  useEffect(() => {
    if (!scrollRef.current || messageCount === 0) return;

    // Preserve scroll position after loading older messages
    if (loadingMoreRef.current || (prevMessageCount.current > 0 && messageCount > prevMessageCount.current && !isNearBottomRef.current && initialScrollDone.current)) {
      // Messages were prepended (older) — preserve position
      const newScrollHeight = scrollRef.current.scrollHeight;
      if (prevScrollHeight.current > 0 && newScrollHeight > prevScrollHeight.current) {
        scrollRef.current.scrollTop += newScrollHeight - prevScrollHeight.current;
        prevScrollHeight.current = 0;
      }
      
      // Show "new messages" indicator if new messages added at bottom while reading old
      if (initialScrollDone.current && !isNearBottomRef.current && messageCount > prevMessageCount.current) {
        setShowNewMessages(true);
      }
      prevMessageCount.current = messageCount;
      return;
    }

    // Initial scroll — check saved position
    if (!initialScrollDone.current) {
      initialScrollDone.current = true;
      const saved = getSavedPositions()[conversationId];
      if (saved && !saved.atBottom) {
        scrollRef.current.scrollTop = saved.position;
      } else {
        scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
      }
      prevMessageCount.current = messageCount;
      return;
    }

    // New message arrived while near bottom — auto-scroll
    if (isNearBottomRef.current) {
      requestAnimationFrame(() => {
        scrollRef.current?.scrollTo({ top: scrollRef.current!.scrollHeight, behavior: "smooth" });
      });
    } else {
      // User is reading old messages — show indicator
      setShowNewMessages(true);
    }

    prevMessageCount.current = messageCount;
  }, [messageCount, conversationId]);

  return {
    scrollRef: scrollRef as React.RefObject<HTMLDivElement>,
    handleScroll,
    scrollToBottom,
    scrollToTop,
    showScrollDown,
    showScrollUp,
    showNewMessages,
    dismissNewMessages,
    isLoadingMore,
  };
}
