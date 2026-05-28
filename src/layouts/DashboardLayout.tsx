import React, { useState, useEffect, useRef } from 'react';
import { Outlet, Link, useLocation, useNavigate } from 'react-router-dom';
import { Logo } from '../components/Logo';
import { 
  ShoppingBag,
  LayoutDashboard, 
  CalendarHeart,
  Users, 
  Library, 
  DollarSign, 
  ClipboardList, 
  UserCircle,
  BookmarkCheck,
  Bell,
  MessageSquare,
  LogOut,
  Home,
  Menu,
  X,
  Plus,
  FileText,
  Clock,
  BookOpen,
  ShieldAlert,
  UserX,
  CheckCircle2,
  ArrowLeft,
  ShoppingCart,
  Search,
  Moon,
  Sun,
  MapPin,
  Phone,
  Heart,
  Package,
  QrCode,
  Scan,
  Settings,
  Replace
} from 'lucide-react';
import { useAuth } from '../store/AuthContext';
import { cn } from '../lib/utils';
import { motion, AnimatePresence } from 'motion/react';
import { db } from '../lib/firebase';
import { collection, query, where, orderBy, onSnapshot, updateDoc, doc } from 'firebase/firestore';
import toast from 'react-hot-toast';

export default function DashboardLayout() {
  const [sidebarSearch, setSidebarSearch] = useState('');
  const [isDarkMode, setIsDarkMode] = useState(false);
  
  const { user, logout, token, loading } = useAuth();

  useEffect(() => {
    if (user?.role === 'visitor_admin') {
      const handleGlobalClick = (e: MouseEvent) => {
         let target = e.target as HTMLElement | null;
         
         const safeClasses = ['text-slate-400', 'hover:bg-slate-100', 'lucide-x', 'lucide-search'];
         
         while (target && target !== document.body) {
           if (target.tagName === 'BUTTON') {
              const buttonText = target.innerText?.toLowerCase() || '';
              const buttonTypes = target.getAttribute('type') || '';
              
              if (target.classList.contains('lucide-chevron-left') || 
                  target.classList.contains('lucide-chevron-right') ||
                  buttonText.includes('পরবর্তী') || buttonText.includes('পূর্ববর্তী') || buttonText.includes('cancel') || buttonText.includes('close')) {
                 return;
              }

              if (buttonTypes === 'submit' || target.querySelector('.lucide-trash-2') || target.querySelector('.lucide-edit') || target.querySelector('.lucide-save') || target.querySelector('.lucide-plus') || target.querySelector('.lucide-upload') || buttonText.includes('save') || buttonText.includes('add') || buttonText.includes('delete') || buttonText.includes('update')) {
                 e.preventDefault();
                 e.stopPropagation();
                 toast.error('ভিজিটর অ্যাডমিন হিসেবে এডিট বা ডিলিট করার অনুমতি নেই।');
                 return;
              }
           }
           target = target.parentElement;
         }
      };

      document.addEventListener('click', handleGlobalClick, true);
      
      const handleGlobalSubmit = (e: SubmitEvent) => {
         if (e.target instanceof HTMLFormElement && e.target.id === 'search-form') return;
         e.preventDefault();
         e.stopPropagation();
         toast.error('ভিজিটর অ্যাডমিন হিসেবে সেভ/এডিট করার অনুমতি নেই।');
      };
      
      document.addEventListener('submit', handleGlobalSubmit, true);

      return () => {
         document.removeEventListener('click', handleGlobalClick, true);
         document.removeEventListener('submit', handleGlobalSubmit, true);
      };
    }
  }, [user]);

  useEffect(() => {
    if (isDarkMode) {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
  }, [isDarkMode]);
  
  const location = useLocation();
  const navigate = useNavigate();
  const [notifications, setNotifications] = useState<any[]>([]);
  const [messagesCount, setMessagesCount] = useState(0);
  const [bookRequestsCount, setBookRequestsCount] = useState(0);
  const [resetRequestsCount, setResetRequestsCount] = useState(0);
  const [preBookingsCount, setPreBookingsCount] = useState(0);
  const [unreadNoticesCount, setUnreadNoticesCount] = useState(0);
  const [showNotifications, setShowNotifications] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  const [siteSettings, setSiteSettings] = useState({
    title: 'পানধোয়া উন্মুক্ত পাঠাগার',
    iconUrl: ''
  });

  useEffect(() => {
    const fetchSettings = async () => {
      try {
        const { doc, getDoc } = await import('firebase/firestore');
        const docRef = doc(db, 'settings', 'general');
        const docSnap = await getDoc(docRef);
        if (docSnap.exists()) {
          const data = docSnap.data();
          setSiteSettings({
            title: data.websiteTitle || 'পানধোয়া উন্মুক্ত পাঠাগার',
            iconUrl: data.homeIconUrl || ''
          });
        }
      } catch (err) {
        console.error("Failed to load settings", err);
      }
    };
    fetchSettings();
  }, []);

  useEffect(() => {
    if (user?.role === 'admin' && !loading) {
      const fetchAdminData = async () => {
        try {
          const cachedNotes = sessionStorage.getItem('dash_admin_notif');
          const cacheTime = sessionStorage.getItem('dash_admin_time');
          
          if (cachedNotes && cacheTime && (Date.now() - parseInt(cacheTime) < 2 * 60 * 1000)) {
            setNotifications(JSON.parse(cachedNotes));
            setBookRequestsCount(parseInt(sessionStorage.getItem('dash_admin_breq') || '0'));
            setResetRequestsCount(parseInt(sessionStorage.getItem('dash_admin_rreq') || '0'));
            setPreBookingsCount(parseInt(sessionStorage.getItem('dash_admin_pre') || '0'));
            return;
          }

          const { getDocs, limit } = await import('firebase/firestore');
          
          const qNotif = query(collection(db, 'notifications'), orderBy('createdAt', 'desc'), limit(50));
          const qBookReq = query(collection(db, 'book-requests'), where('status', '==', 'Pending'));
          const qResetReq = query(collection(db, 'reset-requests'));
          const qPreBook = query(collection(db, 'pre-bookings'), where('status', '==', 'Pending'));

          const [notifSnap, bReqSnap, rReqSnap, pBookSnap] = await Promise.all([
            getDocs(qNotif),
            getDocs(qBookReq),
            getDocs(qResetReq),
            getDocs(qPreBook)
          ]);

          const notifs = notifSnap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
          setNotifications(notifs);
          
          const bReqCount = bReqSnap.docs.length;
          setBookRequestsCount(bReqCount);
          
          const rReqCount = rReqSnap.docs.filter(doc => doc.data().status === 'Pending').length;
          setResetRequestsCount(rReqCount);
          
          const pBookCount = pBookSnap.docs.length;
          setPreBookingsCount(pBookCount);

          sessionStorage.setItem('dash_admin_notif', JSON.stringify(notifs));
          sessionStorage.setItem('dash_admin_breq', bReqCount.toString());
          sessionStorage.setItem('dash_admin_rreq', rReqCount.toString());
          sessionStorage.setItem('dash_admin_pre', pBookCount.toString());
          sessionStorage.setItem('dash_admin_time', Date.now().toString());
        } catch (err) {
          if (err instanceof Error && err.message.includes('Quota')) return;
          console.error("Admin dashboard fetch error:", err);
        }
      };

      fetchAdminData();
    }
  }, [user, loading]);

  useEffect(() => {
    if (user && !loading) {
      const fetchUserData = async () => {
        try {
          const cachedMessages = sessionStorage.getItem('dash_user_msgs');
          const cachedNotices = sessionStorage.getItem('dash_user_notices');
          const cacheTime = sessionStorage.getItem('dash_user_time');
          
          let currentNotices: any[] = [];
          const updateUnreadCount = () => {
            const lastSeen = localStorage.getItem(`last_seen_notices_${user.id}`);
            if (lastSeen) {
               const unreadCount = currentNotices.filter(n => new Date(n.date) > new Date(lastSeen)).length;
               setUnreadNoticesCount(unreadCount);
            } else {
               setUnreadNoticesCount(currentNotices.length);
            }
          };

          window.addEventListener('notices_seen', updateUnreadCount);

          if (cachedMessages && cachedNotices && cacheTime && (Date.now() - parseInt(cacheTime) < 2 * 60 * 1000)) {
             setMessagesCount(parseInt(cachedMessages));
             currentNotices = JSON.parse(cachedNotices);
             updateUnreadCount();
             return;
          }

          const { getDocs } = await import('firebase/firestore');
          const qMsg = query(collection(db, 'messages'), where('toUserId', '==', user.id));
          const qNotices = query(collection(db, "notices"), orderBy("date", "desc"));
          
          const [msgSnap, noticeSnap] = await Promise.all([
            getDocs(qMsg),
            getDocs(qNotices)
          ]);

          const msgs = msgSnap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
          const unreadMsgs = msgs.filter((m: any) => !m.isRead && m.toUserId === user.id).length;
          setMessagesCount(unreadMsgs);

          currentNotices = noticeSnap.docs.map(doc => ({ id: doc.id, ...doc.data() as any }));
          updateUnreadCount();

          sessionStorage.setItem('dash_user_msgs', unreadMsgs.toString());
          sessionStorage.setItem('dash_user_notices', JSON.stringify(currentNotices));
          sessionStorage.setItem('dash_user_time', Date.now().toString());

        } catch (err) {
          if (err instanceof Error && err.message.includes('Quota')) return;
          console.error("Dashboard user fast fetch error:", err);
        }
      };
      
      fetchUserData();

      return () => {
        window.removeEventListener('notices_seen', () => {});
      };
    }
  }, [user, loading]);

  const markAsRead = async (id: string) => {
    try {
      await updateDoc(doc(db, 'notifications', id), { read: true });
      setNotifications(notifications.map(n => n.id === id ? { ...n, read: true } : n));
    } catch (err) {
      console.error('Error marking as read:', err);
    }
  };

  const unreadCount = notifications.filter(n => !n.read).length;

  const handleLogout = () => {
    logout();
  };

  const dashboardName = 
     user?.role === 'admin' ? 'অ্যাডমিন ড্যাশবোর্ড' 
     : user?.role === 'donor' ? 'সম্মানিত দাতা ড্যাশবোর্ড'
     : 'সদস্য ড্যাশবোর্ড';

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-900 flex flex-col font-sans transition-colors">
      {/* Top Navigation */}
      <header className="sticky top-0 z-30 bg-white dark:bg-slate-800 border-b border-slate-200 dark:border-slate-700 shadow-sm px-4 md:px-8 py-3 flex items-center justify-between no-print">
         <div className="flex items-center gap-3">
            {location.pathname !== '/dashboard' && (
              <button 
                onClick={() => navigate('/dashboard')}
                className="p-2 -ml-2 text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white bg-slate-50 dark:bg-slate-700 hover:bg-slate-100 dark:hover:bg-slate-600 rounded-full transition-colors flex items-center justify-center border border-slate-200 dark:border-slate-600"
                aria-label="Go back"
              >
                <ArrowLeft className="w-5 h-5" />
              </button>
            )}
            <Link to="/dashboard" className="flex items-center gap-2 group outline-none">
              <div className="w-8 h-8 rounded-lg flex items-center justify-center border border-slate-200 dark:border-slate-600 group-hover:bg-slate-50 transition-colors shadow-sm overflow-hidden shrink-0">
                {siteSettings.iconUrl ? (
                  <img src={siteSettings.iconUrl} alt="Logo" className="w-full h-full object-contain" />
                ) : (
                  <Logo className="w-5 h-5" />
                )}
              </div>
              <div className="flex flex-col min-w-0">
                <span className="font-bold text-slate-900 dark:text-white leading-tight text-sm md:text-base group-hover:text-indigo-600 transition-colors truncate">{siteSettings.title}</span>
                <span className="text-[9px] md:text-[10px] text-slate-500 font-bold uppercase tracking-wider truncate">{dashboardName}</span>
              </div>
            </Link>
         </div>

         <div className="flex items-center gap-3">
            <Link
              to="/books"
              className="hidden md:flex items-center gap-2 px-4 py-2 bg-indigo-50 dark:bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 hover:bg-indigo-100 dark:hover:bg-indigo-500/20 rounded-full transition-colors border border-indigo-100 dark:border-indigo-500/20 text-sm font-bold shadow-sm"
            >
              <Search className="w-4 h-4" />
              বই ব্রাউজ করুন
            </Link>
            <button
              onClick={() => setIsDarkMode(!isDarkMode)}
              className="p-2 text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white bg-slate-50 dark:bg-slate-700 rounded-full transition-colors border border-slate-200 dark:border-slate-600 outline-none"
            >
              {isDarkMode ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
            </button>
            {user?.role !== 'admin' && (
              <Link
                to="/dashboard/notice-board"
                className="relative p-2 text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white bg-slate-50 dark:bg-slate-700 rounded-full transition-colors border border-slate-200 dark:border-slate-600 outline-none"
              >
                <Bell className="w-4 h-4" />
                {(unreadNoticesCount + messagesCount) > 0 && (
                  <span className="absolute -top-1 -right-1 w-4 h-4 bg-rose-500 text-white text-[10px] font-bold flex items-center justify-center rounded-full border border-white animate-pulse">
                    {(unreadNoticesCount + messagesCount) > 9 ? '9+' : (unreadNoticesCount + messagesCount)}
                  </span>
                )}
              </Link>
            )}
            {user?.role === 'admin' && (
              <div className="relative" ref={dropdownRef}>
                <button 
                  onClick={() => setShowNotifications(!showNotifications)}
                  className="relative p-2 text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white bg-slate-50 dark:bg-slate-700 rounded-full transition-colors border border-slate-200 dark:border-slate-600 outline-none"
                >
                  <Bell className="w-4 h-4" />
                  {unreadCount > 0 && (
                    <span className="absolute -top-1 -right-1 w-4 h-4 bg-rose-500 text-white text-[10px] font-bold flex items-center justify-center rounded-full border border-white">
                      {unreadCount > 9 ? '9+' : unreadCount}
                    </span>
                  )}
                </button>
                <AnimatePresence>
                  {showNotifications && (
                    <motion.div 
                      initial={{ opacity: 0, y: 10, scale: 0.95 }}
                      animate={{ opacity: 1, y: 0, scale: 1 }}
                      exit={{ opacity: 0, y: 10, scale: 0.95 }}
                      className="absolute right-0 mt-2 w-80 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 shadow-xl rounded-2xl overflow-hidden z-20"
                    >
                      <div className="bg-slate-50 dark:bg-slate-900 border-b border-slate-100 dark:border-slate-800 p-3 flex items-center justify-between">
                        <span className="font-bold text-slate-800 dark:text-white text-sm">Notifications</span>
                        <span className="text-xs font-semibold text-indigo-600 dark:text-indigo-400 bg-indigo-50 dark:bg-indigo-500/10 px-2 py-0.5 rounded-full">{unreadCount} New</span>
                      </div>
                      <div className="max-h-[70vh] overflow-y-auto">
                        {notifications.length === 0 && (
                           <div className="p-8 text-center text-slate-400 text-sm font-medium">No notifications yet.</div>
                        )}
                        {notifications.map((n: any) => (
                          <div 
                            key={n.id} 
                            onClick={() => !n.read && markAsRead(n.id)}
                            className={cn(
                              "p-4 border-b border-slate-50 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-900/50 transition cursor-pointer flex gap-3",
                              !n.read ? "bg-indigo-50/30 dark:bg-indigo-500/5" : "opacity-75"
                            )}
                          >
                            <div className="flex-1 min-w-0">
                               <div className="flex items-center justify-between mb-1">
                                  <p className={cn("text-sm font-bold truncate", !n.read ? "text-slate-900 dark:text-white" : "text-slate-600 dark:text-slate-400")}>{n.title}</p>
                                  <span className="text-[10px] text-slate-400 font-medium ml-2 shrink-0">
                                    {new Date(n.createdAt).toLocaleDateString()}
                                  </span>
                               </div>
                               <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed max-w-[250px]">{n.message}</p>
                            </div>
                            {!n.read && <div className="w-2 h-2 rounded-full bg-indigo-500 self-center shrink-0 shadow-sm" />}
                          </div>
                        ))}
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            )}
            <Link to="/dashboard/profile" className="flex items-center gap-2 outline-none group">
               <div className="w-9 h-9 rounded-full bg-slate-100 dark:bg-slate-700 border border-slate-200 dark:border-slate-600 flex items-center justify-center text-slate-500 dark:text-slate-400 overflow-hidden shadow-sm group-hover:border-indigo-300 transition-colors">
                  {user?.avatar ? (
                     <img src={user.avatar} alt="Profile" referrerPolicy="no-referrer" className="w-full h-full object-cover" />
                  ) : <UserCircle className="w-5 h-5" />}
               </div>
            </Link>
         </div>
      </header>

      {user?.status === 'pending' && (
        <div className="bg-amber-50 dark:bg-amber-900/20 border-b border-amber-200 dark:border-amber-500/20 px-4 flex items-center justify-center gap-2 py-3 z-10 relative">
          <ShieldAlert className="w-5 h-5 text-amber-500 shrink-0" />
          <p className="text-sm text-amber-800 dark:text-amber-400 font-bold font-bengali text-center">
            আপনার একাউন্টটি বর্তমানে পাঠাগার কর্তৃপক্ষের অনুমোদনের অপেক্ষায় আছে। পাঠাগার কর্তৃপক্ষ এপ্রুভ না করলে মেম্বার হওয়া যাবে না।
          </p>
        </div>
      )}

      {/* Main Scrollable Content */}
      <main className="flex-1 overflow-y-auto w-full max-w-7xl mx-auto p-4 md:p-8 pb-32 md:pb-32">
         <Outlet />
      </main>

      {/* Bottom Navigation */}
      <div className="fixed bottom-0 left-0 right-0 h-[68px] bg-white dark:bg-slate-800 border-t border-slate-200 dark:border-slate-700 flex items-center justify-around px-2 z-40 shadow-[0_-10px_40px_rgba(0,0,0,0.06)] pb-safe no-print">
         <Link to="/dashboard" className={cn("flex flex-col items-center justify-center gap-1 w-16 h-full transition-all outline-none", location.pathname === '/dashboard' ? "text-indigo-600 dark:text-indigo-400" : "text-slate-500 dark:text-slate-400")}>
            <Home className={cn("w-6 h-6", location.pathname === '/dashboard' && "fill-indigo-100 dark:fill-indigo-500/20")} />
            <span className="text-[10px] font-bold uppercase tracking-wide">হোম</span>
         </Link>
         
         {user?.role === 'admin' || user?.role === 'subadmin' || user?.role === 'visitor_admin' ? (
           <>
             <Link to="/dashboard/barcode-scanner" className={cn("flex flex-col items-center justify-center gap-1 w-16 h-full transition-all outline-none", location.pathname === '/dashboard/barcode-scanner' ? "text-indigo-600 dark:text-indigo-400" : "text-slate-500 dark:text-slate-400")}>
                <Scan className={cn("w-6 h-6", location.pathname === '/dashboard/barcode-scanner' && "fill-indigo-100 dark:fill-indigo-500/20")} />
                <span className="text-[10px] font-bold uppercase tracking-wide">স্ক্যানার</span>
             </Link>
           </>
         ) : (
           <>
             <Link to="/dashboard/book-requests" className={cn("flex flex-col items-center justify-center gap-1 w-16 h-full transition-all outline-none", location.pathname === '/dashboard/book-requests' ? "text-indigo-600 dark:text-indigo-400" : "text-slate-500 dark:text-slate-400")}>
                <BookOpen className={cn("w-6 h-6", location.pathname === '/dashboard/book-requests' && "fill-indigo-100 dark:fill-indigo-500/20")} />
                <span className="text-[10px] font-bold uppercase tracking-wide">অনুরোধ</span>
             </Link>
           </>
         )}

         <Link to="/books" className={cn("flex flex-col items-center justify-center gap-1 w-16 h-full transition-all outline-none", location.pathname === '/books' ? "text-indigo-600 dark:text-indigo-400" : "text-slate-500 dark:text-slate-400")}>
            {/* Center prominent button for browsing books */}
            <div className={cn("w-12 h-12 -mt-6 rounded-full flex items-center justify-center shadow-lg border-4 border-slate-50 dark:border-slate-900 transition-transform", location.pathname === '/books' ? "bg-indigo-600 text-white scale-110" : "bg-slate-800 dark:bg-slate-700 text-white hover:bg-slate-900 dark:hover:bg-slate-600")}>
               <Search className="w-5 h-5" />
            </div>
            <span className="text-[10px] font-bold uppercase tracking-wide -mt-1">বই খুঁজুন</span>
         </Link>

         <button onClick={handleLogout} className="flex flex-col items-center justify-center gap-1 w-16 h-full transition-all text-slate-500 dark:text-slate-400 hover:text-rose-500 outline-none">
            <LogOut className="w-6 h-6" />
            <span className="text-[10px] font-bold uppercase tracking-wide">লগআউট</span>
         </button>
      </div>

    </div>
  );
}
