import { GoogleGenAI } from '@google/genai';
import * as dotenv from 'dotenv';
dotenv.config();
const ai = new GoogleGenAI({apiKey: process.env.GEMINI_API_KEY});
async function run() {
  const r = await ai.models.generateContent({
    model: 'gemini-2.5-flash',
    contents: [{role: 'user', parts: [{text: 'Write a very long story about a frog, at least 1000 words.'}]}],
    config: { maxOutputTokens: 10 }
  });
  console.log(r.candidates?.[0]?.finishReason);
}
run().catch(console.error);
