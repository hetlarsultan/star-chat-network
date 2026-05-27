import { Reply, AlertCircle } from "lucide-react";
import VoicePlayer from "./VoicePlayer";

const FONT_FAMILY_MAP: Record<string, string> = {
  "": "Cairo, sans-serif",
  "serif": "Georgia, 'Times New Roman', serif",
  "mono": "'Courier New', Consolas, monospace",
  "cursive": "'Segoe Script', cursive",
  "sans": "system-ui, -apple-system, sans-serif",
};

interface MessageData {
  id: string;
  username: string;
  text: string;
  time: string;
  isOwn: boolean;
  level: number;
  country?: string;
  gender?: string;
  avatarUrl?: string | null;
  nameColor?: string | null;
  fontColor?: string | null;
  fontStyle?: string | null;
  isGuest?: boolean;
  replyToUsername?: string | null;
  replyToText?: string | null;
  voiceUrl?: string | null;
}

interface Props {
  message: MessageData;
  onAvatarClick?: () => void;
  onUsernameClick?: () => void;
}

const ChatMessage = ({ message, onAvatarClick, onUsernameClick }: Props) => {
  const fontFamily = FONT_FAMILY_MAP[message.fontStyle || ""] || "Cairo, sans-serif";

  return (
    <div
      className={`animate-slide-up border-b border-border/50 px-2.5 py-2 ${
        message.isOwn ? "bg-card/60" : "bg-background"
      }`}
    >
      <div className="flex items-start gap-2">
        {!message.isOwn && (
          <div className="flex flex-col gap-0.5 mt-1 opacity-40 hover:opacity-100 transition-opacity">
            <button onClick={onUsernameClick} className="text-muted-foreground hover:text-foreground" title="رد">
              <Reply className="w-3.5 h-3.5" />
            </button>
            <button className="text-muted-foreground hover:text-foreground">
              <AlertCircle className="w-3.5 h-3.5" />
            </button>
          </div>
        )}

        <div className="flex-1 min-w-0">
          {message.replyToUsername && (
            <div className="bg-muted/50 border-r-2 border-primary rounded px-2 py-1 mb-1.5 text-[11px]">
              <span className="font-bold text-primary">{message.replyToUsername}</span>
              <p className="text-muted-foreground truncate mt-0.5">{message.replyToText}</p>
            </div>
          )}

          <div className="flex items-center gap-1.5 mb-0.5">
            <button onClick={onAvatarClick} className="w-5 h-5 rounded-full bg-muted border border-border flex items-center justify-center overflow-hidden flex-shrink-0">
              {message.avatarUrl ? (
                <img src={message.avatarUrl} alt="" className="w-full h-full object-cover" />
              ) : (
                <span className="text-[10px]">👤</span>
              )}
            </button>
            <button
              onClick={onUsernameClick}
              className="text-xs font-bold hover:underline"
              style={{
                color: message.nameColor || (message.isOwn ? "hsl(var(--primary))" : message.gender === "female" ? "hsl(var(--primary))" : "hsl(var(--foreground))"),
                fontFamily,
              }}
            >
              {message.username}
            </button>
            <span className={`text-[8px] font-cairo font-bold px-1 py-0.5 rounded-full ${
              message.isGuest
                ? "bg-muted text-muted-foreground"
                : "bg-accent/20 text-accent"
            }`}>
              {message.isGuest ? "زائر" : "عضو"}
            </span>
            {message.country && <span className="text-xs">{message.country}</span>}
            {message.gender && (
              <span className="text-[9px] text-muted-foreground">
                {message.gender === "male" ? "♂" : "♀"}
              </span>
            )}
          </div>

          {message.voiceUrl ? (
            <VoicePlayer voiceUrl={message.voiceUrl} />
          ) : (
            <p
              className="text-xs leading-relaxed"
              style={{
                color: message.fontColor || undefined,
                fontFamily,
              }}
            >
              {message.text}
            </p>
          )}
        </div>

        <button onClick={onAvatarClick} className="flex flex-col items-center gap-0.5">
          <div className={`w-9 h-9 rounded-full bg-muted border-2 ${message.gender === "female" ? "border-primary" : "border-accent"} flex items-center justify-center overflow-hidden`}>
            {message.avatarUrl ? (
              <img src={message.avatarUrl} alt="" className="w-full h-full object-cover" />
            ) : (
              <span className="text-sm">👤</span>
            )}
          </div>
          <span className="text-[8px] font-space font-bold text-accent bg-accent/20 px-1.5 py-0.5 rounded-full">
            {message.level}
          </span>
        </button>
      </div>

      <div className="flex justify-end mt-0.5">
        <span className={`text-[9px] font-space ${message.isOwn ? "text-foreground" : "text-muted-foreground"}`}>
          {message.time}
        </span>
      </div>
    </div>
  );
};

export default ChatMessage;
