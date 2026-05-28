import React, { useEffect, useState, useCallback } from "react";
import { Link } from "react-router-dom";
import { useAuth } from "../../store/AuthContext";
import { firebaseService } from "../../services/firebaseService";
import { db, handleFirestoreError, OperationType } from "../../lib/firebase";
import { collection, query, where, onSnapshot, addDoc, serverTimestamp, getDocs, doc, getDoc } from "firebase/firestore";
import {
  Users,
  Library,
  DollarSign,
  Activity,
  UserCircle2,
  ClipboardList,
  QrCode,
  Scan,
  Package,
  ShoppingCart,
  ShoppingBag,
  Settings,
  BookmarkCheck,
  BookOpen,
  BookHeart,
  LayoutDashboard,
  Crown,
  CreditCard,
  MessageSquare,
  Clock,
  Facebook,
  MessageCircle,
  X,
  ArrowRight,
  Calendar as CalendarIcon,
  FileText,
  GraduationCap
} from "lucide-react";
import { motion, AnimatePresence } from "motion/react";
import toast from 'react-hot-toast';
import { cn } from "../../lib/utils";

export default function DashboardHome() {
  const { user } = useAuth();
  const [stats, setStats] = useState({
    users: 0,
    books: 0,
    issues: 0,
    income: 0,
    expense: 0,
  });

  const [memberStats, setMemberStats] = useState({
    activeIssues: 0,
    totalReturned: 0
  });

  const [availableBooks, setAvailableBooks] = useState<{id: string; title: string; bookCode: string}[]>([]);
  const [eventBanners, setEventBanners] = useState<string[]>([]);
  const [dismissedBanners, setDismissedBanners] = useState<string[]>([]);
  const [activeEvents, setActiveEvents] = useState<any[]>([]);
  const [customGreeting, setCustomGreeting] = useState({
    enabled: false,
    title: '',
    subtitle: ''
  });
  const [isAcademicPortalEnabled, setIsAcademicPortalEnabled] = useState(true);
  const [hiddenDashboardIcons, setHiddenDashboardIcons] = useState<Record<string, boolean>>({});

  useEffect(() => {
    if (user) {
      const fetchBanners = async () => {
        try {
          const cacheKey = 'dash_banners_cache';
          const cacheTimeKey = 'dash_banners_time';
          const greetCacheKey = 'dash_greeting_cache';
          const academicCacheKey = 'dash_academic_cache';
          const hiddenIconsCacheKey = 'dash_hidden_icons_cache';
          const cached = sessionStorage.getItem(cacheKey);
          const cachedGreet = sessionStorage.getItem(greetCacheKey);
          const cachedAcademic = sessionStorage.getItem(academicCacheKey);
          const cachedHiddenIcons = sessionStorage.getItem(hiddenIconsCacheKey);
          const lastTime = sessionStorage.getItem(cacheTimeKey);
          
          if (cached && cachedGreet && cachedAcademic && cachedHiddenIcons && lastTime && (Date.now() - parseInt(lastTime) < 1 * 60 * 1000)) {
            setEventBanners(JSON.parse(cached));
            setCustomGreeting(JSON.parse(cachedGreet));
            setIsAcademicPortalEnabled(JSON.parse(cachedAcademic));
            setHiddenDashboardIcons(JSON.parse(cachedHiddenIcons));
            return;
          }

          const docRef = doc(db, 'settings', 'general');
          const docSnap = await getDoc(docRef);
          if (docSnap.exists()) {
            const data = docSnap.data();
            let banners: string[] = [];
            if (Array.isArray(data.eventBanners)) {
              banners = data.eventBanners;
            } else if (data.eventBanner) {
              banners = [data.eventBanner];
            }
            setEventBanners(banners);
            
            const isAcademicEnabled = data.isAcademicPortalEnabled !== false;
            setIsAcademicPortalEnabled(isAcademicEnabled);
            
            setHiddenDashboardIcons(data.hiddenDashboardIcons || {});

            const greetSettings = {
              enabled: data.customGreetingEnabled || false,
              title: data.customGreetingTitle || '',
              subtitle: data.customGreetingSubtitle || ''
            };
            setCustomGreeting(greetSettings);
            
            sessionStorage.setItem(cacheKey, JSON.stringify(banners));
            sessionStorage.setItem(greetCacheKey, JSON.stringify(greetSettings));
            sessionStorage.setItem(academicCacheKey, JSON.stringify(isAcademicEnabled));
            sessionStorage.setItem(hiddenIconsCacheKey, JSON.stringify(data.hiddenDashboardIcons || {}));
            sessionStorage.setItem(cacheTimeKey, Date.now().toString());
          }

          const eventsSnap = await getDocs(query(collection(db, 'events'), where('status', '==', 'Active')));
          let events = eventsSnap.docs.map(d => ({ id: d.id, ...d.data() }));
          if (user.role !== 'admin') {
            events = events.filter((ev: any) => !ev.targetUserPhone || ev.targetUserPhone === user.phone);
          }
          setActiveEvents(events);
        } catch (err) {
          if (err instanceof Error && err.message.includes('Quota')) return;
          console.error("Error fetching banners:", err);
        }
      };
      fetchBanners();
    }
  }, [user]);

  useEffect(() => {
    if (user && user.role !== 'admin' && user.role !== 'subadmin' && user.role !== 'visitor_admin') {
      const fetchMemberData = async () => {
        try {
          const cachedIssues = sessionStorage.getItem('dash_home_issues_'+user.id);
          const cachedBooks = sessionStorage.getItem('dash_home_books');
          const cacheTime = sessionStorage.getItem('dash_home_time');

          if (cachedIssues && cachedBooks && cacheTime && (Date.now() - parseInt(cacheTime) < 1 * 60 * 1000)) {
            setMemberStats(JSON.parse(cachedIssues));
            setAvailableBooks(JSON.parse(cachedBooks));
            return;
          }

          const qIssues = query(collection(db, 'issues'), where('userId', '==', user.id));
          const [issuesSnap, booksSnap] = await Promise.all([
             getDocs(qIssues),
             getDocs(collection(db, 'books'))
          ]);

          let active = 0;
          let returned = 0;
          issuesSnap.docs.forEach(doc => {
            const data = doc.data();
            if (data.status === 'Issued') active++;
            if (data.status === 'Returned') returned++;
          });
          
          const statsVal = { activeIssues: active, totalReturned: returned };
          setMemberStats(statsVal);

          const books = booksSnap.docs
            .map(doc => ({ id: doc.id, title: (doc.data().title || '') as string, bookCode: (doc.data().bookCode || '') as string, status: doc.data().status }))
            .filter(b => !b.status || String(b.status).toLowerCase() === "available" || String(b.status).toLowerCase() === "");
          setAvailableBooks(books as any);

          sessionStorage.setItem('dash_home_issues_'+user.id, JSON.stringify(statsVal));
          sessionStorage.setItem('dash_home_books', JSON.stringify(books));
          sessionStorage.setItem('dash_home_time', Date.now().toString());

        } catch (error) {
          if (error instanceof Error && (error.message.includes('Quota') || error.message.includes('Quota limit exceeded'))) return;
          handleFirestoreError(error, OperationType.GET, 'dashboard_home');
        }
      };

      fetchMemberData();
    }
  }, [user]);

  const hasAccess = useCallback((path: string) => {
    if (!user) return false;
    if (user.role === 'admin') return true;
    if (user.role === 'visitor_admin' || user.role === 'subadmin') {
      return user.subadminAccess?.includes(path) || false;
    }
    return false;
  }, [user]);

  useEffect(() => {
    if (user?.role === "admin" || user?.role === "subadmin" || user?.role === "visitor_admin") {
      const fetchAdminStats = async () => {
        try {
          const cacheKey = 'admin_dash_stats';
          const cacheTimeKey = 'admin_dash_stats_time';
          const cached = sessionStorage.getItem(cacheKey);
          const lastTime = sessionStorage.getItem(cacheTimeKey);

          if (cached && lastTime && (Date.now() - parseInt(lastTime) < 1 * 60 * 1000)) {
            const parsed = JSON.parse(cached);
            if (Object.keys(parsed).length > 0) {
              setStats(parsed);
              if (parsed.users > 0) return; // Only skip fetch if we actually have populated stats safely.
            }
          }

          const statsPromises = [];
          
          let usersPromise = Promise.resolve([] as any[]);
          let booksPromise = Promise.resolve([] as any[]);
          let issuesPromise = Promise.resolve([] as any[]);
          let financesPromise = Promise.resolve([] as any[]);

          if (hasAccess('/dashboard/users')) {
            usersPromise = firebaseService.getCollection("users");
          }
          if (hasAccess('/dashboard/books')) {
            booksPromise = firebaseService.getCollection("books");
          }
          if (hasAccess('/dashboard/issues')) {
            issuesPromise = firebaseService.getCollection("issues");
          }
          if (hasAccess('/dashboard/finances')) {
            financesPromise = firebaseService.getCollection("finances");
          }

          const [users, books, issues, finances] = await Promise.all([
            usersPromise,
            booksPromise,
            issuesPromise,
            financesPromise,
          ]);

          const income = Array.isArray(finances)
            ? finances
                .filter((f: any) => f.type === "income")
                .reduce((acc, curr: any) => acc + Number(curr.amount), 0)
            : 0;
          const expense = Array.isArray(finances)
            ? finances
                .filter((f: any) => f.type === "expense")
                .reduce((acc, curr: any) => acc + Number(curr.amount), 0)
            : 0;

          const filteredUsers = Array.isArray(users) ? users.filter((u: any) => {
            const name = (u.name || "").toLowerCase().trim();
            const email = (u.email || "").toLowerCase().trim();
            const isExclude = name === "system admin" || name === "seneia islam" || name === "seneiya islam" || email === "seneiaislam@gmail.com";
            return !isExclude && u.role !== "scholarship";
          }) : [];

          const newStats = {
            users: filteredUsers.length,
            books: Array.isArray(books) ? books.length : 0,
            issues: Array.isArray(issues)
              ? issues.filter((i: any) => String(i.status).toLowerCase() === "issued").length
              : 0,
            income,
            expense,
          };
          setStats(newStats);
          sessionStorage.setItem('admin_dash_stats', JSON.stringify(newStats));
          sessionStorage.setItem('admin_dash_stats_time', Date.now().toString());
        } catch (error) {
          if (error instanceof Error && error.message.includes('Quota')) return;
          console.error("Error fetching stats:", error);
        }
      };

      fetchAdminStats();
    }
  }, [user, hasAccess]);

  if (!user) return null;

  const adminLinks = [
    { name: 'ইস্যু ও ফেরত', path: '/dashboard/issues', icon: ClipboardList, color: 'text-amber-400', bg: 'bg-amber-50 dark:bg-amber-500/10' },
    { name: 'সদস্য ব্যবস্থাপনা', path: '/dashboard/users', icon: Users, color: 'text-blue-400', bg: 'bg-blue-50 dark:bg-blue-500/10' },
    { name: 'বইয়ের তালিকা', path: '/dashboard/books', icon: Library, color: 'text-teal-400', bg: 'bg-teal-50 dark:bg-teal-500/10' },
    { name: 'দাতা সদস্য', path: '/dashboard/donors', icon: Crown, color: 'text-amber-500', bg: 'bg-amber-50 dark:bg-amber-500/10' },
    { name: 'বইয়ের অনুরোধ', path: '/dashboard/book-requests', icon: BookOpen, color: 'text-blue-400', bg: 'bg-blue-50 dark:bg-blue-500/10' },
    { name: 'বারকোড স্ক্যানার', path: '/dashboard/barcode-scanner', icon: Scan, color: 'text-rose-400', bg: 'bg-rose-50 dark:bg-rose-500/10' },
    { name: 'সদস্যদের বকেয়া', path: '/dashboard/dues', icon: DollarSign, color: 'text-red-400', bg: 'bg-red-50 dark:bg-red-500/10' },
    { name: 'হিসাব-নিকাশ', path: '/dashboard/finances', icon: Activity, color: 'text-cyan-400', bg: 'bg-cyan-50 dark:bg-cyan-500/10' },
    { name: 'স্টিকার ও QR', path: '/dashboard/stickers', icon: QrCode, color: 'text-purple-400', bg: 'bg-purple-50 dark:bg-purple-500/10' },
    { name: 'শপ বই ব্যবস্থাপনা', path: '/dashboard/shop-books', icon: Package, color: 'text-emerald-400', bg: 'bg-emerald-50 dark:bg-emerald-500/10' },
    { name: 'বই বিক্রয় অর্ডার', path: '/dashboard/shop-orders', icon: ShoppingCart, color: 'text-orange-400', bg: 'bg-orange-50 dark:bg-orange-500/10' },
    { name: 'বৃত্তি নিবন্ধন', path: '/dashboard/scholarship-registration', icon: FileText, color: 'text-pink-400', bg: 'bg-pink-50 dark:bg-pink-500/10' },
    { name: 'আমার প্রোফাইল', path: '/dashboard/profile', icon: UserCircle2, color: 'text-indigo-400', bg: 'bg-indigo-50 dark:bg-indigo-500/10' },
    { name: 'ইভেন্ট', path: '/dashboard/events', icon: CalendarIcon, color: 'text-violet-400', bg: 'bg-violet-50 dark:bg-violet-500/10' },
    { name: 'ওয়েবসাইট সেটিংস', path: '/dashboard/settings', icon: Settings, color: 'text-slate-400', bg: 'bg-slate-50 dark:bg-slate-500/10' },
    { name: 'একাডেমিক কন্ট্রোল', path: '/dashboard/manage-academic', icon: GraduationCap, color: 'text-fuchsia-400', bg: 'bg-fuchsia-50 dark:bg-fuchsia-500/10' },
    { name: 'পরীক্ষা ব্যবস্থাপনা', path: '/dashboard/manage-exam', icon: FileText, color: 'text-rose-500', bg: 'bg-rose-50 dark:bg-rose-500/10' },
    { name: 'পাঠচর্চা', path: '/dashboard/study-practice', icon: BookOpen, color: 'text-indigo-500', bg: 'bg-indigo-100 dark:bg-indigo-500/20' },
    { name: 'পাঠচর্চা ম্যানেজ', path: '/dashboard/manage-study-practice', icon: Settings, color: 'text-fuchsia-500', bg: 'bg-fuchsia-50 dark:bg-fuchsia-500/10' }
  ];

  if (isAcademicPortalEnabled) {
     adminLinks.push({ name: 'একাডেমিক পোর্টাল', path: '/academic', icon: GraduationCap, color: 'text-fuchsia-500', bg: 'bg-fuchsia-100 dark:bg-fuchsia-500/20' });
  }

  const readerLinks = [
    { name: 'আমার প্রোফাইল', path: '/dashboard/profile', icon: UserCircle2, color: 'text-indigo-400', bg: 'bg-indigo-50 dark:bg-indigo-500/10' },
    { name: 'বইয়ের তালিকা', path: '/dashboard/books', icon: Library, color: 'text-teal-400', bg: 'bg-teal-50 dark:bg-teal-500/10' },
    { name: 'আমার পঠিত বই', path: '/dashboard/my-books', icon: BookmarkCheck, color: 'text-amber-400', bg: 'bg-amber-50 dark:bg-amber-500/10' },
    { name: 'বইয়ের অনুরোধ', path: '/dashboard/book-requests', icon: BookOpen, color: 'text-blue-400', bg: 'bg-blue-50 dark:bg-blue-400/10' },
    { name: 'বুক রিভিও', path: '/blog', icon: BookHeart, color: 'text-rose-500', bg: 'bg-rose-50 dark:bg-rose-500/10' },
    { name: 'পরীক্ষা', path: '/dashboard/exam', icon: FileText, color: 'text-violet-500', bg: 'bg-violet-50 dark:bg-violet-500/10' },
    { name: 'পাঠচর্চা', path: '/dashboard/study-practice', icon: BookOpen, color: 'text-indigo-500', bg: 'bg-indigo-100 dark:bg-indigo-500/20' },
    { name: 'ফি পরিশোধ করুন', path: '/dashboard/payment', icon: CreditCard, color: 'text-pink-400', bg: 'bg-pink-50 dark:bg-pink-500/10' },
    { name: 'আমার ইনবক্স', path: '/dashboard/inbox', icon: MessageSquare, color: 'text-purple-400', bg: 'bg-purple-50 dark:bg-purple-400/10' },
    { name: 'বই কিনুন (Shop)', path: '/buy-books', icon: ShoppingBag, color: 'text-emerald-400', bg: 'bg-emerald-50 dark:bg-emerald-400/10' },
    { name: 'ফেসবুক পেজ', url: 'https://www.facebook.com/PandhuaOpenLibraryOfficial', icon: Facebook, color: 'text-blue-600', bg: 'bg-blue-50 dark:bg-blue-400/10' },
    { name: 'WhatsApp সাপোর্ট', url: 'https://wa.me/8801570206953', icon: MessageCircle, color: 'text-emerald-600', bg: 'bg-emerald-50 dark:bg-emerald-400/10' },
  ];

  if (isAcademicPortalEnabled) {
     readerLinks.push({ name: 'একাডেমিক পোর্টাল', path: '/academic', icon: GraduationCap, color: 'text-fuchsia-600', bg: 'bg-fuchsia-50 dark:bg-fuchsia-400/10' });
  }

  const [bannerIndex, setBannerIndex] = useState(0);

  useEffect(() => {
    if (eventBanners.length > 0) {
      const timer = setInterval(() => {
        setBannerIndex(prev => (prev + 1) % eventBanners.length);
      }, 5000);
      return () => clearInterval(timer);
    }
  }, [eventBanners.length]);

  let links = user.role === 'admin' ? adminLinks : (user.role === 'subadmin' || user.role === 'visitor_admin') ? adminLinks.filter(l => hasAccess(l.path) || l.path === '/dashboard/profile') : readerLinks;
  links = links.filter(l => !hiddenDashboardIcons[l.name]);

  let isBirthday = false;
  if (user?.dob) {
    const today = new Date();
    const dob = new Date(user.dob);
    if (today.getMonth() === dob.getMonth() && today.getDate() === dob.getDate()) {
      isBirthday = true;
    }
  }

  return (
    <div className="space-y-6 pb-24">
      {/* Birthday Greeting */}
      {isBirthday && (
        <motion.div 
          initial={{ opacity: 0, scale: 0.9, y: -20 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          className="relative overflow-hidden rounded-[2rem] bg-gradient-to-r from-rose-400 via-fuchsia-500 to-indigo-500 p-6 sm:p-8 text-white shadow-2xl shadow-rose-200/50"
        >
           <div className="absolute top-0 right-0 p-4 opacity-20 pointer-events-none">
              <Crown className="w-32 h-32 -rotate-12" />
           </div>
           
           <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-6">
              <div className="space-y-2">
                 <div className="inline-flex items-center gap-2 bg-white/20 backdrop-blur-md px-4 py-1.5 rounded-full text-xs font-black tracking-widest border border-white/30 uppercase">
                    🎉 শুভ জন্মদিন
                 </div>
                 <h1 className="text-3xl sm:text-4xl font-black font-bengali leading-tight drop-shadow-md">
                    শুভ জন্মদিন, <br/><span className="text-yellow-200">{user.name}</span>! 🎂
                 </h1>
                 <p className="text-white/90 font-bengali font-medium max-w-sm mt-2">
                   পানধোয়া উন্মুক্ত পাঠাগারের পক্ষ থেকে আপনার জন্মদিনে জানাই আন্তরিক শুভেচ্ছা ও অভিনন্দন। আপনার আগামী দিনগুলো হোক আরও সুন্দর ও আনন্দময়।
                 </p>
              </div>
           </div>
        </motion.div>
      )}

      {/* User Greeting Section */}
      {customGreeting?.enabled ? (
        <motion.div 
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          className="relative overflow-hidden rounded-[2rem] bg-gradient-to-br from-indigo-500 via-purple-500 to-pink-500 p-6 sm:p-8 text-white shadow-xl shadow-purple-200/50 dark:shadow-none"
        >
          {/* Animated Background Elements */}
          <motion.div 
            animate={{ 
               scale: [1, 1.2, 1],
               rotate: [0, 90, 0]
            }}
            transition={{ duration: 15, repeat: Infinity, ease: 'linear' }}
            className="absolute -right-20 -top-20 w-64 h-64 bg-white/10 rounded-full blur-[60px] pointer-events-none"
          />
          <motion.div 
            animate={{ 
               scale: [1, 1.5, 1],
               x: [0, 50, 0]
            }}
            transition={{ duration: 10, repeat: Infinity, ease: 'easeInOut' }}
            className="absolute -left-10 -bottom-10 w-48 h-48 bg-white/20 rounded-full blur-[50px] pointer-events-none"
          />
          
          <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-6">
            <div className="space-y-3">
              <motion.div 
                 initial={{ opacity: 0, scale: 0.8 }}
                 animate={{ opacity: 1, scale: 1 }}
                 transition={{ delay: 0.1 }}
                 className="inline-flex items-center gap-2 bg-white/20 backdrop-blur-md px-4 py-1.5 rounded-full text-xs sm:text-sm font-bold border border-white/30 shadow-sm"
              >
                <div className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse shadow-[0_0_8px_rgba(52,211,153,0.8)]"></div>
                স্বাগতম
              </motion.div>
              <motion.h1 
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: 0.2 }}
                className="text-2xl sm:text-4xl font-black font-bengali leading-tight drop-shadow-md"
              >
                {customGreeting.title ? (
                  <span dangerouslySetInnerHTML={{ __html: customGreeting.title.replace(/\[user\]|\{user\}/gi, `<span class="text-white/90">${user.name}</span>`).replace(/\n/g, '<br/>') }} />
                ) : (
                  <>আসসালামু আলাইকুম, <br /><span className="text-white/90">{user.name}</span>!</>
                )}
              </motion.h1>
              <motion.p 
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 0.3 }}
                className="text-white/90 font-bengali text-sm sm:text-base max-w-sm whitespace-pre-line drop-shadow-sm font-medium"
              >
                {customGreeting.subtitle || 'পাঠাগারের সকল সেবা এখন আপনার হাতের নাগালে।'}
              </motion.p>
            </div>
            
            <motion.div 
              initial={{ opacity: 0, rotate: -20 }}
              animate={{ opacity: 1, rotate: 0 }}
              transition={{ delay: 0.4, type: 'spring' }}
              className="hidden md:flex -space-x-4"
            >
               <div className="w-16 h-16 rounded-2xl bg-white/20 backdrop-blur-xl flex items-center justify-center border border-white/30 rotate-6 shadow-xl relative z-20">
                  <Library className="w-8 h-8 text-white" />
               </div>
               <div className="w-14 h-14 rounded-2xl bg-pink-400/40 backdrop-blur-xl flex items-center justify-center border border-white/20 -rotate-12 shadow-lg mt-8 relative z-10">
                  <BookmarkCheck className="w-6 h-6 text-white" />
               </div>
            </motion.div>
          </div>
        </motion.div>
      ) : (
        <div className="relative overflow-hidden rounded-[2rem] bg-indigo-600 p-5 sm:p-8 text-white shadow-xl shadow-indigo-200 dark:shadow-none">
          <div className="absolute -right-10 -top-10 w-40 h-40 bg-white/10 rounded-full blur-[40px] pointer-events-none"></div>
          <div className="absolute -left-10 -bottom-10 w-32 h-32 bg-indigo-400/20 rounded-full blur-[30px] pointer-events-none"></div>
          
          <div className="relative z-10 flex items-center justify-between gap-6">
            <div className="space-y-2">
              <motion.div 
                 initial={{ opacity: 0, x: -20 }}
                 animate={{ opacity: 1, x: 0 }}
                 className="inline-flex items-center gap-2 bg-indigo-500/30 backdrop-blur-md px-3 py-1 rounded-full text-[10px] sm:text-xs font-bold border border-white/10"
              >
                <div className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse"></div>
                স্বাগতম
              </motion.div>
              <h1 className="text-xl sm:text-3xl font-black font-bengali leading-tight">
                আসসালামু আলাইকুম, <br /><span className="text-indigo-200">{user.name}</span>!
              </h1>
              <p className="text-indigo-100 font-bengali text-xs sm:text-sm opacity-90 max-w-xs whitespace-pre-line">
                পাঠাগারের সকল সেবা এখন আপনার হাতের নাগালে।
              </p>
            </div>
            
            <div className="hidden md:flex -space-x-2">
               <div className="w-14 h-14 rounded-2xl bg-white/20 backdrop-blur-xl flex items-center justify-center border border-white/30 rotate-6 shadow-lg">
                  <Library className="w-7 h-7" />
               </div>
               <div className="w-12 h-12 rounded-xl bg-indigo-400/40 backdrop-blur-xl flex items-center justify-center border border-white/20 -rotate-12 shadow-lg mt-6">
                  <BookmarkCheck className="w-6 h-6" />
               </div>
            </div>
          </div>
        </div>
      )}

      {/* Active Events Quick Access */}
      {activeEvents.length > 0 && (
        <motion.div 
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          className="bg-indigo-50 border-2 border-indigo-100 rounded-[2rem] p-6 flex flex-col md:flex-row items-center justify-between gap-6 relative overflow-hidden"
        >
           <div className="absolute top-0 right-0 p-8 opacity-10 pointer-events-none">
              <CalendarIcon className="w-32 h-32 text-indigo-600 -rotate-12" />
           </div>
           <div className="flex items-center gap-5 relative z-10">
              <div className="w-16 h-16 bg-white rounded-2xl flex items-center justify-center text-indigo-600 shadow-xl shadow-indigo-200/50">
                 <Activity className="w-8 h-8 animate-pulse" />
              </div>
              <div className="space-y-1">
                 <h3 className="text-xl font-black text-indigo-900 font-bengali">চলমান ইভেন্টে অংশগ্রহণ করুন</h3>
                 <p className="text-indigo-600 font-bold font-bengali text-sm">{activeEvents.length}টি ইভেন্ট রেজিস্ট্রেশনের জন্য উন্মুক্ত রয়েছে।</p>
              </div>
           </div>
           <Link to="/events" className="relative z-10 bg-indigo-600 text-white px-8 py-3.5 rounded-2xl font-black font-bengali shadow-lg shadow-indigo-200 hover:bg-slate-900 transition-all active:scale-95 flex items-center gap-2">
             ইভেন্ট দেখুন <ArrowRight className="w-5 h-5" />
           </Link>
        </motion.div>
      )}

      {/* App Grid Menu - Condensed style */}
      <div className="bg-white dark:bg-slate-900/40 rounded-[2rem] p-5 sm:p-8 shadow-xl shadow-slate-200/50 dark:shadow-none border border-slate-100 dark:border-slate-800 transition-all">
        <div className="flex items-center justify-between mb-6">
           <div className="space-y-1">
              <h2 className="text-lg font-black text-slate-800 dark:text-white font-bengali flex items-center gap-2">
                 <LayoutDashboard className="w-5 h-5 text-indigo-500" /> 
                 মেনু এবং সেবাসমূহ
              </h2>
           </div>
        </div>
        
        <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-7 gap-y-8 gap-x-4">
          {links.map((link: any, i) => {
            const Icon = link.icon;
            const content = (
              <div className="flex flex-col items-center gap-3 group cursor-pointer">
                <div className={cn(
                  "w-16 h-16 sm:w-20 sm:h-20 rounded-2xl flex items-center justify-center transition-all duration-300 relative group-hover:-translate-y-1",
                  link.bg,
                  "shadow-md group-hover:shadow-xl group-hover:shadow-indigo-200/50 dark:group-hover:shadow-none border border-transparent group-hover:border-white/50"
                )}>
                  <Icon className={cn("w-7 h-7 sm:w-9 sm:h-9 transition-all duration-300 group-hover:scale-110", link.color)} />
                  <div className="absolute inset-0 bg-white opacity-0 group-hover:opacity-10 transition-opacity rounded-2xl"></div>
                </div>
                <span className="text-[12px] sm:text-sm font-black text-slate-700 dark:text-slate-300 text-center font-bengali leading-tight max-w-[100px] break-words">
                  {link.name}
                </span>
              </div>
            );

            return (
              <motion.div
                key={(link.path || link.url) + i}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.03 }}
              >
                {link.url ? (
                  <a href={link.url} target="_blank" rel="noopener noreferrer">
                    {content}
                  </a>
                ) : (
                  <Link to={link.path}>
                    {content}
                  </Link>
                )}
              </motion.div>
            )
          })}
        </div>
      </div>

      {(user.role === "admin" || user.role === "subadmin" || user.role === "visitor_admin") && (
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8 pt-6">
        {/* Total Users Card */}
        {hasAccess('/dashboard/users') && (
        <Link to="/dashboard/users" className="block bg-white dark:bg-slate-900 rounded-[2rem] p-8 shadow-sm border border-slate-100 dark:border-slate-800 hover:-translate-y-1 transition-all duration-300 relative overflow-hidden group flex flex-col justify-between">
          <div className="absolute -right-8 -top-8 w-40 h-40 bg-blue-500/10 rounded-full blur-[40px] pointer-events-none group-hover:bg-blue-500/20 transition-colors duration-500"></div>
          <div className="relative z-10 flex items-start justify-between mb-8">
            <div className="w-14 h-14 rounded-2xl bg-blue-50 dark:bg-blue-500/10 text-blue-600 dark:text-blue-400 flex items-center justify-center shadow-sm border border-blue-100/50 dark:border-blue-100/20 group-hover:scale-110 group-hover:shadow-md transition-all duration-300">
              <Users className="w-7 h-7" />
            </div>
            <div className="bg-slate-50 dark:bg-slate-800 text-slate-400 px-3 py-1 rounded-full text-xs font-bold tracking-widest uppercase font-bengali">
              সদস্য
            </div>
          </div>
          <div className="relative z-10">
            <p className="text-sm font-bold text-slate-500 dark:text-slate-400 mb-1 font-bengali">
              নিবন্ধিত সদস্য
            </p>
            <p className="text-5xl font-black text-slate-900 dark:text-white tracking-tighter">
              {stats.users}
            </p>
          </div>
        </Link>
        )}

        {/* Total Books Card */}
        {hasAccess('/dashboard/books') && (
        <Link to="/dashboard/books" className="block bg-white dark:bg-slate-900 rounded-[2rem] p-8 shadow-sm border border-slate-100 dark:border-slate-800 hover:-translate-y-1 transition-all duration-300 relative overflow-hidden group flex flex-col justify-between">
          <div className="absolute -right-8 -top-8 w-40 h-40 bg-indigo-500/10 rounded-full blur-[40px] pointer-events-none group-hover:bg-indigo-500/20 transition-colors duration-500"></div>
          <div className="relative z-10 flex items-start justify-between mb-8">
            <div className="w-14 h-14 rounded-2xl bg-indigo-50 dark:bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 flex items-center justify-center shadow-sm border border-indigo-100/50 dark:border-indigo-100/20 group-hover:scale-110 group-hover:shadow-md transition-all duration-300">
              <Library className="w-7 h-7" />
            </div>
            <div className="bg-slate-50 dark:bg-slate-800 text-slate-400 px-3 py-1 rounded-full text-xs font-bold tracking-widest uppercase font-bengali">
              বই
            </div>
          </div>
          <div className="relative z-10">
            <p className="text-sm font-bold text-slate-500 dark:text-slate-400 mb-1 font-bengali">
              ক্যাটালগে বই
            </p>
            <p className="text-5xl font-black text-slate-900 dark:text-white tracking-tighter">
              {stats.books}
            </p>
          </div>
        </Link>
        )}

        {/* Active Issues Card */}
        <Link to={hasAccess('/dashboard/issues') ? "/dashboard/issues" : "/dashboard/my-books"} className="bg-white dark:bg-slate-900 rounded-[2rem] p-8 shadow-sm border border-slate-100 dark:border-slate-800 hover:-translate-y-1 transition-all duration-300 relative overflow-hidden group flex flex-col justify-between">
          <div className="absolute -right-8 -top-8 w-40 h-40 bg-amber-500/10 rounded-full blur-[40px] pointer-events-none group-hover:bg-amber-500/20 transition-colors duration-500"></div>
          <div className="relative z-10 flex items-start justify-between mb-8">
            <div className="w-14 h-14 rounded-2xl bg-amber-50 dark:bg-amber-500/10 text-amber-600 dark:text-amber-400 flex items-center justify-center shadow-sm border border-amber-100/50 dark:border-amber-100/20 group-hover:scale-110 group-hover:shadow-md transition-all duration-300">
              <Activity className="w-7 h-7" />
            </div>
            <div className="bg-slate-50 dark:bg-slate-800 text-slate-400 px-3 py-1 rounded-full text-xs font-bold tracking-widest uppercase font-bengali">
              ইস্যু
            </div>
          </div>
          <div className="relative z-10">
            <p className="text-sm font-bold text-slate-500 dark:text-slate-400 mb-1 font-bengali">
              সক্রিয় ইস্যু
            </p>
            <p className="text-5xl font-black text-slate-900 dark:text-white tracking-tighter">
              {stats.issues}
            </p>
          </div>
        </Link>

        {/* Balance Card */}
        {hasAccess('/dashboard/finances') && (
        <Link to="/dashboard/finances" className="block bg-white dark:bg-slate-900 rounded-[2rem] p-8 shadow-sm border border-slate-100 dark:border-slate-800 hover:-translate-y-1 transition-all duration-300 relative overflow-hidden group flex flex-col justify-between">
          <div className="absolute -right-8 -top-8 w-40 h-40 bg-emerald-500/10 rounded-full blur-[40px] pointer-events-none group-hover:bg-emerald-500/20 transition-colors duration-500"></div>
          <div className="relative z-10 flex items-start justify-between mb-8">
            <div className="w-14 h-14 rounded-2xl bg-emerald-50 dark:bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 flex items-center justify-center shadow-sm border border-emerald-100/50 dark:border-emerald-100/20 group-hover:scale-110 group-hover:shadow-md transition-all duration-300">
              <DollarSign className="w-7 h-7" />
            </div>
            <div className="bg-slate-50 dark:bg-slate-800 text-slate-400 px-3 py-1 rounded-full text-xs font-bold tracking-widest uppercase font-bengali">
              ফান্ড
            </div>
          </div>
          <div className="relative z-10">
            <p className="text-sm font-bold text-slate-500 dark:text-slate-400 mb-1 font-bengali">
              বর্তমান ব্যালেন্স
            </p>
            <p className="text-5xl font-black text-emerald-600 dark:text-emerald-400 tracking-tighter">
              ৳{stats.income - stats.expense}
            </p>
          </div>
        </Link>
        )}
      </div>
      )}

      {/* Banner Carousel - Best size: 1200x400 pixels */}
      <div className="mt-8">
        <div className="relative h-48 md:h-64 w-full rounded-[2rem] overflow-hidden shadow-lg border border-slate-100 dark:border-slate-800">
          <AnimatePresence mode="wait">
            <motion.img
              key={eventBanners.length > 0 ? bannerIndex : 'default'}
              src={eventBanners.length > 0 ? eventBanners[bannerIndex] : 'https://images.unsplash.com/photo-1543002588-bfa74002ed7e?q=80&w=1200&auto=format&fit=crop'}
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 1 }}
              className="absolute inset-0 w-full h-full object-cover"
            />
          </AnimatePresence>
          
          {eventBanners.length > 1 && (
            <div className="absolute bottom-4 left-1/2 -translate-x-1/2 flex gap-2">
              {eventBanners.map((_, i) => (
                <div 
                  key={i} 
                  className={cn(
                    "w-2 h-2 rounded-full transition-all duration-300",
                    bannerIndex === i ? "bg-white w-6" : "bg-white/50"
                  )}
                />
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
