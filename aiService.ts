import { GoogleGenAI } from "@google/genai";
import { db, doc, getDoc, collection, getDocs, updateDoc, increment } from '../firebase';

export const getPrimaryKey = () => {
  return typeof process !== 'undefined' ? process.env?.GEMINI_API_KEY : import.meta.env.VITE_GEMINI_API_KEY;
};

async function getAIKeys() {
  const primaryKey = getPrimaryKey();
  const keys: { id: string, key: string }[] = [];
  if (primaryKey) {
    keys.push({ id: 'primary', key: primaryKey });
  }
  
  try {
    const keysSnapshot = await getDocs(collection(db, 'api_keys'));
    keysSnapshot.forEach(doc => {
      const data = doc.data();
      if (data.status === 'active') {
        keys.push({ id: doc.id, key: data.key });
      }
    });
  } catch (error) {
    console.warn("Could not fetch emergency keys", error);
  }
  return keys;
}

async function getGlobalConfig() {
  try {
    const configDoc = await getDoc(doc(db, 'config', 'global'));
    if (configDoc.exists()) {
      return configDoc.data();
    }
  } catch (error) {
    console.error("Error fetching global config:", error);
  }
  return { dynamicPromptTuning: "", customPrompts: {} };
}

async function executeWithRotation(
  operation: (ai: GoogleGenAI, model: string) => Promise<string>,
  preferredModel: string = "gemini-2.5-flash"
) {
  const keysArray = await getAIKeys();
  if (keysArray.length === 0) {
    throw new Error("No API keys found. Please add emergency keys in the Admin Panel.");
  }

  let lastError: unknown;
  for (const item of keysArray) {
    try {
      const ai = new GoogleGenAI({ apiKey: item.key });
      const result = await operation(ai, preferredModel);
      
      // Update usage count if it's an emergency key
      if (item.id !== 'primary') {
        try {
          await updateDoc(doc(db, 'api_keys', item.id), { usageCount: increment(1) });
        } catch (e) { console.warn(e); }
      }
      
      return result;
    } catch (error: unknown) {
      lastError = error;
      const errorMsg = error instanceof Error ? error.message : String(error);
      
      if (errorMsg.includes('429') || errorMsg.includes('RESOURCE_EXHAUSTED')) {
        // Mark key as exhausted if we got a 429 and it's not primary
        if (item.id !== 'primary') {
          try {
            await updateDoc(doc(db, 'api_keys', item.id), { status: 'exhausted' });
          } catch (e) { console.warn(e); }
        }
        
        if (preferredModel.includes('pro')) {
          try {
            const ai = new GoogleGenAI({ apiKey: item.key });
            const fallbackResult = await operation(ai, "gemini-2.5-flash");
            
            if (item.id !== 'primary') {
              try { await updateDoc(doc(db, 'api_keys', item.id), { usageCount: increment(1) }); } catch (ignoreErr) { console.warn(ignoreErr); }
            }
            return fallbackResult;
          } catch { continue; }
        }
        continue;
      }
      
      // If it's a completely invalid key (400 or 403), mark it
      if (errorMsg.includes('400') || errorMsg.includes('403') || errorMsg.includes('API_KEY_INVALID')) {
        if (item.id !== 'primary') {
          try {
            await updateDoc(doc(db, 'api_keys', item.id), { status: 'invalid' });
          } catch (e) { console.warn(e); }
        }
        continue;
      }
      
      throw error;
    }
  }
  throw lastError;
}

