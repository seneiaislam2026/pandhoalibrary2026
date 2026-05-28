import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../../store/AuthContext';
import { BookOpen, AlertCircle, ArrowRight, X, Send, Lock, MapPin, Phone } from 'lucide-react';
import { Logo } from '../../components/Logo';
import { cn } from '../../lib/utils';
import { motion, AnimatePresence } from 'motion/react';
import { signInWithPopup, GoogleAuthProvider, signInWithEmailAndPassword, createUserWithEmailAndPassword } from 'firebase/auth';
import { auth, db } from '../../lib/firebase';
import { doc, getDoc, setDoc, collection, serverTimestamp, query, where, getDocs, deleteDoc, limit } from 'firebase/firestore';
import toast from 'react-hot-toast';

export default function Login() {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [email, setEmail] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [showForgot, setShowForgot] = useState(false);
  const [forgotData, setForgotData] = useState({ username: '', phone: '' });
  const [forgotLoading, setForgotLoading] = useState(false);

  const navigate = useNavigate();
  const { user, login, loginWithUsername, loading: authLoading } = useAuth();

  React.useEffect(() => {
    if (user && !authLoading) {
      if (user.role === 'kiosk') {
        navigate('/kiosk', { replace: true });
      } else {
        navigate('/dashboard', { replace: true });
      }
    }
  }, [user, authLoading, navigate]);

  const handleGoogleLogin = async () => {
    setError('');
    setLoading(true);
    try {
      const provider = new GoogleAuthProvider();
      const result = await signInWithPopup(auth, provider);
      const user = result.user;

      // Check if user exists in Firestore
      const userDoc = await getDoc(doc(db, 'users', user.uid));
      const isAdminEmail = user.email === 'seneiaislam@gmail.com' || user.email === 'admin@library.com';
      
      if (!userDoc.exists()) {
        // Redirect to register with initial data if profile missing
        navigate('/register', { 
            state: { 
                prefill: { 
                    name: user.displayName || '', 
                    email: user.email || '',
                    googleUid: user.uid
                } 
            } 
        });
        return;
      } else {
        // Always ensure admin role for this specific email
        if (isAdminEmail && userDoc.data().role !== 'admin') {
          await setDoc(doc(db, 'users', user.uid), { role: 'admin' }, { merge: true });
        }
      }
      navigate('/dashboard');
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

      try {
        const usernameLower = username.toLowerCase();
        
        if (usernameLower === 'admin' || usernameLower === 'seneiaislam' || usernameLower === 'seneiaislam@gmail.com') {
           // We will allow normal password check so Firebase auth can handle it!
           // if (password !== 'pandhoalibrary@28052020') {
           //    throw new Error('ভুল পাসওয়ার্ড! অ্যাডমিন হিসেবে লগইন করতে সঠিক পাসওয়ার্ড দিন।');
           // }
        }
        
        // Specifically check for the user's requested admin credentials
        const isMasterAdmin = (usernameLower === 'admin' && password === 'pandhoalibrary@28052020') || (usernameLower === 'seneiaislam' && password === 'pandhoalibrary@28052020') || (usernameLower === 'seneiaislam@gmail.com' && password === 'pandhoalibrary@28052020');
        const isKioskMode = (usernameLower === 'librarypc' && (password === 'pcmood@@' || password === 'Pcmood@@'));
        
        if (isKioskMode) {
          const settingsSnap = await getDoc(doc(db, 'settings', 'general'));
          if (settingsSnap.exists() && settingsSnap.data().isKioskModeEnabled === false) {
             throw new Error('Kiosk Mode (Self-Service) বর্তমানে বন্ধ আছে। অ্যাডমিন প্যানেল থেকে এটি চালু করুন।');
          }
        }

        const loginEmail = isMasterAdmin ? 'admin_master@library.com' : (isKioskMode ? 'librarypc@library.com' : (username.includes('@') ? username : (usernameLower === 'admin' ? 'admin@library.com' : `${usernameLower}@library.com`)));
        
        try {
          // 1. Force Firebase Auth Login First (FASTEST PATH)
          await signInWithEmailAndPassword(auth, loginEmail, password);
          
          const currentUid = auth.currentUser?.uid;
          if (currentUid && (isMasterAdmin || isKioskMode)) {
            // Update/Verify admin record in Firestore silently
            setDoc(doc(db, 'users', currentUid), { 
              role: isKioskMode ? 'kiosk' : 'admin', 
              email: loginEmail,
              username: usernameLower,
              id: currentUid,
              updatedAt: serverTimestamp()
            }, { merge: true }).catch(console.error);
          } else if (currentUid) {
            const userDocSnap = await getDoc(doc(db, 'users', currentUid));
            if (userDocSnap.exists() && userDocSnap.data().status === 'pending') {
               await auth.signOut();
               throw new Error('আপনার একাউন্টটি বর্তমানে পাঠাগার কর্তৃপক্ষের অনুমোদনের অপেক্ষায় আছে। অ্যাডমিন এপ্রুভ না করা পর্যন্ত লগইন করা যাবে না।');
            }
          }
          
          if (isKioskMode) {
              navigate('/kiosk');
          } else {
              navigate('/dashboard');
          }
          return;
        } catch (authErr: any) {
          if (authErr.message && authErr.message.includes('অনুমোদনের অপেক্ষায়')) {
             throw authErr;
          }
          console.warn("Firebase Auth login failed, checking migration/fallback:", authErr.code);

          // 2. Fallback manual checks if auth login fails
          let manualUser: any = null;
          try {
            if (isMasterAdmin) {
                manualUser = {
                    username: usernameLower,
                    password: 'pandhoalibrary@28052020',
                    name: 'System Admin',
                    role: 'admin',
                    status: 'active',
                    id: 'admin_master_uid'
                };
            } else if (isKioskMode) {
                manualUser = {
                    username: usernameLower,
                    password: password,
                    name: 'Library Kiosk',
                    role: 'kiosk',
                    status: 'active',
                    id: 'kiosk_pc_uid'
                };
            } else {
               // Only query if it isn't an admin override
                let q = query(collection(db, "users"), where("username", "==", username), limit(1));
                let querySnapshot = await getDocs(q);
                
                if (querySnapshot.empty && username !== usernameLower) {
                    q = query(collection(db, "users"), where("username", "==", usernameLower), limit(1));
                    querySnapshot = await getDocs(q);
                }

                if (!querySnapshot.empty) {
                    const userDoc = querySnapshot.docs[0];
                    const userData = userDoc.data();
                    if (userData.password === password) {
                        manualUser = { ...userData, id: userDoc.id };
                    }
                }
            }
          } catch (err: any) {
            console.error("Lookup error:", err);
          }

          // Check if manual user is pending before migrating
          if (manualUser && manualUser.status === 'pending' && !isMasterAdmin) {
              throw new Error('আপনার একাউন্টটি বর্তমানে পাঠাগার কর্তৃপক্ষের অনুমোদনের অপেক্ষায় আছে। অ্যাডমিন এপ্রুভ না করা পর্যন্ত লগইন করা যাবে না।');
          }

          // 3. Migration: If they exist in Firestore but NOT in Auth, create the Auth account now
          if ((authErr.code === 'auth/user-not-found' || authErr.code === 'auth/invalid-credential') && (manualUser || isMasterAdmin)) {
               try {
                  const cred = await createUserWithEmailAndPassword(auth, loginEmail, password);
                  const finalRole = (usernameLower === 'admin' || isMasterAdmin) ? 'admin' : (manualUser?.role || 'reader');
                  
                  await setDoc(doc(db, 'users', cred.user.uid), { 
                    ...(manualUser || {}),
                    username: usernameLower,
                    id: cred.user.uid, 
                    email: loginEmail, 
                    role: finalRole,
                    updatedAt: serverTimestamp()
                  });

                  if (manualUser && manualUser.id !== cred.user.uid && manualUser.id !== 'admin_master_uid' && manualUser.id !== 'kiosk_pc_uid') {
                      await deleteDoc(doc(db, 'users', manualUser.id));
                  }
                  
                  if (isKioskMode) {
                      navigate('/kiosk');
                  } else {
                      navigate('/dashboard');
                  }
                  return;
               } catch (createErr: any) {
                  if (createErr.code === 'auth/email-already-in-use') {
                     // The account exists in Auth but with a different password.
                     // We skip migration and proceed to manual session fallback.
                     console.warn("Auth account already exists, skipping migration creation.");
                  } else {
                     console.error("Warning: Failed to create Auth account during migration:", createErr.message);
                  }
               }
          }
          
          // 4. Last Resort: Manual session (Note: Writes might still fail if Firestore rejects non-auth users)
          if (manualUser && (manualUser.password === password || isMasterAdmin)) {
            console.log("Using manual session fallback.");
            await loginWithUsername(username, password);
            navigate('/dashboard');
            return;
          }
          
          throw authErr;
        }

      } catch (err: any) {
      if (err.code === 'auth/user-not-found' || err.code === 'auth/wrong-password' || err.code === 'auth/invalid-credential' || err.code === 'auth/invalid-email' || err.message === 'User not found' || err.message === 'Invalid password') {
        setError('Invalid credentials. Please check your username and password.');
      } else {
        setError(err.message);
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-[85vh] flex items-center justify-center py-12 px-4 sm:px-6 lg:px-8">
      <motion.div 
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="max-w-md w-full space-y-8 bg-white p-10 rounded-[24px] shadow-[0_2px_40px_rgba(0,0,0,0.04)] border border-slate-100"
      >
        <div>
          <div className="flex justify-center">
            <Logo className="h-16 w-16" />
          </div>

          <h2 className="text-center text-2xl font-extrabold tracking-tight text-slate-900 font-bengali uppercase mt-6">
            স্বাগতম (Welcome Back)
          </h2>

          <p className="mt-4 text-center text-sm text-slate-500 font-bengali">
            আপনার ইউজারনেম এবং পাসওয়ার্ড দিয়ে লগইন করুন
          </p>
        </div>
        
        <form className="mt-8 space-y-6" onSubmit={handleSubmit}>
          {error && (
            <div className="bg-rose-50 text-rose-600 p-4 rounded-xl flex items-start gap-3 text-sm font-medium">
              <AlertCircle className="w-5 h-5 shrink-0 mt-0.5" />
              <p>{error}</p>
            </div>
          )}
          
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1.5" htmlFor="username">
                Username
              </label>
              <input
                id="username"
                name="username"
                type="text"
                required
                className="appearance-none block w-full px-4 py-3 border border-slate-200 rounded-xl bg-slate-50 text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-600/20 focus:border-indigo-600 focus:bg-white transition-colors sm:text-sm font-bengali"
                placeholder="ইউজারনেম দিন"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
              />
            </div>
            <div>
              <div className="flex items-center justify-between mt-1.5">
                <label className="block text-sm font-medium text-slate-700" htmlFor="password">
                  পাসওয়ার্ড
                </label>
                <button 
                  type="button"
                  onClick={() => setShowForgot(true)}
                  className="text-xs font-semibold text-indigo-600 hover:text-indigo-500 font-bengali"
                >
                  পাসওয়ার্ড ভুলে গেছেন?
                </button>
              </div>
              <input
                id="password"
                name="password"
                type="password"
                required
                className="appearance-none block w-full px-4 py-3 border border-slate-200 rounded-xl bg-slate-50 text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-600/20 focus:border-indigo-600 focus:bg-white transition-colors sm:text-sm font-bengali"
                placeholder="••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
              />
            </div>
          </div>

          <div>
            <button
              type="submit"
              disabled={loading}
              className="group relative w-full flex justify-center items-center py-3.5 px-4 border border-transparent text-sm font-semibold rounded-xl text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-600 focus:ring-offset-white disabled:opacity-50 disabled:cursor-not-allowed transition-all"
            >
              {loading ? 'Signing in...' : 'Sign in'}
              {!loading && <ArrowRight className="ml-2 w-4 h-4 group-hover:translate-x-1 transition-transform" />}
            </button>
          </div>

          <div className="relative">
            <div className="absolute inset-0 flex items-center">
              <div className="w-full border-t border-slate-200"></div>
            </div>
            <div className="relative flex justify-center text-sm">
              <span className="px-2 bg-white text-slate-500">Or continue with</span>
            </div>
          </div>

          <div>
            <button
              type="button"
              disabled={loading}
              onClick={handleGoogleLogin}
              className="w-full flex justify-center items-center gap-3 py-3.5 px-4 border border-slate-200 rounded-xl text-sm font-semibold text-slate-700 bg-white hover:bg-slate-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-600 focus:ring-offset-white transition-all"
            >
              <img src="https://www.google.com/favicon.ico" alt="Google" className="w-4 h-4" />
              Sign in with Google
            </button>
          </div>
        </form>

        <div className="mt-8 text-center text-sm">
          <p className="text-slate-500">
            Don't have an account?{' '}
            <Link to="/register" className="font-semibold text-indigo-600 hover:text-indigo-500 transition-colors">
              Become a member
            </Link>
          </p>
        </div>
      </motion.div>

      <AnimatePresence>
        {showForgot && (
          <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4">
            <motion.div 
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="bg-white rounded-3xl w-full max-w-md overflow-hidden shadow-2xl border border-slate-100"
            >
              <div className="bg-amber-500 p-6 text-white flex justify-between items-center">
                <h3 className="text-xl font-bold flex items-center gap-2 text-white font-bengali">
                  <Lock className="w-5 h-5" />
                  পাসওয়ার্ড রিসেটের অনুরোধ
                </h3>
                <button onClick={() => setShowForgot(false)} className="p-2 hover:bg-white/10 rounded-xl transition">
                  <X className="w-6 h-6" />
                </button>
              </div>
              <form onSubmit={async (e) => {
                  e.preventDefault();
                  setForgotLoading(true);
                  try {
                      const newDocRef = doc(collection(db, "reset-requests"));
                      await setDoc(newDocRef, {
                          id: newDocRef.id,
                          ...forgotData,
                          status: 'Pending',
                          createdAt: serverTimestamp()
                      });
                      toast.success('রিসেট এর অনুরোধ পাঠানো হয়েছে! এডমিনের এপ্রুভালের জন্য অপেক্ষা করুন।');
                      setShowForgot(false);
                  } catch (err) {
                      console.error(err);
                      toast.error('অনুরোধ পাঠাতে সমস্যা হচ্ছে');
                  } finally {
                      setForgotLoading(false);
                  }
              }} className="p-8 space-y-6">
                <p className="text-sm text-slate-600 font-medium leading-relaxed font-bengali">
                  আপনার ইউজারনেম এবং রেজিস্টার্ড ফোন নম্বর দিন। একজন এডমিন আপনার অনুরোধ চেক করে আপনার পাসওয়ার্ড রিসেট করে দিবেন।
                </p>
                <div>
                  <label className="block text-xs font-black text-slate-400 uppercase tracking-widest mb-2 font-bengali">ইউজারনেম</label>
                  <input
                    required
                    type="text"
                    value={forgotData.username}
                    onChange={e => setForgotData({ ...forgotData, username: e.target.value })}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 focus:outline-none focus:ring-2 focus:ring-amber-500 transition font-medium font-bengali"
                    placeholder="উদা: AlMahmud"
                  />
                </div>
                <div>
                  <label className="block text-xs font-black text-slate-400 uppercase tracking-widest mb-2 font-bengali">ফোন নম্বর</label>
                  <input
                    required
                    type="text"
                    value={forgotData.phone}
                    onChange={e => setForgotData({ ...forgotData, phone: e.target.value })}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 focus:outline-none focus:ring-2 focus:ring-amber-500 transition font-medium font-bengali"
                    placeholder="উদা: 017..."
                  />
                </div>
                <button 
                  type="submit" 
                  disabled={forgotLoading}
                  className="w-full bg-slate-900 text-white py-4 rounded-xl font-black uppercase tracking-widest hover:bg-slate-800 transition shadow-lg flex items-center justify-center gap-2"
                >
                  {forgotLoading ? 'পাঠানো হচ্ছে...' : <><Send className="w-4 h-4" /> অনুরোধ পাঠান</>}
                </button>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
