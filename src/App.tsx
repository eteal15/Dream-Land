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
  const [isOutsideTelegram, setIsOutsideTelegram] = React.useState(false);

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

  React.useEffect(() => {
    let attempts = 0;
    const maxAttempts = 15; // Wait up to 1.5 seconds for Telegram WebApp SDK loading

    const checkAndInitTelegram = () => {
      const tg = (window as any).Telegram?.WebApp;
      
      if (tg) {
        tg.ready();
        try {
          tg.expand();
        } catch (e) {
          console.warn("Could not expand telegram frame:", e);
        }
      }

      const tgUser = tg?.initDataUnsafe?.user;
      if (tgUser && tgUser.id) {
        console.log("Real Telegram Web App User found:", tgUser);
        const tgPayload = {
          id: tgUser.id,
          username: tgUser.username || `user_${tgUser.id}`,
          first_name: tgUser.first_name || tgUser.username || "እንግዳ (Guest)",
          photo_url: tgUser.photo_url || `https://api.dicebear.com/7.x/bottts/svg?seed=${tgUser.id}`,
        };
        bootstrapUser(tgPayload);
        return true;
      }
      return false;
    };

    // 1. Initial immediate check
    if (checkAndInitTelegram()) {
      return;
    }

    // 2. Poll the Telegram SDK status with short interval
    const timer = setInterval(() => {
      attempts++;
      const success = checkAndInitTelegram();
      if (success || attempts >= maxAttempts) {
        clearInterval(timer);
        
        // 3. Display strict environment hard block when running outside Telegram WebApp container
        if (!success) {
          setIsOutsideTelegram(true);
        }
      }
    }, 100);

    return () => clearInterval(timer);
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

  if (isOutsideTelegram) {
    return (
      <div className="min-h-screen bg-cosmic-bg text-gray-100 flex flex-col items-center justify-center p-6 relative font-sans text-center">
        <div className="aurora-gold -top-20 -left-20 opacity-30"></div>
        <div className="aurora-purple top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 opacity-20"></div>
        <div className="max-w-md w-full bg-cosmic-card/85 backdrop-blur-md border border-cosmic-border p-8 rounded-2xl shadow-xl space-y-6 animate-fadeIn relative z-10 font-sans">
          <div className="w-16 h-16 bg-amber-500/10 border border-amber-500/20 text-amber-500 rounded-full flex items-center justify-center mx-auto animate-pulse">
            <Moon className="w-8 h-8 font-sans" />
          </div>
          <div className="space-y-3 font-sans">
            <h2 className="text-xl font-bold text-gray-100 italic">የህልም መፍቻ (Dream Interpreter)</h2>
            <p className="text-sm text-amber-400 font-extrabold leading-relaxed">
              እባክዎን ይህንን አፕሊኬሽን በቴሌግራም ውስጥ ይክፈቱ!
            </p>
            <p className="text-xs text-gray-400 leading-relaxed pt-2">
              Please open this application inside your official Telegram client to start using the dream interpreter.
            </p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-cosmic-bg text-gray-100 flex flex-col relative font-sans">
      <div className="aurora-gold -top-20 -left-20 opacity-30"></div>
      <div className="aurora-purple top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 opacity-20"></div>

      {/* Main Content Viewer Viewport */}
      <main className="flex-1 overflow-y-auto pb-24 relative z-10 w-full">
        {loadingUser ? (
          <div className="h-[50vh] flex flex-col items-center justify-center space-y-3">
            <Compass className="w-10 h-10 text-amber-500 animate-spin" />
            <p className="text-xs text-gray-400 font-sans">አካውንት መረጃዎችን እያመሳሰልን ነው...</p>
          </div>
        ) : (
          <>
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
          </>
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