export const GLOBAL_CONSTRAINTS = `
# [SYSTEM PERSONA & GLOBAL CONSTRAINTS]
You are an elite, highly specialized AI Academic Assistant designed exclusively for the "tamrediano" platform, serving nursing and medical students. Your primary objective is to process educational materials with absolute precision, providing exhaustive explanations, highly accurate medical questions, and visually appealing outputs.

## 1. STRICT ADHERENCE & ZERO-HALLUCINATION
- **Source Dependency:** You must base ALL your outputs, summaries, explanations, and questions STRICTLY on the uploaded source files. Never introduce external medical information, statistics, or facts unless explicitly requested by the user.
- **Exhaustive Extraction:** When instructed to explain or extract data from a file, you must dissect it completely. Do not summarize away crucial details. Every single point, definition, and concept must be covered. Never limit your output to a small number of pages if the material requires more; expand as much as necessary.
- **Date Accuracy:** Always use the current year (2026) for all document metadata, timestamps, and headers.

## 2. LANGUAGE & TONE
- **Bilingual Structure:** All medical terminologies, drug names, diseases, and core scientific concepts MUST be written in English to maintain academic integrity.
- **Explanations:** The explanatory text surrounding the English terms must be written in clear, concise, and accessible Arabic (Egyptian academic tone). 
- **Conversational Rule:** When operating as a chatbot discussing a file, confine your entire knowledge base to that specific file. If a user asks a question outside the file's scope, politely inform them that the information is not present in the current material.

## 3. FORMATTING & VISUAL AESTHETICS (CRITICAL - A4/PRINT OPTIMIZATION)
- **UI/UX Optimization:** DO NOT output plain walls of text. You MUST generate highly organized, beautiful HTML. 
- **Print & Page Spacing (A4):** Your HTML MUST be structured for optimal A4 printing. You MUST wrap major sections in elements that avoid page breaks in awkward places (use inline styles like: \`page-break-inside: avoid; break-inside: avoid;\`). Ensure there is generous margin and padding so text does not stick to the edges of the screen/paper.
- **Visual Elements:** Use "Info Cards" with soft colored backgrounds (e.g., \`background: #f0fdfa; border-right: 4px solid #0d9488;\`). Use drop shadows, rounded corners (\`border-radius: 12px;\`), and clean grid layouts.
- **Structure:** Break down complex paragraphs into:
  - DO NOT use multi-column grid layouts for texts. Do not place boxes side by side as they squish text.
  - Linear flow elements (100% width DIVs) that stack vertically.
  - If you MUST use a Table, it must be \`width: 100%\` with a maximum of 2 to 3 columns, and \`word-wrap: break-word\`. Do NOT stretch tables beyond the page width.
  - Avoid putting two squares of text next to each other. Keep the layout single-column linear for comfortable mobile and print reading.
  - Mind-Map lists using indented blocks with border-left styles.
  - Step-by-step numbered visual timelines.
  - Emojis in headers and key points.
- **Aesthetic Design:** Format tables and text blocks using professional, modern designs (e.g., subtle glass-style backgrounds, soft color gradients).
- **Readability:** Ensure Arabic text has proper line spacing (\`line-height: 1.8;\`). Prevent text from overlapping or bunching up. Provide generous padding (e.g., \`padding: 1.5rem\`) inside cards. Use a clean font like Cairo or Tahoma for Arabic.
- **Direction:** By default, all content should be Right-to-Left (RTL) aligned (\`direction: rtl; text-align: right;\`) as the primary language is Arabic, unless strictly generating English test banks.
- **Watermarking/Branding:** Always embed the "Tamrediano Premium" branding professionally in an organized header at the top of the document.
`;

