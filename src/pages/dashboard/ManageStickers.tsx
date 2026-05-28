import React, { useState, useEffect } from 'react';
import { collection, onSnapshot, query, orderBy, doc, writeBatch, serverTimestamp, getDocs, limit, where, setDoc } from 'firebase/firestore';
import { db, handleFirestoreError, OperationType } from '../../lib/firebase';
import { Barcode as BarcodeIcon, Plus, Download, Printer, Search, Link as LinkIcon, Trash2, Library } from 'lucide-react';
import toast from 'react-hot-toast';
import Barcode from 'react-barcode';
import jsPDF from 'jspdf';
import { toJpeg } from 'html-to-image';
import { BOOK_CATEGORIES, reactSelectCustomStyles } from './ManageBooks';
import Select from 'react-select';
import CreatableSelect from 'react-select/creatable';

// Helper to convert to Bengali numerals (optional, if they want English numbers to be Bengali)
const engToBdNum = (str: string) => {
  const bdNumbers = { '0': '০', '1': '১', '2': '২', '3': '৩', '4': '৪', '5': '৫', '6': '৬', '7': '৭', '8': '৮', '9': '৯' };
  return str.replace(/[0-9]/g, (w) => (bdNumbers as any)[w] || w);
};

const bdToEngNum = (str: string) => {
  const engNumbers = { '০': '0', '১': '1', '২': '2', '৩': '3', '৪': '4', '৫': '5', '৬': '6', '৭': '7', '৮': '8', '৯': '9' };
  return str.replace(/[০-৯]/g, (w) => (engNumbers as any)[w] || w);
};

interface Sticker {
  id: string;
  code: string;
  category: string;
  shelfNo: string;
  url: string;
  createdAt: any;
}

