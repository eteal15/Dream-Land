import express from "express";
import path from "path";
import { createServer as createViteServer } from "vite";
import dotenv from "dotenv";
import { GoogleGenAI, Type } from "@google/genai";
import { db } from "./src/db";
import { ReligionType, PaymentPlanType } from "./src/lib/types";

dotenv.config();

const app = express();
const PORT = 3000;

// Set up server-side parse body limits
app.use(express.json({ limit: "50mb" }));
app.use(express.urlencoded({ extended: true, limit: "50mb" }));

// In-memory log of Telegram bot notifications for Admin Simulation
interface BotNotification {
  id: string;
  user_id: string;
  username: string;
  plan_type: PaymentPlanType;
  amount: number;
  screenshot_url: string;
  created_at: string;
  payment_id: string;
  status: "pending" | "approved" | "rejected";
}
let botNotifications: BotNotification[] = [];

// Initialize Gemini Client
let ai: GoogleGenAI | null = null;
try {
  const apiKey = process.env.GEMINI_API_KEY;
  if (apiKey) {
    ai = new GoogleGenAI({
      apiKey: apiKey,
      httpOptions: {
        headers: {
          "User-Agent": "aistudio-build",
        },
      },
    });
    console.log("Gemini AI Client initialized successfully.");
  } else {
    console.warn("GEMINI_API_KEY is missing in env. AI dream interpretation will use intelligent fallback responses.");
  }
} catch (e) {
  console.error("Failed to initialize Gemini Client:", e);
}

// Function to send REAL Telegram message if credentials are configured
async function sendTelegramNotification(notification: BotNotification) {
  const botConfig = db.getBotConfig();
  const botToken = botConfig?.bot_token || process.env.TELEGRAM_BOT_TOKEN;
  const adminChatId = botConfig?.admin_chat_id || process.env.VITE_ADMIN_TELEGRAM_ID || process.env.TELEGRAM_ADMIN_CHAT_ID || "1480652999";

  if (!botToken) {
    console.log(`[Telegram Bot] TELEGRAM_BOT_TOKEN is not configured. The real Telegram notification cannot be pushed to Chat/UserID ${adminChatId}. Please configure it in the Admin Panel or .env file.`);
    return;
  }

  const caption = `🌟 አዲስ ክፍያ ተልኳል (New Payment Submitted) 🌟\n\n👤 ተጠቃሚ (User): @${notification.username}\n📦 ፕላን (Plan): ${notification.plan_type === "single" ? "59 ETB (1 Day Credit)" : "259 ETB (Premium Monthly)"}\n💰 የብር መጠን (Amount): ${notification.amount} ETB\n🕒 ሰዓት (Date): ${new Date(notification.created_at).toLocaleString("am-ET")}\n\nApprove: ${process.env.APP_URL || "http://localhost:3000"}/admin\nPayment ID: ${notification.payment_id}`;

  try {
    let photoSent = false;
    // If the screenshot is a base64 image, we can send it as photo by converting or direct text
    if (notification.screenshot_url.startsWith("data:image")) {
      // For simplicity in sandbox env, convert base64 to Buffer
      const match = notification.screenshot_url.match(/^data:image\/(\w+);base64,(.+)$/);
      if (match) {
        const ext = match[1];
        const data = match[2];
        const buffer = Buffer.from(data, "base64");

        const formData = new FormData();
        
        let uploadFile: any;
        if (typeof File !== "undefined") {
          uploadFile = new File([buffer], `screenshot.${ext}`, { type: `image/${ext}` });
        } else {
          uploadFile = new Blob([buffer], { type: `image/${ext}` });
        }
        
        formData.append("chat_id", adminChatId);
        formData.append("photo", uploadFile, `screenshot.${ext}`);
        formData.append("caption", caption);

        const response = await fetch(`https://api.telegram.org/bot${botToken}/sendPhoto`, {
          method: "POST",
          body: formData,
        });
        
        const responseText = await response.text();
        let resJson: any = {};
        try {
          resJson = JSON.parse(responseText);
        } catch (e) {
          console.error("Failed to parse Telegram sendPhoto response as JSON:", responseText.slice(0, 250));
        }
        
        console.log("Sent real Telegram Photo Message:", resJson.ok ? "SUCCESS" : "FAILED", resJson);
        if (resJson.ok) {
          photoSent = true;
        }
      }
    }

    // Fallback to simple text message if sendPhoto was not successful or skipped
    if (!photoSent) {
      const response = await fetch(`https://api.telegram.org/bot${botToken}/sendMessage`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          chat_id: adminChatId,
          text: caption + `\n\n[ፎቶ መረጃ ለማስተዳደሪያው የቀረበ] (Screenshot string: ${notification.screenshot_url.substring(0, 80)}...)`,
        }),
      });
      const responseText = await response.text();
      let resJson: any = {};
      try {
        resJson = JSON.parse(responseText);
      } catch (e) {
        console.error("Failed to parse Telegram sendMessage response as JSON:", responseText.slice(0, 250));
      }
      console.log("Sent fallback real Telegram Text Message:", resJson.ok ? "SUCCESS" : "FAILED", resJson);
    }
  } catch (err) {
    console.error("Error sending real Telegram notification:", err);
  }
}

