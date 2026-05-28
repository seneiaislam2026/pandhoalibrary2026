import React, { useEffect, useState } from 'react';
import { useAuth } from '../../store/AuthContext';
import { Bell, Plus, Trash2, X, AlertCircle, Info, Send, Printer, Pencil } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { onSnapshot, collection, doc, setDoc, deleteDoc, query, orderBy, serverTimestamp } from 'firebase/firestore';
import { db } from '../../lib/firebase';
import toast from 'react-hot-toast';

interface Notice {
  id: string;
  title: string;
  content: string;
  priority: 'low' | 'medium' | 'high';
  date: string;
}

export default function ManageNotices() {
  const [notices, setNotices] = useState<Notice[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAddModal, setShowAddModal] = useState(false);
  const [formData, setFormData] = useState({ title: '', content: '', priority: 'medium' as 'low' | 'medium' | 'high' });
  const [editingNotice, setEditingNotice] = useState<Notice | null>(null);
  const { user } = useAuth();

  useEffect(() => {
    const fetchData = async () => {
      try {
        const { getDocs, query, collection, orderBy } = await import('firebase/firestore');
        const db = (await import('../../lib/firebase')).db;

        const cacheKey = 'admin_notices_cache';
        const cacheTime = sessionStorage.getItem('admin_notices_time');

        if (cacheTime && (Date.now() - parseInt(cacheTime) < 5 * 60 * 1000)) {
           const cached = sessionStorage.getItem(cacheKey);
           if (cached) {
              setNotices(JSON.parse(cached));
              setLoading(false);
              return;
           }
        }

        const q = query(collection(db, "notices"), orderBy("date", "desc"));
        const snapshot = await getDocs(q);
        const noticeList = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })) as Notice[];
        setNotices(noticeList);
        setLoading(false);

        sessionStorage.setItem(cacheKey, JSON.stringify(noticeList));
        sessionStorage.setItem('admin_notices_time', Date.now().toString());

        if (user?.id) {
          localStorage.setItem(`last_seen_notices_${user.id}`, new Date().toISOString());
          window.dispatchEvent(new Event('notices_seen'));
        }
      } catch (err) {
        console.error("Error fetching notices:", err);
        setLoading(false);
      }
    };

    fetchData();
  }, [user]);

  const [secretary, setSecretary] = useState<{name: string, title: string}>({
    name: 'মোঃ ফয়েজ রাব্বি',
    title: 'লাইব্রেরি সম্পাদক'
  });

  useEffect(() => {
    const fetchTeam = async () => {
      try {
        const { getDocs, query, collection, orderBy } = await import('firebase/firestore');
        const db = (await import('../../lib/firebase')).db;

        const cacheKey = 'admin_team_brief';
        const cached = sessionStorage.getItem(cacheKey);
        if (cached) {
           setSecretary(JSON.parse(cached));
           return;
        }

        const q = query(collection(db, "team"), orderBy("order", "asc"));
        const snapshot = await getDocs(q);
        const members = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })) as any[];
        
        const sec = members.find(m => m.title.includes('সম্পাদক') || m.title.includes('Secretary'));
        if (sec) {
          const secData = { name: sec.name, title: sec.title };
          setSecretary(secData);
          sessionStorage.setItem(cacheKey, JSON.stringify(secData));
        }
      } catch (err) {
        console.error("Error fetching team for notices:", err);
      }
    };

    fetchTeam();
  }, []);

  const handlePrint = (notice: Notice) => {
    const printWindow = window.open('', '_blank');
    if (!printWindow) return;

    const dateStr = new Date(notice.date).toLocaleDateString('bn-BD', {
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    });

    const html = `
      <html>
        <head>
          <title>নোটিশ - ${notice.title}</title>
          
        <link href="https://fonts.googleapis.com/css2?family=Outfit:wght@400;500;600;700&family=Hind+Siliguri:wght@400;500;600;700&display=swap" rel="stylesheet">
                  <style>
            
                        body { 
              font-family: 'Hind Siliguri', sans-serif; 
              color: #1a1a1a;
              margin: 0;
              padding: 0;
              background-color: #f8fafc;
            }
            .pad {
              width: 210mm;
              min-height: 297mm;
              padding: 20mm 20mm;
              margin: 20px auto;
              background: #fffefb; /* Lighter newsprint color */
              position: relative;
              box-sizing: border-box;
              box-shadow: 0 0 20px rgba(0,0,0,0.05);
            }
            .header {
              display: flex;
              align-items: center;
              justify-content: space-between;
              border-bottom: 3px double #1e1b4b;
              padding-bottom: 20px;
              margin-bottom: 40px;
            }
            .form-logo {
              width: 100px;
              height: 100px;
              object-fit: contain;
            }
            .header-text {
              flex: 1;
              text-align: center;
              padding: 0 20px;
            }
            .header-text h1 {
              margin: 0;
              font-size: 36px;
              color: #1e1b4b;
              font-weight: 800;
              font-family: 'Noto Serif Bengali', serif;
              letter-spacing: 0.5px;
            }
            .header-text p {
              margin: 5px 0 0;
              font-size: 18px;
              color: #2d3436;
              font-weight: 600;
            }
            .phone-info {
              font-family: 'Outfit', sans-serif;
              font-size: 15px;
              font-weight: 800;
              margin-top: 5px;
              color: #000;
            }
            .meta {
              display: flex;
              justify-content: space-between;
              margin-bottom: 50px;
              font-weight: 700;
              font-size: 16px;
            }
            .ref { font-family: 'Hind Siliguri', sans-serif; }
            .ref-val { font-family: 'Outfit', sans-serif; font-weight: 700; }

            .content {
              line-height: 1.8;
              font-size: 20px;
              text-align: justify;
              min-height: 450px;
              color: #000;
            }
            .title-box {
              text-align: center;
              margin-bottom: 40px;
            }
            .title {
              display: inline-block;
              font-size: 28px;
              font-weight: 900;
              text-decoration: underline;
              text-underline-offset: 10px;
              color: #000;
            }
            .footer {
              margin-top: 80px;
              display: flex;
              justify-content: flex-start;
            }
            .signature {
              text-align: left;
              width: 300px;
            }
            .sig-label {
              font-size: 16px;
              font-weight: 800;
              color: #000;
              margin-bottom: 60px;
              text-decoration: underline;
            }
            .sig-line {
              border-top: 1.5px solid #000;
              margin-bottom: 8px;
              width: 200px;
            }
            .sig-text {
              font-size: 18px;
              font-weight: 800;
              color: #000;
            }
            .sig-post {
              font-size: 15px;
              font-weight: 700;
              color: #334155;
            }

            @media print {
              .no-print { display: none; }
              body { background: none; }
              .pad { 
                margin: 0; 
                box-shadow: none; 
                -webkit-print-color-adjust: exact;
                print-color-adjust: exact;
              }
            }
          </style>
        </head>
        <body>
          <div class="no-print" style="text-align: center; padding: 20px; background: #fff; border-bottom: 1px solid #e2e8f0;">
            <button onclick="window.print()" style="font-family: 'Hind Siliguri', sans-serif; padding: 12px 30px; background: #4f46e5; color: #fff; border: none; font-size: 16px; font-weight: 700; cursor: pointer; border-radius: 12px; box-shadow: 0 10px 15px -3px rgba(79, 70, 229, 0.4);">সরাসরি প্রিন্ট করুন</button>
          </div>
          <div class="pad">
            <div class="header">
              <img src="https://i.ibb.co/b5B2gv9b/1777771470223.jpg" alt="Logo" class="form-logo" crossorigin="anonymous" referrerpolicy="no-referrer" />
              <div class="header-text">
                <h1>পানধোয়া উন্মুক্ত পাঠাগার</h1>
                <p>পানধোয়া, সেনওয়ালিয়া-১৩৪৪, আশুলিয়া, সাভার, ঢাকা।</p>
                <div class="phone-info">Mobile: 01570206953</div>
              </div>
              <div style="width: 100px;"></div>
            </div>
            
            <div class="meta">
              <div class="ref">সূত্র: <span class="ref-val">PULL/${new Date().getFullYear().toString().replace(/[0-9]/g, w => String.fromCharCode(w.charCodeAt(0) + 2486))}/${notice.id.substring(0, 4).toUpperCase()}</span></div>
              <div>তারিখ: ${dateStr}</div>
            </div>

            <div class="title-box">
              <div class="title">নোটিশ</div>
            </div>

            <div class="content">
              <p style="font-weight: 800; font-size: 22px; margin-bottom: 25px;">${notice.title}</p>
              <p>${notice.content.replace(/\n/g, '<br>')}</p>
            </div>

            <div class="footer">
              <div class="signature">
                <div class="sig-label">বার্তা প্রেরক,</div>
                <div class="sig-line"></div>
                <div class="sig-text">${secretary.name}</div>
                <div class="sig-post">${secretary.title}</div>
                <div class="sig-post" style="font-size: 14px; margin-top: 2px;">পানধোয়া উন্মুক্ত পাঠাগার</div>
              </div>
            </div>
          </div>
        </body>
      </html>
    `;

    printWindow.document.write(html);
    printWindow.document.close();
  };

  const handleAdd = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      if (editingNotice) {
        await setDoc(doc(db, "notices", editingNotice.id), {
          ...formData,
          createdAt: serverTimestamp()
        }, { merge: true });
        toast.success("Notice updated successfully");
      } else {
        const newDocRef = doc(collection(db, "notices"));
        await setDoc(newDocRef, {
          ...formData,
          id: newDocRef.id,
          date: new Date().toISOString(),
          createdAt: serverTimestamp()
        });
        toast.success("Notice posted successfully");
      }
      setShowAddModal(false);
      setFormData({ title: '', content: '', priority: 'medium' });
      setEditingNotice(null);
    } catch (err) {
      console.error("Error saving notice:", err);
      toast.error("Failed to save notice");
    }
  };

  const handleEdit = (notice: Notice) => {
    setEditingNotice(notice);
    setFormData({
      title: notice.title,
      content: notice.content,
      priority: notice.priority
    });
    setShowAddModal(true);
  };

  const handleDelete = async (id: string) => {
    if (!confirm("আপনি কি নিশ্চিত যে আপনি এই নোটিশটি ডিলিট করতে চান?")) return;
    try {
      await deleteDoc(doc(db, "notices", id));
    } catch (err) {
      console.error("Error deleting notice:", err);
      toast.error("Failed to delete notice");
    }
  };

  return (
    <div className="space-y-6 pb-20">
      <div className="flex justify-between items-center bg-white p-6 rounded-2xl shadow-sm border border-slate-100">
        <div>
          <h2 className="text-2xl font-bold text-slate-800 tracking-tight font-bengali">নোটিশ ব্যবস্থাপনা</h2>
          <p className="text-slate-500 text-sm font-bengali">লাইব্রেরি সদস্যদের জন্য নোটিশ প্রকাশ এবং পরিচালনা করুন।</p>
        </div>
        <button 
          onClick={() => setShowAddModal(true)}
          className="flex items-center gap-2 bg-indigo-600 text-white px-5 py-2.5 rounded-xl font-bold hover:bg-indigo-700 transition shadow-lg shadow-indigo-100 font-bengali"
        >
          <Plus className="w-5 h-5" />
          নোটিশ প্রকাশ
        </button>
      </div>

      <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-100 flex flex-wrap items-center gap-6">
        <div className="flex-1 min-w-[200px]">
          <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1 font-bengali">বার্তা প্রেরক (এডিট করা যাবে)</label>
          <div className="flex gap-2">
            <input 
              type="text" 
              value={secretary.name} 
              onChange={e => setSecretary({...secretary, name: e.target.value})}
              className="px-3 py-1.5 bg-slate-50 border border-slate-100 rounded-lg text-sm font-bold font-bengali w-full"
              placeholder="নাম"
            />
            <input 
              type="text" 
              value={secretary.title} 
              onChange={e => setSecretary({...secretary, title: e.target.value})}
              className="px-3 py-1.5 bg-slate-50 border border-slate-100 rounded-lg text-sm font-bold font-bengali w-full"
              placeholder="পদবী"
            />
          </div>
        </div>
      </div>

      <div className="grid gap-4">
        {loading ? (
          <div className="p-20 text-center text-slate-400 font-bengali">নোটিশ লোড হচ্ছে...</div>
        ) : notices.length === 0 ? (
          <div className="bg-white p-16 rounded-2xl border border-dashed border-slate-200 text-center space-y-4">
            <div className="w-16 h-16 bg-slate-50 rounded-full flex items-center justify-center mx-auto">
              <Bell className="w-8 h-8 text-slate-300" />
            </div>
            <p className="text-slate-400 font-medium tracking-tight font-bengali">এখনও কোনো নোটিশ পোস্ট করা হয়নি।</p>
          </div>
        ) : (
          notices.map((notice) => (
            <motion.div 
              layout
              key={notice.id} 
              className="bg-white p-6 rounded-2xl shadow-sm border border-slate-100 group hover:border-indigo-200 transition relative"
            >
              <div className="flex items-start gap-4">
                <div className={`p-3 rounded-xl ${
                  notice.priority === 'high' ? 'bg-rose-100 text-rose-600' : 
                  notice.priority === 'medium' ? 'bg-amber-100 text-amber-600' : 'bg-emerald-100 text-emerald-600'
                }`}>
                  {notice.priority === 'high' ? <AlertCircle className="w-6 h-6" /> : <Info className="w-6 h-6" />}
                </div>
                <div className="flex-1">
                  <div className="flex justify-between items-start">
                    <div>
                      <h3 className="font-bold text-slate-900 text-lg leading-tight mb-1">{notice.title}</h3>
                      <p className="text-xs font-bold font-mono text-slate-400 uppercase">
                        {new Date(notice.date).toLocaleDateString(undefined, { dateStyle: 'long' })}
                      </p>
                    </div>
                    <div className="flex flex-wrap gap-2 mt-2 sm:mt-0">
                      <button 
                        onClick={() => handlePrint(notice)}
                        className="flex items-center gap-1.5 px-3 py-1.5 bg-indigo-50 text-indigo-700 rounded-lg font-bold text-xs hover:bg-indigo-100 transition shadow-sm border border-indigo-100 font-bengali"
                        title="প্রিন্ট করুন"
                      >
                        <Printer className="w-3.5 h-3.5" />
                        প্রিন্ট
                      </button>
                      <button 
                        onClick={() => handleEdit(notice)}
                        className="flex items-center gap-1.5 px-3 py-1.5 bg-amber-50 text-amber-700 rounded-lg font-bold text-xs hover:bg-amber-100 transition shadow-sm border border-amber-100 font-bengali"
                        title="ইডিট করুন"
                      >
                        <Pencil className="w-3.5 h-3.5" />
                        ইডিট
                      </button>
                      <button 
                        onClick={() => handleDelete(notice.id)}
                        className="flex items-center gap-1.5 px-3 py-1.5 bg-rose-50 text-rose-700 rounded-lg font-bold text-xs hover:bg-rose-100 transition shadow-sm border border-rose-100 font-bengali"
                        title="ডিলিট করুন"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                        ডিলিট
                      </button>
                    </div>
                  </div>
                  <p className="mt-4 text-slate-600 leading-relaxed whitespace-pre-wrap">{notice.content}</p>
                </div>
              </div>
            </motion.div>
          ))
        )}
      </div>

      <AnimatePresence>
        {showAddModal && (
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
                  {editingNotice ? 'নোটিশ ইডিট করুন' : 'নতুন নোটিশ পোস্ট করুন'}
                </h3>
                <button onClick={() => {
                  setShowAddModal(false);
                  setEditingNotice(null);
                  setFormData({ title: '', content: '', priority: 'medium' });
                }} className="p-2 hover:bg-white/10 rounded-xl transition">
                  <X className="w-6 h-6" />
                </button>
              </div>
              <form onSubmit={handleAdd} className="p-8 space-y-6">
                <div>
                  <label className="block text-sm font-black text-slate-400 uppercase tracking-widest mb-2 font-bengali">শিরোনাম</label>
                  <input
                    required
                    type="text"
                    value={formData.title || ''}
                    onChange={e => setFormData({ ...formData, title: e.target.value })}
                    className="w-full bg-slate-50 border border-slate-100 rounded-xl px-4 py-3 focus:ring-2 focus:ring-indigo-500 transition font-medium font-bengali"
                    placeholder="নোটিশের শিরোনাম"
                  />
                </div>
                <div>
                  <label className="block text-sm font-black text-slate-400 uppercase tracking-widest mb-2 font-bengali">গুরুত্ব</label>
                  <select
                    value={formData.priority || 'medium'}
                    onChange={e => setFormData({ ...formData, priority: e.target.value as any })}
                    className="w-full bg-slate-50 border border-slate-100 rounded-xl px-4 py-3 focus:ring-2 focus:ring-indigo-500 transition font-medium font-bengali"
                  >
                    <option value="low">কম গুরুত্ব (সবুজ)</option>
                    <option value="medium">মাঝারি গুরুত্ব (অ্যাম্বার)</option>
                    <option value="high">বেশি গুরুত্ব (লাল)</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-black text-slate-400 uppercase tracking-widest mb-2 font-bengali">নোটিশের বিস্তারিত</label>
                  <textarea
                    required
                    value={formData.content || ''}
                    onChange={e => setFormData({ ...formData, content: e.target.value })}
                    className="w-full bg-slate-50 border border-slate-100 rounded-xl px-4 py-3 focus:ring-2 focus:ring-indigo-500 transition h-32 resize-none font-medium text-sm leading-relaxed font-bengali"
                    placeholder="নোটিশের বিস্তারিত লিখুন..."
                  />
                </div>
                <button 
                  type="submit" 
                  className="w-full bg-indigo-600 text-white py-4 rounded-xl font-black uppercase tracking-widest hover:bg-indigo-700 transition shadow-lg shadow-indigo-100 font-bengali"
                >
                  {editingNotice ? 'আপডেট করুন' : 'নোটিশ প্রকাশ করুন'}
                </button>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
