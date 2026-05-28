import React, { useState, useEffect } from "react";
import { Link, useNavigate } from "react-router-dom";
import { ArrowRight, BookOpen, Users, Banknote, ShoppingCart, CalendarHeart, Sparkles, Star, Zap, LayoutDashboard, FileText } from "lucide-react";
import { motion } from "motion/react";
import { useTranslation } from "react-i18next";
import { Helmet } from 'react-helmet-async';
import { useAuth } from "../../store/AuthContext";
import { doc, getDoc } from 'firebase/firestore';
import { db } from '../../lib/firebase';

export default function Home() {
  const { t } = useTranslation();
  const { user, loading } = useAuth();
  const navigate = useNavigate();
  
  const [siteSettings, setSiteSettings] = useState({
    title: 'পানধোয়া উন্মুক্ত পাঠাগার',
    subtitle: 'জ্ঞানের আলোয় সমাজ গড়ি',
    description: 'একটি আধুনিক সমাজ বিনির্মাণে বইয়ের কোনো বিকল্প নেই। পানধোয়া উন্মুক্ত পাঠাগারে আপনাকে স্বাগতম। আসুন এক সাথে বই পড়ি।',
    iconUrl: ''
  });

  useEffect(() => {
    const fetchSettings = async () => {
      try {
        const docRef = doc(db, 'settings', 'general');
        const docSnap = await getDoc(docRef);
        if (docSnap.exists()) {
          const data = docSnap.data();
          setSiteSettings({
            title: data.websiteTitle || 'পানধোয়া উন্মুক্ত পাঠাগার',
            subtitle: data.websiteSubtitle || 'জ্ঞানের আলোয় সমাজ গড়ি',
            description: data.websiteDescription || 'একটি আধুনিক সমাজ বিনির্মাণে বইয়ের কোনো বিকল্প নেই। পানধোয়া উন্মুক্ত পাঠাগারে আপনাকে স্বাগতম। আসুন এক সাথে বই পড়ি।',
            iconUrl: data.homeIconUrl || ''
          });
        }
      } catch (err) {
        console.error("Failed to load settings", err);
      }
    };
    fetchSettings();
  }, []);

  React.useEffect(() => {
    // Only set visit flag, do not redirect users away from the landing page unless logged in.
    if (!loading) {
      if (user) {
        navigate('/dashboard', { replace: true });
      } else {
        if (!localStorage.getItem('pan_dhoa_visited')) {
          localStorage.setItem('pan_dhoa_visited', '1');
        }
      }
    }
  }, [user, loading, navigate]);

  const container = {
    hidden: { opacity: 0 },
    show: {
      opacity: 1,
      transition: {
        staggerChildren: 0.1
      }
    }
  };

  const item = {
    hidden: { opacity: 0, y: 20 },
    show: { opacity: 1, y: 0 }
  };

  return (
    <motion.div 
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="bg-slate-50 font-sans selection:bg-indigo-100 selection:text-indigo-900 relative overflow-hidden"
    >
      <Helmet>
        <title>{siteSettings.title}</title>
        <meta name="description" content={siteSettings.description} />
      </Helmet>

      {/* Hero Section */}
      <section className="relative pt-24 md:pt-32 pb-32 md:pb-40 px-6 overflow-hidden">
        {/* Abstract Background Shapes */}
        <motion.div 
          initial={{ opacity: 0 }}
          animate={{ opacity: [0.2, 0.4, 0.2] }}
          transition={{ duration: 10, repeat: Infinity, ease: "linear", delay: 1 }}
          className="absolute top-0 right-0 w-[400px] md:w-[600px] h-[400px] md:h-[600px] bg-indigo-500/10 rounded-full blur-[80px] md:blur-[100px] -mr-32 md:-mr-48 -mt-32 md:-mt-48"
          style={{ willChange: "opacity" }}
        />
        <motion.div 
          initial={{ opacity: 0 }}
          animate={{ opacity: [0.1, 0.3, 0.1] }}
          transition={{ duration: 8, repeat: Infinity, ease: "linear", delay: 2 }}
          className="absolute top-1/4 left-0 w-[300px] h-[300px] bg-emerald-500/10 rounded-full blur-[80px] -ml-40"
          style={{ willChange: "opacity" }}
        />
        <motion.div 
          initial={{ opacity: 0 }}
          animate={{ opacity: [0.1, 0.2, 0.1] }}
          transition={{ duration: 12, repeat: Infinity, ease: "linear", delay: 3 }}
          className="absolute bottom-0 right-1/4 w-[300px] h-[300px] bg-rose-500/10 rounded-full blur-[80px]"
          style={{ willChange: "opacity" }}
        />
        
        <div className="max-w-7xl mx-auto relative z-10 text-center">
          {siteSettings.iconUrl && (
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.8 }}
              className="flex justify-center mb-6"
            >
              <img src={siteSettings.iconUrl} alt="Home Icon" className="w-24 h-24 md:w-32 md:h-32 object-contain" />
            </motion.div>
          )}

          <motion.div
            initial={{ opacity: 0, scale: 0.8, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            transition={{ type: "spring", stiffness: 100, damping: 15 }}
            className="inline-flex items-center gap-3 bg-white/60 backdrop-blur-md px-5 py-2.5 rounded-full border border-slate-200/50 shadow-lg shadow-slate-200/30 mb-8 md:mb-12 cursor-default"
          >
            <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></div>
            <span className="text-[10px] md:text-xs font-black text-slate-500 uppercase tracking-[0.2em] font-bengali">একটি আধুনিক ডিজিটাল পাঠাগার</span>
          </motion.div>

          <motion.h1 
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 1, ease: [0.16, 1, 0.3, 1] }}
            className="text-5xl sm:text-6xl md:text-8xl lg:text-7xl xl:text-8xl font-black text-slate-900 mb-6 sm:mb-10 font-bengali tracking-tight leading-[1.2] sm:leading-[1.05]"
          >
            {siteSettings.title} <br className="hidden sm:block" />
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-indigo-600 to-indigo-400">{siteSettings.subtitle}</span>
          </motion.h1>
          
          <motion.p 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 1, delay: 0.2, ease: [0.16, 1, 0.3, 1] }}
            className="text-lg sm:text-xl md:text-2xl lg:text-xl xl:text-2xl text-slate-500 font-bengali max-w-3xl mx-auto mb-10 sm:mb-16 font-medium leading-relaxed px-4"
          >
            {siteSettings.description}
          </motion.p>

          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.8, delay: 0.2, ease: "easeInOut" }}
            className="flex flex-col sm:flex-row items-center justify-center gap-3 md:gap-6 flex-wrap px-4"
          >
            {!user && (
              <>
                <motion.div whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }} className="w-full sm:w-auto">
                  <Link
                    to="/register"
                    className="w-full sm:w-auto bg-slate-900 text-white px-6 sm:px-10 py-3.5 sm:py-5 rounded-[1.5rem] sm:rounded-[2rem] font-bold sm:font-black font-bengali text-base sm:text-xl hover:bg-slate-800 shadow-xl shadow-slate-900/10 hover:shadow-indigo-500/10 transition-all group flex items-center justify-center gap-2 sm:gap-3"
                  >
                    সদস্য হোন
                    <ArrowRight className="w-4 h-4 sm:w-5 sm:h-5 group-hover:translate-x-1 sm:group-hover:translate-x-2 transition-transform" />
                  </Link>
                </motion.div>
                <motion.div whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }} className="w-full sm:w-auto">
                  <Link
                    to="/login"
                    className="w-full sm:w-auto bg-indigo-600 text-white px-6 sm:px-10 py-3.5 sm:py-5 rounded-[1.5rem] sm:rounded-[2rem] font-bold sm:font-black font-bengali text-base sm:text-xl hover:bg-indigo-700 shadow-xl shadow-indigo-600/10 transition-all flex items-center justify-center gap-2 sm:gap-3"
                  >
                    লগইন করুন
                  </Link>
                </motion.div>

                <motion.div whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }} className="w-full sm:w-auto">
                  <Link
                    to="/books"
                    className="w-full sm:w-auto bg-white text-slate-900 px-6 sm:px-10 py-3.5 sm:py-5 rounded-[1.5rem] sm:rounded-[2rem] font-bold sm:font-black font-bengali text-base sm:text-xl border border-slate-200 hover:border-indigo-600 shadow-lg shadow-slate-200/40 hover:text-indigo-600 transition-all flex items-center justify-center gap-2 sm:gap-3"
                  >
                    বই ব্রাউজ করুন
                  </Link>
                </motion.div>
                <motion.div whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }} className="w-full sm:w-auto">
                  <Link
                    to="/buy-books"
                    className="w-full sm:w-auto bg-rose-50 text-rose-600 px-6 sm:px-10 py-3.5 sm:py-5 rounded-[1.5rem] sm:rounded-[2rem] font-bold sm:font-black font-bengali text-base sm:text-xl border border-rose-100 hover:bg-rose-600 hover:text-white shadow-lg shadow-rose-200/40 transition-all flex items-center justify-center gap-2 sm:gap-3"
                  >
                    <ShoppingCart className="w-4 h-4 sm:w-5 sm:h-5" />
                    বই কিনুন
                  </Link>
                </motion.div>
              </>
            )}
          </motion.div>
        </div>
      </section>

      {/* Features Grid */}
      <section className="py-32 px-6">
        <div className="max-w-7xl mx-auto">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-10">
            {[
              { icon: BookOpen, title: 'ডিজিটাল ক্যাটালগ', desc: 'হাজারো বইয়ের সংগ্রহ অনলাইনে দেখে নিন এবং আপনার পছন্দের বইটি খুঁজুন।', color: 'indigo' },
              { icon: CalendarHeart, title: 'ইভেন্ট ও প্রতিযোগিতা', desc: 'বৃত্তি পরীক্ষা এবং সাংস্কৃতিক প্রতিযোগিতায় অংশ নিন যা আপনার দক্ষতা বাড়াবে।', color: 'emerald' },
              { icon: ShoppingCart, title: 'অনলাইন বুক শপ', desc: 'সাশ্রয়ী মূল্যে পছন্দের বইগুলো অর্ডার করুন সরাসরি আপনার ঠিকানায়।', color: 'rose' }
            ].map((f, i) => (
              <motion.div
                key={i}
                initial={{ opacity: 0, y: 40 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true, margin: "-100px" }}
                transition={{ duration: 0.8, delay: i * 0.15, ease: [0.16, 1, 0.3, 1] }}
                whileHover={{ y: -10, transition: { duration: 0.3 } }}
                className="bg-white p-12 rounded-[3.5rem] shadow-2xl shadow-slate-200/50 border border-slate-50 group hover:shadow-indigo-500/10 transition-all"
              >
                <div className={`w-20 h-20 bg-${f.color}-50 text-${f.color}-600 rounded-[2rem] flex items-center justify-center mb-10 group-hover:scale-110 group-hover:rotate-6 transition-transform`}>
                  <f.icon size={36} />
                </div>
                <h3 className="text-3xl font-black text-slate-900 mb-6 font-bengali">{f.title}</h3>
                <p className="text-slate-500 font-bengali text-lg leading-relaxed">{f.desc}</p>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="py-32 px-6">
        <div className="max-w-7xl mx-auto">
          <motion.div 
            initial={{ opacity: 0, scale: 0.95 }}
            whileInView={{ opacity: 1, scale: 1 }}
            viewport={{ once: true }}
            transition={{ duration: 1, ease: [0.16, 1, 0.3, 1] }}
            className="bg-slate-900 rounded-[4rem] p-16 md:p-32 text-center relative overflow-hidden"
          >
             <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: [0.1, 0.2, 0.1] }}
              transition={{ duration: 8, repeat: Infinity, ease: "linear" }}
              className="absolute top-0 right-0 w-[400px] h-[400px] bg-indigo-500/20 rounded-full blur-[100px] -mr-32 -mt-32"
              style={{ willChange: "opacity" }}
             />
             
             <div className="relative z-10">
               <motion.h2 
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ duration: 0.8, delay: 0.2 }}
                className="text-4xl md:text-7xl font-black text-white mb-10 font-bengali tracking-tight leading-[1.1]"
               >
                 আমাদের অগ্রযাত্রার <br /> অংশ হতে চান?
               </motion.h2>
               <motion.p 
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ duration: 0.8, delay: 0.3 }}
                className="text-slate-400 font-bengali text-xl md:text-2xl mb-16 max-w-2xl mx-auto leading-relaxed"
               >
                 সদস্য আবেদন থেকে শুরু করে যেকোনো প্রয়োজনে আমাদের সাথেই থাকুন। জ্ঞানের আলো সবার মাঝে ছড়িয়ে দেই।
               </motion.p>
               <motion.div 
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ duration: 0.8, delay: 0.4 }}
                className="flex flex-col sm:flex-row justify-center gap-6"
               >
                 {!user && (
                   <motion.div whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }}>
                     <Link to="/register" className="w-full sm:w-auto bg-white text-slate-900 px-12 py-6 rounded-[2rem] font-black font-bengali text-xl hover:bg-indigo-400 hover:text-white transition-all shadow-2xl flex items-center justify-center">সদস্য হতে আবেদন করুন</Link>
                   </motion.div>
                 )}
                 <motion.div whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }}>
                   <Link to="/donors" className="w-full sm:w-auto bg-slate-800 text-white border border-slate-700 px-12 py-6 rounded-[2rem] font-black font-bengali text-xl hover:bg-slate-700 transition-all shadow-xl flex items-center justify-center">দাতা সদস্যদের তালিকা</Link>
                 </motion.div>
               </motion.div>
             </div>
          </motion.div>
        </div>
      </section>
    </motion.div>
  );
}
