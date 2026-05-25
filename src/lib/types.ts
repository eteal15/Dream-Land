export interface TelegramUser {
  id: number;
  username?: string;
  first_name?: string;
  last_name?: string;
  photo_url?: string;
}

export interface User {
  telegram_id: string; // Stored as string for safety
  username: string;
  first_name: string;
  profile_photo: string;
  created_at: string;
  free_trial_used: boolean;
  dream_credits: number;
  premium_until: string | null; // ISO Date String
  total_dreams: number;
}

export type ReligionType = "Orthodox" | "Muslim" | "Catholic" | "Protestant";

export interface Dream {
  id: string;
  user_id: string;
  dream_text: string;
  religion: ReligionType;
  interpretation: {
    spiritual: string;
    psychological: string;
    symbolic: string;
    advice: string;
    summary: string;
  };
  created_at: string;
}

export type PaymentPlanType = "single" | "premium";
export type PaymentStatusType = "pending" | "approved" | "rejected";

export interface Payment {
  id: string;
  user_id: string;
  username: string;       // Saved for convenient admin display
  first_name: string;     // Saved for convenient admin display
  plan_type: PaymentPlanType;
  amount: number;
  screenshot_url: string; // Base64 encoding of image
  status: PaymentStatusType;
  created_at: string;
  approved_at: string | null;
}

export interface Admin {
  id: string;
  username: string;
  created_at: string;
}

export interface BotConfig {
  bot_token: string;
  admin_chat_id: string;
}

export interface Analytics {
  totalUsers: number;
  activeUsers: number; // Users with dreams or payments
  totalPayments: number;
  pendingPaymentsCount: number;
  premiumUsersCount: number;
  revenue: number;
}
