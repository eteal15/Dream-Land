import React from "react";
import { User, PaymentPlanType, Payment } from "../lib/types";
import { submitPayment, getUserPayments } from "../lib/api";
import { Coins, CheckCircle, Smartphone, UploadCloud, Copy, RefreshCw, Layers, ShieldCheck, AlertCircle } from "lucide-react";

interface PaymentModalProps {
  currentUser: User | null;
  onPaymentSubmitted: () => void;
}

export default function PaymentModal({ currentUser, onPaymentSubmitted }: PaymentModalProps) {
  const [selectedPlan, setSelectedPlan] = React.useState<PaymentPlanType>("premium");
  const [screenshotImg, setScreenshotImg] = React.useState<string | null>(null);
  const [submitting, setSubmitting] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [copiedId, setCopiedId] = React.useState<string | null>(null);
  const [success, setSuccess] = React.useState(false);
  const [pastPayments, setPastPayments] = React.useState<Payment[]>([]);
  const [loadingHistory, setLoadingHistory] = React.useState(false);

  const telebirrNumber = import.meta.env.VITE_TELEBIRR_NUMBER || "0912345678";
  const telebirrName = import.meta.env.VITE_TELEBIRR_NAME || "ዮሴፍ የህልም መፍቻ መለያ (Joseph Dream Account)";

  const plans = [
    {
      id: "single" as PaymentPlanType,
      title: "ባለ ፩ ቀን እቅድ (Single Day Plan)",
      price: "59",
      description: "ለአንድ ሙሉ ቀን ያለምንም ገደብ የተሟላ የህልም ፍቺዎችን ይጠቀሙ።",
      features: ["የተወሰነ የ 24 ሰዓት ፍቃድ", "መንፈሳዊ + ምልክታዊ ትንተና", "ሙሉ የህልም ታሪክ ማስቀመጫ", "ቅጂ መውሰጃና ለወዳጅ ማጋሪያ"]
    },
    {
      id: "premium" as PaymentPlanType,
      title: "ወርሃዊ ፕሪሚየም (30 Days Unlimited)",
      price: "259",
      description: "ለ30 ተከታታይ ቀናት በየሰዓቱ የህልሞችዎን ሚስጥር ያለገደብ ይፍቱ።",
      features: ["የ 30 ቀናት ያልተገደበ ፍቃድ", "ፈጣን የ AI ማቀነባበሪያ ፍጥነት", "ተመራጭ የሃይማኖት ትንተና ምርጫ", "የዕለት ተዕለት ህልም ማስታወሻ", "ልዩ የቴክኒክ ድጋፍ"]
    }
  ];

  const fetchHistory = async () => {
    if (!currentUser) return;
    setLoadingHistory(true);
    try {
      const res = await getUserPayments(currentUser.telegram_id);
      setPastPayments(res.payments);
    } catch (e) {
      console.error("Failed to load payment history:", e);
    } finally {
      setLoadingHistory(false);
    }
  };

  React.useEffect(() => {
    fetchHistory();
  }, [currentUser]);

  const handleCopy = (text: string, id: string) => {
    navigator.clipboard.writeText(text);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 1500);
  };

  // Convert uploaded image file to base64
  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      if (file.size > 8 * 1024 * 1024) {
        setError("የስክሪንሾት ፎቶ ከ 8MB መብለጥ የለበትም!");
        return;
      }
      const reader = new FileReader();
      reader.onload = () => {
        setScreenshotImg(reader.result as string);
        setError(null);
      };
      reader.onerror = () => {
        setError("ፎቶውን ማንበብ አልተቻለም።");
      };
      reader.readAsDataURL(file);
    }
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    const file = e.dataTransfer.files?.[0];
    if (file) {
      if (file.size > 8 * 1024 * 1024) {
        setError("የስክሪንሾት ፎቶ ከ 8MB መብለጥ የለበትም!");
        return;
      }
      const reader = new FileReader();
      reader.onload = () => {
        setScreenshotImg(reader.result as string);
        setError(null);
      };
      reader.readAsDataURL(file);
    }
  };

  const handleSubmitVerification = async () => {
    if (!currentUser) {
      setError("እባክዎን መጀመሪያ የቴሌግራም ሲሙሌተር አካውንት ይምረጡ!");
      return;
    }
    if (!screenshotImg) {
      setError("የቴሌብር ስክሪንሾት ፎቶ መስቀል ግዴታ ነው!");
      return;
    }

    const planData = plans.find(p => p.id === selectedPlan);
    const amount = planData ? Number(planData.price) : 0;

    setSubmitting(true);
    setError(null);

    try {
      const res = await submitPayment({
        user_id: currentUser.telegram_id,
        plan_type: selectedPlan,
        amount,
        screenshot_url: screenshotImg
      });

      if (res.success) {
        setSuccess(true);
        setScreenshotImg(null);
        fetchHistory();
        onPaymentSubmitted();
      }
    } catch (err: any) {
      setError(err.message || "የክፍያ ማረጋገጫ ማስገባት አልተቻለም።");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="space-y-6 max-w-2xl mx-auto px-4 py-4 pb-16">
      
      {/* Title */}
      <div className="flex items-center gap-2 border-b border-cosmic-border/65 pb-3 justify-between">
        <div className="flex items-center gap-2">
          <Coins className="w-5 h-5 text-amber-500" />
          <h2 className="text-base font-bold text-white font-display">የክፍያ እቅዶች እና ፕሪሚየም</h2>
        </div>
        <button 
          onClick={fetchHistory}
          className="p-1 rounded bg-slate-900 border border-cosmic-border hover:border-slate-700"
          title="Refresh Billing Status"
        >
          <RefreshCw className="w-3.5 h-3.5 text-gray-400" />
        </button>
      </div>

      {success ? (
        <div className="bg-cosmic-card border border-green-500/20 p-6 rounded-2xl text-center space-y-4">
          <div className="inline-flex p-3 rounded-full bg-green-500/10 text-green-500">
            <CheckCircle className="w-8 h-8" />
          </div>
          <div className="space-y-2">
            <h3 className="text-base font-bold text-white">ክፍያዎ በተሳካ ሁኔታ ተልኳል!</h3>
            <p className="text-xs text-gray-300 leading-relaxed max-w-sm mx-auto">
              የላኩት የቴሌብር ክፍያ ስክሪንሾት ለአስተዳዳሪ ቀርቧል። መረጃው ተገምግሞ እንደተረጋገጠ (ብዙውን ጊዜ ከ 5-15 ደቂቃዎች ውስጥ) አካውንትዎ በራስ-ሰር ይነቃል። እናመሰግናለን!
            </p>
          </div>
          <button
            onClick={() => setSuccess(false)}
            className="bg-slate-900 hover:bg-slate-800 text-amber-400 border border-amber-500/20 text-xs font-semibold py-2 px-5 rounded-lg transition-colors"
          >
            አዲስ ክፍያ አስገባ (Submit Another)
          </button>
        </div>
      ) : (
        <div className="space-y-6">
          {/* Card plans grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {plans.map((p) => {
              const isSelected = selectedPlan === p.id;
              return (
                <button
                  key={p.id}
                  onClick={() => {
                    setSelectedPlan(p.id);
                    setSuccess(false);
                  }}
                  className={`text-left p-5 rounded-2xl border transition-all flex flex-col justify-between relative overflow-hidden ${
                    isSelected
                      ? "bg-amber-500/5 border-amber-500/50 shadow-lg shadow-amber-500/5"
                      : "bg-cosmic-card border-cosmic-border hover:border-slate-700"
                  }`}
                >
                  {isSelected && (
                    <div className="absolute top-0 right-0 bg-amber-500 text-black text-[9px] font-black px-2.5 py-1 rounded-bl-lg tracking-wider uppercase">
                      ገባሪ ምርጫ
                    </div>
                  )}
                  <div className="space-y-2">
                    <h3 className="text-xs font-bold text-gray-300">{p.title}</h3>
                    <div className="flex items-baseline gap-1 text-white">
                      <span className="text-2xl font-black font-display">{p.price}</span>
                      <span className="text-[10px] font-semibold text-gray-400">ETB</span>
                    </div>
                    <p className="text-[10px] text-gray-400 leading-relaxed font-sans">{p.description}</p>
                    <ul className="space-y-1.5 pt-3 border-t border-cosmic-border/60">
                      {p.features.map((feat, i) => (
                        <li key={i} className="text-[10px] text-gray-300 flex items-center gap-1.5">
                          <ShieldCheck className="w-3.5 h-3.5 text-amber-500" />
                          <span>{feat}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                </button>
              );
            })}
          </div>

          {/* Checkout Steps */}
          <div className="bg-cosmic-card border border-cosmic-border rounded-xl p-5 space-y-4">
            <h3 className="text-xs font-bold text-amber-400 flex items-center gap-1.5 pb-2 border-b border-cosmic-border/60">
              <Smartphone className="w-4 h-4 text-amber-500" />
              በቴሌብር ክፍያ መመሪያ (Telebirr Checkout Guide)
            </h3>

            <div className="space-y-3.5 text-xs text-gray-300">
              <div className="space-y-1 bg-cosmic-bg border border-cosmic-border p-3.5 rounded-xl flex items-center justify-between">
                <div>
                  <div className="text-[11px] text-gray-400">የቴሌብር ስልክ ቁጥር፦</div>
                  <div className="text-sm font-black text-white font-mono">{telebirrNumber}</div>
                  <div className="text-[10px] text-amber-500/90 leading-tight mt-0.5">{telebirrName}</div>
                </div>
                <button
                  onClick={() => handleCopy(telebirrNumber, "phone")}
                  className="bg-cosmic-card hover:bg-slate-800 border border-cosmic-border/80 text-gray-300 px-3 py-2 rounded-lg flex items-center gap-1 hover:text-white transition-colors"
                >
                  <Copy className="w-3.5 h-3.5" />
                  <span>{copiedId === "phone" ? "ተገልብጧል" : "ኮፒ አድርግ"}</span>
                </button>
              </div>

              <div className="space-y-2 font-sans pl-1 text-[11px] leading-relaxed">
                <div className="flex gap-2">
                  <span className="text-amber-500 font-bold">፩.</span>
                  <span>የእርስዎን የቴሌብር መተግበሪያ (Telebirr App) ይክፈቱ ወይም በስልክዎ <span className="font-bold text-white">*127#</span> ይደውሉ።</span>
                </div>
                <div className="flex gap-2">
                  <span className="text-amber-500 font-bold">፪.</span>
                  <span>ገንዘብ መላኪያ ወይም መክፈያ (Transfer Money) በመምረጥ ወደ ስልክ ቁጥር <span className="font-semibold text-white">{telebirrNumber}</span> ያስገቡ።</span>
                </div>
                <div className="flex gap-2">
                  <span className="text-amber-500 font-bold">፫.</span>
                  <span>የመረጡትን ፕላን የብር መጠን <span className="font-bold text-white">({selectedPlan === "single" ? "59" : "259"} ETB)</span> በትክክል ይላኩ።</span>
                </div>
                <div className="flex gap-2">
                  <span className="text-amber-500 font-bold">፬.</span>
                  <span>ክፍያው በተሳካ ሁኔታ ከተጠናቀቀ በኋላ የስክሪን ማረጋገጫ ምስል (Screenshot) ስዕል ያንሱ።</span>
                </div>
              </div>
            </div>

            {/* Drag & Drop screenshot uploader */}
            <div className="space-y-2">
              <label className="text-[11px] font-semibold text-gray-300 block">
                የተላከውን ክፍያ ማረጋገጫ ፎቶ መቅረጫ (Screenshot) እዚህ ይጫኑ፦
              </label>

              <div
                onDragOver={handleDragOver}
                onDrop={handleDrop}
                className="border-2 border-dashed border-cosmic-border/80 hover:border-amber-500/50 rounded-xl p-5 text-center cursor-pointer transition-colors bg-cosmic-bg/40 hover:bg-cosmic-bg/80 relative"
              >
                <input
                  type="file"
                  id="screenshot-input"
                  accept="image/*"
                  onChange={handleFileChange}
                  className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                />

                {screenshotImg ? (
                  <div className="space-y-2 relative z-10 flex flex-col items-center">
                    <img
                      src={screenshotImg}
                      alt="Screenshot Check"
                      className="w-24 h-24 object-contain rounded-lg border border-cosmic-border bg-slate-900 p-1"
                    />
                    <p className="text-[10px] text-green-400 font-semibold font-sans">
                      ✓ የክፍያ ፎቶ በትክክል ተዘጋጅቷል
                    </p>
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        setScreenshotImg(null);
                      }}
                      className="text-[9px] bg-red-500/20 hover:bg-red-500/30 text-red-300 font-bold px-2 py-0.5 rounded transition-colors"
                    >
                      ሰርዝ (Remove Image)
                    </button>
                  </div>
                ) : (
                  <div className="space-y-1.5 text-gray-400">
                    <UploadCloud className="w-8 h-8 text-amber-500/75 mx-auto" />
                    <p className="text-xs font-semibold text-gray-200">
                      የስክሪንሾት ማረጋገጫ ምስል እዚህ ይጎትቱ ወይም ይጫኑ
                    </p>
                    <p className="text-[10px]">PNG፣ JPG (እስከ 8MB)</p>
                  </div>
                )}
              </div>
            </div>

            {error && (
              <p className="text-xs text-red-400 bg-red-500/10 border border-red-500/20 px-3 py-2 rounded-lg text-center font-sans">
                ⚠️ {error}
              </p>
            )}

            <button
              onClick={handleSubmitVerification}
              disabled={submitting || !screenshotImg}
              className={`w-full font-bold py-3 px-6 rounded-xl text-xs transition-all shadow-lg flex items-center justify-center gap-2 ${
                submitting || !screenshotImg
                  ? "bg-cosmic-border border border-cosmic-border text-gray-500 cursor-not-allowed"
                  : "bg-gradient-to-r from-amber-400 to-amber-500 hover:from-amber-500 hover:to-amber-600 text-black shadow-amber-500/10 hover:shadow-amber-500/20"
              }`}
            >
              {submitting ? "በማስረከብ ላይ..." : "የክፍያ ማረጋገጫ ምስሉን አስረክብ (Submit Verification)"}
            </button>
          </div>
        </div>
      )}

      {/* History panel */}
      <div className="bg-cosmic-card border border-cosmic-border rounded-xl p-4.5 space-y-3">
        <h4 className="text-xs font-bold text-gray-200 flex items-center gap-2">
          <Layers className="w-4 h-4 text-gray-400" />
          የእርስዎ የክፍያ ታሪኮች (Your Verification Logs)
        </h4>

        {loadingHistory ? (
          <div className="text-center text-xs text-gray-500 py-4 animate-pulse">
            ታሪኮችን በማንበብ ላይ...
          </div>
        ) : pastPayments.length === 0 ? (
          <div className="text-center text-[10px] text-gray-500 py-3">
            ምንም የተመዘገበ የክፍያ ሙከራ የለም።
          </div>
        ) : (
          <div className="divide-y divide-cosmic-border/60">
            {pastPayments.map((pay) => (
              <div key={pay.id} className="py-2.5 flex items-center justify-between gap-2 text-xs">
                <div>
                  <div className="font-semibold text-gray-300">
                    {pay.plan_type === "single" ? "59 ETB (ባለ 1 ቀን እቅድ)" : "259 ETB (የወር ፕሪሚየም)"}
                  </div>
                  <div className="text-[9px] text-gray-500">
                    የተከፈለበት ሰዓት፦ {new Date(pay.created_at).toLocaleDateString("am-ET")}
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                    pay.status === "approved"
                      ? "bg-green-500/10 text-green-400 border border-green-500/15"
                      : pay.status === "rejected"
                      ? "bg-red-500/10 text-red-400 border border-red-500/15"
                      : "bg-amber-500/10 text-amber-400 border border-amber-500/15 animate-pulse"
                  }`}>
                    {pay.status === "approved" ? "የፀደቀ (Approved)" : pay.status === "rejected" ? "ውድቅ የተደረገ (Rejected)" : "በሂደት ላይ (Pending)"}
                  </span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

    </div>
  );
}
