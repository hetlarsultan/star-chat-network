import { ArrowDown, ArrowUp, RefreshCw, Loader2 } from "lucide-react";

interface Props {
  loadingOlder?: boolean;
  olderError?: string | null;
  onRetryOlder?: () => void;
  unreadCount?: number;
  onJumpToBottom?: () => void;
  onJumpToTop?: () => void;
  showJumpToTop?: boolean;
}

/** Floating helpers: loading/error banners, "new messages" pill, and quick
 *  scroll-to-top / scroll-to-bottom buttons for smooth chat navigation. */
const ChatScrollHelpers = ({
  loadingOlder,
  olderError,
  onRetryOlder,
  unreadCount = 0,
  onJumpToBottom,
  onJumpToTop,
  showJumpToTop,
}: Props) => {
  return (
    <>
      {loadingOlder && (
        <div className="fixed top-16 left-1/2 -translate-x-1/2 z-40 bg-card/90 backdrop-blur-sm border border-border rounded-full px-3 py-1 flex items-center gap-2 text-xs font-cairo text-muted-foreground shadow-md">
          <Loader2 className="w-3 h-3 animate-spin" />
          جاري تحميل الأقدم...
        </div>
      )}
      {olderError && (
        <div className="fixed top-16 left-1/2 -translate-x-1/2 z-40 bg-destructive/90 backdrop-blur-sm rounded-full px-3 py-1 flex items-center gap-2 text-xs font-cairo text-destructive-foreground shadow-md">
          <span>تعذر التحميل</span>
          <button onClick={onRetryOlder} className="flex items-center gap-1 underline">
            <RefreshCw className="w-3 h-3" />
            إعادة
          </button>
        </div>
      )}

      {/* Scroll-to-top quick button (shown when scrolled to bottom area) */}
      {showJumpToTop && (
        <button
          onClick={onJumpToTop}
          aria-label="إلى الأعلى"
          className="fixed bottom-52 right-3 z-40 bg-card/90 backdrop-blur-sm border border-border text-foreground rounded-full w-10 h-10 flex items-center justify-center shadow-md active:scale-95 transition-transform"
        >
          <ArrowUp className="w-4 h-4" />
        </button>
      )}

      {/* Scroll-to-bottom button (always available when not near bottom) */}
      {unreadCount === 0 && !showJumpToTop && onJumpToBottom && (
        <button
          onClick={onJumpToBottom}
          aria-label="إلى الأسفل"
          className="fixed bottom-40 right-3 z-40 bg-card/90 backdrop-blur-sm border border-border text-foreground rounded-full w-10 h-10 flex items-center justify-center shadow-md active:scale-95 transition-transform"
        >
          <ArrowDown className="w-4 h-4" />
        </button>
      )}

      {unreadCount > 0 && (
        <button
          onClick={onJumpToBottom}
          className="fixed bottom-40 left-1/2 -translate-x-1/2 z-40 bg-primary text-primary-foreground rounded-full pl-2 pr-3 py-1.5 flex items-center gap-1.5 text-xs font-cairo font-bold shadow-lg animate-in fade-in slide-in-from-bottom-2 active:scale-95 transition-transform"
        >
          <ArrowDown className="w-3.5 h-3.5" />
          {unreadCount} رسالة جديدة
        </button>
      )}
    </>
  );
};

export default ChatScrollHelpers;
