import React, { useState, useEffect } from 'react';
import { collection, onSnapshot, query, orderBy, doc, writeBatch, serverTimestamp, getDocs } from 'firebase/firestore';
import { db, handleFirestoreError, OperationType } from '../../lib/firebase';
import { Search, Plus, Trash2, Library, CheckCircle, ListChecks, Settings2, Filter, Save, X } from 'lucide-react';
import toast from 'react-hot-toast';
import { motion, AnimatePresence } from 'motion/react';
import { BOOK_CATEGORIES } from './ManageBooks';

interface Book {
  id: string;
  title: string;
  author: string;
  category: string;
  bookCode?: string;
  shelfNo?: string;
}

export default function ManageShelves() {
  const [books, setBooks] = useState<Book[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('');
  const [selectedBooks, setSelectedBooks] = useState<string[]>([]);
  const [shelfInput, setShelfInput] = useState('');
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
    // Priority 1: No category assigned or assigned to "সাধারণ" category
    const aNoCategory = !a.category || a.category === 'সাধারণ' || a.category === 'অন্যান্য';
    const bNoCategory = !b.category || b.category === 'সাধারণ' || b.category === 'অন্যান্য';

    // Priority 2: No shelf assigned
    const aNoShelf = !a.shelfNo || a.shelfNo === '' || a.shelfNo === '--' || a.shelfNo === 'N/A';
    const bNoShelf = !b.shelfNo || b.shelfNo === '' || b.shelfNo === '--' || b.shelfNo === 'N/A';

    if ((aNoCategory || aNoShelf) && !(bNoCategory || bNoShelf)) return -1;
    if (!(aNoCategory || aNoShelf) && (bNoCategory || bNoShelf)) return 1;
    
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

  const handleUpdateShelves = async () => {
    if (!shelfInput.trim()) {
      toast.error('শেল্ফ নং প্রদান করুন');
      return;
    }
    if (selectedBooks.length === 0) {
      toast.error('অন্তত একটি বই সিলেক্ট করুন');
      return;
    }

    setIsUpdating(true);
    
    try {
      const batches = [];
      let currentBatch = writeBatch(db);
      let operationCount = 0;

      selectedBooks.forEach(bookId => {
        const bookRef = doc(db, 'books', bookId);
        currentBatch.update(bookRef, { 
          shelfNo: shelfInput.trim(),
          updatedAt: serverTimestamp()
        });
        operationCount++;
        
        if (operationCount === 450) {
          batches.push(currentBatch.commit());
          currentBatch = writeBatch(db);
          operationCount = 0;
        }
      });

      if (operationCount > 0) {
        batches.push(currentBatch.commit());
      }
      
      await Promise.all(batches);

      toast.success(`${selectedBooks.length}টি বইয়ের শেল্ফ আপডেট করা হয়েছে`);
      setSelectedBooks([]);
      setShelfInput('');
    } catch (error) {
      console.error(error);
      toast.error('শেল্ফ আপডেট করতে সমস্যা হয়েছে');
    } finally {
      setIsUpdating(false);
    }
  };

  const handleAutoDistributeShelves = async () => {
    if (!shelfInput.trim()) {
      toast.error('শুরুর শেল্ফ নং প্রদান করুন (যেমন: I-01)');
      return;
    }
    if (selectedBooks.length === 0) {
      toast.error('অন্তত একটি বই সিলেক্ট করুন');
      return;
    }

    const match = shelfInput.trim().match(/^([a-zA-Z]+)-(\d+)$/);
    if (!match) {
        toast.error('সঠিক ফরম্যাটে শেল্ফ নং দিন, যেমন: I-01');
        return;
    }

    const prefix = match[1];
    let startNumber = parseInt(match[2], 10);
    const idLen = match[2].length;

    setIsUpdating(true);
    
    try {
      const batches = [];
      let currentBatch = writeBatch(db);
      let operationCount = 0;

      selectedBooks.forEach((bookId, index) => {
        const shelfSuffix = String(startNumber + Math.floor(index / 70)).padStart(idLen, '0');
        const calculatedShelf = `${prefix}-${shelfSuffix}`;
        const bookRef = doc(db, 'books', bookId);
        
        currentBatch.update(bookRef, { 
          shelfNo: calculatedShelf,
          updatedAt: serverTimestamp()
        });
        operationCount++;
        
        if (operationCount === 450) {
          batches.push(currentBatch.commit());
          currentBatch = writeBatch(db);
          operationCount = 0;
        }
      });

      if (operationCount > 0) {
        batches.push(currentBatch.commit());
      }
      
      await Promise.all(batches);

      toast.success(`${selectedBooks.length}টি বইয়ের শেল্ফ অটো-ডিস্ট্রিবিউট করা হয়েছে`);
      setSelectedBooks([]);
      setShelfInput('');
    } catch (error) {
      console.error(error);
      toast.error('শেল্ফ আপডেট করতে সমস্যা হয়েছে');
    } finally {
      setIsUpdating(false);
    }
  };

  return (
    <div className="p-4 sm:p-6 max-w-7xl mx-auto space-y-6">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-white p-6 rounded-3xl border border-slate-100 shadow-sm">
        <div>
          <h1 className="text-2xl font-black font-bengali text-slate-800 flex items-center gap-3">
            <Settings2 className="text-indigo-600" />
            শেল্ফ ব্যবস্থাপনা (Shelf Setup)
          </h1>
          <p className="text-slate-500 font-bengali mt-1">বই সিলেক্ট করে ম্যানুয়ালি শেল্ফে অর্গানাইজ করুন।</p>
        </div>
        
        <div className="flex items-center gap-2 text-sm">
          <div className="px-4 py-2 bg-indigo-50 text-indigo-700 rounded-xl font-bold font-bengali">
            সিলেক্টেড: {selectedBooks.length} টি
          </div>
          {selectedBooks.length > 0 && (
            <button 
              onClick={() => setSelectedBooks([])}
              className="p-2 text-slate-400 hover:text-rose-500 transition-colors"
              title="সব ক্লিয়ার করুন"
            >
              <X size={20} />
            </button>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
        {/* Sidebar Controls */}
        <div className="lg:col-span-1 space-y-6">
          <div className="bg-white p-6 rounded-3xl border border-slate-100 shadow-sm space-y-4">
            <h3 className="font-black font-bengali text-slate-800 flex items-center gap-2">
              <Filter size={18} className="text-indigo-500" />
              ফিল্টার ও সার্চ
            </h3>
            
            <div className="space-y-3">
              <div>
                <label className="text-xs font-black text-slate-400 uppercase tracking-widest mb-1.5 block">সার্চ করুন</label>
                <div className="relative">
                  <Search className="absolute left-3 top-3 w-4 h-4 text-slate-400" />
                  <input 
                    type="text" 
                    placeholder="বই বা কোড..."
                    value={search}
                    onChange={e => setSearch(e.target.value)}
                    className="w-full pl-9 pr-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
                  />
                </div>
              </div>

              <div>
                <label className="text-xs font-black text-slate-400 uppercase tracking-widest mb-1.5 block">ক্যাটাগরি</label>
                <select 
                  value={categoryFilter}
                  onChange={e => setCategoryFilter(e.target.value)}
                  className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/20 font-bengali"
                >
                  <option value="">সব ক্যাটাগরি</option>
                  {BOOK_CATEGORIES.map(cat => (
                    <option key={cat} value={cat}>{cat}</option>
                  ))}
                </select>
              </div>
            </div>
          </div>

          <div className="bg-indigo-600 p-6 rounded-3xl shadow-xl shadow-indigo-100 space-y-4 text-white">
            <h3 className="font-black font-bengali flex items-center gap-2">
              <Save size={18} />
              শেল্ফে পাঠান
            </h3>
            
            <div className="space-y-4">
              <div>
                <label className="text-xs font-black text-indigo-100 uppercase tracking-widest mb-1.5 block">শেল্ফ নং (Shelf No)</label>
                <input 
                  type="text" 
                  placeholder="যেমন: N-01"
                  value={shelfInput}
                  onChange={e => setShelfInput(e.target.value)}
                  className="w-full px-4 py-3 bg-white/10 border border-white/20 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-white/30 placeholder:text-white/40"
                />
              </div>

              <button 
                onClick={handleUpdateShelves}
                disabled={isUpdating || selectedBooks.length === 0}
                className="w-full bg-white text-indigo-600 py-3.5 rounded-xl font-black font-bengali hover:bg-slate-50 transition-all active:scale-95 disabled:bg-indigo-400 disabled:text-indigo-200 shadow-lg"
              >
                {isUpdating ? 'আপডেট হচ্ছে...' : 'সবগুলোতে একই শেল্ফ দিন'}
              </button>
              
              <button 
                onClick={handleAutoDistributeShelves}
                disabled={isUpdating || selectedBooks.length === 0}
                className="w-full border-2 border-white text-white py-3.5 rounded-xl font-black font-bengali hover:bg-white/10 transition-all active:scale-95 disabled:border-indigo-400 disabled:text-indigo-200"
              >
                {isUpdating ? 'আপডেট হচ্ছে...' : 'অটো ডিস্ট্রিবিউট (৭০টি/শেল্ফ)'}
              </button>
            </div>
          </div>
        </div>

        {/* Main Book List */}
        <div className="lg:col-span-3 space-y-4">
          <div className="flex items-center justify-between px-2">
            <p className="text-sm font-bold text-slate-500 font-bengali">
              মোট রেজাল্ট: <span className="text-slate-900">{filteredBooks.length}</span> টি
            </p>
            <button 
              onClick={selectAll}
              className="flex items-center gap-2 text-sm font-black font-bengali text-indigo-600 hover:text-indigo-700"
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
                    <th className="px-6 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest">ক্যাটাগরি</th>
                    <th className="px-6 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest text-center">বর্তমান শেল্ফ</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-50">
                  {loading ? (
                    <tr>
                      <td colSpan={4} className="px-6 py-20 text-center">
                        <div className="flex flex-col items-center gap-3">
                          <div className="w-10 h-10 border-4 border-indigo-50 border-t-indigo-600 rounded-full animate-spin"></div>
                          <p className="font-bengali font-bold text-slate-400">বই লোড হচ্ছে...</p>
                        </div>
                      </td>
                    </tr>
                  ) : filteredBooks.length > 0 ? (
                    filteredBooks.map(book => (
                      <tr 
                        key={book.id} 
                        onClick={() => toggleSelect(book.id)}
                        className={`group cursor-pointer transition-colors ${selectedBooks.includes(book.id) ? 'bg-indigo-50/30' : 'hover:bg-slate-50/50'}`}
                      >
                        <td className="px-6 py-4">
                          <div className={`w-6 h-6 rounded-lg border-2 flex items-center justify-center transition-all ${
                            selectedBooks.includes(book.id) 
                              ? 'bg-indigo-600 border-indigo-600 text-white' 
                              : 'border-slate-200 group-hover:border-indigo-300'
                          }`}>
                            {selectedBooks.includes(book.id) && <CheckCircle size={14} strokeWidth={3} />}
                          </div>
                        </td>
                        <td className="px-6 py-4">
                          <div className="flex flex-col">
                            <span className="font-black font-bengali text-slate-800 text-sm line-clamp-1">{book.title}</span>
                            <span className="text-xs text-slate-400 font-bold">{book.author}</span>
                            <span className="text-[10px] font-bold text-indigo-500 mt-1 uppercase tracking-wider">{book.bookCode}</span>
                          </div>
                        </td>
                        <td className="px-6 py-4">
                          <span className="px-3 py-1 bg-slate-100 text-slate-600 rounded-full text-[10px] font-black font-bengali">
                            {book.category}
                          </span>
                        </td>
                        <td className="px-6 py-4 text-center">
                          <span className={`px-3 py-1 rounded-lg text-xs font-black font-mono tracking-wider ${
                            book.shelfNo 
                              ? 'bg-amber-50 text-amber-600 border border-amber-100' 
                              : 'text-slate-300 italic'
                          }`}>
                            {book.shelfNo || 'N/A'}
                          </span>
                        </td>
                      </tr>
                    ))
                  ) : (
                    <tr>
                      <td colSpan={4} className="px-6 py-20 text-center">
                        <Library size={48} className="mx-auto text-slate-200 mb-4" />
                        <p className="font-bengali font-bold text-slate-400">কোনো বই পাওয়া যায়নি</p>
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
                   <div className="w-10 h-10 border-4 border-indigo-50 border-t-indigo-600 rounded-full animate-spin"></div>
                 </div>
               ) : filteredBooks.length > 0 ? (
                 filteredBooks.map(book => (
                   <div 
                     key={book.id} 
                     onClick={() => toggleSelect(book.id)}
                     className={`p-4 flex gap-4 cursor-pointer transition-colors ${selectedBooks.includes(book.id) ? 'bg-indigo-50/50' : 'active:bg-slate-50'}`}
                   >
                     <div className="pt-1">
                       <div className={`w-6 h-6 rounded-lg border-2 flex items-center justify-center transition-all ${
                         selectedBooks.includes(book.id) 
                           ? 'bg-indigo-600 border-indigo-600 text-white' 
                           : 'border-slate-300'
                       }`}>
                         {selectedBooks.includes(book.id) && <CheckCircle size={14} strokeWidth={3} />}
                       </div>
                     </div>
                     <div className="flex-1 min-w-0">
                       <h4 className="font-black font-bengali text-slate-800 text-base leading-tight mb-1">{book.title}</h4>
                       <p className="text-slate-500 font-bold text-xs mb-3">{book.author}</p>
                       <div className="flex flex-wrap gap-2 items-center">
                         <span className="px-3 py-1 bg-indigo-50 text-indigo-600 rounded-full text-[10px] font-black font-bengali border border-indigo-100">
                           {book.category}
                         </span>
                         <span className={`px-2 py-1 rounded text-[10px] font-black font-mono tracking-wider ${
                            book.shelfNo 
                              ? 'bg-amber-50 text-amber-600 border border-amber-100' 
                              : 'bg-slate-50 text-slate-400'
                          }`}>
                           শেল্ফ: {book.shelfNo || '--'}
                         </span>
                       </div>
                     </div>
                   </div>
                 ))
               ) : (
                 <div className="p-10 text-center text-slate-400">
                   <Library size={30} className="mx-auto mb-2 opacity-20" />
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
