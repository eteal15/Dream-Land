import fs from "fs";
import path from "path";
import { User, Dream, Payment, Analytics, ReligionType, PaymentPlanType, BotConfig } from "./lib/types";

// DB structure
interface DatabaseSchema {
  users: Record<string, User>; // Key is telegram_id
  dreams: Dream[];
  payments: Payment[];
  admins: { username: string; token: string }[];
  botConfig?: BotConfig;
}

const DB_FILE = path.join(process.cwd(), "db.json");

class LocalDB {
  private data: DatabaseSchema = {
    users: {},
    dreams: [],
    payments: [],
    admins: [
      { username: "admin", token: "admin-token-12345" }
    ]
  };

  constructor() {
    this.load();
  }

  private load() {
    try {
      if (fs.existsSync(DB_FILE)) {
        const raw = fs.readFileSync(DB_FILE, "utf-8");
        this.data = JSON.parse(raw);
        // Ensure defaults if keys are missing
        if (!this.data.users) this.data.users = {};
        if (!this.data.dreams) this.data.dreams = [];
        if (!this.data.payments) this.data.payments = [];
        if (!this.data.admins) this.data.admins = [{ username: "admin", token: "admin-token-12345" }];

        // Systematic cleanup of hardcoded legacy mock profiles if they exist
        const defaultSampleIds = ["1111111", "2222222", "3333333"];
        let dataCleaned = false;
        
        defaultSampleIds.forEach((id) => {
          if (this.data.users[id]) {
            delete this.data.users[id];
            dataCleaned = true;
          }
        });

        const initialDreamsLen = this.data.dreams.length;
        this.data.dreams = this.data.dreams.filter((d) => !defaultSampleIds.includes(d.user_id));
        if (this.data.dreams.length !== initialDreamsLen) {
          dataCleaned = true;
        }

        const initialPaymentsLen = this.data.payments.length;
        this.data.payments = this.data.payments.filter((p) => !defaultSampleIds.includes(p.user_id));
        if (this.data.payments.length !== initialPaymentsLen) {
          dataCleaned = true;
        }

        if (dataCleaned) {
          this.save();
        }
      } else {
        this.seedInitialData();
        this.save();
      }
    } catch (e) {
      console.error("Failed to load database. Initializing with defaults.", e);
      this.seedInitialData();
      this.save();
    }
  }

  private save() {
    try {
      fs.writeFileSync(DB_FILE, JSON.stringify(this.data, null, 2), "utf-8");
    } catch (e) {
      console.error("Failed to save database:", e);
    }
  }

  private seedInitialData() {
    // Fresh app release uses clean initial database with zero sample placeholders
    this.data.users = {};
    this.data.dreams = [];
    this.data.payments = [];
  }

  // --- Users Operations ---
  getUser(telegramId: string): User | null {
    return this.data.users[telegramId] || null;
  }

  getOrCreateUser(telegramId: string, username: string, firstName: string, photoUrl: string): User {
    let user = this.data.users[telegramId];
    if (!user) {
      user = {
        telegram_id: telegramId,
        username: username || "የሌለው",
        first_name: firstName || "እንግዳ",
        profile_photo: photoUrl || `https://api.dicebear.com/7.x/bottts/svg?seed=${telegramId}`,
        created_at: new Date().toISOString(),
        free_trial_used: false,
        dream_credits: 1, // Under rule, users get exactly 1 free interpretation
        premium_until: null,
        total_dreams: 0
      };
      this.data.users[telegramId] = user;
      this.save();
    }
    return user;
  }

  updateUser(telegramId: string, updates: Partial<User>): User | null {
    const user = this.data.users[telegramId];
    if (user) {
      this.data.users[telegramId] = { ...user, ...updates };
      this.save();
      return this.data.users[telegramId];
    }
    return null;
  }

  getAllUsers(): User[] {
    return Object.values(this.data.users);
  }

  // --- Dreams Operations ---
  getDreamsByUserId(userId: string): Dream[] {
    return this.data.dreams
      .filter((d) => d.user_id === userId)
      .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
  }