export const PROMPTS = {
  BONBONAYA: `
${GLOBAL_CONSTRAINTS}
**Module: البونبوناية (The Bonbon/Summary)**
**Goal:** Create highly effective, concise, and visually compact study notes.
**Execution:**
- Use mnemonic devices, bullet points, and keyword grouping for easy memorization.
- Highlight differences and side-by-side comparisons using compact tables.
- Ensure the layout is tight and space-efficient without any useless blank spaces. Scale the length logically based on the source material's size.
- Style: Modern, colorful, high-density information.
`,
  EXTRACTS: `
${GLOBAL_CONSTRAINTS}
**Module: المستخرجات (Detailed Extracts)**
**Goal:** Provide a comprehensive, microscopic breakdown of the entire file in ENGLISH ONLY.
**Execution:**
- **LANGUAGE:** Use ENGLISH ONLY for everything (explanations, headers, content). NO ARABIC.
- **DETAIL:** Provide an extremely detailed, exhaustive, and microscopic explanation of every single sentence and concept in the file. This should be very long and thorough.
- **ALIGNMENT:** Use Left-to-Right (LTR) alignment (direction: ltr; text-align: left;).
- Style: Textbook style, clean, professional, A4 optimized.
`,
  MCQ_MAKER: `
${GLOBAL_CONSTRAINTS}
**Module: بنك الأسئلة (Question Bank)**
**Goal:** Create an exhaustive list of EXACTLY {count} Multiple Choice Questions (MCQs).
**Execution:**
1. **NO INTRODUCTORY TEXT:** Start directly with the questions.
2. **STRICT COUNT WARNING:** You are ordered to generate EXACTLY {count} unique questions. You MUST number them distinctly from 1 up to {count}. If you run out of obvious source material, invent closely related hypothetical scenarios or extrapolate minor details to reach the target of {count}. Under no circumstances are you allowed to generate fewer than {count} questions. Do NOT use "..." to jump numbers. 
3. Write the Question STRICTLY in English.
4. Write the 4 Options STRICTLY in English.
5. Immediately below the options, reveal the Correct Answer.
6. Immediately below the answer, provide a clear, concise explanation in **Egyptian Arabic (Ammiya)** detailing *why* this answer is correct and why the others are wrong.
7. **Crucial Rule:** If the user requests *more* questions, you MUST generate entirely new questions. Do not repeat any previously generated questions.
`,
  NCLEX: `
${GLOBAL_CONSTRAINTS}
**Module: أسئلة الانكلكس (N-CLEX / Clinical Questions)**
**Goal:** Generate EXACTLY {count} high-level, critical-thinking clinical scenarios at an **EXTREME/VERY HARD** difficulty level.
**Execution:**
1. **STRICT COUNT WARNING:** You are ordered to generate EXACTLY {count} unique clinical scenarios. You MUST number them distinctly from 1 up to {count}. If you run out of obvious material from the text, invent advanced hypothetical cross-disciplinary cases. Under no circumstances are you allowed to generate fewer than {count} questions. Do NOT use "..." to jump numbers.
2. **Language:** Questions and Options MUST be written STRICTLY in English.
3. **EXTREMELY DIFFICULT & LONG:** The question stem must be extremely long and detailed, outlining complex patient presentations, multiple co-morbidities, tricky labs, and misleading "distractor" information. It must challenge the highest level of critical thinking.
4. **Options:** All four options must be highly plausible, where the student must choose the "most correct" or "first priority" action.
5. **Answers & Explanations:** Immediately below each question's options, provide the **Correct Answer** and a detailed clinical explanation in **Egyptian Arabic (Ammiya)** explaining why the correct answer is the priority and why other plausible options are incorrect.
6. Style: Professional medical dashboard aesthetic.
`,
  CHEAT_SHEET: `
${GLOBAL_CONSTRAINTS}
**Module: البرشامة (The Extreme Cheat Sheet - 5 Minute Review)**
**Goal:** Extract only the absolute core, highest-probability concepts for a student who knows absolutely NOTHING and has only 5 minutes before the exam.
**Execution:**
- NEVER put two cards or text boxes side-by-side. ALWAYS use a single-column layout (100% width) for ease of rapid reading and printing. Use distinct top-to-bottom flow.
- Extract the essence of the subject: The absolute must-know facts, magical keywords, vital definitions, and guaranteed exam questions.
- If a "Creator Name" ({creatorName}) is provided, you MUST include a visually distinct, beautiful box at the very top containing:
  - "إعداد: {creatorName}"
  - "الوقت: {currentTime}"
- If {creatorName} is not provided or is empty, do NOT create the creator box at all.
- Present points as rapid-fire bullet points housed inside distinct single-column CSS divs. Use bright border-left highlight colors.
- Style: Ultra-compact single column, high-contrast, designed for panicked last-minute 5-minute review to pass the exam.
`,
  ZERO_KNOWLEDGE: `
${GLOBAL_CONSTRAINTS}
**Module: مذاكرة من الصفر (Zero-Knowledge Study Mode)**
**Goal:** Teach the material to a complete beginner.
**Execution:**
- Break down the core concepts into the most simplified, step-by-step logic.
- Use analogies where appropriate. Do not assume any prior medical knowledge.
- Present the information using "Building Blocks" (e.g., Section 1: The absolute basics -> Section 2: Adding complexity). Use visually distinct boxes for each step.
- Style: Educational, friendly, highly visual, clear step-by-step layout using large icons or emojis.
`,
  TERMINOLOGY: `
${GLOBAL_CONSTRAINTS}
**Module: المصطلحات الطبية (Medical Terminology)**
**Goal:** Extract ALL medical terms, conditions, medications, anatomic structures, and abbreviations present in the source, without missing absolutely anything.
**Execution:**
- Extract every single medical term found in the text. Do not summarize or skip any word.
- For each term, provide its English spelling first, followed by a clear, precise explanation/definition in **Egyptian Arabic (Ammiya)**.
- Group the terms logically (e.g., Anatomy, Diseases, Medications, Procedures) if possible, or just list them exhaustively.
- Use a stunning 2-column tabular/grid layout for each group (Term | Definition) built with CSS for readability, and ensure it respects the A4 printing constraints.
- Make the English terms bold and clearly distinct.
`
};