// --- API ROUTES ---

// 1. User system - Register or Login via Telegram ID
app.post("/api/auth/telegram", (req, res) => {
  const { id, username, first_name, photo_url } = req.body;
  if (!id) {
    return res.status(400).json({ error: "id is required" });
  }

  const user = db.getOrCreateUser(
    String(id),
    username || `user_${id}`,
    first_name || "እንግዳ",
    photo_url || ""
  );

  return res.json({ success: true, user });
});

// Get profile details
app.get("/api/users/:telegram_id", (req, res) => {
  const user = db.getUser(req.params.telegram_id);
  if (!user) {
    return res.status(404).json({ error: "User not found" });
  }
  return res.json({ user });
});

// 2. Dream interpretation endpoint
app.post("/api/dreams/interpret", async (req, res) => {
  const { user_id, dream_text, religion } = req.body;

  if (!user_id || !dream_text || !religion) {
    return res.status(400).json({ error: "Missing required fields" });
  }

  // Get user to verify credit access
  const user = db.getUser(user_id);
  if (!user) {
    return res.status(404).json({ error: "User not found" });
  }

  // Check character limit
  const isPremium = user.premium_until && new Date(user.premium_until).getTime() > Date.now();
  const adminIdEnv = process.env.VITE_ADMIN_TELEGRAM_ID || process.env.TELEGRAM_ADMIN_CHAT_ID || "1480652999";
  const isAdmin = String(user.telegram_id) === String(adminIdEnv);
  const maxChars = (isPremium || isAdmin) ? 10000 : 2000;

  if (dream_text.length > maxChars) {
    return res.status(400).json({ error: `የህልም ፅሁፍ ርዝመት ከ ${maxChars} ፊደላት ማለፍ የለበትም።` });
  }

  // Check for multiple dreams
  const normalizedText = dream_text.toLowerCase();
  const multipleDreamsKeywords = [
    "ሁለት ህልም", "ሁለት የተለያዩ", "ሁለት የተለያየ", "ሁለተኛው ህልም", "ሁለተኛ ህልም", "ሌላ ህልም", "ሌላኛው ህልም",
    "ተጨማሪ ህልም", "የመጀመሪያው ህልም", "ሁለተኛ ደግሞ", "2 ህልም", "2 የተለያዩ", "two dreams",
    "another dream", "second dream", "different dreams", "2 different dreams", "two different dreams"
  ];
  const hasMultiple = multipleDreamsKeywords.some(kw => normalizedText.includes(kw));
  if (hasMultiple) {
    return res.status(400).json({ 
      error: "ይቅርታ! በአንድ ጊዜ ከአንድ በላይ የተለያየ ህልም መፍታት አንችልም። እባኮትን ጥልቅ እና ትክክለኛ ትርጓሜ ለማግኘት አንዱን ዋና ህልምዎን ብቻ ለይተው በዝርዝር ይጻፉልን። (Sorry! We cannot process two different dreams at once. Please describe only one dream in detail to get a deep interpretation.)" 
    });
  }
  // Verify access criteria:
  // - 1. If premium exists and premium_until > current
  // - 2. Or if dream_credits > 0
  // - 3. Or if free_trial_used is false (they have 1 free)
  const hasCredits = user.dream_credits > 0;
  const canInterpret = isPremium || isAdmin || hasCredits || !user.free_trial_used;

  if (!canInterpret) {
    return res.status(403).json({
      error: "ACCESS_DENIED",
      message: "ያለዎት የነፃ ፍቃድ አልቋል። እባክዎን የህልም መፍቻ አገልግሎት ለማግኘት በቴሌብር ይክፈሉ።",
    });
  }

  // Check if user has provided detailed inputs
  const isDetailed = dream_text.length >= 150;

  // Compose prompts based on religion and constraints
  const systemPrompt = `You are an expert Ethiopian dream interpretation assistant (የኢትዮጵያ የሕልም ፈቺ).
Always respond in completely natural, fluent, and highly elegant Amharic (አማርኛ).

You will interpret dreams from:
1. Spiritual/religious perspective based on the user's selected profile: ${religion}
2. Psychological perspective
3. Symbolic perspective of characters or objects in the dream
4. Practical life advice based on the emotion of the dream.

Your tone should feel:
- wise (ጥበበኛ)
- calm (ረጋ ያለ)
- emotionally intelligent (ውስጣዊ ስሜትን የሚረዳ)
- culturally Ethiopian (ባህላዊ እና ሃይማኖታዊ ስሜቶችን ያከበረ)

Strict rules:
- NEVER accept or interpret two different/unrelated dreams at once. If you detect the user is submitting two distinct dreams, write a gentle refusal message inside the fields explaining that they must submit only one dream at a time.
- ${isDetailed ? "CRITICAL: The user has provided an extremely rich and highly detailed dream text. You MUST write an incredibly exhaustive, deeply comprehensive, and highly detailed response for every single field in the JSON structure. Analyze every detail, symbol, and emotion thoroughly without skipping anything. Elevate the length and analytical depth significantly to match their description." : "Provide standard standard-length wise answers."}
- NEVER predict the future with certainty (ትንቢት መናገር በጥብቅ የተከለከለ ነው)
- Never claim divine or prophetic authority (መለኮታዊ ስልጣን አለኝ አትበል)
- Do not encourage superstition (አጉል እምነቶችን አታበረታታ)
- Avoid inducing fear or distress (ፍርሃትንና ጭንቀትን አስወግድ፤ ሁሌም ተስፋን ስጥ)
- Deliver the response in a structured JSON object.`;

  const promptText = `ይህ የእኔ ህልም ነው:
"${dream_text}"

እኔ የተመረጠ የሃይማኖት ክበብ: ${religion}

እባክዎ የተሟላ የህልም ትርጓሜ በአማርኛ ይፃፉ።`;

  let interpretationResult;

  if (ai) {
    try {
      const response = await ai.models.generateContent({
        model: "gemini-3.5-flash",
        contents: promptText,
        config: {
          systemInstruction: systemPrompt,
          responseMimeType: "application/json",
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              spiritual: {
                type: Type.STRING,
                description: "Spiritual and religious interpretation respecting Orthodox, Protestant and Islamic sensibilities in Amharic.",
              },
              psychological: {
                type: Type.STRING,
                description: "Emotional and psychological interpretation of the dreamer's mind state.",
              },
              symbolic: {
                type: Type.STRING,
                description: "Symbolic explanations of objects, animals, or actions found in the dream.",
              },
              advice: {
                type: Type.STRING,
                description: "Encouraging, practical emotional and life advice.",
              },
              summary: {
                type: Type.STRING,
                description: "A beautiful, concluding warm feedback summarizing the primary takeaway.",
              },
            },
            required: ["spiritual", "psychological", "symbolic", "advice", "summary"],
          },
        },
      });

      const parsedText = response.text ? JSON.parse(response.text.trim()) : null;
      if (parsedText && parsedText.spiritual) {
        interpretationResult = parsedText;
      } else {
        throw new Error("Invalid output layout");
      }
    } catch (apiErr) {
      console.error("Gemini interpretation failed, using smart engine:", apiErr);
      interpretationResult = generateSmartFallback(dream_text, religion);
    }
  } else {
    // If no API key is set, use intelligent local interpreter generator matching Orthodox and Islamic guidelines
    interpretationResult = generateSmartFallback(dream_text, religion);
  }

  // Save the dream interpretation into the DB and updates user credits automatically!
  const savedDream = db.saveDream({
    user_id,
    dream_text,
    religion: religion as ReligionType,
    interpretation: interpretationResult,
  });

  return res.json({ success: true, dream: savedDream, user: db.getUser(user_id) });
});