  saveDream(dream: Omit<Dream, "id" | "created_at">): Dream {
    const newDream: Dream = {
      ...dream,
      id: "dream_" + Math.random().toString(36).substring(2, 11),
      created_at: new Date().toISOString()
    };
    this.data.dreams.push(newDream);

    // Update user stats
    const user = this.data.users[dream.user_id];
    if (user) {
      user.total_dreams = (user.total_dreams || 0) + 1;
      
      // Consume credit if appropriate
      if (!user.premium_until || new Date(user.premium_until).getTime() < Date.now()) {
        // Not premium, consume credit/free trial
        if (!user.free_trial_used) {
          user.free_trial_used = true;
          user.dream_credits = Math.max(0, user.dream_credits - 1);
        } else if (user.dream_credits > 0) {
          user.dream_credits = Math.max(0, user.dream_credits - 1);
        }
      }
      this.data.users[dream.user_id] = user;
    }

    this.save();
    return newDream;
  }

  // --- Payments Operations ---
  getPaymentsByUserId(userId: string): Payment[] {
    return this.data.payments
      .filter((p) => p.user_id === userId)
      .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
  }

  createPayment(userId: string, planType: PaymentPlanType, amount: number, screenshotUrl: string): Payment {
    const user = this.data.users[userId];
    const newPayment: Payment = {
      id: "pay_" + Math.random().toString(36).substring(2, 11),
      user_id: userId,
      username: user ? user.username : "ያልታወቀ",
      first_name: user ? user.first_name : "ያልታወቀ",
      plan_type: planType,
      amount,
      screenshot_url: screenshotUrl,
      status: "pending",
      created_at: new Date().toISOString(),
      approved_at: null
    };
    this.data.payments.push(newPayment);
    this.save();
    return newPayment;
  }

  getAllPayments(): Payment[] {
    return this.data.payments.sort(
      (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
    );
  }

  approvePayment(paymentId: string): Payment | null {
    const payment = this.data.payments.find((p) => p.id === paymentId);
    if (payment && payment.status === "pending") {
      payment.status = "approved";
      payment.approved_at = new Date().toISOString();

      // Update user access!
      const user = this.data.users[payment.user_id];
      if (user) {
        if (payment.plan_type === "single") {
          // Gives unlimited dream credits for 1 day
          // Since "premium_until" indicates unlimited, we can set premium_until to 1 day from now
          const oneDay = new Date(Date.now() + 24 * 60 * 60 * 1000);
          user.premium_until = oneDay.toISOString();
        } else if (payment.plan_type === "premium") {
          // Gives unlimited dream credits for 30 days
          const thirtyDays = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);
          user.premium_until = thirtyDays.toISOString();
        }
        this.data.users[payment.user_id] = user;
      }
      this.save();
      return payment;
    }
    return null;
  }

  rejectPayment(paymentId: string): Payment | null {
    const payment = this.data.payments.find((p) => p.id === paymentId);
    if (payment && payment.status === "pending") {
      payment.status = "rejected";
      this.save();
      return payment;
    }
    return null;
  }

  // --- Admins Operations ---
  verifyAdminToken(token: string): boolean {
    return this.data.admins.some((a) => a.token === token);
  }

  // --- Analytics Operations ---
  getAnalytics(): Analytics {
    const users = Object.values(this.data.users);
    const payments = this.data.payments;
    const now = Date.now();

    const premiumUsersCount = users.filter(
      (u) => u.premium_until && new Date(u.premium_until).getTime() > now
    ).length;

    const totalPayments = payments.length;
    const pendingPaymentsCount = payments.filter((p) => p.status === "pending").length;
    const approvedPayments = payments.filter((p) => p.status === "approved");
    const revenue = approvedPayments.reduce((acc, p) => acc + p.amount, 0);

    return {
      totalUsers: users.length,
      activeUsers: users.filter((u) => u.total_dreams > 0 || payments.some((p) => p.user_id === u.telegram_id)).length,
      totalPayments,
      pendingPaymentsCount,
      premiumUsersCount,
      revenue
    };
  }

  // --- Bot Config Operations ---
  getBotConfig(): BotConfig | null {
    return this.data.botConfig || null;
  }

  saveBotConfig(config: BotConfig): void {
    this.data.botConfig = config;
    this.save();
  }
}

export const db = new LocalDB();
