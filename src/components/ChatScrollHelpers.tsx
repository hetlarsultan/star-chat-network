import { ArrowDown, RefreshCw, Loader2 } from "lucide-react";

interface Props {
  loadingOlder?: boolean;
  olderError?: string | null;
  onRetryOlder?: () => void;
  unreadCount?: number;
  onJumpToBottom?: () => void;
}

/** Floating UI for chat: shows retry banner for failed older fetch and
 *  "new messages" pill when user is scrolled up and new messages arrive. */
const ChatScrollHelpers = ({
  loadingOlder,
  olderError,
  onRetryOlder,
  unreadCount = 0,
  onJumpToBottom,
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
      {unreadCount > 0 && (
        <button
          onClick={onJumpToBottom}
          className="fixed bottom-40 left-1/2 -translate-x-1/2 z-40 bg-primary text-primary-foreground rounded-full pl-2 pr-3 py-1.5 flex items-center gap-1.5 text-xs font-cairo font-bold shadow-lg animate-in fade-in slide-in-from-bottom-2"
        >
          <ArrowDown className="w-3.5 h-3.5" />
          {unreadCount} رسالة جديدة
        </button>
      )}
    </>
  );
};

export default ChatScrollHelpers;
