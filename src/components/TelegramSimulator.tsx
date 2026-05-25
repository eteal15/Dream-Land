import React from "react";
import { User } from "../lib/types";
import { Users, Shield, RefreshCw, Smartphone } from "lucide-react";

interface TelegramSimulatorProps {
  currentUser: User | null;
  onUserSelected: (payload: { id: number; username: string; first_name: string; photo_url: string }) => void;
  onRefresh: () => void;
}

export default function TelegramSimulator({ currentUser, onUserSelected, onRefresh }: TelegramSimulatorProps) {
  const [isOpen, setIsOpen] = React.useState(true);

  const testAccounts = [
    {
      id: 3333333,
      username: "bekele_spirit",
      first_name: "በቀለ (Bekele)",
      photo_url: "https://api.dicebear.com/7.x/bottts/svg?seed=bekele",
      status: "አዲስ ተጠቃሚ - 1 ነፃ ሙከራ የቀረው (New User - 1 Free Remain)"
    },
    {
      id: 1111111,
      username: "yared_dreamer",
      first_name: "ያሬድ (Yared)",
      photo_url: "https://api.dicebear.com/7.x/bottts/svg?seed=yared",
      status: "ነፃ የተጠቀመ - መክፈል ያለበት (Trial Used - Requires Pay)"
    },
    {
      id: 2222222,
      username: "selam_el",
      first_name: "ሰላም (Selam)",
      photo_url: "https://api.dicebear.com/7.x/bottts/svg?seed=selam",
      status: "ፕሪሚየም ተጠቃሚ - ወሰን የሌለው (Premium User - Active)"
    },
    {
      id: 1480652999,
      username: "admin_tester",
      first_name: "አስተዳዳሪ (Admin Tool)",
      photo_url: "https://api.dicebear.com/7.x/bottts/svg?seed=admin",
      status: "የአስተዳዳሪ መቆጣጠሪያ ፓነል (Admin Dashboard Tester - Full Control)"
    }
  ];

  return (
    <div className="bg-cosmic-header border-b border-cosmic-border text-white">
      <div className="max-w-7xl mx-auto px-4 py-2 flex items-center justify-between text-xs">
        <div className="flex items-center gap-2">
          <Smartphone className="w-4 h-4 text-amber-500 animate-pulse" />
          <span className="font-semibold text-transparent bg-clip-text bg-gradient-to-r from-amber-400 to-amber-200">
            🧪 ቴሌግራም ሲሙሌተር (Telegram App Sandbox)
          </span>
        </div>
        <div className="flex items-center gap-3">
          <button 
            onClick={onRefresh}
            title="Update Subscription Data"
            className="flex items-center gap-1 bg-cosmic-border hover:bg-slate-800 text-gray-300 font-medium px-2 py-1 rounded transition-colors"
          >
            <RefreshCw className="w-3 h-3 text-amber-400" />
            አድስ (Sync)
          </button>
          <button 
            onClick={() => setIsOpen(!isOpen)}
            className="bg-amber-500/20 hover:bg-amber-500/30 text-amber-300 font-semibold px-2.5 py-1 rounded transition-colors"
          >
            {isOpen ? "ደብቅ (Hide)" : "አሳይ (Show Users)"}
          </button>
        </div>
      </div>

      {isOpen && (
        <div className="bg-cosmic-bg/95 border-t border-cosmic-border p-4">
          <div className="max-w-7xl mx-auto">
            <p className="text-gray-400 text-xs mb-3 font-sans">
              ይህ ሲሙሌተር መተግበሪያውን በቴሌግራም ውስጥ እንደሚከፍት ለማስመሰል የተዘጋጀ ነው። እባክዎ የአካል ጉዳዩን ለመፈተሽ አንዱን የሙከራ አካውንት ይምረጡ፦
            </p>
            
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              {testAccounts.map((acc) => {
                const isActive = currentUser?.telegram_id === String(acc.id);
                return (
                  <button
                    key={acc.id}
                    onClick={() => onUserSelected(acc)}
                    className={`flex items-start text-left gap-3 p-3 rounded-xl border transition-all ${
                      isActive 
                        ? "bg-amber-500/10 border-amber-500/50 shadow-md shadow-amber-500/5" 
                        : "bg-cosmic-card/50 border-cosmic-border hover:border-slate-700 hover:bg-cosmic-card"
                    }`}
                  >
                    <img 
                      src={acc.photo_url} 
                      alt={acc.first_name} 
                      className="w-10 h-10 rounded-full border border-cosmic-border bg-cosmic-card p-1"
                    />
                    <div className="overflow-hidden">
                      <div className="flex items-center gap-1.5 font-bold text-sm text-gray-100">
                        {acc.first_name}
                        {acc.id === 2222222 && <Shield className="w-3.5 h-3.5 text-amber-400 fill-amber-400/20" />}
                      </div>
                      <div className="text-[10px] text-gray-400 truncate">@{acc.username}</div>
                      <div className="text-[10px] mt-1 text-amber-400/85 font-medium leading-tight">
                        {acc.status}
                      </div>
                    </div>
                  </button>
                );
              })}
            </div>

            {currentUser && (
              <div className="mt-3 pt-3 border-t border-cosmic-border flex flex-wrap items-center justify-between gap-2 text-xs">
                <div className="flex items-center gap-2">
                  <span className="text-gray-400">ገባሪ ተጠቃሚ፦</span>
                  <span className="font-bold text-slate-100">
                    {currentUser.first_name} (@{currentUser.username})
                  </span>
                </div>
                <div className="flex flex-wrap items-center gap-4 text-[11px] text-gray-300">
                  <div>
                    ትርጓሜዎች፦ <span className="font-bold text-amber-400">{currentUser.total_dreams || 0} ጊዜ</span>
                  </div>
                  <div>
                    ቀሪ ነፃ ትርጓሜ፦{" "}
                    <span className="font-bold text-amber-400">
                      {currentUser.free_trial_used ? "0" : "1"}
                    </span>
                  </div>
                  <div>
                    ፕሪሚየም፦{" "}
                    <span className={`font-bold ${currentUser.premium_until && new Date(currentUser.premium_until).getTime() > Date.now() ? "text-green-400" : "text-gray-400"}`}>
                      {currentUser.premium_until && new Date(currentUser.premium_until).getTime() > Date.now()
                        ? `ገባሪ (እስከ ${new Date(currentUser.premium_until).toLocaleDateString("am-ET")})`
                        : "የለም (Inactive)"}
                    </span>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
