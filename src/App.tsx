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
  const [loadingUser, setLoadingUser] = React.useState(false);
  const [initError, setInitError] = React.useState<boolean>(false);

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

    if (!cachedData) {
      setLoadingUser(true);
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
    } finally {
      setLoadingUser(false);
    }
  };

  // Perform automatic silent login check on mount if Telegram sdk is ready and available
  const startInitSequence = React.useCallback(() => {
    setInitError(false);
    let attempts = 0;
    const maxAttempts = 50; // Wait up to 5 seconds (50 * 100ms)

    const checkAndInitTelegram = () => {
      try {
        const tg = (window as any).Telegram?.WebApp;
        if (tg && tg.initData) {
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
            return true;
          }
        }
      } catch (e) {
        console.warn("Silent WebApp load check warning:", e);
      }
      return false;
    };

    if (checkAndInitTelegram()) {
      return;
    }

    const timer = setInterval(() => {
      attempts++;
      const success = checkAndInitTelegram();
      
      if (success) {
        clearInterval(timer);
      } else if (attempts >= maxAttempts) {
        clearInterval(timer);
        
        // If we fall through, there's no Telegram user (e.g. running outside Telegram).
        // Check if we are outside telegram (normal browser)
        const inIframe = window.self !== window.top;
        const tgActive = !!(window as any).Telegram?.WebApp?.initData;
        
        if (!tgActive && (window.location.hostname === "localhost" || !inIframe || window.location.href.includes("ais-") || window.location.href.includes("vercel.app"))) {
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
        } else {
          // Timeout occurred and likely inside telegram but init failed
          setInitError(true);
        }
      }
    }, 100);

    return () => clearInterval(timer);
  }, []);

  React.useEffect(() => {
    return startInitSequence();
  }, [startInitSequence]);

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

  // If loading user backend data or auto-logging in sequence
  if (loadingUser || (!currentUser && !initError)) {
    return (
      <div className="min-h-screen bg-cosmic-bg text-gray-100 flex flex-col items-center justify-center space-y-4 font-sans text-center relative">
        <div className="aurora-gold -top-20 -left-20 opacity-30 animate-pulse"></div>
        <div className="aurora-purple top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 opacity-20"></div>
        <div className="relative z-10 flex flex-col items-center gap-4 animate-fadeIn">
          <div className="inline-flex p-4 rounded-full bg-amber-500/10 text-amber-500 border border-amber-500/20 shadow-xl shadow-amber-500/5 mb-2 animate-pulse">
            <Moon className="w-10 h-10" />
          </div>
          <Compass className="w-8 h-8 text-amber-500 animate-spin" />
          <p className="text-xs text-gray-400 font-sans tracking-wide">ወደ ህልም መፍቻ እየገባን ነው...</p>
        </div>
      </div>
    );
  }

  // Handle Timeout / Init Failure in Telegram
  if (initError && !currentUser) {
    return (
      <div className="min-h-screen bg-cosmic-bg text-gray-100 flex flex-col items-center justify-center space-y-4 font-sans text-center relative p-6">
        <div className="aurora-gold -top-20 -left-20 opacity-30"></div>
        <div className="aurora-purple top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 opacity-20"></div>
        <div className="relative z-10 flex flex-col items-center gap-6 animate-fadeIn max-w-sm">
          <div className="inline-flex p-4 rounded-full bg-red-500/10 text-red-500 border border-red-500/20 shadow-xl shadow-red-500/5 mb-2">
            <Moon className="w-10 h-10" />
          </div>
          <div>
            <h2 className="text-xl font-bold text-white mb-2">ግንኙነት አልተሳካም</h2>
            <p className="text-sm text-red-400 font-sans leading-relaxed">
              የቴሌግራም መረጃ መጫን አልቻለም። እባክዎ ቦቱን እንደገና ያስጀምሩት።
            </p>
            <p className="text-[10px] text-gray-500 mt-2 font-mono">
              (Could not load Telegram data. Please restart the bot.)
            </p>
          </div>
          <button
            onClick={startInitSequence}
            className="w-full bg-gradient-to-r from-amber-400 to-amber-600 hover:from-amber-500 hover:to-amber-700 text-black font-extrabold py-3 px-8 rounded-xl text-xs tracking-wider shadow-lg shadow-amber-500/15 cursor-pointer transform active:scale-95 transition-all text-center"
          >
            እንደገና ሞክር (Try Again)
          </button>
        </div>
      </div>
    );
  }

  // 2. Main layout screen shown once verified/logged in!
  return (
    <div className="min-h-screen bg-cosmic-bg text-gray-100 flex flex-col relative font-sans">
      <div className="aurora-gold -top-20 -left-20 opacity-30"></div>
      <div className="aurora-purple top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 opacity-20"></div>

      {/* Main Content Viewer Viewport */}
      <main className="flex-1 overflow-y-auto pb-24 relative z-10 w-full mt-2">
        {activeTab === "interpret" && (
          <DreamInterpreter 
            currentUser={currentUser}
            onDreamInterpreted={handleDreamInterpreted}
            onNavigateToPayment={() => setActiveTab("payment")}
          />
        )}

        {activeTab === "history" && (
          <DreamHistory 
            currentUser={currentUser!}
            dreams={dreams}
            onNavigateToInterpret={() => setActiveTab("interpret")}
          />
        )}

        {activeTab === "payment" && (
          <PaymentModal 
            currentUser={currentUser}
            onPaymentSubmitted={syncUserSubscription}
          />
        )}

        {activeTab === "admin" && showAdminTab && (
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
