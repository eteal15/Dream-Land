import { User, Dream, Payment, Analytics } from "./types";

export async function authTelegram(payload: {
  id: string | number;
  username?: string;
  first_name?: string;
  photo_url?: string;
}) {
  const res = await fetch("/api/auth/telegram", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  if (!res.ok) {
    const err = await res.json();
    throw new Error(err.error || "Authentication failed");
  }
  return res.json() as Promise<{ success: boolean; user: User }>;
}

export async function getUserProfile(telegramId: string) {
  const res = await fetch(`/api/users/${telegramId}`);
  if (!res.ok) throw new Error("Could not fetch user profile");
  return res.json() as Promise<{ user: User }>;
}

export async function interpretDream(payload: {
  user_id: string;
  dream_text: string;
  religion: string;
}) {
  const res = await fetch("/api/dreams/interpret", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  if (!res.ok) {
    const err = await res.json();
    throw new Error(err.error || err.message || "የህልም ትርጓሜ ሲሰራ ተሳስቷል");
  }
  return res.json() as Promise<{ success: boolean; dream: Dream; user: User }>;
}

export async function getDreamHistory(userId: string) {
  const res = await fetch(`/api/dreams/${userId}`);
  if (!res.ok) throw new Error("Could not fetch dream history");
  return res.json() as Promise<{ dreams: Dream[] }>;
}

export async function submitPayment(payload: {
  user_id: string;
  plan_type: "single" | "premium";
  amount: number;
  screenshot_url: string; // Base64 encoding
}) {
  const res = await fetch("/api/payments/submit", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  if (!res.ok) throw new Error("ክፍያ ማስገባት አልተቻለም። እባኮትን እንደገና ይሞክሩ።");
  return res.json() as Promise<{ success: boolean; payment: Payment }>;
}

export async function getUserPayments(userId: string) {
  const res = await fetch(`/api/payments/user/${userId}`);
  if (!res.ok) throw new Error("Could not fetch user payments");
  return res.json() as Promise<{ payments: Payment[] }>;
}

// --- ADMIN API ---

export async function adminLogin(payload: { username: string; password: string }) {
  const res = await fetch("/api/admin/login", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  if (!res.ok) {
    const err = await res.json();
    throw new Error(err.error || "የተሳሳተ የይለፍ ቃል!");
  }
  return res.json() as Promise<{ success: boolean; token: string }>;
}

export async function getAdminAnalytics(token: string) {
  const res = await fetch("/api/admin/analytics", {
    headers: { Authorization: token },
  });
  if (!res.ok) throw new Error("Failed to load admin analytics");
  return res.json() as Promise<{ analytics: Analytics }>;
}

export async function getAdminUsers(token: string) {
  const res = await fetch("/api/admin/users", {
    headers: { Authorization: token },
  });
  if (!res.ok) throw new Error("Failed to load admin users");
  return res.json() as Promise<{ users: User[] }>;
}

export async function getAdminPayments(token: string) {
  const res = await fetch("/api/admin/payments", {
    headers: { Authorization: token },
  });
  if (!res.ok) throw new Error("Failed to load admin payments");
  return res.json() as Promise<{ payments: Payment[] }>;
}

export async function processAdminAction(token: string, paymentId: string, action: "approve" | "reject") {
  const res = await fetch(`/api/admin/payments/${paymentId}/action`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: token,
    },
    body: JSON.stringify({ action }),
  });
  if (!res.ok) {
    const err = await res.json();
    throw new Error(err.error || "Action process failed");
  }
  return res.json() as Promise<{ success: boolean; payment: Payment }>;
}

export async function getBotNotifications() {
  const res = await fetch("/api/admin/bot-notifications");
  if (!res.ok) throw new Error("Failed to load bot notifications");
  return res.json() as Promise<{ notifications: any[] }>;
}

export async function getBotConfig(token: string) {
  const res = await fetch("/api/admin/bot-config", {
    headers: { "Authorization": token }
  });
  if (!res.ok) throw new Error("Failed to load bot config");
  return res.json() as Promise<{ config: { bot_token: string, admin_chat_id: string } }>;
}

export async function saveBotConfig(token: string, payload: { bot_token: string, admin_chat_id: string }) {
  const res = await fetch("/api/admin/bot-config", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": token
    },
    body: JSON.stringify(payload)
  });
  if (!res.ok) throw new Error("Failed to save bot config");
  return res.json();
}
