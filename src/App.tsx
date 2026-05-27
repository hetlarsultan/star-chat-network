import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Route, Routes } from "react-router-dom";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { AuthProvider } from "@/contexts/AuthContext";
import { useNotificationSound } from "@/hooks/useNotificationSound";
import Landing from "./pages/Landing";
import Auth from "./pages/Auth";
import GuestRegister from "./pages/GuestRegister";
import ChatRoom from "./pages/ChatRoom";
import Rooms from "./pages/Rooms";
import Profile from "./pages/Profile";
import UserProfile from "./pages/UserProfile";
import MenuPage from "./pages/MenuPage";
import OnlineUsers from "./pages/OnlineUsers";
import SoundSettings from "./pages/SoundSettings";
import PrivateMessages from "./pages/PrivateMessages";
import PrivateChat from "./pages/PrivateChat";
import Notifications from "./pages/Notifications";
import FontSettings from "./pages/FontSettings";
import SearchUsers from "./pages/SearchUsers";
import Likes from "./pages/Likes";
import Levels from "./pages/Levels";
import Gifts from "./pages/Gifts";
import EditProfile from "./pages/EditProfile";
import UpgradeAccount from "./pages/UpgradeAccount";
import Friends from "./pages/Friends";
import RoomsList from "./pages/RoomsList";
import AdminPanel from "./pages/AdminPanel";
import NotFound from "./pages/NotFound";

const queryClient = new QueryClient();

const NotificationListener = () => {
  useNotificationSound();
  return null;
};

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter>
        <AuthProvider>
          <NotificationListener />
          <Routes>
            <Route path="/" element={<Landing />} />
            <Route path="/auth" element={<Auth />} />
            <Route path="/guest-register" element={<GuestRegister />} />
            <Route path="/chat/:roomId" element={<ChatRoom />} />
            <Route path="/rooms" element={<Rooms />} />
            <Route path="/profile" element={<Profile />} />
            <Route path="/edit-profile" element={<EditProfile />} />
            <Route path="/user/:userId" element={<UserProfile />} />
            <Route path="/menu" element={<MenuPage />} />
            <Route path="/online" element={<OnlineUsers />} />
            <Route path="/sound" element={<SoundSettings />} />
            <Route path="/private" element={<PrivateMessages />} />
            <Route path="/private/:userId" element={<PrivateChat />} />
            <Route path="/notifications" element={<Notifications />} />
            <Route path="/font" element={<FontSettings />} />
            <Route path="/search" element={<SearchUsers />} />
            <Route path="/likes" element={<Likes />} />
            <Route path="/levels" element={<Levels />} />
            <Route path="/gifts" element={<Gifts />} />
            <Route path="/upgrade" element={<UpgradeAccount />} />
            <Route path="/friends" element={<Friends />} />
            <Route path="/rooms-list" element={<RoomsList />} />
            <Route path="/admin" element={<AdminPanel />} />
            <Route path="*" element={<NotFound />} />
          </Routes>
        </AuthProvider>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
