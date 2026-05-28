import React, { useState, useEffect, useRef } from 'react';
import { 
  MessageSquare, 
  X, 
  Send, 
  Bot, 
  User, 
  Loader2, 
  Sparkles,
  Command,
  HelpCircle,
  Database,
  History,
  Lightbulb
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import ReactMarkdown from 'react-markdown';
import { db } from '../lib/firebase';
import { collection, getDocs, doc, updateDoc, serverTimestamp, query, where, orderBy, limit } from 'firebase/firestore';
import { useAuth } from '../store/AuthContext';
import { cn } from '../lib/utils';
import { GoogleGenAI, FunctionDeclaration, Type } from '@google/genai';
import toast from 'react-hot-toast';

type Message = {
  id: string;
  role: 'user' | 'model';
  content: string;
  timestamp: any;
};

// Define tool declarations for Gemini
const libraryTools: FunctionDeclaration[] = [
  {
    name: "get_books",
    description: "Fetch list of books from the library database. Can filter by category or status.",
    parameters: {
      type: Type.OBJECT,
      properties: {
        category: { type: Type.STRING, description: "Filter books by category (e.g. Novel, History)" },
        status: { type: Type.STRING, description: "Filter by status (Available, Issued)" },
        limit: { type: Type.NUMBER, description: "Limit number of results (default 50)" }
      }
    }
  },
  {
    name: "get_members",
    description: "Fetch list of library members (users). Admin only.",
    parameters: {
      type: Type.OBJECT,
      properties: {
        status: { type: Type.STRING, description: "Filter by status (active, inactive)" },
        limit: { type: Type.NUMBER, description: "Limit results" }
      }
    }
  },
  {
    name: "get_book_issues",
    description: "Fetch record of issued books. Admin only.",
    parameters: {
      type: Type.OBJECT,
      properties: {
        status: { type: Type.STRING, description: "Filter by status (ISSUED, Returned)" },
        overdueOnly: { type: Type.BOOLEAN, description: "Only show overdue books" }
      }
    }
  },
  {
    name: "get_finances",
    description: "Fetch financial records (income/expense) of the library. Admin only.",
    parameters: {
      type: Type.OBJECT,
      properties: {
        type: { type: Type.STRING, description: "Filter by type (Income, Expense)" },
        limit: { type: Type.NUMBER, description: "Limit number of records" }
      }
    }
  },
  {
    name: "extend_due_date",
    description: "Extend the expected return date of a book issue. Admin only.",
    parameters: {
      type: Type.OBJECT,
      properties: {
        issueId: { type: Type.STRING, description: "The ID of the issue record (e.g. ISS-123456789)" },
        daysToAdd: { type: Type.NUMBER, description: "Number of days to add to current due date (default 7)" }
      },
      required: ["issueId"]
    }
  },
  {
    name: "get_donors",
    description: "Fetch information about library donors and their contributions.",
    parameters: {
      type: Type.OBJECT,
      properties: {
        type: { type: Type.STRING, description: "Donor type (Member, One-time)" }
      }
    }
  }
];

const AIBot = () => {
  const { user, loading } = useAuth();
  const [isOpen, setIsOpen] = useState(false);
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const [dbStats, setDbStats] = useState<any>(null);

  const isAdmin = user?.role === 'admin' || user?.role === 'superadmin';

  // Tool Handlers
  const toolHandlers: Record<string, (args: any) => Promise<any>> = {
    get_books: async ({ category, status, limit: limitCount = 50 }) => {
      let q = query(collection(db, 'books'), limit(limitCount));
      if (category) q = query(q, where('category', '==', category));
      if (status) q = query(q, where('status', '==', status));
      const snap = await getDocs(q);
      return snap.docs.map(d => ({ id: d.id, title: d.data().title, author: d.data().author, category: d.data().category, status: d.data().status, bookCode: d.data().bookCode }));
    },
    get_members: async ({ status, limit: limitCount = 50 }) => {
      if (!isAdmin) return { error: "Permission Denied: Admin access required." };
      let q = query(collection(db, 'users'), limit(limitCount));
      if (status) q = query(q, where('status', '==', status));
      const snap = await getDocs(q);
      return snap.docs.map(d => ({ id: d.id, name: d.data().name, memberId: d.data().memberId, email: d.data().email, role: d.data().role, status: d.data().status }));
    },
    get_book_issues: async ({ status, overdueOnly }) => {
      if (!isAdmin) return { error: "Permission Denied: Admin access required." };
      let q = query(collection(db, 'issues'), orderBy('expectedReturnDate', 'asc'));
      if (status) q = query(q, where('status', '==', status));
      const snap = await getDocs(q);
      let data = snap.docs.map(d => ({ id: d.id, ...d.data() } as any));
      if (overdueOnly) {
        data = data.filter(i => (i.status === 'ISSUED' || i.status === 'Issued') && new Date(i.expectedReturnDate) < new Date());
      }
      return data;
    },
    get_finances: async ({ type, limit: limitCount = 20 }) => {
      if (!isAdmin) return { error: "Permission Denied: Admin access required." };
      let q = query(collection(db, 'finances'), orderBy('date', 'desc'), limit(limitCount));
      if (type) q = query(q, where('type', '==', type));
      const snap = await getDocs(q);
      return snap.docs.map(d => ({ id: d.id, ...d.data() }));
    },
    get_donors: async ({ type }) => {
      const snap = await getDocs(collection(db, 'donors'));
      return snap.docs.map(d => ({ id: d.id, ...d.data() }));
    },
    extend_due_date: async ({ issueId, daysToAdd = 7 }) => {
      if (!isAdmin) return { error: "Permission Denied: Admin access required." };
      try {
        const snap = await getDocs(query(collection(db, 'issues'), where('__name__', '==', issueId)));
        if (snap.empty) return { error: `Issue record with ID ${issueId} not found.` };
        
        const issueData = snap.docs[0].data();
        const currentExpected = new Date(issueData.expectedReturnDate);
        currentExpected.setDate(currentExpected.getDate() + daysToAdd);
        
        await updateDoc(doc(db, "issues", issueId), {
          expectedReturnDate: currentExpected.toISOString(),
          adminNote: `AI Extended: Added ${daysToAdd} days.`,
          updatedAt: serverTimestamp()
        });
        
        toast.success(`AI extended due date for ${issueData.bookTitle}`);
        return { success: true, newDueDate: currentExpected.toISOString(), bookTitle: issueData.bookTitle };
      } catch (e: any) {
        return { error: e.message };
      }
    }
  };

  const userSuggestions = [
    "বই খুঁজবো কিভাবে?",
    "নতুন বই কি কি আছে?",
    "কিভাবে মেম্বার হওয়া যায়?",
    "বই ফেরত দেওয়ার নিয়ম কি?"
  ];

  const adminSuggestions = [
    "লাইব্রেরি স্ট্যাটাস দেখাও",
    "অ্যাক্টিভ ইস্যু কতগুলো?",
    "সবচেয়ে জনপ্রিয় বই কোনটি?",
    "হিসাব নিকাশ দেখাও"
  ];

  const currentSuggestions = isAdmin ? adminSuggestions : userSuggestions;

  // Auto-scroll to bottom
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages]);

  // Initial greeting
  useEffect(() => {
    if (messages.length === 0) {
      const greeting = isAdmin 
        ? `আসসালামু আলাইকুম অ্যাডমিন! আমি আপনার লাইব্রেরি ম্যানেজার Gemini। আমি আপনাকে লাইব্রেরি স্ট্যাটাস চেক করতে, হিসাব নিকাশ দেখতে বা সিস্টেম পরিচালনা করতে সাহায্য করতে পারি।`
        : `আসসালামু আলাইকুম! আমি আপনার লাইব্রেরি অ্যাসিস্ট্যান্ট Gemini। আমি আপনাকে বই খুঁজে পেতে বা লাইব্রেরি সম্পর্কে জানতে সাহায্য করতে পারি।`;
      
      setMessages([{
        id: '1',
        role: 'model',
        content: greeting,
        timestamp: new Date()
      }]);
    }
    if (!loading) {
      fetchStats();
    }
  }, [isAdmin, loading]);

  const fetchStats = async () => {
    try {
      const { getCountFromServer, query, where } = await import('firebase/firestore');
      
      const cachedStats = sessionStorage.getItem('ai_bot_stats_' + (isAdmin ? 'admin' : 'user'));
      const cacheTime = sessionStorage.getItem('ai_bot_stats_time_' + (isAdmin ? 'admin' : 'user'));
      
      if (cachedStats && cacheTime && (Date.now() - parseInt(cacheTime) < 15 * 60 * 1000)) {
         setDbStats(JSON.parse(cachedStats));
         return;
      }

      const booksSnap = await getCountFromServer(collection(db, 'books'));
      
      let totalMembers = 0;
      let activeIssues = 0;

      if (isAdmin) {
        const membersSnap = await getCountFromServer(collection(db, 'users'));
        
        const issuesSnap1 = await getCountFromServer(query(collection(db, 'issues'), where('status', '==', 'ISSUED')));
        const issuesSnap2 = await getCountFromServer(query(collection(db, 'issues'), where('status', '==', 'Issued')));
        
        totalMembers = membersSnap.data().count;
        activeIssues = issuesSnap1.data().count + issuesSnap2.data().count;
      }
      
      const stats = {
        totalBooks: booksSnap.data().count,
        totalMembers,
        activeIssues
      };

      setDbStats(stats);
      sessionStorage.setItem('ai_bot_stats_' + (isAdmin ? 'admin' : 'user'), JSON.stringify(stats));
      sessionStorage.setItem('ai_bot_stats_time_' + (isAdmin ? 'admin' : 'user'), Date.now().toString());

    } catch (error) {
      if (error instanceof Error && error.message.includes('Quota')) return;
      console.error("Error fetching stats for AI:", error);
    }
  };

  const handleSend = async (text?: string, e?: React.FormEvent) => {
    const finalInput = text || input;
    if (e) e.preventDefault();
    if (!finalInput.trim() || isLoading) return;

    // Remove duplicates or old messages if hanging
    const userMessage: Message = {
      id: `msg-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      role: 'user',
      content: finalInput,
      timestamp: new Date()
    };

    setMessages(prev => [...prev, userMessage]);
    if (!text) setInput('');
    setIsLoading(true);

    try {
      const dbDoc = await import('firebase/firestore').then(mod => mod.getDoc(mod.doc(db, 'settings', 'general')));
      const aiToken = dbDoc.exists() ? dbDoc.data().sysToken : '';

      // Use local API for both dev and prod
      const apiUrl = '/api/gemini';

      const systemPrompt = isAdmin 
        ? `You are a highly intelligent Admin-Level Library Management Assistant for "পানধোয়া উন্মুক্ত পাঠাগার".
           Your name is "বইবন্ধু" (Boibondhu).
           Your role is to help the ADMIN manage the system efficiently.
           
           DATA ACCESS: You have access to real-time tools to fetch books, members, financial records (hisab boi), and book issues.
           CAPABILITIES: You can look up any data from the admin panel and even extend book due dates when asked.
           
           RULES:
           1. CRITICAL: NEVER use the word "নমষ্কার" (Namaskar). Use "আসসালামু আলাইকুম" or direct professional greetings.
           2. POLICY: বই পড়ার জন্য সাধারণ সময়সীমা ৭ দিন (Standard book borrowing duration is 7 days).
           3. ONLINE OPERATIONS: আমাদের সকল কার্যক্রম অনলাইনে পরিচালিত হয়, তাই কোনো কাগজের স্বাক্ষর (Physical Signature) প্রয়োজন নেই। (All activities are online, no physical signature required).
           4. MEMORY: Always remember details shared by the user during this conversation. If they mention their name, preferences, or specific issues, recall them in future turns.
           5. ETIQUETTE: কোনো পাঠককে বা ব্যবহারকারীকে 'ভাই' বলে সম্বোধন করবেন না। (Do not address any reader or user as 'ভাই' or 'Bhai').
           6. BOOK CODES: আমাদের লাইব্রেরির বইয়ের কোড এবং স্টিকার এখন ইংরেজি ফরম্যাটে জেনারেট হয় (e.g., NOV-1233)। (Book codes and stickers are generated in English format, e.g., CATEGORY-NNNN).
           
           Context:
           - Total Books: ${dbStats?.totalBooks || 'Unknown'}
           - Total Members: ${dbStats?.totalMembers || 'Unknown'}
           - Active Book Issues: ${dbStats?.activeIssues || 'Unknown'}
           
           Language: Primarily Bengali, or professional Banglish.`
        : `You are a highly intelligent and friendly Library User Assistant for "পানধোয়া উন্মুক্ত পাঠাগার".
           Your name is "বইবন্ধু" (Boibondhu).
           Your role is to guide and inspire readers.
           
           DATA ACCESS: You can look up books, library info, and donor details using your tools.
           
           RULES:
           1. CRITICAL: NEVER use the word "নমষ্কার" (Namaskar). Use "আসসালামু আলাইকুম" or friendly greetings.
           2. POLICY: বই পড়ার জন্য সাধারণত ৭ দিন সময় দেয়া হয় (Books are usually issued for 7 days).
           3. ONLINE OPERATIONS: আমাদের সকল কার্যক্রম অনলাইনে হয়, তাই কোনো কাগজের স্বাক্ষরের প্রয়োজন নেই। (All our activities are online, no signature required).
           4. MEMORY: Carefully remember any information the user shares (like their name, favorite genres, or books they are looking for). Use this context to provide personalized responses.
           5. ETIQUETTE: কোনো পাঠককে 'ভাই' বলে সম্বোধন করবেন না। (Do not address any reader as 'ভাই' or 'Bhai').
           6. BOOK CODES: আমাদের লাইব্রেরির বইয়ের কোড এবং স্টিকার এখন ইংরেজি ফরম্যাটে জেনারেট হয় (e.g., NOV-1233)। (Book codes and stickers are generated in English format, e.g., CATEGORY-NNNN).
           
           Context:
           - Total Books: ${dbStats?.totalBooks || 'Unknown'}
           
           Responsibilities:
           1. Smart Book Suggestions: Recommend books based on user interests or trends.
           2. Issue Guidance: provide step-by-step help on how to request or issue a book.
           3. Information: Provide library address, Board of Directors (পরিচালনা পর্ষদ) details, and donor recognition.
           4. Engagement: Answer general questions about literature and the library.
           
           Language: Primarily Bengali, or friendly Banglish.`;

      let contents = [
        ...messages.filter(m => m.id !== '1').map(m => ({
          role: m.role,
          parts: [{ text: m.content }]
        })),
        { role: 'user', parts: [{ text: finalInput }] }
      ];

      // Deep call loop for tool handling
      let maxTurns = 5;
      let finalAiResponse = '';
      
      while (maxTurns > 0) {
        try {
          const controller = new AbortController();
          const timeoutId = setTimeout(() => controller.abort(), 30000); // 30s timeout
          
          const rawResponse = await fetch(apiUrl, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ 
              apiKey: aiToken,
              model: "gemini-3-flash-preview",
              contents, 
              systemInstruction: systemPrompt,
              tools: [{ functionDeclarations: libraryTools }]
            }),
            signal: controller.signal
          });
          clearTimeout(timeoutId);

          if (!rawResponse.ok) {
            const errorData = await rawResponse.json().catch(() => ({}));
            throw new Error(errorData.error || `Server error: ${rawResponse.status}`);
          }

          const response = await rawResponse.json();

          const functionCalls = response.functionCalls;
          
          if (functionCalls && functionCalls.length > 0) {
            const toolResults = [];
            
            for (const call of functionCalls) {
              const handler = toolHandlers[call.name as keyof typeof toolHandlers];
              if (handler) {
                const result = await handler(call.args);
                toolResults.push({
                  role: 'model', 
                  parts: [{
                    functionResponse: {
                      name: call.name,
                      response: { result }
                    }
                  }]
                });
              }
            }
            
            // Append the model's full response content to context to preserve thoughts and function calls
            contents.push(response.content);
            
            contents.push(...toolResults as any);
            maxTurns--;
          } else {
            finalAiResponse = response.text || "দুঃখিত, আমি এই মুহূর্তে উত্তর দিতে পারছি না।";
            // Also append the final text response to maintain history correctly
            if (response.content) {
              contents.push(response.content);
            }
            break;
          }
        } catch (err: any) {
          console.error("Gemini Error:", err);
          finalAiResponse = "দুঃখিত, এআই সার্ভারে সমস্যা হচ্ছে। অনুগ্রহ করে পরে চেষ্টা করুন বা এডমিনের সাথে যোগাযোগ করুন।";
          break;
        }
      }

      const aiMessage: Message = {
        id: `msg-ai-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
        role: 'model',
        content: finalAiResponse || 'এই তথ্য এখন পাওয়া যাচ্ছে না।',
        timestamp: new Date()
      };

      setMessages(prev => [...prev, aiMessage]);
    } catch (error: any) {
      console.error("AI Error:", error);
      let errorMsg = `দুঃখিত, কিছু একটা ভুল হয়েছে। চ্যাটবটটি কাজ করছে না। দয়া করে কিছুক্ষণ পর আবার চেষ্টা করুন।`;
      const serverError = error?.message || String(error);
      
      errorMsg = `দুঃখিত, এই মুহূর্তে সার্ভারে সমস্যা হচ্ছে। অনুগ্রহ করে কিছুক্ষণ পরে আবার চেষ্টা করুন।`;

      setMessages(prev => [...prev, {
        id: `msg-err-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
        role: 'model',
        content: errorMsg,
        timestamp: new Date()
      }]);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <>
      {/* Chat Window */}
      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0, y: 20, scale: 0.95, transformOrigin: 'bottom right' }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 20, scale: 0.95 }}
            className={cn(
              "fixed right-0 sm:right-6 w-full sm:w-[400px] lg:w-[500px] h-full sm:h-[600px] lg:h-[750px] sm:max-h-[85vh] bg-white sm:rounded-[2rem] shadow-[0_20px_50px_rgba(0,0,0,0.15)] border border-slate-200 flex flex-col z-50 overflow-hidden font-bengali",
              user ? "bottom-0 sm:bottom-28 md:bottom-32" : "bottom-0 sm:bottom-28"
            )}
            id="ai-chat-window"
          >
            {/* Header */}
            <div className="p-4 bg-indigo-600 text-white flex items-center justify-between shadow-lg relative z-10 shrink-0">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-white/20 rounded-xl flex items-center justify-center backdrop-blur-md">
                  <Bot className="w-6 h-6 text-white" />
                </div>
                <div>
                  <h3 className="font-bold text-sm">লাইব্রেরি অ্যাসিস্ট্যান্ট Gemini {isAdmin ? '(Admin)' : ''}</h3>
                  <div className="flex items-center gap-1.5">
                    <span className="w-1.5 h-1.5 bg-green-400 rounded-full animate-pulse" />
                    <span className="text-[10px] text-indigo-100 font-medium">Online</span>
                  </div>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <div className="bg-white/10 p-2 rounded-lg backdrop-blur-md">
                  <Sparkles className="w-4 h-4 text-indigo-200" />
                </div>
                <button 
                  onClick={() => setIsOpen(false)}
                  className="sm:hidden p-2 hover:bg-white/10 rounded-lg transition-colors"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>

            {/* Stats Bar */}
            <div className="px-4 py-2 bg-slate-50 border-b border-slate-100 flex items-center justify-between gap-2 overflow-x-auto shrink-0">
              <div className="flex items-center gap-1.5 whitespace-nowrap">
                <Database className="w-3 h-3 text-slate-400" />
                <span className="text-[10px] text-slate-500 font-bold uppercase tracking-wider">বই: {dbStats?.totalBooks || '0'}</span>
              </div>
              <div className="flex items-center gap-1.5 whitespace-nowrap">
                <History className="w-3 h-3 text-slate-400" />
                <span className="text-[10px] text-slate-500 font-bold uppercase tracking-wider">ইস্যু: {dbStats?.activeIssues || '0'}</span>
              </div>
            </div>

            {/* Messages */}
            <div 
              ref={scrollRef}
              className="flex-1 overflow-y-auto p-4 space-y-4 bg-slate-50/50 custom-scrollbar"
            >
              <AnimatePresence initial={false}>
                {messages.map((msg) => (
                  <motion.div
                    key={msg.id}
                    initial={{ opacity: 0, y: 10, scale: 0.95 }}
                    animate={{ opacity: 1, y: 0, scale: 1 }}
                    transition={{ duration: 0.3, ease: "easeOut" }}
                    className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
                  >
                    <div className={`flex gap-2 max-w-[85%] ${msg.role === 'user' ? 'flex-row-reverse' : 'flex-row'}`}>
                      <div className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 mt-1 ${
                        msg.role === 'user' ? 'bg-indigo-100 text-indigo-600' : 'bg-white shadow-sm border border-slate-100 text-slate-600'
                      }`}>
                        {msg.role === 'user' ? <User className="w-4 h-4" /> : <Bot className="w-4 h-4" />}
                      </div>
                      <div className={`p-3 rounded-2xl text-sm leading-relaxed ${
                        msg.role === 'user' 
                          ? 'bg-indigo-600 text-white rounded-tr-none shadow-md' 
                          : 'bg-white text-slate-700 shadow-sm border border-slate-100 rounded-tl-none'
                      }`}>
                        <div className="markdown-body prose prose-sm max-w-none prose-p:leading-relaxed prose-pre:bg-slate-900 prose-pre:text-indigo-300">
                          <ReactMarkdown>{msg.content}</ReactMarkdown>
                        </div>
                      </div>
                    </div>
                  </motion.div>
                ))}
                {isLoading && (
                  <motion.div 
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="flex justify-start"
                  >
                    <div className="flex gap-2 max-w-[85%]">
                      <div className="w-8 h-8 rounded-lg bg-white shadow-sm border border-slate-100 flex items-center justify-center">
                        <Bot className="w-4 h-4 text-slate-400" />
                      </div>
                      <div className="bg-white border border-slate-100 p-3 rounded-2xl rounded-tl-none shadow-sm flex items-center gap-2">
                        <div className="flex gap-1">
                          <motion.div animate={{ y: [0, -5, 0] }} transition={{ duration: 0.6, repeat: Infinity, delay: 0 }} className="w-1.5 h-1.5 bg-indigo-400 rounded-full" />
                          <motion.div animate={{ y: [0, -5, 0] }} transition={{ duration: 0.6, repeat: Infinity, delay: 0.2 }} className="w-1.5 h-1.5 bg-indigo-400 rounded-full" />
                          <motion.div animate={{ y: [0, -5, 0] }} transition={{ duration: 0.6, repeat: Infinity, delay: 0.4 }} className="w-1.5 h-1.5 bg-indigo-400 rounded-full" />
                        </div>
                        <span className="text-xs text-slate-400 italic font-medium">Gemini লিখছে...</span>
                      </div>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>

            {/* Suggestions Chips */}
            {!isLoading && messages.length < 5 && (
              <div className="px-4 pb-2 bg-slate-50/50 flex flex-wrap gap-2 shrink-0">
                {currentSuggestions.map((s, i) => (
                  <button
                    key={i}
                    onClick={() => handleSend(s)}
                    className="text-[11px] bg-white border border-slate-200 px-3 py-1.5 rounded-full hover:bg-slate-100 hover:border-slate-300 text-slate-600 transition-all flex items-center gap-1.5 shadow-sm"
                  >
                    <Lightbulb className="w-3 h-3 text-orange-400" />
                    {s}
                  </button>
                ))}
              </div>
            )}

            {/* Input Form */}
            <form onSubmit={(e) => handleSend(undefined, e)} className="p-4 border-t border-slate-100 bg-white shrink-0">
              <div className="relative group">
                <input
                  type="text"
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  placeholder="বই খুঁজুন বা প্রশ্ন করুন..."
                  className="w-full pl-10 pr-12 py-3 bg-slate-50 border border-slate-200 rounded-2xl focus:bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500/20 transition-all text-sm group-hover:border-slate-300"
                />
                <Command className="absolute left-3.5 top-3.5 w-4 h-4 text-slate-400 group-focus-within:text-indigo-500 transition-colors" />
                <button
                  type="submit"
                  disabled={!input.trim() || isLoading}
                  className="absolute right-2 top-2 p-1.5 bg-indigo-600 text-white rounded-xl hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed transition-all shadow-lg shadow-indigo-200"
                >
                  <Send className="w-4 h-4" />
                </button>
              </div>
              <div className="flex items-center justify-center gap-1.5 mt-3">
                <HelpCircle className="w-3 h-3 text-slate-300" />
                <span className="text-[10px] text-slate-400 font-medium tracking-tight">AI can make mistakes. Verify important info.</span>
              </div>
            </form>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Floating Toggle Button */}
      <motion.button
        initial={{ scale: 0, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        onClick={() => setIsOpen(!isOpen)}
        className={cn(
          "fixed right-4 sm:right-6 w-12 h-12 text-white rounded-full shadow-2xl items-center justify-center transition-all z-[60] group",
          user ? "bottom-[100px] sm:bottom-6" : "bottom-6",
          isOpen ? "hidden sm:flex bg-slate-800" : "flex bg-indigo-600 hover:bg-indigo-700"
        )}
        id="ai-bot-toggle"
      >
        <AnimatePresence mode="wait">
          {isOpen ? (
            <motion.div
              key="close"
              initial={{ rotate: -90, opacity: 0 }}
              animate={{ rotate: 0, opacity: 1 }}
              exit={{ rotate: 90, opacity: 0 }}
              className="flex items-center justify-center w-full h-full"
            >
              <X className="w-6 h-6" />
            </motion.div>
          ) : (
            <motion.div
              key="open"
              initial={{ rotate: 90, opacity: 0 }}
              animate={{ rotate: 0, opacity: 1 }}
              exit={{ rotate: -90, opacity: 0 }}
              className="flex items-center justify-center w-full h-full relative"
            >
              <Bot className="w-6 h-6" />
              <div className="absolute top-2 right-2 w-3 h-3 bg-red-500 rounded-full border-2 border-indigo-600 animate-pulse" />
            </motion.div>
          )}
        </AnimatePresence>
        
        {/* Glow effect */}
        <div className="absolute inset-0 bg-white/20 opacity-0 group-hover:opacity-100 transition-opacity rounded-full pointer-events-none" />
      </motion.button>
    </>
  );
};

export default AIBot;