// Generates incredibly rich, context-rich fallback responses matching Orthodox, Islamic, Pente cultures
function generateSmartFallback(dreamText: string, religion: string) {
  const containsWater = /ውኃ|ወንዝ|ባህር|ዝናብ/i.test(dreamText);
  const containsGold = /ወርቅ|ብር|ገንዘብ|ቆርቆሮ/i.test(dreamText);
  const containsFire = /እሳት|ማንደድ|መቃጠል/i.test(dreamText);
  const containsSnake = /እባብ|ዘንዶ|ትል|ነፍሳት/i.test(dreamText);
  const containsFly = /መብረር|ሰማይ|ክንፍ/i.test(dreamText);

  let spiritualSym = "";
  let psychSym = "";
  let objectSym = "";
  let adviceSym = "";
  let sumSym = "";

  if (containsWater) {
    spiritualSym = `${religion === "Orthodox" ? "በኦርቶዶክስ መንፈሳዊ አስተምህሮ ጠበል እና የጠራ ውኃ የነጻነት፣ የመንጻትና የእግዚአብሔር ፀጋ መገለጫ ነው።" : religion === "Muslim" ? "በእስልምና አስተምህሮ ውኃ የበረከት፣ የዕውቀት እና የፈጣሪ መለኮታዊ እዝነት (ራህማህ) ማሳያ ነው።" : "በመንፈሳዊ እይታ ንጹህ ውኃ የመንፈስ መታደስና አዲስ ምዕራፍ የመጀመር በረከት ነው።"} ይህ ህልም በህይወትዎ ላይ የሚፈስ አዲስ በረከትን ያሳያል።`;
    psychSym = "በስነ-ልቦናው እይታ ውሃ የመረጋጋትዎ፣ ያለዎትን ጭንቀት ለማጠብ የሚፈልጉት ንጹህ ስሜትዎ ቁልጭ አድርጎ ያሳያል።";
    objectSym = "በምልክት ደረጃ ወራጅ ውሃ የህይወት ጉዞዎ ያለመስተጓጎል በስኬት እየሄደ መሆኑን የሚጠቁም ነው።";
    adviceSym = "በውስጥዎ ያሉትን ጭንቀቶች ለፈጣሪ በመስጠት ሰላማዊ ጎዳናዎን ይቀጥሉ።";
    sumSym = "ይህ ህልም የልብዎን ሰላምና ቀጣይ በረከትን የሚያበስር ታላቅ የመታደስ ምልክት ነው።";
  } else if (containsGold) {
    spiritualSym = `${religion === "Orthodox" ? "ወርቅ በቤተክርስቲያን የእምነት መጽናት፣ ንጽህና እና የመንፈሳዊ ሀብት መገለጫ ነው።" : religion === "Muslim" ? "በእስልምና ወርቅን በህልም ማየት ፈተናን ወይም የቁሳቁስ መለወጥን ሊያሳይ እንደሚችል ተነግሯል።" : "ወርቅ ህያው የሆነ እምነትን፣ ክብርንና የተሰጡዎትን የጸጋ ስጦታዎች ያመለክታል።"} በመሆኑም ህልሙ ሰማያዊና ምድራዊ ስጦታዎን ጠብቀው እንዲቀጥሉ ያሳስባል።`;
    psychSym = "በህልም ውስጥ ወርቅ መፈለግ ወይም ማየት በውስጥዎ ያለዎትን ከፍተኛ በራስ መተማመን እና ከፍተኛ ምኞትዎን የሚያሳይ ነው።";
    objectSym = "ወርቅ የማይጠፋ ክብርን፣ ጥንካሬን እና የመሪነት ችሎታን ያመለክታል።";
    adviceSym = "ያገኙትን ስኬት ለበጎ አላማዎች ብቻ ያውሉት። ለሰው ልጆች መራራት ታላቁ ወርቅ ነው።";
    sumSym = "በህይወትዎ ውስጥ ትልቅ ዋጋ ያላቸው እድሎች እንደሚከፈቱልዎት የሚያበስር ህልም ነው።";
  } else if (containsSnake) {
    spiritualSym = `${religion === "Orthodox" ? "በኦርቶዶክስ መንፈሳዊ እይታ እባብ የጥንቱ ጠላት የዲያብሎስ ፈተና፣ የጥርጣሬና የተንኮል አምሳያ ነው።" : religion === "Muslim" ? "በእስልምና እባብ ጠላትን ወይም በአቅራቢያዎ ያለን ተንኮለኛ ሰው ያስጠነቅቃል።" : "እባብ በመንፈሳዊ መድረክ የፈተና እና የተንኮል መኖርን የሚያሳይ በመሆኑ በትጋት መጸለይን ይጠይቃል።"} ይህ ህልም በዙሪያዎ ላሉት ግንኙነቶች ጥንቃቄ ማድረግ እንደሚገባዎት ያሳያል።`;
    psychSym = "እባብ ማየት በስነ-ልቦና ረገድ በአካባቢዎ የሚሰማዎትን ስውር ስጋት፣ ፍርሃት ወይም ያልተፈታ ውስጣዊ ጭንቀትን ያንፀባርቃል።";
    objectSym = "እባብ ክህደትን፣ ተንኮልንና በተመሳሳይ ጊዜ የህይወትን ውስብስብነት በምልክትነት ይወክላል።";
    adviceSym = "እራስዎን ይጠብቁ፣ በሰላምና በትዕግስት ነገሮችን ያስተውሉ። ፈጣሪን በመጠየቅ ልብዎን ያበርቱ።";
    sumSym = "ህልሙ ሊገጥምዎ የሚችሉ ፈተናዎችን በንቃት እና በፀሎት በድል እንደሚያልፉ የሚያሳይ ማሳሰቢያ ነው።";
  } else {
    spiritualSym = `${religion === "Orthodox" ? "በኢትዮጵያ ኦርቶዶክስ እምነት እያንዳንዱ ህልም በመንፈሳዊ ህይወታችን ውስጥ ጥንቃቄን፣ ንቃትና ወደ እግዚአብሔር መቅረብን ይጠራል" : religion === "Muslim" ? "በእስልምና አስተምህሮ እያንዳንዱ ህልም ውስጣዊ ንጽህናን፣ መልካም ስራዎችንና ወደ አላህ ያለንን ዱዓ እንድናጠነክር ያስታውሳናል" : "በመንፈሳዊ ዕይታ እያንዳንዱ የህልም ራእይ የውስጥ ሰላምህን፣ የእምነት ጥንካሬህንና የፈጣሪህን መመሪያ እንድትመረምር ያስተምረሃል"}። በጸሎት ወደ ፈጣሪ መቅረብ ጥበብን ይጨምራል።`;
    psychSym = "በስነ-ልቦና ረገድ ይህ ህልም በቅርብ ቀናት ያጋጠሙዎት ገጠመኞች በጭንቅላትዎ ውስጥ እያደረጉት ያለውን መልሶ ማብላላት (Ruminating) ያሳያል።";
    objectSym = "በህልም የታዩት ዋና ዋና ነገሮች ወደፊት በህይወትዎ የሚሰጧቸውን የባህርይ ትርጉሞች ያንፀባርቃሉ።";
    adviceSym = "ሁልጊዜም አዕምሮዎን ለበጎ ሃሳቦች ክፍት ያድርጉ። በአካባቢዎ ካሉ ሰዎች ጋር በደግነትና በፍቅር ይገናኙ።";
    sumSym = "ይህ ህልም ውስጣዊ ጥበብና ፈጣሪን በመፍራት ሰላምን እንደሚያገኙ የሚያመለክት ጠቃሚ መገለጥ ነው።";
  }

  // If user detailed their dream (length >= 150), provide deeply expanded Amharic narratives
  if (dreamText.length >= 150) {
    spiritualSym += " የእርስዎን ህልም በዝርዝር ስንመረምረው፣ እያንዳንዱ የህልሙ ገፅታ የሚያሳየው ወደ ጥልቅ መንፈሳዊ ቁርኝት እና ታላቅ መገለጥ ውስጥ እየገቡ መሆንዎን ነው። ይህ ዝርዝር መረጃ የመንፈስዎን ጥንካሬ እና ልዩ ጥሪ ይጨምራል።";
    psychSym += " ስለ ህልሙ ዝርዝር መግለጫዎ እንደሚያሳየው፣ በተለይ በዚህ ወቅት ከፍተኛ ትኩረት የሚሹ ስሜታዊ እና አዕምሮአዊ ፈተናዎችን በውስጥዎ እያሰላሰሉ ነው። ይህንን ዝርዝር ሁኔታ በተረጋጋ መንፈስ በማጥናት አዲስ ስሜታዊ ብስለት እንደሚያገኙ ጥርጥር የለውም።";
    objectSym += " በፃፉት ዝርዝር መረጃ ውስጥ የሚገኙት ሁሉም ተሳታፊ ግዑዝ እና ህያው ነገሮች የውስጣዊ ማንነትዎን ስውር ምኞቶች፣ ግጭቶችና ልዩ የእድገት ፍላጎትን የሚያንፀባርቁ ጥልቅ ስነ-ምልክቶች ናቸው።";
    adviceSym += " ለዚህ ዝርዝር ጉዳይ የሚሆን የተለየ ምክር፦ እባክዎን እቅዶችዎን አንድ በአንድ በጥንቃቄ ይዘርጉ። በዝርዝር ያዩት ህልም በህይወትዎ ውስጥ ትንንሽ ለውጦችን በማስተዋል ትልቅ ስኬት ላይ መድረስ እንደሚችሉ ይጠቁማል።";
    sumSym += " በአጠቃላይ፣ ይህንን ያጋሩትን ዝርዝር ሰፊ ህልም በጥልቀት ስንመለከተው ታላቅ የውስጥ ለውጥ እና አዲስ የህይወት ቅደም ተከተልን ሊያስተካክሉ ዝግጁ መሆንዎን ያመለክታል።";
  }

  return {
    spiritual: spiritualSym,
    psychological: psychSym,
    symbolic: objectSym,
    advice: adviceSym,
    summary: sumSym
  };
}

