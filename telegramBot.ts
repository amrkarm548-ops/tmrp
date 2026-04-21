import TelegramBot from 'node-telegram-bot-api';
import { GoogleGenAI } from '@google/genai';
import { db, doc, onSnapshot } from './firebaseServer.ts';
import fs from 'fs';
import path from 'path';

let bot: TelegramBot | null = null;
let currentToken = '';

// Safe read local memory file
function getBotMemory() {
  try {
    const memoryPath = path.join(process.cwd(), 'bot-memory.json');
    if (fs.existsSync(memoryPath)) {
      return JSON.parse(fs.readFileSync(memoryPath, 'utf8'));
    }
  } catch(e) {
    console.warn("Could not read bot memory file");
  }
  return { keys: [], totalUsers: 0, totalFiles: 0, activeKeysCount: 0 };
}

// Helper to get keys from Memory since process.env might fail with auth scopes in backend
async function getWorkingAIClient() {
  const primaryKey = process.env.GEMINI_API_KEY;
  const keys: string[] = [];
  if (primaryKey) keys.push(primaryKey);
  
  const memory = getBotMemory();
  if (memory.keys && Array.isArray(memory.keys)) {
    keys.push(...memory.keys);
  }

  // Find first working key
  for (const k of keys) {
    if (!k) continue;
    try {
      const ai = new GoogleGenAI({ apiKey: k });
      return ai;
    } catch(e) {
      console.warn("Key fail during init");
    }
  }
  return new GoogleGenAI({ apiKey: "DUMMY_KEY" }); // Fallback
}

// Get website info string from Memory
async function getWebsiteInfo() {
  const memory = getBotMemory();
  return `📊 إحصائيات الموقع:
👥 عدد المستخدمين: ${memory.totalUsers || 0}
📁 عدد الملفات المولدة: ${memory.totalFiles || 0}
🔑 عدد مفاتيح الطوارئ نشطة: ${memory.activeKeysCount || 0}

الأوامر المتاحة لك كأدمن:
يمكنك التحدث معي بالعامية وسؤالي عن حالة الموقع وسأجيبك فوراً! مثل:
- "وهاتلي تقرير او معلومات عن الموقع"
- "هل في مستخدمين جدد دخلوا النهاردة؟"
- "طمني على مفاتيح الطوارئ شغالة ولا لأ"

*ملاحظة: لأسباب أمنية لا يمكن إضافة مفاتيح أو تعديل أوامر الذكاء الاصطناعي من هنا، يجب فتح لوحة التحكم للقيام بذلك.*
`;
}

async function startBot(token: string) {
  if (bot) {
    try {
      await bot.stopPolling();
    } catch (err) {
      console.warn("Could not stop old polling gracefully:", err);
    }
    bot = null;
  }
  
  try {
    bot = new TelegramBot(token, { polling: true });
    currentToken = token;
    console.log('🤖 Telegram Bot started with token!');

    bot.on("polling_error", (err: Error & { code?: string, response?: { statusCode?: number } }) => {
      if (err?.code === 'ETELEGRAM' && err?.response?.statusCode === 409) {
        console.warn("Telegram polling conflict. Another instance is running. Stopping polling on this instance to prevent crashes.");
        bot?.stopPolling().catch(e => console.error("Graceful stop failed:", e));
      } else {
        console.warn("Telegram polling error:", err?.message || err);
      }
    });

    bot.on("error", (err: Error) => {
      console.error("Telegram general error:", err?.message || err);
    });

    process.once('SIGINT', () => {
      bot?.stopPolling();
    });
    process.once('SIGTERM', () => {
      bot?.stopPolling();
    });

    bot.onText(/\/start/, async (msg) => {
      const chatId = msg.chat.id;
      bot?.sendMessage(chatId, "أهلاً بك يا مدير تمريضيانو في مركز التحكم الخاص بك! 🚀\n\nأنا هنا لتنفيذ أوامرك بالموقع.\nجاري جلب حالة الموقع الآن...");
      const info = await getWebsiteInfo();
      bot?.sendMessage(chatId, info);
    });

    bot.on('message', async (msg) => {
      const chatId = msg.chat.id;
      const text = msg.text;

      if (!text || text.startsWith('/start')) return;

      bot?.sendMessage(chatId, "⏳ جاري التفكير ومعالجة طلبك...");

      try {
        const ai = await getWorkingAIClient();
        const currentWebsiteInfo = await getWebsiteInfo();
        
        const prompt = `
You are an AI assistant controlling the "Tamrediano" website backend.
The admin sent this message: "${text}"

Here is the CURRENT state/info of the website to help you understand the context and answer questions accurately:
---
${currentWebsiteInfo}
---

Analyze the request and output a strict JSON action. Do not actually perform modifications. Just indicate intent so the bot can respond.
Possible actions:
1. "add_key": User wants to add key.
2. "delete_all_keys": User wants to delete keys.
3. "set_global_prompt": User wants to change prompt.
4. "get_info": User wants website info.
5. "chat": The user is just chatting or asking a question not related to database modifications. Answer based on the info provided if relevant. Give a very smart and accurate answer. Requires "reply" field.

Return ONLY valid JSON like:
{
  "action": "add_key" | "delete_all_keys" | "set_global_prompt" | "get_info" | "chat",
  "reply": "string (friendly arabic response if chat)"
}
`;

        const response = await ai.models.generateContent({
            model: "gemini-2.5-flash",
            contents: prompt,
            config: {
                responseMimeType: "application/json"
            }
        });

        const resultText = response.text || "{}";
        const result = JSON.parse(resultText);

        if (result.action === 'add_key' || result.action === 'delete_all_keys' || result.action === 'set_global_prompt') {
            bot?.sendMessage(chatId, `⚠️ عذراً، لأسباب أمنية، تعديل قاعدة البيانات (إضافة/حذف مفاتيح أو تعديل البرومبت) يجب أن يتم من خلال لوحة التحكم (Admin Panel) في الموقع مباشرة لضمان سلامة البيانات.`);
        } 
        else if (result.action === 'get_info') {
            const info = await getWebsiteInfo();
            bot?.sendMessage(chatId, info);
        }
        else {
            bot?.sendMessage(chatId, result.reply || "عذراً، لم أفهم طلبك بشكل دقيق.");
        }

      } catch (e: unknown) {
        console.error("Bot action error:", e);
        bot?.sendMessage(chatId, "❌ حدث خطأ أثناء تنفيذ الطلب: " + (e instanceof Error ? e.message : String(e)));
      }
    });

  } catch (error) {
    console.error('Failed to start Telegram bot:', error);
  }
}

export function initTelegramBot() {
  const fallbackToken = '8773917319:AAG-tEEJV5b09yOj45y-OtKeYezqqYW7tgc';
  
  onSnapshot(doc(db, 'config', 'global'), (snapshot) => {
    if (snapshot.exists()) {
      const data = snapshot.data();
      const dbToken = data?.telegramBotToken;
      
      const tokenToUse = dbToken || fallbackToken;
      
      if (tokenToUse && tokenToUse !== currentToken) {
        console.log("Detecting new telegram token, restarting bot...");
        startBot(tokenToUse);
      }
    } else if (!bot) {
      startBot(fallbackToken);
    }
  }, (err) => {
     console.warn("Could not listen to real-time config for bot token. Starting with fallback.", err);
     if (!bot) startBot(fallbackToken);
  });
}
