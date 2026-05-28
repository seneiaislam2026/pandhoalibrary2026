import React, { useEffect, useState, useRef, useCallback } from 'react';
import { useAuth } from '../../store/AuthContext';
import { Search, Plus, Edit2, Trash2, BookOpen, ShieldAlert, Download, X, Layers, Users, CheckCircle, Clock, Hash, Image as ImageIcon, Upload, Link, AlertCircle } from 'lucide-react';
import { onSnapshot, collection, doc, setDoc, deleteDoc, updateDoc, addDoc, query, where, getDocs, serverTimestamp, writeBatch } from 'firebase/firestore';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { motion, AnimatePresence } from 'motion/react';
import { db, auth, storage } from '../../lib/firebase';
import { firebaseService } from '../../services/firebaseService';
import toast from 'react-hot-toast';
import Select from 'react-select';
import CreatableSelect from 'react-select/creatable';

export const reactSelectCustomStyles = {
  control: (base: any, state: any) => ({
    ...base,
    border: state.isFocused ? '2px solid #6366f1' : '1px solid #e2e8f0',
    borderRadius: '1rem',
    padding: '0.4rem',
    boxShadow: 'none',
    backgroundColor: '#f8fafc',
    minHeight: '54px'
  }),
  option: (base: any, state: any) => ({
    ...base,
    backgroundColor: state.isSelected ? '#e0e7ff' : state.isFocused ? '#f1f5f9' : 'white',
    color: state.isSelected ? '#4f46e5' : '#334155',
    cursor: 'pointer',
    fontFamily: 'inherit',
    fontWeight: state.isSelected ? 'bold' : 'normal',
    padding: '0.75rem 1rem'
  }),
  menu: (base: any) => ({
    ...base,
    borderRadius: '1rem',
    overflow: 'hidden',
    boxShadow: '0 10px 15px -3px rgba(0, 0, 0, 0.1), 0 4px 6px -4px rgba(0, 0, 0, 0.1)',
    zIndex: 9999
  })
};

interface Book {
  id: string;
  title: string;
  author: string;
  category: string;
  status: string;
  cover: string;
  bookCode?: string;
  shelfNo?: string;
  price?: number;
  review?: string;
  description?: string;
  barcode?: string;
  createdAt?: any;
  updatedAt?: any;
  expectedReturnDate?: string;
}

enum OperationType {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  LIST = 'list',
  GET = 'get',
  WRITE = 'write',
}

interface FirestoreErrorInfo {
  error: string;
  operationType: OperationType;
  path: string | null;
  authInfo: {
    userId?: string | null;
    email?: string | null;
  }
}

function handleFirestoreError(error: unknown, operationType: OperationType, path: string | null, userId?: string | null, email?: string | null) {
  const errInfo: FirestoreErrorInfo = {
    error: error instanceof Error ? error.message : String(error),
    authInfo: {
      userId: userId || 'Not Authenticated',
      email: email || 'No Email',
    },
    operationType,
    path
  };
  console.error('Firestore Error: ', JSON.stringify(errInfo));
  
  if (operationType === OperationType.WRITE || operationType === OperationType.DELETE || operationType === OperationType.UPDATE) {
      toast.error(`অ্যাকশন ব্যর্থ হয়েছে: আপনার মেম্বারশিপ স্ট্যাটাস চেক করুন অথবা এডমিনের সাথে যোগাযোগ করুন। (Permission Error)`);
  }
}

const engToBdNum = (str: string) => {
  const bdNumbers = { '0': '০', '1': '১', '2': '২', '3': '৩', '4': '৪', '5': '৫', '6': '৬', '7': '৭', '8': '৮', '9': '৯' };
  return str.replace(/[0-9]/g, (w) => (bdNumbers as any)[w] || w);
};
const bdToEngNum = (str: string) => {
  const engNumbers = { '০': '0', '১': '1', '২': '2', '৩': '3', '৪': '4', '৫': '5', '৬': '6', '৭': '7', '৮': '8', '৯': '9' };
  return str.replace(/[০-৯]/g, (w) => (engNumbers as any)[w] || w);
};

export const BOOK_CATEGORIES = [
  "মুক্তিযুদ্ধ", "ইতিহাস", "উপন্যাস", "ছোটগল্প", "কবিতা", "প্রবন্ধ", "গবেষণা", 
  "জীবনী ও স্মৃতিচারণ", "সায়েন্স ফিকশন", "ধর্ম ও দর্শন", "ইসলামী বই", 
  "শিশু-কিশোর", "অনুবাদ সাহিত্য", "গোয়েন্দা, থ্রিলার ও অ্যাডভেঞ্চার", 
  "রহস্য ও ভৌতিক", "বিজ্ঞান ও প্রযুক্তি", "রাজনীতি", "অর্থনীতি", 
  "সমাজতত্ত্ব", "আইন ও বিচার", "স্বাস্থ্য ও চিকিৎসা", "কৃষি ও পরিবেশ", 
  "ভ্রমণ কাহিনী", "মোটিভেশন ও আত্মউন্নয়ন", "স্যাটায়ার ও রম্য", "রান্নাবান্না", 
  "নাটক", "ফিকশন", "একাডেমিক", "অভিধান ও রেফারেন্স", "ম্যাগাজিন ও সাময়িকী", 
  "গণমাধ্যম", "সাহিত্য", "রচনাসমগ্র", "ফটোগ্রাফি ও শিল্পকলা", "ক্রীড়া ও বিনোদন", 
  "কম্পিউটার ও ইন্টারনেট", "ভাষা ও ব্যাকরণ", "ভৌগোলিক ও মানচিত্র", 
  "পারিবারিক ও সামাজিক", "পেইশাজীবী ও ব্যবসায়িক", "অন্যান্য"
];

