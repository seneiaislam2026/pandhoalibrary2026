import React, { useState, useEffect } from "react";
import { Outlet, Link, useLocation, useNavigate } from "react-router-dom";
import { Logo } from '../components/Logo';
import {
  ShoppingBag,
  BookOpen,
  UserCircle,
  Menu,
  X,
  ArrowLeft,
  Home,
  Library,
  ShoppingCart,
  Heart,
  CalendarHeart,
  Users,
  FileText,
  Globe,
  MapPin,
  Phone,
  Clock,
  LayoutDashboard,
  Bell,
  MessageSquare,
  DollarSign,
  ChevronDown,
  Scan,
  Search,
  LogOut
} from "lucide-react";
import { useAuth } from "../store/AuthContext";
import { cn } from "../lib/utils";
import { motion, AnimatePresence } from "motion/react";
import { useTranslation } from "react-i18next";
import { db, handleFirestoreError, OperationType } from "../lib/firebase";
import { collection, query, where, onSnapshot, orderBy } from "firebase/firestore";

export default function MainLayout() {
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const location = useLocation();
  const navigate = useNavigate();
  const { user, logout, loading } = useAuth();
  const { t, i18n } = useTranslation();
  const [unreadNoticesCount, setUnreadNoticesCount] = useState(0);
  const [messagesCount, setMessagesCount] = useState(0);

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
    if (user && !loading) {
      const fetchMessages = async () => {
        try {
          const cacheKey = 'main_msgs_count';
          const cacheTimeKey = 'main_msgs_count_time';
          const cached = sessionStorage.getItem(cacheKey);
          const lastTime = sessionStorage.getItem(cacheTimeKey);

          if (cached && lastTime && (Date.now() - parseInt(lastTime) < 5 * 60 * 1000)) {
            setMessagesCount(parseInt(cached));
            return;
          }

          const { getDocs } = await import('firebase/firestore');
          const qMsgs = query(collection(db, 'messages'), where('toUserId', '==', user.id));
          const snapshot = await getDocs(qMsgs);
          const msgs = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
          const unread = msgs.filter((m: any) => !m.isRead && m.toUserId === user.id).length;
          setMessagesCount(unread);
          sessionStorage.setItem(cacheKey, unread.toString());
          sessionStorage.setItem(cacheTimeKey, Date.now().toString());
        } catch (error) {
          if (error instanceof Error && error.message.includes('Quota')) return;
          console.error("Error fetching messages count:", error);
        }
      };

      fetchMessages();

      const noticesQuery = query(collection(db, "notices"), orderBy("date", "desc"));
      let currentNotices: any[] = [];

      const updateUnreadNotices = () => {
        const lastSeen = localStorage.getItem(`last_seen_notices_${user.id}`);
        if (lastSeen) {
           const count = currentNotices.filter(n => new Date(n.date) > new Date(lastSeen)).length;
           setUnreadNoticesCount(count);
        } else {
           setUnreadNoticesCount(currentNotices.length);
        }
      };

      const fetchNotices = async () => {
        try {
          const cached = sessionStorage.getItem('main_notices_cache');
          const cacheTime = sessionStorage.getItem('main_notices_cache_time');
          if (cached && cacheTime && (Date.now() - parseInt(cacheTime) < 5 * 60 * 1000)) {
            currentNotices = JSON.parse(cached);
            updateUnreadNotices();
            return;
          }

          const { getDocs } = await import('firebase/firestore');
          const snapshot = await getDocs(noticesQuery);
          currentNotices = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() as any }));
          sessionStorage.setItem('main_notices_cache', JSON.stringify(currentNotices));
          sessionStorage.setItem('main_notices_cache_time', Date.now().toString());
          updateUnreadNotices();
        } catch (error) {
          handleFirestoreError(error, OperationType.GET, 'notices');
        }
      };
      
      fetchNotices();

      window.addEventListener('notices_seen', updateUnreadNotices);

      return () => {
        window.removeEventListener('notices_seen', updateUnreadNotices);
      };
    }
  }, [user, loading]);

  const toggleLanguage = () => {
    i18n.changeLanguage(i18n.language === "en" ? "bn" : "en");
  };

  const links = [
    { name: t("nav.home"), path: "/", icon: Home },
    { name: t("nav.books"), path: "/books", icon: Library },
    { name: "Event", path: "/events", icon: CalendarHeart },
    { name: t("nav.buy"), path: "/buy-books", icon: ShoppingCart },
    { name: t("nav.donors"), path: "/donors", icon: Heart },
    { name: t("nav.team"), path: "/team", icon: Users },
    { name: t("nav.constitution"), path: "/constitution", icon: FileText },
    { name: t("nav.blog"), path: "/blog", icon: FileText },
  ];

  return (
    <div className="min-h-screen bg-[#fafafa] text-slate-900 font-sans tracking-tight">
      <nav className="sticky top-0 z-50 bg-white/80 backdrop-blur-md border-b border-slate-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between h-16">
            <div className="flex items-center gap-2 md:gap-4">
              {location.pathname !== "/" && (
                <button
                  onClick={() => {
                    if (user && (location.pathname === "/books" || location.pathname === "/finances")) {
                      navigate("/dashboard");
                    } else {
                      navigate("/");
                    }
                  }}
                  className="p-2 -ml-2 text-slate-500 hover:text-slate-900 hover:bg-slate-100 rounded-full transition-all"
                  aria-label="Go back"
                >
                  <ArrowLeft className="w-5 h-5" />
                </button>
              )}
              <Link to="/" className="flex items-center gap-2 group">
                {siteSettings.iconUrl ? (
                  <img src={siteSettings.iconUrl} alt="Logo" className="h-8 w-8 object-contain group-hover:rotate-12 transition-transform duration-300" />
                ) : (
                  <Logo className="h-8 w-8 group-hover:rotate-12 transition-transform duration-300" />
                )}
                <span className="font-bold text-base lg:text-lg tracking-tight text-indigo-950 whitespace-nowrap">
                  {siteSettings.title}
                </span>
              </Link>
            </div>

            {/* Desktop Nav */}
          <div className="hidden md:flex items-center">
              <div className="flex items-center space-x-3 lg:space-x-5 mr-4">
                {links.slice(0, 5).map((link) => (
                  <Link
                    key={link.path}
                    to={link.path}
                    className={cn(
                      "text-[13px] lg:text-[14px] font-bold transition-all px-2 py-1 rounded-lg font-bengali whitespace-nowrap",
                      location.pathname === link.path
                        ? "text-indigo-600 bg-indigo-50"
                        : "text-slate-600 hover:text-indigo-600 hover:bg-slate-50",
                    )}
                  >
                    {link.name}
                  </Link>
                ))}

                {/* More Dropdown */}
                <div className="relative group/more">
                  <button className="flex items-center gap-1 text-[13px] lg:text-[14px] font-bold text-slate-600 hover:text-indigo-600 px-2 py-1 rounded-lg font-bengali cursor-default">
                    আরো
                    <ChevronDown className="w-4 h-4 group-hover/more:rotate-180 transition-transform" />
                  </button>
                  <div className="absolute top-full left-0 pt-2 opacity-0 translate-y-2 pointer-events-none group-hover/more:opacity-100 group-hover/more:translate-y-0 group-hover/more:pointer-events-auto transition-all duration-200 z-50">
                    <div className="bg-white border border-slate-200 rounded-2xl shadow-2xl p-2 min-w-[180px]">
                      {links.slice(5).map((link) => (
                        <Link
                          key={link.path}
                          to={link.path}
                          className={cn(
                            "flex items-center gap-3 px-4 py-2.5 rounded-xl text-[14px] font-bold font-bengali transition-colors",
                            location.pathname === link.path
                              ? "text-indigo-600 bg-indigo-50"
                              : "text-slate-600 hover:bg-slate-50 hover:text-indigo-600",
                          )}
                        >
                          <link.icon className="w-4 h-4 opacity-50" />
                          {link.name}
                        </Link>
                      ))}
                    </div>
                  </div>
                </div>
              </div>

              <div className="pl-4 border-l border-slate-200 flex items-center gap-2 lg:gap-3">
                <button
                  onClick={toggleLanguage}
                  className="flex items-center gap-1 text-slate-500 hover:text-indigo-600 transition-colors px-2 py-1.5 rounded-lg text-xs font-bold bg-slate-50 border border-slate-100"
                  title="Toggle Language"
                >
                  <Globe className="w-3.5 h-3.5" />
                  {i18n.language === "en" ? "BN" : "EN"}
                </button>
                <Link
                  to="/finances"
                  className="bg-emerald-500 text-white px-4 py-2 rounded-xl text-[13px] font-bold hover:bg-emerald-600 transition-all shadow-lg shadow-emerald-500/10 font-bengali active:scale-95 whitespace-nowrap"
                >
                  আয়-ব্যয় হিসেব
                </Link>
                {user ? (
                  <Link
                    to="/"
                    className="flex items-center gap-2 text-[13px] lg:text-sm font-bold text-slate-700 bg-slate-100 px-4 py-2 rounded-xl hover:bg-emerald-600 hover:text-white transition-all active:scale-95 whitespace-nowrap"
                  >
                    <Home className="w-4 h-4" />
                    হোম পেজ
                  </Link>
                ) : (
                  <div className="flex items-center gap-2">
                    <Link
                      to="/login"
                      className="text-[13px] lg:text-sm font-bold text-slate-700 hover:text-indigo-600 transition-colors px-3 py-2 rounded-lg"
                    >
                      {t("nav.login")}
                    </Link>
                    <Link
                      to="/register"
                      className="bg-indigo-600 text-white px-5 py-2.5 rounded-xl text-[13px] lg:text-sm font-bold hover:bg-indigo-700 shadow-xl shadow-indigo-600/10 transition-all active:scale-95 whitespace-nowrap"
                    >
                      Join Now
                    </Link>
                  </div>
                )}
              </div>
            </div>

            {/* Mobile menu button */}
            <div className="flex items-center md:hidden gap-2">
              <button
                onClick={toggleLanguage}
                className="flex items-center gap-1 text-slate-600 hover:text-indigo-600 transition-colors px-2 py-1 rounded-md text-sm font-medium bg-slate-50 mr-2"
                title="Toggle Language"
              >
                <Globe className="w-4 h-4" />
                {i18n.language === "en" ? "BN" : "EN"}
              </button>
              <button
                onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
                className="text-slate-600 hover:text-slate-900"
              >
                {isMobileMenuOpen ? (
                  <X className="h-6 w-6" />
                ) : (
                  <Menu className="h-6 w-6" />
                )}
              </button>
            </div>
          </div>
        </div>

        {/* Mobile Nav */}
        <AnimatePresence>
          {isMobileMenuOpen && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: "auto", opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              className="md:hidden border-t border-slate-200 overflow-hidden bg-white shadow-xl"
            >
              <div className="px-4 pt-4 pb-6 space-y-2">
                {links.map((link) => {
                  const Icon = link.icon;
                  return (
                    <Link
                      key={link.path}
                      to={link.path}
                      onClick={() => setIsMobileMenuOpen(false)}
                      className={cn(
                        "flex items-center gap-3 px-4 py-3 rounded-xl text-base font-semibold transition-all",
                        location.pathname === link.path
                          ? "text-indigo-700 bg-indigo-50 border border-indigo-100"
                          : "text-slate-600 hover:bg-slate-50 hover:text-slate-900 border border-transparent",
                      )}
                    >
                      <div
                        className={cn(
                          "p-2 rounded-lg",
                          location.pathname === link.path
                            ? "bg-indigo-100/50"
                            : "bg-slate-100",
                        )}
                      >
                        <Icon className="w-5 h-5" />
                      </div>
                      {link.name}
                    </Link>
                  );
                })}

                <div className="pt-6 mt-6 border-t border-slate-200 flex flex-col gap-3">
                  <Link
                    to="/finances"
                    onClick={() => setIsMobileMenuOpen(false)}
                    className="flex justify-center items-center gap-2 px-4 py-3.5 rounded-xl text-base font-bold bg-emerald-500 text-white hover:bg-emerald-600 transition-colors shadow-md shadow-emerald-200 font-bengali"
                  >
                    <CalendarHeart className="w-5 h-5" />
                    আয়-ব্যয় হিসাব
                  </Link>

                  {user ? (
                    <Link
                      to="/"
                      onClick={() => setIsMobileMenuOpen(false)}
                      className="flex justify-center items-center gap-2 px-4 py-3.5 rounded-xl text-base font-bold text-slate-700 bg-slate-100 hover:bg-slate-200 border border-slate-200 transition-colors"
                    >
                      <Home className="w-6 h-6 text-slate-500" />
                      হোম পেজ
                    </Link>
                  ) : (
                    <>
                      <Link
                        to="/login"
                        onClick={() => setIsMobileMenuOpen(false)}
                        className="flex justify-center items-center gap-2 px-4 py-3.5 rounded-xl text-base font-bold text-slate-700 bg-slate-100 hover:bg-slate-200 border border-slate-200 transition-colors"
                      >
                        <UserCircle className="w-5 h-5 text-slate-500" />
                        Login (Admin/Member)
                      </Link>
                      <Link
                        to="/register"
                        onClick={() => setIsMobileMenuOpen(false)}
                        className="flex justify-center items-center gap-2 px-4 py-3.5 rounded-xl text-base font-bold bg-indigo-600 text-white hover:bg-indigo-700 shadow-md shadow-indigo-200 transition-colors"
                      >
                        Join Limitless
                      </Link>
                    </>
                  )}
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </nav>

      <main>
        <Outlet />
      </main>

      {/* Mobile Bottom Navigation (Authenticated only) */}
      {user && (
        <div className="fixed bottom-0 left-0 right-0 h-[68px] bg-white dark:bg-slate-800 border-t border-slate-200 dark:border-slate-700 flex md:hidden items-center justify-around px-2 z-40 shadow-[0_-10px_40px_rgba(0,0,0,0.06)] pb-safe">
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

           <button onClick={() => logout()} className="flex flex-col items-center justify-center gap-1 w-16 h-full transition-all text-slate-500 dark:text-slate-400 hover:text-rose-500 outline-none">
              <LogOut className="w-6 h-6" />
              <span className="text-[10px] font-bold uppercase tracking-wide">লগআউট</span>
           </button>
        </div>
      )}

      <footer className={cn("bg-white border-t border-slate-200 mt-20", user && "pb-20 md:pb-0")}>
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-8">
            <div className="col-span-1 md:col-span-2">
              <Link to="/" className="flex items-center gap-2 mb-4 group">
                {siteSettings.iconUrl ? (
                  <img src={siteSettings.iconUrl} alt="Logo" className="h-8 w-8 object-contain group-hover:rotate-12 transition-transform duration-300" />
                ) : (
                  <Logo className="h-8 w-8 group-hover:rotate-12 transition-transform duration-300" />
                )}
                <span className="font-bold text-lg text-indigo-900">
                  {siteSettings.title}
                </span>
              </Link>
              <p className="text-slate-500 text-sm max-w-sm">
                এটি একটি সামাজিক পাঠাগার যা সবার জন্য উন্মুক্ত। আপনার একটি বই উপহার বা আর্থিক অনুদান আমাদের পথচলাকে আরও সুসংহত করতে পারে।
              </p>
            </div>
            <div>
              <h3 className="font-semibold text-sm mb-4 uppercase tracking-wider text-slate-900">
                Links
              </h3>
              <ul className="space-y-3">
                <li>
                  <Link
                    to="/dashboard/book-requests"
                    className="text-slate-500 hover:text-indigo-600 text-sm"
                  >
                    Books Catalog
                  </Link>
                </li>
                <li>
                  <Link
                    to="/donors"
                    className="text-slate-500 hover:text-indigo-600 text-sm"
                  >
                    Donors Wall
                  </Link>
                </li>
                <li>
                  <Link
                    to="/blog"
                    className="text-slate-500 hover:text-indigo-600 text-sm"
                  >
                    Blog & News
                  </Link>
                </li>
                <li>
                  <Link
                    to="/login"
                    className="text-slate-500 hover:text-indigo-600 text-sm font-medium"
                  >
                    Admin Portal (Login)
                  </Link>
                </li>
              </ul>
            </div>
            <div>
              <h3 className="font-semibold text-sm mb-4 uppercase tracking-wider text-slate-900">
                Contact
              </h3>
              <ul className="space-y-3">
                <li className="text-slate-500 text-sm">
                  ঠিকানা: পানধোয়া, সেনওয়ালিয়া-1344, আশুলিয়া, সাভার, ঢাকা।
                </li>
                <li className="text-slate-500 text-sm">
                  WhatsApp: 01570206953
                </li>
                <li>
                  <a
                    href="https://wa.me/8801570206953"
                    target="_blank"
                    rel="noreferrer"
                    className="text-indigo-600 hover:text-indigo-700 font-medium text-sm"
                  >
                    Click to Chat &rarr;
                  </a>
                </li>
              </ul>
            </div>
          </div>
          <div className="border-t border-slate-200 mt-12 pt-8 text-sm text-slate-400 flex justify-between items-center">
            <p>
              &copy; {new Date().getFullYear()} পানধোয়া উন্মুক্ত পাঠাগার। সর্বস্বত্ব সংরক্ষিত।
            </p>
          </div>
        </div>
      </footer>
    </div>
  );
}
