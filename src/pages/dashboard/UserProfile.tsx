import React, { useEffect, useState, useRef } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../../store/AuthContext';
import { 
  UserCircle2, 
  Calendar, 
  BookmarkCheck, 
  CreditCard, 
  Send, 
  CheckCircle2, 
  Camera, 
  AlertCircle, 
  ShieldAlert, 
  Pencil, 
  BookOpen, 
  Bell, 
  MessageSquare, 
  Activity,
  ArrowRight,
  BadgeCheck, 
  Download,
  X,
  Plus,
  GraduationCap
} from 'lucide-react';
import { onSnapshot, collection, doc, updateDoc, query, where, serverTimestamp, setDoc, addDoc, limit, getDocs, getDoc, getDocsFromCache, getDocsFromServer, documentId } from 'firebase/firestore';
import { db } from '../../lib/firebase';
import toast from 'react-hot-toast';
import { motion, AnimatePresence } from 'motion/react';
import { cn } from '../../lib/utils';

const calculateAge = (dob: string) => {
  if (!dob) return '';
  const birthDate = new Date(dob);
  const now = new Date();
  let age = now.getFullYear() - birthDate.getFullYear();
  const m = now.getMonth() - birthDate.getMonth();
  if (m < 0 || (m === 0 && now.getDate() < birthDate.getDate())) {
      age--;
  }
  return age;
};