// 3. Dream retrieval user history
app.get("/api/dreams/:user_id", (req, res) => {
  const dreams = db.getDreamsByUserId(req.params.user_id);
  return res.json({ dreams });
});

// 4. Payment creation and screenshot upload
app.post("/api/payments/submit", async (req, res) => {
  const { user_id, plan_type, amount, screenshot_url } = req.body;

  if (!user_id || !plan_type || !amount || !screenshot_url) {
    return res.status(400).json({ error: "Missing required billing details" });
  }

  const payment = db.createPayment(user_id, plan_type as PaymentPlanType, Number(amount), screenshot_url);

  // Trigger simulated & real Telegram Bot Notification immediately!
  const notification: BotNotification = {
    id: "notif_" + Math.random().toString(36).substring(2, 11),
    user_id,
    username: payment.username,
    plan_type: plan_type as PaymentPlanType,
    amount: Number(amount),
    screenshot_url,
    created_at: payment.created_at,
    payment_id: payment.id,
    status: "pending",
  };

  botNotifications.unshift(notification);

  // Trigger real telegram bot webhook/API asynchronously so it doesn't block Express response!
  sendTelegramNotification(notification).catch((err) => {
    console.error("Async Telegram Notification send error:", err);
  });

  return res.json({ success: true, payment });
});