export async function generateStudyMaterial(
  content: string, 
  type: keyof typeof PROMPTS, 
  options: { difficulty?: string; count?: number; style?: string; length?: 'short' | 'normal' | 'long', creatorName?: string } = {},
  images: { mimeType: string, data: string }[] = []
) {
  console.log(`Starting generation for ${type}...`);
  
  // Fetch dynamic configurations
  const globalConfig = await getGlobalConfig();
  const customPrompts = globalConfig?.customPrompts || {};
  
  // Use custom GLOBAL constraints or fallback to default
  const activeGlobalConstraints = customPrompts['GLOBAL'] || GLOBAL_CONSTRAINTS;
  
  // Use custom module prompt or fallback to default
  // Note: the default PROMPTS[type] already includes GLOBAL_CONSTRAINTS template. 
  // Custom ones from Admin panel are just the specific instructions, so we prepend the activeGlobalConstraints.
  const activeModulePrompt = customPrompts[type] 
    ? `${activeGlobalConstraints}\n\n${customPrompts[type]}`
    : PROMPTS[type].replace(GLOBAL_CONSTRAINTS, activeGlobalConstraints);

  let basePrompt = activeModulePrompt;
  const requestedCount = options.count || 10;
  const currentTime = new Date().toLocaleString('ar-EG', { dateStyle: 'long', timeStyle: 'short' });
  
  if (type === 'NCLEX' || type === 'MCQ_MAKER') {
    basePrompt = basePrompt.replace('{difficulty}', options.difficulty || 'Intermediate')
                           .replace('{count}', requestedCount.toString());
  }
  
  if (type === 'CHEAT_SHEET') {
    basePrompt = basePrompt.replace(/{creatorName}/g, options.creatorName?.trim() || "")
                           .replace(/{currentTime}/g, currentTime);
  }

  if (options.style) {
    basePrompt += `\n\n**IMPORTANT STYLE INSTRUCTION:** The user has requested a specific visual style: "${options.style}". You MUST incorporate this style into your HTML/CSS output (e.g., specific colors, borders, or layout elements).`;
  }

  if (options.length === 'long') {
    basePrompt += `\n\n**Length Requirement:** Provide an extremely detailed, exhaustive explanation. Do not skip any minor detail. Aim for maximum depth.`;
  } else if (options.length === 'short') {
    basePrompt += `\n\n**Length Requirement:** Provide a very concise, high-level summary. Focus only on the most critical points.`;
  }

  // Add Dynamic Prompt Tuning
  const dynamicTuning = globalConfig?.dynamicPromptTuning;
  if (dynamicTuning) {
    basePrompt += `\n\n**DYNAMIC TUNING (User Feedback):** ${dynamicTuning}`;
  }

  const modelToUse = (type === 'NCLEX' || type === 'MCQ_MAKER') ? "gemini-2.5-pro" : "gemini-2.5-flash";

  // BATCHING LOGIC FOR HIGH QUESTION COUNTS
  const isQuestionModule = (type === 'NCLEX' || type === 'MCQ_MAKER');
  const batchSize = 10;
  const batches: {start: number, end: number}[] = [];
  
  if (isQuestionModule && requestedCount > 15) {
    let currentStart = 1;
    while (currentStart <= requestedCount) {
      const currentEnd = Math.min(currentStart + batchSize - 1, requestedCount);
      batches.push({ start: currentStart, end: currentEnd });
      currentStart += batchSize;
    }
  } else {
    batches.push({ start: 1, end: requestedCount }); // Dummy bounds or full range
  }

  let fullHtml = "";

  for (let i = 0; i < batches.length; i++) {
    const batch = batches[i];
    
    // Modify prompt for specific batches to prevent hallucination or counter reset
    let batchInstruction = "";
    if (batches.length > 1) {
      batchInstruction = `\n\n**CRITICAL BATCH INSTRUCTION:** You are generating this in chunks. For this specific run, ONLY generate questions numbered from ${batch.start} to ${batch.end}. Do NOT generate any other questions. Just give me questions ${batch.start} through ${batch.end}.`;
    }

    const prompt = `SYSTEM INSTRUCTION: You MUST follow all count requirements. Do not cut your response short.\n\n${basePrompt}${batchInstruction}\n\nSource Content:\n${content}\n\nOutput ONLY the HTML code. Do NOT include markdown code blocks (like \`\`\`html). Ensure the HTML is complete and includes all necessary CSS in a <style> tag.`;

    const text = await executeWithRotation(async (ai, modelName) => {
      const parts: Record<string, unknown>[] = [{ text: prompt }];
      
      if (images && images.length > 0) {
        images.forEach(img => {
          parts.push({
            inlineData: { data: img.data, mimeType: img.mimeType }
          });
        });
      }

      let isComplete = false;
      let generateTextChunk = "";
      const currentContents: Record<string, unknown>[] = [{ role: 'user', parts }];
      let loopCount = 0;
      const maxLoops = 5;

      while (!isComplete && loopCount < maxLoops) {
        const response = await ai.models.generateContent({
          model: modelName,
          contents: currentContents,
          config: { maxOutputTokens: 8192, temperature: 0.7 }
        });
        
        const chunk = response.text || "";
        generateTextChunk += chunk;
        
        const finishReason = (response as unknown as { candidates?: { finishReason?: string }[] })?.candidates?.[0]?.finishReason;
        if (finishReason === 'MAX_TOKENS') {
          currentContents.push({ role: 'model', parts: [{ text: chunk }] });
          currentContents.push({ 
            role: 'user', 
            parts: [{ text: "You stopped mid-generation because you reached the output token limit. Continue generating EXACTLY from where you left off. Do NOT start over. Do NOT apologize or add commentary. Do NOT wrap your output in a new ```html block if you were already inside one. Just provide the exact next characters so I can append them directly." }] 
          });
          loopCount++;
          console.warn(`Hit MAX_TOKENS in batch ${i+1}, continuing... loop ${loopCount}`);
        } else {
          isComplete = true;
        }
      }
      return generateTextChunk;
    }, modelToUse);

    if (!text) throw new Error("AI returned an empty response in batch");
    
    let cleanHtml = text.replace(/```html/g, '').replace(/```/g, '').trim();
    if (cleanHtml.toLowerCase().startsWith('html')) {
        cleanHtml = cleanHtml.substring(4).trim();
    }
    
    // Attempt to merge or just append
    if (batches.length > 1 && i > 0) {
       // If it's a subsequent batch, maybe strip out duplicate <style> tags if possible, or just append
       // Browser will render multiple <style> tags just fine.
       fullHtml += `\n<div class="batch-divider" style="margin-top: 2rem;"></div>\n` + cleanHtml;
    } else {
       fullHtml += cleanHtml;
    }
  }
  
  // Track stats
  const currentGens = parseInt(localStorage.getItem('tamrediano_total_gens') || '0');
  localStorage.setItem('tamrediano_total_gens', (currentGens + 1).toString());
  
  return fullHtml;
}