export default function UserProfile() {
  const navigate = useNavigate();
  const { user, updateUser } = useAuth();
  const [payments, setPayments] = useState<any[]>([]);
  const [prebookings, setPrebookings] = useState<any[]>([]);
  const [books, setBooks] = useState<any[]>([]);
  const [issues, setIssues] = useState<any[]>([]);
  const [dues, setDues] = useState<any[]>([]);
  const [purchases, setPurchases] = useState<any[]>([]);
  const [uploadingImage, setUploadingImage] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  
  const [showReviewModal, setShowReviewModal] = useState(false);
  const [reviewFormData, setReviewFormData] = useState({ title: '', content: '' });

  const isSubscriptionGiftedAndActive = user?.hasGiftSubscription && (!user.giftSubscriptionExpiry || new Date(user.giftSubscriptionExpiry).getTime() > Date.now());
  const totalPaid = payments.filter((p:any) => p.status === 'Approved' || p.status === 'Paid' || !p.status).reduce((acc, p) => acc + Number(p.amount), 0);
  const totalDues = isSubscriptionGiftedAndActive ? 0 : dues.filter(d => d.userId === user?.id && d.status === 'Unpaid').reduce((acc, d) => acc + Number(d.amount), 0);

  const [messages, setMessages] = useState<any[]>([]);
  const [notices, setNotices] = useState<any[]>([]);

  const [donorRecord, setDonorRecord] = useState<any>(null);
  const [donorPayments, setDonorPayments] = useState<any[]>([]);
  const [eventBanners, setEventBanners] = useState<string[]>([]);
  const [dismissedBanners, setDismissedBanners] = useState<string[]>([]);
  const [myEvents, setMyEvents] = useState<any[]>([]);
  const [myRegistrations, setMyRegistrations] = useState<any[]>([]);

  const [isEditingProfile, setIsEditingProfile] = useState(false);
  const [saveLoading, setSaveLoading] = useState(false);
  const [profileFormData, setProfileFormData] = useState({
    name: user?.name || '',
    phone: user?.phone || '',
    address: user?.address || ''
  });

  useEffect(() => {
    if (!user) return;
    
    const fetchProfileData = async () => {
      try {
        const cacheKey = 'up_fresh_' + user.id;
        const lastFetch = sessionStorage.getItem(cacheKey);
        const now = Date.now();
        const needsRefresh = !lastFetch || (now - parseInt(lastFetch)) > 60000;

        const cachedBooks = sessionStorage.getItem('pub_books_cache');
        const cachedNotices = sessionStorage.getItem('main_notices_cache');
        const cachedProfile = sessionStorage.getItem('usr_profile_' + user.id);

        if (cachedProfile && cachedBooks && cachedNotices && !needsRefresh) {
           const parsed = JSON.parse(cachedProfile);
           setDonorRecord(parsed.donorRecord);
           setDonorPayments(parsed.donorPayments);
           setPayments(parsed.payments);
           setPrebookings(parsed.prebookings);
           setIssues(parsed.issues);
           setPurchases(parsed.purchases);
           setMessages(parsed.messages);
           setDues(parsed.dues || []);
           if (parsed.eventBanners) setEventBanners(parsed.eventBanners);
           setMyEvents(parsed.myEvents || []);
           setMyRegistrations(parsed.myRegistrations || []);
           setBooks(JSON.parse(cachedBooks));
           setNotices(JSON.parse(cachedNotices));
           return;
        }

        const safeGetDocs = async (q: any) => {
          try {
            return await getDocs(q);
          } catch (e) {
            console.error(e);
            return { empty: true, docs: [] };
          }
        };

        const donorSnap = await safeGetDocs(query(collection(db, "donor-members"), where("phone", "==", user.phone || '')));
        
        let donor = null;
        let dPayments: any[] = [];
        
        if (!donorSnap.empty) {
            donor = { id: donorSnap.docs[0].id, ...(donorSnap.docs[0].data() as object) };
            const dPaySnap = await safeGetDocs(query(collection(db, 'donor-payments'), where('donorId', '==', donor.id)));
            dPayments = dPaySnap.docs.map(doc => ({ id: doc.id, ...(doc.data() as object) }));
        }

        const [paySnap, preSnap, issuesSnap, purchSnap, msgSnap, notSnap, duesSnap, settingsSnap, eventsSnap, regSnap] = await Promise.all([
          safeGetDocs(query(collection(db, "payments"), where("userId", "==", user.id))),
          safeGetDocs(query(collection(db, "pre-bookings"), where("userId", "==", user.id))),
          safeGetDocs(query(collection(db, "issues"), where("userId", "==", user.id))),
          safeGetDocs(query(collection(db, "purchases"), where("userId", "==", user.id))),
          safeGetDocs(query(collection(db, 'messages'), where('toUserId', '==', user.id))),
          safeGetDocs(query(collection(db, 'notices'), limit(20))),
          safeGetDocs(query(collection(db, 'dues'), where('userId', '==', user.id))),
          getDoc(doc(db, "settings", "general")),
          safeGetDocs(query(collection(db, 'events'), where('status', '!=', 'Closed'))),
          safeGetDocs(query(collection(db, 'event_registrations'), where('userId', '==', user.id)))
        ]);

        const paymentsData = paySnap.docs.map(doc => ({ id: doc.id, ...(doc.data() as object) }));
        const preData = preSnap.docs.map(doc => ({ id: doc.id, ...(doc.data() as object) }));
        const issuesData = issuesSnap.docs.map(doc => ({ id: doc.id, ...(doc.data() as object) }));
        const purchData = purchSnap.docs.map(doc => ({ id: doc.id, ...(doc.data() as object) }));
        const msgData = msgSnap.docs.map(doc => ({ id: doc.id, ...(doc.data() as object) }));
        const notData = notSnap.docs.map(doc => ({ id: doc.id, ...(doc.data() as object) }));
        const duesData = duesSnap.docs.map(doc => ({ id: doc.id, ...(doc.data() as object) }));
        const settingsData = settingsSnap.exists() ? (settingsSnap.data() as any) : {};
        const regData = regSnap.docs.map(doc => ({ id: doc.id, ...(doc.data() as object) } as any));
        
        const eventIds = new Set(regData.map(r => r.eventId));
        let regEventsData: any[] = [];
        if (eventIds.size > 0) {
           const evQ = query(collection(db, 'events'), where(documentId(), 'in', Array.from(eventIds)));
           const evSnap = await getDocs(evQ);
           regEventsData = evSnap.docs.map(d => ({ id: d.id, ...d.data() }));
        }

        setMyRegistrations(regData.map(r => ({ ...r, event: regEventsData.find(e => e.id === r.eventId) })));
        
        const neededBookIds = new Set<string>();
        issuesData.forEach((i: any) => i.bookId && neededBookIds.add(i.bookId));
        preData.forEach((p: any) => p.bookId && neededBookIds.add(p.bookId));
        
        let booksData: any[] = [];
        if (neededBookIds.size > 0) {
          const idsArray = Array.from(neededBookIds).slice(0, 30);
          const bSnap = await getDocs(query(collection(db, 'books'), where(documentId(), 'in', idsArray)));
          booksData = bSnap.docs.map(doc => ({ id: doc.id, ...(doc.data() as object), cover: doc.data().cover || doc.data().imageUrl }));
        }

        let eventsList = eventsSnap.docs.map(doc => ({ id: doc.id, ...(doc.data() as object) }));
        if (user.role !== 'admin') {
           eventsList = eventsList.filter((ev: any) => !ev.targetUserPhone || ev.targetUserPhone === user.phone);
        }
        setMyEvents(eventsList);

        setDonorRecord(donor);
        setDonorPayments(dPayments);
        setPayments(paymentsData);
        setPrebookings(preData);
        setBooks(booksData);
        setIssues(issuesData);
        setPurchases(purchData);
        setMessages(msgData);
        setNotices(notData);
        setDues(duesData);

        const fetchedBanners = settingsData?.eventBanners || (settingsData?.eventBanner ? [settingsData.eventBanner] : []);
        setEventBanners(fetchedBanners);

        const profileData = {
           donorRecord: donor,
           donorPayments: dPayments,
           payments: paymentsData,
           prebookings: preData,
           issues: issuesData,
           purchases: purchData,
           messages: msgData,
           dues: duesData,
           myEvents: eventsList,
           myRegistrations: regData.map(r => ({ ...r, event: regEventsData.find((e:any) => e.id === r.eventId) })),
           eventBanners: fetchedBanners
        };

        try {
          sessionStorage.setItem('usr_profile_' + user.id, JSON.stringify(profileData));
          sessionStorage.setItem('pub_books_cache', JSON.stringify(booksData));
          sessionStorage.setItem('main_notices_cache', JSON.stringify(notData));
          sessionStorage.setItem(cacheKey, now.toString());
        } catch (storageErr) {
          console.warn("Storage limit exceeded when caching user profile", storageErr);
        }

      } catch (err) {
        console.error("Error fetching user profile:", err);
      }
    };

    fetchProfileData();
  }, [user]);

  const handleAvatarChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !user) return;

    if (file.size > 2 * 1024 * 1024) {
      toast.error("ছবি ২ মেগাবাইটের কম হতে হবে।");
      return;
    }

    setUploadingImage(true);
    const reader = new FileReader();
    reader.onloadend = async () => {
      const img = new Image();
      img.onload = async () => {
        const canvas = document.createElement('canvas');
        const MAX_WIDTH = 400;
        const MAX_HEIGHT = 400;
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
        
        const base64String = canvas.toDataURL('image/jpeg', 0.6);
        try {
          await updateDoc(doc(db, "users", user.id), { avatar: base64String });
          updateUser({ ...user, avatar: base64String });
          toast.success('প্রোফাইল ছবি আপডেট হয়েছে');
        } catch (err) {
          console.error(err);
          toast.error('ছবি আপডেট করতে সমস্যা হয়েছে');
        } finally {
          setUploadingImage(false);
        }
      };
      img.src = reader.result as string;
    };
    reader.readAsDataURL(file);
  };

  const handleUpdateProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;
    setSaveLoading(true);
    try {
      await updateDoc(doc(db, "users", user.id), {
        ...profileFormData,
        updatedAt: serverTimestamp()
      });
      updateUser({ ...user, ...profileFormData });
      toast.success('প্রোফাইল সফলভাবে আপডেট হয়েছে');
      setIsEditingProfile(false);
    } catch (err) {
      console.error(err);
      toast.error('আপডেট করতে সমস্যা হয়েছে');
    } finally {
      setSaveLoading(false);
    }
  };

  const handleReviewSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;
    try {
      await addDoc(collection(db, "reviews"), {
        userId: user.id,
        userName: user.name,
        userAvatar: user.avatar || null,
        title: reviewFormData.title,
        content: reviewFormData.content,
        status: "Pending",
        createdAt: serverTimestamp()
      });
      toast.success('রিভিও সফলভাবে পাঠানো হয়েছে। অ্যাডমিন অ্যাপ্রুভ করলে এটি পাবলিকলি দেখা যাবে।');
      setReviewFormData({ title: '', content: '' });
      setShowReviewModal(false);
    } catch (err) {
      console.error(err);
      toast.error('রিভিও পাঠাতে সমস্যা হয়েছে');
    }
  };

  const downloadLibraryCard = () => {
    toast.success('লাইব্রেরি কার্ড জেনারেট হচ্ছে...');
    // Implement actual PDF generation logic if needed, or just link to a static design
  };

  const lateReturnCount = issues.filter(i => i.isLateReturn).length;
  const hasOverdueBooks = issues.some(i => String(i.status).toLowerCase() === 'issued' && new Date(i.expectedReturnDate).getTime() < Date.now());
  const isBorrowBlocked = user?.borrowBlocked || (lateReturnCount >= 10) || hasOverdueBooks;
  const isActiveProfile = user?.status !== 'Inactive' && user?.status !== 'Paused';

  const [bannerIndex, setBannerIndex] = useState(0);
  useEffect(() => {
    if (eventBanners.length > 0) {
      const timer = setInterval(() => {
        setBannerIndex(prev => (prev + 1) % eventBanners.length);
      }, 5000);
      return () => clearInterval(timer);
    }
  }, [eventBanners]);

   if (user?.role === 'scholarship') {
      return (
         <div className="max-w-3xl mx-auto space-y-8 pb-24 font-bengali">
            <div className="bg-white dark:bg-slate-900 rounded-3xl p-8 border border-emerald-100 dark:border-emerald-900 shadow-xl shadow-emerald-500/5 text-center mt-10">
               <div className="w-24 h-24 mx-auto bg-emerald-50 dark:bg-emerald-900/30 text-emerald-600 rounded-full flex items-center justify-center mb-6">
                  <GraduationCap size={48} />
               </div>
               <h2 className="text-2xl font-black font-bengali text-slate-800 dark:text-white mb-2">{user.name}</h2>
               <div className="inline-block px-4 py-1.5 bg-emerald-100 text-emerald-800 rounded-full text-xs font-bold font-bengali mb-6">বৃত্তি নিবন্ধিত সদস্য</div>
               
               <div className="grid grid-cols-2 gap-4 text-left">
                  <div className="bg-slate-50 dark:bg-slate-800 p-4 rounded-2xl border border-slate-100 dark:border-slate-700">
                     <div className="text-[10px] text-slate-400 font-bold uppercase tracking-widest mb-1">সদস্য আইডি</div>
                     <div className="font-mono font-bold text-slate-700 dark:text-slate-300">{user.memberId}</div>
                  </div>
                  <div className="bg-slate-50 dark:bg-slate-800 p-4 rounded-2xl border border-slate-100 dark:border-slate-700">
                     <div className="text-[10px] text-slate-400 font-bold uppercase tracking-widest mb-1">স্ট্যাটাস</div>
                     <div className="font-bengali font-bold text-slate-700 dark:text-slate-300">
                        {user.status === 'active' ? 'সক্রিয়' : user.status === 'on_hold' ? 'স্থগিত' : user.status === 'completed' ? 'সম্পন্ন' : 'অপেক্ষমান'}
                     </div>
                  </div>
                  {user.institution && (
                     <div className="col-span-2 bg-slate-50 dark:bg-slate-800 p-4 rounded-2xl border border-slate-100 dark:border-slate-700">
                        <div className="text-[10px] text-slate-400 font-bold uppercase tracking-widest mb-1">শিক্ষাপ্রতিষ্ঠান</div>
                        <div className="font-bengali font-bold text-slate-700 dark:text-slate-300">{user.institution} {user.class ? `(${user.class})` : ''}</div>
                     </div>
                  )}
               </div>
               
               <div className="mt-8 pt-6 border-t border-slate-100 dark:border-slate-800">
                  <p className="text-sm font-bengali text-slate-500">আপনার বৃত্তির বিস্তারিত তথ্য অ্যাডমিন প্যানেল থেকে পরিচালিত হচ্ছে।</p>
               </div>
            </div>
         </div>
      );
   }

  return (
    <div className="max-w-6xl mx-auto space-y-10 pb-24 font-bengali px-2 sm:px-6">
       {/* Page Header */}
       <div className="flex flex-col md:flex-row md:items-end justify-between gap-6 pb-6 border-b-2 border-slate-100 dark:border-slate-800/50">
        <div>
          <span className="text-sm font-black text-indigo-500 tracking-widest uppercase mb-2 block font-sans">User Center</span>
          <h2 className="text-4xl sm:text-5xl font-black tracking-tight text-slate-900 dark:text-white">আমার প্রোফাইল</h2>
          <p className="text-slate-500 font-medium text-base mt-2 max-w-xl">আপনার ব্যক্তিগত তথ্য, পঠিত বইয়ের রেকর্ড এবং পাঠাভ্যাস এখান থেকে পরিচালনা করুন।</p>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <Link to="/buy-books" className="inline-flex items-center gap-2 bg-indigo-600 text-white px-6 py-3.5 rounded-2xl font-black text-sm shadow-xl shadow-indigo-200/50 hover:bg-slate-900 transition-all active:scale-95">
             <BookmarkCheck className="w-5 h-5" />
             বই কিনুন
          </Link>
          <button onClick={() => setIsEditingProfile(true)} className="inline-flex items-center gap-2 bg-slate-50 dark:bg-slate-800 text-slate-700 dark:text-slate-200 px-6 py-3.5 rounded-2xl font-black text-sm hover:bg-slate-100 hover:text-slate-900 transition-all active:scale-95 shadow-sm border border-slate-200/60">
             <Pencil className="w-5 h-5" />
             ইডিট প্রোফাইল
          </button>
        </div>
      </div>

      {/* Bento Layout */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 sm:gap-8">
         {/* Identity Card (Left Sidebar on Desktop) */}
         <div className="lg:col-span-4 space-y-6 sm:space-y-8">
            <div className="bg-white dark:bg-slate-900 rounded-[2.5rem] p-8 shadow-sm border border-slate-200/60 dark:border-slate-800 relative overflow-hidden group">
               <div className="absolute top-0 right-0 w-48 h-48 bg-gradient-to-br from-indigo-100 to-fuchsia-50 dark:from-indigo-900/30 dark:to-fuchsia-900/20 rounded-full blur-[60px] opacity-60 group-hover:opacity-100 transition-opacity -mr-20 -mt-20"></div>
               <div className="absolute bottom-0 left-0 w-32 h-32 bg-blue-50 dark:bg-blue-900/20 rounded-full blur-[50px] opacity-60 -ml-10 -mb-10"></div>
               
               <div className="relative z-10 flex flex-col items-center mt-4">
                  <div className="relative mb-6">
                    <div className="w-36 h-36 rounded-[2.5rem] bg-white p-2 border-4 border-slate-50 shadow-xl group-hover:border-indigo-50 dark:border-slate-800 dark:bg-slate-900 dark:group-hover:border-indigo-900/30 transition-colors duration-500 overflow-hidden">
                       {user?.avatar ? (
                          <img src={user.avatar} alt="Profile" className="w-full h-full rounded-[2rem] object-cover" />
                       ) : (
                          <div className="w-full h-full rounded-[2rem] bg-indigo-50 dark:bg-indigo-900/30 flex items-center justify-center text-indigo-300">
                             <UserCircle2 className="w-16 h-16" />
                          </div>
                       )}
                    </div>
                    <button 
                      onClick={() => fileInputRef.current?.click()}
                      className="absolute -bottom-2 -right-2 p-3 bg-slate-900 text-white rounded-2xl shadow-2xl hover:bg-indigo-600 hover:-translate-y-1 transition-all active:scale-95 border-4 border-white dark:border-slate-900"
                    >
                       {uploadingImage ? <X className="w-4 h-4 animate-spin" /> : <Camera className="w-5 h-5" />}
                    </button>
                    <input type="file" ref={fileInputRef} onChange={handleAvatarChange} accept="image/*" className="hidden" />
                  </div>

                  <h3 className="text-2xl font-black text-slate-800 dark:text-white mb-2">{user?.name}</h3>
                  <div className="flex flex-wrap justify-center items-center gap-2 mb-8">
                     <span className="text-xs font-black text-indigo-700 bg-indigo-50 dark:bg-indigo-900/30 dark:text-indigo-400 px-4 py-1.5 rounded-full border border-indigo-100/50 dark:border-indigo-800/50 uppercase tracking-widest">
                        {user?.role === 'reader' ? 'পাঠক সদস্য' : user?.role === 'donor' ? 'দাতা সদস্য' : user?.role}
                     </span>
                     <span className="text-xs font-black text-slate-500 bg-slate-50 dark:bg-slate-800 dark:text-slate-400 px-4 py-1.5 rounded-full border border-slate-200/50 dark:border-slate-700 tracking-tighter">
                        ID: {user?.memberId || 'N/A'}
                     </span>
                  </div>

                  <div className="w-full space-y-3 bg-slate-50/50 dark:bg-slate-800/40 p-5 rounded-[2rem] border border-slate-100 dark:border-slate-700/50">
                     {user?.role === 'reader' && user?.dob && (
                        <div className="flex items-center justify-between py-2 border-b border-slate-100 dark:border-slate-700/50">
                           <span className="text-[11px] font-bold text-slate-400 capitalize tracking-widest font-sans">বয়স</span>
                           <span className="text-sm font-black text-slate-800 dark:text-slate-300 font-mono">{calculateAge(user.dob)} বছর</span>
                        </div>
                     )}
                     {user?.role === 'reader' && user?.class && (
                        <div className="flex items-center justify-between py-2 border-b border-slate-100 dark:border-slate-700/50">
                           <span className="text-[11px] font-bold text-slate-400 capitalize tracking-widest font-sans">শ্রেণি</span>
                           <span className="text-sm font-black text-slate-800 dark:text-slate-300 font-bengali">{user.class}</span>
                        </div>
                     )}
                     {user?.role === 'reader' && user?.fatherName && (
                        <div className="flex items-center justify-between py-2 border-b border-slate-100 dark:border-slate-700/50">
                           <span className="text-[11px] font-bold text-slate-400 capitalize tracking-widest font-sans">পিতা</span>
                           <span className="text-sm font-black text-slate-800 dark:text-slate-300 font-bengali">{user.fatherName}</span>
                        </div>
                     )}
                     {user?.role === 'reader' && user?.institution && (
                        <div className="flex flex-col gap-1 py-2 border-b border-slate-100 dark:border-slate-700/50">
                           <span className="text-[11px] font-bold text-slate-400 capitalize tracking-widest font-sans">শিক্ষাপ্রতিষ্ঠান</span>
                           <span className="text-sm font-black text-slate-800 dark:text-slate-300 font-bengali truncate w-full">{user.institution}</span>
                        </div>
                     )}
                     
                     <div className="flex items-center justify-between py-2">
                        <span className="text-[11px] font-bold text-slate-400 uppercase tracking-widest font-sans">Phone</span>
                        <span className="text-sm font-black text-slate-900 dark:text-slate-300 font-mono">{user?.phone || 'Not set'}</span>
                     </div>
                     <div className="flex items-center justify-between py-1">
                        <span className="text-[11px] font-bold text-slate-400 uppercase tracking-widest font-sans">Status</span>
                        <span className={cn(
                          "text-[10px] sm:text-[11px] font-black px-3 py-1 rounded-full uppercase tracking-widest",
                          isActiveProfile ? "bg-emerald-100 text-emerald-700" : "bg-rose-100 text-rose-700"
                        )}>
                           {isActiveProfile ? 'Active' : 'Inactive'}
                        </span>
                     </div>
                  </div>
               </div>
            </div>

            {/* Quick Actions (Moved below Identity) */}
            <div className="bg-white dark:bg-slate-900 rounded-[2.5rem] p-6 shadow-sm border border-slate-200/60 dark:border-slate-800">
               <h3 className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-4 ml-2">Quick Actions</h3>
               <div className="grid grid-cols-2 gap-3">
                  <button onClick={() => setShowReviewModal(true)} className="p-5 bg-slate-50 dark:bg-slate-800 hover:bg-slate-100 dark:hover:bg-slate-700 hover:scale-95 rounded-[1.5rem] transition-all group flex flex-col items-center gap-3 text-center border border-slate-200/30 dark:border-slate-700/50">
                     <div className="w-12 h-12 rounded-full bg-white dark:bg-slate-900 flex items-center justify-center text-slate-400 group-hover:text-fuchsia-500 shadow-sm transition-colors border border-slate-100 dark:border-slate-800">
                        <MessageSquare className="w-5 h-5" />
                     </div>
                     <span className="text-[11px] font-bold uppercase tracking-widest font-bengali text-slate-600 dark:text-slate-400 group-hover:text-slate-900 dark:group-hover:text-white">রিভিও লিখুন</span>
                  </button>
                  <button onClick={downloadLibraryCard} className="p-5 bg-slate-50 dark:bg-slate-800 hover:bg-slate-100 dark:hover:bg-slate-700 hover:scale-95 rounded-[1.5rem] transition-all group flex flex-col items-center gap-3 text-center border border-slate-200/30 dark:border-slate-700/50">
                     <div className="w-12 h-12 rounded-full bg-white dark:bg-slate-900 flex items-center justify-center text-slate-400 group-hover:text-emerald-500 shadow-sm transition-colors border border-slate-100 dark:border-slate-800">
                        <BadgeCheck className="w-6 h-6" />
                     </div>
                     <span className="text-[11px] font-bold uppercase tracking-widest font-bengali text-slate-600 dark:text-slate-400 group-hover:text-slate-900 dark:group-hover:text-white">আইডি কার্ড</span>
                  </button>
               </div>
            </div>
         </div>

         {/* Center/Right Content Area */}
         <div className="lg:col-span-8 space-y-6 sm:space-y-8">
            
            {/* Stats Bento */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 sm:gap-6">
               <div className="bg-gradient-to-br from-indigo-500 to-indigo-700 p-6 rounded-[2rem] text-white shadow-lg shadow-indigo-300/40 relative overflow-hidden group">
                  <div className="absolute -right-4 -bottom-4 opacity-20 transform group-hover:scale-110 group-hover:-rotate-12 transition-transform duration-500">
                     <CreditCard className="w-24 h-24" />
                  </div>
                  <div className="relative z-10">
                     <p className="text-[10px] font-black uppercase tracking-widest text-indigo-200 mb-2 font-bengali">মোট জমা</p>
                     <p className="text-3xl font-black font-mono">৳{totalPaid}</p>
                  </div>
               </div>
               
               <div className="bg-white dark:bg-slate-900 p-6 rounded-[2rem] border border-slate-200/60 dark:border-slate-800 shadow-sm flex flex-col justify-between group">
                  <div>
                    <div className="w-8 h-8 rounded-full bg-emerald-50 dark:bg-emerald-900/30 flex items-center justify-center text-emerald-500 mb-3 group-hover:scale-110 transition-transform">
                       <BookOpen className="w-4 h-4" />
                    </div>
                    <p className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-1 font-bengali">পঠিত বই</p>
                    <p className="text-3xl font-black text-slate-800 dark:text-white">{issues.filter(i => String(i.status).toLowerCase() === 'returned').length}</p>
                  </div>
               </div>
               
               <div className="bg-white dark:bg-slate-900 p-6 rounded-[2rem] border border-slate-200/60 dark:border-slate-800 shadow-sm flex flex-col justify-between group">
                  <div>
                    <div className="w-8 h-8 rounded-full bg-amber-50 dark:bg-amber-900/30 flex items-center justify-center text-amber-500 mb-3 group-hover:scale-110 transition-transform">
                       <BookmarkCheck className="w-4 h-4" />
                    </div>
                    <p className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-1 font-bengali">অ্যাক্টিভ বই</p>
                    <p className="text-3xl font-black text-slate-800 dark:text-white">{issues.filter(i => String(i.status).toLowerCase() === 'issued').length}</p>
                  </div>
               </div>

               <div className="bg-rose-50 dark:bg-rose-900/10 p-6 rounded-[2rem] border border-rose-100 flex flex-col justify-between group group-hover:border-rose-300">
                  <div>
                    <div className="w-8 h-8 rounded-full bg-white dark:bg-rose-900/50 flex items-center justify-center text-rose-500 mb-3 group-hover:scale-110 transition-transform shadow-sm">
                       <AlertCircle className="w-4 h-4" />
                    </div>
                    <p className="text-[10px] font-black uppercase tracking-widest text-rose-400 mb-1 font-bengali">বকেয়া</p>
                    <p className="text-3xl font-black text-rose-700 font-mono">৳{totalDues}</p>
                  </div>
               </div>
            </div>

            {/* Warning Banners */}
            {isBorrowBlocked && (
              <div className="bg-rose-50 border border-rose-200 p-6 sm:p-8 rounded-[2.5rem] shadow-sm flex flex-col sm:flex-row items-start sm:items-center gap-5 sm:gap-6 relative overflow-hidden">
                 <div className="absolute top-0 right-0 w-32 h-32 bg-rose-200 rounded-full blur-[50px] opacity-20 -mr-10 -mt-10"></div>
                 <div className="w-14 h-14 rounded-full bg-white flex items-center justify-center shrink-0 shadow-sm border border-rose-100 relative z-10">
                     <ShieldAlert className="w-7 h-7 text-rose-600 animate-pulse" />
                 </div>
                 <div className="relative z-10">
                    <h4 className="text-rose-900 font-black font-bengali text-xl leading-tight mb-1">বই নেওয়া সাময়িকভাবে স্থগিত</h4>
                    <p className="text-rose-700/80 text-sm font-semibold font-bengali mt-2">
                      {user?.borrowBlocked ? 'অ্যাডমিন আপনার মেম্বারশিপ সাময়িকভাবে স্থগিত করেছে।' : 
                       hasOverdueBooks ? 'আপনার কাছে ফেরত দেওয়ার সময় পার হওয়া বই রয়েছে। বই ফেরত দিয়ে পুনরায় বই নিতে পারবেন।' : 
                       'অতিরিক্ত লেট রিটার্নের কারণে আপনার প্রোফাইলটি ডিঅ্যাক্টিভেট করা হয়েছে।'}
                    </p>
                 </div>
              </div>
            )}

            {/* Current Books */}
            <div className="bg-white dark:bg-slate-900 rounded-[2.5rem] p-6 sm:p-8 shadow-sm border border-slate-200/60 dark:border-slate-800">
               <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-8">
                  <h3 className="text-xl font-black text-slate-800 dark:text-white font-bengali flex items-center gap-3">
                     <div className="w-10 h-10 bg-slate-50 dark:bg-slate-800 rounded-full flex items-center justify-center text-slate-600 dark:text-slate-300">
                        <BookOpen className="w-5 h-5" />
                     </div>
                     বর্তমান পঠিত বইসমূহ
                  </h3>
                  <Link to="/books" className="text-sm font-bold text-slate-600 bg-slate-50 dark:bg-slate-800 dark:text-slate-300 border border-slate-200 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-700 px-5 py-2.5 rounded-full transition-all font-bengali inline-flex items-center gap-2">
                     নতুন বই <ArrowRight className="w-4 h-4" />
                  </Link>
               </div>

               {issues.filter(i => String(i.status).toLowerCase() === 'issued').length === 0 ? (
                  <div className="py-20 text-center bg-slate-50 dark:bg-slate-800/30 rounded-[2rem] border-2 border-dashed border-slate-200 dark:border-slate-700 flex flex-col items-center">
                     <div className="w-16 h-16 bg-white dark:bg-slate-800 rounded-full flex items-center justify-center text-slate-300 dark:text-slate-500 shadow-sm mb-4"><BookmarkCheck className="w-8 h-8" /></div>
                     <p className="text-slate-500 font-bold font-bengali text-lg">বর্তমানে কোন বই ইস্যু করা নেই</p>
                  </div>
               ) : (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                     {issues.filter(i => String(i.status).toLowerCase() === 'issued').map(i => {
                        const book = books.find(b => b.id === i.bookId);
                        return (
                           <div key={i.id} className="bg-white dark:bg-slate-800 p-5 rounded-[2rem] border border-slate-200/60 dark:border-slate-700 shadow-sm hover:shadow-lg hover:border-indigo-200 dark:hover:border-indigo-900/50 transition-all flex flex-col justify-between group">
                              <div className="flex gap-4 mb-6">
                                 <div className="w-20 h-28 rounded-2xl bg-slate-50 overflow-hidden border border-slate-200/50 flex items-center justify-center shrink-0 shadow-inner group-hover:shadow-md transition-shadow">
                                    {book?.cover ? (
                                       <img src={book.cover} alt={book.title} className="w-full h-full object-cover" />
                                    ) : (
                                       <span className="text-slate-300 font-black text-2xl font-mono uppercase">{book?.title?.charAt(0)}</span>
                                    )}
                                 </div>
                                 <div className="flex-1 min-w-0">
                                    <h4 className="text-lg font-black text-slate-800 dark:text-white leading-tight mb-2 truncate max-w-full">{book?.title}</h4>
                                    <span className="inline-block bg-slate-100 dark:bg-slate-700 text-slate-500 dark:text-slate-300 text-[10px] font-black uppercase font-mono tracking-widest px-2.5 py-1 rounded-md mb-2">{book?.bookCode}</span>
                                    <p className="text-[11px] text-slate-500 font-bold font-bengali flex items-center gap-1.5"><Calendar className="w-3.5 h-3.5" /> ফেরত: {new Date(i.expectedReturnDate).toLocaleDateString('bn-BD')}</p>
                                 </div>
                              </div>
                              
                              <div className="flex items-center gap-2 mt-auto pt-4 border-t border-slate-100 dark:border-slate-700/50">
                                 {i.returnRequested ? (
                                    <span className="flex-1 text-center text-[11px] font-black text-emerald-600 bg-emerald-50 px-4 py-3 rounded-xl border border-emerald-100 uppercase font-bengali">অপেক্ষমান</span>
                                 ) : (
                                    <button 
                                      onClick={async () => {
                                        if (!confirm('আপনি কি বইটি ফেরত দেওয়ার জন্য অনুরোধ দিতে চান?')) return;
                                        try {
                                          await updateDoc(doc(db, 'issues', i.id), { returnRequested: true });
                                          toast.success('অনুরোধ পাঠানো হয়েছে');
                                        } catch (err) { toast.error('এরর হয়েছে'); }
                                      }}
                                      className="flex-1 px-4 py-3 bg-slate-900 dark:bg-indigo-600 text-white rounded-xl font-bold text-xs hover:bg-slate-800 dark:hover:bg-indigo-700 transition-all font-bengali active:scale-95 flex items-center justify-center gap-2"
                                    >
                                      ফেরত দিন
                                    </button>
                                 )}

                                 {!i.extendRequested && (
                                    <button 
                                      onClick={async () => {
                                        if (!confirm('আপনি কি বই ফেরতের সময় বাড়ানোর জন্য অনুরোধ দিতে চান?')) return;
                                        try {
                                          await updateDoc(doc(db, 'issues', i.id), { extendRequested: true });
                                          toast.success('অনুরোধ পাঠানো হয়েছে');
                                        } catch (err) { toast.error('এরর হয়েছে'); }
                                      }}
                                      className="px-4 py-3 text-[11px] font-black text-slate-600 bg-slate-50 border border-slate-200 hover:bg-slate-100 rounded-xl transition-all font-bengali shrink-0 active:scale-95"
                                    >
                                      সময় বৃদ্ধি
                                    </button>
                                 )}
                              </div>
                           </div>
                        )
                     })}
                  </div>
               )}
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 sm:gap-8">
               {/* Prebookings */}
               <div className="bg-white dark:bg-slate-900 p-6 sm:p-8 rounded-[2.5rem] border border-slate-200/60 dark:border-slate-800 shadow-sm space-y-6">
                  <h3 className="text-xl font-black text-slate-800 dark:text-white font-bengali flex items-center justify-between">
                     <div className="flex items-center gap-3">
                        <div className="w-9 h-9 bg-amber-50 dark:bg-amber-900/30 rounded-full flex items-center justify-center text-amber-600"><BookmarkCheck className="w-4 h-4" /></div>
                        সংরক্ষিত বই
                     </div>
                     <span className="w-7 h-7 rounded-full bg-slate-50 dark:bg-slate-800 flex items-center justify-center text-[10px] font-black text-slate-600 dark:text-slate-400 font-mono tracking-widest">{prebookings.length}</span>
                  </h3>
                  <div className="space-y-3">
                     {prebookings.length === 0 ? (
                        <div className="py-8 text-center bg-slate-50 dark:bg-slate-800/30 rounded-2xl border border-dashed border-slate-200 dark:border-slate-700">
                           <p className="text-slate-400 font-bold font-bengali text-[13px]">কোন বই সংরক্ষিত নেই</p>
                        </div>
                     ) : (
                        prebookings.slice(0, 3).map(p => (
                           <div key={p.id} className="flex items-center justify-between p-4 bg-slate-50 dark:bg-slate-800/50 rounded-2xl border border-slate-100 dark:border-slate-700 hover:border-slate-200 transition-colors">
                              <span className="text-sm font-black text-slate-700 dark:text-slate-300 font-bengali truncate pr-4 max-w-[140px] md:max-w-xs">{books.find(b => b.id === p.bookId)?.title || 'Book'}</span>
                              <span className="text-[9px] font-black bg-white dark:bg-slate-700 text-slate-500 dark:text-slate-300 px-3 py-1.5 rounded-full border border-slate-200 dark:border-slate-600 uppercase tracking-widest shrink-0">{p.status}</span>
                           </div>
                        ))
                     )}
                  </div>
               </div>

               {/* My Event Registrations */}
               <div className="bg-white dark:bg-slate-900 p-6 sm:p-8 rounded-[2.5rem] border border-slate-200/60 dark:border-slate-800 shadow-sm space-y-6">
                  <h3 className="text-xl font-black text-slate-800 dark:text-white font-bengali flex items-center justify-between">
                     <div className="flex items-center gap-3">
                        <div className="w-9 h-9 bg-indigo-50 dark:bg-indigo-900/30 rounded-full flex items-center justify-center text-indigo-600">
                           <Activity className="w-4 h-4" />
                        </div>
                        ইভেন্ট আবেদন
                     </div>
                     <span className="w-7 h-7 rounded-full bg-slate-50 dark:bg-slate-800 flex items-center justify-center text-[10px] font-black text-slate-600 dark:text-slate-400 font-mono tracking-widest">{myRegistrations.length}</span>
                  </h3>
                  
                  {myRegistrations.length === 0 ? (
                     <div className="py-6 text-center bg-slate-50 dark:bg-slate-800/30 rounded-2xl border border-dashed border-slate-200 dark:border-slate-700">
                        <p className="text-slate-400 font-bold font-bengali text-[13px] mb-3">কোথাও আবেদন করেননি</p>
                        <Link to="/events" className="text-slate-700 dark:text-slate-300 bg-white dark:bg-slate-700 border border-slate-200 dark:border-slate-600 px-5 py-2.5 rounded-xl font-black text-xs font-bengali hover:bg-slate-50 transition shadow-sm inline-block">ইভেন্ট দেখুন</Link>
                     </div>
                  ) : (
                     <div className="space-y-3">
                        {myRegistrations.slice(0, 3).map(reg => (
                           <div key={reg.id} className="p-4 bg-slate-50 dark:bg-slate-800/50 rounded-2xl border border-slate-100 dark:border-slate-700 flex flex-col justify-between group hover:border-indigo-200 transition-all">
                              <div className="flex justify-between items-start mb-3 border-b border-slate-200/50 dark:border-slate-600/50 pb-3">
                                 <div className="truncate pr-2">
                                    <h4 className="font-black text-slate-800 dark:text-slate-200 font-bengali leading-tight mb-1 truncate">{reg.event?.title || 'Unknown Event'}</h4>
                                    <p className="text-[9px] text-slate-400 font-black uppercase tracking-widest">{reg.event?.type}</p>
                                 </div>
                                 <span className={cn(
                                    "text-[9px] font-black px-2 py-1 rounded border uppercase tracking-widest shrink-0",
                                    reg.status === 'approved' ? "bg-emerald-100 text-emerald-700 border-emerald-200" :
                                    reg.status === 'rejected' ? "bg-rose-100 text-rose-700 border-rose-200" :
                                    "bg-amber-100 text-amber-700 border-amber-200"
                                 )}>
                                    {reg.status || 'Pending'}
                                 </span>
                              </div>
                              <div className="flex items-center justify-between mt-1">
                                 <span className="text-[10px] font-black text-slate-400 bg-white dark:bg-slate-700 px-2 py-0.5 rounded uppercase font-mono tracking-widest border border-slate-200 dark:border-slate-600 shadow-sm">#E{(reg.registeredAt?.seconds || Date.now()).toString().slice(-6)}</span>
                                 <Link to={`/events?eventId=${reg.eventId}`} className="text-[10px] font-black text-indigo-600 dark:text-indigo-400 font-bengali uppercase tracking-widest hover:underline flex items-center gap-1">বিস্তারিত <ArrowRight className="w-3 h-3" /></Link>
                              </div>
                           </div>
                        ))}
                     </div>
                  )}
               </div>
            </div>

            {/* Banner Carousel */}
            {eventBanners.length > 0 && (
              <div className="relative h-48 md:h-64 w-full rounded-[2.5rem] overflow-hidden shadow-xl border border-slate-200/50 dark:border-slate-800 group">
                <AnimatePresence mode="wait">
                  <motion.img
                    key={bannerIndex}
                    src={eventBanners[bannerIndex]}
                    initial={{ opacity: 0, scale: 1.05 }}
                    animate={{ opacity: 1, scale: 1 }}
                    exit={{ opacity: 0, scale: 0.95 }}
                    transition={{ duration: 0.8, ease: "easeOut" }}
                    className="absolute inset-0 w-full h-full object-cover"
                  />
                </AnimatePresence>
                <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/30 to-transparent"></div>
                <div className="absolute bottom-8 left-8 text-white max-w-sm">
                   <h4 className="text-2xl font-black font-bengali drop-shadow-md mb-1 leading-tight">পাঠাগারের বিশেষ আয়োজন</h4>
                   <p className="text-sm font-medium font-bengali text-white/80">সব সময় সাথে থাকুন আমাদের উদ্যোগে</p>
                </div>
                
                <div className="absolute bottom-6 right-8 flex gap-2 bg-black/40 backdrop-blur-md px-3 py-2 rounded-full">
                  {eventBanners.map((_, i) => (
                    <div 
                      key={i} 
                      className={cn(
                        "w-2 h-2 rounded-full transition-all duration-300 cursor-pointer",
                        bannerIndex === i ? "bg-white w-6" : "bg-white/40 hover:bg-white/60"
                      )}
                      onClick={() => setBannerIndex(i)}
                    />
                  ))}
                </div>
              </div>
            )}
         </div>
      </div>

      {/* Modals */}
      {isEditingProfile && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4">
          <motion.div 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="bg-white dark:bg-slate-900 rounded-[2.5rem] w-full max-w-md p-10 shadow-2xl border border-slate-100 dark:border-slate-800"
          >
            <div className="flex items-center gap-4 mb-8">
              <div className="w-12 h-12 bg-indigo-50 rounded-2xl flex items-center justify-center text-indigo-600">
                <Pencil className="w-6 h-6" />
              </div>
              <h3 className="text-2xl font-black text-slate-800 dark:text-white font-bengali">প্রোফাইল আপডেট</h3>
            </div>
            
            <form onSubmit={handleUpdateProfile} className="space-y-5 font-bengali">
               <div className="space-y-2">
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">পুরো নাম</label>
                  <input 
                    type="text" 
                    required
                    value={profileFormData.name}
                    onChange={e => setProfileFormData({...profileFormData, name: e.target.value})}
                    className="w-full border border-slate-200 rounded-2xl px-5 py-4 bg-slate-50 focus:bg-white focus:ring-4 focus:ring-indigo-500/10 transition-all outline-none font-bold"
                  />
               </div>
               <div className="space-y-2">
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">মোবাইল নাম্বার</label>
                  <input 
                    type="text" 
                    value={profileFormData.phone}
                    onChange={e => setProfileFormData({...profileFormData, phone: e.target.value})}
                    className="w-full border border-slate-200 rounded-2xl px-5 py-4 bg-slate-50 focus:bg-white focus:ring-4 focus:ring-indigo-500/10 transition-all outline-none font-mono font-bold"
                  />
               </div>
               <div className="space-y-2">
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">ঠিকানা</label>
                  <textarea 
                    value={profileFormData.address}
                    onChange={e => setProfileFormData({...profileFormData, address: e.target.value})}
                    className="w-full border border-slate-200 rounded-2xl px-5 py-4 bg-slate-50 focus:bg-white focus:ring-4 focus:ring-indigo-500/10 transition-all outline-none min-h-[120px] font-bold"
                  />
               </div>
               
               <div className="flex gap-4 pt-6 mt-4">
                  <button type="button" onClick={() => setIsEditingProfile(false)} className="flex-1 px-4 py-4 font-black text-slate-400 hover:text-slate-600 transition tracking-widest uppercase text-xs">বাতিল</button>
                  <button type="submit" disabled={saveLoading} className="flex-2 px-10 py-4 bg-indigo-600 text-white rounded-2xl font-black shadow-xl shadow-indigo-100 hover:bg-indigo-700 transition active:scale-95 disabled:opacity-50">
                    {saveLoading ? 'সেভ হচ্ছে...' : 'সেভ করুন'}
                  </button>
               </div>
            </form>
          </motion.div>
        </div>
      )}

      {showReviewModal && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4">
          <motion.div 
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            className="bg-white dark:bg-slate-900 rounded-[2.5rem] w-full max-w-2xl p-10 shadow-2xl relative border border-slate-100"
          >
            <h3 className="text-2xl font-black mb-8 tracking-tight text-slate-900 dark:text-white font-bengali">বুক রিভিও পোস্ট করুন</h3>
            <form onSubmit={handleReviewSubmit} className="space-y-6 font-bengali">
              <div className="space-y-2">
                <label className="text-xs font-black text-slate-500 uppercase tracking-widest">বই ও লেখকের নাম</label>
                <input 
                  type="text" 
                  autoFocus
                  required 
                  value={reviewFormData.title} 
                  onChange={e=>setReviewFormData({...reviewFormData, title: e.target.value})} 
                  className="w-full border border-slate-200 p-4 rounded-2xl focus:ring-4 focus:ring-indigo-500/10 shadow-sm outline-none font-bold" 
                  placeholder="যেমন: প্যারাডক্সিক্যাল সাজিদ - আরিফ আজাদ" 
                />
              </div>
              <div className="space-y-2">
                <label className="text-xs font-black text-slate-500 uppercase tracking-widest">আপনার রিভিও</label>
                <textarea 
                  required 
                  rows={8}
                  value={reviewFormData.content} 
                  onChange={e=>setReviewFormData({...reviewFormData, content: e.target.value})} 
                  className="w-full border border-slate-200 p-4 rounded-2xl focus:ring-4 focus:ring-indigo-500/10 shadow-sm outline-none resize-none font-bold min-h-[250px]" 
                  placeholder="বইটি সম্পর্কে আপনার মূল্যবান মতামত এখানে লিখুন..." 
                ></textarea>
              </div>
              
              <div className="flex gap-4 pt-8">
                 <button type="button" onClick={() => setShowReviewModal(false)} className="flex-1 px-6 py-4 font-black text-slate-400 hover:bg-slate-50 rounded-2xl transition tracking-widest uppercase text-xs">বাতিল</button>
                 <button type="submit" className="flex-2 px-10 py-4 bg-indigo-600 text-white rounded-2xl font-black hover:bg-indigo-700 shadow-xl shadow-indigo-100 transition active:scale-95">পাবলিশ করুন</button>
              </div>
            </form>
          </motion.div>
        </div>
      )}
    </div>
  );
}
