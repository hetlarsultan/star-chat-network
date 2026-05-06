import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook, act } from "@testing-library/react";
import { useChatScroll } from "@/hooks/useChatScroll";

// Mock localStorage
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

// Helper to create a fake scrollable div with controllable properties
function createMockScrollDiv(overrides: Partial<Record<string, any>> = {}) {
  const div: any = {
    scrollTop: 0,
    clientHeight: 600,
    scrollTo: vi.fn(function (this: any, opts: any) {
      if (opts && typeof opts.top === "number") this.scrollTop = opts.top;
    }),
    ...overrides,
  };
  // Make scrollHeight configurable
  Object.defineProperty(div, "scrollHeight", { value: overrides.scrollHeight || 2000, writable: true, configurable: true });
  return div as unknown as HTMLDivElement;
}

describe("useChatScroll – Load older messages preserves scroll position", () => {
  beforeEach(() => localStorageMock.clear());

  it("does not jump scroll position when older messages are prepended", async () => {
    const onLoadMore = vi.fn(() => Promise.resolve());

    const { result, rerender } = renderHook(
      ({ messageCount }) =>
        useChatScroll({ conversationId: "test-room", messageCount, onLoadMore, hasMore: true }),
      { initialProps: { messageCount: 50 } }
    );

    // Simulate the ref pointing to a scroll container
    const mockDiv = createMockScrollDiv({ scrollTop: 0, scrollHeight: 3000, clientHeight: 600 });
    (result.current.scrollRef as any).current = mockDiv;

    // Simulate initial scroll done (user scrolled up to top)
    act(() => { result.current.handleScroll(); });

    // Simulate scrolling near the top (scrollTop < 150) to trigger load more
    mockDiv.scrollTop = 100;
    act(() => { result.current.handleScroll(); });

    expect(onLoadMore).toHaveBeenCalled();

    // Simulate older messages loaded: scrollHeight increases, messageCount increases
    Object.defineProperty(mockDiv, "scrollHeight", { value: 4500, writable: true });
    rerender({ messageCount: 80 });

    // The hook should adjust scrollTop to compensate for new content above
    // This verifies no "jump to top" behavior
    const scrollToCalls = (mockDiv.scrollTo as any).mock.calls;
    const jumpedToZero = scrollToCalls.some((c: any) => c[0]?.top === 0);
    expect(jumpedToZero).toBe(false);
  });
});

describe("useChatScroll – New messages indicator behavior", () => {
  beforeEach(() => localStorageMock.clear());

  function setupWithMessages(convId: string, initialCount: number) {
    const mockDiv = createMockScrollDiv({ scrollHeight: 2000 });

    const { result, rerender } = renderHook(
      ({ mc }) => useChatScroll({ conversationId: convId, messageCount: mc, onLoadMore: undefined, hasMore: false }),
      { initialProps: { mc: 0 } }
    );

    // Attach ref before triggering the initial scroll useEffect
    (result.current.scrollRef as any).current = mockDiv;

    // Change messageCount to trigger useEffect (initial scroll branch)
    rerender({ mc: initialCount });

    return { result, rerender, mockDiv };
  }

  it("shows new messages indicator when user is scrolled up and new message arrives", () => {
    const { result, rerender, mockDiv } = setupWithMessages("ind-1", 10);

    // User scrolls up (not near bottom: 2000-200-600=1200>100)
    mockDiv.scrollTop = 200;
    act(() => { result.current.handleScroll(); });
    expect(result.current.showScrollDown).toBe(true);

    // New message arrives
    rerender({ mc: 11 });
    expect(result.current.showNewMessages).toBe(true);
  });

  it("hides new messages indicator when user scrolls back to bottom", () => {
    const { result, rerender, mockDiv } = setupWithMessages("ind-2", 10);

    mockDiv.scrollTop = 200;
    act(() => { result.current.handleScroll(); });

    rerender({ mc: 11 });
    expect(result.current.showNewMessages).toBe(true);

    // Scroll to bottom (2000-1500-600=-100<100)
    mockDiv.scrollTop = 1500;
    act(() => { result.current.handleScroll(); });
    expect(result.current.showNewMessages).toBe(false);
  });

  it("dismissNewMessages hides indicator manually", () => {
    const { result, rerender, mockDiv } = setupWithMessages("ind-3", 5);

    mockDiv.scrollTop = 100;
    act(() => { result.current.handleScroll(); });

    rerender({ mc: 6 });
    expect(result.current.showNewMessages).toBe(true);

    act(() => { result.current.dismissNewMessages(); });
    expect(result.current.showNewMessages).toBe(false);
  });
});