const generateBookCode = (category: string) => {
  let prefix = 'B';
  const catMap: Record<string, string> = {
    "মুক্তিযুদ্ধ": "LIB", "ইতিহাস": "HIS", "উপন্যাস": "NOV", "ছোটগল্প": "SST", "কবিতা": "POE",
    "প্রবন্ধ": "ESS", "গবেষণা": "RES", "জীবনী ও স্মৃতিচারণ": "BIO", "সায়েন্স ফিকশন": "SCI",
    "ধর্ম ও দর্শন": "REL", "ইসলামী বই": "ISL", "শিশু-কিশোর": "CHI", "অনুবাদ সাহিত্য": "TRA",
    "গোয়েন্দা, থ্রিলার ও অ্যাডভেঞ্চার": "THR", "রহস্য ও ভৌতিক": "HOR", "বিজ্ঞান ও প্রযুক্তি": "TEC",
    "রাজনীতি": "POL", "অর্থনীতি": "ECO", "সমাজতত্ত্ব": "SOC", "আইন ও বিচার": "LAW",
    "স্বাস্থ্য ও চিকিৎসা": "HEA", "কৃষি ও পরিবেশ": "AGR", "ভ্রমণ কাহিনী": "TRV",
    "মোটিভেশন ও আত্মউন্নয়ন": "MOT", "স্যাটায়ার ও রম্য": "SAT", "রান্নাবান্না": "COO",
    "নাটক": "DRA", "ফিকশন": "FIC", "একাডেমিক": "ACA", "অভিধান ও রেফারেন্স": "REF",
    "ম্যাগাজিন ও সাময়িকী": "MAG", "গণমাধ্যম": "MED", "সাহিত্য": "LIT", "রচনাসমগ্র": "COL",
    "ফটোগ্রাফি ও শিল্পকলা": "ART", "ক্রীড়া ও বিনোদন": "SPO", "কম্পিউটার ও ইন্টারনেট": "COM",
    "ভাষা ও ব্যাকরণ": "LAN", "ভৌগোলিক ও মানচিত্র": "GEO", "পারিবারিক ও সামাজিক": "FAM",
    "পেশাজীবী ও ব্যবসায়িক": "BUS"
  };
  prefix = catMap[category] || 'GEN';
  const randomNum = Math.floor(1000 + Math.random() * 9000);
  return `${prefix}-${randomNum}`;
};

