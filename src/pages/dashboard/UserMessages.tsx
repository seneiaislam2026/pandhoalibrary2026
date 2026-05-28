import React, { useEffect, useState } from 'react';
import { useAuth } from '../../store/AuthContext';
import { Mail, MessageSquare, Clock, User, CheckCircle, Reply, ChevronDown, ChevronUp } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { onSnapshot, collection, query, where, updateDoc, doc, orderBy, or, addDoc } from 'firebase/firestore';
import { db } from '../../lib/firebase';
import toast from 'react-hot-toast';

interface Message {
  id: string;
  fromUserId: string;
  fromUserName: string;
  toUserId: string;
  toUserName: string;
  subject: string;
  content: string;
  date: string;
  isRead: boolean;
}

export default function UserMessages() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [loading, setLoading] = useState(true);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [replyingToId, setReplyingToId] = useState<string | null>(null);
  const [replyContent, setReplyContent] = useState('');
  const [sendingReply, setSendingReply] = useState(false);
  const { user } = useAuth();

  useEffect(() => {
    if (!user) return;
    const q = query(
      collection(db, "messages"),
      or(
        where("toUserId", "==", user.id),
        where("fromUserId", "==", user.id),
        where("toUserId", "==", "all")
      ),
      orderBy("date", "desc")
    );
    const unsubscribe = onSnapshot(q, (snapshot) => {
      setMessages(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })) as Message[]);
      setLoading(false);
    }, (err) => {
      console.error("UserMessages snapshot error:", err);
      // Fallback
      const qFallback = query(collection(db, "messages"), where("toUserId", "==", user.id));
      onSnapshot(qFallback, (s) => {
        setMessages(s.docs.map(d => ({ id: d.id, ...d.data() })) as Message[]);
        setLoading(false);
      }, (e) => {
        console.error("UserMessages fallback snapshot error:", e);
        setLoading(false);
      });
    });
    return () => unsubscribe();
  }, [user]);

  const markAsRead = async (id: string, msg: Message) => {
    if (msg.toUserId !== user?.id || msg.isRead) return;
    try {
      await updateDoc(doc(db, "messages", id), { isRead: true });
    } catch (err) {
      console.error("Error marking message as read:", err);
    }
  };

  const toggleExpand = (id: string, msg: Message) => {
    if (expandedId === id) {
      setExpandedId(null);
      setReplyingToId(null);
      setReplyContent('');
    } else {
      setExpandedId(id);
      markAsRead(id, msg);
    }
  };

  const handleReplySubmit = async (e: React.FormEvent, msg: Message) => {
    e.preventDefault();
    if (!replyContent.trim() || !user || sendingReply) return;
    setSendingReply(true);
    
    try {
      await addDoc(collection(db, "messages"), {
        toUserId: msg.fromUserId === "system" ? "admin" : msg.fromUserId,
        toUserName: msg.fromUserName || "Admin",
        fromUserId: user.id,
        fromUserName: user.name,
        subject: `Re: ${msg.subject.replace(/^Re:\s*/i, '')}`,
        content: replyContent,
        date: new Date().toISOString(),
        isRead: false
      });
      setReplyContent('');
      setReplyingToId(null);
      toast.success('আপনার উত্তর পাঠানো হয়েছে।');
    } catch (error) {
      console.error(error);
      toast.error('দুঃখিত, উত্তর পাঠাতে সমস্যা হয়েছে।');
    } finally {
      setSendingReply(false);
    }
  };

  return (
    <div className="max-w-4xl mx-auto space-y-8 pb-20">
      <div className="bg-white p-8 rounded-3xl shadow-sm border border-slate-100 flex flex-col md:flex-row md:items-center justify-between gap-6 overflow-hidden relative">
          <div className="absolute right-0 top-0 w-32 h-32 bg-indigo-50 rounded-full translate-x-10 -translate-y-10" />
          <div className="relative z-10">
            <h2 className="text-3xl font-black text-slate-900 tracking-tighter font-bengali">আমার মেসেজ</h2>
            <p className="text-slate-500 font-medium mt-1 font-bengali">লাইব্রেরি এডমিনদের সাথে যোগাযোগ করুন এবং নোটিফিকেশন দেখুন।</p>
          </div>
          <div className="relative z-10 flex items-center gap-3 bg-slate-900 text-white px-6 py-3 rounded-2xl shadow-xl font-bengali">
             <Mail className="w-5 h-5 text-indigo-400" />
             <span className="font-bold">{messages.filter(m => !m.isRead && m.toUserId === user?.id).length === 0 ? 'সব পড়া হয়েছে' : `${messages.filter(m => !m.isRead && m.toUserId === user?.id).length} নতুন মেসেজ`}</span>
          </div>
      </div>

      <div className="bg-white rounded-3xl border border-slate-100 overflow-hidden">
        {loading ? (
             <div className="p-20 text-center">
                 <div className="animate-spin w-10 h-10 border-4 border-indigo-600 border-t-transparent rounded-full mx-auto" />
             </div>
        ) : messages.length === 0 ? (
            <div className="p-20 text-center space-y-4">
                <MessageSquare className="w-16 h-16 text-slate-100 mx-auto" />
                <p className="text-slate-400 font-bold tracking-widest text-sm font-bengali">আপনার ইনবক্স ফাঁকা</p>
            </div>
        ) : (
            <div className="divide-y divide-slate-50">
                {messages.sort((a,b) => new Date(b.date).getTime() - new Date(a.date).getTime()).map((msg, idx) => {
                    const isFromMe = msg.fromUserId === user?.id;
                    const isExpanded = expandedId === msg.id;
                    
                    return (
                        <div key={msg.id} className={`transition-colors ${!msg.isRead && !isFromMe ? 'bg-indigo-50/30' : 'hover:bg-slate-50'}`}>
                            <button 
                                onClick={() => toggleExpand(msg.id, msg)}
                                className="w-full p-6 text-left flex items-start gap-4 focus:outline-none"
                            >
                                <div className={`shrink-0 w-12 h-12 rounded-2xl flex items-center justify-center shadow-sm ${isFromMe ? 'bg-slate-100 text-slate-400' : 'bg-white text-indigo-600 border border-slate-100'}`}>
                                   {isFromMe ? <Reply className="w-5 h-5" /> : <Mail className="w-5 h-5" />}
                                </div>
                                <div className="flex-1 min-w-0">
                                    <div className="flex justify-between items-start gap-4">
                                        <div className="min-w-0">
                                            <h4 className={`text-lg transition-all font-bengali ${!msg.isRead && !isFromMe ? 'font-bold text-slate-900 border-l-4 border-indigo-600 pl-3 -ml-3' : 'font-bold text-slate-700'}`}>
                                                {msg.subject}
                                            </h4>
                                            <p className="text-[10px] font-bold text-slate-400 mt-1 flex items-center gap-1.5 font-bengali uppercase">
                                                {isFromMe ? (
                                                    <>প্রাপক: <span className="text-indigo-500">{msg.toUserName}</span></>
                                                ) : (
                                                    <>প্রেরক: <span className="text-indigo-500">{msg.fromUserName}</span></>
                                                )}
                                                <span className="w-1 h-1 rounded-full bg-slate-200 mx-1" />
                                                <Clock className="w-3 h-3" />
                                                {new Date(msg.date).toLocaleDateString()}
                                            </p>
                                        </div>
                                        {isExpanded ? <ChevronUp className="w-5 h-5 text-slate-300" /> : <ChevronDown className="w-5 h-5 text-slate-300" />}
                                    </div>
                                    <AnimatePresence>
                                        {isExpanded && (
                                            <motion.div 
                                                initial={{ height: 0, opacity: 0 }}
                                                animate={{ height: 'auto', opacity: 1 }}
                                                exit={{ height: 0, opacity: 0 }}
                                                className="overflow-hidden"
                                            >
                                                <div className="mt-6 p-6 bg-slate-50 rounded-2xl border border-slate-100 text-slate-600 font-medium leading-relaxed whitespace-pre-wrap">
                                                    {msg.content}
                                                </div>
                                                {!isFromMe && (
                                                    <div className="mt-4">
                                                        {replyingToId === msg.id ? (
                                                            <div className="bg-white p-4 rounded-2xl border border-indigo-100 mt-4" onClick={e => e.stopPropagation()}>
                                                                <form onSubmit={(e) => handleReplySubmit(e, msg)}>
                                                                    <textarea
                                                                        autoFocus
                                                                        value={replyContent}
                                                                        onChange={e => setReplyContent(e.target.value)}
                                                                        className="w-full border border-slate-200 p-3 rounded-xl focus:ring-2 focus:ring-indigo-500 shadow-sm outline-none resize-none font-bengali text-sm"
                                                                        rows={3}
                                                                        placeholder="আপনার উত্তর লিখুন..."
                                                                        required
                                                                    />
                                                                    <div className="flex justify-end gap-2 mt-3">
                                                                        <button 
                                                                            type="button" 
                                                                            onClick={() => { setReplyingToId(null); setReplyContent(''); }} 
                                                                            className="px-4 py-2 text-xs font-bold text-slate-500 hover:bg-slate-100 rounded-lg transition font-bengali"
                                                                        >
                                                                            বাতিল
                                                                        </button>
                                                                        <button 
                                                                            type="submit" 
                                                                            disabled={sendingReply}
                                                                            className="px-4 py-2 bg-indigo-600 text-white rounded-lg text-xs font-bold shadow hover:bg-indigo-700 transition disabled:opacity-50 font-bengali"
                                                                        >
                                                                            {sendingReply ? 'পাঠানো হচ্ছে...' : 'পাঠান'}
                                                                        </button>
                                                                    </div>
                                                                </form>
                                                            </div>
                                                        ) : (
                                                            <div className="flex justify-end">
                                                                <button 
                                                                  onClick={(e) => {
                                                                      e.stopPropagation();
                                                                      setReplyingToId(msg.id);
                                                                      setReplyContent('');
                                                                  }}
                                                                  className="flex items-center gap-2 text-xs font-bold text-indigo-600 hover:bg-indigo-50 px-4 py-2 rounded-xl transition font-bengali"
                                                                >
                                                                    <Reply className="w-4 h-4" /> উত্তর দিন
                                                                </button>
                                                            </div>
                                                        )}
                                                    </div>
                                                )}
                                            </motion.div>
                                        )}
                                    </AnimatePresence>
                                    {!isExpanded && (
                                        <p className="text-slate-500 text-sm mt-3 line-clamp-1 italic font-medium">{msg.content}</p>
                                    )}
                                </div>
                            </button>
                        </div>
                    );
                })}
            </div>
        )}
      </div>
      
      <div className="bg-indigo-900 rounded-3xl p-10 text-white flex flex-col md:flex-row items-center justify-between gap-8 shadow-2xl relative overflow-hidden group">
          <div className="absolute top-0 left-0 w-64 h-64 bg-indigo-800 rounded-full -translate-x-1/2 -translate-y-1/2 group-hover:scale-110 transition-transform duration-700" />
          <div className="relative z-10">
              <h3 className="text-2xl font-black tracking-tighter mb-2 font-bengali">সাপোর্ট প্রয়োজন?</h3>
              <p className="text-indigo-200 font-medium max-w-sm font-bengali">আপনি যদি কোনো মেসেজের উত্তর না পান অথবা ইমার্জেন্সি কিছু বলতে চান, সরাসরি চিফ লাইব্রেরিয়ানের সাথে যোগাযোগ করুন।</p>
          </div>
          <a href="tel:01570206953" className="relative z-10 whitespace-nowrap bg-white text-indigo-900 px-8 py-4 rounded-2xl font-black tracking-widest hover:scale-105 transition shadow-lg font-bengali">
              কল করুন
          </a>
      </div>
    </div>
  );
}
