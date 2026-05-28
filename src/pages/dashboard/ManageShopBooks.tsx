import React, { useEffect, useState } from 'react';
import { useAuth } from '../../store/AuthContext';
import { Search, Plus, Edit2, Trash2, BookOpen, ShoppingBag } from 'lucide-react';
import { onSnapshot, collection, doc, setDoc, deleteDoc, updateDoc, serverTimestamp } from 'firebase/firestore';
import { db } from '../../lib/firebase';
import toast from 'react-hot-toast';

interface ShopBook {
  id: string;
  title: string;
  author: string;
  price: number;
  cover: string;
  category: string;
  stock: number;
  isPreOrderAvailable?: boolean;
  description?: string;
}

export default function ManageShopBooks() {
  const [books, setBooks] = useState<ShopBook[]>([]);
  const [search, setSearch] = useState('');
  const { user } = useAuth();
  
  const [showModal, setShowModal] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [formData, setFormData] = useState({ 
    title: '', 
    author: '', 
    price: 0, 
    cover: '', 
    category: '', 
    stock: 0,
    isPreOrderAvailable: false,
    description: ''
  });
  const [coverInputType, setCoverInputType] = useState<'upload' | 'link'>('upload');

  useEffect(() => {
    const unsubscribe = onSnapshot(collection(db, 'shop-books'), (snapshot) => {
      setBooks(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data(), cover: doc.data().cover || doc.data().imageUrl })) as ShopBook[]);
    });
    return () => unsubscribe();
  }, []);

  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isSubmitting) return;
    setIsSubmitting(true);
    try {
      if (editingId) {
        await updateDoc(doc(db, 'shop-books', editingId), { ...formData, updatedAt: serverTimestamp() });
        toast.success('বই আপডেট করা হয়েছে');
      } else {
        const newDocRef = doc(collection(db, 'shop-books'));
        await setDoc(newDocRef, { ...formData, id: newDocRef.id, createdAt: serverTimestamp() });
        toast.success('নতুন বই যোগ করা হয়েছে');
      }
      setShowModal(false);
      setFormData({ title: '', author: '', price: 0, cover: '', category: '', stock: 0, isPreOrderAvailable: false, description: '' });
      setEditingId(null);
    } catch (err: any) {
      toast.error('সেভ করতে ব্যর্থ হয়েছে: ' + err.message);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Are you sure?')) return;
    try {
      await deleteDoc(doc(db, 'shop-books', id));
      toast.success('ডিলিট করা হয়েছে');
    } catch (err: any) {
      toast.error('ডিলিট করতে ব্যর্থ হয়েছে');
    }
  };

  const filtered = books.filter(b => b.title.toLowerCase().includes(search.toLowerCase()) || b.author.toLowerCase().includes(search.toLowerCase()));

  return (
    <div className="space-y-8 font-bengali">
       <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        <div className="lg:col-span-8 bg-rose-900 rounded-[2.5rem] p-8 sm:p-10 text-white relative overflow-hidden flex flex-col justify-between shadow-2xl">
          <div className="absolute top-0 right-0 w-64 h-64 bg-white/5 rounded-full blur-[100px] -mr-32 -mt-32"></div>
          
          <div className="relative z-10 flex flex-col xl:flex-row xl:items-start justify-between gap-6">
            <div>
              <h2 className="text-4xl font-black tracking-tighter mb-2">শপ <span className="text-rose-400">ব্যবস্থাপনা</span></h2>
              <p className="text-rose-200 font-bold">বিক্রয়ের জন্য বইয়ের তালিকা পরিচালনা করুন।</p>
            </div>
            <button
              onClick={() => { setFormData({ title: '', author: '', price: 0, cover: '', category: '', stock: 0, isPreOrderAvailable: false, description: '' }); setEditingId(null); setShowModal(true); }}
              className="bg-white text-rose-900 px-8 py-4 rounded-2xl font-black text-sm flex items-center justify-center gap-2 shadow-xl transition-all active:scale-95 hover:bg-rose-50"
            >
              <Plus className="w-5 h-5" /> 
              নতুন শপ বুক 
            </button>
          </div>

          <div className="relative z-10 grid grid-cols-2 lg:grid-cols-4 gap-4 mt-10">
            <div className="bg-white/5 backdrop-blur-md border border-white/10 rounded-2xl p-4">
              <p className="text-[10px] font-black text-rose-200 uppercase tracking-widest mb-1">প্রি-অর্ডার আইটেম</p>
              <p className="text-2xl font-black">{books.filter(b => b.isPreOrderAvailable).length}</p>
            </div>
            <div className="bg-white/5 backdrop-blur-md border border-white/10 rounded-2xl p-4">
              <p className="text-[10px] font-black text-rose-200 uppercase tracking-widest mb-1">মোট আইটেম</p>
              <p className="text-2xl font-black">{books.length}</p>
            </div>
          </div>
        </div>

        <div className="lg:col-span-4 bg-white rounded-[2.5rem] p-8 border border-slate-100 shadow-xl flex flex-col justify-between">
           <div className="flex items-center gap-3 mb-6">
              <div className="p-3 bg-rose-50 text-rose-600 rounded-2xl">
                <Search className="w-5 h-5" />
              </div>
              <h3 className="font-black text-lg text-slate-800">খুঁজুন</h3>
            </div>
            <input
              type="text"
              placeholder="বই বা লেখক দিয়ে খুঁজুন..."
              value={search}
              onChange={e => setSearch(e.target.value)}
              className="w-full bg-slate-50 border border-slate-200 px-5 py-4 rounded-2xl text-sm focus:outline-none focus:ring-2 focus:ring-rose-500 font-bold"
            />
        </div>
      </div>

      <div className="bg-white border border-slate-200 shadow-sm rounded-3xl overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left min-w-[700px] lg:min-w-full">
          <thead>
            <tr className="bg-slate-50 border-b border-slate-100">
              <th className="p-6 text-xs font-black text-slate-400 uppercase">বই</th>
              <th className="p-6 text-xs font-black text-slate-400 uppercase text-center">ক্যাটাগরি</th>
              <th className="p-6 text-xs font-black text-slate-400 uppercase text-center">মূল্য</th>
              <th className="p-6 text-xs font-black text-slate-400 uppercase text-center">স্টক</th>
              <th className="p-6 text-xs font-black text-slate-400 uppercase text-right">অ্যাকশন</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {filtered.map(book => (
              <tr key={book.id} className="hover:bg-slate-50/50 transition">
                <td className="p-6">
                  <div className="flex gap-4 items-center">
                    <div className="w-12 h-16 bg-slate-100 rounded-lg overflow-hidden border border-slate-200 shadow-sm flex-shrink-0 p-1">
                      {book.cover ? <img src={book.cover} referrerPolicy="no-referrer" className="w-full h-full object-contain" /> : <BookOpen className="w-6 h-6 m-auto mt-5 text-slate-300" />}
                    </div>
                    <div>
                      <div className="font-black text-slate-900 leading-tight">{book.title}</div>
                      <div className="text-xs text-slate-500 font-bold">{book.author}</div>
                    </div>
                  </div>
                </td>
                <td className="p-6 text-center font-bold text-slate-600">{book.category}</td>
                <td className="p-6 text-center font-black text-rose-600">৳{book.price}</td>
                <td className="p-6 text-center">
                  <div className="flex flex-col items-center gap-1">
                    <span className={`px-3 py-1 rounded-full text-[10px] font-black ${book.stock > 5 ? 'bg-emerald-50 text-emerald-600' : 'bg-rose-50 text-rose-600'}`}>
                      {book.stock} টি
                    </span>
                    {book.isPreOrderAvailable && (
                      <span className="text-[8px] font-black px-1.5 py-0.5 bg-indigo-50 text-indigo-600 rounded-md">প্রি-অর্ডার</span>
                    )}
                  </div>
                </td>
                <td className="p-6">
                  <div className="flex gap-2 justify-end">
                    <button onClick={() => { setEditingId(book.id); setFormData({ ...book, description: book.description || '', isPreOrderAvailable: book.isPreOrderAvailable || false}); setShowModal(true); }} className="p-2 text-indigo-600 bg-indigo-50 rounded-xl hover:bg-indigo-100 transition"><Edit2 className="w-4 h-4"/></button>
                    <button onClick={() => handleDelete(book.id)} className="p-2 text-rose-600 bg-rose-50 rounded-xl hover:bg-rose-100 transition"><Trash2 className="w-4 h-4"/></button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        </div>
      </div>

      {showModal && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-sm flex items-start justify-center p-4 overflow-y-auto">
          <div className="bg-white rounded-[2rem] sm:rounded-[3rem] w-full max-w-2xl shadow-2xl my-4 sm:my-8 overflow-hidden sticky top-4">
            <div className="sticky top-0 bg-white z-10 px-6 sm:px-12 py-6 border-b border-slate-100">
              <h3 className="text-2xl sm:text-3xl font-black text-slate-800 flex items-center gap-3">
                <ShoppingBag className="w-7 h-7 sm:w-8 sm:h-8 text-rose-500" />
                {editingId ? 'বই এডিট করুন' : 'নতুন বই যোগ করুন'}
              </h3>
            </div>
            
            <form onSubmit={handleSubmit} className="p-6 sm:p-12 pt-4 sm:pt-6 space-y-5 sm:space-y-6">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-5 sm:gap-6">
                <div>
                  <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2">বইয়ের নাম</label>
                  <input type="text" required value={formData.title || ''} onChange={e=>setFormData({...formData, title: e.target.value})} className="w-full bg-slate-50 border-2 border-slate-100 p-3.5 sm:p-4 rounded-2xl focus:border-rose-500 outline-none font-bold shadow-inner" placeholder="বইয়ের নাম" />
                </div>
                <div>
                  <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2">লেখকের নাম</label>
                  <input type="text" required value={formData.author || ''} onChange={e=>setFormData({...formData, author: e.target.value})} className="w-full bg-slate-50 border-2 border-slate-100 p-3.5 sm:p-4 rounded-2xl focus:border-rose-500 outline-none font-bold shadow-inner" placeholder="লেখকের নাম" />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
                <div>
                  <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2">মূল্য (৳)</label>
                  <input type="number" required value={formData.price ?? ''} onChange={e=>setFormData({...formData, price: Number(e.target.value)})} className="w-full bg-slate-50 border-2 border-slate-100 p-4 rounded-2xl focus:border-rose-500 outline-none font-black shadow-inner" />
                </div>
                <div>
                  <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2">ক্যাটাগরি</label>
                  <input type="text" value={formData.category || ''} onChange={e=>setFormData({...formData, category: e.target.value})} className="w-full bg-slate-50 border-2 border-slate-100 p-4 rounded-2xl focus:border-rose-500 outline-none font-bold shadow-inner" placeholder="উপন্যাস..." />
                </div>
                <div>
                  <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2">স্টক</label>
                  <input type="number" value={formData.stock ?? ''} onChange={e=>setFormData({...formData, stock: Number(e.target.value)})} className="w-full bg-slate-50 border-2 border-slate-100 p-4 rounded-2xl focus:border-rose-500 outline-none font-black shadow-inner" />
                </div>
                <div className="flex items-center pt-8">
                  <label className="flex items-center gap-3 cursor-pointer group">
                    <div className="relative">
                      <input 
                        type="checkbox" 
                        checked={formData.isPreOrderAvailable} 
                        onChange={e => setFormData({...formData, isPreOrderAvailable: e.target.checked})}
                        className="sr-only"
                      />
                      <div className={`w-12 h-6 rounded-full transition-colors ${formData.isPreOrderAvailable ? 'bg-rose-500' : 'bg-slate-200'}`}></div>
                      <div className={`absolute top-1 left-1 w-4 h-4 bg-white rounded-full transition-transform ${formData.isPreOrderAvailable ? 'translate-x-6' : ''}`}></div>
                    </div>
                    <span className="text-xs font-black text-slate-600 group-hover:text-rose-600 transition-colors">প্রি-অর্ডার</span>
                  </label>
                </div>
              </div>

              <div>
                <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2">বর্ণনা (ঐচ্ছিক)</label>
                <textarea value={formData.description || ''} onChange={e=>setFormData({...formData, description: e.target.value})} className="w-full bg-slate-50 border-2 border-slate-100 p-4 rounded-2xl focus:border-rose-500 outline-none font-bold shadow-inner h-24" placeholder="বই সম্পর্কে কিছু লিখুন..." />
              </div>

              <div>
                <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-4">কভার ইমেজ (ঐচ্ছিক)</label>
                <div className="flex gap-2 mb-4 bg-slate-50 p-1.5 rounded-2xl border-2 border-slate-100 max-w-sm">
                  <button type="button" onClick={() => setCoverInputType('upload')} className={`flex-1 py-3 px-4 rounded-xl text-xs font-black transition-all ${coverInputType === 'upload' ? 'bg-white shadow-xl text-rose-600' : 'text-slate-400'}`}>আপলোড</button>
                  <button type="button" onClick={() => setCoverInputType('link')} className={`flex-1 py-3 px-4 rounded-xl text-xs font-black transition-all ${coverInputType === 'link' ? 'bg-white shadow-xl text-rose-600' : 'text-slate-400'}`}>লিঙ্ক</button>
                </div>
                <div className="flex gap-6 items-start">
                  <div className="w-24 h-36 bg-slate-50 rounded-2xl border-2 border-dashed border-slate-200 flex-shrink-0 flex items-center justify-center overflow-hidden p-1">
                    {formData.cover ? <img src={formData.cover} referrerPolicy="no-referrer" className="w-full h-full object-contain" /> : <BookOpen className="w-8 h-8 text-slate-200" />}
                  </div>
                  <div className="flex-1 space-y-4">
                    {coverInputType === 'upload' ? (
                      <input type="file" accept="image/*" onChange={(e) => {
                        const file = e.target.files?.[0];
                        if (file) {
                          if (file.size > 2 * 1024 * 1024) {
                            toast.error('ফাইলের সাইজ ২ এমবি-র কম হতে হবে।');
                            return;
                          }
                          const reader = new FileReader();
                          reader.onloadend = () => {
                            const img = new Image();
                            img.onload = () => {
                              const canvas = document.createElement('canvas');
                              const MAX_WIDTH = 400;
                              const MAX_HEIGHT = 600;
                              let width = img.width;
                              let height = img.height;

                              if (width > height) {
                                if (width > MAX_WIDTH) {
                                  height *= MAX_WIDTH / width;
                                  width = MAX_WIDTH;
                                }
                              } else {
                                if (height > MAX_HEIGHT) {
                                  width *= MAX_HEIGHT / height;
                                  height = MAX_HEIGHT;
                                }
                              }

                              canvas.width = width;
                              canvas.height = height;
                              const ctx = canvas.getContext('2d');
                              ctx?.drawImage(img, 0, 0, width, height);

                              const dataUrl = canvas.toDataURL('image/jpeg', 0.6);
                              setFormData({ ...formData, cover: dataUrl });
                            };
                            img.src = reader.result as string;
                          };
                          reader.readAsDataURL(file);
                        }
                      }} className="w-full text-xs file:mr-4 file:py-3 file:px-6 file:rounded-full file:border-0 file:text-xs file:font-black file:bg-rose-50 file:text-rose-600 hover:file:bg-rose-100 cursor-pointer shadow-sm" />
                    ) : (
                      <input type="text" placeholder="https://..." value={formData.cover?.startsWith('data:') ? '' : (formData.cover || '')} onChange={e=>setFormData({...formData, cover: e.target.value})} className="w-full bg-slate-50 border-2 border-slate-100 p-4 rounded-2xl focus:border-rose-500 outline-none font-bold shadow-inner text-sm" />
                    )}
                    <button type="button" onClick={() => setFormData({...formData, cover: ''})} className="text-[10px] font-black text-rose-500 hover:text-rose-700 uppercase tracking-widest">রিমুভ ইমেজ</button>
                  </div>
                </div>
              </div>

              <div className="sticky bottom-0 bg-white z-10 flex justify-end gap-4 py-6 border-t border-slate-100">
                <button type="button" disabled={isSubmitting} onClick={() => setShowModal(false)} className="px-8 py-4 font-black text-slate-400 hover:text-slate-600 transition disabled:opacity-50">বাতিল</button>
                <button type="submit" disabled={isSubmitting} className="px-12 py-4 bg-slate-900 text-white rounded-2xl font-black hover:bg-rose-600 shadow-2xl transition active:scale-95 disabled:opacity-70 flex items-center justify-center gap-2">
                  {isSubmitting && <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />}
                  {editingId ? 'আপডেট করুন' : 'সেভ করুন'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
