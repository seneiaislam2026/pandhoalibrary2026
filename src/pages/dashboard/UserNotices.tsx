import React, { useEffect, useState } from 'react';
import { Bell, AlertCircle, Info, Calendar } from 'lucide-react';
import { motion } from 'motion/react';
import { onSnapshot, collection, query, orderBy } from 'firebase/firestore';
import { db } from '../../lib/firebase';

import { useAuth } from '../../store/AuthContext';

interface Notice {
  id: string;
  title: string;
  content: string;
  priority: 'low' | 'medium' | 'high';
  date: string;
}

export default function UserNotices() {
  const [notices, setNotices] = useState<Notice[]>([]);
  const [loading, setLoading] = useState(true);
  const { user } = useAuth();

  useEffect(() => {
    const fetchNotices = async () => {
      try {
        const cached = sessionStorage.getItem('notices_cache');
        const cacheTime = sessionStorage.getItem('notices_cache_time');
        
        if (cached && cacheTime && (Date.now() - parseInt(cacheTime) < 5 * 60 * 1000)) {
          setNotices(JSON.parse(cached));
          setLoading(false);
          updateLastSeen();
          return;
        }

        const { getDocs } = await import('firebase/firestore');
        const q = query(collection(db, "notices"), orderBy("date", "desc"));
        const snapshot = await getDocs(q);
        
        const noticesData = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })) as Notice[];
        setNotices(noticesData);
        sessionStorage.setItem('notices_cache', JSON.stringify(noticesData));
        sessionStorage.setItem('notices_cache_time', Date.now().toString());
        setLoading(false);
        updateLastSeen();
      } catch (err) {
        console.error(err);
        setLoading(false);
      }
    };
    
    const updateLastSeen = () => {
      if (user?.id) {
          localStorage.setItem(`last_seen_notices_${user.id}`, new Date().toISOString());
          window.dispatchEvent(new Event('notices_seen')); // To update the layout notification badge
      }
    };

    fetchNotices();
  }, [user]);

  return (
    <div className="max-w-4xl mx-auto space-y-8 pb-20">
      <div className="bg-white p-8 rounded-3xl shadow-sm border border-slate-100 flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h2 className="text-3xl font-black text-slate-900 tracking-tighter font-bengali">নোটিশ বোর্ড</h2>
          <p className="text-slate-500 font-medium mt-1 font-bengali">লাইব্রেরির সর্বশেষ নোটিশগুলো দেখে নিন।</p>
        </div>
        <div className="flex items-center text-slate-500 text-xs font-bold font-bengali">
            মোট {notices.length} টি নোটিশ
        </div>
      </div>

      <div className="space-y-4">
        {loading ? (
          <div className="p-20 text-center">
            <div className="animate-spin w-10 h-10 border-4 border-indigo-600 border-t-transparent rounded-full mx-auto mb-4"></div>
            <p className="text-slate-400 font-bold tracking-widest text-[12px] font-bengali">লোডিং হচ্ছে...</p>
          </div>
        ) : notices.length === 0 ? (
          <div className="bg-white p-16 rounded-3xl border border-dashed border-slate-200 text-center">
            <Bell className="w-12 h-12 text-slate-200 mx-auto mb-4" />
            <p className="text-slate-400 font-semibold italic text-lg font-bengali">এই মুহূর্তে কোনো নোটিশ নেই</p>
          </div>
        ) : (
          notices.map((notice, idx) => (
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: idx * 0.1 }}
              key={notice.id}
              className="bg-white p-6 rounded-3xl shadow-sm border border-slate-100 hover:shadow-md transition group overflow-hidden relative"
            >
              <div className={`absolute left-0 top-0 bottom-0 w-1.5 ${
                 notice.priority === 'high' ? 'bg-rose-500' : 
                 notice.priority === 'medium' ? 'bg-amber-500' : 'bg-emerald-500'
              }`} />
              
              <div className="flex items-start gap-5">
                 <div className={`shrink-0 w-12 h-12 rounded-2xl flex items-center justify-center ${
                   notice.priority === 'high' ? 'bg-rose-50 text-rose-600' : 
                   notice.priority === 'medium' ? 'bg-amber-50 text-amber-600' : 'bg-emerald-50 text-emerald-600'
                 }`}>
                   {notice.priority === 'high' ? <AlertCircle className="w-6 h-6" /> : <Info className="w-6 h-6" />}
                 </div>
                 
                 <div className="flex-1 min-w-0">
                    <div className="flex flex-col md:flex-row md:items-center justify-between gap-1 mb-3">
                       <h3 className="text-xl font-bold text-slate-900 truncate tracking-tight">{notice.title}</h3>
                       <div className="flex items-center gap-2 text-[10px] font-black uppercase text-slate-400 bg-slate-50 px-2 py-1 rounded-lg self-start">
                          <Calendar className="w-3 h-3" />
                          {new Date(notice.date).toLocaleDateString(undefined, { dateStyle: 'medium' })}
                       </div>
                    </div>
                    <p className="text-slate-600 leading-relaxed text-sm md:text-base font-medium whitespace-pre-wrap">
                       {notice.content}
                    </p>
                 </div>
              </div>
            </motion.div>
          ))
        )}
      </div>
    </div>
  );
}
