import { useEffect, useRef } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";

const PUBLIC_ROOM_ID = "c4e3b9ac-aa54-4eb7-b992-d1e22e0fc74a";
const NOTIFICATION_SOUND_URL = "https://cdn.pixabay.com/audio/2022/12/12/audio_e7e6b1e040.mp3";
const THROTTLE_MS = 15000;

/**
 * Global listener for new room messages. Shows a toast notification when the
 * user is not actively viewing the relevant room (different route or hidden tab),
 * with a quick action to jump straight to that room.
 */
export const useRoomMessageNotifications = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const locationRef = useRef(location);
  locationRef.current = location;

  const audioRef = useRef<HTMLAudioElement | null>(null);
  const profileCacheRef = useRef<Record<string, string>>({});
  const roomCacheRef = useRef<Record<string, string>>({});
  const lastNotifiedRef = useRef<Record<string, number>>({});

  useEffect(() => {
    audioRef.current = new Audio(NOTIFICATION_SOUND_URL);
    audioRef.current.volume = 0.4;
  }, []);

  useEffect(() => {
    if (!user) return;

    const channel = supabase
      .channel("global-room-msg-notify")
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "messages" },
        async (payload) => {
          const msg = payload.new as any;
          if (!msg?.room_id || msg.user_id === user.id) return;

          // Determine the route for this room
          const targetPath = msg.room_id === PUBLIC_ROOM_ID ? "/rooms" : `/chat/${msg.room_id}`;
          const path = locationRef.current.pathname;
          const isViewingRoom = path === targetPath;
          const tabVisible = document.visibilityState === "visible";

          // Skip if user is actively looking at this room
          if (isViewingRoom && tabVisible) return;

          // Throttle per-room
          const now = Date.now();
          const last = lastNotifiedRef.current[msg.room_id] || 0;
          if (now - last < THROTTLE_MS) return;
          lastNotifiedRef.current[msg.room_id] = now;

          // Resolve sender name
          let senderName = profileCacheRef.current[msg.user_id];
          if (!senderName) {
            const { data } = await supabase
              .from("profiles").select("username")
              .eq("user_id", msg.user_id).maybeSingle();
            senderName = data?.username || "مجهول";
            profileCacheRef.current[msg.user_id] = senderName;
          }

          // Resolve room name
          let roomName = roomCacheRef.current[msg.room_id];
          if (!roomName) {
            if (msg.room_id === PUBLIC_ROOM_ID) {
              roomName = "الدردشة العامة";
            } else {
              const { data } = await supabase
                .from("rooms").select("name")
                .eq("id", msg.room_id).maybeSingle();
              roomName = data?.name || "غرفة";
            }
            roomCacheRef.current[msg.room_id] = roomName;
          }

          audioRef.current?.play().catch(() => {});

          const preview = msg.text?.length > 40 ? msg.text.slice(0, 40) + "..." : msg.text;
          toast(`💬 ${roomName} · ${senderName}`, {
            description: preview,
            duration: 5000,
            action: {
              label: "الذهاب للغرفة",
              onClick: () => navigate(targetPath),
            },
          });
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [user, navigate]);
};
