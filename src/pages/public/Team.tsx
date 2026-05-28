import React, { useEffect, useState } from 'react';
import { motion } from 'motion/react';
import { Phone, Mail, User2, Loader2 } from 'lucide-react';

import { onSnapshot, collection } from 'firebase/firestore';
import { db } from '../../lib/firebase';

interface TeamMember {
  id: string;
  name: string;
  role: string;
  contact: string;
  image?: string;
  createdAt?: number;
  session?: string;
  isFormer?: boolean;
}

export default function Team() {
  const [team, setTeam] = useState<TeamMember[]>([]);
  const [loading, setLoading] = useState(true);
  const [filterMode, setFilterMode] = useState<'all' | 'current' | 'former'>('current');

  useEffect(() => {
    const fetchTeam = async () => {
      try {
        const cached = sessionStorage.getItem('pub_team_cache');
        const cacheTime = sessionStorage.getItem('pub_team_cache_time');
        
        if (cached && cacheTime && (Date.now() - parseInt(cacheTime) < 5 * 60 * 1000)) {
          setTeam(JSON.parse(cached));
          setLoading(false);
          return;
        }

        const { getDocs } = await import('firebase/firestore');
        const snapshot = await getDocs(collection(db, 'team'));
        let teamData = snapshot.docs.map(doc => ({
          id: doc.id,
          ...doc.data()
        })) as TeamMember[];
        
        teamData.sort((a, b) => {
          const roleA = (a.role || '').toLowerCase();
          const roleB = (b.role || '').toLowerCase();
          
          const isDirectorA = roleA.includes('পরিচালক') && !roleA.includes('সহ');
          const isDirectorB = roleB.includes('পরিচালক') && !roleB.includes('সহ');
          
          const isCoDirectorA = roleA.includes('সহ পরিচালক') || roleA.includes('সহ-পরিচালক');
          const isCoDirectorB = roleB.includes('সহ পরিচালক') || roleB.includes('সহ-পরিচালক');

          if (isDirectorA && !isDirectorB) return -1;
          if (!isDirectorA && isDirectorB) return 1;
          if (isCoDirectorA && !isCoDirectorB) return -1;
          if (!isCoDirectorA && isCoDirectorB) return 1;

          const timeA = a.createdAt || 0;
          const timeB = b.createdAt || 0;
          return timeA - timeB;
        });

        setTeam(teamData);
        sessionStorage.setItem('pub_team_cache', JSON.stringify(teamData));
        sessionStorage.setItem('pub_team_cache_time', Date.now().toString());
        setLoading(false);
      } catch (error) {
        console.error("Error fetching team:", error);
        setLoading(false);
      }
    };
    fetchTeam();
  }, []);

  const filteredTeam = team.filter((m) => {
    if (filterMode === 'current') return !m.isFormer;
    if (filterMode === 'former') return m.isFormer;
    return true;
  });

  return (
    <div className="min-h-screen py-20 px-4">
      <div className="max-w-7xl mx-auto">
        <div className="text-center max-w-2xl mx-auto mb-10 relative">
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-64 h-64 bg-indigo-50 rounded-full blur-3xl opacity-50 -z-10"></div>
          <span className="text-indigo-600 font-bold uppercase tracking-widest text-sm mb-3 block font-bengali">আমাদের নেতৃত্ব</span>
          <h1 className="text-4xl md:text-5xl font-black tracking-tight text-slate-900 mb-6 font-bengali">পরিচালনা পর্ষদ</h1>
          <div className="w-16 h-1.5 bg-gradient-to-r from-indigo-500 to-purple-500 mx-auto rounded-full mb-6"></div>
          <p className="text-slate-600 text-lg md:text-xl font-bengali font-medium leading-relaxed">
            যে নিবেদিতপ্রাণ স্বেচ্ছাসেবকদের ঐকান্তিক প্রচেষ্টায় পানধোয়া উন্মুক্ত পাঠাগার প্রতিদিন পরিচালিত হচ্ছে।
          </p>
        </div>

        <div className="flex justify-center mb-12">
          <div className="flex bg-slate-100 p-1.5 rounded-xl">
            <button onClick={() => setFilterMode('all')} className={`px-6 py-2.5 text-sm font-bold rounded-lg transition-all font-bengali ${filterMode === 'all' ? 'bg-white text-indigo-600 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}>সকল</button>
            <button onClick={() => setFilterMode('current')} className={`px-6 py-2.5 text-sm font-bold rounded-lg transition-all font-bengali ${filterMode === 'current' ? 'bg-white text-indigo-600 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}>বর্তমান</button>
            <button onClick={() => setFilterMode('former')} className={`px-6 py-2.5 text-sm font-bold rounded-lg transition-all font-bengali ${filterMode === 'former' ? 'bg-white text-indigo-600 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}>সাবেক</button>
          </div>
        </div>

        {loading ? (
          <div className="flex justify-center items-center py-20">
            <Loader2 className="w-8 h-8 text-indigo-500 animate-spin" />
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8 lg:gap-10">
            {filteredTeam.map((member, i) => (
              <motion.div
                key={member.id}
                initial={{ opacity: 0, y: 30 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.4, ease: "easeOut" }}
                className="group bg-white rounded-3xl p-8 shadow-[0_10px_40px_-15px_rgba(0,0,0,0.1)] hover:shadow-[0_20px_50px_-20px_rgba(79,70,229,0.3)] hover:-translate-y-2 transition-all duration-300 border border-slate-100 flex flex-col items-center relative overflow-hidden"
              >
                <div className="absolute top-0 left-0 w-full h-24 bg-gradient-to-br from-indigo-50/50 to-purple-50/50 -z-10 group-hover:h-32 transition-all duration-300"></div>
                
                <div className="w-28 h-28 rounded-full flex items-center justify-center mb-6 overflow-hidden border-4 border-white shadow-xl bg-white relative z-10 group-hover:scale-105 transition-transform duration-300">
                  {member.image ? (
                    <img src={member.image} alt={member.name} referrerPolicy="no-referrer" className="w-full h-full object-cover" />
                  ) : (
                    <div className="w-full h-full bg-gradient-to-br from-indigo-100 to-indigo-50 flex items-center justify-center">
                      <User2 className="w-12 h-12 text-indigo-300" />
                    </div>
                  )}
                </div>
                
                <h3 className="text-2xl font-bold text-slate-900 font-bengali mb-2 text-center group-hover:text-indigo-600 transition-colors">{member.name}</h3>
                
                <div className="flex flex-col items-center gap-2 mb-6">
                  <p className="text-xs text-white font-bold uppercase tracking-widest font-bengali bg-indigo-600 px-4 py-1.5 rounded-full inline-block shadow-sm shadow-indigo-600/30 text-center">{member.role}</p>
                  
                  <div className="flex gap-2">
                    {member.isFormer && (
                      <span className="text-[10px] text-rose-600 font-bold uppercase tracking-widest font-bengali bg-rose-50 border border-rose-100 px-3 py-1 rounded-full text-center">সাবেক</span>
                    )}
                    {member.session && (
                      <span className="text-[10px] text-slate-600 font-bold uppercase tracking-widest font-bengali bg-slate-100 border border-slate-200 px-3 py-1 rounded-full text-center">{member.session}</span>
                    )}
                  </div>
                </div>
                
                <div className="mt-auto w-full pt-6 border-t border-slate-100/80">
                   <p className="text-sm font-medium text-slate-600 flex items-center justify-center gap-2 font-bengali group-hover:text-indigo-500 transition-colors">
                     <Phone className="w-4 h-4 text-indigo-400 group-hover:text-indigo-500" /> {member.contact.replace(/[0-9]/g, w => String.fromCharCode(w.charCodeAt(0) + 2486))}
                   </p>
                </div>
              </motion.div>
            ))}

            {team.length === 0 && (
              <div className="col-span-full py-20 text-center text-slate-500 font-bengali font-medium">
                শীঘ্রই সদস্যদের তথ্য আপডেট করা হবে!
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
