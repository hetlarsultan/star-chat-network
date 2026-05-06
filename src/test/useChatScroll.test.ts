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
function createMockScrollDiv(overrides: Partial<HTMLDivElement> = {}) {
  return {
    scrollTop: 0,
    scrollHeight: 2000,
    clientHeight: 600,
    scrollTo: vi.fn(function (this: any, opts: any) {
      if (opts && typeof opts.top === "number") this.scrollTop = opts.top;
    }),
    ...overrides,
  } as unknown as HTMLDivElement;
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

  it("shows new messages indicator when user is scrolled up and new message arrives", () => {
    const { result, rerender } = renderHook(
      ({ messageCount }) =>
        useChatScroll({ conversationId: "test-room-2", messageCount, onLoadMore: undefined, hasMore: false }),
      { initialProps: { messageCount: 10 } }
    );

    const mockDiv = createMockScrollDiv({ scrollTop: 0, scrollHeight: 2000, clientHeight: 600 });
    (result.current.scrollRef as any).current = mockDiv;

    // First render — initial scroll done
    act(() => { result.current.handleScroll(); });

    // Simulate user scrolled far from bottom (scrollHeight - scrollTop - clientHeight > 100)
    mockDiv.scrollTop = 200;
    act(() => { result.current.handleScroll(); });

    // New message arrives
    rerender({ messageCount: 11 });

    // Should show new messages indicator
    expect(result.current.showNewMessages).toBe(true);
  });

  it("hides new messages indicator when user scrolls back to bottom", () => {
    const { result, rerender } = renderHook(
      ({ messageCount }) =>
        useChatScroll({ conversationId: "test-room-3", messageCount, onLoadMore: undefined, hasMore: false }),
      { initialProps: { messageCount: 10 } }
    );

    const mockDiv = createMockScrollDiv({ scrollTop: 200, scrollHeight: 2000, clientHeight: 600 });
    (result.current.scrollRef as any).current = mockDiv;

    // Initial scroll
    act(() => { result.current.handleScroll(); });

    // New message while scrolled up
    rerender({ messageCount: 11 });
    expect(result.current.showNewMessages).toBe(true);

    // User scrolls to bottom (nearBottom: scrollHeight - scrollTop - clientHeight < 100)
    mockDiv.scrollTop = 1450; // 2000 - 1450 - 600 = -50 < 100
    act(() => { result.current.handleScroll(); });

    expect(result.current.showNewMessages).toBe(false);
  });

  it("dismissNewMessages hides indicator manually", () => {
    const { result, rerender } = renderHook(
      ({ messageCount }) =>
        useChatScroll({ conversationId: "test-room-4", messageCount, onLoadMore: undefined, hasMore: false }),
      { initialProps: { messageCount: 5 } }
    );

    const mockDiv = createMockScrollDiv({ scrollTop: 100, scrollHeight: 2000, clientHeight: 600 });
    (result.current.scrollRef as any).current = mockDiv;

    act(() => { result.current.handleScroll(); });
    rerender({ messageCount: 6 });
    expect(result.current.showNewMessages).toBe(true);

    act(() => { result.current.dismissNewMessages(); });
    expect(result.current.showNewMessages).toBe(false);
  });
});
