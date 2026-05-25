import React from "react";
import { User, Dream, ReligionType } from "../lib/types";
import { interpretDream } from "../lib/api";
import { BookOpen, Brain, Sparkles, Key, HelpCircle, Copy, Share2, CornerDownRight, Check, Compass, Moon } from "lucide-react";

interface DreamInterpreterProps {
  currentUser: User | null;
  onDreamInterpreted: (newDream: Dream, updatedUser: User) => void;
  onNavigateToPayment: () => void;
}

export default function DreamInterpreter({ currentUser, onDreamInterpreted, onNavigateToPayment }: DreamInterpreterProps) {
  const [dreamText, setDreamText] = React.useState("");
  const [religion, setReligion] = React.useState<ReligionType>("Orthodox");
  const [loading, setLoading] = React.useState(false);
  const [loadingStep, setLoadingStep] = React.useState(0);
  const [error, setError] = React.useState<string | null>(null);
  const [latestDream, setLatestDream] = React.useState<Dream | null>(null);
  const [copied, setCopied] = React.useState(false);
  const [shareError, setShareError] = React.useState<string | null>(null);
  const [isLocalTrialUsed, setIsLocalTrialUsed] = React.useState(false);
  const prevTelegramIdRef = React.useRef<string | null>(null);

  const localTrialKey = currentUser ? `free_trial_used_${currentUser.telegram_id}` : null;

  // Sync free trial state with localStorage and Telegram CloudStorage
  React.useEffect(() => {
    const currentId = currentUser ? String(currentUser.telegram_id) : null;
    if (prevTelegramIdRef.current !== currentId) {
      setLatestDream(null);
      setError(null);
      setShareError(null);
      prevTelegramIdRef.current = currentId;
    }

    if (!currentUser || !localTrialKey) {
      setIsLocalTrialUsed(false);
      return;
    }

    // 1. Check local storage
    const locallyUsed = localStorage.getItem(localTrialKey) === "true";
    setIsLocalTrialUsed(locallyUsed);

    // 2. Check Telegram CloudStorage if available (supported from v6.9+)
    const tg = (window as any).Telegram?.WebApp;
    const isCloudStorageSupported = !!(tg && typeof tg.isVersionAtLeast === "function" && tg.isVersionAtLeast("6.9") && tg.CloudStorage);
    if (isCloudStorageSupported) {
      try {
        tg.CloudStorage.getItem(localTrialKey, (err: any, value: string) => {
          if (!err && value === "true") {
            setIsLocalTrialUsed(true);
            localStorage.setItem(localTrialKey, "true");
          }
        });
      } catch (e) {
        console.warn("CloudStorage error:", e);
      }
    }
  }, [currentUser, localTrialKey]);

  // Dynamic supportive Amharic phrases to rotate through during dream analysis
  const loadingSteps = [
    "ሕልምዎን በማንበብ ላይ ነን...",
    "መንፈሳዊ ምልክቶችን እየሰበሰብን ነው...",
    "የአእምሮ ስነ-ልቦናዊ ሁኔታዎችን እያሰላን ነው...",
    "ጥበብ የተሞላበት ትርጉም በማጠናቀር ላይ ነው..."
  ];

  React.useEffect(() => {
    let interval: NodeJS.Timeout;
    if (loading) {
      interval = setInterval(() => {
        setLoadingStep((prev) => (prev + 1) % loadingSteps.length);
      }, 3000);
    }
    return () => clearInterval(interval);
  }, [loading]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentUser) {
      setError("እባክዎን መጀመሪያ አካውንትዎን ያረጋግጡ!");
      return;
    }
    if (!dreamText.trim()) return;

    // Reject two different dreams at once
    const normalized = dreamText.toLowerCase();
    const multipleDreamsKeywords = [
      "ሁለት ህልም", "ሁለት የተለያዩ", "ሁለት የተለያየ", "ሁለተኛው ህልም", "ሁለተኛ ህልም", "ሌላ ህልም", "ሌላኛው ህልም",
      "ተጨማሪ ህልም", "የመጀመሪያው ህልም", "ሁለተኛ ደግሞ", "2 ህልም", "2 የተለያዩ", "two dreams",
      "another dream", "second dream", "different dreams", "2 different dreams", "two different dreams"
    ];
    const hasMultiple = multipleDreamsKeywords.some(kw => normalized.includes(kw));
    if (hasMultiple) {
      setError("ይቅርታ! በአንድ ጊዜ ከአንድ በላይ የተለያየ ህልም መተርጎም አይቻልም። እባኮትን ጥልቅ እና ሰፊ ትርጓሜ ለማግኘት አንዱን ዋና ህልምዎን ብቻ ለይተው በዝርዝር ይጻፉልን። (Sorry! You cannot submit two different dreams at once. Please describe only one dream in detail to get a deep interpretation.)");
      return;
    }

    setLoading(true);
    setLoadingStep(0);
    setError(null);
    setLatestDream(null);
    setShareError(null);

    try {
      const response = await interpretDream({
        user_id: currentUser.telegram_id,
        dream_text: dreamText,
        religion,
      });

      if (response.success) {
        setLatestDream(response.dream);
        onDreamInterpreted(response.dream, response.user);
        setDreamText(""); // Clear text

        // Save free trial state locally & cloud
        if (localTrialKey) {
          localStorage.setItem(localTrialKey, "true");
          setIsLocalTrialUsed(true);
          const tg = (window as any).Telegram?.WebApp;
          const isCloudStorageSupported = !!(tg && typeof tg.isVersionAtLeast === "function" && tg.isVersionAtLeast("6.9") && tg.CloudStorage);
          if (isCloudStorageSupported) {
            try {
              tg.CloudStorage.setItem(localTrialKey, "true", (err: any) => {
                if (err) console.error("CloudStorage error:", err);
              });
            } catch (e) {
              console.warn("CloudStorage error:", e);
            }
          }
        }
      }
    } catch (err: any) {
      console.error(err);
      if (err.message === "ACCESS_DENIED") {
        setError("ACCESS_DENIED");
      } else {
        setError(err.message || "የህልም ትርጓሜውን ማከናወን አልተቻለም። እባኮትን እንደገና ይሞክሩ።");
      }
    } finally {
      setLoading(false);
    }
  };

  const handleCopy = () => {
    if (!latestDream) return;
    if (!isPremiumActive) {
      setShareError("ይቅርታ! የህልም ትርጓሜ መረጃዎችን ኮፒ ማድረግ የሚችሉት ፕሪሚየም ወይም ባለ ፩ ቀን እቅድ ሲገዙ ብቻ ነው። እባክዎ ክፍያ በመፈፀም አግልግሎቱን ያግብሩ! (Copying dream translations is a premium feature. Please upgrade to unlock!)");
      return;
    }
    const shareableBody = `🌟 የህልም ትርጓሜ (የሕልም መፍቻ) 🌟
--------------------------------------
የህልም ፅሁፍ፦ ${latestDream.dream_text}
እምነት፦ ${latestDream.religion}

⛪/🕌 መንፈሳዊ ትርጓሜ፦
${latestDream.interpretation.spiritual}

🧠 ስነ-ልቦናዊ ትርጓሜ፦
${latestDream.interpretation.psychological}

🔑 ምልክታዊ ትርጓሜ፦
${latestDream.interpretation.symbolic}

💡 ምክር፦
${latestDream.interpretation.advice}

✨ ዋና መልዕክት፦
${latestDream.interpretation.summary}`;

    navigator.clipboard.writeText(shareableBody);
    setCopied(true);
    setShareError(null);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleShare = () => {
    if (!latestDream) return;
    if (!isPremiumActive) {
      setShareError("ይቅርታ! የህልም ትርጓሜ መረጃዎችን ማጋራት (Share) የሚችሉት ፕሪሚየም ወይም ባለ ፩ ቀን እቅድ ሲገዙ ብቻ ነው። እባክዎ ክፍያ በመፈፀም አግልግሎቱን ያግብሩ! (Sharing dream translations is a premium feature. Please upgrade to unlock!)");
      return;
    }
    if (navigator.share) {
      navigator.share({
        title: "የሕልም ትርጓሜ",
        text: latestDream.interpretation.summary,
        url: window.location.href,
      }).catch((err) => {
        // Handle native share cancellations or aborts gracefully
        const errMsg = String(err?.message || err).toLowerCase();
        if (errMsg.includes("cancel") || errMsg.includes("abort") || err?.name === "AbortError") {
          console.log("Share operation canceled by user.");
          return;
        }
        // Fallback to clipboard if sharing fails due to iframe sandboxing or lack of browser support
        console.warn("Share failed, falling back to copy:", err);
        handleCopy();
      });
    } else {
      handleCopy();
    }
  };

  const adminIdFromEnv = import.meta.env.VITE_ADMIN_TELEGRAM_ID;
  const isAdminUser = !!(
    currentUser && 
    (
      (adminIdFromEnv && String(currentUser.telegram_id).trim() === String(adminIdFromEnv).trim()) ||
      String(currentUser.telegram_id).trim().toLowerCase() === "lenaedward949@gmail.com"
    )
  );
  const isPremiumActive = isAdminUser || (currentUser?.premium_until && new Date(currentUser.premium_until).getTime() > Date.now());
  const hasRemainingCredits = currentUser ? (currentUser.dream_credits > 0 || (!currentUser.free_trial_used && !isLocalTrialUsed)) : true;
  const isBlocked = currentUser && !isPremiumActive && !hasRemainingCredits;

  // Character limit validation: Paid users can write up to 10,000 characters (more than 1000 words), Free users can write up to 2000 characters
  const CHAR_LIMIT = isPremiumActive ? 10000 : 2000;
  const charsRemaining = CHAR_LIMIT - dreamText.length;

  return (
    <div className="space-y-6 max-w-2xl mx-auto px-4 py-3 pb-16">
      
      {/* Title block */}
      <div className="text-center space-y-2 py-4">
        <div className="inline-flex p-3 rounded-full bg-amber-500/10 text-amber-500 border border-amber-500/20 shadow-lg shadow-amber-500/5 animate-pulse">
          <Moon className="w-8 h-8" />
        </div>
        <h1 className="text-2xl font-bold tracking-tight text-white font-display">
          የሕልም መፍቻ (AI Dream Interpreter)
        </h1>
        <p className="text-xs text-gray-400 max-w-md mx-auto leading-relaxed">
          ህልምዎን በአማርኛ ይፃፉ እና መንፈሳዊ፣ ስነ-ልቦናዊ እና ምልክታዊ የሆኑ ጥልቅ ትርጓሜዎችን በጥበብ ከተሞላው የዮሴፍ አርቲፊሻል ኢንተለጀንስ ያግኙ።
        </p>
      </div>

      {(error === "ACCESS_DENIED" || isBlocked) && !latestDream ? (
        <div className="bg-cosmic-card border border-amber-500/30 p-6 rounded-2xl text-center space-y-5 shadow-xl relative overflow-hidden">
          <div className="aurora-gold -top-20 -right-20 opacity-20"></div>
          <div className="inline-flex p-3 rounded-full bg-amber-500/10 text-amber-500">
            <Compass className="w-8 h-8 animate-pulse" />
          </div>
          <div className="space-y-2">
            <h2 className="text-lg font-bold text-transparent bg-clip-text bg-gradient-to-r from-amber-400 to-amber-200">
              የነፃ ትርጓሜ ፍቃድዎ አልቋል!
            </h2>
            <p className="text-xs text-gray-300 leading-relaxed max-w-sm mx-auto">
              የእርስዎ የነፃ ህልም መተርጎሚያ እድል በተሳካ ሁኔታ ጥቅም ላይ ውሏል። ቀጣይ የህልም መፍቻ ዕድሎችን ለማግኘት እባክዎን ከታች ካሉት እቅዶች አንዱን ይምረጡና ይክፈሉ።
            </p>
          </div>

          {/* Pricing Features info */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-left max-w-md mx-auto relative z-10 pt-1">
            <div className="bg-cosmic-bg/60 border border-cosmic-border/60 p-3.5 rounded-xl space-y-1">
              <span className="text-[10px] uppercase font-bold text-amber-400 font-sans tracking-wider font-mono">ባለ ፩ ቀን እቅድ (Single Plan)</span>
              <div className="text-base font-extrabold text-white">59 ETB <span className="text-xs font-normal text-gray-400">/ 1 ሙሉ ቀን</span></div>
              <p className="text-[10px] text-gray-400 font-sans leading-relaxed">ለአንድ ሙሉ ቀን ያለምንም ገደብ እና ማስታወቂያ ህልሞችን ያለገደብ ይፍቱ።</p>
            </div>
            <div className="bg-cosmic-bg/60 border border-amber-500/20 p-3.5 rounded-xl space-y-1 relative">
              <span className="absolute -top-1.5 -right-1 bg-amber-500 text-black text-[8px] font-extrabold uppercase px-1.5 py-0.5 rounded-full font-mono">Best Value</span>
              <span className="text-[10px] uppercase font-bold text-amber-400 font-sans tracking-wider font-mono">ወርሃዊ ፕሪሚየም (Monthly Plan)</span>
              <div className="text-base font-extrabold text-white">259 ETB <span className="text-xs font-normal text-gray-400">/ 30 ቀናት</span></div>
              <p className="text-[10px] text-gray-400 font-sans leading-relaxed">ለ30 ቀናት (1 ሙሉ ወር) ያለ ምንም ወሰን በቅድሚያ ትርጓሜዎችን ያግኙ።</p>
            </div>
          </div>

          <div className="pt-2 relative z-10">
            <button
              onClick={onNavigateToPayment}
              className="w-full bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-600 hover:to-amber-700 text-black font-extrabold py-3.5 px-6 rounded-xl text-xs transition-all shadow-lg shadow-amber-500/20 uppercase tracking-widest"
            >
              ክፍያ ፈፅም (Go to Payment Panel)
            </button>
          </div>
        </div>
      ) : (
        <>
          {/* Intake state or Blocked notification inline */}
          {!isBlocked ? (
            <form onSubmit={handleSubmit} className="bg-cosmic-card border border-cosmic-border rounded-2xl p-5 space-y-4 shadow-lg shadow-black/80 relative overflow-hidden">
              <div className="aurora-gold -top-20 -right-20 opacity-30"></div>
              
              {/* Religion selector dropdown */}
              <div className="space-y-1.5 relative z-10">
                <label className="text-xs font-semibold text-gray-300 flex items-center gap-1">
                  <Compass className="w-3.5 h-3.5 text-amber-500" />
                  የሃይማኖት / መንፈሳዊ እይታ ይምረጡ፦
                </label>
                <select
                  value={religion}
                  onChange={(e) => setReligion(e.target.value as ReligionType)}
                  className="w-full bg-cosmic-bg border border-cosmic-border rounded-xl px-3 py-2.5 text-xs text-gray-100 focus:outline-none focus:border-amber-500/50 focus:ring-1 focus:ring-amber-500/30 transition-all font-sans"
                >
                  <option value="Orthodox">የኦርቶዶክስ እምነት እይታ (Orthodox perspective)</option>
                  <option value="Muslim">የእስልምና እምነት እይታ (Muslim perspective)</option>
                  <option value="Protestant">የፕሮቴስታንት እምነት እይታ (Protestant perspective)</option>
                  <option value="Catholic">የካቶሊክ እምነት እይታ (Catholic perspective)</option>
                </select>
              </div>

              {/* Main Dream Input Textarea */}
              <div className="space-y-1.5 relative z-10">
                <label className="text-xs font-semibold text-gray-300 flex items-center justify-between">
                  <span>የታየው ህልም ዝርዝር፦</span>
                  <span className={`text-[10px] font-mono ${charsRemaining < 100 ? "text-red-400" : "text-gray-500"}`}>
                    {charsRemaining} / {CHAR_LIMIT} ፊደላት
                  </span>
                </label>
                <textarea
                  value={dreamText}
                  onChange={(e) => setDreamText(e.target.value.substring(0, CHAR_LIMIT))}
                  onPaste={(e) => {
                    e.stopPropagation(); // Prevent parent container click/gesture prevention
                  }}
                  onCopy={(e) => {
                    e.stopPropagation();
                  }}
                  onCut={(e) => {
                    e.stopPropagation();
                  }}
                  placeholder="ለምሳሌ፡ ትናንት ማታ በትልቅ ወንዝ ውስጥ በሰላም ስዋኝና አረንጓዴ ቅጠሎችን ስሰበስብ አየሁ..."
                  rows={5}
                  required
                  disabled={loading}
                  className="w-full bg-cosmic-bg border border-cosmic-border rounded-xl p-3.5 text-xs text-gray-100 placeholder:text-gray-500 focus:outline-none focus:border-amber-500/50 focus:ring-1 focus:ring-amber-500/30 transition-all resize-none leading-relaxed leading-6 select-text"
                />
              </div>

              {/* Voice Input Placeholder */}
              <div className="flex items-center gap-2 text-[11px] text-gray-500 border border-slate-900 bg-slate-900/30 px-3 py-2 rounded-lg relative z-10 select-none">
                <span className="text-amber-500 animate-pulse">🎙️</span>
                <span>በድምፅ ህልምን መናገር (በቀጣይ ስሪት የሚጨመር አገልግሎት)</span>
              </div>

              {/* Error messaging (if any) */}
              {error && (
                <p className="text-xs text-red-400 bg-red-500/10 border border-red-500/20 px-3 py-2 rounded-lg relative z-10">
                  ⚠️ {error}
                </p>
              )}

              {/* Detailed dream dynamic badge indicator */}
              {dreamText.length >= 150 && (
                <div className="flex items-center gap-1.5 text-[10px] text-amber-400 font-bold bg-amber-400/10 border border-amber-400/30 px-3.5 py-2 rounded-xl animate-pulse relative z-10 w-full justify-center">
                  <Sparkles className="w-3.5 h-3.5 text-amber-400" />
                  <span>በዝርዝር የቀረበ ህልም — ጥልቅና ሰፊ ረጅም ትርጓሜ ይዘጋጅለታል! (Detailed mode active)</span>
                </div>
              )}

              {/* Submit Button */}
              <div className="relative z-10 pt-2">
                <button
                  type="submit"
                  disabled={loading || !dreamText.trim()}
                  className={`w-full font-bold py-3.5 px-6 rounded-xl text-xs transition-all shadow-lg flex items-center justify-center gap-2 ${
                    loading || !dreamText.trim()
                      ? "bg-cosmic-border border border-cosmic-border text-gray-500 cursor-not-allowed"
                      : "bg-gradient-to-r from-amber-400 to-amber-500 hover:from-amber-500 hover:to-amber-600 text-black shadow-amber-500/10 hover:shadow-amber-500/20 cursor-pointer"
                  }`}
                >
                  <Sparkles className="w-4 h-4" />
                  የህልሙን ሚስጥር ፍታ (Interpret Dream Now)
                </button>
              </div>
            </form>
          ) : (
            /* Locked intake banner explaining upgrade is required to do another translation */
            <div className="bg-cosmic-card border border-amber-500/30 p-5 rounded-2xl text-center space-y-4 shadow-xl relative overflow-hidden animate-fadeIn">
              <div className="aurora-gold -top-20 -right-20 opacity-20"></div>
              <div className="inline-flex p-2.5 rounded-full bg-amber-500/10 text-amber-500">
                <Compass className="w-6 h-6 animate-pulse" />
              </div>
              <div className="space-y-1">
                <h3 className="text-sm font-bold text-transparent bg-clip-text bg-gradient-to-r from-amber-400 to-amber-200">
                  የ፩ ጊዜ የነፃ ሙከራዎ አብቅቷል!
                </h3>
                <p className="text-[11px] text-gray-300 leading-relaxed max-w-md mx-auto">
                  የእርስዎን የነፃ ህልም መተርጎሚያ እድል በተሳካ ሁኔታ ተጠቅመዋል። ቀጣይ አዳዲስ ህልሞችን ለመፍታት እባክዎን የቴሌብር ክፍያ በመፈፀም በኢትዮጵያ አንደኛ የሆነውን የዮሴፍን አገልግሎት ይጠቀሙ።
                </p>
              </div>
              <div className="pt-1 select-none">
                <button
                  onClick={onNavigateToPayment}
                  className="w-full bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-600 hover:to-amber-700 text-black font-extrabold py-3 px-5 rounded-xl text-[11px] transition-all shadow-md uppercase tracking-wider"
                >
                  ዕቅዶችን ይመልከቱ (Go to Payment Panel)
                </button>
              </div>
            </div>
          )}

          {/* Golden Submitting State Loading Animation */}
          {loading && (
            <div className="bg-cosmic-card border border-cosmic-border rounded-2xl p-8 text-center space-y-4 shadow-xl flex flex-col items-center justify-center animate-pulse relative overflow-hidden">
              <div className="aurora-purple top-0 left-0"></div>
              <Compass className="w-12 h-12 text-amber-500 animate-spin" />
              <div className="space-y-1 relative z-10">
                <h3 className="text-sm font-semibold text-transparent bg-clip-text bg-gradient-to-r from-amber-400 to-amber-200">
                  {loadingSteps[loadingStep]}
                </h3>
                <p className="text-[10px] text-gray-500">
                  አርቲፊሻል ኢንተለጀንሱ የሕልሙን ፍሬ ለማግኘት በማሳሪያው እያሰላ ነው...
                </p>
              </div>
            </div>
          )}

          {/* Results displaying sections */}
          {latestDream && (
            <div className={`space-y-4 animate-fadeIn ${!isPremiumActive ? "select-none" : ""}`}>
              <div className="bg-gradient-to-r from-amber-500/20 to-transparent border-l-4 border-amber-500 p-3 rounded-r-xl">
                <h2 className="text-sm font-bold text-white">በትንተና ማጠቃለያ የተገኘ ትርጓሜ</h2>
              </div>

              {/* Spiritual Perspective */}
              <div className="bg-cosmic-card border border-cosmic-border rounded-xl p-4.5 space-y-2.5 relative overflow-hidden">
                <div className="aurora-gold -bottom-40 -left-10 opacity-20"></div>
                <div className="flex items-center gap-2 border-b border-cosmic-border/60 pb-2">
                  <BookOpen className="w-4.5 h-4.5 text-amber-500" />
                  <h3 className="text-xs font-bold text-amber-400">
                    ፩. {latestDream.religion === "Orthodox" ? "የኦርቶዶክስ ተዋሕዶ መንፈሳዊ ትርጓሜ" : latestDream.religion === "Muslim" ? "የእስልምና እምነት መንፈሳዊ ትርጓሜ" : latestDream.religion === "Protestant" ? "የፕሮቴስታንት እምነት መንፈሳዊ ትርጓሜ" : "የካቶሊክ እምነት መንፈሳዊ ትርጓሜ"}
                  </h3>
                </div>
                <p className="text-xs text-gray-200 leading-6 text-justify">
                  {latestDream.interpretation.spiritual}
                </p>
              </div>

              {/* Psychological Perspective */}
              <div className="bg-cosmic-card border border-cosmic-border rounded-xl p-4.5 space-y-2.5">
                <div className="flex items-center gap-2 border-b border-cosmic-border/60 pb-2">
                  <Brain className="w-4.5 h-4.5 text-purple-400" />
                  <h3 className="text-xs font-bold text-purple-400">፪. ስነ-ልቦናዊ ትርጓሜ</h3>
                </div>
                <p className="text-xs text-gray-200 leading-6 text-justify">
                  {latestDream.interpretation.psychological}
                </p>
              </div>

              {/* Symbolic Perspective */}
              <div className="bg-cosmic-card border border-cosmic-border rounded-xl p-4.5 space-y-2.5">
                <div className="flex items-center gap-2 border-b border-cosmic-border/60 pb-2">
                  <Key className="w-4.5 h-4.5 text-blue-400" />
                  <h3 className="text-xs font-bold text-blue-400">፫. ምልክታዊ ትርጓሜ</h3>
                </div>
                <p className="text-xs text-gray-200 leading-6 text-justify">
                  {latestDream.interpretation.symbolic}
                </p>
              </div>

              {/* Practical Advice */}
              <div className="bg-cosmic-card border border-cosmic-border rounded-xl p-4.5 space-y-2.5">
                <div className="flex items-center gap-2 border-b border-cosmic-border/60 pb-2">
                  <HelpCircle className="w-4.5 h-4.5 text-teal-400" />
                  <h3 className="text-xs font-bold text-teal-400">፬. ህይወታዊ ምክር</h3>
                </div>
                <p className="text-xs text-gray-200 leading-6 text-justify">
                  {latestDream.interpretation.advice}
                </p>
              </div>

              {/* Summary Conclusion */}
              <div className="bg-amber-500/5 border border-amber-500/20 rounded-xl p-4.5 space-y-2">
                <div className="flex items-center gap-1.5 text-amber-500">
                  <Sparkles className="w-4 h-4" />
                  <h3 className="text-xs font-bold">✨ ዋና የህልሙ መልዕክት</h3>
                </div>
                <p className="text-xs text-gray-100 italic leading-6">
                  "{latestDream.interpretation.summary}"
                </p>
              </div>

              <div className="text-[10px] text-gray-500 text-center italic py-1">
                ⚠️ ማሳሰቢያ፦ ይህ ትርጓሜ በህልም ጥናት ላይ የተመሰረተ እንጂ ትንቢታዊ ወይም ስጋዊ የጊዜ ቀጠሮን በእርግጠኝነት የሚያሳይ አይደለም።
              </div>

              {/* Share and Action items */}
              <div className="grid grid-cols-2 gap-3 pt-2">
                <button
                  onClick={handleCopy}
                  className={`border text-[11px] py-3.5 px-4 rounded-xl font-semibold flex items-center justify-center gap-2 transition-all ${
                    isPremiumActive
                      ? "bg-cosmic-card hover:bg-slate-900 border-cosmic-border text-gray-200"
                      : "bg-cosmic-card/30 border-dashed border-amber-500/20 text-gray-400 hover:text-amber-400 hover:border-amber-500/40"
                  }`}
                >
                  {isPremiumActive ? (
                    copied ? <Check className="w-3.5 h-3.5 text-green-400" /> : <Copy className="w-3.5 h-3.5 text-gray-400" />
                  ) : (
                    <Key className="w-3.5 h-3.5 text-amber-500/70" />
                  )}
                  {isPremiumActive ? (copied ? "ተገልብጧል (Copied)" : "ትርጓሜውን ኮፒ አድርግ") : "ኮፒ አድርግ (Premium)"}
                </button>
                <button
                  onClick={handleShare}
                  className={`border text-[11px] py-3.5 px-4 rounded-xl font-semibold flex items-center justify-center gap-2 transition-all ${
                    isPremiumActive
                      ? "bg-cosmic-card hover:bg-slate-900 border-cosmic-border text-gray-200"
                      : "bg-cosmic-card/30 border-dashed border-amber-500/20 text-gray-400 hover:text-amber-400 hover:border-amber-500/40"
                  }`}
                >
                  {isPremiumActive ? (
                    <Share2 className="w-3.5 h-3.5 text-gray-400" />
                  ) : (
                    <Key className="w-3.5 h-3.5 text-amber-500/70" />
                  )}
                  {isPremiumActive ? "ለወዳጅ ያጋሩ (Share)" : "ለወዳጅ ያጋሩ (Premium)"}
                </button>
              </div>

              {/* Inline upgrade feedback warning if copying/sharing fails */}
              {shareError && (
                <div className="bg-amber-500/10 border border-amber-500/30 p-3.5 rounded-xl space-y-2 text-center animate-fadeIn relative overflow-hidden">
                  <div className="flex items-center justify-center gap-1.5 text-amber-400 font-bold text-xs">
                    <Key className="w-4 h-4 animate-bounce" />
                    <span>አገልግሎቱ ተቆልፏል (Premium Only)</span>
                  </div>
                  <p className="text-[10px] text-gray-300 leading-relaxed">
                    {shareError}
                  </p>
                  <button
                    onClick={onNavigateToPayment}
                    className="text-[10px] font-extrabold text-amber-400 hover:text-amber-300 transition-colors uppercase tracking-wider underline block mx-auto mt-1"
                  >
                    ክፍያ ፈፅም (Go to Payment Options)
                  </button>
                </div>
              )}
            </div>
          )}
        </>
      )}
    </div>
  );
}
