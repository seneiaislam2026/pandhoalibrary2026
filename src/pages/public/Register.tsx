import React, { useState, useEffect } from 'react';
import { useNavigate, Link, useLocation } from 'react-router-dom';
import { BookOpen, AlertCircle, ArrowRight, CheckCircle2, ShieldCheck, Mail, Phone, Lock, User, Send, DollarSign } from 'lucide-react';
import { Logo } from '../../components/Logo';
import { motion, AnimatePresence } from 'motion/react';

import { setDoc, doc, getDoc, getDocs, collection, query, where, serverTimestamp } from 'firebase/firestore';
import { auth, db, handleFirestoreError, OperationType } from '../../lib/firebase';
import { createUserWithEmailAndPassword, updateProfile } from 'firebase/auth';
import { useAuth } from '../../store/AuthContext';

declare global {
  interface Window {
    recaptchaVerifier: any;
    confirmationResult: any;
  }
}

export default function Register() {
  const navigate = useNavigate();
  const location = useLocation();
  const prefill = location.state?.prefill;

  const calculateAge = (dobString: string) => {
    if (!dobString) return '০';
    const dobDate = new Date(dobString);
    if (isNaN(dobDate.getTime())) return '০';
    const today = new Date();
    let age = today.getFullYear() - dobDate.getFullYear();
    const m = today.getMonth() - dobDate.getMonth();
    if (m < 0 || (m === 0 && today.getDate() < dobDate.getDate())) {
      age--;
    }
    return String(Math.max(0, age));
  };

  const [name, setName] = useState(prefill?.name || "");
  const [phone, setPhone] = useState("");
  const [address, setAddress] = useState("");
  const [dob, setDob] = useState("");
  const [className, setClassName] = useState("");
  const [fatherName, setFatherName] = useState("");
  const [institution, setInstitution] = useState("");
  const [username, setUsername] = useState(prefill?.username || "");
  const [password, setPassword] = useState("");
  const [paymentMethod, setPaymentMethod] = useState<'online' | 'offline'>('online');
  const [paymentNumber, setPaymentNumber] = useState("");
  const [trxId, setTrxId] = useState("");
  const [pledge, setPledge] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [customQuestions, setCustomQuestions] = useState<string[]>([]);
  const [customAnswers, setCustomAnswers] = useState<Record<string, string>>({});

  const [isFreeRegistration, setIsFreeRegistration] = useState(false);

  const { user, loading: authLoading } = useAuth();
  
  useEffect(() => {
    if (user && !authLoading) {
      navigate('/dashboard', { replace: true });
    }
  }, [user, authLoading, navigate]);

  useEffect(() => {
    const fetchSettings = async () => {
      try {
        const docRef = doc(db, 'settings', 'general');
        const docSnap = await getDoc(docRef);
        if (docSnap.exists()) {
          const data = docSnap.data();
          if (data.readerRegistrationQuestions && Array.isArray(data.readerRegistrationQuestions)) {
            setCustomQuestions(data.readerRegistrationQuestions);
          }
          if (data.isReaderRegistrationFree) {
            setIsFreeRegistration(true);
            setPaymentMethod('offline'); // Automatically use offline/free system
          }
        }
      } catch (err) {
         console.error('Failed to fetch settings:', err);
      }
    };
    fetchSettings();
  }, []);

  useEffect(() => {
    if (prefill?.name) setName(prefill.name);
    if (prefill?.email) setUsername(prefill.email.split("@")[0]);
  }, [prefill]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      const email = prefill?.email || `${username.toLowerCase()}@library.com`;
      
      // No longer listing all users to generate ID (security risk + permission denied for regular users)
      // memberId will be assigned by admin upon activation
      const memberId = ""; 
      
      let userId = prefill?.googleUid;
      if (!userId) {
        const userCredential = await createUserWithEmailAndPassword(auth, email, password);
        userId = userCredential.user.uid;
      }

      const newUser = {
        id: userId,
        name: name,
        username: username,
        password: password, // For manual login fallback
        role: 'reader',
        status: 'pending',
        phone: phone,
        address: address,
        createdAt: new Date().toISOString(),
        serverCreatedAt: serverTimestamp(),
        memberId: memberId,
        email: email,
        verified: isFreeRegistration ? true : false,
        paymentMethod: paymentMethod,
        paymentNumber: paymentMethod === 'online' ? paymentNumber : '',
        trxId: paymentMethod === 'online' ? trxId : '',
        feeAmount: isFreeRegistration ? 0 : 50,
        pledge: pledge,
        dob: dob,
        class: className,
        fatherName: fatherName,
        institution: institution,
        customAnswers: customAnswers
      };

      await setDoc(doc(db, 'users', newUser.id), newUser).catch(err => handleFirestoreError(err, OperationType.WRITE, `users/${newUser.id}`));
      
      setSuccess(true);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  if (success) {
    return (
      <div className="min-h-[85vh] flex items-center justify-center py-12 px-4 sm:px-6 lg:px-8">
        <motion.div 
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          className="max-w-md w-full bg-white p-10 rounded-[24px] shadow-[0_2px_40px_rgba(0,0,0,0.04)] border border-emerald-100 text-center"
        >
          <div className="mx-auto w-16 h-16 bg-emerald-100 text-emerald-600 rounded-full flex items-center justify-center mb-6">
            <CheckCircle2 className="w-8 h-8" />
          </div>
          <h2 className="text-2xl font-semibold tracking-tight text-slate-900 mb-2">রেজিস্ট্রেশন সম্পন্ন হয়েছে!</h2>
          <p className="text-slate-600 mb-8 leading-relaxed">
            আপনার একাউন্টটি বর্তমানে পাঠাগার কর্তৃপক্ষের অনুমোদনের অপেক্ষায় আছে 😊। পাঠাগার কর্তৃপক্ষ এপ্রুভ না করলে মেম্বার হওয়া যাবে না। { !isFreeRegistration && 'দয়া করে নিয়ম অনুযায়ী মেম্বারশিপ ফি পরিশোধ নিশ্চিত করুন।' }
          </p>
          <Link
            to="/login"
            className="inline-flex justify-center items-center py-3 px-6 border border-slate-200 shadow-sm text-sm font-semibold rounded-xl text-slate-900 bg-white hover:bg-slate-50 transition-all w-full"
          >
            লগইন পেজে যান
          </Link>
        </motion.div>
      </div>
    );
  }

  return (
    <div className="min-h-[85vh] flex items-center justify-center py-12 px-4 sm:px-6 lg:px-8">
      <motion.div 
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="max-w-md w-full space-y-6 bg-white p-8 sm:p-10 rounded-[24px] shadow-[0_2px_40px_rgba(0,0,0,0.04)] border border-slate-100"
      >
        <div className="text-center">
          <div className="flex justify-center mb-4">
            <Logo className="h-16 w-16" />
          </div>
          <h2 className="text-3xl font-extrabold tracking-tight text-slate-900 font-bengali">
            পাঠাগারের সদস্য হোন
          </h2>
          <p className="mt-2 text-sm text-slate-500 max-w-sm mx-auto font-bengali">
            পানধোয়া উন্মুক্ত পাঠাগারের সদস্য হয়ে হাজার হাজার বই পড়ার সুযোগ নিন।
          </p>
        </div>

        {/* Payment Section */}
        {!isFreeRegistration && (
        <div className="mt-8">
          <div className={`border rounded-[1.5rem] p-4 sm:p-5 shadow-sm relative overflow-hidden transition-colors ${
            paymentMethod === 'online' ? 'bg-gradient-to-br from-[#E2136E]/5 to-white border-[#E2136E]/20' : 'bg-gradient-to-br from-indigo-50 to-white border-indigo-100'
          }`}>
             
             {/* Decorative Background */}
             {paymentMethod === 'online' && (
                <div className="absolute -top-10 -right-10 w-32 h-32 bg-[#E2136E]/5 rounded-full blur-2xl"></div>
             )}

             <div className="relative z-10">
                {/* Compact Toggle */}
                <div className="flex justify-center mb-6">
                  <div className="bg-white p-1 rounded-xl shadow-[0_2px_8px_-3px_rgba(0,0,0,0.1)] border border-slate-100 inline-flex max-w-full overflow-hidden">
                    <button
                      type="button"
                      onClick={() => setPaymentMethod('online')}
                      className={`px-3 sm:px-5 py-2 rounded-lg text-[13px] sm:text-sm font-bold font-bengali transition-all whitespace-nowrap ${
                        paymentMethod === 'online' 
                          ? 'bg-[#E2136E] text-white shadow-sm' 
                          : 'text-slate-500 hover:bg-slate-50'
                      }`}
                    >
                      বিকাশ পেমেন্ট
                    </button>
                    <button
                      type="button"
                      onClick={() => setPaymentMethod('offline')}
                      className={`px-3 sm:px-5 py-2 rounded-lg text-[13px] sm:text-sm font-bold font-bengali transition-all whitespace-nowrap ${
                        paymentMethod === 'offline' 
                          ? 'bg-indigo-600 text-white shadow-sm' 
                          : 'text-slate-500 hover:bg-slate-50'
                      }`}
                    >
                      সরাসরি প্রদান
                    </button>
                  </div>
                </div>

                {paymentMethod === 'online' ? (
                  <>
                    <div className="flex items-center gap-3 mb-5">
                       <div className="w-10 h-10 sm:w-12 sm:h-12 bg-[#E2136E] text-white rounded-2xl flex items-center justify-center shadow-lg shadow-[#E2136E]/20 shrink-0">
                          <ShieldCheck className="w-5 h-5 sm:w-6 sm:h-6" />
                       </div>
                       <div>
                         <h4 className="font-black text-[#E2136E] text-base sm:text-lg font-bengali leading-tight mb-0.5">সদস্য নিবন্ধন ফি: ৫০ টাকা</h4>
                         <p className="text-[11px] sm:text-xs font-bold text-slate-500 font-bengali leading-snug">বিকাশ সেন্ড মানি (Personal) করে ফর্মটি পূরণ করুন</p>
                       </div>
                    </div>

                    <div className="bg-white border border-[#E2136E]/10 p-3 sm:p-4 rounded-xl flex items-center justify-between mb-5 shadow-sm">
                       <div>
                          <p className="text-[10px] text-slate-400 font-black uppercase tracking-widest mb-0.5 sm:mb-1 font-bengali">বিকাশ নম্বর</p>
                          <p className="text-lg sm:text-xl font-black text-slate-800 font-mono tracking-wider">01570206953</p>
                       </div>
                       <div className="bg-[#E2136E]/10 text-[#E2136E] px-2.5 py-1 rounded-lg text-[10px] sm:text-xs font-black tracking-widest shrink-0">
                          bKash
                       </div>
                    </div>
                    
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      <div>
                        <label className="block text-[11px] font-black text-slate-600 mb-1.5 font-bengali" htmlFor="paymentNumber">
                          যে নম্বর থেকে পাঠিয়েছেন <span className="text-[#E2136E]">*</span>
                        </label>
                        <input
                          id="paymentNumber"
                          type="text"
                          required={paymentMethod === 'online'}
                          value={paymentNumber}
                          onChange={(e) => setPaymentNumber(e.target.value)}
                          className="block w-full px-4 py-3 border border-slate-200 rounded-xl bg-white text-slate-900 placeholder-slate-300 focus:outline-none focus:ring-2 focus:ring-[#E2136E]/20 focus:border-[#E2136E] text-sm font-mono transition-all"
                          placeholder="01XXXXXXXXX"
                        />
                      </div>
                      <div>
                        <label className="block text-[11px] font-black text-slate-600 mb-1.5 font-bengali" htmlFor="trxId">
                          ট্রানজেকশন আইডি <span className="text-[#E2136E]">*</span>
                        </label>
                        <input
                          id="trxId"
                          type="text"
                          required={paymentMethod === 'online'}
                          value={trxId}
                          onChange={(e) => setTrxId(e.target.value)}
                          className="block w-full px-4 py-3 border border-slate-200 rounded-xl bg-white text-slate-900 placeholder-slate-300 focus:outline-none focus:ring-2 focus:ring-[#E2136E]/20 focus:border-[#E2136E] text-sm font-mono transition-all uppercase"
                          placeholder="8X0XXXXXXX"
                        />
                      </div>
                    </div>
                  </>
                ) : (
                  <div className="bg-white border border-indigo-100 p-5 rounded-xl shadow-sm text-center relative z-10 w-full">
                     <div className="w-14 h-14 sm:w-16 sm:h-16 mx-auto bg-indigo-50 text-indigo-600 rounded-full flex items-center justify-center mb-3">
                       <DollarSign className="w-7 h-7 sm:w-8 sm:h-8" />
                     </div>
                     <h4 className="font-black text-slate-800 text-base sm:text-lg font-bengali mb-1.5">ফি প্রদান পদ্ধতি</h4>
                     <p className="text-xs sm:text-[13px] font-bold text-slate-500 font-bengali px-2 leading-relaxed">
                       আপনি পাঠাগারে এসে সরাসরি ৫০ টাকা নিবন্ধন ফি জমা দিতে পারবেন।
                     </p>
                  </div>
                )}
             </div>
          </div>
        </div>
        )}
        
        <form className="mt-8 space-y-5" onSubmit={handleSubmit}>
          {error && (
            <div className="bg-rose-50 text-rose-600 p-4 rounded-xl flex items-start gap-3 text-sm font-medium">
              <AlertCircle className="w-5 h-5 shrink-0 mt-0.5" />
              <p>{error}</p>
            </div>
          )}
          
          <div>
            <label className="block text-xs font-black text-slate-700 mb-1.5 font-bengali" htmlFor="name">
              পূর্ণ নাম
            </label>
            <input
              id="name"
              name="name"
              type="text"
              required
              className="appearance-none block w-full px-4 py-2.5 border border-slate-200 rounded-xl bg-slate-50 text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-600/20 focus:border-indigo-600 focus:bg-white transition-colors text-sm font-bengali font-bold"
              placeholder="আপনার পূর্ণ নাম"
              value={name}
              onChange={(e) => setName(e.target.value)}
            />
          </div>

          <div>
            <label className="block text-xs font-black text-slate-700 mb-1.5 font-bengali" htmlFor="phone">
              মোবাইল নম্বর
            </label>
            <input
              id="phone"
              name="phone"
              type="text"
              required
              className="appearance-none block w-full px-4 py-2.5 border border-slate-200 rounded-xl bg-slate-50 text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-600/20 focus:border-indigo-600 focus:bg-white transition-colors text-sm font-mono font-bold"
              placeholder="01XXXXXXXXX"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
            />
          </div>

          <div className="space-y-5 pt-4 border-t border-slate-100">
             <h3 className="text-sm font-black font-bengali text-slate-800 uppercase tracking-widest">পাঠক সদস্যের অতিরিক্ত তথ্য</h3>
             
             <div className="grid grid-cols-2 gap-4">
               <div>
                 <label className="block text-xs font-black text-slate-700 mb-1.5 font-bengali" htmlFor="dob">
                   জন্ম তারিখ
                 </label>
                 <input
                   id="dob"
                   type="date"
                   value={dob}
                   onChange={(e) => setDob(e.target.value)}
                   className="appearance-none block w-full px-4 py-2.5 border border-slate-200 rounded-xl bg-slate-50 text-slate-900 focus:outline-none focus:ring-2 focus:ring-indigo-600/20 focus:border-indigo-600 focus:bg-white transition-colors text-sm font-bold"
                 />
               </div>
               <div>
                 <label className="block text-xs font-black text-slate-700 mb-1.5 font-bengali">
                   বয়স
                 </label>
                 <div className="appearance-none w-full px-4 py-2.5 border border-slate-200 rounded-xl bg-slate-100 text-slate-900 text-sm font-bengali font-bold flex items-center">
                   {calculateAge(dob)} বছর
                 </div>
               </div>
             </div>

             <div>
               <label className="block text-xs font-black text-slate-700 mb-1.5 font-bengali" htmlFor="class">
                 শ্রেণি (Class)
               </label>
               <input
                 id="class"
                 type="text"
                 value={className}
                 onChange={(e) => setClassName(e.target.value)}
                 className="appearance-none block w-full px-4 py-2.5 border border-slate-200 rounded-xl bg-slate-50 text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-600/20 focus:border-indigo-600 focus:bg-white transition-colors text-sm font-bengali font-bold"
                 placeholder="আপনার শ্রেণি লিখুন"
               />
             </div>

             <div>
               <label className="block text-xs font-black text-slate-700 mb-1.5 font-bengali" htmlFor="fatherName">
                 পিতার নাম
               </label>
               <input
                 id="fatherName"
                 type="text"
                 value={fatherName}
                 onChange={(e) => setFatherName(e.target.value)}
                 className="appearance-none block w-full px-4 py-2.5 border border-slate-200 rounded-xl bg-slate-50 text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-600/20 focus:border-indigo-600 focus:bg-white transition-colors text-sm font-bengali font-bold"
                 placeholder="পিতার নাম লিখুন"
               />
             </div>

             <div>
               <label className="block text-xs font-black text-slate-700 mb-1.5 font-bengali" htmlFor="institution">
                 শিক্ষাপ্রতিষ্ঠান বা কর্মস্থলের নাম
               </label>
               <input
                 id="institution"
                 type="text"
                 value={institution}
                 onChange={(e) => setInstitution(e.target.value)}
                 className="appearance-none block w-full px-4 py-2.5 border border-slate-200 rounded-xl bg-slate-50 text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-600/20 focus:border-indigo-600 focus:bg-white transition-colors text-sm font-bengali font-bold"
                 placeholder="শিক্ষাপ্রতিষ্ঠান বা কর্মস্থলের নাম"
               />
             </div>

             <div>
               <label className="block text-xs font-black text-slate-700 mb-1.5 font-bengali" htmlFor="address">
                 বর্তমান ঠিকানা
               </label>
               <textarea
                 id="address"
                 required
                 rows={2}
                 value={address}
                 onChange={(e) => setAddress(e.target.value)}
                 className="appearance-none block w-full px-4 py-2.5 border border-slate-200 rounded-xl bg-slate-50 text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-600/20 focus:border-indigo-600 focus:bg-white transition-colors text-sm font-bengali font-bold resize-none"
                 placeholder="আপনার বর্তমান ঠিকানা"
               />
             </div>
             
             {customQuestions.length > 0 && (
                <>
                  {customQuestions.map((q, idx) => (
                    <div key={idx}>
                      <label className="block text-xs font-black text-slate-700 mb-1.5 font-bengali">
                        {q}
                      </label>
                      <input
                        type="text"
                        value={customAnswers[q] || ''}
                        onChange={(e) => setCustomAnswers({...customAnswers, [q]: e.target.value})}
                        className="appearance-none block w-full px-4 py-2.5 border border-slate-200 rounded-xl bg-slate-50 text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-600/20 focus:border-indigo-600 focus:bg-white transition-colors text-sm font-bengali font-bold"
                        placeholder="আপনার উত্তর"
                      />
                    </div>
                  ))}
                </>
             )}
          </div>

          <div className="space-y-5 pt-4 border-t border-slate-100">
             <div>
               <label className="block text-xs font-black text-slate-700 mb-1.5 font-bengali" htmlFor="username">
                 ইউজারনেম (ইংরেজিতে)
               </label>
               <input
                 id="username"
                 type="text"
                 required
                 value={username}
                 onChange={(e) => setUsername(e.target.value)}
                 className="appearance-none block w-full px-4 py-2.5 border border-slate-200 rounded-xl bg-slate-50 text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-600/20 focus:border-indigo-600 focus:bg-white transition-colors text-sm font-mono font-bold"
                 placeholder="minhaz2026"
               />
             </div>
  
             <div>
               <label className="block text-xs font-black text-slate-700 mb-1.5 font-bengali" htmlFor="password">
                 পাসওয়ার্ড
               </label>
               <input
                 id="password"
                 type="password"
                 required
                 value={password}
                 onChange={(e) => setPassword(e.target.value)}
                 className="appearance-none block w-full px-4 py-2.5 border border-slate-200 rounded-xl bg-slate-50 text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-600/20 focus:border-indigo-600 focus:bg-white transition-colors text-sm font-mono font-bold"
                 placeholder="••••••••"
               />
             </div>
          </div>

          <div className="space-y-4 pt-4 border-t border-slate-100">
             <div className="bg-amber-50/50 rounded-xl p-4 border border-amber-100/50">
               <label className="flex items-start gap-3 cursor-pointer group">
                 <input 
                   type="checkbox"
                   required
                   checked={pledge}
                   onChange={e => setPledge(e.target.checked)}
                   className="mt-0.5 w-5 h-5 rounded !border-amber-300 text-indigo-600 focus:ring-indigo-500 transition-colors shrink-0"
                 />
                 <span className="font-bengali text-sm font-bold text-slate-700 group-hover:text-amber-800 transition-colors">
                   আমি অঙ্গীকার করছি যে, আমি পাঠাগারের সকল নিয়মকানুন ও শর্তাবলী মেনে চলতে বাধ্য থাকবো।
                 </span>
               </label>
             </div>
          </div>

          <div className="pt-2">
            <button
              type="submit"
              disabled={loading}
              className="group w-full flex justify-center items-center py-3.5 px-4 rounded-xl text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-600 focus:ring-offset-white disabled:opacity-50 disabled:cursor-not-allowed transition-all font-bengali font-bold tracking-wide shadow-md hover:shadow-lg active:scale-95"
            >
              {loading ? 'অপেক্ষা করুন...' : 'সদস্য হিসেবে রেজিস্ট্রেশন করুন'}
              {!loading && <ArrowRight className="ml-2 w-4 h-4 group-hover:translate-x-1 transition-transform" />}
            </button>
          </div>
        </form>

        <div className="mt-8 text-center text-sm font-bengali">
          <p className="text-slate-500 font-medium tracking-wide">
            ইতিমধ্যেই সদস্য?{' '}
            <Link to="/login" className="font-bold text-indigo-600 hover:text-indigo-500 transition-colors">
              লগইন করুন
            </Link>
          </p>
        </div>
      </motion.div>
    </div>
  );
}
