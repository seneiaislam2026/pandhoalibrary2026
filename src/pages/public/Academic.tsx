import React, { useState, useEffect } from 'react';
import { collection, query, where, getDocs, orderBy, doc, getDoc } from 'firebase/firestore';
import { db } from '../../lib/firebase';
import { GraduationCap, ArrowRight, BookOpen, Clock, AlignLeft, ShieldCheck } from 'lucide-react';
import toast from 'react-hot-toast';

export default function Academic() {
  const [selectedClass, setSelectedClass] = useState<string | null>(null);
  const [contents, setContents] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [portalEnabled, setPortalEnabled] = useState(true);

  const classes = [
    'ক্লাস ৪', 'ক্লাস ৫', 'ক্লাস ৬', 'ক্লাস ৭', 'ক্লাস ৮', 'ক্লাস ৯', 'ক্লাস ১০', 'এইচএসসি (HSC)', 'ফ্রি প্রতিযোগিতা (সবার জন্য)'
  ];

  useEffect(() => {
    const checkSettings = async () => {
       try {
          const docRef = doc(db, 'settings', 'general');
          const docSnap = await getDoc(docRef);
          if (docSnap.exists() && docSnap.data().isAcademicPortalEnabled === false) {
             setPortalEnabled(false);
          }
       } catch (err) {
          console.error(err);
       }
    };
    checkSettings();
  }, []);

  useEffect(() => {
    if (selectedClass) {
       fetchContents();
    }
  }, [selectedClass]);

  const fetchContents = async () => {
    setLoading(true);
    try {
      const q = query(
        collection(db, 'academic_contents'),
        where('targetClass', '==', selectedClass)
      );
      const snap = await getDocs(q);
      const data = snap.docs.map(d => ({ id: d.id, ...d.data() }));
      // Sort in memory to avoid index requirement for now
      data.sort((a: any, b: any) => (b.createdAt?.toMillis() || 0) - (a.createdAt?.toMillis() || 0));
      setContents(data);
    } catch (err) {
      console.error(err);
      toast.error('কন্টেন্ট লোড করতে সমস্যা হয়েছে');
    } finally {
      setLoading(false);
    }
  };

  if (!portalEnabled) {
     return (
       <div className="min-h-screen bg-slate-50 flex items-center justify-center p-6 text-center text-slate-500 font-bengali">
          <div className="max-w-md bg-white p-8 rounded-2xl shadow-sm border border-slate-200">
             <GraduationCap className="w-16 h-16 mx-auto text-slate-300 mb-4" />
             <h2 className="text-2xl font-bold mb-2">একাডেমিক পোর্টাল বন্ধ আছে</h2>
             <p>কর্তৃপক্ষ কর্তৃক বর্তমানে একাডেমিক পোর্টালটি বন্ধ রাখা হয়েছে।</p>
          </div>
       </div>
     );
  }

  return (
    <div className="min-h-screen bg-slate-50 pb-16 font-bengali">
      {/* Header */}
      <div className="bg-white border-b border-slate-200 py-12 relative overflow-hidden">
         <div className="absolute top-0 right-0 w-64 h-64 bg-fuchsia-500/5 rounded-full blur-[80px] -mr-32 -mt-32"></div>
         <div className="max-w-4xl mx-auto px-6 text-center relative z-10">
            <div className="w-16 h-16 bg-fuchsia-100 text-fuchsia-600 rounded-2xl flex items-center justify-center mx-auto mb-4 border border-fuchsia-200">
               <GraduationCap className="w-8 h-8" />
            </div>
            <h1 className="text-3xl font-black text-slate-800 mb-3">একাডেমিক হাব</h1>
            <p className="text-slate-500 max-w-xl mx-auto font-medium">
               আপনার ক্লাস নির্বাচন করে লেকচার শিট, কুইজ এবং প্রশ্ন ব্যাংক অ্যাক্সেস করুন। প্রতিযোগিতায় অংশগ্রহণ করে জিতে নিন আকর্ষণীয় পুরস্কার।
            </p>
         </div>
      </div>

      <div className="max-w-4xl mx-auto px-6 mt-8">
        {!selectedClass ? (
           <div>
             <h2 className="text-xl font-bold text-slate-800 mb-6 flex items-center gap-2">
                <BookOpen className="w-5 h-5 text-fuchsia-500" />
                আপনার ক্লাস নির্বাচন করুন
             </h2>
             <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                {classes.map(cls => (
                   <button
                     key={cls}
                     onClick={() => setSelectedClass(cls)}
                     className="bg-white border text-left border-slate-200 p-5 rounded-2xl hover:border-fuchsia-300 hover:shadow-md transition-all group flex flex-col items-center justify-center text-center gap-3"
                   >
                      <div className="w-12 h-12 bg-slate-50 rounded-full flex items-center justify-center group-hover:bg-fuchsia-50 transition-colors">
                         {cls.includes('প্রতিযোগিতা') ? (
                           <ShieldCheck className="w-6 h-6 text-slate-400 group-hover:text-fuchsia-600" />
                         ) : (
                           <span className="text-slate-400 group-hover:text-fuchsia-600 font-bold text-xl">{cls.replace('ক্লাস ', '')}</span>
                         )}
                      </div>
                      <span className="font-bold text-slate-700 group-hover:text-fuchsia-700">{cls}</span>
                   </button>
                ))}
             </div>
           </div>
        ) : (
           <div>
             <button
                onClick={() => { setSelectedClass(null); setContents([]); }}
                className="mb-6 flex items-center gap-2 text-slate-500 hover:text-fuchsia-600 font-bold bg-white px-4 py-2 rounded-lg shadow-sm border border-slate-200 text-sm w-fit"
             >
                <ArrowRight className="w-4 h-4 rotate-180" /> অন্য ক্লাস নির্বাচন
             </button>
             
             <div className="bg-white rounded-2xl p-6 border border-slate-200 shadow-sm mb-6 flex items-center justify-between">
                <div>
                   <span className="text-xs font-black text-fuchsia-600 tracking-wider uppercase mb-1 block">নির্বাচিত ক্লাস</span>
                   <h2 className="text-2xl font-black text-slate-800">{selectedClass}</h2>
                </div>
                <div className="w-12 h-12 bg-fuchsia-50 rounded-xl flex items-center justify-center text-fuchsia-600">
                   {selectedClass.includes('প্রতিযোগিতা') ? <ShieldCheck className="w-6 h-6" /> : <GraduationCap className="w-6 h-6" />}
                </div>
             </div>

             {loading ? (
                <div className="py-20 text-center">
                   <div className="w-12 h-12 border-4 border-fuchsia-100 border-t-fuchsia-600 rounded-full animate-spin mx-auto mb-4"></div>
                   <p className="text-slate-500 font-bold">কন্টেন্ট খোঁজা হচ্ছে...</p>
                </div>
             ) : contents.length === 0 ? (
                <div className="py-20 text-center bg-white rounded-2xl border border-slate-200 border-dashed">
                   <AlignLeft className="w-12 h-12 mx-auto text-slate-300 mb-4" />
                   <h3 className="text-lg font-bold text-slate-700 mb-1">কোনো কন্টেন্ট পাওয়া যায়নি</h3>
                   <p className="text-sm text-slate-500">এই ক্লাসের জন্য এখনও কোনো কুইজ বা প্রশ্ন ব্যাংক যোগ করা হয়নি।</p>
                </div>
             ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                   {contents.map(item => (
                      <div key={item.id} className="bg-white p-5 rounded-2xl border border-slate-200 hover:shadow-md transition-shadow relative overflow-hidden group">
                         <div className="absolute top-0 right-0 w-24 h-24 bg-fuchsia-50/50 rounded-bl-full -mr-4 -mt-4 opacity-0 group-hover:opacity-100 transition-opacity"></div>
                         
                         <div className="flex justify-between items-start mb-3 relative z-10">
                            <span className={`text-xs font-bold px-2 py-1 rounded-md ${
                               item.type === 'quiz' ? 'bg-indigo-50 text-indigo-700' :
                               item.type === 'lecture' ? 'bg-emerald-50 text-emerald-700' :
                               'bg-amber-50 text-amber-700'
                            }`}>
                               {item.type === 'quiz' ? 'কুইজ নির্বাচন' : item.type === 'lecture' ? 'লেকচার শিট' : 'প্রশ্ন ব্যাংক'}
                            </span>
                            
                            <span className="text-[11px] text-slate-400 flex items-center gap-1 font-medium">
                              <Clock className="w-3 h-3" />
                              {item.createdAt ? new Date(item.createdAt.toDate()).toLocaleDateString('bn-BD') : 'নতুন'}
                            </span>
                         </div>
                         
                         <h3 className="font-bold text-slate-800 text-lg mb-2 relative z-10">{item.title}</h3>
                         {item.description && <p className="text-sm text-slate-500 line-clamp-2 mb-4 relative z-10">{item.description}</p>}
                         
                         <a 
                            href={item.link}
                            target="_blank"
                            rel="noopener noreferrer" 
                            className="inline-flex items-center gap-1.5 text-sm font-bold text-fuchsia-600 hover:text-fuchsia-700 relative z-10"
                         >
                            অংশগ্রহণ করুন <ArrowRight className="w-4 h-4" />
                         </a>
                      </div>
                   ))}
                </div>
             )}
           </div>
        )}
      </div>
    </div>
  );
}