export default function ManageStickers() {
  const [stickers, setStickers] = useState<Sticker[]>([]);
  const [books, setBooks] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('');
  const [shelfFilter, setShelfFilter] = useState('');
  
  // Form State
  const [isGenerating, setIsGenerating] = useState(false);
  const [isGeneratingPDF, setIsGeneratingPDF] = useState(false);
  const [generationMode, setGenerationMode] = useState<'new' | 'existing'>('new');
  const [category, setCategory] = useState('');
  const [shelfNo, setShelfNo] = useState('');
  const [quantity, setQuantity] = useState(1);
  const [selectedBookId, setSelectedBookId] = useState('');
  const [customUrl, setCustomUrl] = useState('');
  const [showGenerateModal, setShowGenerateModal] = useState(false);
  const [showBatchPrintModal, setShowBatchPrintModal] = useState(false);
  const [batchPrintPrefix, setBatchPrintPrefix] = useState('');
  const [batchPrintStart, setBatchPrintStart] = useState<number | ''>('');
  const [batchPrintEnd, setBatchPrintEnd] = useState<number | ''>('');
  const [selectedStickerIds, setSelectedStickerIds] = useState<string[]>([]);

  useEffect(() => {
    setLoading(true);
    
    // Fetch Books
    const fetchBooks = async () => {
      try {
        const booksSnap = await getDocs(collection(db, 'books'));
        const fetchedBooks = booksSnap.docs.map(d => ({ id: d.id, ...d.data(), cover: d.data().cover || d.data().imageUrl }));
        setBooks(fetchedBooks);
        sessionStorage.setItem('admin_books_cache', JSON.stringify(fetchedBooks));
        sessionStorage.setItem('admin_books_time', Date.now().toString());
      } catch (err) {
        console.error("Error fetching books:", err);
      }
    };

    // Use cache initially if valid
    const cacheKeyBooks = 'admin_books_cache';
    const cacheTime = sessionStorage.getItem('admin_books_time');
    if (cacheTime && (Date.now() - parseInt(cacheTime) < 5 * 60 * 1000)) {
      const cachedBooks = sessionStorage.getItem(cacheKeyBooks);
      if (cachedBooks) {
        setBooks(JSON.parse(cachedBooks));
      } else {
        fetchBooks();
      }
    } else {
      fetchBooks();
    }

    // Real-time stickers listener
    const q = query(collection(db, 'book-stickers'), orderBy('createdAt', 'desc'));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const fetchedStickers = snapshot.docs.map(docSub => ({ 
        id: docSub.id, 
        ...docSub.data() 
      })) as Sticker[];
      
      setStickers(fetchedStickers);
      setLoading(false);
      
      // Update cache
      sessionStorage.setItem('admin_stickers_cache', JSON.stringify(fetchedStickers));
      sessionStorage.setItem('admin_stickers_time', Date.now().toString());
    }, (err) => {
      handleFirestoreError(err, OperationType.LIST, 'book-stickers');
      setLoading(false);
    });

    return () => unsubscribe();
  }, []);

  const handleGenerate = async (e: React.FormEvent) => {
    e.preventDefault();

    if (generationMode === 'existing') {
        if (!selectedBookId) {
            toast.error('দয়া করে বই নির্বাচন করুন');
            return;
        }

        setIsGenerating(true);
        try {
            const processBook = (b: typeof books[0]) => {
                const code = b.bookCode || `BK-${b.id.substring(0,6).toUpperCase()}`;
                const cat = b.category || 'General';
                const shelf = b.shelfNo || 'N/A';
                const url = customUrl.trim() !== '' ? customUrl.trim() : `${window.location.origin}/books?search=${code}`;
                const newRef = doc(collection(db, 'book-stickers'));
                return {
                    ref: newRef,
                    data: {
                        code,
                        category: cat,
                        shelfNo: shelf,
                        url,
                        bookId: b.id,
                        createdAt: serverTimestamp()
                    }
                };
            };

            if (selectedBookId === 'ALL_BOOKS') {
                const chunks = [];
                let currentChunk = [];
                for (const book of books) {
                    currentChunk.push(book);
                    if (currentChunk.length === 400) {
                        chunks.push(currentChunk);
                        currentChunk = [];
                    }
                }
                if (currentChunk.length > 0) chunks.push(currentChunk);

                for (const chunk of chunks) {
                    const batch = writeBatch(db);
                    for(const book of chunk) {
                        const item = processBook(book);
                        batch.set(item.ref, item.data);
                    }
                    await batch.commit();
                }
                toast.success(`সর্বমোট ${books.length} টি বইয়ের জন্য স্টিকার জেনারেট সফল হয়েছে!`);
            } else {
                const book = books.find(b => b.id === selectedBookId);
                if (book) {
                    const item = processBook(book);
                    await setDoc(item.ref, item.data);
                    toast.success(`${book.title} এর জন্য স্টিকার জেনারেট সফল হয়েছে!`);
                }
            }

            setShowGenerateModal(false);
            setSelectedBookId('');
        } catch (err: any) {
            toast.error('Error generating sticker: ' + err.message);
        } finally {
            setIsGenerating(false);
        }
        return;
    }

    if (!category || !shelfNo || quantity < 1) {
      toast.error('Please fill all fields correctly');
      return;
    }

    setIsGenerating(true);
    try {
      const batch = writeBatch(db);
      // Ensure catPrefix is readable or keep the English code if possible,
      // but since they might use Bengali for category, taking substring of Bengali is unpredictable (often breaks conjuncts).
      // Let's use a mapping for prefixes if we can, or just take first 2 chars safely if we don't care.
      // Wait, "বই কোড নংং বাংলায়ি হবে" maybe they want the code itself to be Bengali.
      
      const getCategoryPrefix = (category: string) => {
        if (category === 'ইতিহাস ও মুক্তিযুদ্ধ') return 'HIS';
        if (category === 'উপন্যাস') return 'NOV';
        if (category === 'ছোটগল্প') return 'SST';
        if (category === 'কবিতা') return 'POE';
        if (category === 'প্রবন্ধ ও গবেষণা') return 'RES';
        if (category === 'জীবনী') return 'BIO';
        if (category === 'সায়েন্স ফিকশন') return 'SCI';
        if (category === 'ধর্ম ও দর্শন') return 'REL';
        if (category === 'ইসলামী বই') return 'ISL';
        if (category === 'শিশু-কিশোর') return 'CHI';
        if (category === 'নাটক') return 'DRA';
        if (category === 'ফিকশন বা রোমান্স') return 'ROM';
        if (category === 'থ্রিলার ও অ্যাডভেঞ্চার') return 'THR';
        if (category === 'বিজ্ঞান ও প্রযুক্তি') return 'TEC';
        if (category === 'রাজনীতি ও অর্থনীতি') return 'POL';
        if (category === 'আত্মউন্নয়ন ও মোটিভেশন') return 'MOT';
        if (category === 'কমিকস ও গ্রাফিক্স নোভেল') return 'COM';
        if (category === 'অনুবাদ সাহিত্য') return 'TRA';
        if (category === 'ভ্রমণ কাহিনী') return 'TRAV';
        if (category === 'ম্যাগাজিন ও সাময়িকী') return 'MAG';
        if (category === 'একাডেমিক') return 'ACA';
        return 'GEN';
      };

      let currentSeq = 0;
      stickers.forEach(s => {
        const c = s.code || '';
        const parts = c.split('-');
        const lastPartStr = parts[parts.length - 1];
        const lastNumStrEng = bdToEngNum(lastPartStr);
        const lastNum = parseInt(lastNumStrEng);
        if (!isNaN(lastNum) && lastNum > currentSeq) {
          currentSeq = lastNum;
        }
      });
      
      const catPrefix = getCategoryPrefix(category);
      const basePrefix = `${catPrefix}-${shelfNo}-`;

      const generatedStickers: Sticker[] = [];

      for (let i = 1; i <= quantity; i++) {
        currentSeq++;
        const paddedSeq = currentSeq.toString().padStart(4, '0');
        const code = `${basePrefix}${paddedSeq}`;
        const newRef = doc(collection(db, 'book-stickers'));
        
        const url = customUrl.trim() !== '' ? customUrl.trim() : `${window.location.origin}/books?search=${code}`;
        
        batch.set(newRef, {
          code,
          category,
          shelfNo,
          url,
          createdAt: serverTimestamp()
        });

        // Add to local array to auto-download PDF right after if needed
        generatedStickers.push({
          id: newRef.id,
          code,
          category,
          shelfNo,
          url,
          createdAt: new Date()
        });
      }

      await batch.commit();
      
      toast.success(`Generated ${quantity} stickers successfully!`);
      setShowGenerateModal(false);
      setCategory('');
      setShelfNo('');
      setQuantity(1);
      
    } catch (err: any) {
      toast.error('Error generating stickers: ' + err.message);
    } finally {
      setIsGenerating(false);
    }
  };

  const handleBatchPrint = () => {
    if (!batchPrintPrefix || batchPrintStart === '' || batchPrintEnd === '') {
       toast.error('দয়া করে সঠিক প্রিফিক্স এবং রেঞ্জ দিন');
       return;
    }
    const start = Number(batchPrintStart);
    const end = Number(batchPrintEnd);
    if (start > end) {
       toast.error('শুরুর নম্বর শেষের নম্বরের চেয়ে ছোট বা সমান হতে হবে');
       return;
    }

    const codesToPrint: string[] = [];
    for(let i = start; i <= end; i++) {
        const paddedSeq = i.toString().padStart(4, '0');
        codesToPrint.push(`${batchPrintPrefix}${paddedSeq}`);
    }

    const matchedStickers = stickers.filter(s => codesToPrint.includes(s.code));
    if (matchedStickers.length === 0) {
       toast.error('এই রেঞ্জের কোনো স্টিকার পাওয়া যায়নি');
       return;
    }
    
    setShowBatchPrintModal(false);
    handleDownloadPDF(matchedStickers);
  };

  const [stickersToProcess, setStickersToProcess] = useState<Sticker[]>([]);

  const handleDownloadPDF = async (stickersToPrint: Sticker[]) => {
    if (stickersToPrint.length === 0) return;
    
    setIsGeneratingPDF(true);
    setStickersToProcess(stickersToPrint);
    const toastId = toast.loading('PDF জেনারেট হচ্ছে, অনুগ্রহ করে অপেক্ষা করুন...');
    
    // Give the DOM time to render the hidden elements
    await new Promise(resolve => setTimeout(resolve, 1000));
    
    try {
      const doc = new jsPDF({
        orientation: 'portrait',
        unit: 'mm',
        format: 'a4'
      });

      const itemsPerPage = 24; // 3x8 grid
      const pagesCount = Math.ceil(stickersToPrint.length / itemsPerPage);
      
      for (let p = 0; p < pagesCount; p++) {
        if (p > 0) doc.addPage();
        
        const pageNode = document.getElementById(`sticker-page-render-${p}`);
        if (pageNode) {
          const dataUrl = await toJpeg(pageNode, {
            quality: 1.0,
            pixelRatio: 4,
            backgroundColor: '#ffffff'
          });
          doc.addImage(dataUrl, 'JPEG', 0, 0, 210, 297);
        }
        
        toast.loading(`পেজ তৈরি হচ্ছে: ${p + 1} / ${pagesCount}`, { id: toastId });
      }

      doc.save(`Stickers_${new Date().getTime()}.pdf`);
      toast.success('PDF ডাউনলোড সম্পন্ন হয়েছে!', { id: toastId });
    } catch (err: any) {
      console.error(err);
      toast.error('PDF তৈরি করা সম্ভব হয়নি', { id: toastId });
    } finally {
      setIsGeneratingPDF(false);
      setStickersToProcess([]);
    }
  };

  const filteredStickers = stickers.filter(s => {
    const term = searchTerm.toLowerCase();
    const bdTerm = engToBdNum(term);
    const engTerm = bdToEngNum(term);
    
    const searchMatch = (s.code || '').toLowerCase().includes(term) || (s.code || '').toLowerCase().includes(bdTerm) || (s.code || '').toLowerCase().includes(engTerm) ||
      (s.category || '').toLowerCase().includes(term) || 
      (s.shelfNo || '').toLowerCase().includes(term);

    const categoryMatch = categoryFilter === '' || s.category === categoryFilter;
    const shelfMatch = shelfFilter === '' || s.shelfNo === shelfFilter;

    return searchMatch && categoryMatch && shelfMatch;
  });

  const uniqueShelves = Array.from(new Set([
    ...stickers.map(s => s.shelfNo),
    ...books.map(b => b.shelfNo)
  ].filter(s => !!s && String(s).trim() !== ''))).sort();


  const handleDelete = async (id: string, code: string) => {
    if (!confirm(`Are you sure you want to delete ${code}?`)) return;
    try {
      const { deleteDoc } = await import('firebase/firestore');
      await deleteDoc(doc(db, 'book-stickers', id));
      toast.success('Deleted successfully');
      setSelectedStickerIds(prev => prev.filter(sId => sId !== id));
    } catch (err: any) {
      toast.error('Could not delete: ' + err.message);
    }
  }

  const handleBulkDelete = async () => {
    if (!confirm(`Are you sure you want to delete ${selectedStickerIds.length} stickers?`)) return;
    try {
      const { deleteDoc } = await import('firebase/firestore');
      const toastId = toast.loading('Deleting...');
      await Promise.all(selectedStickerIds.map(id => deleteDoc(doc(db, 'book-stickers', id))));
      toast.success('Selected stickers deleted', { id: toastId });
      setSelectedStickerIds([]);
    } catch (err: any) {
      toast.error('Failed to delete stickers');
    }
  };

  const toggleSelection = (id: string) => {
    setSelectedStickerIds(prev => prev.includes(id) ? prev.filter(sId => sId !== id) : [...prev, id]);
  };

  const selectAll = () => {
    if (selectedStickerIds.length === filteredStickers.length && filteredStickers.length > 0) {
      setSelectedStickerIds([]);
    } else {
      setSelectedStickerIds(filteredStickers.map(s => s.id));
    }
  };

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6">
      {isGeneratingPDF && (
        <div 
          className="absolute w-0 h-0 overflow-hidden pointer-events-none opacity-0 z-[-999]" 
          aria-hidden="true"
          style={{ width: '210mm' }}
        >
          {Array.from({ length: Math.ceil(stickersToProcess.length / 24) }).map((_, pageIdx) => (
            <div 
              key={`page-${pageIdx}`}
              id={`sticker-page-render-${pageIdx}`}
              className="grid grid-cols-3 grid-rows-8 bg-white"
              style={{ 
                width: '210mm', 
                height: '297mm', 
                padding: '12mm 10mm',
                gap: '2.5mm'
              }}
            >
              {stickersToProcess.slice(pageIdx * 24, (pageIdx + 1) * 24).map(s => (
                <div 
                  key={s.id}
                  className="flex flex-col items-center justify-center border border-slate-300 p-2 text-center overflow-hidden bg-white rounded flex-shrink-0"
                  style={{ height: '33mm' }}
                >
                  <div className="flex-shrink-0 mb-1 w-full flex justify-center">
                    <Barcode 
                      value={s.code} 
                      width={1.2} 
                      height={32} 
                      fontSize={11} 
                      margin={0}
                      displayValue={true}
                      background="#ffffff"
                    />
                  </div>
                  <div className="flex flex-col items-center justify-center flex-shrink-0 w-full px-1">
                    <h1 className="font-black text-slate-900 font-bengali w-full text-center whitespace-nowrap" style={{ fontSize: '12px', lineHeight: 'normal', paddingBottom: '2px' }}>পানধোয়া উন্মুক্ত পাঠাগার</h1>
                    <div className="flex justify-center items-center gap-1.5 mt-0.5 text-slate-800 font-bold w-full truncate" style={{ fontSize: '9px' }}>
                       <span className="truncate">Shelf: {s.shelfNo || 'N/A'}</span>
                       <span className="text-slate-400">|</span>
                       <span className="truncate flex items-center gap-1">Cat: <span className="font-bengali">{s.category || 'N/A'}</span></span>
                    </div>
                    <p className="font-black text-indigo-700 mt-1 lowercase tracking-wide" style={{ fontSize: '8.5px' }}>www.pandhoalibrary.org</p>
                  </div>
                </div>
              ))}
            </div>
          ))}
        </div>
      )}

      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bengali font-bold text-slate-800 flex items-center gap-2">
            <BarcodeIcon className="w-6 h-6 text-indigo-600" />
            বইয়ের স্টিকার ও বারকোড
          </h1>
          <p className="text-sm text-slate-500 font-bengali mt-1">Generate and manage unique barcode stickers for books</p>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <button
            onClick={() => setShowBatchPrintModal(true)}
            className="flex items-center gap-2 bg-white border border-slate-200 text-slate-700 px-4 py-2 rounded-xl font-bold font-bengali shadow-sm hover:focus:bg-slate-50 transition-all active:scale-95"
          >
            <Printer className="w-4 h-4 text-indigo-600" />
            ব্যাচ প্রিন্ট
          </button>
          <button
            onClick={() => handleDownloadPDF(filteredStickers)}
            className="flex items-center gap-2 bg-white border border-slate-200 text-slate-700 px-4 py-2 rounded-xl font-bold font-bengali shadow-sm hover:bg-slate-50 transition-all active:scale-95"
          >
            <Download className="w-4 h-4" />
            সব প্রিন্ট করুন ({filteredStickers.length})
          </button>
          <button
            onClick={() => setShowGenerateModal(true)}
            className="flex items-center gap-2 bg-indigo-600 text-white px-4 py-2 rounded-xl font-bold font-bengali shadow-md shadow-indigo-200 hover:bg-indigo-700 transition-all active:scale-95"
          >
            <Plus className="w-5 h-5" />
            নতুন স্টিকার জেনারেট করুন
          </button>
        </div>
      </div>

      <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden relative min-h-[400px]">
        <div className="p-4 border-b border-slate-100 flex flex-col md:flex-row items-center gap-4 bg-slate-50/50">
          <div className="relative w-full flex flex-col md:flex-row gap-3">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
              <input
                type="text"
                placeholder="কোড, ক্যাটাগরি বা শেল্ফ নম্বর দিয়ে খুঁজুন..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-9 pr-4 py-2.5 bg-white border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/20 active:bg-slate-50 transition-all font-bengali"
              />
            </div>
            <div className="flex flex-col sm:flex-row gap-3">
              <Select
                value={categoryFilter ? { value: categoryFilter, label: categoryFilter } : null}
                onChange={(selected: any) => setCategoryFilter(selected ? selected.value : '')}
                options={[
                  { value: '', label: 'সব ক্যাটাগরি' },
                  ...BOOK_CATEGORIES.map(cat => ({ value: cat, label: cat }))
                ]}
                placeholder="ক্যাটাগরি ফিল্টার..."
                styles={{
                  ...reactSelectCustomStyles,
                  control: (base: any, state: any) => ({
                     ...reactSelectCustomStyles.control(base, state),
                     minHeight: '44px',
                     borderRadius: '0.75rem',
                     minWidth: '200px'
                  })
                }}
                className="font-bengali text-sm w-full sm:w-[200px]"
                classNamePrefix="react-select"
              />
              <Select
                value={shelfFilter ? { value: shelfFilter, label: `শেল্ফ: ${shelfFilter}` } : null}
                onChange={(selected: any) => setShelfFilter(selected ? selected.value : '')}
                options={[
                  { value: '', label: 'সব শেল্ফ' },
                  ...uniqueShelves.map((shelf: any) => ({ value: shelf, label: `শেল্ফ: ${shelf}` }))
                ]}
                placeholder="শেল্ফ ফিল্টার..."
                styles={{
                  ...reactSelectCustomStyles,
                  control: (base: any, state: any) => ({
                     ...reactSelectCustomStyles.control(base, state),
                     minHeight: '44px',
                     borderRadius: '0.75rem',
                     minWidth: '160px'
                  })
                }}
                className="font-bengali text-sm w-full sm:w-[160px]"
                classNamePrefix="react-select"
              />
            </div>
          </div>
          
          <div className="flex items-center gap-4 w-full md:w-auto">
            <div className="flex items-center gap-2">
              <input 
                type="checkbox" 
                id="selectAll"
                checked={selectedStickerIds.length > 0 && selectedStickerIds.length === filteredStickers.length}
                onChange={selectAll}
                className="w-4 h-4 text-indigo-600 rounded border-slate-300 focus:ring-indigo-500"
              />
              <label htmlFor="selectAll" className="text-sm font-semibold text-slate-600 cursor-pointer select-none">সব নির্বাচন করুন</label>
            </div>
            
            {selectedStickerIds.length > 0 && (
              <div className="flex items-center gap-2 ml-auto md:ml-0">
                <button
                  onClick={handleBulkDelete}
                  className="px-3 py-1.5 text-xs font-bold bg-red-50 text-red-600 border border-red-200 rounded-lg hover:bg-red-100 transition-colors flex items-center gap-1.5"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  ডিলিট ({selectedStickerIds.length})
                </button>
                <button
                  onClick={() => handleDownloadPDF(stickers.filter(s => selectedStickerIds.includes(s.id)))}
                  className="px-3 py-1.5 text-xs font-bold bg-indigo-50 text-indigo-600 border border-indigo-200 rounded-lg hover:bg-indigo-100 transition-colors flex items-center gap-1.5"
                >
                  <Printer className="w-3.5 h-3.5" />
                  প্রিন্ট ({selectedStickerIds.length})
                </button>
              </div>
            )}
          </div>
        </div>

        <div className="p-6">
          {loading ? (
            <div className="flex justify-center items-center h-48">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600"></div>
            </div>
          ) : filteredStickers.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-48 text-slate-400">
              <BarcodeIcon className="w-12 h-12 mb-3 text-slate-300" />
              <p className="font-bengali font-semibold">কোনো স্টিকার পাওয়া যায়নি</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4">
              {filteredStickers.map(sticker => (
                <div key={sticker.id} className={`group bg-white border ${selectedStickerIds.includes(sticker.id) ? 'border-indigo-400 shadow-sm ring-2 ring-indigo-50' : 'border-slate-200'} rounded-xl p-4 flex flex-col items-center hover:shadow-md hover:border-indigo-200 transition-all relative cursor-pointer`} onClick={() => toggleSelection(sticker.id)}>
                  <div className="absolute top-2 left-2 z-10" onClick={e => e.stopPropagation()}>
                    <input 
                      type="checkbox" 
                      checked={selectedStickerIds.includes(sticker.id)}
                      onChange={() => toggleSelection(sticker.id)}
                      className="w-4 h-4 text-indigo-600 rounded border-slate-300 focus:ring-indigo-500 cursor-pointer"
                    />
                  </div>
                  <button onClick={(e) => { e.stopPropagation(); handleDelete(sticker.id, sticker.code); }} className="absolute top-2 right-2 p-1.5 text-slate-300 hover:text-red-500 hover:bg-red-50 rounded-lg opacity-0 group-hover:opacity-100 transition-all z-10">
                    <Trash2 className="w-4 h-4" />
                  </button>
                  <p className="text-[10px] uppercase font-bold text-slate-400 tracking-wider mb-2 bg-slate-100 px-2 py-0.5 rounded text-center w-full truncate mt-2">
                    {sticker.category}
                  </p>
                  <div className="bg-white p-2 rounded-lg border border-slate-200 shadow-sm mb-3 w-full flex justify-center overflow-hidden">
                    <Barcode 
                      value={sticker.code} 
                      width={1} 
                      height={40} 
                      fontSize={11} 
                      margin={0}
                    />
                  </div>
                  <h3 className="font-mono font-bold text-slate-800 text-[10px] truncate w-full text-center">{sticker.code}</h3>
                  <div className="flex flex-col items-center mt-1 gap-0.5">
                    <p className="text-[10px] text-slate-500 font-medium">Shelf: {sticker.shelfNo}</p>
                    <p className="text-[9px] font-black text-indigo-600">www.pandhoalibrary.org</p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {showGenerateModal && (
        <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl w-full max-w-md shadow-2xl overflow-hidden font-bengali animate-in fade-in zoom-in-95 duration-200 max-h-[90vh] flex flex-col">
            <div className="p-6 border-b border-slate-100 bg-slate-50/50 shrink-0">
              <h2 className="text-xl font-bold text-slate-800 flex items-center gap-2">
                <Plus className="w-5 h-5 text-indigo-600" />
                নতুন স্টিকার জেনারেট করুন
              </h2>
            </div>
            
            <form onSubmit={handleGenerate} className="flex-1 flex flex-col min-h-0">
              <div className="p-6 space-y-5 overflow-y-auto custom-scrollbar flex-1">
                {/* Toggle Mode */}
                <div className="flex bg-slate-100 rounded-xl p-1 mb-4">
                    <button type="button" onClick={() => setGenerationMode('new')} className={`flex-1 text-sm font-bold py-2 rounded-lg transition-all ${generationMode === 'new' ? 'bg-white shadow text-indigo-700' : 'text-slate-500 hover:text-slate-700'}`}>নতুন কোড জেনারেট</button>
                    <button type="button" onClick={() => setGenerationMode('existing')} className={`flex-1 text-sm font-bold py-2 rounded-lg transition-all ${generationMode === 'existing' ? 'bg-white shadow text-indigo-700' : 'text-slate-500 hover:text-slate-700'}`}>বইয়ের তালিকা থেকে</button>
                </div>

                {generationMode === 'existing' ? (
                    <div>
                        <label className="block text-sm font-semibold text-slate-700 mb-1.5">বিদ্যমান বই নির্বাচন করুন</label>
                        <div className="relative">
                            <Library className="absolute left-3 top-3 w-5 h-5 text-slate-400" />
                            <Select
                                value={selectedBookId ? {
                                   value: selectedBookId,
                                   label: selectedBookId === 'ALL_BOOKS' 
                                    ? 'সব বই একসাথে (All Books)' 
                                    : (books.find(b => b.id === selectedBookId)?.title || '') + ' / ' + (books.find(b => b.id === selectedBookId)?.bookCode || 'No Code')
                                } : null}
                                onChange={(selected: any) => setSelectedBookId(selected ? selected.value : '')}
                                options={[
                                  { value: 'ALL_BOOKS', label: 'সব বই একসাথে (All Books)' },
                                  ...books.map(b => ({
                                    value: b.id,
                                    label: `${b.title} / ${b.bookCode || 'No Code'}`
                                  }))
                                ]}
                                placeholder="তালিকা থেকে বই নির্বাচন করুন..."
                                styles={{
                                  ...reactSelectCustomStyles,
                                  control: (base: any, state: any) => ({
                                    ...reactSelectCustomStyles.control(base, state),
                                    minHeight: '44px',
                                    borderRadius: '0.75rem',
                                    paddingLeft: '2.5rem' // for the icon
                                  })
                                }}
                                className="font-bengali text-sm"
                                classNamePrefix="react-select"
                            />
                        </div>
                    </div>
                ) : (
                    <>
                        <div>
                          <label className="block text-sm font-semibold text-slate-700 mb-1.5">ক্যাটাগরি</label>
                          <CreatableSelect
                            isClearable
                            value={category ? { value: category, label: category } : null}
                            onChange={(selected: any) => setCategory(selected ? selected.value : '')}
                            options={BOOK_CATEGORIES.map(cat => ({ value: cat, label: cat }))}
                            placeholder="টাইপ করুন বা সিলেক্ট করুন..."
                            formatCreateLabel={(inputValue) => `নতুন যোগ করুন: "${inputValue}"`}
                            styles={{
                              ...reactSelectCustomStyles,
                              control: (base: any, state: any) => ({
                                ...reactSelectCustomStyles.control(base, state),
                                minHeight: '44px',
                                borderRadius: '0.75rem'
                              })
                            }}
                            className="font-bengali text-sm"
                            classNamePrefix="react-select"
                          />
                        </div>
                        
                        <div>
                          <label className="block text-sm font-semibold text-slate-700 mb-1.5">শেল্ফ নম্বর</label>
                          <CreatableSelect
                            isClearable
                            value={shelfNo ? { value: shelfNo, label: shelfNo } : null}
                            onChange={(selected: any) => setShelfNo(selected ? selected.value : '')}
                            options={uniqueShelves.map((shelf: any) => ({ value: shelf, label: shelf }))}
                            placeholder="শেল্ফ সিলেক্ট করুন বা টাইপ করুন..."
                            formatCreateLabel={(inputValue) => `নতুন যোগ করুন: "${inputValue}"`}
                            styles={{
                              ...reactSelectCustomStyles,
                              control: (base: any, state: any) => ({
                                ...reactSelectCustomStyles.control(base, state),
                                minHeight: '44px',
                                borderRadius: '0.75rem'
                              })
                            }}
                            className="font-bengali text-sm"
                            classNamePrefix="react-select"
                          />
                        </div>

                        <div>
                          <label className="block text-sm font-semibold text-slate-700 mb-1.5">স্টিকারের পরিমাণ</label>
                          <input
                            type="number"
                            min="1"
                            max="500"
                            required
                            value={quantity ?? 1}
                            onChange={e => setQuantity(Number(e.target.value))}
                            className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500/20 transition-all"
                          />
                          <p className="text-xs text-slate-500 mt-1">কতগুলো ইউনিক স্টিকার তৈরি করতে চান?</p>
                        </div>
                    </>
                )}

                <div>
                   <label className="block text-sm font-semibold text-slate-700 mb-1.5">কাস্টম বারকোড লিংক/কোড (ঐচ্ছিক)</label>
                   <div className="relative">
                     <LinkIcon className="absolute left-3 top-3 w-5 h-5 text-slate-400" />
                     <input
                       type="text"
                       value={customUrl}
                       onChange={e => setCustomUrl(e.target.value)}
                       placeholder="Code or URL..."
                       className="w-full pl-10 pr-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500/20 transition-all text-sm"
                     />
                   </div>
                   <p className="text-xs text-slate-500 mt-1.5">লিংক না দিলে স্বয়ংক্রিয়ভাবে বইয়ের কোড ব্যবহার হবে।</p>
                </div>
              </div>

              <div className="p-6 border-t border-slate-100 bg-slate-50/50 flex gap-3 shrink-0">
                <button
                  type="button"
                  onClick={() => setShowGenerateModal(false)}
                  className="flex-1 px-4 py-2.5 border border-slate-200 text-slate-600 rounded-xl font-bold hover:bg-slate-50 transition-colors"
                >
                  বাতিল
                </button>
                <button
                  type="submit"
                  disabled={isGenerating}
                  className="flex-1 px-4 py-2.5 bg-indigo-600 text-white rounded-xl font-bold hover:bg-indigo-700 shadow-md shadow-indigo-200 transition-all flex items-center justify-center gap-2 disabled:opacity-70 disabled:cursor-not-allowed"
                >
                  {isGenerating ? (
                    <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white"></div>
                  ) : (
                    <>জেনারেট করুন</>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
      {/* Batch Print Modal */}
      {showBatchPrintModal && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-sm">
          <div className="bg-white rounded-3xl shadow-2xl w-full max-w-md overflow-hidden animate-in fade-in zoom-in-95 duration-200">
            <div className="p-6 border-b border-slate-100 flex items-center gap-4 bg-indigo-50/50">
              <div className="w-12 h-12 bg-white rounded-2xl shadow-sm flex items-center justify-center text-indigo-600">
                <Printer className="w-6 h-6" />
              </div>
              <h2 className="text-xl font-extrabold text-slate-800 font-bengali">ব্যাচ প্রিন্ট করুন</h2>
            </div>
            
            <div className="p-6 space-y-5">
              <div>
                <label className="block text-sm font-semibold text-slate-700 mb-1.5">প্রিফিক্স (Prefix)</label>
                <input
                  type="text"
                  required
                  value={batchPrintPrefix}
                  onChange={e => setBatchPrintPrefix(e.target.value.toUpperCase())}
                  className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
                  placeholder="যেমন: A1-"
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-semibold text-slate-700 mb-1.5">শুরু (Start)</label>
                  <input
                    type="number"
                    min="1"
                    required
                    value={batchPrintStart}
                    onChange={e => setBatchPrintStart(e.target.value ? Number(e.target.value) : '')}
                    className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
                    placeholder="1"
                  />
                </div>
                <div>
                  <label className="block text-sm font-semibold text-slate-700 mb-1.5">শেষ (End)</label>
                  <input
                    type="number"
                    min="1"
                    required
                    value={batchPrintEnd}
                    onChange={e => setBatchPrintEnd(e.target.value ? Number(e.target.value) : '')}
                    className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
                    placeholder="10"
                  />
                </div>
              </div>

              <div className="flex gap-3 pt-4">
                <button
                  type="button"
                  onClick={() => setShowBatchPrintModal(false)}
                  className="flex-1 px-4 py-2.5 border border-slate-200 text-slate-600 rounded-xl font-bold hover:bg-slate-50 transition-colors"
                >
                  বাতিল
                </button>
                <button
                  onClick={handleBatchPrint}
                  className="flex-1 px-4 py-2.5 bg-indigo-600 text-white rounded-xl font-bold hover:bg-indigo-700 shadow-md shadow-indigo-200 transition-all flex items-center justify-center gap-2"
                >
                  <Printer className="w-5 h-5" />
                  প্রিন্ট করুন
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
