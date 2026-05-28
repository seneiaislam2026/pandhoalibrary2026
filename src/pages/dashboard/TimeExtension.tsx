import React, { useEffect, useState } from 'react';
import { useAuth } from '../../store/AuthContext';
import { BookOpen, Calendar, Clock, AlertCircle, CheckCircle2, History } from 'lucide-react';
import { motion } from 'motion/react';
import { collection, query, where, addDoc, serverTimestamp, getDocs } from 'firebase/firestore';
import { db } from '../../lib/firebase';
import toast from 'react-hot-toast';

export default function TimeExtension() {
  const [issues, setIssues] = useState<any[]>([]);
  const [books, setBooks] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const { user } = useAuth();
  const [requestingId, setRequestingId] = useState<string | null>(null);

  useEffect(() => {
    if (!user) return;
    
    const fetchUserData = async () => {
      try {
        const [issuesSnap, booksSnap] = await Promise.all([
          getDocs(query(collection(db, "issues"), where("userId", "==", user.id))),
          getDocs(collection(db, "books"))
        ]);

        const allUserIssues = issuesSnap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        // Filter for active issues only
        const activeIssues = allUserIssues.filter((i: any) => 
          String(i.status).toLowerCase().trim() === 'issued'
        );

        setIssues(activeIssues);
        setBooks(booksSnap.docs.map(doc => ({ id: doc.id, ...doc.data(), cover: doc.data().cover || doc.data().imageUrl })));
        setLoading(false);
      } catch (err) {
        console.error("Error fetching issued books:", err);
        setLoading(false);
      }
    };

    fetchUserData();
  }, [user]);

  const handleExtensionRequest = async (issue: any, book: any) => {
    if (!confirm(`আপনি কি "${book?.title}" বইটির সময় বৃদ্ধির জন্য অনুরোধ করতে চান?`)) return;
    
    setRequestingId(issue.id);
    try {
      await addDoc(collection(db, 'member-requests'), {
        userId: user?.id,
        userName: user?.name,
        type: 'extension',
        issueId: issue.id,
        bookId: issue.bookId,
        bookTitle: book?.title,
        createdAt: serverTimestamp(),
        status: 'pending'
      });
      
      toast.success('সময় বৃদ্ধির অনুরোধ পাঠানো হয়েছে।');
      // Update local state to show it was requested if needed, 
      // but usually extension requests are handled differently by admins.
      // For now just show a success toast.
    } catch (err: any) {
      toast.error('অনুরোধ পাঠাতে সমস্যা হয়েছে: ' + err.message);
    } finally {
      setRequestingId(null);
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
      <div className="bg-gradient-to-br from-orange-600 to-rose-600 p-8 sm:p-12 rounded-[2.5rem] shadow-2xl relative overflow-hidden group text-white">
          <div className="absolute right-0 top-0 w-64 h-64 bg-white/20 rounded-full blur-[60px] translate-x-10 -translate-y-10 pointer-events-none" />
          
          <div className="relative z-10 flex flex-col md:flex-row gap-6 md:items-center md:justify-between">
              <div>
                 <div className="w-12 h-12 bg-white/20 backdrop-blur-md rounded-2xl flex items-center justify-center text-white shadow-inner border border-white/20 mb-5">
                    <Clock className="w-6 h-6" />
                 </div>
                 <h2 className="text-3xl md:text-5xl font-black tracking-tight font-bengali mb-3">সময় বৃদ্ধি</h2>
                 <p className="text-orange-50 font-medium font-bengali opacity-90 max-w-sm">আপনার সংগ্রহে থাকা বইগুলোর পড়ার সময় বৃদ্ধির অনুরোধ এখান থেকে করতে পারবেন।</p>
              </div>
          </div>
      </div>

      <div className="grid gap-6 md:grid-cols-2">
        {issues.length === 0 ? (
          <div className="col-span-full py-20 text-center border-2 border-dashed border-slate-200 rounded-[2.5rem] bg-slate-50/50">
            <div className="w-20 h-20 bg-white rounded-full flex items-center justify-center mx-auto mb-4 shadow-sm border border-slate-100">
               <BookOpen className="w-8 h-8 text-slate-300" />
            </div>
            <h3 className="text-xl font-bold text-slate-800 font-bengali mb-2">কোনো বই পড়া হচ্ছে না</h3>
            <p className="text-slate-500 font-medium font-bengali">সময় বৃদ্ধির জন্য আপনার নামে বর্তমানে ইস্যু করা কোনো বই থাকতে হবে।</p>
          </div>
        ) : (
          issues.map(i => {
            const book = books.find(b => b.id === i.bookId);
            const isOverdue = i.expectedReturnDate && new Date() > new Date(i.expectedReturnDate);
            
            return (
               <motion.div 
                 initial={{ opacity: 0, scale: 0.95 }}
                 animate={{ opacity: 1, scale: 1 }}
                 key={i.id} 
                 className={`bg-white p-6 rounded-[2rem] shadow-[0_8px_30px_rgb(0,0,0,0.04)] border ${isOverdue ? 'border-rose-100' : 'border-slate-100'} hover:shadow-lg transition-all`}
               >
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
                        </div>
                        <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-4 flex items-center gap-1.5 font-sans">
                            <BookOpen className="w-3 h-3" /> কোড: {book?.bookCode || 'N/A'}
                        </p>

                        <div className="bg-slate-50 rounded-xl p-4 space-y-3 mb-5 border border-slate-100/50">
                            <div className="flex items-center gap-3 text-sm text-slate-600 font-medium font-bengali">
                                <div className="w-8 h-8 rounded-full bg-white flex items-center justify-center shadow-sm">
                                   <Calendar className="w-4 h-4 text-slate-400" />
                                </div>
                                <div>
                                   <p className="text-[10px] uppercase font-black text-slate-400 tracking-wider font-sans">গ্রহণের তারিখ</p>
                                   <p>{new Date(i.issueDate).toLocaleDateString('bn-BD', { year: 'numeric', month: 'short', day: 'numeric' })}</p>
                                </div>
                            </div>
                            <div className="flex items-center gap-3 text-sm font-medium font-bengali">
                                <div className={`w-8 h-8 rounded-full flex items-center justify-center shadow-sm ${isOverdue ? 'bg-rose-100' : 'bg-white'}`}>
                                   <AlertCircle className={`w-4 h-4 ${isOverdue ? 'text-rose-500' : 'text-amber-500'}`} />
                                </div>
                                <div>
                                   <p className={`text-[10px] uppercase font-black tracking-wider font-sans ${isOverdue ? 'text-rose-400' : 'text-slate-400'}`}>ফেরতের শেষ তারিখ</p>
                                   <p className={isOverdue ? 'text-rose-600 font-bold' : 'text-slate-700'}>
                                      {new Date(i.expectedReturnDate).toLocaleDateString('bn-BD', { year: 'numeric', month: 'short', day: 'numeric' })}
                                      {isOverdue && <span className="ml-2 bg-rose-500 text-white text-[10px] px-2 py-0.5 rounded-full uppercase tracking-widest font-sans">Overdue</span>}
                                   </p>
                                </div>
                            </div>
                        </div>

                        <button 
                          onClick={() => handleExtensionRequest(i, book)}
                          disabled={requestingId === i.id}
                          className="w-full flex items-center justify-center gap-2 py-3.5 bg-orange-600 text-white rounded-xl font-bold font-bengali hover:bg-orange-700 transition-all shadow-lg shadow-orange-900/10 active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                          {requestingId === i.id ? (
                            <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                          ) : (
                            <Clock className="w-4 h-4" />
                          )}
                          সময় বৃদ্ধির আবেদন করুন
                        </button>
                     </div>
                  </div>
               </motion.div>
            );
          })
        )}
      </div>
    </div>
  );
}
