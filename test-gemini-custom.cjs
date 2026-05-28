import { GoogleGenAI } from '@google/genai';

const apiKey = "AIzaSyC7HnIFbb2E15H15lf-MN_K463mcQoFwuA";

async function test() {
  try {
    const ai = new GoogleGenAI({ apiKey });
    const response = await ai.models.generateContent({
      model: "gemini-1.5-flash",
      contents: "Hello",
    });
    console.log("Success:", response.text);
  } catch (e) {
    console.error("Gemini Error:", e.message);
  }
}

test();
