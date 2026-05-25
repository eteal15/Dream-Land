import React from "react";
import { User, Dream } from "./lib/types";
import { authTelegram, getDreamHistory, getUserProfile } from "./lib/api";
import DreamInterpreter from "./components/DreamInterpreter";
import DreamHistory from "./components/DreamHistory";
import PaymentModal from "./components/PaymentModal";
import AdminPanel from "./components/AdminPanel";
import { Moon, BookOpen, Coins, ShieldCheck, Compass } from "lucide-react";

export default function App() {
  const [currentUser, setCurrentUser] = React.useState<User | null>(null);
  const [dreams, setDreams] = React.useState<Dream[]>([]);
  const [activeTab, setActiveTab] = React.useState<"interpret" | "history" | "payment" | "admin">("interpret");
  const [isTelegramWebview, setIsTelegramWebview] = React.useState<boolean>(true);

  // Initialize with real user and loading history cache per user ID
  const bootstrapUser = async (userPayload: {
    id: number;
    username: string;
    first_name: string;
    photo_url: string;
  }) => {
    const storageKey = `userHistory_${userPayload.id}`;
    const cachedData = localStorage.getItem(storageKey);
    if (cachedData) {
      try {
        const parsed = JSON.parse(cachedData);
        if (parsed.user) {
          setCurrentUser(parsed.user);
        }
        if (parsed.dreams) {
          setDreams(parsed.dreams);
        }
      } catch (err) {
        console.error("Failed to parse cached user history:", err);
      }
    }

    try {
      const res = await authTelegram(userPayload);
      if (res.success) {
        setCurrentUser(res.user);
        // Load dreams
        const dreamsRes = await getDreamHistory(res.user.telegram_id);
        setDreams(dreamsRes.dreams);

        // Update cache with latest server records
        localStorage.setItem(storageKey, JSON.stringify({
          user: res.user,
          dreams: dreamsRes.dreams
        }));
      }
    } catch (e) {
      console.error("Failed to bootstrap user:", e);
    }
  };

  // Perform automatic silent login check on mount if Telegram sdk is ready and available
  React.useEffect(() => {
    let tgActive = false;
    try {
      const tg = (window as any).Telegram?.WebApp;
      if (tg && tg.initData) {
        tgActive = true;
        tg.ready();
        try {
          tg.expand();
        } catch (e) {}
        
        const tgUser = tg?.initDataUnsafe?.user;
        if (tgUser && tgUser.id) {
          console.log("Real Telegram Web App User auto-detected:", tgUser);
          const tgPayload = {
            id: tgUser.id,
            username: tgUser.username || `user_${tgUser.id}`,
            first_name: tgUser.first_name || tgUser.username || "እንግዳ (Guest)",
            photo_url: tgUser.photo_url || `https://api.dicebear.com/7.x/bottts/svg?seed=${tgUser.id}`,
          };
          bootstrapUser(tgPayload);
          return;
        }
      }
    } catch (e) {
      console.warn("Silent WebApp load check warning:", e);
    }

    setIsTelegramWebview(tgActive);

    // If we fall through, there's no Telegram user (e.g. running outside Telegram).
    // Automatically bypass login as a guest to allow preview.
    let guestId = localStorage.getItem("demo_guest_id");
    
    const urlParams = new URLSearchParams(window.location.search);
    if (urlParams.get("admin") === "true") {
      guestId = import.meta.env.VITE_ADMIN_TELEGRAM_ID || "733830209";
      localStorage.setItem("demo_guest_id", guestId);
    }

    if (!guestId) {
      guestId = Math.floor(Math.random() * 100000000).toString();
      localStorage.setItem("demo_guest_id", guestId);
    }
    console.log("Demo auto-login bypass triggered outside Telegram client");
    const demoPayload = {
      id: Number(guestId),
      username: "guest_user",
      first_name: "እንግዳ (Guest)",
      photo_url: `https://api.dicebear.com/7.x/bottts/svg?seed=${guestId}`,
    };
    bootstrapUser(demoPayload);

  }, []);

  const syncUserSubscription = async () => {
    if (!currentUser) return;
    try {
      const res = await getUserProfile(currentUser.telegram_id);
      setCurrentUser(res.user);
      const dreamsRes = await getDreamHistory(currentUser.telegram_id);
      setDreams(dreamsRes.dreams);

      localStorage.setItem(`userHistory_${currentUser.telegram_id}`, JSON.stringify({
        user: res.user,
        dreams: dreamsRes.dreams
      }));
    } catch (e) {
      console.error("Failed to sync sub details:", e);
    }
  };

  const handleDreamInterpreted = (newDream: Dream, updatedUser: User) => {
    setDreams((prev) => {
      const updatedDreams = [newDream, ...prev];
      localStorage.setItem(`userHistory_${updatedUser.telegram_id}`, JSON.stringify({
        user: updatedUser,
        dreams: updatedDreams
      }));
      return updatedDreams;
    });
    setCurrentUser(updatedUser);
  };

  const adminIdFromEnv = import.meta.env.VITE_ADMIN_TELEGRAM_ID;
  const showAdminTab = !!(currentUser && adminIdFromEnv && Number(currentUser.telegram_id) === Number(adminIdFromEnv));

  const isPremiumActive = showAdminTab || !!(currentUser?.premium_until && new Date(currentUser.premium_until).getTime() > Date.now());

  React.useEffect(() => {
    if (activeTab === "admin" && !showAdminTab) {
      setActiveTab("interpret");
    }
  }, [showAdminTab, activeTab]);

  // 2. Main layout screen shown once verified/logged in!
  return (
    <div className="min-h-screen bg-cosmic-bg text-gray-100 flex flex-col relative font-sans">
      <div className="aurora-gold -top-20 -left-20 opacity-30"></div>
      <div className="aurora-purple top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 opacity-20"></div>

      {!isTelegramWebview && (
        <div className="bg-amber-500/10 border-b border-amber-500/20 px-4 py-2 text-center text-[11px] text-amber-400 font-medium z-50">
          እባክዎን መተግበሪያውን ሙሉ በሙሉ ለመጠቀም በቴሌግራም በኩል ይክፈቱት።
        </div>
      )}

      {/* Main Content Viewer Viewport */}
      <main className="flex-1 overflow-y-auto pb-24 relative z-10 w-full mt-2">
        {activeTab === "interpret" && (
          <DreamInterpreter 
            currentUser={currentUser}
            onDreamInterpreted={handleDreamInterpreted}
            onNavigateToPayment={() => setActiveTab("payment")}
          />
        )}

        {activeTab === "history" && currentUser && (
          <DreamHistory 
            currentUser={currentUser}
            dreams={dreams}
            onNavigateToInterpret={() => setActiveTab("interpret")}
          />
        )}

        {activeTab === "payment" && currentUser && (
          <PaymentModal 
            currentUser={currentUser}
            onPaymentSubmitted={syncUserSubscription}
          />
        )}

        {activeTab === "admin" && showAdminTab && currentUser && (
          <AdminPanel 
            currentUser={currentUser}
            onStateChanged={syncUserSubscription}
          />
        )}
      </main>

      {/* Beautiful, responsive bottom Navigation tabs styled like native Telegram Panel */}
      <footer className="fixed bottom-0 left-0 right-0 z-40 bg-cosmic-header/95 backdrop-blur-md border-t border-cosmic-border py-2 text-center shadow-2xl">
        <div className={`max-w-2xl mx-auto px-6 grid ${showAdminTab ? "grid-cols-4" : "grid-cols-3"} gap-1`}>
          
          <button
            onClick={() => setActiveTab("interpret")}
            className={`flex flex-col items-center justify-center py-1 transition-all ${
              activeTab === "interpret" ? "text-amber-400 font-bold scale-105" : "text-gray-400 hover:text-gray-200"
            }`}
          >
            <Moon className="w-5 h-5" />
            <span className="text-[10px] mt-1">ተርጉም (Interpret)</span>
          </button>

          <button
            onClick={() => setActiveTab("history")}
            className={`flex flex-col items-center justify-center py-1 transition-all ${
              activeTab === "history" ? "text-amber-400 font-bold scale-105" : "text-gray-400 hover:text-gray-200"
            }`}
          >
            <BookOpen className="w-5 h-5" />
            <span className="text-[10px] mt-1">ታሪክ (History)</span>
          </button>

          <button
            onClick={() => setActiveTab("payment")}
            className={`flex flex-col items-center justify-center py-1 transition-all relative ${
              activeTab === "payment" ? "text-amber-400 font-bold scale-105" : "text-gray-400 hover:text-gray-200"
            }`}
          >
            <Coins className="w-5 h-5" />
            <span className="text-[10px] mt-1">ክፍያ (Plans)</span>
            {!isPremiumActive && currentUser?.free_trial_used && (
              <span className="absolute top-1.5 right-6 w-2 h-2 bg-amber-500 rounded-full animate-ping" />
            )}
          </button>

          {showAdminTab && (
            <button
              onClick={() => setActiveTab("admin")}
              className={`flex flex-col items-center justify-center py-1 transition-all ${
                activeTab === "admin" ? "text-amber-400 font-bold scale-105" : "text-gray-500 hover:text-gray-300"
              }`}
            >
              <ShieldCheck className="w-5 h-5" />
              <span className="text-[10px] mt-1">አስተዳዳሪ (Admin)</span>
            </button>
          )}

        </div>
      </footer>
    </div>
  );
}