// User's past payments
app.get("/api/payments/user/:user_id", (req, res) => {
  const payments = db.getPaymentsByUserId(req.params.user_id);
  return res.json({ payments });
});

// --- ADMIN SYSTEM & MOCK BOT SIMULATION API ---

// Admin Login
app.post("/api/admin/login", (req, res) => {
  const { username, password } = req.body;
  if (username === "admin" && password === "password123") {
    return res.json({ success: true, token: "admin-token-12345" });
  }
  return res.status(401).json({ error: "የተሳሳተ የተጠቃሚ ስም ወይም የይለፍ ቃል!" });
});

// Admin Analytics (Requires token header authorization)
app.get("/api/admin/bot-config", (req, res) => {
  const token = req.headers.authorization;
  if (!token || !db.verifyAdminToken(token)) return res.status(401).json({ error: "Unauthorized" });
  const config = db.getBotConfig();
  return res.json({ config: config || { bot_token: "", admin_chat_id: "" } });
});

app.post("/api/admin/bot-config", (req, res) => {
  const token = req.headers.authorization;
  if (!token || !db.verifyAdminToken(token)) return res.status(401).json({ error: "Unauthorized" });
  const { bot_token, admin_chat_id } = req.body;
  if (!bot_token || !admin_chat_id) return res.status(400).json({ error: "Missing required fields" });
  db.saveBotConfig({ bot_token, admin_chat_id });
  return res.json({ success: true });
});

