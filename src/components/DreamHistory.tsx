import React from "react";
import { Dream, User } from "../lib/types";
import { BookOpen, Calendar, Compass, PlusCircle, Sparkles, AlertCircle, Copy, Share2, Key, Check } from "lucide-react";

interface DreamHistoryProps {
  currentUser: User;
  dreams: Dream[];
  onNavigateToInterpret: () => void;
}

export default function DreamHistory({ currentUser, dreams, onNavigateToInterpret }: DreamHistoryProps) {
  const [expandedId, setExpandedId] = React.useState<string | null>(null);
  const [copiedId, setCopiedId] = React.useState<string | null>(null);
  const [shareError, setShareError] = React.useState<string | null>(null);

  const adminIdFromEnv = import.meta.env.VITE_ADMIN_TELEGRAM_ID;
  const isAdminUser = !!(currentUser && adminIdFromEnv && Number(currentUser.telegram_id) === Number(adminIdFromEnv));
  const isPremiumActive = isAdminUser || (currentUser?.premium_until && new Date(currentUser.premium_until).getTime() > Date.now());

  const handleCopy = (dream: Dream) => {
    if (!isPremiumActive) {
      setShareError("ይቅርታ! የህልም ትርጓሜ መረጃዎችን ኮፒ ማድረግ የሚችሉት ፕሪሚየም ሲሆኑ ብቻ ነው።");
      setTimeout(() => setShareError(null), 4000);
      return;
    }
    const shareableBody = `🌟 የህልም ትርጓሜ (የሕልም መፍቻ) 🌟\n--------------------------------------\nየህልም ፅሁፍ፦ ${dream.dream_text}\nእምነት፦ ${dream.religion}\n\n⛪/🕌 መንፈሳዊ ትርጓሜ፦\n${dream.interpretation.spiritual}\n\n🧠 ስነ-ልቦናዊ ትርጓሜ፦\n${dream.interpretation.psychological}\n\n🔑 ምልክታዊ ትርጓሜ፦\n${dream.interpretation.symbolic}\n\n💡 ምክር፦\n${dream.interpretation.advice}\n\n✨ ዋና መልዕክት፦\n${dream.interpretation.summary}`;
    navigator.clipboard.writeText(shareableBody);
    setCopiedId(dream.id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  const handleShare = (dream: Dream) => {
    if (!isPremiumActive) {
      setShareError("ይቅርታ! ማጋራት የሚችሉት ፕሪሚየም ሲሆኑ ብቻ ነው።");
      setTimeout(() => setShareError(null), 4000);
      return;
    }
    if (navigator.share) {
      navigator.share({
        title: "የሕልም ትርጓሜ",
        text: dream.interpretation.summary,
        url: window.location.href,
      }).catch((err) => {
        // Handle native share cancellations or aborts gracefully
        const errMsg = String(err?.message || err).toLowerCase();
        if (errMsg.includes("cancel") || errMsg.includes("abort") || err?.name === "AbortError") {
          console.log("Share canceled by user.");
          return;
        }
        // Fallback to clipboard if sharing fails due to iframe sandboxing or lack of browser support
        console.warn("Share failed, falling back to copy:", err);
        handleCopy(dream);
      });
    } else {
      handleCopy(dream);
    }
  };

  const toggleExpand = (id: string) => {
    setExpandedId(expandedId === id ? null : id);
  };

  const formatDate = (isoStr: string) => {
    try {
      const date = new Date(isoStr);
      return date.toLocaleDateString("am-ET", {
        year: "numeric",
        month: "long",
        day: "numeric",
        hour: "2-digit",
        minute: "2-digit"
      });
    } catch (e) {
      return isoStr;
    }
  };

  return (
    <div className="space-y-6 max-w-2xl mx-auto px-4 py-4 pb-16">
      
      {/* Tab Banner */}
      <div className="flex items-center justify-between border-b border-cosmic-border/65 pb-3">
        <div className="flex items-center gap-2">
          <BookOpen className="w-5 h-5 text-amber-500" />
          <h2 className="text-base font-bold text-white font-display">የቀደሙ የሕልም ታሪኮች</h2>
        </div>
        <span className="text-[10px] font-mono bg-amber-500/10 text-amber-400 px-2 py-1 rounded bg-slate-900 border border-amber-500/15">
          ጠቅላላ፦ {dreams.length}
        </span>
      </div>

      {/* Share / Copy error notification */}
      {shareError && (
        <div className="bg-amber-500/10 border border-amber-500/30 p-3.5 rounded-xl space-y-2 text-center animate-fadeIn relative overflow-hidden">
          <div className="flex items-center justify-center gap-1.5 text-amber-400 font-bold text-xs">
            <Key className="w-4 h-4 animate-bounce" />
            <span>አገልግሎቱ ተቆልፏል (Premium Only)</span>
          </div>
          <p className="text-[10px] text-gray-300 leading-relaxed">
            {shareError}
          </p>
        </div>
      )}

      {dreams.length === 0 ? (
        <div className="bg-cosmic-card/50 border border-cosmic-border p-8 rounded-2xl text-center space-y-4">
          <div className="inline-flex p-3 rounded-full bg-slate-800 text-gray-400">
            <AlertCircle className="w-8 h-8" />
          </div>
          <div className="space-y-1">
            <h3 className="text-sm font-semibold text-gray-200">ምንም ቀዳሚ ታሪክ የለም!</h3>
            <p className="text-xs text-gray-400 leading-relaxed max-w-xs mx-auto">
              እስካሁን ምንም ህልም አልተረጎሙም። የመጀመሪያ ህልምዎን በመፃፍ የዮሴፍን መንፈሳዊ ጉዞ ይጀምሩ።
            </p>
          </div>
          <button
            onClick={onNavigateToInterpret}
            className="inline-flex items-center gap-2 bg-gradient-to-r from-amber-400 to-amber-500 hover:from-amber-500 hover:to-amber-600 text-black text-xs font-bold py-2.5 px-4 rounded-xl transition-colors cursor-pointer"
          >
            <PlusCircle className="w-4 h-4" />
            ህልም ለመፍታት (Start Interpretation)
          </button>
        </div>
      ) : (
        <div className="space-y-3">
          {dreams.map((dream, index) => {
            const isExpanded = expandedId === dream.id;
            return (
              <div 
                key={dream.id}
                className="bg-cosmic-card border border-cosmic-border rounded-xl hover:border-slate-700 transition-all overflow-hidden"
              >
                {/* Header card trigger */}
                <button
                  onClick={() => toggleExpand(dream.id)}
                  className="w-full text-left p-4 flex items-start gap-3 focus:outline-none transition-colors hover:bg-slate-900/40"
                >
                  <div className="w-8 h-8 rounded-lg bg-amber-500/10 flex-shrink-0 flex items-center justify-center text-amber-500 font-bold border border-amber-500/15 text-xs">
                    {dreams.length - index}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-xs text-gray-300 font-sans line-clamp-2 md:line-clamp-1 leading-normal">
                      "{dream.dream_text}"
                    </p>
                    <div className="flex flex-wrap items-center gap-3 mt-1.5 text-[10px] text-gray-400">
                      <span className="flex items-center gap-1">
                        <Calendar className="w-3 h-3 text-amber-600" />
                        {formatDate(dream.created_at)}
                      </span>
                      <span className="flex items-center gap-1 bg-slate-900 px-1.5 py-0.5 rounded border border-cosmic-border/60">
                        <Compass className="w-3 h-3 text-purple-400" />
                        {dream.religion}
                      </span>
                    </div>
                  </div>
                </button>

                {/* Expanded Sections */}
                {isExpanded && (
                  <div className={`p-4 pt-1 border-t border-cosmic-border/60 bg-cosmic-bg/40 space-y-4 animate-fadeIn ${!isPremiumActive ? "select-none" : ""}`}>
                    <div className="p-3 bg-cosmic-card border border-slate-900 rounded-lg text-xs leading-5 text-gray-400 italic">
                      የቀረበ የህልም ዝርዝር፦ "{dream.dream_text}"
                    </div>

                    {/* Perspected outputs */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div className="space-y-1">
                        <div className="text-[10px] font-bold text-amber-400 flex items-center gap-1 border-b border-cosmic-border pb-1">
                          <Compass className="w-3.5 h-3.5" />
                          መንፈሳዊ ትርጓሜ ({dream.religion})
                        </div>
                        <p className="text-xs text-gray-300 leading- relaxed">
                          {dream.interpretation.spiritual}
                        </p>
                      </div>

                      <div className="space-y-1">
                        <div className="text-[10px] font-bold text-purple-400 flex items-center gap-1 border-b border-cosmic-border pb-1">
                          <Compass className="w-3.5 h-3.5 text-purple-500" />
                          ስነ-ልቦናዊ ትርጓሜ
                        </div>
                        <p className="text-xs text-gray-300 leading-relaxed">
                          {dream.interpretation.psychological}
                        </p>
                      </div>

                      <div className="space-y-1">
                        <div className="text-[10px] font-bold text-blue-400 flex items-center gap-1 border-b border-cosmic-border pb-1">
                          <Compass className="w-3.5 h-3.5 text-blue-500" />
                          ምልክታዊ ትርጓሜ
                        </div>
                        <p className="text-xs text-gray-300 leading-relaxed">
                          {dream.interpretation.symbolic}
                        </p>
                      </div>

                      <div className="space-y-1">
                        <div className="text-[10px] font-bold text-teal-400 flex items-center gap-1 border-b border-cosmic-border pb-1">
                          <Compass className="w-3.5 h-3.5 text-teal-500" />
                          ምክር እና እገዛ
                        </div>
                        <p className="text-xs text-gray-300 leading-relaxed">
                          {dream.interpretation.advice}
                        </p>
                      </div>
                    </div>

                    <div className="bg-amber-500/5 border border-amber-500/15 p-3 rounded-lg space-y-1">
                      <div className="text-[11px] font-bold text-amber-500 flex items-center gap-1">
                        <Sparkles className="w-3 h-3 animate-pulse" />
                        ማጠቃለያ ድምዳሜ
                      </div>
                      <p className="text-xs text-gray-200 italic leading-relaxed">
                        "{dream.interpretation.summary}"
                      </p>
                    </div>

                    <div className="grid grid-cols-2 gap-3 pt-2">
                       <button
                         onClick={(e) => { e.stopPropagation(); handleCopy(dream); }}
                         className={`border text-[11px] py-2.5 px-4 rounded-xl font-semibold flex items-center justify-center gap-2 transition-all ${
                           isPremiumActive
                             ? "bg-cosmic-card hover:bg-slate-900 border-cosmic-border text-gray-200"
                             : "bg-cosmic-card/30 border-dashed border-amber-500/20 text-gray-400 hover:text-amber-400 hover:border-amber-500/40"
                         }`}
                       >
                         {isPremiumActive ? (
                           copiedId === dream.id ? <Check className="w-3.5 h-3.5 text-green-400" /> : <Copy className="w-3.5 h-3.5 text-gray-400" />
                         ) : (
                           <Key className="w-3.5 h-3.5 text-amber-500/70" />
                         )}
                         {isPremiumActive ? (copiedId === dream.id ? "ተገልብጧል" : "ኮፒ አድርግ") : "ኮፒ (Premium)"}
                       </button>
                       <button
                         onClick={(e) => { e.stopPropagation(); handleShare(dream); }}
                         className={`border text-[11px] py-2.5 px-4 rounded-xl font-semibold flex items-center justify-center gap-2 transition-all ${
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
                         {isPremiumActive ? "ያጋሩ (Share)" : "ያጋሩ (Premium)"}
                       </button>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
