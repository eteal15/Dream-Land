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
  const [loginWarning, setLoginWarning] = React.useState<string | null>(null);

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
  React.useEffect(() => {
    try {
      const tg = (window as any).Telegram?.WebApp;
      if (tg) {
        tg.ready();
        tg.expand();
        
        const tgUser = tg?.initDataUnsafe?.user;
        if (tgUser && tgUser.id) {
          console.log("Real Telegram Web App User auto-detected on mount:", tgUser);
          const tgPayload = {
            id: tgUser.id,
            username: tgUser.username || `user_${tgUser.id}`,
            first_name: tgUser.first_name || tgUser.username || "እንግዳ (Guest)",
            photo_url: tgUser.photo_url || `https://api.dicebear.com/7.x/bottts/svg?seed=${tgUser.id}`,
          };
          bootstrapUser(tgPayload);
        }
      }
    } catch (e) {
      console.warn("Silent WebApp load check warning:", e);
    }
  }, []);

  const handleTelegramLogin = () => {
    setLoginWarning(null);
    const tg = (window as any).Telegram?.WebApp;
    
    if (tg) {
      try {
        tg.ready();
        tg.expand();
      } catch (e) {
        console.warn("Could not expand Telegram frame:", e);
      }
    }

    const tgUser = tg?.initDataUnsafe?.user;
    if (tgUser && tgUser.id) {
      console.log("Real Telegram Web App User found on button click:", tgUser);
      const tgPayload = {
        id: tgUser.id,
        username: tgUser.username || `user_${tgUser.id}`,
        first_name: tgUser.first_name || tgUser.username || "እንግዳ (Guest)",
        photo_url: tgUser.photo_url || `https://api.dicebear.com/7.x/bottts/svg?seed=${tgUser.id}`,
      };
      bootstrapUser(tgPayload);
    } else {
      console.warn("User data not found in Telegram WebApp context.");
      setLoginWarning("እባክዎን ይህንን አፕሊኬሽን በቴሌግራም ውስጥ ይክፈቱ!");
    }
  };

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

  // If loading user backend data
  if (loadingUser) {
    return (
      <div className="min-h-screen bg-cosmic-bg text-gray-100 flex flex-col items-center justify-center space-y-4 font-sans text-center relative">
        <div className="aurora-gold -top-20 -left-20 opacity-30"></div>
        <div className="aurora-purple top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 opacity-20"></div>
        <div className="relative z-10 flex flex-col items-center gap-3">
          <Compass className="w-12 h-12 text-amber-500 animate-spin" />
          <p className="text-xs text-gray-400 font-sans">አካውንት መረጃዎችን እያመሳሰልን ነው...</p>
        </div>
      </div>
    );
  }

  // 1. If not logged in & no current user loaded, render the "Login with Telegram" Welcome layout!
  if (!currentUser) {
    return (
      <div className="min-h-screen bg-cosmic-bg text-gray-100 flex flex-col justify-between p-6 relative overflow-hidden font-sans">
        <div className="aurora-gold -top-20 -left-20 opacity-30 animate-pulse"></div>
        <div className="aurora-purple top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 opacity-20"></div>

        <div className="flex-1 flex flex-col justify-center items-center max-w-md w-full mx-auto space-y-8 z-10 animate-fadeIn text-center py-10">
          <div className="inline-flex p-5 rounded-full bg-amber-500/10 text-amber-500 border border-amber-500/20 shadow-xl shadow-amber-500/5 animate-pulse">
            <Moon className="w-12 h-12" />
          </div>

          <div className="space-y-3 font-sans">
            <h1 className="text-4xl font-extrabold tracking-tight text-white font-display bg-clip-text text-transparent bg-gradient-to-r from-amber-400 via-yellow-200 to-white">
              Helm / ህልም
            </h1>
            <p className="text-xs text-amber-500 font-bold uppercase tracking-wider">
              የህልም መፍቻ (AI Dream Interpreter)
            </p>
            <p className="text-xs text-gray-300 leading-relaxed max-w-sm mx-auto">
              የታየውን ህልም በአማርኛ በመጻፍ መንፈሳዊ፣ ስነ-ልቦናዊ እና ምልክታዊ የሆኑ ጥልቅ ትርጓሜዎችን በጥበብ ከተሞላው የዮሴፍ አርቲፊሻል ኢንተለጀንስ ያግኙ።
            </p>
          </div>

          <div className="w-full space-y-4">
            <button
              id="login-telegram-btn"
              onClick={handleTelegramLogin}
              className="w-full bg-gradient-to-r from-amber-400 to-amber-600 hover:from-amber-500 hover:to-amber-700 text-black font-extrabold py-4 px-8 rounded-2xl text-xs tracking-wider uppercase shadow-lg shadow-amber-500/15 cursor-pointer transform active:scale-95 transition-all text-center flex items-center justify-center gap-2"
            >
              <Moon className="w-4 h-4 fill-black text-black" />
              በቴሌግራም ይግቡ (Login with Telegram)
            </button>

            {loginWarning && (
              <div className="bg-amber-500/10 border border-amber-500/20 p-4 rounded-xl text-center select-none animate-fadeIn max-w-sm mx-auto">
                <p className="text-xs text-amber-400 font-bold leading-relaxed">
                  ⚠️ {loginWarning}
                </p>
                <div className="text-[10px] text-gray-400 mt-1 leading-relaxed">
                  Please open this application inside your official Telegram client to proceed.
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Footer copyright */}
        <div className="text-[10px] text-gray-500 z-10 text-center font-mono">
          © {new Date().getFullYear()} XML Labs. Tailored Spiritual Guidance for Ethiopian Users inside Telegram.
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