const BookFormModal = React.memo(({ initialData, editingId, onClose, onSubmit, isSubmitting }: any) => {
  const [formData, setFormData] = useState(initialData);

  const handleFormSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSubmit(formData);
  };

  return (
    <div className="fixed inset-0 z-[100] flex flex-col justify-end sm:justify-center p-0 sm:p-4 bg-slate-900/60 backdrop-blur-sm animate-in fade-in duration-300">
       <motion.div initial={{ y: "100%", opacity: 0 }} animate={{ y: 0, opacity: 1 }} className="bg-white rounded-t-3xl sm:rounded-[2.5rem] shadow-2xl w-full max-w-lg max-h-[85vh] sm:max-h-[90vh] overflow-hidden flex flex-col mt-auto sm:mt-0 pb-safe">
          <div className="p-4 sm:p-8 border-b border-slate-100 flex justify-between items-center bg-white shrink-0">
             <h3 className="text-xl sm:text-2xl font-black text-slate-800 font-bengali">{editingId ? 'বই আপডেট' : 'নতুন বই যুক্ত'}</h3>
             <button type="button" onClick={onClose} className="p-2 hover:bg-slate-100 rounded-full transition-colors"><X size={20} className="text-slate-400" /></button>
          </div>
          <form id="bookForm" onSubmit={handleFormSubmit} className="p-4 sm:p-8 overflow-y-auto space-y-4 sm:space-y-6 flex-1">
             <div className="grid grid-cols-2 gap-3 sm:gap-6">
                <div className="space-y-1.5">
                   <label className="text-[10px] sm:text-xs font-black text-slate-400 uppercase tracking-widest font-bengali">বই কোড</label>
                   <input type="text" value={formData.bookCode || ''} onChange={e=>setFormData({...formData, bookCode: e.target.value})} className="w-full px-3 py-2 sm:px-4 sm:py-3.5 bg-slate-50 border border-slate-200 rounded-xl sm:rounded-2xl focus:ring-2 focus:ring-indigo-500/50 outline-none font-bold text-sm" placeholder="NOV-1234" />
                </div>
                <div className="space-y-1.5">
                   <label className="text-[10px] sm:text-xs font-black text-slate-400 uppercase tracking-widest font-bengali">শেল্ফ নং</label>
                   <input type="text" value={formData.shelfNo || ''} onChange={e=>setFormData({...formData, shelfNo: e.target.value})} className="w-full px-3 py-2 sm:px-4 sm:py-3.5 bg-slate-50 border border-slate-200 rounded-xl sm:rounded-2xl focus:ring-2 focus:ring-indigo-500/50 outline-none font-bold text-sm" placeholder="A1, B2..." />
                </div>
             </div>
             <div className="space-y-1.5">
                <label className="text-[10px] sm:text-xs font-black text-slate-400 uppercase tracking-widest font-bengali">বইয়ের নাম</label>
                <input type="text" required value={formData.title || ''} onChange={e=>setFormData({...formData, title: e.target.value})} className="w-full px-3 py-2 sm:px-4 sm:py-4 bg-slate-50 border border-slate-200 rounded-xl sm:rounded-2xl focus:ring-2 focus:ring-indigo-500/50 outline-none font-bold font-bengali text-sm sm:text-base" />
             </div>
             <div className="space-y-1.5">
                <label className="text-[10px] sm:text-xs font-black text-slate-400 uppercase tracking-widest font-bengali">লেখকের নাম</label>
                <input type="text" required value={formData.author} onChange={e=>setFormData({...formData, author: e.target.value})} className="w-full px-3 py-2 sm:px-4 sm:py-4 bg-slate-50 border border-slate-200 rounded-xl sm:rounded-2xl focus:ring-2 focus:ring-indigo-500/50 outline-none font-bold font-bengali text-sm sm:text-base" />
             </div>

             {/* Image Upload/Link Section */}
             <div className="space-y-3 p-4 bg-slate-50 rounded-2xl border border-slate-100">
                <div className="flex items-center justify-between">
                   <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest font-bengali">বইয়ের কভার ইমেজ <span className="text-slate-400 normal-case">(ঐচ্ছিক)</span></label>
                   <div className="flex bg-white p-1 rounded-lg border border-slate-200">
                      <button 
                        type="button"
                        onClick={() => setFormData({...formData, _inputType: 'upload'})}
                        className={`px-3 py-1.5 rounded-md text-[10px] font-black transition-all flex items-center gap-1.5 ${(!formData._inputType || formData._inputType === 'upload') ? 'bg-indigo-600 text-white shadow-sm' : 'text-slate-400 hover:text-slate-600'}`}
                      >
                        <Upload size={12} /> আপলোড
                      </button>
                      <button 
                        type="button"
                        onClick={() => setFormData({...formData, _inputType: 'link'})}
                        className={`px-3 py-1.5 rounded-md text-[10px] font-black transition-all flex items-center gap-1.5 ${formData._inputType === 'link' ? 'bg-indigo-600 text-white shadow-sm' : 'text-slate-400 hover:text-slate-600'}`}
                      >
                        <Link size={12} /> লিঙ্ক
                      </button>
                   </div>
                </div>

                {(!formData._inputType || formData._inputType === 'upload') ? (
                  <div className="space-y-3">
                     <div 
                        onClick={() => document.getElementById('coverUpload')?.click()}
                        className="group relative h-32 bg-white border-2 border-dashed border-slate-200 rounded-xl flex flex-col items-center justify-center cursor-pointer hover:border-indigo-500 hover:bg-indigo-50/30 transition-all overflow-hidden"
                     >
                        {formData.cover ? (
                          <>
                            <img src={formData.cover} alt="Preview" className="w-full h-full object-contain p-2" />
                            <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                               <p className="text-white text-[10px] font-black uppercase tracking-widest flex items-center gap-2">
                                  <ImageIcon size={14} /> পরিবর্তন করুন
                               </p>
                            </div>
                          </>
                        ) : (
                          <>
                            <div className="p-3 bg-slate-50 rounded-full text-slate-400 group-hover:bg-indigo-100 group-hover:text-indigo-600 transition-colors">
                               <Upload size={20} />
                            </div>
                            <p className="mt-2 text-[10px] font-bold text-slate-400 group-hover:text-indigo-600">ক্লিক করে ইমেজ সিলেক্ট করুন</p>
                            <p className="text-[9px] text-slate-300">সর্বোচ্চ ২ মেগাবাইট</p>
                          </>
                        )}
                        <input 
                           id="coverUpload" 
                           type="file" 
                           accept="image/*" 
                           className="hidden" 
                           onChange={async (e) => {
                              const file = e.target.files?.[0];
                              if (!file) return;
                              
                              if (file.size > 2 * 1024 * 1024) {
                                 return toast.error('ফাইল সাইজ ২ মেগাবাইটের বেশি হওয়া যাবে না।');
                              }

                              const loadingToast = toast.loading('ইমেজ আপলোড হচ্ছে...');
                              try {
                                 const storageRef = ref(storage, `book_covers/${Date.now()}_${file.name}`);
                                 const snapshot = await uploadBytes(storageRef, file);
                                 const url = await getDownloadURL(snapshot.ref);
                                 setFormData({...formData, cover: url});
                                 toast.success('ইমেজ আপলোড সফল হয়েছে', { id: loadingToast });
                              } catch (err) {
                                 console.error(err);
                                 toast.error('আপলোড ব্যর্থ হয়েছে', { id: loadingToast });
                              }
                           }}
                        />
                     </div>
                  </div>
                ) : (
                  <div className="space-y-3">
                     <input 
                        type="url" 
                        value={formData.cover || ''} 
                        onChange={e=>setFormData({...formData, cover: e.target.value})} 
                        className="w-full px-4 py-3 bg-white border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500/50 outline-none font-bold text-xs" 
                        placeholder="ইমেজ লিঙ্ক পেস্ট করুন (https://...)" 
                     />
                     {formData.cover && (
                        <div className="h-24 bg-white rounded-xl border border-slate-200 p-2 flex items-center gap-3">
                           <img src={formData.cover} alt="Preview" className="h-full w-auto rounded-lg object-cover shadow-sm" />
                           <div className="flex-1 overflow-hidden">
                              <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">প্রিভিউ</p>
                              <p className="text-[10px] text-slate-500 truncate">{formData.cover}</p>
                           </div>
                           <button type="button" onClick={() => setFormData({...formData, cover: ''})} className="p-1.5 text-slate-300 hover:text-rose-500 transition-colors"><Trash2 size={14} /></button>
                        </div>
                     )}
                  </div>
                )}
             </div>

             <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-6">
                <div className="space-y-1.5">
                   <label className="text-[10px] sm:text-xs font-black text-slate-400 uppercase tracking-widest font-bengali">ক্যাটাগরি</label>
                   <CreatableSelect options={BOOK_CATEGORIES.map(c=>({value:c,label:c}))} styles={reactSelectCustomStyles} value={formData.category?{value:formData.category,label:formData.category}:null} onChange={(v:any)=>setFormData({...formData, category: v?.value, bookCode: generateBookCode(v?.value)})} menuPlacement="top" />
                </div>
                <div className="space-y-1.5">
                   <label className="text-[10px] sm:text-xs font-black text-slate-400 uppercase tracking-widest font-bengali">স্ট্যাটাস</label>
                   <Select options={[{value:'Available',label:'এভেইলেবেল'}, {value:'Issued',label:'ইস্যু করা'}]} styles={reactSelectCustomStyles} value={{value:formData.status, label: formData.status === 'Available' ? 'এভেইলেবেল' : 'ইস্যু করা'}} onChange={(v:any)=>setFormData({...formData, status: v.value})} menuPlacement="top" />
                </div>
             </div>
          </form>
          <div className="p-4 sm:p-8 border-t border-slate-100 bg-slate-50 shrink-0 flex gap-3 sm:gap-4 mb-safe">
             <button type="button" onClick={onClose} className="flex-1 py-2 sm:py-4 px-4 sm:px-6 rounded-xl sm:rounded-2xl bg-white border border-slate-200 text-slate-600 font-bold hover:bg-slate-100 transition-all font-bengali text-sm sm:text-base">বাতিল</button>
             <button type="submit" form="bookForm" disabled={isSubmitting} className="flex-[2] py-2 sm:py-4 px-4 sm:px-6 rounded-xl sm:rounded-2xl bg-indigo-600 text-white font-black hover:bg-indigo-700 shadow-[0_4px_14px_0_rgb(0,0,0,0.2)] transition-all active:scale-95 disabled:opacity-50 font-bengali text-sm sm:text-base">
               {isSubmitting ? 'সেভ হচ্ছে...' : editingId ? 'আপডেট করুন' : 'নতুন বই যুক্ত করুন'}
             </button>
          </div>
       </motion.div>
    </div>
  );
});

