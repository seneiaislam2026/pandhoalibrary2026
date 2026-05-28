import React, { useEffect, useState } from 'react';
import { useAuth } from '../../store/AuthContext';
import { BookOpen, Calendar, Clock, AlertCircle, CheckCircle2, XCircle, Info, RefreshCw } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { collection, query, where, updateDoc, doc, serverTimestamp, setDoc, addDoc, getDocs, deleteDoc } from 'firebase/firestore';
import { db } from '../../lib/firebase';
import toast from 'react-hot-toast';

export default function UserBooks() {
  const [issues, setIssues] = useState<any[]>([]);
  const [preBookings, setPreBookings] = useState<any[]>([]);
  const [books, setBooks] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const { user } = useAuth();
  const [activeTab, setActiveTab] = useState<'issues' | 'prebooks'>('issues');

  useEffect(() => {
    if (!user) return;
    
    const fetchUserData = async () => {
      try {
        const [issuesSnap, preSnap, booksSnap] = await Promise.all([
          getDocs(query(collection(db, "issues"), where("userId", "==", user.id))),
          getDocs(query(collection(db, "pre-bookings"), where("userId", "==", user.id))),
          getDocs(collection(db, "books"))
        ]);

        setIssues(issuesSnap.docs.map(doc => ({ id: doc.id, ...doc.data() })));
        setPreBookings(preSnap.docs.map(doc => ({ id: doc.id, ...doc.data() })));
        setBooks(booksSnap.docs.map(doc => ({ id: doc.id, ...doc.data(), cover: doc.data().cover || doc.data().imageUrl })));
        setLoading(false);
      } catch (err) {
        console.error("Error fetching user books:", err);
        setLoading(false);
      }
    };

    fetchUserData();
  }, [user]);

  const handleReturnRequest = async (issue: any, book: any) => {
    if (!confirm(`আপনি কি "${book?.title}" বইটি ফেরত দেওয়ার জন্য অনুরোধ করতে চান?`)) return;
    try {
      await updateDoc(doc(db, 'issues', issue.id), {
        returnRequested: true,
        updatedAt: serverTimestamp()
      });
      await addDoc(collection(db, 'member-requests'), {
        userId: user?.id,
        type: 'return',
        issueId: issue.id,
        bookId: issue.bookId,
        createdAt: serverTimestamp(),
        status: 'pending'
      });
      setIssues(prev => prev.map(iss => iss.id === issue.id ? { ...iss, returnRequested: true } : iss));
      toast.success('বইটি ফেরত দেওয়ার অনুরোধ পাঠানো হয়েছে।');
    } catch (err: any) {
      toast.error('অনুরোধ পাঠাতে সমস্যা হয়েছে: ' + err.message);
    }
  };

  const handleCancelPreBooking = async (pbId: string) => {
    if (!confirm('আপনি কি এই প্রি-বুকিং রিকোয়েস্টটি বাতিল করতে চান?')) return;
    try {
      await deleteDoc(doc(db, 'pre-bookings', pbId));
      setPreBookings(prev => prev.filter(pb => pb.id !== pbId));
      toast.success('প্রি-বুকিং রিকোয়েস্ট বাতিল করা হয়েছে।');
    } catch (err: any) {
      toast.error('সমস্যা হয়েছে: ' + err.message);
    }
  };

  if (loading) {
     return (
       <div className="flex flex-col items-center justify-center py-20 px-4 h-[60vh]">
         <div className="w-16 h-16 border-4 border-indigo-200 border-t-indigo-600 rounded-full animate-spin mb-4" />
         <p className="text-slate-500 font-medium font-bengali">লোডিং হচ্ছে...</p>
       </div>
     );
  }

  return (
    <div className="max-w-5xl mx-auto space-y-8 pb-24">
      {/* Header Section */}
      <div className="bg-slate-900 border border-slate-800 p-8 sm:p-12 rounded-[2.5rem] shadow-2xl relative overflow-hidden group">
          <div className="absolute right-0 top-0 w-64 h-64 bg-indigo-500/20 rounded-full blur-[60px] translate-x-10 -translate-y-10 pointer-events-none" />
          <div className="absolute left-0 bottom-0 w-64 h-64 bg-emerald-500/20 rounded-full blur-[60px] -translate-x-10 translate-y-10 pointer-events-none" />
          
          <div className="relative z-10 flex flex-col md:flex-row gap-6 md:items-center md:justify-between">
              <div>
                 <div className="w-12 h-12 bg-white/10 backdrop-blur-md rounded-2xl flex items-center justify-center text-indigo-300 shadow-inner border border-white/10 mb-5">
                    <BookOpen className="w-6 h-6" />
                 </div>
                 <h2 className="text-3xl md:text-5xl font-black tracking-tight font-bengali text-white mb-3">বইয়ের হিসাব</h2>
                 <p className="text-slate-400 font-medium font-bengali opacity-90 max-w-sm">আপনার সংগ্রহে থাকা বই এবং প্রি-বুকিং করা বইয়ের স্ট্যাটাস একনজরে দেখুন।</p>
              </div>
          </div>
      </div>

      <div className="flex p-1.5 bg-slate-100 rounded-2xl max-w-sm mx-auto shadow-inner relative">
         <button 
            onClick={() => setActiveTab('issues')}
            className={`flex-1 py-3 text-sm font-bold font-bengali rounded-xl transition-all relative z-10 ${activeTab === 'issues' ? 'text-slate-900' : 'text-slate-500 hover:text-slate-700'}`}
         >
            ইস্যু করা বই
            {issues.length > 0 && <span className="ml-2 inline-flex items-center justify-center px-2 py-0.5 rounded-full text-[10px] bg-slate-200 text-slate-700">{issues.length}</span>}
         </button>
         <button 
            onClick={() => setActiveTab('prebooks')}
            className={`flex-1 py-3 text-sm font-bold font-bengali rounded-xl transition-all relative z-10 ${activeTab === 'prebooks' ? 'text-indigo-600' : 'text-slate-500 hover:text-slate-700'}`}
         >
            প্রি-বুকিং
            {preBookings.length > 0 && <span className="ml-2 inline-flex items-center justify-center px-2 py-0.5 rounded-full text-[10px] bg-indigo-100 text-indigo-700">{preBookings.length}</span>}
         </button>
         
         {/* Animated pill background */}
         <div 
             className={`absolute top-1.5 bottom-1.5 w-[calc(50%-6px)] bg-white rounded-xl shadow-sm transition-transform duration-300 ease-out ${activeTab === 'issues' ? 'translate-x-[6px]' : 'translate-x-[calc(100%+6px)]'}`}
         />
      </div>

      <AnimatePresence mode="wait">
        <motion.div
           key={activeTab}
           initial={{ opacity: 0, y: 10 }}
           animate={{ opacity: 1, y: 0 }}
           exit={{ opacity: 0, y: -10 }}
           transition={{ duration: 0.2 }}
        >
          {activeTab === 'issues' && (
             <div className="space-y-6">
                <div className="grid gap-6 md:grid-cols-2">
                  {issues.length === 0 ? (
                    <div className="col-span-full py-20 text-center border-2 border-dashed border-slate-200 rounded-[2.5rem] bg-slate-50/50">
                      <div className="w-20 h-20 bg-white rounded-full flex items-center justify-center mx-auto mb-4 shadow-sm border border-slate-100">
                         <BookOpen className="w-8 h-8 text-slate-300" />
                      </div>
                      <h3 className="text-xl font-bold text-slate-800 font-bengali mb-2">কোনো ইস্যু করা বই নেই</h3>
                      <p className="text-slate-500 font-medium font-bengali">আপনার নামে বর্তমানে কোনো বই ইস্যু করা নেই।</p>
                    </div>
                  ) : (
                    issues.map(i => {
                      const book = books.find(b => b.id === i.bookId);
                      const isOverdue = i.expectedReturnDate && new Date() > new Date(i.expectedReturnDate) && String(i.status).toLowerCase() === 'issued';
                      const isReturned = String(i.status).toLowerCase() !== 'issued';
                      
                      return (
                         <div key={i.id} className={`bg-white p-6 rounded-[2rem] shadow-[0_8px_30px_rgb(0,0,0,0.04)] border ${isOverdue ? 'border-rose-100' : 'border-slate-100'} hover:shadow-lg transition-shadow`}>
                            <div className="flex gap-5">
                               <div className="w-20 rounded-xl overflow-hidden bg-slate-100 hidden sm:block shrink-0 shadow-sm border border-slate-200 p-1">
                                   {book?.cover ? (
                                      <img src={book.cover} alt="Cover" className="w-full h-full object-contain" />
                                   ) : (
                                      <div className="w-full h-full aspect-[3/4] flex items-center justify-center bg-slate-100">
                                         <BookOpen className="text-slate-300 w-8 h-8" />
                                      </div>
                                   )}
                               </div>
                               <div className="flex-1 min-w-0">
                                  <div className="flex justify-between items-start gap-4 mb-2">
                                     <h3 className="font-black text-slate-900 text-xl font-bengali leading-tight line-clamp-2">{book?.title || 'অজানা বই'}</h3>
                                     <span className={`shrink-0 text-xs font-bold px-3 py-1.5 rounded-lg border flex items-center gap-1 uppercase tracking-widest ${
                                         isReturned ? 'bg-slate-50 text-slate-500 border-slate-200' : 
                                         isOverdue ? 'bg-rose-50 text-rose-600 border-rose-200/50' : 
                                         'bg-indigo-50 text-indigo-600 border-indigo-200/50'
                                     }`}>
                                       {!isReturned && <div className={`w-1.5 h-1.5 rounded-full ${isOverdue ? 'bg-rose-500 animate-ping' : 'bg-indigo-500'}`} />}
                                       {isReturned ? 'ফেরত দেওয়া' : 'পড়ছেন'}
                                     </span>
                                  </div>
                                  <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-4 flex items-center gap-1.5">
                                      <BookOpen className="w-3 h-3" /> কোড: {book?.bookCode || 'N/A'}
                                  </p>

                                  <div className="bg-slate-50 rounded-xl p-4 space-y-3 mb-5 border border-slate-100/50">
                                      <div className="flex items-center gap-3 text-sm text-slate-600 font-medium">
                                          <div className="w-8 h-8 rounded-full bg-white flex items-center justify-center shadow-sm">
                                             <Calendar className="w-4 h-4 text-slate-400" />
                                          </div>
                                          <div>
                                             <p className="text-[10px] uppercase font-black text-slate-400 tracking-wider">গ্রহণের তারিখ</p>
                                             <p>{new Date(i.issueDate).toLocaleDateString('bn-BD', { year: 'numeric', month: 'short', day: 'numeric' })}</p>
                                          </div>
                                      </div>
                                      {!isReturned && (
                                         <div className="flex items-center gap-3 text-sm font-medium">
                                             <div className={`w-8 h-8 rounded-full flex items-center justify-center shadow-sm ${isOverdue ? 'bg-rose-100' : 'bg-white'}`}>
                                                <AlertCircle className={`w-4 h-4 ${isOverdue ? 'text-rose-500' : 'text-amber-500'}`} />
                                             </div>
                                             <div>
                                                <p className={`text-[10px] uppercase font-black tracking-wider ${isOverdue ? 'text-rose-400' : 'text-slate-400'}`}>ফেরতের শেষ তারিখ</p>
                                                <p className={isOverdue ? 'text-rose-600 font-bold' : 'text-slate-700'}>
                                                   {new Date(i.expectedReturnDate).toLocaleDateString('bn-BD', { year: 'numeric', month: 'short', day: 'numeric' })}
                                                   {isOverdue && <span className="ml-2 bg-rose-500 text-white text-[10px] px-2 py-0.5 rounded-full uppercase tracking-widest">Overdue</span>}
                                                </p>
                                             </div>
                                         </div>
                                      )}
                                  </div>

                                  {!isReturned && (
                                      i.returnRequested ? (
                                        <div className="w-full bg-emerald-50 text-emerald-700 py-3.5 rounded-xl font-bold text-sm text-center font-bengali border border-emerald-200/50 flex items-center justify-center gap-2">
                                          <CheckCircle2 className="w-5 h-5" />
                                          ফেরতের অনুরোধ করা হয়েছে
                                        </div>
                                      ) : (
                                        <button 
                                          onClick={() => handleReturnRequest(i, book)}
                                          className="w-full flex items-center justify-center gap-2 py-3.5 bg-slate-900 text-white rounded-xl font-bold font-bengali hover:bg-black transition-all shadow-lg shadow-slate-900/10 active:scale-[0.98]"
                                        >
                                          <RefreshCw className="w-4 h-4" />
                                          বই ফেরত দেওয়ার অনুরোধ করুন
                                        </button>
                                      )
                                  )}
                               </div>
                            </div>
                         </div>
                      );
                    })
                  )}
                </div>
             </div>
          )}

          {activeTab === 'prebooks' && (
             <div className="space-y-6">
                <div className="grid gap-6 md:grid-cols-2">
                  {preBookings.length === 0 ? (
                    <div className="col-span-full py-20 text-center border-2 border-dashed border-slate-200 rounded-[2.5rem] bg-indigo-50/30">
                      <div className="w-20 h-20 bg-white rounded-full flex items-center justify-center mx-auto mb-4 shadow-sm border border-indigo-100">
                         <Clock className="w-8 h-8 text-indigo-300" />
                      </div>
                      <h3 className="text-xl font-bold text-slate-800 font-bengali mb-2">কোনো প্রি-বুকিং নেই</h3>
                      <p className="text-slate-500 font-medium font-bengali text-sm max-w-sm mx-auto">
                         আপনি যে বইটি পড়তে চান কিন্তু বর্তমানে লাইব্রেরিতে নেই, তা ওয়েবসাইটের বই তালিকা থেকে প্রি-বুক করতে পারবেন।
                      </p>
                    </div>
                  ) : (
                    preBookings.map(pb => {
                      const book = books.find(b => b.id === pb.bookId);
                      const isPending = pb.status === 'Pending';
                      const isCompleted = pb.status === 'Completed';
                      
                      return (
                        <div key={pb.id} className="bg-white p-6 rounded-[2rem] shadow-[0_8px_30px_rgb(0,0,0,0.04)] border border-slate-100 hover:shadow-lg transition-shadow">
                          <div className="flex gap-4 items-start mb-6">
                            <div className="w-12 h-16 rounded-xl bg-indigo-50 overflow-hidden border border-indigo-100 flex items-center justify-center shrink-0">
                               {book?.cover ? (
                                  <img src={book.cover} alt={book.title} className="w-full h-full object-cover" />
                               ) : (
                                  <BookOpen className="w-6 h-6 text-indigo-500" />
                               )}
                            </div>
                            <div className="flex-1 pt-1">
                               <div className="flex justify-between items-start gap-2">
                                  <h3 className="font-bold text-slate-900 text-lg leading-tight font-bengali">{book?.title || 'Unknown Book'}</h3>
                               </div>
                               <p className="text-[10px] font-black tracking-widest text-slate-400 mt-1 uppercase">CODE: {book?.bookCode || 'N/A'}</p>
                            </div>
                          </div>
                          
                          <div className="grid grid-cols-2 gap-3 mb-6">
                             <div className="bg-slate-50 p-3 rounded-xl border border-slate-100">
                                <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">আবেদনের তারিখ</p>
                                <p className="text-sm font-bold text-slate-700">{new Date(pb.date).toLocaleDateString('bn-BD', { day: 'numeric', month: 'short' })}</p>
                             </div>
                             <div className={`p-3 rounded-xl border flex flex-col justify-center items-center ${
                                isPending ? 'bg-amber-50 border-amber-100 text-amber-700' : 
                                isCompleted ? 'bg-emerald-50 border-emerald-100 text-emerald-700' : 
                                'bg-rose-50 border-rose-100 text-rose-700'
                             }`}>
                                <p className="text-xs font-black uppercase tracking-widest text-center">
                                   {pb.status === 'Pending' ? 'অপেক্ষমান' : pb.status === 'Completed' ? 'সফল' : 'বাতিল'}
                                </p>
                             </div>
                          </div>
                          
                          {(pb.adminNote || pb.collectDate) && (
                            <div className="bg-indigo-50/80 border border-indigo-100/50 p-4 rounded-xl space-y-3 mb-5">
                                <h4 className="flex items-center gap-1.5 text-xs font-black text-indigo-600 uppercase tracking-widest mb-2"><Info className="w-3.5 h-3.5" /> এডমিন মেসেজ</h4>
                                {pb.adminNote && (
                                  <p className="text-sm text-indigo-900 font-bengali font-medium leading-relaxed bg-white/50 p-3 rounded-lg border border-indigo-100/30">
                                    {pb.adminNote}
                                  </p>
                                )}
                                {pb.collectDate && (
                                  <p className="text-sm font-bold text-slate-900 font-bengali flex items-center py-2 px-1">
                                    <span className="w-2 h-2 rounded-full bg-indigo-500 mr-2 animate-pulse" />
                                    সংগ্রহের তারিখ: <span className="ml-2 px-2 py-1 bg-white rounded-md text-indigo-700 border border-indigo-100 shadow-sm">{pb.collectDate}</span>
                                  </p>
                                )}
                            </div>
                          )}

                          {isPending && (
                             <button 
                               onClick={() => handleCancelPreBooking(pb.id)}
                               className="w-full flex items-center justify-center gap-2 py-3 bg-red-50 text-red-600 rounded-xl font-bold font-bengali hover:bg-red-100 transition-colors border border-red-200/50 active:scale-[0.98]"
                             >
                                <XCircle className="w-4 h-4" />
                                আবেদন বাতিল করুন
                             </button>
                          )}
                        </div>
                      );
                    })
                  )}
                </div>
             </div>
          )}
        </motion.div>
      </AnimatePresence>
    </div>
  );
}
