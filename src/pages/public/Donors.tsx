import React, { useEffect, useState } from 'react';
import { motion } from 'motion/react';
import { Heart, TrendingUp, Users, Crown } from 'lucide-react';
import { onSnapshot, collection, doc, setDoc, query, orderBy, serverTimestamp } from 'firebase/firestore';
import { db } from '../../lib/firebase';
import toast from 'react-hot-toast';

interface Donation {
  id: string;
  name: string;
  amount: number;
  date: string;
}

interface DonorMember {
  id: string;
  name: string;
  phone: string;
  address?: string;
  createdAt: string;
  serial?: number | string;
}

export default function Donors() {
  const [donations, setDonations] = useState<Donation[]>([]);
  const [donorMembers, setDonorMembers] = useState<DonorMember[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [loading, setLoading] = useState(false);
  const [activeTab, setActiveTab] = useState<'honourable' | 'contributions'>('honourable');

  useEffect(() => {
    const fetchDonorsInfo = async () => {
      try {
        const cachedDonations = sessionStorage.getItem('pub_donations_cache');
        const cachedMembers = sessionStorage.getItem('pub_donormembers_cache');
        const cacheTime = sessionStorage.getItem('pub_donors_cache_time');
        
        if (cachedDonations && cachedMembers && cacheTime && (Date.now() - parseInt(cacheTime) < 5 * 60 * 1000)) {
          setDonations(JSON.parse(cachedDonations));
          setDonorMembers(JSON.parse(cachedMembers));
          return;
        }

        const { getDocs, query, orderBy, limit } = await import('firebase/firestore');
        const [donationsSnap, membersSnap] = await Promise.all([
          getDocs(query(collection(db, "donations"), orderBy("date", "desc"), limit(50))),
          getDocs(query(collection(db, "donor-members"), orderBy("createdAt", "asc")))
        ]);

        const donationsData = donationsSnap.docs.map(doc => ({ id: doc.id, ...doc.data() })) as Donation[];
        const membersDataRaw = membersSnap.docs.map(doc => ({ id: doc.id, ...doc.data() })) as DonorMember[];
        const membersData = membersDataRaw.sort((a, b) => {
          const serialA = a.serial ? parseInt(String(a.serial), 10) : Number.MAX_SAFE_INTEGER;
          const serialB = b.serial ? parseInt(String(b.serial), 10) : Number.MAX_SAFE_INTEGER;
          return serialA - serialB;
        });

        setDonations(donationsData);
        setDonorMembers(membersData);
        sessionStorage.setItem('pub_donations_cache', JSON.stringify(donationsData));
        sessionStorage.setItem('pub_donormembers_cache', JSON.stringify(membersData));
        sessionStorage.setItem('pub_donors_cache_time', Date.now().toString());
      } catch (error) {
        console.error("Error fetching donors data:", error);
      }
    };
    fetchDonorsInfo();
  }, []);

  const [showJoinForm, setShowJoinForm] = useState(false);
  const [joinForm, setJoinForm] = useState({ name: '', phone: '', address: '' });

  const handleJoinDonor = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      const newDocRef = doc(collection(db, "donor-members"));
      await setDoc(newDocRef, {
        ...joinForm,
        id: newDocRef.id,
        createdAt: serverTimestamp()
      });
      setJoinForm({ name: '', phone: '', address: '' });
      setShowJoinForm(false);
      setSuccessMsg(true);
      setTimeout(() => setSuccessMsg(false), 5000);
    } catch (err) {
      console.error(err);
      toast.error("সদস্য যুক্ত করতে ব্যর্থ হয়েছে।");
    } finally {
      setLoading(false);
    }
  };

  const totalDonated = donations.reduce((sum, d) => sum + Number(d.amount), 0);

  const predefinedAmounts = [50, 100, 500, 1000];
  const [formAmt, setFormAmt] = useState(500);
  const [formName, setFormName] = useState('');
  const [successMsg, setSuccessMsg] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      const newDocRef = doc(collection(db, "donations"));
      await setDoc(newDocRef, {
        name: formName || 'Anonymous',
        amount: formAmt,
        date: new Date().toISOString(),
        createdAt: serverTimestamp()
      });
      setSuccessMsg(true);
      setShowForm(false);
      setTimeout(() => setSuccessMsg(false), 5000);
    } catch (err) {
      console.error(err);
      toast.error("Failed to submit donation");
    } finally {
      setLoading(false);
    }
  };

  return (
    <motion.div 
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="bg-[#fafafa] dark:bg-slate-900 min-h-screen py-16 px-4 transition-colors"
    >
      <div className="max-w-4xl mx-auto space-y-12">
        
        {/* Header */}
        <div className="text-center">
          <div className="inline-flex w-20 h-20 bg-rose-50 dark:bg-rose-900/30 text-rose-500 dark:text-rose-400 rounded-full items-center justify-center mb-6 shadow-sm ring-4 ring-rose-50/50 dark:ring-rose-900/20">
             <Heart className="w-10 h-10" />
          </div>
          <h1 className="text-4xl md:text-6xl font-black tracking-tighter text-transparent bg-clip-text bg-gradient-to-r from-slate-900 via-indigo-900 to-slate-900 dark:from-white dark:via-indigo-200 dark:to-white mb-6 font-bengali drop-shadow-sm pb-2">
            "উদারতায় জ্ঞানের বিস্তার"
          </h1>
          <p className="text-slate-600 dark:text-slate-300 max-w-xl mx-auto text-lg md:text-xl leading-relaxed mb-10 font-bengali font-bold">
            আপনাদের ঐকান্তিক ভালোবাসা এবং সহযোগিতাতেই আমাদের এই উন্মুক্ত পাঠাগার এগিয়ে চলছে।
          </p>
          
          {/* Tabs */}
          <div className="flex bg-white dark:bg-slate-800 p-1.5 rounded-full mx-auto w-fit border border-slate-200 dark:border-slate-700 shadow-sm transition-colors">
             <button 
               onClick={() => setActiveTab('honourable')}
               className={`px-6 py-2.5 rounded-full font-bold text-sm flex items-center gap-2 transition-all font-bengali ${activeTab === 'honourable' ? 'bg-indigo-600 text-white shadow-md' : 'text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700'}`}
             >
               <Crown className="w-4 h-4" /> সম্মানিত দাতা সদস্যবৃন্দ
             </button>
             <button 
               onClick={() => setActiveTab('contributions')}
               className={`px-6 py-2.5 rounded-full font-bold text-sm flex items-center gap-2 transition-all font-bengali ${activeTab === 'contributions' ? 'bg-indigo-600 text-white shadow-md' : 'text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700'}`}
             >
               <Heart className="w-4 h-4" /> সাম্প্রতিক অনুদানসমূহ
             </button>
          </div>
        </div>

        {activeTab === 'honourable' ? (
           <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="bg-white dark:bg-slate-800 rounded-[24px] overflow-hidden shadow-sm border border-slate-200 dark:border-slate-700 transition-colors">
             <div className="p-8 border-b border-slate-100 dark:border-slate-700 bg-gradient-to-r from-amber-50 to-orange-50 dark:from-amber-900/20 dark:to-orange-900/20 transition-colors">
               <h2 className="text-2xl font-bold font-bengali text-slate-800 dark:text-slate-100 text-center flex items-center justify-center gap-3">
                 <Crown className="w-6 h-6 text-amber-500 dark:text-amber-400" />
                 সম্মানিত দাতা সদস্যবৃন্দ
               </h2>
               <p className="text-center text-slate-600 dark:text-slate-400 mt-2 font-bengali text-sm font-medium">
                 যে সকল মহৎ ব্যক্তিদের অনুদানে আমাদের কার্যক্রম পরিচালিত হচ্ছে, আমরা তাঁদের প্রতি গভীরভাবে কৃতজ্ঞ।
               </p>
             </div>
             <div className="p-2">
                 <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6 p-6">
                   {donorMembers.map(member => (
                     <div key={member.id} className="relative p-6 rounded-[2rem] border border-slate-100 dark:border-slate-700 bg-white dark:bg-slate-800 shadow-sm hover:shadow-xl hover:-translate-y-1 transition-all duration-300 group text-center flex flex-col items-center overflow-hidden">
                        <div className="absolute inset-0 bg-gradient-to-br from-amber-50/50 to-transparent dark:from-amber-900/10 dark:to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300"></div>
                        <div className="relative w-20 h-20 bg-gradient-to-br from-amber-100 to-amber-50 dark:from-amber-900/40 dark:to-amber-800/20 text-amber-600 dark:text-amber-400 rounded-full flex items-center justify-center mb-5 shadow-inner group-hover:scale-110 transition-transform duration-500">
                          <Users className="w-10 h-10 drop-shadow-sm" />
                          <div className="absolute -bottom-1 -right-1 bg-white dark:bg-slate-800 rounded-full p-1 shadow-sm">
                            <Crown className="w-4 h-4 text-amber-500" />
                          </div>
                        </div>
                        <h3 className="relative font-bold text-slate-900 dark:text-slate-100 text-xl mb-2">{member.name}</h3>
                        {member.address && <p className="relative text-sm text-slate-500 dark:text-slate-400 line-clamp-2 px-2">{member.address}</p>}
                     </div>
                   ))}
                   {donorMembers.length === 0 && (
                     <div className="col-span-full py-16 text-center text-slate-500 dark:text-slate-400 font-bengali font-bold">
                        এখনো কোনো দাতা সদস্য যুক্ত করা হয়নি।
                     </div>
                   )}
                 </div>
             </div>
           </motion.div>
        ) : (
          <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="space-y-12">
          <div className="flex flex-wrap justify-center gap-4 mb-8">
            <button 
              onClick={() => { setShowForm(!showForm); setShowJoinForm(false); }}
              className="bg-indigo-600 text-white px-8 py-3 rounded-full font-bold hover:bg-indigo-700 transition-colors shadow-lg shadow-indigo-900/20 font-bengali"
            >
              এককালীন অনুদান
            </button>
            <button 
              onClick={() => { setShowJoinForm(!showJoinForm); setShowForm(false); }}
              className="bg-slate-900 dark:bg-slate-800 text-white px-8 py-3 rounded-full font-bold hover:bg-slate-800 dark:hover:bg-slate-700 transition-colors shadow-lg border border-slate-700 font-bengali"
            >
              দাতা সদস্য হোন
            </button>
          </div>
          
          {/* Join Form */}
          {showJoinForm && (
            <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} className="max-w-md mx-auto mb-12 bg-white dark:bg-slate-800 p-8 rounded-[24px] shadow-sm border border-slate-200 dark:border-slate-700 transition-colors">
               <h3 className="text-xl font-bold mb-6 text-slate-900 dark:text-white font-bengali text-center">নতুন দাতা সদস্য হিসেবে যুক্ত হোন</h3>
               <form onSubmit={handleJoinDonor} className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1.5 font-bengali">আপনার নাম</label>
                    <input
                      type="text"
                      value={joinForm.name}
                      onChange={e => setJoinForm({...joinForm, name: e.target.value})}
                      className="w-full px-4 py-2 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-600 rounded-xl focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 dark:focus:ring-indigo-500/40 dark:focus:border-indigo-400 transition-colors outline-none text-slate-900 dark:text-white font-bengali"
                      placeholder="রাহিম উদ্দিন"
                      required
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1.5 font-bengali">ফোন নম্বর</label>
                    <input
                      type="text"
                      value={joinForm.phone}
                      onChange={e => setJoinForm({...joinForm, phone: e.target.value})}
                      className="w-full px-4 py-2 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-600 rounded-xl focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 dark:focus:ring-indigo-500/40 dark:focus:border-indigo-400 transition-colors outline-none text-slate-900 dark:text-white"
                      placeholder="01XXXXXXXXX"
                      required
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1.5 font-bengali">ঠিকানা (ঐচ্ছিক)</label>
                    <input
                      type="text"
                      value={joinForm.address}
                      onChange={e => setJoinForm({...joinForm, address: e.target.value})}
                      className="w-full px-4 py-2 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-600 rounded-xl focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 dark:focus:ring-indigo-500/40 dark:focus:border-indigo-400 transition-colors outline-none text-slate-900 dark:text-white font-bengali"
                      placeholder="আপনার জেলা/শহর"
                    />
                  </div>
                  <button 
                    type="submit" 
                    disabled={loading}
                    className="w-full bg-emerald-600 text-white font-bold py-3 rounded-xl hover:bg-emerald-700 transition shadow-lg shadow-emerald-900/20 font-bengali"
                  >
                    {loading ? 'সাবমিট হচ্ছে...' : 'সদস্য হিসেবে যুক্ত হোন'}
                  </button>
               </form>
            </motion.div>
          )}

          {/* Donation Form */}
          {showForm && (
              <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} className="max-w-md mx-auto bg-white dark:bg-slate-800 p-8 rounded-[24px] shadow-sm border border-slate-200 dark:border-slate-700 transition-colors">
                 <div className="bg-indigo-50 dark:bg-indigo-900/30 border border-indigo-100 dark:border-indigo-800/50 rounded-xl p-4 mb-6 text-center">
                    <p className="text-sm text-indigo-800 dark:text-indigo-300 font-bold leading-relaxed font-bengali">
                      অনুগ্রহ করে বিকাশ এর মাধ্যমে অনুদান পাঠান<br/>
                      <span className="text-lg font-black text-indigo-900 dark:text-indigo-200 mt-1 block font-mono">01570206953</span>
                      এরপর ফর্মটি পূরণ করুন যাতে আমরা আপনার অনুদানটি তালিকাভুক্ত করতে পারি।
                    </p>
                 </div>
                 <form onSubmit={handleSubmit} className="space-y-4">
                    <div>
                      <label className="block text-sm font-bold text-slate-700 dark:text-slate-300 mb-1.5 font-bengali">পরিমাণ (৳)</label>
                      <div className="grid grid-cols-4 gap-2 mb-3">
                        {predefinedAmounts.map(amt => (
                          <button 
                            key={amt} 
                            type="button"
                            onClick={() => setFormAmt(amt)}
                            className={`py-2 text-sm font-medium rounded-lg border transition-colors ${formAmt === amt ? 'bg-indigo-50 dark:bg-indigo-900/40 border-indigo-200 dark:border-indigo-700 text-indigo-700 dark:text-indigo-300' : 'bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-600 text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-700'}`}
                          >৳{amt}</button>
                        ))}
                      </div>
                      <input
                        type="number"
                        value={formAmt}
                        onChange={e => setFormAmt(Number(e.target.value))}
                        className="w-full px-4 py-2 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-600 rounded-xl focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 dark:focus:ring-indigo-500/40 dark:focus:border-indigo-400 transition-colors outline-none text-slate-900 dark:text-white"
                        placeholder="অন্যান্য পরিমাণ"
                        required
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-bold text-slate-700 dark:text-slate-300 mb-1.5 font-bengali">আপনার নাম (ঐচ্ছিক)</label>
                      <input
                        type="text"
                        value={formName}
                        onChange={e => setFormName(e.target.value)}
                        className="w-full px-4 py-2 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-600 rounded-xl focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 dark:focus:ring-indigo-500/40 dark:focus:border-indigo-400 transition-colors outline-none text-slate-900 dark:text-white"
                        placeholder="বেনামী"
                      />
                    </div>
                    <button 
                      type="submit" 
                      disabled={loading}
                      className="w-full bg-indigo-600 text-white font-medium py-3 rounded-xl hover:bg-indigo-700 transition"
                    >
                      {loading ? 'সাবমিট হচ্ছে...' : 'অনুদান সংরক্ষণ করুন'}
                    </button>
                 </form>
              </motion.div>
            )}

            {successMsg && (
              <div className="bg-emerald-50 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-300 p-4 rounded-xl text-center font-medium max-w-md mx-auto border border-emerald-200 dark:border-emerald-800/50 shadow-sm transition-colors">
                ধন্যবাদ! আপনার অনুদানের তথ্য সফলভাবে সংরক্ষিত হয়েছে।
              </div>
            )}

            {/* Stats */}
            <div className="flex justify-center flex-wrap gap-4">
               <div className="bg-white dark:bg-slate-800 px-8 py-6 rounded-2xl shadow-sm border border-slate-200 dark:border-slate-700 flex items-center gap-6 min-w-[300px] transition-colors">
                 <div className="w-12 h-12 bg-emerald-100 dark:bg-emerald-900/40 text-emerald-600 dark:text-emerald-400 rounded-full flex items-center justify-center flex-shrink-0">
                    <TrendingUp className="w-6 h-6" />
                 </div>
                 <div>
                   <p className="text-sm font-bold font-bengali text-slate-500 dark:text-slate-400 w-full mb-1">সর্বমোট অনুদান</p>
                   <p className="text-3xl font-black text-slate-900 dark:text-white font-mono">৳{totalDonated}</p>
                 </div>
               </div>
            </div>

            {/* List */}
            <div>
              <h3 className="text-2xl font-bold mb-6 flex items-center justify-center gap-2 text-slate-900 dark:text-white font-bengali">
                সাম্প্রতিক অনুদানসমূহ
              </h3>
              
              {/* Mobile View */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 lg:hidden">
                {[...donations].sort((a,b) => new Date(b.date).getTime() - new Date(a.date).getTime()).map(d => (
                   <div key={d.id} className="bg-white dark:bg-slate-800 p-4 rounded-xl shadow-sm border border-slate-200 dark:border-slate-700 flex justify-between items-center transition-colors">
                      <div>
                        <h4 className="font-bold text-slate-900 dark:text-slate-200 font-bengali text-lg leading-loose mb-1">{d.name || 'বেনামী'}</h4>
                        <p className="text-xs text-slate-500 dark:text-slate-400 font-mono mt-1">{new Date(d.date).toLocaleDateString()}</p>
                      </div>
                      <div className="text-right">
                        <span className="font-black text-emerald-600 dark:text-emerald-400 text-lg font-mono">৳{d.amount}</span>
                      </div>
                   </div>
                ))}
                {donations.length === 0 && (
                  <div className="col-span-full p-8 text-center text-slate-500 dark:text-slate-400 bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 font-bengali font-bold transition-colors">
                    এখনো কোনো অনুদান পাওয়া যায়নি।
                  </div>
                )}
              </div>

              {/* Desktop View */}
              <div className="hidden lg:block bg-white dark:bg-slate-800 rounded-[24px] p-2 shadow-sm border border-slate-200 dark:border-slate-700 overflow-hidden transition-colors">
                <div className="overflow-x-auto">
                  <table className="w-full text-left border-collapse min-w-[500px]">
                    <thead>
                      <tr>
                        <th className="border-b border-slate-100 dark:border-slate-700 p-5 text-sm font-bold text-slate-500 dark:text-slate-400 bg-slate-50/50 dark:bg-slate-800/50 font-bengali">দাতা</th>
                        <th className="border-b border-slate-100 dark:border-slate-700 p-5 text-sm font-bold text-slate-500 dark:text-slate-400 bg-slate-50/50 dark:bg-slate-800/50 font-bengali">তারিখ</th>
                        <th className="border-b border-slate-100 dark:border-slate-700 p-5 text-sm font-bold text-slate-500 dark:text-slate-400 bg-slate-50/50 dark:bg-slate-800/50 text-right font-bengali">পরিমাণ</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100/50 dark:divide-slate-700/50">
                      {[...donations].sort((a,b) => new Date(b.date).getTime() - new Date(a.date).getTime()).map(d => (
                        <tr key={d.id} className="hover:bg-slate-50/50 dark:hover:bg-slate-700/50 transition-colors">
                          <td className="p-5 font-bold text-slate-900 dark:text-slate-200 font-bengali leading-relaxed">{d.name || 'বেনামী'}</td>
                          <td className="p-5 text-slate-500 dark:text-slate-400 text-sm font-mono font-medium">
                            {new Date(d.date).toLocaleDateString()}
                          </td>
                          <td className="p-5 font-black text-emerald-600 dark:text-emerald-400 text-right font-mono text-base">৳{d.amount}</td>
                        </tr>
                      ))}
                      {donations.length === 0 && (
                        <tr><td colSpan={3} className="text-center p-12 text-slate-500 dark:text-slate-400 bg-slate-50/50 dark:bg-slate-800/50 font-bengali font-bold">এখনো কোনো অনুদান পাওয়া যায়নি।</td></tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          </motion.div>
        )}
      </div>
    </motion.div>
  );
}
