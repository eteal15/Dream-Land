import React from "react";
import { User, Payment, Analytics } from "../lib/types";
import { 
  adminLogin, 
  getAdminAnalytics, 
  getAdminUsers, 
  getAdminPayments, 
  processAdminAction,
  getBotNotifications
} from "../lib/api";
import { 
  ShieldAlert, 
  Database, 
  Users, 
  TrendingUp, 
  CheckCircle, 
  XCircle, 
  Image, 
  Smartphone, 
  Lock, 
  UserCheck, 
  Clock, 
  CreditCard, 
  LogOut,
  BellRing
} from "lucide-react";

interface AdminPanelProps {
  currentUser: User | null;
  onStateChanged: () => void;
}

export default function AdminPanel({ currentUser, onStateChanged }: AdminPanelProps) {
  const [isLoggedIn, setIsLoggedIn] = React.useState(false);
  const [token, setToken] = React.useState<string>("");
  const [username, setUsername] = React.useState("");
  const [password, setPassword] = React.useState("");
  const [loginError, setLoginError] = React.useState<string | null>(null);

  const [analytics, setAnalytics] = React.useState<Analytics | null>(null);
  const [users, setUsers] = React.useState<User[]>([]);
  const [payments, setPayments] = React.useState<Payment[]>([]);
  const [botNotifs, setBotNotifs] = React.useState<any[]>([]);
  
  const [selectedScreenshot, setSelectedScreenshot] = React.useState<string | null>(null);
  const [activeTab, setActiveTab] = React.useState<"payments" | "users" | "bot">("payments");
  const [loadingActionId, setLoadingActionId] = React.useState<string | null>(null);

  const [activeAlerts, setActiveAlerts] = React.useState<{ id: string; msg: string; username: string; amount: number }[]>([]);
  const prevPendingCount = React.useRef<number | null>(null);

  const [botTokenInput, setBotTokenInput] = React.useState("");
  const [chatIdInput, setChatIdInput] = React.useState("");
  const [botSaveMsg, setBotSaveMsg] = React.useState("");

  const handleSaveBotConfig = async () => {
    try {
      const res = await fetch("/api/admin/bot-config", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: token },
        body: JSON.stringify({ bot_token: botTokenInput, admin_chat_id: chatIdInput })
      });
      if (res.ok) {
        setBotSaveMsg("Bot API Key Saved successfully!");
        setTimeout(() => setBotSaveMsg(""), 3000);
      }
    } catch (e) {
      console.error(e);
      setBotSaveMsg("Error saving bot config.");
      setTimeout(() => setBotSaveMsg(""), 3000);
    }
  };

  const playNotificationSound = () => {
    try {
      const audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)();
      const playNote = (freq: number, startTime: number, duration: number) => {
        const osc = audioCtx.createOscillator();
        const gainNode = audioCtx.createGain();
        osc.type = "sine";
        osc.frequency.setValueAtTime(freq, startTime);
        gainNode.gain.setValueAtTime(0.15, startTime);
        gainNode.gain.exponentialRampToValueAtTime(0.001, startTime + duration);
        osc.connect(gainNode);
        gainNode.connect(audioCtx.destination);
        osc.start(startTime);
        osc.stop(startTime + duration);
      };
      const now = audioCtx.currentTime;
      playNote(523.25, now, 0.4);      // C5 note
      playNote(659.25, now + 0.12, 0.5); // E5 note
    } catch (e) {
      console.warn("Audio chime skipped (browser autoplay sandbox):", e);
    }
  };

  // Load token on load or auto-authorize if authenticated Telegram ID matches admin ID
  React.useEffect(() => {
    const adminIdFromEnv = import.meta.env.VITE_ADMIN_TELEGRAM_ID;
    const isAdminUser = !!(currentUser && adminIdFromEnv && Number(currentUser.telegram_id) === Number(adminIdFromEnv));
    if (isAdminUser) {
      setToken("admin-token-12345");
      setIsLoggedIn(true);
    } else {
      const savedToken = localStorage.getItem("admin_token");
      if (savedToken) {
        setToken(savedToken);
        setIsLoggedIn(true);
      }
    }
  }, [currentUser]);

  const loadData = async (adminToken: string) => {
    try {
      const authHeader = adminToken;
      const [analyticsRes, usersRes, paymentsRes, botRes, botConfigRes] = await Promise.all([
        getAdminAnalytics(authHeader),
        getAdminUsers(authHeader),
        getAdminPayments(authHeader),
        getBotNotifications(),
        fetch("/api/admin/bot-config", { headers: { Authorization: adminToken } }).then(res => res.json())
      ]);

      if (botConfigRes?.config) {
        setBotTokenInput(botConfigRes.config.bot_token || "");
        setChatIdInput(botConfigRes.config.admin_chat_id || "");
      }

      setAnalytics(analyticsRes.analytics);
      setUsers(usersRes.users);
      setPayments(paymentsRes.payments);
      setBotNotifs(botRes.notifications);

      // Extract pending payments
      const pendingPayments = paymentsRes.payments.filter((p: any) => p.status === "pending");
      const currentPendingCount = pendingPayments.length;

      // Detect if there's any new pending payment compared to previous checklist
      if (prevPendingCount.current !== null && currentPendingCount > prevPendingCount.current) {
        // Retrieve newly added payments (the last inserted items)
        const newlyAdded = pendingPayments.slice(0, currentPendingCount - prevPendingCount.current);
        newlyAdded.forEach((newPay: any) => {
          playNotificationSound();
          const alertId = "alert_" + Math.random().toString(36).substring(2, 9);
          const customAmharicMsg = `@${newPay.username} በቴሌብር ${newPay.amount} ብር የክፍያ ማረጋገጫ ልኳል።`;
          setActiveAlerts(prev => [...prev, { id: alertId, msg: customAmharicMsg, username: newPay.username, amount: newPay.amount }]);
          
          // Dismiss banner automatically after 8 seconds
          setTimeout(() => {
            setActiveAlerts(prev => prev.filter(a => a.id !== alertId));
          }, 8000);
        });
      }

      prevPendingCount.current = currentPendingCount;
    } catch (e) {
      console.error("Failed to load admin panel data:", e);
      // If unauthorized, logout
      handleLogout();
    }
  };

  React.useEffect(() => {
    if (isLoggedIn && token) {
      loadData(token);
      const interval = setInterval(() => loadData(token), 10000); // Auto-refresh logs
      return () => clearInterval(interval);
    }
  }, [isLoggedIn, token]);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoginError(null);
    try {
      const res = await adminLogin({ username, password });
      if (res.success) {
        localStorage.setItem("admin_token", res.token);
        setToken(res.token);
        setIsLoggedIn(true);
        // Clear forms
        setUsername("");
        setPassword("");
      }
    } catch (err: any) {
      setLoginError(err.message || "የተሳሳተ የአስተዳዳሪ ምስክር ወረቀት!");
    }
  };

  const handleLogout = () => {
    localStorage.removeItem("admin_token");
    setToken("");
    setIsLoggedIn(false);
    setAnalytics(null);
    setUsers([]);
    setPayments([]);
  };

  const handleAction = async (paymentId: string, action: "approve" | "reject") => {
    setLoadingActionId(paymentId);
    try {
      const response = await processAdminAction(token, paymentId, action);
      if (response.success) {
        await loadData(token);
        onStateChanged(); // Refresh active user state to propagate credit/unlimited gains
      }
    } catch (e: any) {
      alert("ስህተት፦ " + e.message);
    } finally {
      setLoadingActionId(null);
    }
  };

  if (!isLoggedIn) {
    return (
      <div className="max-w-md mx-auto px-4 py-8 pb-16">
        <form onSubmit={handleLogin} className="bg-cosmic-card border border-cosmic-border rounded-2xl p-6 space-y-4 shadow-xl relative overflow-hidden">
          <div className="aurora-gold -top-30 -right-30 opacity-20"></div>
          
          <div className="text-center space-y-1.5 pb-2 relative z-10">
            <div className="inline-flex p-3 rounded-full bg-amber-500/10 text-amber-500 border border-amber-500/15">
              <Lock className="w-5 h-5" />
            </div>
            <h2 className="text-base font-bold text-white font-display">የአስተዳዳሪ መቆጣጠሪያ ፖርታል (Admin Portal)</h2>
            <p className="text-[10px] text-gray-400">ከቴሌብር የሚላኩ ክፍያዎችን ለማጽደቅ እና ለመቆጣጠር ያስገቡ</p>
          </div>

          {/* Test credentials notice to satisfy quick simulation testing */}
          <div className="bg-amber-500/5 border border-amber-500/20 p-3 rounded-lg text-[10px] space-y-1 relative z-10">
            <span className="font-extrabold text-amber-400">🔐 የአይቲ ስቱዲዮ የሙከራ ፈቃድ፦</span>
            <div className="text-gray-300 font-mono flex flex-col gap-0.5">
              <div>ተጠቃሚ ስም: <span className="font-bold text-slate-100">admin</span></div>
              <div>ይለፍ ቃል: <span className="font-bold text-slate-100">password123</span></div>
            </div>
          </div>

          <div className="space-y-3 relative z-10">
            <div className="space-y-1">
              <label className="text-[10px] font-bold text-gray-300 block">የአስተዳዳሪ ስም (Username)፦</label>
              <input
                type="text"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                required
                className="w-full bg-cosmic-bg border border-cosmic-border rounded-xl px-3 py-2.5 text-xs text-gray-100 placeholder:text-gray-600 focus:outline-none focus:border-amber-500/50"
                placeholder="admin"
              />
            </div>

            <div className="space-y-1">
              <label className="text-[10px] font-bold text-gray-300 block">የይለፍ ቃል (Password)፦</label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                className="w-full bg-cosmic-bg border border-cosmic-border rounded-xl px-3 py-2.5 text-xs text-gray-100 placeholder:text-gray-600 focus:outline-none focus:border-amber-500/50"
                placeholder="••••••••"
              />
            </div>
          </div>

          {loginError && (
            <p className="text-[11px] text-red-400 bg-red-500/10 border border-red-500/20 px-3 py-2 rounded-lg text-center font-sans">
              ⚠️ {loginError}
            </p>
          )}

          <button
            type="submit"
            className="w-full bg-gradient-to-r from-amber-400 to-amber-500 hover:from-amber-500 hover:to-amber-600 text-black font-extrabold py-3.5 px-6 rounded-xl text-xs transition-all tracking-wider relative z-10 cursor-pointer"
          >
            ግባ (Login securely)
          </button>
        </form>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto px-4 py-4 pb-16 space-y-6">
      
      {/* KPI header banner */}
      <div className="flex items-center justify-between border-b border-cosmic-border/60 pb-3">
        <div className="flex items-center gap-2">
          <Database className="w-5 h-5 text-amber-500" />
          <h2 className="text-base font-bold text-white font-display">አጠቃላይ የአስተዳደር መረጃዎች</h2>
        </div>
        <button
          onClick={handleLogout}
          className="flex items-center gap-1.5 bg-red-500/10 text-red-400 border border-red-500/15 hover:bg-red-500/20 font-bold px-2.5 py-1.5 rounded-lg text-[10px] transition-colors"
        >
          <LogOut className="w-3.5 h-3.5" />
          ውጣ (Log Out)
        </button>
      </div>

      {/* Analytics Bento Cards Grid */}
      {analytics && (
        <div className="grid grid-cols-2 lg:grid-cols-5 gap-3">
          <div className="bg-cosmic-card border border-cosmic-border p-4 rounded-xl space-y-1 text-center">
            <Users className="w-4 h-4 text-amber-500 mx-auto" />
            <div className="text-[10px] text-gray-400">ጠቅላላ ተጠቃሚዎች</div>
            <div className="text-lg font-black text-white font-mono">{analytics.totalUsers}</div>
          </div>

          <div className="bg-cosmic-card border border-cosmic-border p-4 rounded-xl space-y-1 text-center">
            <UserCheck className="w-4 h-4 text-purple-400 mx-auto" />
            <div className="text-[10px] text-gray-400">ንቁ ተጠቃሚዎች</div>
            <div className="text-lg font-black text-slate-100 font-mono">{analytics.activeUsers}</div>
          </div>

          <div className="bg-cosmic-card border border-cosmic-border p-4 rounded-xl space-y-1 text-center col-span-1">
            <Clock className="w-4 h-4 text-blue-400 mx-auto" />
            <div className="text-[10px] text-gray-400">ያልፀደቁ ክፍያዎች</div>
            <div className={`text-lg font-black font-mono ${analytics.pendingPaymentsCount > 0 ? "text-amber-400 animate-pulse" : "text-gray-400"}`}>
              {analytics.pendingPaymentsCount}
            </div>
          </div>

          <div className="bg-cosmic-card border border-cosmic-border p-4 rounded-xl space-y-1 text-center">
            <CreditCard className="w-4 h-4 text-green-400 mx-auto" />
            <div className="text-[10px] text-gray-400">ፕሪሚየም አባላት</div>
            <div className="text-lg font-black text-green-400 font-mono">{analytics.premiumUsersCount}</div>
          </div>

          <div className="bg-cosmic-card border border-amber-500/20 p-4 rounded-xl space-y-1 text-center col-span-2 lg:col-span-1">
            <TrendingUp className="w-4 h-4 text-amber-400 mx-auto" />
            <div className="text-[10px] text-gray-400">ጠቅላላ ገቢ (ETB)</div>
            <div className="text-lg font-black text-amber-400 font-mono">{analytics.revenue} ETB</div>
          </div>
        </div>
      )}

      {/* Primary Dashboard Selector */}
      <div className="bg-cosmic-card border border-cosmic-border p-1.5 rounded-xl grid grid-cols-3 gap-1.5 text-center text-xs">
        <button
          onClick={() => setActiveTab("payments")}
          className={`py-2 rounded-lg font-semibold transition-all ${
            activeTab === "payments" ? "bg-amber-500 text-black shadow-lg" : "text-gray-400 hover:text-white"
          }`}
        >
          የቴሌብር ማረጋገጫዎች (Payments)
        </button>
        <button
          onClick={() => setActiveTab("users")}
          className={`py-2 rounded-lg font-semibold transition-all ${
            activeTab === "users" ? "bg-amber-500 text-black shadow-lg" : "text-gray-400 hover:text-white"
          }`}
        >
          የተመዘገቡ አባላት (Users)
        </button>
        <button
          onClick={() => setActiveTab("bot")}
          className={`py-2 rounded-lg font-semibold transition-all flex items-center justify-center gap-1.5 ${
            activeTab === "bot" ? "bg-amber-500 text-black shadow-lg" : "text-gray-400 hover:text-white"
          }`}
        >
          <BellRing className="w-3.5 h-3.5" />
          <span>ቦት ቀጥታ ስርጭት (Bot Logs)</span>
        </button>
      </div>

      {/* Payments tabulation Section */}
      {activeTab === "payments" && (
        <div className="bg-cosmic-card border border-cosmic-border rounded-xl p-4 space-y-4">
          <h3 className="text-xs font-bold text-gray-100 border-b border-cosmic-border/60 pb-2">
            የቴሌብር ማኑዋል የክፍያ ስክሪንሾቶች ማረጋገጫ መዝገብ
          </h3>

          {payments.length === 0 ? (
            <p className="text-center text-xs text-gray-500 py-6">ከተጠቃሚዎች የቀረበ የክፍያ ማረጋገጫ የለም።</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs text-gray-300 divide-y divide-cosmic-border/60 font-sans">
                <thead>
                  <tr className="text-[10px] text-gray-400 font-bold uppercase">
                    <th className="py-2.5 px-2">ስም (User)</th>
                    <th className="py-2.5 px-2">ፕላን (Plan)</th>
                    <th className="py-2.5 px-2">የብር መጠን (ETB)</th>
                    <th className="py-2.5 px-2">የስክሪን ፎቶ (Screenshot)</th>
                    <th className="py-2.5 px-2">ሁኔታ (Status)</th>
                    <th className="py-2.5 px-2 text-right">የክፍያ ተግባራት (Actions)</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-cosmic-border/50">
                  {payments.map((p) => (
                    <tr key={p.id} className="hover:bg-slate-900/30">
                      <td className="py-3 px-2 font-medium">
                        <div>{p.first_name}</div>
                        <div className="text-[10px] text-gray-500 font-mono">@{p.username}</div>
                      </td>
                      <td className="py-3 px-2">
                        <span className={`px-1.5 py-0.5 rounded text-[10px] font-bold ${p.plan_type === "premium" ? "bg-amber-500/5 text-amber-500 border border-amber-500/10" : "bg-slate-900 text-gray-300"}`}>
                          {p.plan_type === "premium" ? "Premium 30 Days" : "Single 1 Day"}
                        </span>
                      </td>
                      <td className="py-3 px-2 font-bold font-mono">{p.amount} ETB</td>
                      <td className="py-3 px-2">
                        <button
                          onClick={() => setSelectedScreenshot(p.screenshot_url)}
                          className="flex items-center gap-1 bg-slate-900 text-[10px] border border-cosmic-border hover:border-slate-700 hover:text-white font-medium px-2 py-1 rounded"
                        >
                          <Image className="w-3 h-3 text-amber-400" />
                          ልዩ አሳይ (View)
                        </button>
                      </td>
                      <td className="py-3 px-2">
                        <span className={`px-1.5 py-0.5 rounded text-[9px] font-black ${
                          p.status === "approved"
                            ? "bg-green-500/10 text-green-400"
                            : p.status === "rejected"
                            ? "bg-red-500/10 text-red-400"
                            : "bg-amber-500/10 text-amber-400 animate-pulse"
                        }`}>
                          {p.status === "approved" ? "APPROVED" : p.status === "rejected" ? "REJECTED" : "PENDING"}
                        </span>
                      </td>
                      <td className="py-3 px-2 text-right space-x-1.5">
                        {p.status === "pending" ? (
                          <>
                            <button
                              onClick={() => handleAction(p.id, "approve")}
                              disabled={loadingActionId === p.id}
                              className="bg-green-600 hover:bg-green-700 text-slate-100 font-extrabold px-2.5 py-1 rounded text-[10px] transition-colors cursor-pointer"
                            >
                              ፍቀድ (Approve)
                            </button>
                            <button
                              onClick={() => handleAction(p.id, "reject")}
                              disabled={loadingActionId === p.id}
                              className="bg-red-600/30 hover:bg-red-600 text-red-200 font-extrabold px-2.5 py-1 rounded text-[10px] transition-colors cursor-pointer"
                            >
                              ከልክል (Reject)
                            </button>
                          </>
                        ) : (
                          <span className="text-[10px] text-gray-500">ተከናውኗል</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* Users Tab section */}
      {activeTab === "users" && (
        <div className="bg-cosmic-card border border-cosmic-border rounded-xl p-4 space-y-4">
          <h3 className="text-xs font-bold text-gray-100 border-b border-cosmic-border/60 pb-2">
            የተመዘገቡ አባላት ቁጥጥር መድረክ
          </h3>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs text-gray-300 divide-y divide-cosmic-border/60 font-sans">
              <thead>
                <tr className="text-[10px] text-gray-400 font-bold uppercase">
                  <th className="py-2 px-2">ስዕል</th>
                  <th className="py-2 px-2">ቴሌግራም መለያ (Telegram User)</th>
                  <th className="py-2 px-2">የተጠቃሚ ስም (Name)</th>
                  <th className="py-2 px-2">ነፃ ጥቅም ላይ የዋለ</th>
                  <th className="py-2 px-2">ህልሞች ብዛት</th>
                  <th className="py-2 px-2">ፕሪሚየም ገደብ (Subscription)</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-cosmic-border/50">
                {users.map((u) => {
                  const hasPremium = u.premium_until && new Date(u.premium_until).getTime() > Date.now();
                  return (
                    <tr key={u.telegram_id} className="hover:bg-slate-900/30">
                      <td className="py-2 px-2">
                        <img src={u.profile_photo || `https://api.dicebear.com/7.x/bottts/svg?seed=${u.telegram_id}`} alt="profile" className="w-6 h-6 rounded-full bg-slate-900 p-0.5 border border-cosmic-border" />
                      </td>
                      <td className="py-2.5 px-2 font-mono text-[11px] text-amber-400">@{u.username}</td>
                      <td className="py-2.5 px-2">{u.first_name}</td>
                      <td className="py-2.5 px-2 font-mono">{u.free_trial_used ? "አዎ (TRUE)" : "አይደለም (FALSE)"}</td>
                      <td className="py-2.5 px-2 font-bold font-mono">{u.total_dreams || 0} ጊዜ</td>
                      <td className="py-2.5 px-2 text-[10px]">
                        {hasPremium ? (
                          <span className="text-green-400 font-bold bg-green-500/10 px-2 py-0.5 rounded border border-green-500/15 font-sans">
                            እስከ {new Date(u.premium_until!).toLocaleDateString("am-ET")}
                          </span>
                        ) : (
                          <span className="text-gray-500">የተገደበ ነፃ ዕቅድ</span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Embedded interactive Simulated Telegram Notification Webhook Logs */}
      {activeTab === "bot" && (
        <div className="bg-cosmic-card border border-cosmic-border rounded-xl p-5 space-y-4">
          <div className="flex items-center gap-2 border-b border-cosmic-border/60 pb-2 justify-between">
            <h3 className="text-xs font-bold text-gray-100 flex items-center gap-1.5">
              <Smartphone className="w-4 h-4 text-amber-500 animate-bounce" />
              የቴሌግራም ቦት ማቀናበሪያ (Real Telegram Bot Panel)
            </h3>
            <span className="text-[10px] text-green-500 font-mono">Real Webhook Enabled</span>
          </div>

          <div className="bg-slate-900/50 p-4 border border-blue-500/30 rounded-xl mb-6">
            <h4 className="text-xs font-bold text-blue-400 mb-2">🤖 ሴክሬት ቦት ፓነል (Secret Bot Panel)</h4>
            <p className="text-[10px] text-gray-300 mb-4">ማሳሰቢያ: እዚህ የሚያስገቡት የቴሌግራም ቦት ቶከን (Bot Token) እንዲሁም የChat ID (የእርስዎ ቴሌግራም አይዲ) ክፍያ ሲፈጸም እውነተኛ መልዕክት በቦቱ በኩል እንዲደርስዎ ያደርጋል።</p>
            <div className="space-y-3">
              <div>
                <label className="block text-[10px] text-gray-400 mb-1">Bot Token</label>
                <input 
                  type="text" 
                  value={botTokenInput}
                  onChange={(e) => setBotTokenInput(e.target.value)}
                  placeholder="e.g. 123456789:ABCdefGHIjkl..." 
                  className="w-full bg-black/40 border border-slate-700 rounded-lg px-3 py-2 text-xs text-gray-200 outline-none focus:border-blue-500"
                />
              </div>
              <div>
                <label className="block text-[10px] text-gray-400 mb-1">Your Telegram Admin Chat ID</label>
                <input 
                  type="text" 
                  value={chatIdInput}
                  onChange={(e) => setChatIdInput(e.target.value)}
                  placeholder="e.g. 1480652999" 
                  className="w-full bg-black/40 border border-slate-700 rounded-lg px-3 py-2 text-xs text-gray-200 outline-none focus:border-blue-500"
                />
              </div>
              <button 
                onClick={handleSaveBotConfig}
                className="w-full bg-blue-600 hover:bg-blue-500 text-white font-bold text-xs py-2 rounded-lg transition-colors"
              >
                ቦትን አስቀምጥ (Save Bot API Key)
              </button>
              {botSaveMsg && <p className="text-[10px] text-green-400 text-center font-bold">{botSaveMsg}</p>}
            </div>
          </div>

          <p className="text-[10px] text-gray-400 leading-normal font-sans border-t border-cosmic-border/50 pt-4">
            ተጠቃሚዎች ክፍያ ሲያስገቡ ወዲያውኑ ወደ የቴሌግራም ግሩፕ/ቦት ለባለቤቱ የሚላከውን መልዕክት ያስመስላል። የአስተዳዳሪው ስራ እንዲቀል ከዚህ በቀጥታ ማጽደቅ ወይም ውድቅ ማድረግ ይችላሉ፦
          </p>

          {botNotifs.length === 0 ? (
            <p className="text-center text-xs text-gray-600 py-6">ምንም አዲስ የቦት ማሳሰቢያ እስካሁን አልደረሰም።</p>
          ) : (
            <div className="space-y-4">
              {botNotifs.map((notif) => (
                <div 
                  key={notif.id} 
                  className="bg-cosmic-bg border border-cosmic-border rounded-2xl p-4.5 max-w-md mx-auto relative overflow-hidden space-y-3.5 shadow-lg shadow-black/80"
                >
                  <div className="flex items-center justify-between border-b border-cosmic-border/50 pb-1.5 text-[9px] text-gray-500">
                    <span className="font-bold flex items-center gap-1 text-sky-400">
                      💬 simulated_admin_bot
                    </span>
                    <span>{new Date(notif.created_at).toLocaleTimeString("am-ET")}</span>
                  </div>

                  <div className="text-xs space-y-1 font-sans text-gray-200 whitespace-pre-wrap pl-1 leading-relaxed border-l-2 border-amber-500/40 pl-2">
                    {`🌟 አዲስ ክፍያ ተልኳል (New Payment Submitted) 🌟\n\n👤 ተጠቃሚ: @${notif.username}\n📦 ፕላን: ${notif.plan_type === "single" ? "59 ETB (1 Day Credit)" : "259 ETB (Premium Monthly)"}\n💰 የብር መጠን: ${notif.amount} ETB`}
                  </div>

                  {notif.screenshot_url && (
                    <div className="flex justify-center border border-cosmic-border bg-slate-900 rounded-lg p-1.5 max-w-[150px] mx-auto">
                      <img 
                        src={notif.screenshot_url} 
                        alt="Bot Preview" 
                        onClick={() => setSelectedScreenshot(notif.screenshot_url)}
                        className="max-h-[140px] rounded cursor-pointer object-contain"
                      />
                    </div>
                  )}

                  <div className="flex gap-2">
                    {notif.status === "pending" ? (
                      <>
                        <button
                          onClick={() => handleAction(notif.payment_id, "approve")}
                          disabled={loadingActionId === notif.payment_id}
                          className="flex-1 bg-green-500 hover:bg-green-600 text-black font-extrabold py-2 px-3 rounded-xl text-[10px] transition-colors cursor-pointer text-center"
                        >
                          Approve (ፍቀድ)
                        </button>
                        <button
                          onClick={() => handleAction(notif.payment_id, "reject")}
                          disabled={loadingActionId === notif.payment_id}
                          className="flex-1 bg-red-600/30 hover:bg-red-600 hover:text-white text-red-200 font-extrabold py-2 px-3 rounded-xl text-[10px] transition-colors cursor-pointer text-center"
                        >
                          Reject (ከልክል)
                        </button>
                      </>
                    ) : (
                      <div className={`w-full text-center text-[10px] font-bold py-1.5 rounded-lg border ${notif.status === "approved" ? "text-green-400 bg-green-500/5 border-green-500/20" : "text-red-400 bg-red-500/5 border-red-500/20"}`}>
                        {notif.status === "approved" ? "✓ APPROVED (የጸደቀ)" : "✗ REJECTED (ውድቅ የተደረገ)"}
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Floating Active Alerts container */}
      {activeAlerts.length > 0 && (
        <div className="fixed top-6 right-6 z-50 mt-16 max-w-sm w-full space-y-3 pointer-events-none">
          {activeAlerts.map((alert) => (
            <div 
              key={alert.id} 
              className="pointer-events-auto bg-gradient-to-r from-amber-400 to-amber-500 text-black font-extrabold rounded-2xl px-5 py-4 shadow-2xl flex items-start gap-3 border border-amber-300/30 animate-bounce relative overflow-hidden"
            >
              <div className="bg-black/10 p-1.5 rounded-lg flex-shrink-0 animate-pulse mt-0.5">
                <BellRing className="w-4 h-4 text-black" />
              </div>
              <div className="flex-1 space-y-0.5">
                <div className="text-[10px] uppercase font-bold tracking-widest text-black/80">አስቸኳይ የክፍያ ማሳሰቢያ</div>
                <p className="text-xs font-semibold leading-relaxed font-sans text-stone-900">{alert.msg}</p>
              </div>
              <button 
                onClick={() => setActiveAlerts(prev => prev.filter(al => al.id !== alert.id))}
                className="text-black/80 hover:text-black font-black text-xs px-1 cursor-pointer"
              >
                ✕
              </button>
            </div>
          ))}
        </div>
      )}

      {/* Image zoom popup dialog/modal */}
      {selectedScreenshot && (
        <div 
          onClick={() => setSelectedScreenshot(null)}
          className="fixed inset-0 z-50 bg-black/95 flex items-center justify-center p-4 cursor-zoom-out"
        >
          <div className="relative max-w-xl max-h-[85vh] bg-cosmic-card border border-cosmic-border rounded-xl p-2">
            <img 
              src={selectedScreenshot} 
              alt="Telebirr Screenshot zoom" 
              className="max-h-[80vh] rounded-lg object-contain bg-black"
            />
            <div className="text-center text-[10px] text-gray-500 pt-2 font-sans">
              ይህንን መስኮት ለመዝጋት የትኛውንም ቦታ ይንኩ
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
