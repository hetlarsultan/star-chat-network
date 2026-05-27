import { Send, X } from "lucide-react";
import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import EmojiPicker from "./EmojiPicker";
import { supabase } from "@/integrations/supabase/client";

interface ReplyTo {
  username: string;
  text: string;
}

interface Props {
  onSend: (text: string, replyTo?: ReplyTo) => void;
  
  replyTo?: ReplyTo | null;
  onCancelReply?: () => void;
  roomId?: string;
}

const ChatInput = ({ onSend, replyTo, onCancelReply, roomId }: Props) => {
  const [text, setText] = useState("");
  const navigate = useNavigate();
  const { user } = useAuth();

  const isGuest = user?.email?.includes("@globalchat.app");

  const handleSend = () => {
    if (text.trim()) {
      onSend(text.trim(), replyTo || undefined);
      setText("");
      onCancelReply?.();
    }
  };


  return (
    <div className="fixed bottom-14 left-0 right-0 glass-panel border-t border-border px-3 py-2 z-40">
      {isGuest && (
        <button
          onClick={() => navigate("/upgrade")}
          className="w-full bg-accent text-accent-foreground text-sm font-cairo font-bold py-2 rounded-lg mb-2 hover:bg-accent/90 transition-colors"
        >
          💚 أكمل الاشتراك بالضغط هنا
        </button>
      )}

      {replyTo && (
        <div className="flex items-center gap-2 bg-muted/50 border-r-2 border-primary rounded px-3 py-1.5 mb-2">
          <div className="flex-1 min-w-0">
            <span className="text-xs font-bold text-primary">رد على {replyTo.username}</span>
            <p className="text-xs text-muted-foreground truncate">{replyTo.text}</p>
          </div>
          <button onClick={onCancelReply} className="text-muted-foreground hover:text-foreground flex-shrink-0">
            <X className="w-4 h-4" />
          </button>
        </div>
      )}
      
      <div className="flex items-center gap-2">
        <button
          onClick={handleSend}
          className="w-10 h-10 rounded-full bg-secondary flex items-center justify-center text-secondary-foreground hover:bg-secondary/80 transition-colors flex-shrink-0"
        >
          <Send className="w-5 h-5" />
        </button>
        <input
          type="text"
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && handleSend()}
          placeholder="اكتب هنا..."
          className="flex-1 bg-muted border border-border rounded-full px-4 py-2 text-sm font-cairo text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary/50"
          dir="rtl"
        />
        <EmojiPicker onSelect={(emoji) => setText(prev => prev + emoji)} />
      </div>
    </div>
  );
};

export default ChatInput;
