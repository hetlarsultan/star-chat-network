import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook, act } from "@testing-library/react";
import { useChatScroll } from "@/hooks/useChatScroll";

const localStorageMock = (() => {
  let store: Record<string, string> = {};
  return {
    getItem: (key: string) => store[key] || null,
    setItem: (key: string, value: string) => { store[key] = value; },
    removeItem: (key: string) => { delete store[key]; },
    clear: () => { store = {}; },
  };
})();
Object.defineProperty(window, "localStorage", { value: localStorageMock });

describe("debug", () => {
  beforeEach(() => localStorageMock.clear());

  it("check indicator", () => {
    const div: any = {
      scrollTop: 100,
      clientHeight: 600,
      scrollTo: vi.fn((opts: any) => { if (opts?.top != null) div.scrollTop = opts.top; }),
    };
    Object.defineProperty(div, "scrollHeight", { value: 2000, writable: true, configurable: true });

    const { result, rerender } = renderHook(
      ({ mc }) => useChatScroll({ conversationId: "dbg", messageCount: mc, onLoadMore: undefined, hasMore: false }),
      { initialProps: { mc: 5 } }
    );

    // First render: scrollRef is null, useEffect returns early
    // Attach ref
    (result.current.scrollRef as any).current = div;

    // Rerender same count - useEffect sees ref, enters initial scroll branch
    rerender({ mc: 5 });

    console.log("After initial rerender, scrollTop:", div.scrollTop);
    console.log("scrollTo calls:", div.scrollTo.mock.calls);

    // handleScroll to set isNearBottomRef = false
    div.scrollTop = 100;
    act(() => { result.current.handleScroll(); });
    console.log("showScrollDown:", result.current.showScrollDown);

    // New message
    rerender({ mc: 6 });
    console.log("showNewMessages:", result.current.showNewMessages);
  });
});
