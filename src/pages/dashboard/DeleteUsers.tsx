import React, { useEffect, useState } from 'react';
import { useAuth } from '../../store/AuthContext';
import { Search, UserX, Trash2 } from 'lucide-react';
import { motion } from 'motion/react';
import { onSnapshot, collection, deleteDoc, doc } from 'firebase/firestore';
import { db } from '../../lib/firebase';
import toast from 'react-hot-toast';

interface LibUser {
  id: string;
  name: string;
  username: string;
  role: string;
  status: string;
  memberId?: string;
  phone?: string;
}

export default function DeleteUsers() {
  const [users, setUsers] = useState<LibUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const { user: currentUser } = useAuth();

  useEffect(() => {
    const fetchData = async () => {
      try {
        const { getDocs, collection } = await import('firebase/firestore');
        const db = (await import('../../lib/firebase')).db;

        const cacheKey = 'admin_users_cache';
        const cacheTime = sessionStorage.getItem('admin_users_time');

        if (cacheTime && (Date.now() - parseInt(cacheTime) < 5 * 60 * 1000)) {
           const cached = sessionStorage.getItem(cacheKey);
           if (cached) {
              setUsers(JSON.parse(cached));
              setLoading(false);
              return;
           }
        }

        const snapshot = await getDocs(collection(db, "users"));
        const usersData = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })) as LibUser[];
        setUsers(usersData);
        setLoading(false);

        try {
          sessionStorage.setItem(cacheKey, JSON.stringify(usersData));
          sessionStorage.setItem('admin_users_time', Date.now().toString());
        } catch (e) {
          console.warn('Quota exceeded for sessionStorage', e);
        }
      } catch (err) {
        console.error("Error fetching users:", err);
        setLoading(false);
      }
    };

    fetchData();
  }, []);

  const handleDelete = async (id: string, name: string) => {
    if (id === currentUser?.id) {
        toast.error('আপনি আপনার নিজের অ্যাকাউন্ট মুছতে পারবেন না।');
        return;
    }

    if (!window.confirm(`আপনি কি নিশ্চিত যে আপনি ${name}-কে মুছে ফেলতে চান?`)) return;

    try {
        await deleteDoc(doc(db, "users", id));
    } catch (error) {
        console.error('Error deleting user:', error);
        toast.error('সদস্য মুছতে ব্যর্থ হয়েছে।');
    }
  };

  const filtered = users.filter(u => 
    u.name.toLowerCase().includes(search.toLowerCase()) || 
    (u.memberId && u.memberId.toString().includes(search)) ||
    u.username.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="max-w-4xl mx-auto space-y-6 pb-20">
      <div className="bg-gradient-to-br from-rose-50 to-red-50 dark:from-rose-900/20 dark:to-red-900/20 border border-rose-200 dark:border-rose-800/30 p-8 rounded-[24px] relative overflow-hidden shadow-sm">
        <div className="absolute -right-10 -top-10 text-rose-500/10 dark:text-rose-400/10 rotate-12">
           <Trash2 className="w-48 h-48" />
        </div>
        <div className="relative z-10">
          <h2 className="text-3xl font-black tracking-tight mb-3 flex items-center gap-3 text-rose-950 dark:text-rose-100 font-bengali">
            <span className="bg-rose-100 dark:bg-rose-900/50 text-rose-600 dark:text-rose-400 p-2 rounded-2xl">
              <UserX className="w-8 h-8" />
            </span>
            সদস্য মুছুন
          </h2>
          <p className="text-rose-700/80 dark:text-rose-300/80 font-bold max-w-lg font-bengali leading-relaxed text-lg">
            সতর্কতা: এই পেজ থেকে আপনি লাইব্রেরি সিস্টেম থেকে সদস্যদের স্থায়ীভাবে মুছে ফেলতে পারবেন। সতর্কতার সাথে কাজ করুন।
          </p>
        </div>
      </div>

      <div className="relative">
        <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
        <input 
          type="text" 
          placeholder="নাম, আইডি, বা ইউজারনেম লিখে সদস্য খুঁজুন..." 
          value={search}
          onChange={e => setSearch(e.target.value)}
          className="w-full bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-[20px] pl-12 pr-4 py-4 focus:outline-none focus:ring-2 focus:ring-rose-500/50 dark:focus:ring-rose-400/50 shadow-sm font-bold font-bengali text-slate-900 dark:text-slate-100 transition-shadow"
        />
      </div>

      <div className="space-y-4">
        {loading ? (
            <div className="p-16 text-center text-slate-400 font-bengali font-bold text-lg animate-pulse bg-white dark:bg-slate-800 rounded-[24px] shadow-sm border border-slate-100 dark:border-slate-700">সদস্যদের তথ্য লোড হচ্ছে...</div>
        ) : filtered.length === 0 ? (
            <div className="p-16 text-center bg-white dark:bg-slate-800 rounded-[24px] shadow-sm border border-dashed border-slate-200 dark:border-slate-700 text-slate-400 font-bold font-bengali text-lg flex flex-col items-center gap-4">
                <UserX className="w-12 h-12 text-slate-300 dark:text-slate-600" />
                কোনো সদস্য পাওয়া যায়নি।
            </div>
        ) : (
            filtered.map((u, idx) => (
                <motion.div 
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: idx * 0.05 }}
                    key={u.id} 
                    className="bg-white dark:bg-slate-800 p-6 rounded-[24px] shadow-sm border border-slate-100 dark:border-slate-700 flex flex-col sm:flex-row sm:items-center justify-between gap-6 transition-all hover:shadow-md"
                >
                    <div className="flex-1">
                        <div className="flex flex-wrap items-center gap-3 mb-2">
                            <h3 className="font-bold text-slate-900 dark:text-slate-100 text-xl font-bengali">{u.name}</h3>
                            <span className="text-[11px] bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300 px-2.5 py-1 rounded-md font-bold uppercase tracking-widest border border-slate-200 dark:border-slate-600">
                                @{u.username}
                            </span>
                            {u.memberId && (
                                <span className="text-[11px] bg-indigo-50 dark:bg-indigo-900/30 text-indigo-700 dark:text-indigo-300 px-2.5 py-1 rounded-md font-bold uppercase tracking-widest border border-indigo-100 dark:border-indigo-800/50 font-mono">
                                    ID: {u.memberId}
                                </span>
                            )}
                        </div>
                        <div className="flex flex-wrap items-center gap-3 mt-1">
                            <span className={`text-[11px] font-black uppercase tracking-widest px-2.5 py-1 rounded-md border ${
                                u.status === 'active' 
                                  ? 'bg-emerald-50 dark:bg-emerald-900/20 text-emerald-700 dark:text-emerald-400 border-emerald-200 dark:border-emerald-800/30' 
                                  : 'bg-amber-50 dark:bg-amber-900/20 text-amber-700 dark:text-amber-400 border-amber-200 dark:border-amber-800/30'
                            }`}>
                                {u.status}
                            </span>
                            <span className="text-[13px] font-bold text-slate-500 dark:text-slate-400 capitalize bg-slate-50 dark:bg-slate-900/50 px-3 py-1 rounded-lg border border-slate-100 dark:border-slate-800">{u.role}</span>
                            {u.phone && <span className="text-[13px] font-bold text-slate-500 dark:text-slate-400 flex items-center gap-1.5 font-mono bg-slate-50 dark:bg-slate-900/50 px-3 py-1 rounded-lg border border-slate-100 dark:border-slate-800">
                              <span className="text-slate-400">📞</span> {u.phone}
                            </span>}
                        </div>
                    </div>
                    
                    <button
                        onClick={() => handleDelete(u.id, u.name)}
                        className="w-full sm:w-auto bg-rose-50 dark:bg-rose-500/10 text-rose-600 dark:text-rose-400 hover:bg-rose-500 hover:text-white dark:hover:bg-rose-500 px-6 py-3 rounded-xl font-bold font-bengali text-sm transition-all focus:ring-4 focus:ring-rose-500/20 flex items-center justify-center gap-2 border border-rose-200 dark:border-rose-500/20"
                    >
                        <Trash2 className="w-5 h-5" />
                        মুছে ফেলুন
                    </button>
                </motion.div>
            ))
        )}
      </div>
    </div>
  );
}
