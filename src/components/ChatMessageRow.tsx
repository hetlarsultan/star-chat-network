import { memo, useMemo } from "react";
import ChatMessage from "./ChatMessage";
import { Tables } from "@/integrations/supabase/types";

export interface RowMessage {
  id: string;
  text: string;
  created_at: string;
  user_id: string;
  reply_to_username?: string | null;
  reply_to_text?: string | null;
  profile?: Tables<"profiles"> | null;
}

interface Props {
  msg: RowMessage;
  currentUserId?: string;
  onAvatarClick: (profile: Tables<"profiles"> | null | undefined) => void;
  onUsernameClick?: (msg: RowMessage) => void;
}

/** Lightweight row wrapper: derives the view-model and stabilizes callbacks
 *  so the memoized ChatMessage only re-renders when its own data changes. */
const ChatMessageRow = ({ msg, currentUserId, onAvatarClick, onUsernameClick }: Props) => {
  const view = useMemo(
    () => ({
      id: msg.id,
      username: msg.profile?.username || "مجهول",
      text: msg.text,
      time: new Date(msg.created_at).toLocaleTimeString("ar-EG", {
        hour: "2-digit",
        minute: "2-digit",
      }),
      isOwn: msg.user_id === currentUserId,
      level: msg.profile?.level || 1,
      country: msg.profile?.country || undefined,
      gender: msg.profile?.gender || undefined,
      avatarUrl: msg.profile?.avatar_url || null,
      nameColor: (msg.profile as any)?.name_color || null,
      fontColor: (msg.profile as any)?.font_color || null,
      fontStyle: (msg.profile as any)?.font_style || null,
      isGuest: msg.profile?.username?.startsWith("زائر_") || false,
      replyToUsername: msg.reply_to_username || null,
      replyToText: msg.reply_to_text || null,
    }),
    [msg, currentUserId],
  );

  return (
    <ChatMessage
      message={view}
      onAvatarClick={() => onAvatarClick(msg.profile)}
      onUsernameClick={onUsernameClick ? () => onUsernameClick(msg) : undefined}
    />
  );
};

export default memo(ChatMessageRow, (prev, next) => {
  return (
    prev.msg === next.msg &&
    prev.currentUserId === next.currentUserId &&
    prev.onAvatarClick === next.onAvatarClick &&
    prev.onUsernameClick === next.onUsernameClick
  );
});
