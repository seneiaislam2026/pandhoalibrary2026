import React, { useEffect, useState } from 'react';
import { useAuth } from '../../store/AuthContext';
import { Send, User, MessageSquare, Clock, Trash2, Mail, X, Reply } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import Select from 'react-select';
import { onSnapshot, collection, doc, setDoc, deleteDoc, query, orderBy, serverTimestamp, where, addDoc, updateDoc } from 'firebase/firestore';
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

interface LibUser {
    id: string;
    name: string;
    username: string;
    role: string;
}

export default function ManageMessages() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [users, setUsers] = useState<LibUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCompose, setShowCompose] = useState(false);
  const [formData, setFormData] = useState({ toUserId: '', subject: '', content: '' });
  const [replyingToId, setReplyingToId] = useState<string | null>(null);
  const [replyContent, setReplyContent] = useState('');
  const [sendingReply, setSendingReply] = useState(false);
  const { user: activeUser } = useAuth();
  const [filter, setFilter] = useState<'sent' | 'all'>('all');

  useEffect(() => {
    const fetchData = async () => {
      try {
        const { getDocs, query, collection, doc, updateDoc } = await import('firebase/firestore');
        const db = (await import('../../lib/firebase')).db;

        const cacheKeyMsgs = 'admin_msgs_cache';
        const cacheKeyUsers = 'admin_users_brief_cache';
        const cacheTime = sessionStorage.getItem('admin_msgs_time');

        if (cacheTime && (Date.now() - parseInt(cacheTime) < 2 * 60 * 1000)) {
           const cachedMsgs = sessionStorage.getItem(cacheKeyMsgs);
           const cachedUsers = sessionStorage.getItem(cacheKeyUsers);
           if (cachedMsgs && cachedUsers) {
              setMessages(JSON.parse(cachedMsgs));
              setUsers(JSON.parse(cachedUsers));
              setLoading(false);
              return;
           }
        }

        const [msgSnap, userSnap] = await Promise.all([
           getDocs(collection(db, "messages")),
           getDocs(collection(db, "users"))
        ]);

        const fetchedMsgs = msgSnap.docs.map(doc => ({ id: doc.id, ...doc.data() })) as Message[];
        const fetchedUsers = userSnap.docs.map(doc => ({ id: doc.id, name: doc.data().name, username: doc.data().username, role: doc.data().role })) as LibUser[];
        
        setMessages(fetchedMsgs);
        setUsers(fetchedUsers);
        setLoading(false);

        sessionStorage.setItem(cacheKeyMsgs, JSON.stringify(fetchedMsgs));
        sessionStorage.setItem(cacheKeyUsers, JSON.stringify(fetchedUsers));
        sessionStorage.setItem('admin_msgs_time', Date.now().toString());

        if (activeUser?.id && activeUser?.role === 'admin') {
           fetchedMsgs.forEach(m => {
              if (!m.isRead && m.toUserId === activeUser.id) {
                 updateDoc(doc(db, "messages", m.id), { isRead: true }).catch(err => console.error(err));
              }
           });
        }
      } catch (err) {
        console.error("Error fetching messages:", err);
        setLoading(false);
      }
    };

    fetchData();
  }, [activeUser]);

  const handleSend = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.toUserId) return toast.error("Please select a recipient");
    
    try {
      const toUser = users.find(u => u.id === formData.toUserId);
      const newDocRef = doc(collection(db, "messages"));
      await setDoc(newDocRef, {
        ...formData,
        id: newDocRef.id,
        fromUserId: activeUser?.id,
        fromUserName: activeUser?.name,
        toUserName: formData.toUserId === 'all' ? 'All Members' : (toUser?.name || 'Unknown'),
        date: new Date().toISOString(),
        isRead: false,
        createdAt: serverTimestamp()
      });
      setShowCompose(false);
      setFormData({ toUserId: '', subject: '', content: '' });
      toast.success('Message sent successfully!');
    } catch (err) {
      console.error("Error sending message:", err);
      toast.error("Failed to send message");
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Delete this message?")) return;
    try {
      await deleteDoc(doc(db, "messages", id));
    } catch (err) {
      console.error("Error deleting message:", err);
      toast.error("Failed to delete message");
    }
  };

  const handleReplySubmit = async (e: React.FormEvent, msg: Message) => {
    e.preventDefault();
    if (!replyContent.trim() || !activeUser || sendingReply) return;
    setSendingReply(true);
    
    try {
      await addDoc(collection(db, "messages"), {
        toUserId: msg.fromUserId,
        toUserName: msg.fromUserName,
        fromUserId: activeUser.id,
        fromUserName: activeUser.name,
        subject: `Re: ${msg.subject.replace(/^Re:\s*/i, '')}`,
        content: replyContent,
        date: new Date().toISOString(),
        isRead: false
      });
      setReplyContent('');
      setReplyingToId(null);
      toast.success('Reply sent successfully!');
    } catch (error) {
      console.error(error);
      toast.error('Failed to send reply');
    } finally {
      setSendingReply(false);
    }
  };

  const filteredMessages = messages.filter(m => {
      if (filter === 'sent') return String(m.fromUserId) === String(activeUser?.id);
      return true;
  });

  return (
    <div className="space-y-6 pb-20">
      <div className="flex justify-between items-center bg-white p-6 rounded-2xl shadow-sm border border-slate-100 mb-6">
        <div>
          <h2 className="text-2xl font-bold font-bengali text-slate-800 tracking-tight">লাইব্রেরি মেসেঞ্জার</h2>
          <p className="text-slate-500 text-sm font-bengali">সদস্যদের ব্যক্তিগত মেসেজ এবং নোটিফিকেশন পাঠান।</p>
        </div>
        <button 
          onClick={() => setShowCompose(true)}
          className="flex items-center gap-2 bg-indigo-600 text-white px-5 py-2.5 rounded-xl font-bold font-bengali hover:bg-indigo-700 transition shadow-lg shadow-indigo-100"
        >
          <Send className="w-4 h-4" />
          নতুন মেসেজ
        </button>
      </div>

      <div className="flex gap-2 mb-4">
          <button 
            onClick={() => setFilter('all')}
            className={`px-4 py-2 rounded-lg text-xs font-bold font-bengali transition ${filter === 'all' ? 'bg-indigo-600 text-white shadow-md' : 'bg-white text-slate-500 border border-slate-100'}`}
          >
            সকল মেসেজ
          </button>
          <button 
            onClick={() => setFilter('sent')}
            className={`px-4 py-2 rounded-lg text-xs font-bold font-bengali transition ${filter === 'sent' ? 'bg-indigo-600 text-white shadow-md' : 'bg-white text-slate-500 border border-slate-100'}`}
          >
            আমার পাঠানো
          </button>
      </div>

      <div className="grid gap-4">
        {loading ? (
             <div className="p-20 text-center text-slate-300 font-bengali">লোড হচ্ছে...</div>
        ) : filteredMessages.length === 0 ? (
            <div className="bg-white p-20 rounded-2xl border border-dashed border-slate-200 text-center">
                <Mail className="w-12 h-12 text-slate-200 mx-auto mb-4" />
                <p className="text-slate-400 font-bold uppercase tracking-widest text-[11px] font-bengali">কোনো মেসেজ পাওয়া যায়নি</p>
            </div>
        ) : (
            filteredMessages.sort((a,b) => new Date(b.date).getTime() - new Date(a.date).getTime()).map(msg => (
                <motion.div 
                    layout
                    key={msg.id}
                    className="bg-white p-6 rounded-2xl border border-slate-100 shadow-sm hover:shadow-md transition relative group overflow-hidden"
                >
                    <div className="flex items-start gap-4">
                        <div className={`p-3 rounded-xl ${msg.fromUserId === activeUser?.id ? 'bg-emerald-50 text-emerald-600' : 'bg-indigo-50 text-indigo-600'}`}>
                            <MessageSquare className="w-5 h-5" />
                        </div>
                        <div className="flex-1 min-w-0">
                            <div className="flex justify-between items-start gap-2 mb-2">
                                <div>
                                    <h4 className="font-bold text-slate-900 group-hover:text-indigo-600 transition-colors font-bengali">{msg.subject}</h4>
                                    <div className="flex items-center gap-2 mt-1">
                                        <p className="text-[10px] font-black uppercase text-slate-400 flex items-center gap-1 font-bengali">
                                            <User className="w-3 h-3" />
                                            প্রেরক: {msg.fromUserName}
                                        </p>
                                        <p className="text-[10px] font-black uppercase text-indigo-400 flex items-center gap-1 font-bengali">
                                            <ArrowRight className="w-3 h-3" />
                                            প্রাপক: {msg.toUserName}
                                        </p>
                                    </div>
                                </div>
                                <div className="text-right">
                                    <div className="flex items-center gap-1.5 text-slate-300">
                                        <Clock className="w-3.5 h-3.5" />
                                        <p className="text-[10px] font-bold uppercase font-mono">{new Date(msg.date).toLocaleDateString()}</p>
                                    </div>
                                    {!msg.isRead && msg.toUserId === activeUser?.id && (
                                        <span className="inline-block px-1.5 py-0.5 bg-rose-500 text-white text-[9px] font-black rounded mt-1 uppercase tracking-tighter font-bengali">নতুন</span>
                                    )}
                                </div>
                            </div>
                            <p className="text-slate-600 leading-relaxed text-sm whitespace-pre-wrap mb-4 font-bengali">{msg.content}</p>
                            
                            {activeUser?.role === 'admin' && (
                                <div className="pt-4 border-t border-slate-50 flex justify-between items-center">
                                    {msg.fromUserId !== activeUser?.id ? (
                                        <div className="flex-1">
                                            {replyingToId === msg.id ? (
                                                <form onSubmit={(e) => handleReplySubmit(e, msg)} className="flex items-start gap-2 max-w-lg">
                                                    <textarea 
                                                        value={replyContent}
                                                        onChange={e => setReplyContent(e.target.value)}
                                                        className="flex-1 border border-slate-200 rounded-xl p-2 text-sm focus:ring-2 focus:ring-indigo-500 outline-none resize-none font-bengali"
                                                        rows={2}
                                                        placeholder={`রিপ্লাই করুন ${msg.fromUserName}...`}
                                                        autoFocus
                                                        required
                                                    />
                                                    <div className="flex flex-col gap-1">
                                                        <button 
                                                            type="submit" 
                                                            disabled={sendingReply}
                                                            className="bg-indigo-600 text-white p-2 rounded-lg hover:bg-indigo-700 transition disabled:opacity-50"
                                                        >
                                                            <Send className="w-4 h-4" />
                                                        </button>
                                                        <button 
                                                            type="button" 
                                                            onClick={() => setReplyingToId(null)}
                                                            className="bg-slate-100 text-slate-500 p-2 rounded-lg hover:bg-slate-200 transition"
                                                        >
                                                            <X className="w-4 h-4" />
                                                        </button>
                                                    </div>
                                                </form>
                                            ) : (
                                                <button 
                                                    onClick={() => setReplyingToId(msg.id)}
                                                    className="flex items-center gap-1.5 text-xs font-bold text-indigo-600 hover:text-indigo-800 transition font-bengali"
                                                >
                                                    <Reply className="w-4 h-4" /> রিপ্লাই
                                                </button>
                                            )}
                                        </div>
                                    ) : <div className="flex-1" />}
                                    <button 
                                        onClick={() => handleDelete(msg.id)}
                                        className="p-1.5 text-slate-300 hover:text-rose-500 transition-colors shrink-0"
                                    >
                                        <Trash2 className="w-4 h-4" />
                                    </button>
                                </div>
                            )}
                        </div>
                    </div>
                </motion.div>
            ))
        )}
      </div>

      <AnimatePresence>
        {showCompose && (
          <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4">
            <motion.div 
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="bg-white rounded-3xl w-full max-w-lg overflow-hidden shadow-2xl border border-slate-100"
            >
              <div className="bg-slate-900 p-6 text-white flex justify-between items-center">
                <h3 className="text-xl font-bold flex items-center gap-2 font-bengali">
                  <Send className="w-5 h-5 text-indigo-400" />
                  নতুন ম্যাসেজ লিখুন
                </h3>
                <button onClick={() => setShowCompose(false)} className="p-2 hover:bg-white/10 rounded-xl transition">
                  <X className="w-6 h-6" />
                </button>
              </div>
              <form onSubmit={handleSend} className="p-8 space-y-6">
                <div>
                  <label className="block text-sm font-black text-slate-400 uppercase tracking-widest mb-2 font-bengali">সদস্য নির্বাচন করুন</label>
                  <Select
                    options={[
                      { value: "all", label: "📢 সকল সদস্য", color: "#4f46e5", fontWeight: "bold" },
                      ...users.map(u => ({ value: u.id, label: `${u.name} (@${u.username})` }))
                    ]}
                    onChange={(option: any) => setFormData({ ...formData, toUserId: option?.value || '' })}
                    placeholder="একজন সদস্য নির্বাচন করুন..."
                    classNamePrefix="react-select"
                    styles={{
                      control: (base: any, state: any) => ({
                        ...base,
                        border: state.isFocused ? '2px solid #6366f1' : '2px solid #e2e8f0',
                        borderRadius: '0.75rem',
                        padding: '0.25rem',
                        boxShadow: 'none',
                        fontSize: '0.875rem',
                        fontWeight: '500',
                        color: '#334155',
                        backgroundColor: '#f8fafc',
                        fontFamily: 'inherit',
                        '&:hover': {
                          border: state.isFocused ? '2px solid #6366f1' : '2px solid #cbd5e1'
                        }
                      }),
                      option: (base: any, state: any) => ({
                        ...base,
                        backgroundColor: state.isSelected ? '#4f46e5' : state.isFocused ? '#e0e7ff' : 'transparent',
                        color: state.isSelected ? 'white' : state.data.color || '#334155',
                        cursor: 'pointer',
                        fontSize: '0.875rem',
                        fontWeight: state.isSelected ? '700' : state.data.fontWeight || '500',
                        padding: '0.75rem 1rem',
                        fontFamily: 'inherit',
                        '&:active': {
                          backgroundColor: '#4338ca'
                        }
                      }),
                      placeholder: (base: any) => ({
                        ...base,
                        color: '#94a3b8',
                        fontFamily: 'inherit'
                      }),
                      menu: (base: any) => ({
                        ...base,
                        borderRadius: '0.75rem',
                        border: '1px solid #e2e8f0',
                        boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1), 0 4px 6px -4px rgb(0 0 0 / 0.1)',
                        overflow: 'hidden',
                        zIndex: 50,
                        fontFamily: 'inherit'
                      })
                    }}
                    className="text-sm font-medium focus:outline-none font-bengali"
                  />
                </div>
                <div>
                  <label className="block text-sm font-black text-slate-400 uppercase tracking-widest mb-2 font-bengali">বিষয়</label>
                  <input
                    required
                    type="text"
                    value={formData.subject}
                    onChange={e => setFormData({ ...formData, subject: e.target.value })}
                    className="w-full bg-slate-50 border border-slate-100 rounded-xl px-4 py-3 focus:ring-2 focus:ring-indigo-500 transition font-medium font-bengali"
                    placeholder="যেমন: বই ফেরতের রিমাইন্ডার"
                  />
                </div>
                <div>
                  <label className="block text-sm font-black text-slate-400 uppercase tracking-widest mb-2 font-bengali">ম্যাসেজ</label>
                  <textarea
                    required
                    value={formData.content}
                    onChange={e => setFormData({ ...formData, content: e.target.value })}
                    className="w-full bg-slate-50 border border-slate-100 rounded-xl px-4 py-3 focus:ring-2 focus:ring-indigo-500 transition h-40 resize-none font-medium text-sm leading-relaxed font-bengali"
                    placeholder="আপনার ম্যাসেজটি এখানে লিখুন..."
                  />
                </div>
                <button 
                  type="submit" 
                  className="w-full bg-slate-900 text-white py-4 rounded-xl font-black uppercase tracking-widest hover:bg-slate-800 transition shadow-lg flex items-center justify-center gap-2 font-bengali"
                >
                  <Send className="w-4 h-4" /> ম্যাসেজ পাঠান
                </button>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}

function ArrowRight({ className }: { className?: string }) {
    return (
        <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}><path d="M5 12h14"></path><path d="m12 5 7 7-7 7"></path></svg>
    )
}
