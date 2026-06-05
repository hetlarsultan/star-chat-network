import { useEffect, useState, useRef, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import BottomNav from "@/components/BottomNav";
import TopToolbar from "@/components/TopToolbar";
import ChatMessageRow from "@/components/ChatMessageRow";
import ChatInput from "@/components/ChatInput";
import WelcomeBanner from "@/components/WelcomeBanner";
import UserProfileModal from "@/components/UserProfileModal";
import ChatScrollHelpers from "@/components/ChatScrollHelpers";
import { supabase } from "@/integrations/supabase/client";
import { Tables } from "@/integrations/supabase/types";
import { useAuth } from "@/contexts/AuthContext";
import { useOlderMessages, type MessageWithProfile } from "@/hooks/useOlderMessages";
import { useRealtimeResync } from "@/hooks/useRealtimeResync";

const PUBLIC_ROOM_ID = "c4e3b9ac-aa54-4eb7-b992-d1e22e0fc74a";
const INITIAL_PAGE = 30;

const Rooms = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [messages, setMessages] = useState<MessageWithProfile[]>([]);
  const [selectedUser, setSelectedUser] = useState<Tables<"profiles"> | null>(null);
  const profilesCacheRef = useRef<Record<string, Tables<"profiles">>>({});
  const scrollRef = useRef<HTMLDivElement>(null);

  const fetchProfile = useCallback(async (userId: string): Promise<Tables<"profiles"> | null> => {
    if (profilesCacheRef.current[userId]) return profilesCacheRef.current[userId];
    const { data } = await supabase.from("profiles").select("*").eq("user_id", userId).maybeSingle();
    if (data) profilesCacheRef.current[userId] = data;
    return data;
  }, []);

  const lastSyncRef = useRef<string | null>(null);

  const mergeIncoming = useCallback((incoming: MessageWithProfile[]) => {
    if (!incoming.length) return;
    setMessages(prev => {
      const existing = new Set(prev.map(m => m.id));
      const fresh = incoming.filter(m => !existing.has(m.id));
      if (!fresh.length) return prev;
      const merged = [...prev, ...fresh].sort((a, b) => {
        const t = a.created_at.localeCompare(b.created_at);
        return t !== 0 ? t : a.id.localeCompare(b.id);
      });
      return merged;
    });
    const latest = incoming[incoming.length - 1]?.created_at;
    if (latest && (!lastSyncRef.current || latest > lastSyncRef.current)) {
      lastSyncRef.current = latest;
    }
  }, []);

  const fetchSince = useCallback(async (since: string) => {
    const { data } = await supabase.from("messages").select("*")
      .eq("room_id", PUBLIC_ROOM_ID).gt("created_at", since)
      .order("created_at", { ascending: true }).limit(200);
    if (!data?.length) return;
    const missing = [...new Set(data.map(m => m.user_id))].filter(id => !profilesCacheRef.current[id]);
    if (missing.length) {
      const { data: profs } = await supabase.from("profiles").select("*").in("user_id", missing);
      profs?.forEach(p => { profilesCacheRef.current[p.user_id] = p; });
    }
    mergeIncoming(data.map(m => ({ ...m, profile: profilesCacheRef.current[m.user_id] || null })));
  }, [mergeIncoming]);

  useEffect(() => {
    const fetchMessages = async () => {
      await supabase.rpc("cleanup_old_messages" as any);
      const { data } = await supabase.from("messages").select("*").eq("room_id", PUBLIC_ROOM_ID)
        .order("created_at", { ascending: false }).limit(INITIAL_PAGE);
      if (!data) return;
      const ordered = [...data].reverse();
      const userIds = [...new Set(ordered.map(m => m.user_id))];
      const { data: profiles } = await supabase.from("profiles").select("*").in("user_id", userIds);
      const profileMap: Record<string, Tables<"profiles">> = {};
      profiles?.forEach(p => { profileMap[p.user_id] = p; });
      profilesCacheRef.current = { ...profilesCacheRef.current, ...profileMap };
      setMessages(ordered.map(m => ({ ...m, profile: profileMap[m.user_id] || null })));
      lastSyncRef.current = ordered[ordered.length - 1]?.created_at || new Date().toISOString();
    };
    fetchMessages();

    const channel = supabase
      .channel(`room-public`)
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "messages", filter: `room_id=eq.${PUBLIC_ROOM_ID}` },
        async (payload) => {
          const msg = payload.new as Tables<"messages">;
          const profile = await fetchProfile(msg.user_id);
          mergeIncoming([{ ...msg, profile }]);
        }
      ).subscribe((status) => {
        if (status === "SUBSCRIBED" && lastSyncRef.current) fetchSince(lastSyncRef.current);
      });

    return () => { supabase.removeChannel(channel); };
  }, [fetchProfile, mergeIncoming, fetchSince]);

  useRealtimeResync(() => { if (lastSyncRef.current) fetchSince(lastSyncRef.current); });

  const { onScroll: onScrollOlder, loading: loadingOlder, error: olderError, retry: retryOlder } =
    useOlderMessages(PUBLIC_ROOM_ID, scrollRef, messages, setMessages, profilesCacheRef);

  // Track whether the user is near the bottom; only auto-scroll when they are.
  const [isNearBottom, setIsNearBottom] = useState(true);
  const isNearBottomRef = useRef(true);
  const [unreadCount, setUnreadCount] = useState(0);

  const handleScroll = useCallback((e: React.UIEvent<HTMLDivElement>) => {
    const el = e.currentTarget;
    const near = el.scrollHeight - el.scrollTop - el.clientHeight < 120;
    isNearBottomRef.current = near;
    setIsNearBottom(near);
    if (near) setUnreadCount(0);
    onScrollOlder(e);
  }, [onScrollOlder]);

  const scrollToBottom = useCallback(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
    }
    setUnreadCount(0);
  }, []);

  const scrollToTop = useCallback(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTo({ top: 0, behavior: "smooth" });
    }
  }, []);

  // Auto-scroll only when a NEW message arrives at the end AND user is near bottom.
  const lastIdRef = useRef<string | null>(null);
  useEffect(() => {
    if (!scrollRef.current || messages.length === 0) return;
    const lastMsg = messages[messages.length - 1];
    const lastId = lastMsg.id;
    if (lastId === lastIdRef.current) return;
    const isInitial = lastIdRef.current === null;
    lastIdRef.current = lastId;

    if (isInitial || isNearBottomRef.current || lastMsg.user_id === user?.id) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    } else {
      setUnreadCount(c => c + 1);
    }
  }, [messages, user?.id]);

  const handleSend = async (text: string) => {
    if (!user) return;
    await supabase.from("messages").insert({ room_id: PUBLIC_ROOM_ID, user_id: user.id, text });
  };

  const handleAvatarClick = (profile: Tables<"profiles"> | null | undefined) => {
    if (profile && profile.user_id !== user?.id) setSelectedUser(profile);
  };

  return (
    <div className="min-h-screen bg-background flex flex-col">
      <TopToolbar roomName="الدردشة العامة" />

      <div ref={scrollRef} onScroll={handleScroll} className="flex-1 overflow-y-auto scrollbar-hide pb-36">
        <WelcomeBanner />
        <div className="mt-2">
          {messages.map(msg => (
            <ChatMessage key={msg.id}
              message={{
                id: msg.id,
                username: msg.profile?.username || "مجهول",
                text: msg.text,
                time: new Date(msg.created_at).toLocaleTimeString("ar-EG", { hour: "2-digit", minute: "2-digit" }),
                isOwn: msg.user_id === user?.id,
                level: msg.profile?.level || 1,
                country: msg.profile?.country || undefined,
                gender: msg.profile?.gender || undefined,
                avatarUrl: msg.profile?.avatar_url || null,
                nameColor: (msg.profile as any)?.name_color || null,
                isGuest: msg.profile?.username?.startsWith("زائر_") || false,
              }}
              onAvatarClick={() => handleAvatarClick(msg.profile)}
            />
          ))}
        </div>
      </div>
      <ChatScrollHelpers
        loadingOlder={loadingOlder}
        olderError={olderError}
        onRetryOlder={retryOlder}
        unreadCount={unreadCount}
        onJumpToBottom={scrollToBottom}
        onJumpToTop={scrollToTop}
        showJumpToTop={isNearBottom}
      />
      <ChatInput onSend={handleSend} />
      <BottomNav />
      {selectedUser && <UserProfileModal profile={selectedUser} onClose={() => setSelectedUser(null)} />}
    </div>
  );
};

export default Rooms;