export default function ManageBooks() {
  const [books, setBooks] = useState<Book[]>([]);
  const [search, setSearch] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const { user, token } = useAuth();
  
  const [showModal, setShowModal] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isAiScanning, setIsAiScanning] = useState(false);
  const [isAiProcessing, setIsAiProcessing] = useState(false);
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [stream, setStream] = useState<MediaStream | null>(null);

  const [userIssuedBookIds, setUserIssuedBookIds] = useState<string[]>([]);
  const [userPastIssuedBookIds, setUserPastIssuedBookIds] = useState<string[]>([]);
  const [userIssueCount, setUserIssueCount] = useState(0);
  const [requestedBooks, setRequestedBooks] = useState<string[]>([]);
  const [prebooking, setPrebooking] = useState<string | null>(null);
  const [detailsModalBook, setDetailsModalBook] = useState<Book | null>(null);
  const [bookExpectedReturn, setBookExpectedReturn] = useState<string | null>(null);

  const isActuallyAdmin = user?.role === 'admin' || user?.email === 'seneiaislam@gmail.com' || user?.username === 'admin';
  const isAdminRole = user?.role === 'admin' || user?.role === 'subadmin';

  const [formData, setFormData] = useState<Partial<Book>>({ 
    title: '', author: '', category: '', cover: '', status: 'Available', bookCode: '', shelfNo: '', review: '', description: '', barcode: ''
  });
  const [coverInputType, setCoverInputType] = useState<'upload' | 'link'>('upload');

  useEffect(() => {
    const fetchBooks = async () => {
      try {
        const cached = sessionStorage.getItem('admin_books_cache');
        const cacheTime = sessionStorage.getItem('admin_books_cache_time');
        if (cached && cacheTime && (Date.now() - parseInt(cacheTime) < 1 * 60 * 1000)) {
          setBooks(JSON.parse(cached));
          return;
        }
        const snapshot = await getDocs(collection(db, 'books'));
        const booksData = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data(), cover: doc.data().cover || doc.data().imageUrl })) as Book[];
        
        // Auto-sync stale states silently
        if (isActuallyAdmin) {
           try {
              const issuesSnap = await getDocs(query(collection(db, 'issues'), where('status', 'in', ['Issued', 'ISSUED'])));
              const validIssuedIds = issuesSnap.docs.map(d => d.data().bookId);
              
              let needsUpdate = false;
              for (const b of booksData) {
                 const isMarkedIssued = ['Issued', 'ISSUED'].includes(b.status);
                 const hasActiveIssue = validIssuedIds.includes(b.id);
                 
                 if (isMarkedIssued && !hasActiveIssue) {
                     b.status = 'Available';
                     await updateDoc(doc(db, 'books', b.id), { status: 'Available' });
                     needsUpdate = true;
                 } else if (!isMarkedIssued && hasActiveIssue) {
                     b.status = 'Issued';
                     await updateDoc(doc(db, 'books', b.id), { status: 'Issued' });
                     needsUpdate = true;
                 }
              }
              if (needsUpdate) {
                // If we corrected states, update the states list
                console.log("Stale book states synchronized.");
              }
           } catch(syncErr) {
              console.error("Sync error:", syncErr);
           }
        }

        setBooks(booksData);
        try {
          sessionStorage.setItem('admin_books_cache', JSON.stringify(booksData));
          sessionStorage.setItem('admin_books_cache_time', Date.now().toString());
        } catch (err) {
          console.warn('Could not cache books', err);
        }
      } catch (error) {
        handleFirestoreError(error, OperationType.GET, 'books', user?.id, user?.email);
      }
    };
    fetchBooks();
  }, [user]);

  useEffect(() => {
    if (!user) return;
    const unsub = onSnapshot(query(collection(db, 'issues'), where('userId', '==', user.id)), (snap) => {
      const active = snap.docs.filter(d => ['Issued', 'ISSUED'].includes(d.data().status)).map(d => d.data().bookId);
      const past = snap.docs.filter(d => ['Returned', 'RETURNED'].includes(d.data().status)).map(d => d.data().bookId);
      setUserIssuedBookIds(active);
      setUserPastIssuedBookIds(past);
      setUserIssueCount(active.length);
    }, (error) => {
      handleFirestoreError(error, OperationType.GET, 'issues');
    });
    return () => unsub();
  }, [user]);

  useEffect(() => {
    if (!user) return;
    const unsub = onSnapshot(query(collection(db, 'pre-bookings'), where('userId', '==', user.id), where('status', '==', 'Pending')), (snap) => {
      setRequestedBooks(snap.docs.map(d => d.data().bookId));
    }, (error) => {
      handleFirestoreError(error, OperationType.GET, 'pre-bookings');
    });
    return () => unsub();
  }, [user]);

  const updateCache = (newBooks: Book[]) => {
    try {
      sessionStorage.setItem('admin_books_cache', JSON.stringify(newBooks));
      sessionStorage.setItem('admin_books_cache_time', Date.now().toString());
    } catch (e) {
      console.warn("Could not cache books", e);
    }
    try {
      sessionStorage.removeItem('pub_books_cache');
    } catch (e) {}
  };

  const handleDownloadPDF = () => {
    const printWindow = window.open('', '_blank');
    if (!printWindow) return toast.error('উইন্ডো ওপেন করা সম্ভব হয়নি।');
    const todayDate = new Date().toLocaleDateString('bn-BD').replace(/[0-9]/g, w => String.fromCharCode(w.charCodeAt(0) + 2486));
    const sortedBooks = [...books].sort((a, b) => (a.bookCode || '').localeCompare(b.bookCode || ''));
    const content = sortedBooks.map((b, i) => `
      <tr>
        <td style="text-align:center">${(i+1).toString().replace(/[0-9]/g, w => String.fromCharCode(w.charCodeAt(0) + 2486))}</td>
        <td style="font-weight:bold">${b.title}</td>
        <td>${b.author}</td>
        <td style="text-align:center; color:#6366f1">${b.category || '---'}</td>
        <td style="text-align:center">
          ${b.bookCode ? `<img src="https://bwipjs-api.metafloor.com/?bcid=code128&text=${b.bookCode}&scale=2&height=10&includetext=true" height="30" />` : '---'}
        </td>
        <td style="text-align:center; font-weight:bold">${b.shelfNo || '---'}</td>
      </tr>`).join('');

    printWindow.document.write(`
      <html>
        <head>
          <title>বই তালিকা</title>
          <link href="https://fonts.googleapis.com/css2?family=Hind+Siliguri:wght@400;700&display=swap" rel="stylesheet">
          <style>
            body { font-family: 'Hind Siliguri', sans-serif; padding: 20px; color: #1e293b; }
            table { width: 100%; border-collapse: collapse; margin-top: 20px; }
            th, td { border: 1px solid #e2e8f0; padding: 10px; font-size: 13px; text-align: left; }
            th { background: #f8fafc; }
            .header { text-align: center; margin-bottom: 20px; }
            @media print { 
              .btn { display: none; } 
              @page { size: A4 portrait; margin: 15mm; }
              body { padding: 0; margin: 0; width: 100%; }
              table { width: 100%; max-width: 100%; table-layout: auto; page-break-inside: auto; }
              tr { page-break-inside: avoid; page-break-after: auto; }
              thead { display: table-header-group; }
              tfoot { display: table-footer-group; }
            }
          </style>
        </head>
        <body>
          <button class="btn" onclick="window.print()" style="padding:10px 20px; background:#indigo-600; color:white; border:none; border-radius:8px; cursor:pointer">প্রিন্ট করুন</button>
          <div class="header">
            <h2>পানধোয়া উন্মুক্ত পাঠাগার</h2>
            <p>বই তালিকা রিপোর্ট - তারিখ: ${todayDate}</p>
          </div>
          <table>
            <thead><tr><th>ক্রমিক</th><th>বইয়ের নাম</th><th>লেখক</th><th>ক্যাটাগরি</th><th>বারকোড</th><th>শেল্ফ</th></tr></thead>
            <tbody>${content}</tbody>
          </table>
        </body>
      </html>`);
    printWindow.document.close();
  };

  const handlePreBook = async (bookId: string) => {
    if (!user) return toast.error('দয়া করে লগইন করুন।');
    setPrebooking(bookId);
    try {
      await addDoc(collection(db, 'pre-bookings'), {
        userId: user.id,
        userName: user.name || user.username,
        userEmail: user.email,
        bookId,
        bookTitle: books.find(b => b.id === bookId)?.title,
        status: 'Pending',
        date: new Date().toISOString(),
        createdAt: serverTimestamp()
      });
      toast.success('অনুরোধ পাঠানো হয়েছে।');
    } catch (e) {
      handleFirestoreError(e, OperationType.CREATE, 'pre-bookings');
      toast.error('ব্যর্থ হয়েছে।');
    } finally {
      setPrebooking(null);
    }
  };

  const handleBookClick = async (book: Book) => {
    setDetailsModalBook(book);
    setBookExpectedReturn(null);
    if (String(book.status).toLowerCase() === 'issued' || String(book.status).toLowerCase() === 'issued') {
      try {
        const q = query(collection(db, 'issues'), where('bookId', '==', book.id), where('status', 'in', ['Issued', 'ISSUED']));
        const snap = await getDocs(q);
        if (!snap.empty) {
          const dateStr = snap.docs[0].data().expectedReturnDate;
          if (dateStr) setBookExpectedReturn(new Date(dateStr).toLocaleDateString('bn-BD'));
        }
      } catch (e) { console.error(e); }
    }
  };

  const handleEdit = (book: Book) => {
    setFormData({ ...book });
    setEditingId(book.id);
    setShowModal(true);
  };

  const handleDelete = async (id: string) => {
    if (!isActuallyAdmin) return toast.error('এডমিন পারমিশন প্রয়োজন।');
    if (!confirm('আপনি কি নিশ্চিত?')) return;
    try {
      await deleteDoc(doc(db, 'books', id));
      setBooks(prev => {
        const updated = prev.filter(b => b.id !== id);
        updateCache(updated);
        return updated;
      });
      toast.success('সফলভাবে ডিলিট করা হয়েছে।');
    } catch (e) { toast.error('ব্যর্থ হয়েছে।'); }
  };

   const handleSubmit = async (submittedData: any) => {
      setIsSubmitting(true);
      try {
        const { _inputType, ...cleanData } = submittedData;
        const code = cleanData.bookCode?.trim() || generateBookCode(cleanData.category || 'অন্যান্য');
        const payload = { ...cleanData, bookCode: code, updatedAt: serverTimestamp() };
        if (editingId) {
          await updateDoc(doc(db, 'books', editingId), payload);
          setBooks(prev => {
             const updated = prev.map(b => b.id === editingId ? { ...b, ...payload } : b);
             updateCache(updated);
             return updated;
          });
        } else {
          const ref = doc(collection(db, 'books'));
          await setDoc(ref, { ...payload, id: ref.id, createdAt: serverTimestamp() });
          setBooks(prev => {
            const updated = [...prev, { ...payload, id: ref.id } as Book];
            updateCache(updated);
            return updated;
          });
        }
        toast.success('সফল হয়েছে।');
        setShowModal(false);
      } catch (e) { 
        console.error(e);
        toast.error('ত্রুটি।'); 
      }
      finally { setIsSubmitting(false); }
   };

  const [visibleCount, setVisibleCount] = useState(24);
  const handleObserver = useCallback((node: any) => {
    if (!node) return;
    const observer = new IntersectionObserver(entries => {
      if (entries[0].isIntersecting) setVisibleCount(p => p + 24);
    });
    observer.observe(node);
  }, []);

  const filtered = books.filter(b => {
    const term = search.toLowerCase();
    const matchSearch = b.title.toLowerCase().includes(term) || b.author.toLowerCase().includes(term) || (b.bookCode || '').toLowerCase().includes(term);
    const matchCat = !categoryFilter || b.category === categoryFilter;
    let matchStatus = true;
    if (statusFilter === 'issued') matchStatus = isActuallyAdmin ? ['Issued', 'ISSUED'].includes(b.status) : userIssuedBookIds.includes(b.id);
    return matchSearch && matchCat && matchStatus;
  }).sort((a,b) => (a.bookCode || '').localeCompare(b.bookCode || ''));

  return (
    <div className="space-y-8 p-4 md:p-8 max-w-[1600px] mx-auto animate-in fade-in duration-1000">
      
      {/* Reverted Header & Stats Section to match screenshot */}
      <motion.div 
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="grid grid-cols-1 lg:grid-cols-12 gap-6"
      >
        <div className="lg:col-span-8 bg-slate-900 rounded-[2.5rem] p-6 sm:p-8 text-white relative overflow-hidden flex flex-col justify-between shadow-2xl">
          <div className="absolute top-0 right-0 w-80 h-80 bg-indigo-500/10 rounded-full blur-[120px] -mr-40 -mt-40"></div>
          <div className="absolute bottom-0 left-0 w-80 h-80 bg-purple-500/5 rounded-full blur-[120px] -ml-40 -mb-40"></div>
          
          <div className="relative z-10 flex flex-col xl:flex-row xl:items-start justify-between gap-6">
            <div className="space-y-4">
              <h2 className="text-4xl sm:text-6xl font-black tracking-tighter font-bengali leading-none">
                বই <span className="text-indigo-400">{isActuallyAdmin ? 'ব্যবস্থাপনা' : 'তালিকা'}</span>
              </h2>
              <p className="text-slate-400 font-bold font-bengali max-w-lg leading-relaxed text-xs md:text-base opacity-80">
                {isActuallyAdmin 
                  ? 'লাইব্রেরির বইয়ের ক্যাটালগ পরিচালনা করুন।' 
                  : 'সহজেই খুঁজুন আপনার কাঙ্ক্ষিত বইটি। লাইব্রেরির হাজারো সংগ্রহ এখন আপনার হাতের নাগালে।'}
              </p>
            </div>

            <div className="flex flex-col sm:flex-row gap-3">
              {isActuallyAdmin && (
                <motion.button
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                  onClick={handleDownloadPDF}
                  className="bg-slate-800/80 hover:bg-slate-700 backdrop-blur-xl text-white px-6 py-4 rounded-2xl font-bold text-xs flex items-center justify-center gap-2 border border-white/5 transition-all shadow-xl group"
                >
                  <Download className="w-4 h-4" />
                  তালিকা ডাউনলোড
                </motion.button>
              )}
              {isActuallyAdmin && (
                <motion.button
                  whileHover={{ scale: 1.02, y: -2 }}
                  whileTap={{ scale: 0.98 }}
                  onClick={() => { setEditingId(null); setFormData({ status: 'Available', title: '', author: '' }); setShowModal(true); }}
                  className="bg-gradient-to-br from-indigo-500 to-indigo-600 hover:from-indigo-400 hover:to-indigo-500 text-white px-8 py-4 rounded-2xl font-black text-sm flex items-center justify-center gap-2 shadow-[0_15px_30px_-10px_rgba(79,70,229,0.4)] transition-all group"
                >
                  <Plus className="w-5 h-5" /> 
                  বই যুক্ত করুন 
                </motion.button>
              )}
            </div>
          </div>

          <div className="relative z-10 grid grid-cols-2 md:grid-cols-4 gap-3 mt-8">
            {[
              { label: 'মোট বই', value: books.length, color: 'text-white' },
              { label: 'এভেইলেবল', value: books.filter(b => b.status === 'Available').length, color: 'text-emerald-400' },
              { label: 'ইস্যু করা', value: books.filter(b => ['Issued', 'ISSUED'].includes(b.status)).length, color: 'text-indigo-400', filter: 'issued' },
              { label: 'বর্তমানে নেই', value: books.filter(b => ['not available', 'not_available'].includes(String(b.status).toLowerCase())).length, color: 'text-rose-400' }
            ].map((stat, i) => (
              <motion.div 
                key={i}
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                onClick={() => stat.filter && setStatusFilter(stat.filter)}
                className={`bg-white/5 backdrop-blur-md border border-white/5 rounded-[1.5rem] p-4 transition-all group ${stat.filter ? 'cursor-pointer hover:bg-white/10 active:scale-95' : ''}`}
              >
                <p className="text-[9px] font-black text-slate-500 uppercase tracking-widest font-bengali mb-2">{stat.label}</p>
                <p className={`text-2xl font-black ${stat.color} tracking-tight tabular-nums`}>
                   {stat.value}
                </p>
              </motion.div>
            ))}
          </div>
        </div>

        <motion.div 
          initial={{ opacity: 0, x: 20 }}
          animate={{ opacity: 1, x: 0 }}
          className="lg:col-span-4 bg-white rounded-[2.5rem] p-6 border border-slate-100 shadow-xl flex flex-col justify-between relative overflow-hidden group"
        >
          <div className="relative z-10 h-full flex flex-col">
            <div className="flex items-center gap-3 mb-6">
              <div className="p-3 bg-indigo-600 text-white rounded-2xl shadow-xl shadow-indigo-100">
                <Search className="w-5 h-5" />
              </div>
              <div>
                <h3 className="font-black text-lg text-slate-800 font-bengali">অ্যাডভান্সড সার্চ</h3>
                <p className="text-[9px] font-black text-indigo-500 font-bengali uppercase tracking-widest">স্মার্ট ইনভেন্টরি ফিল্টার</p>
              </div>
            </div>
            
            <div className="space-y-4 flex-1">
              <div className="relative group/input">
                <input
                  type="text"
                  placeholder="বই, লেখক বা কোড দিয়ে খুঁজুন..."
                  value={search}
                  onChange={e => setSearch(e.target.value)}
                  className="w-full bg-slate-50 border-2 border-slate-100 px-5 py-3.5 rounded-2xl text-xs focus:outline-none focus:border-indigo-500 font-bengali transition-all hover:bg-white placeholder:text-slate-400"
                />
              </div>

              <div className="relative">
                <Select
                  value={categoryFilter ? { value: categoryFilter, label: categoryFilter } : null}
                  onChange={(selected: any) => setCategoryFilter(selected ? selected.value : '')}
                  options={[
                    { value: '', label: 'সব ক্যাটাগরি' },
                    ...BOOK_CATEGORIES.map(cat => ({ value: cat, label: cat }))
                  ]}
                  placeholder="শ্রেণীবিভাগ সিলেক্ট করুন"
                  styles={reactSelectCustomStyles}
                  className="font-bengali text-xs"
                />
              </div>

              <div className="pt-4 flex items-center justify-between border-t border-slate-50 mt-auto">
                <button 
                  onClick={() => { setSearch(''); setCategoryFilter(''); setStatusFilter(''); }}
                  className="text-[9px] font-black text-rose-500 hover:text-rose-700 transition-colors uppercase tracking-widest flex items-center gap-2 font-bengali"
                >
                  <X className="w-4 h-4" /> রিসেট ফিল্টার
                </button>
              </div>
            </div>
          </div>
        </motion.div>
      </motion.div>

      {/* Optimized Book Grid */}
      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-5 md:gap-8">
        <AnimatePresence mode="popLayout">
          {filtered.slice(0, visibleCount).map((book, idx) => (
            <motion.div
              layout
              key={book.id}
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ delay: (idx % 12) * 0.05, duration: 0.4 }}
              onClick={() => handleBookClick(book)}
              className="group flex flex-col bg-white rounded-[2rem] p-2 border border-slate-100 shadow-sm hover:shadow-2xl hover:shadow-indigo-500/10 hover:-translate-y-2 transition-all duration-500 cursor-pointer overflow-hidden relative"
            >
              <div className="relative aspect-[3/4] overflow-hidden rounded-[1.6rem] bg-slate-50 mb-2 grayscale-[0.1] group-hover:grayscale-0 transition-all duration-700">
                {book.cover ? (
                  <img src={book.cover} alt={book.title} className="w-full h-full object-cover transition-transform duration-1000 group-hover:scale-110" referrerPolicy="no-referrer" />
                ) : (
                  <div className="w-full h-full flex flex-col items-center justify-center bg-indigo-50/30">
                    <BookOpen size={48} className="text-indigo-200" />
                    <span className="text-[10px] font-bold text-indigo-300 mt-2 font-bengali">কভার নেই</span>
                  </div>
                )}
                
                {/* Stats Overlay on Image */}
                <div className="absolute inset-x-0 bottom-0 p-2.5 bg-gradient-to-t from-black/80 via-black/40 to-transparent translate-y-1 md:translate-y-full group-hover:translate-y-0 transition-transform duration-500 flex flex-wrap gap-1.5 opacity-0 md:opacity-100 group-hover:opacity-100">
                   {book.bookCode && (
                     <span className="px-2 py-0.5 rounded-md bg-white/20 backdrop-blur-md text-white text-[7px] font-mono border border-white/10 uppercase tracking-tighter">{book.bookCode}</span>
                   )}
                   {book.shelfNo && (
                     <span className="px-2 py-0.5 rounded-md bg-indigo-500/40 backdrop-blur-md text-white text-[7px] font-black font-bengali border border-indigo-400/20">শেল্ফ: {book.shelfNo}</span>
                   )}
                </div>

                <div className="absolute top-2.5 right-2.5 flex flex-col gap-1.5 items-end">
                   <div className={`px-2.5 py-1 rounded-full text-[8px] font-black backdrop-blur-md shadow-lg border border-white/20 text-white font-bengali ${['Issued', 'ISSUED'].includes(book.status) ? 'bg-rose-500/90' : 'bg-emerald-500/90'}`}>
                      {['Issued', 'ISSUED'].includes(book.status) ? 'অ্যালট করা' : 'এভেইলেবেল'}
                   </div>
                   {/* Mobile visibility for Shelf/Code if needed */}
                   <div className="md:hidden flex flex-col gap-1 items-end">
                      {book.shelfNo && <span className="px-2 py-0.5 rounded-full bg-indigo-600/80 backdrop-blur-md text-white text-[7px] font-black font-bengali border border-white/10">{book.shelfNo}</span>}
                   </div>
                </div>
              </div>

              <div className="px-2 space-y-1.5 flex-1 pt-1">
                <span className="text-[8px] font-black text-indigo-500 uppercase tracking-[0.12em] font-bengali bg-indigo-50 px-2 py-0.5 rounded-md inline-block">{book.category || 'সাধারণ'}</span>
                <h3 className="text-xs md:text-[13px] font-black text-slate-800 font-bengali line-clamp-2 min-h-[2.8em] leading-snug group-hover:text-indigo-600 transition-colors">
                  {book.title}
                </h3>
                <p className="text-[10px] font-bold text-slate-400 font-bengali truncate opacity-80">{book.author}</p>
                
                {/* Book Metadata Row */}
                <div className="flex items-center flex-wrap gap-2 pt-2 border-t border-slate-50 mt-1">
                   {book.bookCode ? (
                     <div className="flex items-center gap-1 text-slate-500 bg-slate-50 px-1.5 py-0.5 rounded-lg border border-slate-100">
                        <Hash size={10} className="opacity-50" />
                        <span className="text-[9px] font-black font-mono tracking-tighter">{book.bookCode}</span>
                     </div>
                   ) : (
                     <div className="flex items-center gap-1 text-slate-300 bg-slate-50/50 px-1.5 py-0.5 rounded-lg border border-slate-50">
                        <Hash size={10} className="opacity-30" />
                        <span className="text-[8px] font-bold font-bengali italic">কোড নেই</span>
                     </div>
                   )}
                   {book.shelfNo ? (
                     <div className="flex items-center gap-1 text-indigo-600 bg-indigo-50 px-1.5 py-0.5 rounded-lg border border-indigo-100">
                        <Layers size={10} className="opacity-60" />
                        <span className="text-[9px] font-black font-bengali">{book.shelfNo}</span>
                     </div>
                   ) : (
                     <div className="flex items-center gap-1 text-slate-300 bg-slate-50/50 px-1.5 py-0.5 rounded-lg border border-slate-50">
                        <Layers size={10} className="opacity-30" />
                        <span className="text-[8px] font-bold font-bengali italic">শেল্ফ নেই</span>
                     </div>
                   )}
                </div>
              </div>

              {/* Enhanced Action Buttons */}
              <div className="mt-4 px-1 pb-1">
                {isActuallyAdmin ? (
                  <div className="flex gap-2">
                    <button onClick={(e) => { e.stopPropagation(); handleEdit(book); }} className="flex-1 py-2.5 bg-indigo-50 text-indigo-600 hover:bg-indigo-600 hover:text-white rounded-xl transition-all flex justify-center items-center shadow-sm">
                      <Edit2 size={13} />
                    </button>
                    <button onClick={(e) => { e.stopPropagation(); handleDelete(book.id); }} className="flex-1 py-2.5 bg-rose-50 text-rose-600 hover:bg-rose-600 hover:text-white rounded-xl transition-all flex justify-center items-center shadow-sm">
                      <Trash2 size={13} />
                    </button>
                  </div>
                ) : (
                  <div className={`w-full py-3 rounded-xl text-[10px] font-black font-bengali text-center transition-all shadow-sm ${requestedBooks.includes(book.id) ? 'bg-amber-50 text-amber-600' : ['Issued', 'ISSUED'].includes(book.status) ? 'bg-slate-50 text-slate-300' : 'bg-slate-900 text-white group-hover:bg-indigo-600 shadow-indigo-100'}`}>
                    {requestedBooks.includes(book.id) ? 'রিকুয়েষ্ট পাঠানো হয়েছে' : ['Issued', 'ISSUED'].includes(book.status) ? 'বইটি এখন নেই' : 'বিস্তারিত দেখুন'}
                  </div>
                )}
              </div>
            </motion.div>
          ))}
        </AnimatePresence>
      </div>

      {filtered.length > visibleCount && <div ref={handleObserver} className="h-20 w-full flex items-center justify-center text-slate-400 font-bengali text-xs">অপেক্ষা করুন...</div>}

      {/* Add/Edit Modal */}
      {showModal && (
        <BookFormModal
           initialData={formData}
           editingId={editingId}
           onClose={() => setShowModal(false)}
           onSubmit={handleSubmit}
           isSubmitting={isSubmitting}
        />
      )}

      {/* Book Details Modal */}
      {detailsModalBook && (
         <div className="fixed inset-0 z-[110] flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-md animate-in fade-in duration-500">
            <motion.div 
               initial={{ scale: 0.9, opacity: 0, y: 20 }} 
               animate={{ scale: 1, opacity: 1, y: 0 }} 
               className="bg-white rounded-[2.5rem] shadow-2xl w-full max-w-4xl max-h-[90vh] overflow-hidden relative flex flex-col md:flex-row transform transition-all"
            >
               <button onClick={()=>setDetailsModalBook(null)} className="absolute top-6 right-6 z-30 p-2.5 bg-slate-100/80 hover:bg-rose-50 text-slate-400 hover:text-rose-500 rounded-full transition-all backdrop-blur-xl border border-slate-200 shadow-xl"><X size={20} /></button>
               
               {/* Image Section */}
               <div className="relative w-full md:w-[45%] bg-slate-50 flex items-center justify-center p-8 md:p-12 overflow-hidden border-b md:border-b-0 md:border-r border-slate-100">
                  <div className="absolute inset-0 opacity-10 blur-3xl scale-125 pointer-events-none">
                     {detailsModalBook.cover && <img src={detailsModalBook.cover} alt="" className="w-full h-full object-cover" referrerPolicy="no-referrer" />}
                  </div>
                  <div className="relative z-10 group">
                    <div className="absolute -inset-4 bg-indigo-500/10 rounded-3xl blur-2xl group-hover:bg-indigo-500/20 transition-all duration-700"></div>
                    {detailsModalBook.cover ? (
                      <img src={detailsModalBook.cover} alt={detailsModalBook.title} className="max-h-[350px] md:max-h-[450px] w-auto shadow-[0_35px_60px_-15px_rgba(0,0,0,0.3)] rounded-xl relative transform group-hover:scale-[1.02] transition-transform duration-700" referrerPolicy="no-referrer" />
                    ) : (
                      <div className="w-48 h-64 bg-slate-100 rounded-xl flex flex-col items-center justify-center gap-4 text-slate-300 relative shadow-xl">
                        <BookOpen size={64} />
                      </div>
                    )}
                  </div>
                  <div className="absolute bottom-6 left-6 right-6 flex justify-center gap-3">
                     <span className={`px-4 py-2 rounded-full text-[10px] font-black font-bengali backdrop-blur-md border ${['Issued', 'ISSUED'].includes(detailsModalBook.status) ? 'bg-rose-500/90 text-white border-rose-400' : 'bg-emerald-500/90 text-white border-emerald-400'}`}>
                        {['Issued', 'ISSUED'].includes(detailsModalBook.status) ? 'বর্তমানে লাইব্রেরিতে নেই' : 'এভেইলেবেল'}
                     </span>
                  </div>
               </div>

               {/* Content Section */}
               <div className="flex-1 p-8 md:p-14 overflow-y-auto bg-white">
                  <div className="space-y-8 h-full flex flex-col">
                    <div className="space-y-4">
                      <div className="flex flex-wrap gap-2">
                        <span className="px-4 py-1.5 rounded-full bg-indigo-50 text-indigo-600 text-[10px] font-black uppercase tracking-widest font-bengali">{detailsModalBook.category || 'সাধারণ'}</span>
                        <span className="px-4 py-1.5 rounded-full bg-slate-50 text-slate-500 text-[10px] font-mono font-bold tracking-wider">{detailsModalBook.bookCode}</span>
                      </div>
                      <h2 className="text-3xl md:text-5xl font-black text-slate-900 font-bengali leading-tight">{detailsModalBook.title}</h2>
                      <div className="flex items-center gap-3">
                         <div className="h-10 w-10 rounded-full bg-slate-100 flex items-center justify-center text-indigo-600 font-black text-lg">
                            {detailsModalBook.author[0]}
                         </div>
                         <div>
                            <p className="text-sm font-bold text-slate-400 font-bengali">রচনায়</p>
                            <p className="text-lg font-black text-slate-700 font-bengali leading-none">{detailsModalBook.author}</p>
                         </div>
                      </div>
                    </div>
                    
                    <div className="grid grid-cols-2 gap-4 py-6 border-y border-slate-100">
                       <div className="bg-slate-50 p-4 rounded-2xl">
                          <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest font-bengali mb-1">অবস্থান</p>
                          <div className="flex items-center gap-2 text-indigo-600">
                            <Layers size={18} />
                            <span className="text-lg font-black font-mono">শেল্ফ {detailsModalBook.shelfNo || 'N/A'}</span>
                          </div>
                       </div>
                       <div className="bg-slate-50 p-4 rounded-2xl">
                          <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest font-bengali mb-1">ফেরত দানের সম্ভাব্য তারিখ</p>
                          <div className="flex items-center gap-2 text-slate-600">
                            <Clock size={18} />
                            <span className="text-sm font-black font-bengali">{bookExpectedReturn || (['Issued', 'ISSUED'].includes(detailsModalBook.status) ? 'শীঘ্রই ফেরত আসবে' : 'প্রয়োজ্য নয়')}</span>
                          </div>
                       </div>
                    </div>

                    {detailsModalBook.description ? (
                      <div className="space-y-3">
                         <h4 className="text-xs font-black text-slate-400 uppercase tracking-widest font-bengali">বইয়ের সারসংক্ষেপ</h4>
                         <p className="text-base text-slate-600 font-bengali leading-relaxed">{detailsModalBook.description}</p>
                      </div>
                    ) : (
                      <div className="flex-1 flex flex-col items-center justify-center py-6 opacity-30 text-slate-400 border-2 border-dashed border-slate-100 rounded-3xl">
                         <BookOpen size={32} strokeWidth={1.5} />
                         <p className="text-xs font-bold font-bengali mt-2">কোনো বিবরণ প্রদান করা হয়নি</p>
                      </div>
                    )}

                    <div className="pt-6 mt-auto">
                      {!isActuallyAdmin && (
                        <button 
                          onClick={() => { handlePreBook(detailsModalBook.id); setDetailsModalBook(null); }}
                          disabled={requestedBooks.includes(detailsModalBook.id) || ['Issued', 'ISSUED'].includes(detailsModalBook.status)}
                          className={`w-full py-5 rounded-[1.75rem] font-black text-base font-bengali transition-all active:scale-95 shadow-2xl flex items-center justify-center gap-3 ${requestedBooks.includes(detailsModalBook.id) ? 'bg-amber-100 text-amber-700' : ['Issued', 'ISSUED'].includes(detailsModalBook.status) ? 'bg-slate-100 text-slate-400 cursor-not-allowed' : 'bg-indigo-600 text-white hover:bg-slate-900 shadow-indigo-100'}`}
                        >
                          {requestedBooks.includes(detailsModalBook.id) ? (
                            <>অনুরোধ প্রক্রিয়াধীন</>
                          ) : ['Issued', 'ISSUED'].includes(detailsModalBook.status) ? (
                            <>দুঃখিত, বইটি এখন নেই</>
                          ) : (
                            <><BookOpen size={20} /> পড়ার অনুরোধ জানান</>
                          )}
                        </button>
                      )}
                    </div>
                  </div>
               </div>
            </motion.div>
         </div>
      )}
    </div>
  );
}
