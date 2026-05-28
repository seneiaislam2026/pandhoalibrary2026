import React, { useState, useEffect } from 'react';
import { collection, onSnapshot, query, orderBy, doc, writeBatch, serverTimestamp } from 'firebase/firestore';
import { db, handleFirestoreError, OperationType } from '../../lib/firebase';
import { Search, Library, CheckCircle, ListChecks, Tags, Filter, Save, X, Bookmark } from 'lucide-react';
import toast from 'react-hot-toast';
import { BOOK_CATEGORIES } from './ManageBooks';

interface Book {
  id: string;
  title: string;
  author: string;
  category: string;
  bookCode?: string;
  shelfNo?: string;
}

export default function ManageCategories() {
  const [books, setBooks] = useState<Book[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('');
  const [selectedBooks, setSelectedBooks] = useState<string[]>([]);
  const [newCategory, setNewCategory] = useState('');
  const [isUpdating, setIsUpdating] = useState(false);

  useEffect(() => {
    setLoading(true);
    const q = query(collection(db, 'books'));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const booksData = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      })) as Book[];
      setBooks(booksData);
      setLoading(false);
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, 'books');
      setLoading(false);
    });

    return () => unsubscribe();
  }, []);

  const filteredBooks = books.filter(b => {
    const term = search.toLowerCase();
    const matchesSearch = 
      b.title.toLowerCase().includes(term) || 
      b.author.toLowerCase().includes(term) || 
      (b.bookCode || '').toLowerCase().includes(term);
    const matchesCategory = categoryFilter === '' || b.category === categoryFilter;
    return matchesSearch && matchesCategory;
  }).sort((a, b) => {
    // Books without category or with 'সাধারণ'/'General' should come first
    const aNoCat = !a.category || a.category === '' || a.category === 'সাধারণ' || a.category === 'General';
    const bNoCat = !b.category || b.category === '' || b.category === 'সাধারণ' || b.category === 'General';

    if (aNoCat && !bNoCat) return -1;
    if (!aNoCat && bNoCat) return 1;
    
    return a.title.localeCompare(b.title);
  });

  const toggleSelect = (id: string) => {
    setSelectedBooks(prev => 
      prev.includes(id) ? prev.filter(item => item !== id) : [...prev, id]
    );
  };

  const selectAll = () => {
    if (selectedBooks.length === filteredBooks.length) {
      setSelectedBooks([]);
    } else {
      setSelectedBooks(filteredBooks.map(b => b.id));
    }
  };

  const handleUpdateCategories = async () => {
    if (!newCategory) {
      toast.error('নতুন ক্যাটাগরি সিলেক্ট করুন');
      return;
    }
    if (selectedBooks.length === 0) {
      toast.error('অন্তত একটি বই সিলেক্ট করুন');
      return;
    }

    setIsUpdating(true);
    const batch = writeBatch(db);
    
    try {
      selectedBooks.forEach(bookId => {
        const bookRef = doc(db, 'books', bookId);
        batch.update(bookRef, { 
          category: newCategory,
          updatedAt: serverTimestamp()
        });
      });

      await batch.commit();
      toast.success(`${selectedBooks.length}টি বইয়ের ক্যাটাগরি আপডেট করা হয়েছে`);
      setSelectedBooks([]);
      setNewCategory('');
    } catch (error) {
      console.error(error);
      toast.error('ক্যাটাগরি আপডেট করতে সমস্যা হয়েছে');
    } finally {
      setIsUpdating(false);
    }
  };

  return (
    <div className="p-4 sm:p-6 max-w-7xl mx-auto space-y-6">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-white p-6 rounded-3xl border border-slate-100 shadow-sm">
        <div>
          <h1 className="text-2xl font-black font-bengali text-slate-800 flex items-center gap-3">
            <Tags className="text-emerald-600" />
            ক্যাটাগরি ব্যবস্থাপনা (Category Setup)
          </h1>
          <p className="text-slate-500 font-bengali mt-1">বাল্ক মুডে বইয়ের ক্যাটাগরি পরিবর্তন করুন।</p>
        </div>
        
        <div className="flex items-center gap-2 text-sm">
          <div className="px-4 py-2 bg-emerald-50 text-emerald-700 rounded-xl font-bold font-bengali">
            সিলেক্টেড: {selectedBooks.length} টি
          </div>
          {selectedBooks.length > 0 && (
            <button 
              onClick={() => setSelectedBooks([])}
              className="p-2 text-slate-400 hover:text-rose-500 transition-colors"
            >
              <X size={20} />
            </button>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
        <div className="lg:col-span-1 space-y-6">
          <div className="bg-white p-6 rounded-3xl border border-slate-100 shadow-sm space-y-4">
            <h3 className="font-black font-bengali text-slate-800 flex items-center gap-2">
              <Filter size={18} className="text-emerald-500" />
              ফিল্টার
            </h3>
            
            <div className="space-y-3">
              <div>
                <label className="text-xs font-black text-slate-400 uppercase tracking-widest mb-1.5 block">সার্চ</label>
                <div className="relative">
                  <Search className="absolute left-3 top-3 w-4 h-4 text-slate-400" />
                  <input 
                    type="text" 
                    placeholder="বইয়ের নাম..."
                    value={search}
                    onChange={e => setSearch(e.target.value)}
                    className="w-full pl-9 pr-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500/20"
                  />
                </div>
              </div>

              <div>
                <label className="text-xs font-black text-slate-400 uppercase tracking-widest mb-1.5 block">বর্তমান ক্যাটাগরি</label>
                <select 
                  value={categoryFilter}
                  onChange={e => setCategoryFilter(e.target.value)}
                  className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500/20 font-bengali"
                >
                  <option value="">সব ক্যাটাগরি</option>
                  {BOOK_CATEGORIES.map(cat => (
                    <option key={cat} value={cat}>{cat}</option>
                  ))}
                </select>
              </div>
            </div>
          </div>

          <div className="bg-emerald-600 p-6 rounded-3xl shadow-xl shadow-emerald-100 space-y-4 text-white">
            <h3 className="font-black font-bengali flex items-center gap-2">
              <Save size={18} />
              নতুন ক্যাটাগরি দিন
            </h3>
            
            <div className="space-y-4">
              <div>
                <label className="text-xs font-black text-emerald-100 uppercase tracking-widest mb-1.5 block">নতুন ক্যাটাগরি সিলেক্ট করুন</label>
                <select 
                  value={newCategory}
                  onChange={e => setNewCategory(e.target.value)}
                  className="w-full px-4 py-3 bg-white/10 border border-white/20 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-white/30 font-bengali appearance-none"
                >
                  <option value="" className="text-slate-800">ক্যাটাগরি বাছাই করুন</option>
                  {BOOK_CATEGORIES.map(cat => (
                    <option key={cat} value={cat} className="text-slate-800">{cat}</option>
                  ))}
                </select>
              </div>

              <button 
                onClick={handleUpdateCategories}
                disabled={isUpdating || selectedBooks.length === 0}
                className="w-full bg-white text-emerald-600 py-3.5 rounded-xl font-black font-bengali hover:bg-slate-50 transition-all active:scale-95 disabled:bg-emerald-400 disabled:text-emerald-200 shadow-lg"
              >
                {isUpdating ? 'আপডেট হচ্ছে...' : 'ক্যাটাগরি আপডেট করুন'}
              </button>
            </div>
          </div>
        </div>

        <div className="lg:col-span-3 space-y-4">
          <div className="flex items-center justify-between px-2">
            <p className="text-sm font-bold text-slate-500 font-bengali">
              মোট রেজাল্ট: <span className="text-slate-900">{filteredBooks.length}</span> টি
            </p>
            <button 
              onClick={selectAll}
              className="flex items-center gap-2 text-sm font-black font-bengali text-emerald-600 hover:text-emerald-700"
            >
              <ListChecks size={18} />
              {selectedBooks.length === filteredBooks.length ? 'সব আন-সিলেক্ট' : 'সব সিলেক্ট করুন'}
            </button>
          </div>

          <div className="bg-white rounded-3xl border border-slate-100 shadow-sm overflow-hidden">
            {/* Desktop View */}
            <div className="hidden md:block overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-slate-50/50">
                    <th className="px-6 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest w-16">সিলেক্ট</th>
                    <th className="px-6 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest">বইয়ের তথ্য</th>
                    <th className="px-6 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest">বর্তমান ক্যাটাগরি</th>
                    <th className="px-6 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest text-center">শেল্ফ</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-50">
                  {loading ? (
                    <tr>
                      <td colSpan={4} className="px-6 py-20 text-center">
                        <div className="w-10 h-10 border-4 border-emerald-50 border-t-emerald-600 rounded-full animate-spin mx-auto"></div>
                      </td>
                    </tr>
                  ) : filteredBooks.length > 0 ? (
                    filteredBooks.map(book => (
                      <tr 
                        key={book.id} 
                        onClick={() => toggleSelect(book.id)}
                        className={`group cursor-pointer transition-colors ${selectedBooks.includes(book.id) ? 'bg-emerald-50/30' : 'hover:bg-slate-50/50'}`}
                      >
                        <td className="px-6 py-4">
                          <div className={`w-6 h-6 rounded-lg border-2 flex items-center justify-center transition-all ${
                            selectedBooks.includes(book.id) 
                              ? 'bg-emerald-600 border-emerald-600 text-white' 
                              : 'border-slate-200 group-hover:border-emerald-300'
                          }`}>
                            {selectedBooks.includes(book.id) && <CheckCircle size={14} strokeWidth={3} />}
                          </div>
                        </td>
                        <td className="px-6 py-4">
                          <div className="flex flex-col text-sm">
                            <span className="font-black font-bengali text-slate-800">{book.title}</span>
                            <span className="text-slate-400 font-bold">{book.author}</span>
                          </div>
                        </td>
                        <td className="px-6 py-4">
                          <span className="px-3 py-1 bg-emerald-50 text-emerald-600 rounded-full text-[10px] font-black font-bengali border border-emerald-100">
                            {book.category}
                          </span>
                        </td>
                        <td className="px-6 py-4 text-center">
                          <span className="text-xs font-black font-mono text-slate-500 bg-slate-100 px-2 py-1 rounded">
                            {book.shelfNo || '--'}
                          </span>
                        </td>
                      </tr>
                    ))
                  ) : (
                    <tr>
                      <td colSpan={4} className="px-6 py-20 text-center text-slate-400">
                        <Bookmark size={40} className="mx-auto mb-2 opacity-20" />
                        কোনো বই পাওয়া যায়নি
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>

            {/* Mobile View */}
            <div className="md:hidden flex flex-col divide-y divide-slate-50">
               {loading ? (
                 <div className="p-10 flex justify-center">
                   <div className="w-10 h-10 border-4 border-emerald-50 border-t-emerald-600 rounded-full animate-spin"></div>
                 </div>
               ) : filteredBooks.length > 0 ? (
                 filteredBooks.map(book => (
                   <div 
                     key={book.id} 
                     onClick={() => toggleSelect(book.id)}
                     className={`p-4 flex gap-4 cursor-pointer transition-colors ${selectedBooks.includes(book.id) ? 'bg-emerald-50/50' : 'active:bg-slate-50'}`}
                   >
                     <div className="pt-1">
                       <div className={`w-6 h-6 rounded-lg border-2 flex items-center justify-center transition-all ${
                         selectedBooks.includes(book.id) 
                           ? 'bg-emerald-600 border-emerald-600 text-white' 
                           : 'border-slate-300'
                       }`}>
                         {selectedBooks.includes(book.id) && <CheckCircle size={14} strokeWidth={3} />}
                       </div>
                     </div>
                     <div className="flex-1 min-w-0">
                       <h4 className="font-black font-bengali text-slate-800 text-base leading-tight mb-1">{book.title}</h4>
                       <p className="text-slate-500 font-bold text-xs mb-3">{book.author}</p>
                       <div className="flex flex-wrap gap-2 items-center">
                         <span className="px-3 py-1 bg-emerald-50 text-emerald-600 rounded-full text-[10px] font-black font-bengali border border-emerald-100">
                           {book.category}
                         </span>
                         <span className="text-xs font-black font-mono text-slate-500 bg-slate-100 px-2 py-1 rounded">
                           শেল্ফ: {book.shelfNo || '--'}
                         </span>
                       </div>
                     </div>
                   </div>
                 ))
               ) : (
                 <div className="p-10 text-center text-slate-400">
                   <Bookmark size={30} className="mx-auto mb-2 opacity-20" />
                   কোনো বই পাওয়া যায়নি
                 </div>
               )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
