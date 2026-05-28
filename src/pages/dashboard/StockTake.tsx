import React, { useState, useEffect, useRef } from 'react';
import { db } from '../../lib/firebase';
import { collection, query, where, getDocs, addDoc, serverTimestamp, orderBy, deleteDoc, doc, limit } from 'firebase/firestore';
import { Html5Qrcode } from 'html5-qrcode';
import { ScanLine, Trash2, FileDown, Package, CheckCircle2, AlertCircle, XCircle, Search } from 'lucide-react';
import toast from 'react-hot-toast';
import { jsPDF } from 'jspdf';
import 'jspdf-autotable';

interface StockEntry {
  id: string;
  bookId: string;
  bookTitle: string;
  bookSubtitle?: string;
  barcode: string;
  stockedAt: any;
  year: number;
}

export default function StockTake() {
  const [isScanning, setIsScanning] = useState(false);
  const [entries, setEntries] = useState<StockEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [processing, setProcessing] = useState(false);
  const scannerRef = useRef<Html5Qrcode | null>(null);
  const currentYear = new Date().getFullYear();

  useEffect(() => {
    fetchEntries();
    // Auto-start scanner for better UX
    setTimeout(() => {
      startScanner();
    }, 500);
    return () => {
      if (scannerRef.current) {
        scannerRef.current.stop().catch(console.error);
      }
    };
  }, []);

  const fetchEntries = async () => {
    try {
      setLoading(true);
      const q = query(
        collection(db, 'stock_entries'), 
        where('year', '==', currentYear),
        orderBy('stockedAt', 'desc')
      );
      const snap = await getDocs(q);
      const data = snap.docs.map(doc => ({ id: doc.id, ...doc.data() } as StockEntry));
      setEntries(data);
    } catch (err) {
      console.error(err);
      toast.error('স্টক ডাটা লোড করতে সমস্যা হয়েছে।');
    } finally {
      setLoading(false);
    }
  };

  const startScanner = () => {
    setIsScanning(true);
    setTimeout(() => {
      const scanner = new Html5Qrcode("stock-reader");
      scannerRef.current = scanner;
      scanner.start(
        { facingMode: "environment" },
        { fps: 10, qrbox: { width: 250, height: 150 } },
        (decodedText) => {
          processBarcode(decodedText);
        },
        () => {}
      ).catch(err => {
        console.error(err);
        toast.error('ক্যামেরা চালু করা যায়নি।');
        setIsScanning(false);
      });
    }, 100);
  };

  const stopScanner = () => {
    if (scannerRef.current) {
      scannerRef.current.stop().then(() => {
        setIsScanning(false);
        scannerRef.current = null;
      }).catch(console.error);
    } else {
      setIsScanning(false);
    }
  };

  const processBarcode = async (barcode: string) => {
    if (processing) return;
    
    // Simple deduplication for the current session list
    if (entries.some(e => e.barcode === barcode)) {
      toast.error('এই বারকোডটি ইতিমধ্যে স্টকে নেয়া হয়েছে।', { id: 'dup-barcode' });
      return;
    }

    try {
      setProcessing(true);
      
      // 1. Find book in inventory by bookCode OR barcode
      let qBook = query(collection(db, 'books'), where('bookCode', '==', barcode), limit(1));
      let bookSnap = await getDocs(qBook);
      
      if (bookSnap.empty) {
        qBook = query(collection(db, 'books'), where('barcode', '==', barcode), limit(1));
        bookSnap = await getDocs(qBook);
      }
      
      if (bookSnap.empty) {
        toast.error(`বইটি লাইব্রেরি ইনভেন্টরিতে পাওয়া যায়নি (Code: ${barcode})`, { duration: 3000 });
        return;
      }

      const bookData = bookSnap.docs[0].data();
      const bookId = bookSnap.docs[0].id;

      // 2. Add to stock entries
      const newEntry = {
        bookId,
        bookTitle: bookData.title,
        bookSubtitle: bookData.subtitle || '',
        barcode,
        stockedAt: serverTimestamp(),
        year: currentYear
      };

      const docRef = await addDoc(collection(db, 'stock_entries'), newEntry);
      
      // 3. Update local list
      const entryWithId = { ...newEntry, id: docRef.id, stockedAt: { seconds: Date.now()/1000 } };
      setEntries(prev => [entryWithId as StockEntry, ...prev]);
      
      toast.success(`${bookData.title} স্টকে যোগ করা হয়েছে!`, { id: 'success-stock' });

    } catch (err) {
      console.error(err);
      toast.error('স্টক এন্ট্রি যোগ করতে সমস্যা হয়েছে।');
    } finally {
      setProcessing(false);
    }
  };

  const deleteEntry = async (id: string) => {
    if (!window.confirm('আপনি কি এই এন্ট্রিটি ডিলিট করতে চান?')) return;
    try {
      await deleteDoc(doc(db, 'stock_entries', id));
      setEntries(prev => prev.filter(e => e.id !== id));
      toast.success('এন্ট্রি ডিলিট করা হয়েছে।');
    } catch (err) {
      toast.error('মুছে ফেলতে সমস্যা হয়েছে।');
    }
  };

  const exportPDF = () => {
    if (entries.length === 0) {
      toast.error('কোন ডাটা নেই।');
      return;
    }

    const doc = new jsPDF();
    
    // Title
    doc.setFontSize(18);
    doc.text(`Library Yearly Stock Report - ${currentYear}`, 14, 20);
    doc.setFontSize(10);
    doc.text(`Generated on: ${new Date().toLocaleString()}`, 14, 28);
    doc.text(`Total Books Stocked: ${entries.length}`, 14, 34);

    const tableRows = entries.map((e, index) => [
      index + 1,
      e.bookTitle,
      e.barcode,
      new Date(e.stockedAt.seconds * 1000).toLocaleDateString()
    ]);

    (doc as any).autoTable({
      head: [['Serial', 'Book Title', 'Barcode', 'Date']],
      body: tableRows,
      startY: 45,
      theme: 'grid',
      styles: { fontSize: 8 },
      headStyles: { fillColor: [63, 81, 181] }
    });

    doc.save(`Stock_Report_${currentYear}.pdf`);
  };

  return (
    <div className="space-y-6">
      <div className="bg-white p-8 rounded-[2.5rem] shadow-xl border border-slate-100 flex flex-col md:flex-row items-center justify-between gap-6 overflow-hidden relative group">
        <div className="absolute top-0 right-0 w-64 h-64 bg-indigo-50/50 rounded-full -mr-32 -mt-32 blur-3xl group-hover:bg-indigo-100/50 transition-colors"></div>
        
        <div className="flex items-center gap-6 relative z-10">
          <div className="w-16 h-16 bg-gradient-to-br from-indigo-500 to-purple-600 rounded-3xl flex items-center justify-center shadow-lg shadow-indigo-200 shrink-0">
            <Package className="text-white w-8 h-8" />
          </div>
          <div>
            <h1 className="text-3xl font-black text-slate-900 font-bengali">বার্ষিক স্টক ব্যবস্থাপনা</h1>
            <p className="text-slate-500 mt-1 font-bengali font-bold">{currentYear} সালের স্টকের বর্তমান হিসাব।</p>
          </div>
        </div>

        <div className="flex gap-4 relative z-10">
          <button 
            onClick={exportPDF}
            className="flex items-center gap-2 bg-slate-100 hover:bg-slate-200 text-slate-700 px-6 py-3 rounded-2xl font-bold font-bengali transition active:scale-95 border border-slate-200"
          >
            <FileDown className="w-5 h-5" />
            PDF ডাউনলোড
          </button>
          {!isScanning ? (
            <button 
              onClick={startScanner}
              className="flex items-center gap-2 bg-indigo-600 hover:bg-indigo-700 text-white px-8 py-3 rounded-2xl font-bold font-bengali transition active:scale-95 shadow-lg shadow-indigo-200"
            >
              <ScanLine className="w-5 h-5" />
              স্টক স্ক্যান শুরু
            </button>
          ) : (
            <button 
              onClick={stopScanner}
              className="flex items-center gap-2 bg-rose-500 hover:bg-rose-600 text-white px-8 py-3 rounded-2xl font-bold font-bengali transition active:scale-95 shadow-lg shadow-rose-200"
            >
              <XCircle className="w-5 h-5" />
              স্ক্যান বন্ধ করুন
            </button>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Left: Scanner & Entry Info */}
        <div className="lg:col-span-1 space-y-6">
          {isScanning && (
            <div className="bg-slate-900 rounded-[2.5rem] p-6 shadow-2xl relative overflow-hidden ring-4 ring-indigo-500/30">
               <div id="stock-reader" className="w-full aspect-square rounded-2xl overflow-hidden bg-black mb-4"></div>
               <div className="flex items-center justify-center gap-2 text-indigo-400 font-bold font-bengali animate-pulse px-4 py-2 bg-indigo-500/10 rounded-full">
                  <div className="w-2 h-2 rounded-full bg-indigo-400 animate-ping"></div>
                  বারকোড স্ক্যান করুন...
               </div>
            </div>
          )}

          <div className="bg-indigo-600 rounded-[2.5rem] p-8 text-white relative overflow-hidden shadow-xl shadow-indigo-200">
             <div className="absolute top-0 right-0 w-32 h-32 bg-white/10 rounded-full -mr-16 -mt-16 blur-2xl"></div>
             <Package className="w-12 h-12 mb-4 opacity-50" />
             <h3 className="text-xl font-black font-bengali mb-4">স্টক পরিসংখ্যান ({currentYear})</h3>
             <div className="space-y-4">
               <div className="bg-white/10 backdrop-blur-sm p-4 rounded-2xl border border-white/10">
                 <p className="text-white/70 text-sm font-bengali">মোট স্টক করা বই</p>
                 <p className="text-3xl font-black">{entries.length}</p>
               </div>
               <div className="flex gap-4">
                 <div className="flex-1 bg-white/10 backdrop-blur-sm p-4 rounded-2xl border border-white/10">
                   <p className="text-white/70 text-xs font-bengali">আজকের এন্ট্রি</p>
                   <p className="text-xl font-black">
                     {entries.filter(e => new Date(e.stockedAt.seconds * 1000).toDateString() === new Date().toDateString()).length}
                   </p>
                 </div>
                 <div className="flex-1 bg-white/10 backdrop-blur-sm p-4 rounded-2xl border border-white/10">
                   <CheckCircle2 className="w-6 h-6 text-indigo-300" />
                 </div>
               </div>
             </div>
          </div>
        </div>

        {/* Right: List of entries */}
        <div className="lg:col-span-2">
          <div className="bg-white rounded-[2.5rem] shadow-xl border border-slate-100 overflow-hidden min-h-[500px]">
            <div className="p-6 border-b border-slate-50 flex items-center justify-between bg-slate-50/50">
               <h3 className="text-lg font-black text-slate-800 font-bengali">সাম্প্রতিক স্টক এন্ট্রি</h3>
               <div className="w-8 h-8 bg-indigo-100 text-indigo-600 rounded-lg flex items-center justify-center">
                  <Search className="w-4 h-4" />
               </div>
            </div>
            
            {loading ? (
              <div className="p-12 flex flex-col items-center justify-center gap-4">
                <div className="w-12 h-12 border-4 border-indigo-100 border-t-indigo-600 rounded-full animate-spin"></div>
                <p className="font-bengali font-bold text-slate-400">ডাটা লোড হচ্ছে...</p>
              </div>
            ) : entries.length === 0 ? (
              <div className="p-12 text-center">
                <div className="w-20 h-20 bg-slate-50 rounded-full flex items-center justify-center mx-auto mb-6">
                  <Package className="w-10 h-10 text-slate-300" />
                </div>
                <p className="font-bengali font-bold text-slate-400">এই বছর এখনো কোন বই স্টক করা হয়নি।</p>
                <p className="text-sm text-slate-300">স্ক্যানার ব্যবহার করে শুরু করুন।</p>
              </div>
            ) : (
              <div className="divide-y divide-slate-50">
                {entries.map((entry) => (
                  <div key={entry.id} className="p-5 hover:bg-slate-50/80 transition-colors flex items-center justify-between group">
                    <div className="flex items-center gap-4">
                      <div className="w-12 h-12 bg-indigo-50 text-indigo-600 rounded-xl flex items-center justify-center shrink-0 border border-indigo-100 font-bold group-hover:bg-indigo-600 group-hover:text-white transition-colors">
                        {entry.bookTitle.charAt(0)}
                      </div>
                      <div>
                        <p className="font-bold text-slate-900 font-bengali group-hover:text-indigo-600 transition-colors">{entry.bookTitle}</p>
                        <div className="flex items-center gap-3 mt-0.5">
                          <span className="text-xs bg-slate-100 text-slate-500 px-2 py-0.5 rounded-lg font-mono">{entry.barcode}</span>
                          <span className="text-[10px] text-slate-400 flex items-center gap-1">
                            <Clock className="w-3 h-3" />
                            {new Date(entry.stockedAt.seconds * 1000).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                          </span>
                        </div>
                      </div>
                    </div>
                    <button 
                      onClick={() => deleteEntry(entry.id)}
                      className="p-2 text-slate-300 hover:text-rose-500 hover:bg-rose-50 rounded-lg transition-all"
                    >
                      <Trash2 className="w-5 h-5" />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

function Clock({ className }: { className?: string }) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>
  );
}