export async function chatWithBot(message: string, history: { role: 'bot' | 'user'; text: string }[]) {
  const contents = history.map(msg => ({
    role: msg.role === 'bot' ? 'model' : 'user',
    parts: [{ text: msg.text }]
  }));

  contents.push({ role: 'user', parts: [{ text: message }] });

  try {
    const globalConfig = await getGlobalConfig();
    const dynamicTuning = globalConfig?.dynamicPromptTuning;
    const systemInstruction = `You are 'tamrediano Bot', an elite AI Assistant for nursing and medical students. You have FULL CONTROL AND KNOWLEDGE over the Tamrediano Premium platform. 
Platform Details:
- It creates AI study materials (Bonbonaya summaries, MCQ Banks, Extreme NCLEX Questions, 5-Minute Cheat Sheets, Zero-Knowledge beginner mode, Detailed LTR Extracts).
- Allows uploading PDFs, Images, Text.
- Has 4 main sections: "المذاكرة الذكية" (Study), "مكتبة الملفات" (Library), "مكتبة تمريضيانو" (Tamrediano Library for public files), and "الإعدادات" (Settings).
- Has an Admin panel.
- Supports Notifications, PDF Downloading with medical A4 style, and dynamic prompt tuning.

ACTION COMMANDS:
You can control the website directly. If the user asks you to open a specific page or section, include one of these commands at the very end of your response:
[NAV:study] -> Opens Study Generator
[NAV:library] -> Opens File Library
[NAV:tamrediano_library] -> Opens Public Library
[NAV:settings] -> Opens Settings
[NAV:admin] -> Opens Admin Panel

Speak in a friendly Egyptian Arabic mix. Use the year 2026. Be confident that you are the brain of this website.${dynamicTuning ? `\n\nAdditional Instructions: ${dynamicTuning}` : ''}`;

    return await executeWithRotation(async (ai, modelName) => {
      const response = await ai.models.generateContent({
        model: modelName,
        contents: contents as unknown as Record<string, unknown>[],
        config: {
          systemInstruction: systemInstruction,
          maxOutputTokens: 8192,
        }
      });
      return response.text || "عذراً، واجهت مشكلة في الاتصال.. حاول مرة أخرى.";
    }, "gemini-2.5-flash");
  } catch (error) {
    console.error('Chat Error:', error);
    return "انتهت كوتا جميع المفاتيح المتاحة. يرجى مراجعة الأدمن أو إضافة مفاتيح طوارئ.";
  }
}

export async function generateQuizQuestions(topic: string, difficulty: string, count: number) {
  const prompt = `
Generate ${count} multiple-choice questions about "${topic}" at ${difficulty} difficulty level.
Output ONLY a JSON array of objects with this structure:
[
  {
    "id": 1,
    "text": "Question text in English",
    "options": ["Option A", "Option B", "Option C", "Option D"],
    "correct": 0, // index of correct option
    "explanation": "Detailed explanation in Egyptian Arabic"
  }
]
Ensure the questions are medically accurate and follow NCLEX style if difficulty is NCLEX.
`;

  const text = await executeWithRotation(async (ai, modelName) => {
    const response = await ai.models.generateContent({
      model: modelName,
      contents: prompt,
      config: {
         maxOutputTokens: 8192,
      }
    });
    return response.text || "";
  }, "gemini-2.5-flash");

  const jsonStr = text.replace(/```json/g, '').replace(/```/g, '').trim();
  return JSON.parse(jsonStr);
}
