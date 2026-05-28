import React, { useEffect, useState } from 'react';
import { useAuth } from '../../store/AuthContext';
import { BookOpen, Send, Clock, CheckCircle, Trash2, Library, BookHeart, XCircle, CheckCircle2, Download } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { onSnapshot, collection, doc, setDoc, deleteDoc, updateDoc, addDoc, serverTimestamp, getDoc, query, where } from 'firebase/firestore';
import { db } from '../../lib/firebase';
import toast from 'react-hot-toast';
import { sendSMS } from '../../lib/sms';

interface BookRequest {
  id: string;
  userId: string;
  userName: string;
  bookTitle: string;
  authorName: string;
  status: string;
  date: string;
}

export default function BookRequests() {
  const [requests, setRequests] = useState<BookRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [formData, setFormData] = useState({ bookTitle: '', authorName: '' });
  const [usersMap, setUsersMap] = useState<Record<string, string>>({});
  const { user } = useAuth();
  const isAdmin = user?.role === 'admin' || user?.role === 'subadmin' || user?.role === 'visitor_admin';

  useEffect(() => {
    if (!user) return;
    
    let q;
    if (isAdmin) {
      q = collection(db, "book-requests");
      
      // Fetch users for phone number mapping
      const unsubUsers = onSnapshot(collection(db, "users"), (snapshot) => {
         const umap: Record<string, string> = {};
         snapshot.forEach(doc => {
            const data = doc.data();
            if (data.phone) umap[doc.id] = data.phone;
         });
         setUsersMap(umap);
      });
      
      const unsub = onSnapshot(q, (snapshot) => {
        setRequests(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })) as BookRequest[]);
        setLoading(false);
      }, (error) => {
        console.error("BookRequests snapshot error:", error);
        setLoading(false);
      });
      return () => {
         unsub();
         unsubUsers();
      };
    } else {
      q = query(collection(db, "book-requests"), where("userId", "==", user.id));
      const unsub = onSnapshot(q, (snapshot) => {
        setRequests(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })) as BookRequest[]);
        setLoading(false);
      }, (error) => {
        console.error("BookRequests snapshot error:", error);
        setLoading(false);
      });
      return () => unsub();
    }
  }, [user, isAdmin]);

  const handleRequest = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const newDocRef = doc(collection(db, "book-requests"));
      await setDoc(newDocRef, {
        ...formData,
        id: newDocRef.id,
        userId: user?.id,
        userName: user?.name,
        status: 'Pending',
        date: new Date().toISOString(),
        createdAt: serverTimestamp()
      });
      setFormData({ bookTitle: '', authorName: '' });
      toast.success('বইয়ের রিকোয়েস্ট সফলভাবে পাঠানো হয়েছে!');
    } catch (err) {
      console.error("Error submitting request:", err);
      toast.error("রিকোয়েস্ট পাঠাতে সমস্যা হয়েছে");
    }
  };

  const deleteRequest = async (id: string) => {
    if (!confirm("আপনি কি নিশ্চিত যে এই রিকোয়েস্টটি ডিলিট করতে চান?")) return;
    try {
      await deleteDoc(doc(db, "book-requests", id));
    } catch (err) {
      console.error("Error deleting request:", err);
      toast.error("ডিলিট করতে সমস্যা হয়েছে");
    }
  };

  const handleUpdateStatus = async (req: BookRequest, status: 'Approved' | 'Rejected' | 'Added') => {
    if (!confirm(`আপনি কি এই রিকোয়েস্টটি ${status === 'Approved' ? 'অনুমোদন' : status === 'Added' ? 'যুক্ত সম্পন্ন' : 'বাতিল'} করতে চান?`)) return;
    try {
        await updateDoc(doc(db, "book-requests", req.id), { status });
        toast.success(`স্ট্যাটাস ${status === 'Added' ? 'সম্পন্ন' : status === 'Approved' ? 'গৃহীত' : 'বাতিল'} করা হয়েছে।`);
    } catch (err) {
        console.error("Error updating request:", err);
        toast.error("স্ট্যাটাস আপডেট করতে সমস্যা হয়েছে");
    }
  };

  const handleDownloadPDF = () => {
    const printWindow = window.open('', '_blank');
    if (!printWindow) return;

    const today = new Date().toLocaleDateString('bn-BD', {
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    });

    const sortedRequests = [...requests].sort((a,b) => new Date(b.date).getTime() - new Date(a.date).getTime());

    const html = `
      <html>
        <head>
          <title>বইয়ের রিকোয়েস্ট রিপোর্ট</title>
          <style>
            
            @import url('https://fonts.googleapis.com/css2?family=Outfit:wght@400;500;600;700&family=Hind+Siliguri:wght@400;500;600;700&display=swap');
                        body { 
              font-family: 'Hind Siliguri', sans-serif; 
              color: #1a1a1a;
              margin: 0;
              padding: 15mm;
              background-color: #fff;
            }
            .header {
              text-align: center;
              margin-bottom: 30px;
              border-bottom: 2px solid #000;
              padding-bottom: 15px;
            }
            .header h1 {
              color: #000;
              margin: 0;
              font-size: 36px;
              font-weight: 800;
              letter-spacing: -1px;
            }
            .header .address {
              margin: 8px 0 3px;
              font-size: 16px;
              font-weight: 600;
              color: #334155;
            }
            .header .contact {
              font-family: 'Hind Siliguri', sans-serif;
              font-size: 16px;
              font-weight: 700;
              color: #000;
              margin-top: 5px;
            }
            .contact-val {
              font-family: 'Outfit', sans-serif;
              font-weight: 800;
              margin-left: 4px;
            }
            .report-title {
              text-align: center;
              margin: 25px 0;
              font-size: 22px;
              font-weight: 800;
              text-decoration: underline;
              text-underline-offset: 8px;
            }
            .date-info {
              text-align: right;
              margin-bottom: 15px;
              font-size: 14px;
              color: #000;
              font-weight: 700;
            }
            table {
              width: 100%;
              border-collapse: collapse;
              margin-top: 10px;
            }
            th, td {
              padding: 12px 15px;
              text-align: left;
              border: 1px solid #000;
            }
            th {
              background-color: #f8fafc;
              font-weight: 800;
              color: #000;
              text-transform: uppercase;
              font-size: 15px;
              text-align: center;
            }
            td {
              font-size: 16px;
              font-weight: 600;
              color: #000;
            }
            .sl-col { 
              width: 100px; 
              text-align: center; 
              font-weight: 800;
              font-size: 18px;
            }
            @media print {
              body { padding: 0mm; }
              .no-print { display: none; }
            }
          </style>
        </head>
        <body>
          <div class="no-print" style="text-align: center; padding: 20px; background: #fff; border-bottom: 1px solid #e2e8f0; margin-bottom: 30px;">
            <button onclick="window.print()" style="font-family: 'Hind Siliguri', sans-serif; padding: 12px 30px; background: #4f46e5; color: #fff; border: none; font-size: 16px; font-weight: 700; cursor: pointer; border-radius: 12px; box-shadow: 0 4px 6px -1px rgba(79, 70, 229, 0.4);">প্রিন্ট / ডাউনলোড করুন</button>
          </div>
          
          <div class="header">
            <h1>পানধোয়া উন্মুক্ত পাঠাগার</h1>
            <div class="address">পানধোয়া, সেনওয়ালিয়া-<span style="font-family: 'Outfit', sans-serif; font-weight: 800;">1344</span>, আশুলিয়া, সাভার, ঢাকা।</div>
            <div class="contact">
              যোগাযোগ: <span class="contact-val">01570206953</span>
            </div>
          </div>

          <div class="report-title">বইয়ের রিকোয়েস্ট রিপোর্ট</div>
          <div class="date-info">রিপোর্ট তারিখ: ${today}</div>

          <table>
            <thead>
              <tr>
                <th class="sl-col">ক্রমিক নং</th>
                <th>বইয়ের নাম</th>
                <th>লেখক</th>
              </tr>
            </thead>
            <tbody>
              ${sortedRequests.map((req, index) => `
                <tr>
                  <td class="sl-col">${(index + 1).toString().replace(/[0-9]/g, w => String.fromCharCode(w.charCodeAt(0) + 2486))}</td>
                  <td>${req.bookTitle}</td>
                  <td>${req.authorName || '---'}</td>
                </tr>
              `).join('')}
            </tbody>
          </table>

          <div style="margin-top: 120px; display: flex; justify-content: flex-end; padding-right: 20px;">
            <div style="text-align: center; width: 220px;">
              <div style="border-top: 2.5px solid #000; padding-top: 10px; font-weight: 950; font-size: 18px;">পরিচালকের স্বাক্ষর</div>
            </div>
          </div>
        </body>
      </html>
    `;

    printWindow.document.write(html);
    printWindow.document.close();
  };

  return (
    <div className="max-w-5xl mx-auto space-y-8 pb-20">
      <div className="bg-slate-900 text-white p-8 sm:p-12 rounded-[2.5rem] shadow-2xl relative overflow-hidden group">
          <div className="absolute right-0 top-0 w-64 h-64 bg-indigo-500/20 rounded-full blur-[60px] translate-x-10 -translate-y-10 group-hover:scale-110 transition-transform duration-700 pointer-events-none" />
          <div className="absolute left-0 bottom-0 w-64 h-64 bg-emerald-500/20 rounded-full blur-[60px] -translate-x-10 translate-y-10 group-hover:scale-110 transition-transform duration-700 pointer-events-none" />
          
          <div className="relative z-10 flex flex-col md:flex-row md:items-end md:justify-between gap-8">
              <div className="space-y-5">
                  <div className="w-14 h-14 bg-white/10 backdrop-blur-md rounded-2xl flex items-center justify-center text-indigo-300 shadow-inner border border-white/10">
                    <BookOpen className="w-7 h-7" />
                  </div>
                  <div>
                    <h2 className="text-3xl md:text-4xl font-black tracking-tight font-bengali text-white mb-3">বইয়ের রিকোয়েস্ট বোর্ড</h2>
                    <p className="text-slate-300 max-w-lg font-medium font-bengali text-sm md:text-base leading-relaxed">
                      আমাদের পাঠাগারে কোন বইটি দেখতে চান? রিকোয়েস্ট করুন, আমরা খুব শীঘ্রই সংগ্রহ করার চেষ্টা করব ইনশাআল্লাহ।
                    </p>
                  </div>
              </div>
              
              {isAdmin && (
                <button 
                  onClick={handleDownloadPDF}
                  className="bg-white/10 hover:bg-white/20 backdrop-blur-md text-white px-6 py-3 rounded-xl border border-white/20 font-bold text-sm flex items-center justify-center gap-2 transition whitespace-nowrap self-start md:self-auto"
                >
                  <Download className="w-4 h-4 text-indigo-300" /> ডাউনলোড রিপোর্ট
                </button>
              )}
          </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        <div className="lg:col-span-1">
          <div className="bg-white p-8 rounded-[2rem] border border-slate-100 shadow-[0_8px_30px_rgb(0,0,0,0.04)] sticky top-8">
            <h3 className="text-xl font-black text-slate-800 mb-2 font-bengali">নতুন রিকোয়েস্ট</h3>
            <p className="text-xs text-slate-500 font-medium mb-6 font-bengali leading-relaxed">আপনি যে বইটি পাঠাগারে দেখতে চান তার নাম লিখুন।</p>
            <form onSubmit={handleRequest} className="space-y-5">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-2 font-bengali">বইয়ের নাম (Book Title) <span className="text-rose-500">*</span></label>
                <input 
                    type="text" 
                    required 
                    value={formData.bookTitle || ''} 
                    onChange={e => setFormData({...formData, bookTitle: e.target.value})} 
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 focus:bg-white focus:ring-2 focus:ring-indigo-500 transition font-medium outline-none text-slate-800" 
                    placeholder="যেমন: প্যারাডক্সিক্যাল সাজিদ"
                />
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-2 font-bengali">লেখকের নাম (Author - Optional)</label>
                <input 
                    type="text" 
                    value={formData.authorName || ''} 
                    onChange={e => setFormData({...formData, authorName: e.target.value})} 
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 focus:bg-white focus:ring-2 focus:ring-indigo-500 transition font-medium outline-none text-slate-800" 
                    placeholder="যেমন: আরিফ আজাদ"
                />
              </div>
              <button 
                  type="submit" 
                  className="w-full bg-slate-900 text-white font-bold py-4 rounded-xl hover:bg-black transition shadow-lg shadow-slate-900/20 flex items-center justify-center gap-2 font-bengali mt-2"
              >
                <Send className="w-4 h-4" /> রিকোয়েস্ট পাঠান
              </button>
            </form>
          </div>
        </div>

        <div className="lg:col-span-2 space-y-4">
           {loading ? (
               <div className="p-20 text-center text-slate-300">Loading requests...</div>
           ) : requests.length === 0 ? (
               <div className="bg-slate-50/50 p-12 sm:p-20 rounded-[2.5rem] border border-slate-100 text-center flex flex-col items-center justify-center min-h-[400px] relative overflow-hidden shadow-sm">
                   <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-64 h-64 bg-indigo-100/50 rounded-full blur-[80px]" />
                   <div className="relative z-10 w-24 h-24 bg-white shadow-xl shadow-indigo-100/50 rounded-full flex items-center justify-center mb-6">
                       <BookHeart className="w-10 h-10 text-indigo-500" />
                   </div>
                   <h3 className="text-2xl font-black text-slate-800 mb-3 font-bengali relative z-10">কোনো রিকোয়েস্ট নেই</h3>
                   <p className="text-slate-500 font-medium font-bengali max-w-sm relative z-10 text-sm leading-relaxed">
                       আপনি কোন বই পড়তে চান? আমাদের জানান। আমরা খুব শীঘ্রই সেটি সংগ্রহ করার চেষ্টা করব।
                   </p>
               </div>
           ) : (
               requests.sort((a,b) => new Date(b.date).getTime() - new Date(a.date).getTime()).map(req => (
                   <motion.div 
                        layout 
                        key={req.id} 
                        className="bg-white p-5 sm:p-6 rounded-2xl border border-slate-100 shadow-sm flex flex-col sm:flex-row sm:items-center justify-between gap-4 group hover:border-indigo-200 transition"
                   >
                        <div className="flex items-center gap-4">
                            <div className="w-12 h-12 bg-indigo-50 text-indigo-600 rounded-xl flex items-center justify-center">
                                <Library className="w-6 h-6" />
                            </div>
                            <div>
                                <h4 className="font-bold text-slate-900 text-lg">{req.bookTitle}</h4>
                                <p className="text-sm text-slate-500 font-medium font-bengali">লেখক: {req.authorName || 'অজানা'}</p>
                                <div className="flex items-center gap-2 mt-2">
                                    <span className="text-[10px] bg-slate-100 text-slate-500 px-2 py-1 rounded-md font-bold uppercase tracking-tighter">{new Date(req.date).toLocaleDateString()}</span>
                                    {isAdmin && (
                                        <span className="text-[10px] bg-indigo-50 text-indigo-600 px-2 py-1 rounded-md font-black uppercase">By: {req.userName}</span>
                                    )}
                                </div>
                            </div>
                        </div>
                        <div className="flex items-center gap-3">
                            <span className={`px-3 py-1.5 rounded-lg text-[10px] font-black uppercase tracking-widest ${
                                req.status === 'Added' ? 'bg-indigo-100 text-indigo-700 border border-indigo-200/50' : 
                                req.status === 'Approved' ? 'bg-emerald-100 text-emerald-700 border border-emerald-200/50' : 
                                req.status === 'Rejected' ? 'bg-rose-100 text-rose-700 border border-rose-200/50' :
                                'bg-amber-100 text-amber-700 border border-amber-200/50 animate-pulse'
                            }`}>
                                {req.status === 'Pending' ? 'অপেক্ষমান' : 
                                 req.status === 'Approved' ? 'গৃহীত (যুক্ত হবে)' : 
                                 req.status === 'Added' ? 'সংগৃহীত' : 
                                 req.status === 'Rejected' ? 'বাতিল' : req.status}
                            </span>
                            
                            {isAdmin && req.status === 'Pending' && (
                                <div className="flex items-center gap-1 border-l border-slate-100 pl-3">
                                    <button 
                                        onClick={() => handleUpdateStatus(req, 'Approved')}
                                        className="p-2 text-emerald-500 hover:text-emerald-700 hover:bg-emerald-50 rounded-lg transition"
                                        title="অনুমোদন করুন ও মেসেজ পাঠান"
                                    >
                                        <CheckCircle2 className="w-5 h-5" />
                                    </button>
                                    <button 
                                        onClick={() => handleUpdateStatus(req, 'Rejected')}
                                        className="p-2 text-amber-500 hover:text-amber-700 hover:bg-amber-50 rounded-lg transition"
                                        title="বাতিল করুন ও মেসেজ পাঠান"
                                    >
                                        <XCircle className="w-5 h-5" />
                                    </button>
                                </div>
                            )}

                            {isAdmin && req.status === 'Approved' && (
                                <div className="flex items-center gap-1 border-l border-slate-100 pl-3">
                                    <button 
                                        onClick={() => handleUpdateStatus(req, 'Added')}
                                        className="p-2 text-blue-500 hover:text-blue-700 hover:bg-blue-50 rounded-lg transition"
                                        title="বইটি যুক্ত হয়েছে মার্ক করুন"
                                    >
                                        <BookOpen className="w-5 h-5" />
                                    </button>
                                </div>
                            )}

                            {(isAdmin || req.status === 'Pending') && (
                                <button 
                                    onClick={() => deleteRequest(req.id)}
                                    className={`p-2 text-rose-300 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition ${isAdmin && req.status === 'Pending' ? 'ml-1' : 'border-l border-slate-100 pl-3'}`}
                                    title="ডিলিট করুন"
                                >
                                    <Trash2 className="w-4 h-4" />
                                </button>
                            )}

                            {isAdmin && usersMap[req.userId] && (
                                <div className="flex items-center gap-1 border-l border-slate-100 pl-3">
                                   <button 
                                      onClick={() => { window.location.href = `tel:${usersMap[req.userId]}`; }}
                                      className="flex items-center gap-1 p-2 text-blue-500 hover:text-blue-700 hover:bg-blue-50 rounded-lg transition"
                                      title="ফোন করুন"
                                   >
                                      <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z"/></svg>
                                   </button>
                                   <button 
                                      onClick={() => {
                                        const iframe = document.createElement('iframe');
                                        iframe.style.display = 'none';
                                        iframe.src = `sip:${usersMap[req.userId]}`;
                                        document.body.appendChild(iframe);
                                        setTimeout(() => document.body.removeChild(iframe), 2000);
                                      }}
                                      className="flex items-center gap-1 p-2 text-emerald-500 hover:text-emerald-700 hover:bg-emerald-50 rounded-lg transition"
                                      title="Zoiper কল"
                                   >
                                      <span className="font-bold text-xs uppercase tracking-tight">Zoiper</span>
                                   </button>
                                </div>
                            )}
                        </div>
                   </motion.div>
               ))
           )}
        </div>
      </div>
    </div>
  );
}
