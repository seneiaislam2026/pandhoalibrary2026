import React, { useState, useEffect, useRef } from 'react';
import { Send, Sparkles, Bot, Clock, AlertCircle } from 'lucide-react';

interface ChatMessage {
  sender: 'user' | 'ai';
  text: string;
  timestamp: Date;
}

interface PracticeAIChatProps {
  user: any;
  selectedCategoryName: string;
}

export default function PracticeAIChat({ user, selectedCategoryName }: PracticeAIChatProps) {
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([
    {
      sender: 'ai',
      text: `প্রিয় ${user?.name || 'শিক্ষার্থী'}, আমি 'চর্চা AI' রোবট।${selectedCategoryName ? ` তোমার ${selectedCategoryName} সংশ্লিষ্ট` : ''} যেকোনো একাডেমিক বিষয় বুঝতে অথবা নতুন কুইজ খেলতে আমার সাহায্য নিতে পারো! যেমন: 'তাপমাত্রা কাকে বলে?', 'বিজ্ঞানের মজার কুইজ ধরো', বা 'ইংরেজি গ্রামার শেখাও'। আজ কীভাবে সাহায্য করতে পারি?`,
      timestamp: new Date()
    }
  ]);
  const [userInputMessage, setUserInputMessage] = useState('');
  const [sendingMessage, setSendingMessage] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [chatMessages, sendingMessage]);

  const handleSendMessage = async (msgText: string) => {
    if (!msgText.trim() || sendingMessage) return;

    const userMsg: ChatMessage = { sender: 'user', text: msgText, timestamp: new Date() };
    setChatMessages(prev => [...prev, userMsg]);
    setUserInputMessage('');
    setSendingMessage(true);

    try {
      // Build brief context history
      const formattedHistory = chatMessages.slice(-5).map(m => ({
        role: m.sender === 'user' ? 'user' : 'model',
        parts: [{ text: m.text }]
      }));
      formattedHistory.push({ role: 'user', parts: [{ text: msgText }] });

      const res = await fetch('/api/gemini', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: formattedHistory,
          systemInstruction: `তুমি পানধোয়া উন্মুক্ত পাঠাগার এর 'চর্চা AI' সহকারী পরীক্ষার রোবট। তুমি ষষ্ঠ শ্রেণী থেকে শুরু করে বিসিএস পরীক্ষার্থী পর্যন্ত সকল শিক্ষার্থীদের সহজ ও সুন্দর ভাষায় স্নেহের সাথে পড়ালেখা বুঝিয়ে দাও। সবসময় বাংলায় অত্যন্ত উৎসবমুখর, সহায়ক ও মার্জিত সুরে উত্তর দেবে। উত্তরগুলো পরিষ্কার ও আকর্ষণীয় ফরম্যাটে সাজিয়ে দেবে।`,
          model: "gemini-3.5-flash"
        })
      });

      if (!res.ok) {
        throw new Error('API request failed');
      }

      const data = await res.json();
      const aiReply = data.text || 'দুঃখিত, আমি এই মুহূর্তে উত্তর তৈরি করতে পারছি না। দয়া করে আবার চেষ্টা করো।';

      setChatMessages(prev => [...prev, {
        sender: 'ai',
        text: aiReply,
        timestamp: new Date()
      }]);
    } catch (err) {
      console.error('Chat AI error:', err);
      setChatMessages(prev => [...prev, {
        sender: 'ai',
        text: '⚠️ নেটওয়ার্ক সংযোগে সমস্যা হয়েছে। দয়া করে কিছুক্ষণ পর আবার চেষ্টা করো।',
        timestamp: new Date()
      }]);
    } finally {
      setSendingMessage(false);
    }
  };

  const suggestions = [
    { text: '🔬 বিজ্ঞানের একটি কুইজ ধরো', prompt: 'আমাকে বিজ্ঞান থেকে ১টি চমৎকার কুইজ প্রশ্ন ধরো ও উত্তর মেলাও।' },
    { text: '📏 জ্যামিতি শেখাও', prompt: 'জ্যামিতির কোণ এবং ত্রিভুজ সম্পর্কে সহজে আমাকে বুঝিয়ে দাও।' },
    { text: '📝 রুটিন তৈরি করে দাও', prompt: 'পরীক্ষার প্রস্তুতির জন্য একটি ৫ দিনের সহজ স্টাডি রুটিন তৈরি করে দাও।' }
  ];

  return (
    <div className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700/80 rounded-[2.5rem] shadow-xl overflow-hidden max-w-4xl mx-auto flex flex-col h-[600px]">
      {/* Bot Chat Header */}
      <div className="bg-gradient-to-r from-violet-600 via-indigo-600 to-indigo-700 p-5 text-white flex items-center justify-between shrink-0 shadow-sm">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-white/10 rounded-xl flex items-center justify-center border border-white/20 shadow-inner">
            <Bot className="w-5 h-5 text-indigo-200 animate-pulse" />
          </div>
          <div>
            <h3 className="font-extrabold text-sm sm:text-base leading-snug">চর্চা AI রিয়েল-টাইম টিউটর</h3>
            <p className="text-[10px] text-indigo-200 font-medium">স্মার্ট কুইজ এবং পড়াশোনা সাহায্যকারী</p>
          </div>
        </div>
        <div className="flex items-center gap-1.5 px-3 py-1 bg-white/10 rounded-full border border-white/10 text-xs font-bold leading-none">
          <Sparkles className="w-3.5 h-3.5 text-amber-300 pointer-events-none" />
          <span>সক্রিয় এবং প্রস্তুত</span>
        </div>
      </div>

      {/* Chat messages */}
      <div className="flex-1 overflow-y-auto p-4 sm:p-6 bg-slate-50/50 dark:bg-slate-900/30 space-y-4">
        {chatMessages.map((msg, index) => {
          const isUser = msg.sender === 'user';
          return (
            <div
              key={index}
              className={`flex items-start gap-2.5 max-w-[85%] ${isUser ? 'ml-auto flex-row-reverse' : 'mr-auto'}`}
            >
              {/* Profile Avatar */}
              <div className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 shadow-sm border ${
                isUser ? 'bg-indigo-600 border-indigo-500 text-white' : 'bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-indigo-600'
              }`}>
                {isUser ? '👤' : '🤖'}
              </div>

              {/* Speech bubble */}
              <div className={`rounded-2xl p-4 shadow-sm text-xs sm:text-sm leading-relaxed ${
                isUser
                  ? 'bg-indigo-600 text-white rounded-tr-none'
                  : 'bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-100 border border-slate-200/50 dark:border-slate-700/60 rounded-tl-none whitespace-pre-wrap'
              }`}>
                {msg.text}
                <div className={`text-[9px] mt-2 flex items-center gap-1 opacity-65 ${isUser ? 'justify-end text-indigo-200' : 'text-slate-400'}`}>
                  <Clock className="w-3 h-3" />
                  <span>
                    {msg.timestamp.toLocaleTimeString('bn-BD', { hour: '2-digit', minute: '2-digit' })}
                  </span>
                </div>
              </div>
            </div>
          );
        })}

        {sendingMessage && (
          <div className="flex items-start gap-2.5 mr-auto max-w-[85%]">
            <div className="w-8 h-8 rounded-lg bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-indigo-600 flex items-center justify-center shrink-0 shadow-sm">
              🤖
            </div>
            <div className="bg-white dark:bg-slate-800 rounded-2xl p-4 shadow-sm border border-slate-200/50 dark:border-slate-700/60 rounded-tl-none">
              <div className="flex items-center gap-1.5 py-1">
                <span className="w-2 h-2 bg-indigo-600 rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
                <span className="w-2 h-2 bg-indigo-600 rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
                <span className="w-2 h-2 bg-indigo-600 rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
              </div>
            </div>
          </div>
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Suggested Bubbles */}
      <div className="p-3 bg-white dark:bg-slate-800 border-t border-slate-100 dark:border-slate-700/50 flex flex-wrap gap-2 shrink-0">
        {suggestions.map((s, i) => (
          <button
            key={i}
            onClick={() => handleSendMessage(s.prompt)}
            disabled={sendingMessage}
            className="px-3.5 py-1.5 bg-indigo-50 hover:bg-indigo-100 dark:bg-slate-900/40 dark:hover:bg-slate-950 text-indigo-700 dark:text-indigo-300 text-[11px] sm:text-xs font-extrabold border border-indigo-100/40 dark:border-indigo-900/50 rounded-full transition active:scale-95 cursor-pointer disabled:opacity-50"
          >
            {s.text}
          </button>
        ))}
      </div>

      {/* Inputs box */}
      <form
        onSubmit={(e) => {
          e.preventDefault();
          handleSendMessage(userInputMessage);
        }}
        className="p-4 bg-white dark:bg-slate-800 border-t border-slate-100 dark:border-slate-700/80 flex gap-2 shrink-0"
      >
        <input
          type="text"
          placeholder="পড়ালেখা সংক্রান্ত যেকোনো প্রশ্ন জিজ্ঞেস করো এখানে..."
          value={userInputMessage}
          onChange={(e) => setUserInputMessage(e.target.value)}
          disabled={sendingMessage}
          className="flex-1 bg-slate-50 dark:bg-slate-900 hover:bg-slate-100/50 hover:dark:bg-slate-950 border border-slate-200 dark:border-slate-700/60 rounded-2xl px-4 py-3 text-xs sm:text-sm text-slate-800 dark:text-slate-100 placeholder-slate-400 focus:outline-none focus:border-indigo-500 font-bold transition-all"
        />
        <button
          type="submit"
          disabled={!userInputMessage.trim() || sendingMessage}
          className="px-5 bg-indigo-600 hover:bg-indigo-500 disabled:bg-slate-200 dark:disabled:bg-slate-700/50 disabled:text-slate-400 dark:disabled:text-slate-500 text-white rounded-2xl transition shadow-md active:scale-95 flex items-center justify-center shrink-0 cursor-pointer"
        >
          <Send className="w-4 h-4 pointer-events-none" />
        </button>
      </form>
    </div>
  );
}