app.get("/api/admin/analytics", (req, res) => {
  const token = req.headers.authorization;
  if (!token || !db.verifyAdminToken(token)) {
    return res.status(401).json({ error: "Unauthorized access" });
  }
  const analytics = db.getAnalytics();
  return res.json({ analytics });
});

// Admin Users Panel
app.get("/api/admin/users", (req, res) => {
  const token = req.headers.authorization;
  if (!token || !db.verifyAdminToken(token)) {
    return res.status(401).json({ error: "Unauthorized access" });
  }
  return res.json({ users: db.getAllUsers() });
});

// Admin Payments Panel
app.get("/api/admin/payments", (req, res) => {
  const token = req.headers.authorization;
  if (!token || !db.verifyAdminToken(token)) {
    return res.status(401).json({ error: "Unauthorized access" });
  }
  return res.json({ payments: db.getAllPayments() });
});

// Admin approves or rejects manual screenshots
app.post("/api/admin/payments/:id/action", (req, res) => {
  const token = req.headers.authorization;
  if (!token || !db.verifyAdminToken(token)) {
    return res.status(401).json({ error: "Unauthorized access" });
  }

  const { action } = req.body; // "approve" or "reject"
  const paymentId = req.params.id;

  let payment;
  if (action === "approve") {
    payment = db.approvePayment(paymentId);
  } else if (action === "reject") {
    payment = db.rejectPayment(paymentId);
  } else {
    return res.status(400).json({ error: "Invalid billing action" });
  }

  if (!payment) {
    return res.status(404).json({ error: "Payment not found or already verified" });
  }

  // Update status in our local in-memory simulated Bot list for visual coherence!
  botNotifications = botNotifications.map((notif) => {
    if (notif.payment_id === paymentId) {
      return { ...notif, status: action === "approve" ? "approved" : "rejected" };
    }
    return notif;
  });

  return res.json({ success: true, payment });
});

// Admin Bot Notifications listing for Developer Simulator
app.get("/api/admin/bot-notifications", (req, res) => {
  return res.json({ notifications: botNotifications });
});

// Serve static compiled UI in production, hook Vite middleware in development
export default app;

if (!process.env.VERCEL) {
  (async () => {
    if (process.env.NODE_ENV !== "production") {
      const vite = await createViteServer({
        server: { middlewareMode: true },
        appType: "spa",
      });
      app.use(vite.middlewares);
    } else {
      const distPath = path.join(process.cwd(), "dist");
      app.use(express.static(distPath));
      app.get("*", (_req, res) => {
        res.sendFile(path.join(distPath, "index.html"));
      });
    }
    app.listen(PORT, "0.0.0.0", () => {
      console.log(`Ethiopian Dream Interpreter Server listening on port ${PORT}`);
    });
  })();
}

