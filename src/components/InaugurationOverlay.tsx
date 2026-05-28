import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { doc, onSnapshot } from 'firebase/firestore';
import { db } from '../lib/firebase';
import confetti from 'canvas-confetti';
import { BookOpen } from 'lucide-react';
import { useAuth } from '../store/AuthContext';

export default function InaugurationOverlay() {
  const { user } = useAuth();
  const [show, setShow] = useState(false);
  const [data, setData] = useState({ 
    title: '', 
    subtitle: '',
    message: '',
    buttonText: ''
  });

  useEffect(() => {
    const unsub = onSnapshot(doc(db, 'settings', 'general'), (docSnap) => {
      if (docSnap.exists()) {
        const settings = docSnap.data();
        if (settings.inaugurationEnabled) {
          const targets = settings.inaugurationTargetUsers || [];
          const isTargeted = targets.length === 0 || (user && targets.includes(user.id));
          
          if (isTargeted && !sessionStorage.getItem('inauguration_seen')) {
            setData({
              title: settings.inaugurationTitle || 'পানধোয়া উন্মুক্ত পাঠাগার',
              subtitle: settings.inaugurationSubtitle || 'শুভ উদ্বোধন',
              message: settings.inaugurationMessage || 'আমাদের প্রতিষ্ঠাবার্ষিকী অনুষ্ঠানে সকল সম্মানিত অতিথিবৃন্দকে জানাই আন্তরিক শুভেচ্ছা ও স্বাগত। জ্ঞান ও প্রযুক্তির আলোয় আলোকিত হোক আমাদের সমাজ। আসুন, বইয়ের পাতায় খুঁজি নতুন এক পৃথিবী।',
              buttonText: settings.inaugurationButtonText || 'অটোমেশন উদ্বোধন'
            });
            setShow(true);
          } else if (!isTargeted) {
             setShow(false);
          }
        } else {
          sessionStorage.removeItem('inauguration_seen');
          setShow(false);
        }
      }
    }, (err) => {
       console.error("Dashboard overlay error:", err);
    });

    return () => unsub();
  }, [user]);

  const handleOpen = () => {
    // trigger confetti for 15 seconds
    const duration = 15 * 1000;
    const animationEnd = Date.now() + duration;
    const defaults = { startVelocity: 30, spread: 360, ticks: 60, zIndex: 99999 };

    const randomInRange = (min: number, max: number) => Math.random() * (max - min) + min;

    const interval: any = setInterval(function() {
      const timeLeft = animationEnd - Date.now();

      if (timeLeft <= 0) {
        return clearInterval(interval);
      }

      const particleCount = 50 * (timeLeft / duration);
      confetti({ ...defaults, particleCount, origin: { x: randomInRange(0.1, 0.3), y: Math.random() - 0.2 } });
      confetti({ ...defaults, particleCount, origin: { x: randomInRange(0.7, 0.9), y: Math.random() - 0.2 } });
    }, 250);

    setTimeout(() => {
      setShow(false);
      sessionStorage.setItem('inauguration_seen', 'true');
    }, 2000); // Hide screen after a short delay, but confetti continues
  };

  return (
    <AnimatePresence>
      {show && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0, scale: 1.1, filter: "blur(10px)" }}
          transition={{ duration: 1.5, ease: "easeInOut" }}
          className="fixed inset-0 z-[9999] flex items-center justify-center bg-gradient-to-br from-indigo-950 via-blue-900 to-purple-900 overflow-hidden"
        >
          {/* Animated Background Orbs */}
          <motion.div 
            animate={{ scale: [1, 1.2, 1], rotate: [0, 90, 0] }}
            transition={{ duration: 20, repeat: Infinity, ease: 'linear' }}
            className="absolute -top-40 -right-40 w-96 h-96 bg-fuchsia-600/30 rounded-full blur-[100px]"
          />
          <motion.div 
            animate={{ scale: [1, 1.5, 1], x: [0, -50, 0] }}
            transition={{ duration: 15, repeat: Infinity, ease: 'easeInOut' }}
            className="absolute -bottom-40 -left-40 w-96 h-96 bg-blue-600/30 rounded-full blur-[100px]"
          />
          <div className="absolute inset-0 bg-[url('https://images.unsplash.com/photo-1451187580459-43490279c0fa?q=80&w=2000&auto=format&fit=crop')] bg-cover bg-center opacity-10 mix-blend-overlay"></div>
          
          <motion.div 
            initial={{ y: 50, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            transition={{ delay: 0.5, duration: 1 }}
            className="relative z-10 p-8 flex flex-col items-center max-w-2xl w-full text-center"
          >
            <motion.div 
              animate={{ 
                 boxShadow: ['0 0 0 0 rgba(167, 139, 250, 0.6)', '0 0 0 20px rgba(167, 139, 250, 0)', '0 0 0 0 rgba(167, 139, 250, 0)']
              }}
              transition={{ repeat: Infinity, duration: 2 }}
              className="w-32 h-32 rounded-full border-4 border-indigo-200/30 overflow-hidden mb-8 shadow-[0_0_40px_rgba(167,139,250,0.5)] flex items-center justify-center bg-white"
            >
              <motion.img 
                 src="https://i.ibb.co/b5B2gv9b/1777771470223.jpg" 
                 alt="লোগো" 
                 className="w-full h-full object-contain"
                 referrerPolicy="no-referrer"
                 initial={{ scale: 0.8, rotate: -10 }}
                 animate={{ scale: 1, rotate: 0 }}
                 transition={{ delay: 1, duration: 1, type: "spring" }}
              />
            </motion.div>

            <motion.h1 
               className="text-4xl md:text-5xl lg:text-7xl font-black font-bengali text-white text-center mb-6 leading-tight drop-shadow-lg"
               initial={{ scale: 0.9, opacity: 0 }}
               animate={{ scale: 1, opacity: 1 }}
               transition={{ delay: 1, duration: 0.8 }}
            >
              {data.title}
            </motion.h1>

            <motion.div
              initial={{ y: 20, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              transition={{ delay: 1.5, duration: 0.8 }}
            >
              <h2 className="text-2xl md:text-4xl font-bold font-bengali text-indigo-100 mb-6 drop-shadow-md">
                {data.subtitle}
              </h2>
              <p className="text-sm md:text-lg text-slate-300 font-bengali max-w-xl mx-auto leading-relaxed mb-12">
                 {data.message}
              </p>
            </motion.div>

            <motion.button
              onClick={handleOpen}
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              initial={{ y: 30, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              transition={{ delay: 2, duration: 0.8 }}
              className="group relative overflow-hidden rounded-full bg-gradient-to-r from-amber-400 to-amber-600 px-10 py-5 font-bengali font-black text-slate-900 shadow-[0_0_40px_rgba(251,191,36,0.4)] transition-all hover:shadow-[0_0_60px_rgba(251,191,36,0.6)]"
            >
              <span className="relative z-10 text-xl md:text-2xl flex items-center justify-center gap-3 text-amber-950">
                 {data.buttonText}
                 <span className="text-2xl w-8 h-8 flex items-center justify-center bg-white/20 rounded-full">✨</span>
              </span>
              <div className="absolute inset-0 -translate-x-full bg-gradient-to-r from-transparent via-white/40 to-transparent transition-transform duration-1000 group-hover:translate-x-full"></div>
            </motion.button>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
