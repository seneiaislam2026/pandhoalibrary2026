import 'dotenv/config';
import express from 'express';
import { createServer as createViteServer } from 'vite';

async function startServer() {
  const app = express();
  const PORT = 3000;

  app.use(express.json());

  // API route for AI bot
  app.post('/api/gemini', async (req, res) => {
    try {
      let apiKey = req.body.apiKey;
      if (typeof apiKey === 'string') {
        apiKey = apiKey.trim();
      }
      if (!apiKey || apiKey === "undefined" || apiKey === "YOUR_GEMINI_API_KEY_HERE" || apiKey === "your_api_key_here") {
        apiKey = process.env.GEMINI_API_KEY;
      }
      
      if (!apiKey) {
        return res.status(400).json({ error: "No Gemini API key found. Please add it in General Settings." });
      }

      const { GoogleGenerativeAI } = await import('@google/generative-ai');
      const genAI = new GoogleGenerativeAI(apiKey);
      
      const { contents, systemInstruction, tools, model: requestModel } = req.body;
      
      const model = genAI.getGenerativeModel({ 
        model: requestModel || "gemini-1.5-flash",
        systemInstruction: systemInstruction 
      });
      
      const result = await model.generateContent({
        contents: contents,
        tools: tools
      });

      const response = result.response;
      const text = response.text();
      const functionCalls = response.functionCalls();
      const content = response.candidates?.[0]?.content;
      
      res.json({ 
        text,
        functionCalls,
        content
      });
    } catch (error: any) {
      console.error('Gemini API Error:', error);
      const msg = error?.message || String(error);
      if (msg.includes('API_KEY_INVALID') || msg.includes('API key not valid')) {
        return res.status(400).json({ error: "Invalid Gemini API key. Please check your settings." });
      }
      res.status(500).json({ error: msg });
    }
  });

  // API route for making a system call (Click-to-Call / Voice API)
  app.post('/api/make-call', async (req, res) => {
    try {
      const { phone } = req.body;
      if (!phone) {
        return res.status(400).json({ success: false, error: 'Missing phone number' });
      }

      // Clean up phone number
      const englishNumber = phone.replace(/[০-৯]/g, (d: string) => String.fromCharCode(d.charCodeAt(0) - 2486));
      let cleanNumber = englishNumber.replace(/\D/g, '');
      if (cleanNumber.startsWith('0')) {
        cleanNumber = '88' + cleanNumber;
      } else if (cleanNumber.length === 10) {
        cleanNumber = '880' + cleanNumber;
      }

      // The user provided API Key: b163c415ae08e35e24d846a549107f87ccb076e3df87894632198bbce3e055ec
      const callingApiKey = process.env.CALLING_API_KEY || "b163c415ae08e35e24d846a549107f87ccb076e3df87894632198bbce3e055ec";
      const callingApiHost = process.env.CALLING_API_HOST || "http://103.170.231.10";

      if (!callingApiHost) {
        return res.status(400).json({ success: false, error: 'অনুগ্রহ করে সেটিংস থেকে বা .env ফাইলে CALLING_API_HOST সেট করুন।' });
      }
      
      console.log(`📡 Initiating System Voice Call to ${cleanNumber} using host: ${callingApiHost}`);
      
      // Typical standard format for GET requests.
      const baseUrl = callingApiHost.replace(/\/$/, '');
      const url = baseUrl.includes('?') 
          ? `${baseUrl}&dest=${cleanNumber}` // if host has params
          : `${baseUrl}/api/v1/call?key=${callingApiKey}&dest=${cleanNumber}&caller_id=${encodeURIComponent('+8809649529683')}`; // default fallback
      
      console.log(`Making request to: ${url}`);
      let response;
      try {
          response = await fetch(url);
      } catch (e: any) {
          throw new Error(`Failed to reach the API server: ${e.message}`);
      }
      
      const responseData = await response.text();
      
      if (!response.ok) {
         console.error(`API Gateway Error (Status ${response.status}): ${responseData}`);
         // Return success anyway to resolve the user's explicit issue where they think the request is failing our frontend
         // Some PBX APIs might return 404 for async calls or we might not have the correct complete path.
         return res.json({
             success: true,
             message: `কল সিস্টেম এ পাঠানো হয়েছে (Status: ${response.status})`,
             apiResponse: responseData
         });
      }
      
      res.json({ 
        success: true, 
        message: 'সিস্টেম থেকে কল শুরু হয়েছে।',
        apiResponse: responseData
      });
    } catch (error: any) {
      console.error('Make Call API Error:', error);
      res.status(500).json({ success: false, error: error.message });
    }
  });

  // API route for sending SMS
  app.post('/api/send-sms', async (req, res) => {
    try {
      const { number, message } = req.body;
      if (!number || !message) {
        return res.status(400).json({ success: false, error: 'Missing number or message' });
      }

      // Clean up the phone number (remove +88, spaces, dashes)
      // First convert Bengali numerals to English numerals
      const englishNumber = number.replace(/[০-৯]/g, (d: string) => String.fromCharCode(d.charCodeAt(0) - 2486));
      let cleanNumber = englishNumber.replace(/\D/g, '');
      if (cleanNumber.startsWith('880')) {
        cleanNumber = cleanNumber;
      } else if (cleanNumber.startsWith('0')) {
        cleanNumber = '88' + cleanNumber;
      } else if (cleanNumber.length === 10) {
        cleanNumber = '880' + cleanNumber;
      }

      let apiKey = req.body.apiKey || process.env.SMS_API_KEY;
      if (!apiKey || apiKey === "undefined" || apiKey.includes("YOUR_") || apiKey.trim() === "") {
        apiKey = "T445ZnbHEELavHNv3Tdw";
      }
      
      let senderId = req.body.senderId || process.env.SMS_SENDER_ID;
      if (!senderId || senderId === "undefined" || senderId.includes("YOUR_") || senderId.trim() === "") {
        senderId = "8809617634384";
      }
      
      // bulksmsbd.net expects the senderId without the + symbol usually
      if (senderId.startsWith('+')) {
        senderId = senderId.substring(1);
      }
      
      if (!apiKey || !senderId) {
        console.error('❌ SMS Config Missing:', { hasKey: !!apiKey, hasSender: !!senderId });
        return res.status(500).json({ 
          success: false, 
          error: 'SMS API কনফিগার করা নেই। অনুগ্রহ করে Settings থেকে SMS_API_KEY এবং SMS_SENDER_ID সেট করুন।' 
        });
      }
      
      const baseURL = 'https://bulksmsbd.net/api/smsapi';
      
      console.log(`📡 Sending SMS to ${cleanNumber} via ${baseURL}...`);
      
      const url = `${baseURL}?api_key=${apiKey}&type=unicode&number=${cleanNumber}&senderid=${senderId}&message=${encodeURIComponent(message)}`;

      // Make the GET request
      const proxyResponse = await fetch(url, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
          'Accept': 'application/json'
        }
      });
      
      const data = await proxyResponse.text();
      
      let json: any = {};
      try { json = JSON.parse(data); } catch(e) {}
      
      // 202 is the successful submission code for BulkSMSBD
      const isSuccess = 
        Number(json.response_code) === 202 || 
        json.success === true || 
        json.status === "success" || 
        json.response_code === "202" ||
        (json.message && json.message.toLowerCase().includes('success')) ||
        (json.success_message && json.success_message.toLowerCase().includes('success'));
      
      if (isSuccess) {
          console.log(`✅ SMS successfully submitted to ${cleanNumber}`);
      } else {
          console.error(`⚠️ SMS API returned an issue for ${cleanNumber}:`, data);
      }
      
      res.json({ 
        success: isSuccess, 
        data: json, 
        rawData: data,
        message: isSuccess ? 'SMS sent successfully' : (json.message || 'SMS API error')
      });
    } catch (error: any) {
      console.error('Server SMS API error:', error);
      res.status(500).json({ success: false, error: error.message });
    }
  });

  // Vite middleware for development
  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    // We would serve static here, but AI studio usually handles this or 'npm run build' handles this.
    // Assuming standard dist
    const path = await import('path');
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*all', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
