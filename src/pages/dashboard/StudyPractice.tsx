import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { collection, query, where, getDocs, addDoc, serverTimestamp, doc, getDoc, setDoc } from 'firebase/firestore';
import { db } from '../../lib/firebase';
import { useAuth } from '../../store/AuthContext';
import { 
  BookOpen, 
  GraduationCap, 
  ArrowLeft, 
  Clock, 
  FileText, 
  Award, 
  Briefcase, 
  Compass, 
  Sparkles,
  ExternalLink,
  History,
  Layers,
  Search,
  BookMarked,
  CheckCircle2,
  Calendar,
  AlertCircle,
  User,
  TrendingUp,
  Target,
  PenSquare,
  Save,
  Activity,
  Share2,
  Zap,
  Bot,
  Paperclip,
  MessageSquare,
  Send
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import toast from 'react-hot-toast';
import PracticeAIChat from '../../components/PracticeAIChat';
import StudySubjectsGrid from '../../components/StudySubjectsGrid';

interface StudyContent {
  id: string;
  title: string;
  description: string;
  type: 'quiz' | 'lecture' | 'question_bank' | 'suggestion';
  targetCategory: string;
  link: string;
  createdAt?: any;
}

interface QuizAttempt {
  id: string;
  userId: string;
  userName: string;
  score: number;
  totalQuestions: number;
  percentage: number;
  date: string;
}

export default function StudyPractice() {
  const { user } = useAuth();
  const navigate = useNavigate();
  
  const [selectedCategory, setSelectedCategory] = useState<string | null>(() => {
    return localStorage.getItem('selected_study_category') || null;
  });

  const [selectedSubClass, setSelectedSubClass] = useState<string | null>(() => {
    return localStorage.getItem('selected_study_subclass') || null;
  });
  
  const [activeTab, setActiveTab] = useState<'exams' | 'library'>('exams');
  const [contents, setContents] = useState<StudyContent[]>([]);
  const [books, setBooks] = useState<any[]>([]);
  const [preBookings, setPreBookings] = useState<any[]>([]);
  const [attempts, setAttempts] = useState<QuizAttempt[]>([]);
  
  const [loading, setLoading] = useState(false);
  const [fetchingLibrary, setFetchingLibrary] = useState(false);
  const [fetchingHistory, setFetchingHistory] = useState(false);
  const [bookingInProgress, setBookingInProgress] = useState<string | null>(null);
  const [bookSearch, setBookSearch] = useState('');

  const [profile, setProfile] = useState<{
    dailyGoalHours: number;
    notes: string;
  }>({
    dailyGoalHours: 2,
    notes: '',
  });
  const [loadingProfile, setLoadingProfile] = useState(false);
  const [savingProfile, setSavingProfile] = useState(false);

  const [activeMenuTab, setActiveMenuTab] = useState<'question_bank' | 'mock_exam' | 'model_test' | 'my_profile'>('question_bank');
  const [selectedSubject, setSelectedSubject] = useState<string | null>(null);
  const [subjectSearchQuery, setSubjectSearchQuery] = useState('');

  const categories = [
    {
      id: 'class-6-8',
      name: 'ক্লাস ৬-৮',
      description: 'ষষ্ঠ থেকে অষ্টম শ্রেণীর একাডেমিক প্রস্তুতি',
      color: 'from-blue-500/15 via-indigo-500/5 to-transparent',
      borderColor: 'border-blue-200 dark:border-blue-800/40',
      textColor: 'text-blue-600 dark:text-blue-400',
      icon: BookOpen,
      iconBg: 'bg-blue-100 dark:bg-blue-950/50'
    },
    {
      id: 'ssc-dakhil',
      name: 'এসএসসি / দাখিল',
      description: 'এসএসসি এবং দাখিল পরীক্ষার পূর্ণাঙ্গ প্রস্তুতি',
      color: 'from-emerald-500/15 via-teal-500/5 to-transparent',
      borderColor: 'border-emerald-200 dark:border-emerald-800/40',
      textColor: 'text-emerald-600 dark:text-emerald-400',
      icon: Award,
      iconBg: 'bg-emerald-100 dark:bg-emerald-950/50'
    },
    {
      id: 'hsc-alim-admission',
      name: 'এইচএসসি / আলিম / এডমিশন',
      description: 'এইচএসসি, আলিম এবং বিশ্ববিদ্যালয় ভর্তি প্রস্তুতি',
      color: 'from-fuchsia-500/15 via-rose-500/5 to-transparent',
      borderColor: 'border-fuchsia-200 dark:border-fuchsia-800/40',
      textColor: 'text-fuchsia-600 dark:text-fuchsia-400',
      icon: GraduationCap,
      iconBg: 'bg-fuchsia-100 dark:bg-fuchsia-950/50'
    },
    {
      id: 'bcs-jobs',
      name: 'বিসিএস / জবস',
      description: 'বিসিএস প্রিলিমিনারি ও সকল সরকারী চাকরি প্রস্তুতি',
      color: 'from-amber-500/15 via-orange-500/5 to-transparent',
      borderColor: 'border-amber-200 dark:border-amber-800/40',
      textColor: 'text-amber-600 dark:text-amber-400',
      icon: Briefcase,
      iconBg: 'bg-amber-100 dark:bg-amber-950/50'
    }
  ];

  useEffect(() => {
    fetchOrCreateProfile(selectedCategory || 'class-6-8');
    fetchAttempts();
    fetchLibraryBooksAndPrebookings();

    if (selectedCategory) {
      localStorage.setItem('selected_study_category', selectedCategory);
      if (selectedSubClass) {
        localStorage.setItem('selected_study_subclass', selectedSubClass);
      } else {
        localStorage.removeItem('selected_study_subclass');
      }

      if (selectedCategory === 'class-6-8' && !selectedSubClass) {
        setContents([]);
      } else {
        fetchCategoryResources(selectedCategory);
      }
    } else {
      localStorage.removeItem('selected_study_category');
      localStorage.removeItem('selected_study_subclass');
      setSelectedSubClass(null);
      fetchCategoryResources('class-6-8');
    }
  }, [selectedCategory, selectedSubClass, user]);

  const fetchOrCreateProfile = async (catId: string) => {
    if (!user) return;
    setLoadingProfile(true);
    try {
      const profileId = `${user.id}_${catId}`;
      const docRef = doc(db, 'study_practice_profiles', profileId);
      const docSnap = await getDoc(docRef);
      if (docSnap.exists()) {
        const data = docSnap.data();
        setProfile({
          dailyGoalHours: data.dailyGoalHours ?? 2,
          notes: data.notes ?? '',
        });
      } else {
        const initial = {
          userId: user.id,
          userName: user.name || 'শিক্ষার্থী',
          category: catId,
          dailyGoalHours: 2,
          notes: '',
          updatedAt: new Date().toISOString()
        };
        await setDoc(docRef, initial);
        setProfile({
          dailyGoalHours: 2,
          notes: '',
        });
      }
    } catch (err) {
      console.error('Error fetching academic profile:', err);
    } finally {
      setLoadingProfile(false);
    }
  };

  const handleSaveProfile = async () => {
    if (!user) {
      toast.error('অনুগ্রহ করে আগে লগইন করুন।');
      return;
    }
    const catId = selectedCategory || 'class-6-8';
    setSavingProfile(true);
    try {
      const profileId = `${user.id}_${catId}`;
      const docRef = doc(db, 'study_practice_profiles', profileId);
      await setDoc(docRef, {
        userId: user.id,
        userName: user.name || 'শিক্ষার্থী',
        category: catId,
        dailyGoalHours: Number(profile.dailyGoalHours),
        notes: profile.notes,
        updatedAt: new Date().toISOString()
      }, { merge: true });
      toast.success('আপনার পাঠচর্চা প্রোফাইল সফলভাবে সংরক্ষিত হয়েছে!');
    } catch (err) {
      console.error('Error saving study profile:', err);
      toast.error('প্রোফাইল সংরক্ষণ করতে সমস্যা হয়েছে।');
    } finally {
      setSavingProfile(false);
    }
  };

  const fetchCategoryResources = async (catId: string) => {
    setLoading(true);
    try {
      let snap;
      if (catId === 'class-6-8') {
        const q = query(
          collection(db, 'study_practice_contents'),
          where('targetCategory', 'in', ['class-6-8', 'class-6', 'class-7', 'class-8'])
        );
        snap = await getDocs(q);
      } else {
        const q = query(
          collection(db, 'study_practice_contents'),
          where('targetCategory', '==', catId)
        );
        snap = await getDocs(q);
      }
      const data = snap.docs.map(d => ({ id: d.id, ...d.data() } as StudyContent));
      const filteredData = data.filter(item => item.type === 'quiz' || item.type === 'question_bank');

      filteredData.sort((a, b) => {
        const aTime = a.createdAt?.toMillis ? a.createdAt.toMillis() : (a.createdAt || 0);
        const bTime = b.createdAt?.toMillis ? b.createdAt.toMillis() : (b.createdAt || 0);
        return bTime - aTime;
      });
      setContents(filteredData);
    } catch (err) {
      console.error('Error loading study contents:', err);
      toast.error('রিসোর্স লোড করতে সমস্যা হয়েছে।');
    } finally {
      setLoading(false);
    }
  };

  const fetchLibraryBooksAndPrebookings = async () => {
    if (!user) return;
    setFetchingLibrary(true);
    try {
      const [booksSnap, preSnap] = await Promise.all([
        getDocs(collection(db, "books")),
        getDocs(query(collection(db, "pre-bookings"), where("userId", "==", user.id)))
      ]);
      setBooks(booksSnap.docs.map(doc => ({ id: doc.id, ...doc.data() })));
      setPreBookings(preSnap.docs.map(doc => ({ id: doc.id, ...doc.data() })));
    } catch (err) {
      console.error('Error fetching library information:', err);
    } finally {
      setFetchingLibrary(false);
    }
  };

  const fetchAttempts = async () => {
    if (!user) return;
    setFetchingHistory(true);
    try {
      const q = query(collection(db, 'quiz-attempts'), where('userId', '==', user.id));
      const snap = await getDocs(q);
      const data = snap.docs.map(doc => ({ id: doc.id, ...doc.data() } as QuizAttempt));
      data.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
      setAttempts(data);
    } catch (err) {
      console.error('Error fetching scoring history:', err);
    } finally {
      setFetchingHistory(false);
    }
  };

  const handleBookPreBooking = async (bookId: string) => {
    if (!user) {
      toast.error('বই বুকিং করতে দয়া করে লগইন করুন।');
      return;
    }
    
    if (user.status !== 'active') {
      toast.error('আপনার অ্যাকাউন্টটি এখনও সক্রিয় নয়। অনুগ্রহ করে এডমিনের অনুমোদনের অপেক্ষা করুন।');
      return;
    }

    setBookingInProgress(bookId);
    try {
      await addDoc(collection(db, 'pre-bookings'), {
        bookId,
        userId: user.id,
        userName: user.name,
        date: new Date().toISOString(),
        createdAt: serverTimestamp(),
        status: 'Pending'
      });
      
      setPreBookings(prev => [...prev, { bookId, userId: user.id, status: 'Pending' }]);
      toast.success('বই বুকিংয়ের জন্য আবেদন সফলভাবে সম্পন্ন হয়েছে!');
    } catch (err: any) {
      console.error('Error booking book:', err);
      toast.error('অনুরোধ পাঠাতে ত্রুটি হয়েছে। অনুগ্রহ করে আবার চেষ্টা করুন।');
    } finally {
      setBookingInProgress(null);
    }
  };

  const getFilteredBooks = () => {
    const cat = selectedCategory || 'class-6-8';
    return books.filter(b => {
      const isAcademic = String(b.category).toLowerCase().includes('একাডেমিক') || 
                         String(b.category).includes('Academic') ||
                         String(b.category) === 'একাডেমিক';
                          
      if (!isAcademic) return false;

      const titleLower = (b.title || '').toLowerCase();
      const descLower = (b.description || '').toLowerCase();
      let matchesClass = false;

      if (cat === 'class-6-8') {
        matchesClass = (
          titleLower.includes('৬') || titleLower.includes('৭') || titleLower.includes('৮') ||
          titleLower.includes('6') || titleLower.includes('7') || titleLower.includes('8') ||
          titleLower.includes('ষষ্ঠ') || titleLower.includes('সপ্তম') || titleLower.includes('অষ্টম') ||
          descLower.includes('৬') || descLower.includes('৭') || descLower.includes('৮') ||
          descLower.includes('ষষ্ঠ') || descLower.includes('সপ্তম') || descLower.includes('অষ্টম')
        );
      } else if (cat === 'ssc-dakhil') {
        matchesClass = (
          titleLower.includes('৯') || titleLower.includes('১০') ||
          titleLower.includes('9') || titleLower.includes('10') ||
          titleLower.includes('এসএসসি') || titleLower.includes('ssc') ||
          titleLower.includes('দাখিল') || titleLower.includes('dakhil') ||
          titleLower.includes('নবম') || titleLower.includes('দশম') ||
          descLower.includes('এসএসসি') || descLower.includes('দাখিল')
        );
      } else if (cat === 'hsc-alim-admission') {
        matchesClass = (
          titleLower.includes('১১') || titleLower.includes('১২') ||
          titleLower.includes('11') || titleLower.includes('12') ||
          titleLower.includes('এইচএসসি') || titleLower.includes('hsc') ||
          titleLower.includes('আলিম') || titleLower.includes('alim') ||
          titleLower.includes('admission') || titleLower.includes('ভর্তি') || titleLower.includes('এডমিশন') ||
          titleLower.includes('একাদশ') || titleLower.includes('দ্বাদশ') ||
          descLower.includes('এইচএসসি') || descLower.includes('আলিম')
        );
      } else if (cat === 'bcs-jobs') {
        matchesClass = (
          titleLower.includes('bcs') || titleLower.includes('বিসিএস') ||
          titleLower.includes('চাকরি') || titleLower.includes('জবস') ||
          titleLower.includes('চাকরী') || titleLower.includes('প্রিলি') ||
          titleLower.includes('প্রস্তুতি') || titleLower.includes('job') ||
          descLower.includes('বিসিএস') || descLower.includes('চাকরি')
        );
      }

      const queryTerm = bookSearch.trim().toLowerCase();
      const matchesSearch = !queryTerm || 
        titleLower.includes(queryTerm) || 
        (b.author || '').toLowerCase().includes(queryTerm) ||
        (b.bookCode || '').toLowerCase().includes(queryTerm);

      return matchesClass && matchesSearch;
    });
  };

  const getCategoryName = (id: string | null) => {
    if (!id) return 'সাধারণ প্রস্তুতি';
    if (id === 'class-6-8' && selectedSubClass) {
      if (selectedSubClass === 'class-6') return 'ক্লাস ৬ (ষষ্ঠ শ্রেণি)';
      if (selectedSubClass === 'class-7') return 'ক্লাস ৭ (সপ্তম শ্রেণি)';
      if (selectedSubClass === 'class-8') return 'ক্লাস ৮ (অষ্টম শ্রেণি)';
    }
    return categories.find(c => c.id === id)?.name || id;
  };

  const getStudentLevelBadge = () => {
    const attemptsCount = attempts.length;
    if (attemptsCount === 0) {
      return { title: 'নবিশ পাঠক (Novice)', color: 'bg-slate-500/10 text-slate-300 border-slate-700' };
    }
    if (attemptsCount <= 2) {
      return { title: 'অনুসন্ধিৎসু শিক্ষার্থী (Explorer)', color: 'bg-blue-500/15 text-blue-300 border-blue-800' };
    }
    return { title: 'মেধাবী গবেষক (Scholar)', color: 'bg-emerald-500/15 text-emerald-300 border-emerald-800' };
  };

  const handleUpdateProfile = (updates: Partial<{ dailyGoalHours: number; notes: string }>) => {
    setProfile(prev => ({ ...prev, ...updates }));
  };

  const getBookStatusBadge = (b: any) => {
    const isBooked = preBookings.some(pb => pb.bookId === b.id && pb.status === 'Pending');
    if (isBooked) {
      return (
        <span className="text-[10px] sm:text-xs font-bold px-2 py-1 bg-amber-100 text-amber-700 dark:bg-amber-950/40 dark:text-amber-400 border border-amber-200/50 rounded-lg flex items-center gap-1">
          বুকিং করা হয়েছে
        </span>
      );
    }
    
    if (String(b.status).toLowerCase() === 'issued') {
      return (
        <span className="text-[10px] sm:text-xs font-bold px-2 py-1 bg-indigo-50 text-indigo-700 dark:bg-indigo-950/40 dark:text-indigo-400 border border-indigo-100 rounded-lg">
          অন্যের কাছে আছে (প্রি-বুক)
        </span>
      );
    }

    return (
      <span className="text-[10px] sm:text-xs font-bold px-2 py-1 bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-400 border border-emerald-100 rounded-lg">
        সহজলভ্য (Available)
      </span>
    );
  };

  const filteredContents = contents.filter(item => {
    if (selectedCategory === 'class-6-8' && selectedSubClass) {
      if (item.targetCategory === selectedSubClass) return true;
      
      if (item.targetCategory === 'class-6-8') {
        const text = `${item.title} ${item.description || ''}`.toLowerCase();
        
        const isClass6 = text.includes('৬ষ্ঠ') || text.includes('৬') || text.includes('6') || text.includes('ষষ্ঠ') || text.includes('class 6') || text.includes('class-6');
        const isClass7 = text.includes('৭ম') || text.includes('৭') || text.includes('7') || text.includes('সপ্তম') || text.includes('class 7') || text.includes('class-7');
        const isClass8 = text.includes('৮ম') || text.includes('৮') || text.includes('8') || text.includes('অষ্টম') || text.includes('class 8') || text.includes('class-8');
        
        if (selectedSubClass === 'class-6') {
          if (isClass6) return true;
          if ((isClass7 || isClass8) && !isClass6) return false;
          return true;
        }
        if (selectedSubClass === 'class-7') {
          if (isClass7) return true;
          if ((isClass6 || isClass8) && !isClass7) return false;
          return true;
        }
        if (selectedSubClass === 'class-8') {
          if (isClass8) return true;
          if ((isClass6 || isClass7) && !isClass8) return false;
          return true;
        }
      }
    }
    return true;
  });

  const subjectsList = [
    { key: 'science', name: 'বিজ্ঞান', icon: '🔬', gradient: 'from-sky-400 to-sky-600 bg-sky-50 dark:bg-sky-950/40', textColor: 'text-sky-700 dark:text-sky-400', borderColor: 'border-sky-200 dark:border-sky-800/40 opacity-90' },
    { key: 'math', name: 'গণিত', icon: '📐', gradient: 'from-amber-400 to-amber-600 bg-amber-50 dark:bg-amber-950/40', textColor: 'text-amber-700 dark:text-amber-400', borderColor: 'border-amber-200 dark:border-amber-800/40 opacity-90' },
    { key: 'bangla', name: 'বাংলা', icon: '✍️', gradient: 'from-rose-400 to-rose-600 bg-rose-50 dark:bg-rose-950/40', textColor: 'text-rose-700 dark:text-rose-400', borderColor: 'border-rose-200 dark:border-rose-800/40 opacity-90' },
    { key: 'bgs', name: 'বাংলাদেশ ও বিশ্ব পরিচয়', icon: '🇧🇩', gradient: 'from-emerald-400 to-emerald-600 bg-emerald-50 dark:bg-emerald-950/40', textColor: 'text-emerald-700 dark:text-emerald-400', borderColor: 'border-emerald-200 dark:border-emerald-800/40 opacity-90' },
    { key: 'ict', name: 'আইসিটি', icon: '💻', gradient: 'from-indigo-400 to-indigo-600 bg-indigo-50 dark:bg-indigo-950/40', textColor: 'text-indigo-700 dark:text-indigo-400', borderColor: 'border-indigo-200 dark:border-indigo-800/40 opacity-90' },
    { key: 'islamic', name: 'ইসলাম ধর্ম', icon: '🕌', gradient: 'from-orange-400 to-orange-600 bg-orange-50 dark:bg-orange-950/40', textColor: 'text-orange-700 dark:text-orange-400', borderColor: 'border-orange-200 dark:border-orange-800/40 opacity-90' },
    { key: 'hindu', name: 'হিন্দু ধর্ম', icon: '🕉️', gradient: 'from-red-400 to-red-600 bg-red-50 dark:bg-red-950/40', textColor: 'text-red-700 dark:text-red-400', borderColor: 'border-red-200 dark:border-red-800/40 opacity-90' },
    { key: 'english', name: 'ইংরেজি', icon: '🔤', gradient: 'from-cyan-400 to-cyan-600 bg-cyan-50 dark:bg-cyan-950/40', textColor: 'text-cyan-700 dark:text-cyan-400', borderColor: 'border-cyan-200 dark:border-cyan-800/40 opacity-90' },
    { key: 'general_knowledge', name: 'অন্যান্য', icon: '📚', gradient: 'from-purple-400 to-purple-600 bg-purple-50 dark:bg-purple-950/40', textColor: 'text-purple-700 dark:text-purple-400', borderColor: 'border-purple-200 dark:border-purple-800/40 opacity-90' },
  ];

  const getSubjectKey = (title: string, desc: string): string => {
    const text = `${title} ${desc || ''}`.toLowerCase();
    if (text.includes('বিজ্ঞান') || text.includes('science')) return 'science';
    if (text.includes('গণিত') || text.includes('math')) return 'math';
    if (text.includes('বাংলা') || text.includes('bangla')) return 'bangla';
    if (text.includes('বিশ্ব') || text.includes('বাংলাদেশ') || text.includes('bgs')) return 'bgs';
    if (text.includes('আইসিটি') || text.includes('ict') || text.includes('তথ্য') || text.includes('যোগাযোগ')) return 'ict';
    if (text.includes('ইসলাম') || text.includes('islam')) return 'islamic';
    if (text.includes('হিন্দু') || text.includes('hindu')) return 'hindu';
    if (text.includes('ইংরেজি') || text.includes('english')) return 'english';
    return 'general_knowledge';
  };

  const countedSubjects = subjectsList.map(subj => {
    const matchingItems = filteredContents.filter(item => {
      return getSubjectKey(item.title, item.description) === subj.key;
    });
    return {
      ...subj,
      count: matchingItems.length
    };
  });

  const subjectFilteredContents = selectedSubject 
    ? filteredContents.filter(item => getSubjectKey(item.title, item.description) === selectedSubject)
    : filteredContents;

  return (
    <div className="min-h-screen bg-slate-50/50 dark:bg-slate-900/40 pb-20 font-bengali">
      {/* 1. Streak Widget Banner */}
      <div className="bg-amber-500/10 dark:bg-amber-500/5 border border-amber-500/20 max-w-5xl mx-auto mt-4 px-4 sm:px-6 py-3.5 rounded-3xl flex flex-col sm:flex-row gap-3 items-center justify-between shadow-sm relative overflow-hidden">
        <div className="absolute top-0 right-0 w-24 h-24 bg-amber-500/5 rounded-bl-full pointer-events-none" />
        <div className="flex items-center gap-2.5 text-center sm:text-left">
          <span className="text-xl">🔥</span>
          <p className="text-[12px] sm:text-[13px] font-extrabold text-amber-800 dark:text-amber-400">
            কখনোই আর স্ট্রিক মিস করতে না চাইলে পড়ার দিনলিপি এবং দৈনিক লক্ষ্য নিয়মিত আপডেট করো!
          </p>
        </div>
        <button 
          onClick={() => {
            const el = document.getElementById('academic-goals-input');
            el?.scrollIntoView({ behavior: 'smooth' });
            el?.focus();
          }}
          className="shrink-0 text-[11px] sm:text-xs font-black bg-amber-600 hover:bg-amber-500 text-white rounded-xl px-4 py-2 shadow-sm transition active:scale-95 cursor-pointer"
        >
          দিনের লক্ষ্য নির্ধারণ →
        </button>
      </div>


      {/* 3. Four Side-by-Side (Pasha Pashi) Colorful Menu Buttons */}
      <div className="max-w-5xl mx-auto px-4 mt-6">
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          {/* Btn 1: Question Bank */}
          <button
            onClick={() => {
              setActiveMenuTab('question_bank');
              setSelectedSubject(null);
            }}
            className={`cursor-pointer rounded-[22px] border p-4 transition-all duration-200 flex flex-col items-center justify-center text-center gap-2 relative overflow-hidden ${
              activeMenuTab === 'question_bank'
                ? 'bg-amber-500 text-white border-amber-400 shadow-lg shadow-amber-500/20 scale-102 font-black'
                : 'bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700/80 hover:border-amber-300 dark:hover:border-amber-900/50 text-slate-700 dark:text-slate-200 hover:shadow-sm'
            }`}
          >
            <div className={`w-10 h-10 rounded-xl flex items-center justify-center shadow-inner ${activeMenuTab === 'question_bank' ? 'bg-white/20' : 'bg-amber-50 dark:bg-amber-950/30'}`}>
              <BookMarked className={`w-5 h-5 ${activeMenuTab === 'question_bank' ? 'text-white' : 'text-amber-500'}`} />
            </div>
            <span className="text-[13px] font-black tracking-wide font-bengali">প্রশ্নব্যাংক</span>
          </button>

          {/* Btn 2: Mock Exam */}
          <button
            onClick={() => {
              setActiveMenuTab('mock_exam');
              setSelectedSubject(null);
            }}
            className={`cursor-pointer rounded-[22px] border p-4 transition-all duration-200 flex flex-col items-center justify-center text-center gap-2 relative overflow-hidden ${
              activeMenuTab === 'mock_exam'
                ? 'bg-rose-500 text-white border-rose-400 shadow-lg shadow-rose-500/20 scale-102 font-black'
                : 'bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700/80 hover:border-rose-300 dark:hover:border-rose-900/50 text-slate-700 dark:text-slate-200 hover:shadow-sm'
            }`}
          >
            <div className={`w-10 h-10 rounded-xl flex items-center justify-center shadow-inner ${activeMenuTab === 'mock_exam' ? 'bg-white/20' : 'bg-rose-50 dark:bg-rose-950/30'}`}>
              <Layers className={`w-5 h-5 ${activeMenuTab === 'mock_exam' ? 'text-white' : 'text-rose-500'}`} />
            </div>
            <span className="text-[13px] font-black tracking-wide font-bengali">মক পরীক্ষা</span>
          </button>

          {/* Btn 3: Model Test */}
          <button
            onClick={() => {
              setActiveMenuTab('model_test');
              setSelectedSubject(null);
            }}
            className={`cursor-pointer rounded-[22px] border p-4 transition-all duration-200 flex flex-col items-center justify-center text-center gap-2 relative overflow-hidden ${
              activeMenuTab === 'model_test'
                ? 'bg-violet-600 text-white border-violet-500 shadow-lg shadow-violet-500/20 scale-102 font-black'
                : 'bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700/80 hover:border-violet-300 dark:hover:border-violet-900/50 text-slate-700 dark:text-slate-200 hover:shadow-sm'
            }`}
          >
            <div className={`w-10 h-10 rounded-xl flex items-center justify-center shadow-inner ${activeMenuTab === 'model_test' ? 'bg-white/20' : 'bg-violet-50 dark:bg-violet-950/30'}`}>
              <Target className={`w-5 h-5 ${activeMenuTab === 'model_test' ? 'text-white' : 'text-violet-500'}`} />
            </div>
            <span className="text-[13px] font-black tracking-wide font-bengali">মডেল টেস্ট</span>
          </button>

          {/* Btn 4: My Profile */}
          <button
            onClick={() => {
              setActiveMenuTab('my_profile');
              setSelectedSubject(null);
            }}
            className={`cursor-pointer rounded-[22px] border p-4 transition-all duration-200 flex flex-col items-center justify-center text-center gap-2 relative overflow-hidden ${
              activeMenuTab === 'my_profile'
                ? 'bg-sky-500 text-white border-sky-400 shadow-lg shadow-sky-500/20 scale-102 font-black'
                : 'bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700/80 hover:border-sky-305 dark:hover:border-sky-900/50 text-slate-700 dark:text-slate-200 hover:shadow-sm'
            }`}
          >
            <div className={`w-10 h-10 rounded-xl flex items-center justify-center shadow-inner ${activeMenuTab === 'my_profile' ? 'bg-white/20' : 'bg-sky-50 dark:bg-sky-950/30'}`}>
              <User className={`w-5 h-5 ${activeMenuTab === 'my_profile' ? 'text-white' : 'text-sky-500'}`} />
            </div>
            <span className="text-[13px] font-black tracking-wide font-bengali">আমার পাঠচর্চা প্রোফাইল</span>
          </button>
        </div>
      </div>

      {/* 4. Leaderboard Unlock Banner */}
      <div className="max-w-5xl mx-auto px-4 mt-6">
        <div className="bg-slate-100/85 dark:bg-slate-800 border border-slate-200/50 dark:border-slate-700 p-4 rounded-[1.5rem] flex items-center justify-between text-slate-700 dark:text-slate-300 text-xs sm:text-sm shadow-inner">
          <div className="flex items-center gap-2 font-extrabold max-w-md">
            <span>{attempts.length > 0 ? '🔓' : '🔒'}</span>
            <span>
              {attempts.length > 0 
                ? 'অভিনন্দন! তুমি কুইজ পরীক্ষায় অংশ নিয়ে লিডারবোর্ড আনলক করেছ।' 
                : 'লিডারবোর্ড আনলক করতে নিচের যেকোনো একটি কুইজ পরীক্ষায় অংশ নাও!'}
            </span>
          </div>
          <div className="flex items-center gap-1.5 font-bold text-slate-500">
            <TrendingUp className="w-4 h-4 text-slate-400" />
            <span>অগ্রগতি</span>
          </div>
        </div>
      </div>

      {/* 5. Central Dynamic Dashboard Area */}
      <div className="max-w-5xl mx-auto px-4 mt-8 pb-12">
        <AnimatePresence mode="wait">
          {/* TAB A: QUESTION BANK FLOATING */}
          {activeMenuTab === 'question_bank' && (
            <motion.div
              key="qb-menu-container"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              className="space-y-6"
            >
              {/* If no core category selected: Choose Category */}
              {!selectedCategory ? (
                <div className="text-center space-y-6">
                  <div className="bg-white/60 dark:bg-slate-800 border border-slate-100 dark:border-slate-700 rounded-3xl p-6 shadow-sm max-w-sm sm:max-w-md mx-auto">
                    <span className="text-xl">🎓</span>
                    <h3 className="font-extrabold text-slate-800 dark:text-slate-200 mt-2 text-base font-bengali">তোমার একাডেমিক স্তর চুজ করো</h3>
                    <p className="text-xs text-slate-400 mt-1">স্তরের কন্টেন্ট এবং প্রশ্ন ব্যাংক দেখতে ক্লাস সিলেক্ট করো!</p>
                  </div>
                  <div className="space-y-4 max-w-sm sm:max-w-md mx-auto">
                    {categories.map((cat, idx) => {
                      const Icon = cat.icon;
                      return (
                        <motion.button
                          key={cat.id}
                          onClick={() => {
                            setSelectedCategory(cat.id);
                            setSelectedSubject(null);
                          }}
                          whileHover={{ scale: 1.02, x: 4 }}
                          whileTap={{ scale: 0.98 }}
                          className={`w-full overflow-hidden bg-gradient-to-r ${cat.color} bg-white dark:bg-slate-800 border-2 ${cat.borderColor} p-4 rounded-2xl md:rounded-3xl shadow-sm hover:shadow-md transition-all flex items-center justify-between group text-left cursor-pointer`}
                        >
                          <div className="flex items-center gap-4 flex-1 min-w-0">
                            <div className={`w-12 h-12 rounded-xl flex items-center justify-center ${cat.iconBg} ${cat.textColor} group-hover:scale-110 transition-transform shadow-sm shrink-0`}>
                              <Icon className="w-6 h-6" />
                            </div>
                            <div className="flex-1 min-w-0 pr-2">
                              <h3 className="font-extrabold text-slate-800 dark:text-slate-100 text-[15px] sm:text-base tracking-wide font-bengali leading-snug">
                                {cat.name}
                              </h3>
                              <p className="text-xs text-slate-500 dark:text-slate-400 font-medium font-bengali mt-0.5 leading-relaxed">
                                {cat.description}
                              </p>
                            </div>
                          </div>
                          <div className="bg-white/95 dark:bg-slate-700/60 p-1.5 rounded-full border border-slate-100 dark:border-slate-700 shadow-sm opacity-60 group-hover:opacity-100 transition-all ml-2 shrink-0">
                            <ArrowLeft className="w-4 h-4 rotate-180" />
                          </div>
                        </motion.button>
                      );
                    })}
                  </div>
                </div>
              ) : (selectedCategory === 'class-6-8' && !selectedSubClass) ? (
                /* Subclass selecting for class 6-8 */
                <div className="text-center space-y-6">
                  <div className="flex items-center mb-4">
                    <button
                      onClick={() => setSelectedCategory(null)}
                      className="p-2.5 bg-white dark:bg-slate-800 hover:bg-slate-100 dark:hover:bg-slate-700 text-slate-600 dark:text-slate-300 font-bold rounded-xl border border-slate-100 dark:border-slate-700 shadow-sm transition active:scale-95 cursor-pointer flex items-center justify-center shrink-0"
                    >
                      <ArrowLeft className="w-4 h-4" /> পিছে যান
                    </button>
                  </div>
                  <div className="bg-white/60 dark:bg-slate-800 border border-slate-100 dark:border-slate-700 rounded-3xl p-6 shadow-sm max-w-sm mx-auto">
                    <span className="text-xl">📈</span>
                    <h3 className="font-extrabold text-slate-800 dark:text-slate-200 mt-2 text-base font-bengali">পছন্দের শ্রেণী নির্ধারণ করো</h3>
                    <p className="text-xs text-slate-400 mt-1">শ্রেণী সিলেক্ট করলে বিষয়ভিত্তিক সুন্দর গ্রিড দেখতে পারবে!</p>
                  </div>
                  <div className="space-y-4 max-w-sm mx-auto">
                    {['class-6', 'class-7', 'class-8'].map((clsKey, cIdx) => (
                      <motion.button
                        key={clsKey}
                        onClick={() => {
                          setSelectedSubClass(clsKey);
                          setSelectedSubject(null);
                        }}
                        whileHover={{ scale: 1.02, y: -2 }}
                        whileTap={{ scale: 0.98 }}
                        className="w-full relative h-[5.5rem] overflow-hidden bg-white dark:bg-slate-800 rounded-3xl border border-slate-200 dark:border-slate-700 shadow-sm flex items-center justify-between text-left cursor-pointer group"
                      >
                        <div className="absolute -left-1 -bottom-4 select-none font-sans font-black text-[8.5rem] leading-none text-transparent bg-clip-text bg-gradient-to-tr from-indigo-500 to-emerald-400 opacity-90 group-hover:scale-105 transition-transform origin-bottom-left">
                          {clsKey === 'class-6' ? '6' : clsKey === 'class-7' ? '7' : '8'}
                        </div>
                        <div className="flex-1" />
                        <div className="pr-8 pl-4 py-4 text-right z-10 font-bengali">
                          <span className="font-extrabold text-slate-800 dark:text-slate-100 text-lg sm:text-xl">
                            {clsKey === 'class-6' ? 'ক্লাস ৬ (ষষ্ঠ)' : clsKey === 'class-7' ? 'ক্লাস ৭ (সপ্তম)' : 'ক্লাস ৮ (অষ্টম)'}
                          </span>
                        </div>
                      </motion.button>
                    ))}
                  </div>
                </div>
              ) : (
                /* CLASS DETAILS AND SUBJECTS GRID */
                <div>
                  {selectedSubject === null ? (
                    /* The subjects grid matching image_2 visually! */
                    <StudySubjectsGrid
                      countedSubjects={countedSubjects}
                      onSelectSubject={(subjKey) => setSelectedSubject(subjKey)}
                      subjectSearch={subjectSearchQuery}
                      setSubjectSearch={(val) => setSubjectSearchQuery(val)}
                      getCategoryName={getCategoryName(selectedCategory)}
                      onChangeClass={() => {
                        if (selectedCategory === 'class-6-8') {
                          setSelectedSubClass(null);
                        } else {
                          setSelectedCategory(null);
                        }
                        setSelectedSubject(null);
                      }}
                    />
                  ) : (
                    /* SUBJECT INDIVIDUAL MATERIAL/BOOKING AREA */
                    <div className="space-y-6">
                      {/* Back button */}
                      <div className="flex items-center justify-between pb-4 border-b border-slate-100 dark:border-slate-800">
                        <button
                          onClick={() => setSelectedSubject(null)}
                          className="flex items-center gap-1.5 px-4 py-2 bg-white dark:bg-slate-800 hover:bg-slate-100 dark:hover:bg-slate-700 text-slate-600 dark:text-slate-300 font-bold rounded-xl border border-slate-200 dark:border-slate-700 shadow-sm text-xs transition cursor-pointer"
                        >
                          <ArrowLeft className="w-4 h-4" /> বিষয় পরিবর্তন করুন
                        </button>
                        <div className="text-right">
                          <span className="text-[10px] font-bold text-indigo-500 uppercase font-sans">নির্দিষ্ট উপকরণের পরিধি</span>
                          <h3 className="font-extrabold text-base sm:text-lg text-slate-800 dark:text-slate-100">
                            {subjectsList.find(s => s.key === selectedSubject)?.name || 'অন্যান্য'} ({getCategoryName(selectedCategory)})
                          </h3>
                        </div>
                      </div>

                      {/* Tab Swappers */}
                      <div className="flex bg-slate-200/60 dark:bg-slate-800 p-1 rounded-2xl max-w-sm mx-auto mb-6 border border-slate-200/50 dark:border-slate-700 shadow-sm relative">
                        <button 
                          onClick={() => setActiveTab('exams')}
                          className={`flex-1 py-3 text-xs font-black font-bengali rounded-[12px] transition-all relative z-10 ${activeTab === 'exams' ? 'text-white' : 'text-slate-600 dark:text-slate-400'}`}
                        >
                          প্রশ্ন ব্যাংক পরীক্ষা
                        </button>
                        <button 
                          onClick={() => setActiveTab('library')}
                          className={`flex-1 py-3 text-xs font-black font-bengali rounded-[12px] transition-all relative z-10 ${activeTab === 'library' ? 'text-white' : 'text-slate-600 dark:text-slate-400'}`}
                        >
                          প্রয়োজনীয় একাডেমিক বই
                        </button>
                        <div 
                          className={`absolute top-1 bottom-1 w-[calc(50%-4px)] bg-indigo-600 rounded-[10px] shadow-sm transition-transform duration-300 ease-out ${activeTab === 'exams' ? 'translate-x-[2px]' : 'translate-x-[100%]'}`}
                        />
                      </div>

                      {/* Tab rendering */}
                      {activeTab === 'exams' ? (
                        <div className="space-y-6">
                          {loading ? (
                            <div className="py-12 text-center">
                              <div className="w-10 h-10 border-4 border-indigo-100 border-t-indigo-600 rounded-full animate-spin mx-auto mb-4" />
                              <p className="text-slate-500 dark:text-slate-400 font-bold">লোড হচ্ছে...</p>
                            </div>
                          ) : subjectFilteredContents.length === 0 ? (
                            <div className="py-12 text-center bg-white dark:bg-slate-800 border-2 border-dashed border-slate-200 dark:border-slate-700 rounded-3xl p-8">
                              <div className="w-12 h-12 bg-slate-100 dark:bg-slate-700 text-slate-400 rounded-2xl flex items-center justify-center mx-auto mb-4">
                                <FileText className="w-6 h-6" />
                              </div>
                              <h3 className="text-base font-black text-slate-800 dark:text-white mb-1">কোনো ম্যাচিং কন্টেন্ট যোগ করা হয়নি</h3>
                              <p className="text-xs text-slate-400 font-medium max-w-xs mx-auto leading-relaxed">
                                এই বিষয়ের জন্য আপাতত কোনো কুইজ বা প্রশ্ন ব্যাংকের উপকরণ আমাদের সংগ্রহস্থলে খুঁজে পাওয়া যায়নি।
                              </p>
                            </div>
                          ) : (
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                              {subjectFilteredContents.map(item => (
                                <motion.div
                                  initial={{ opacity: 0, scale: 0.98 }}
                                  animate={{ opacity: 1, scale: 1 }}
                                  key={item.id}
                                  className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-3xl p-6 shadow-sm hover:shadow-md transition-all flex flex-col justify-between"
                                >
                                  <div>
                                    <div className="flex justify-between items-start mb-4">
                                      <span className={`text-[10px] font-black tracking-wide px-3 py-1 rounded-lg ${
                                        item.type === 'quiz' ? 'bg-fuchsia-100 hover:bg-fuchsia-200 text-fuchsia-700 dark:bg-fuchsia-950/40 dark:text-fuchsia-400' : 'bg-amber-100 hover:bg-amber-200 text-amber-700 dark:bg-amber-950/40 dark:text-amber-400'
                                      }`}>
                                        {item.type === 'quiz' ? 'কুইজ / পরীক্ষা পরীক্ষা' : 'প্রশ্ন ব্যাংক / সাজেশন'}
                                      </span>
                                    </div>
                                    <h3 className="font-extrabold text-slate-800 dark:text-white text-base leading-snug tracking-normal mb-2">
                                      {item.title}
                                    </h3>
                                    {item.description && (
                                      <p className="text-xs text-slate-500 dark:text-slate-400 font-semibold mb-6">
                                        {item.description}
                                      </p>
                                    )}
                                  </div>

                                  <div className="flex flex-col sm:flex-row gap-2 mt-auto">
                                    <a
                                      href={item.type === 'quiz' ? `/dashboard/exam?setId=${item.id}` : item.link}
                                      onClick={(e) => {
                                        if (item.type === 'quiz') {
                                          e.preventDefault();
                                          navigate(`/dashboard/exam?setId=${item.id}`);
                                        }
                                      }}
                                      className="flex-1 inline-flex items-center justify-center gap-1.5 bg-indigo-50 hover:bg-indigo-600 dark:bg-[#1a1c24] dark:hover:bg-indigo-600 text-indigo-700 hover:text-white dark:text-indigo-300 px-3 py-2.5 rounded-xl text-xs font-black transition-all text-center cursor-pointer border border-indigo-100"
                                    >
                                      {item.type === 'quiz' ? 'পরীক্ষায় অংশ নিন' : 'সরাসরি ডকুমেন্ট ওপেন'}
                                      <ExternalLink className="w-3.5 h-3.5" />
                                    </a>
                                    
                                    {(item.type === 'quiz' || item.type === 'question_bank') && (
                                      <button
                                        onClick={() => {
                                          const examUrl = `${window.location.origin}/public-exam?setId=${item.id}`;
                                          navigator.clipboard.writeText(examUrl);
                                          toast.success('কুইজ সেটের পাবলিক লিংক কপি করা হয়েছে!');
                                        }}
                                        className="px-3 py-2 bg-emerald-50 hover:bg-emerald-100 text-emerald-700 dark:bg-emerald-950/20 rounded-xl text-xs font-black transition active:scale-95 flex items-center justify-center gap-1 cursor-pointer"
                                      >
                                        <Share2 className="w-3.5 h-3.5" /> কপি লিংক
                                      </button>
                                    )}
                                  </div>
                                </motion.div>
                              ))}
                            </div>
                          )}
                        </div>
                      ) : (
                        /* LIBRARY BOOKS FOR SELECTED SUBJECT */
                        <div className="space-y-6">
                          {fetchingLibrary ? (
                            <div className="py-12 text-center">
                              <div className="w-10 h-10 border-4 border-emerald-100 border-t-emerald-600 rounded-full animate-spin mx-auto pb-4" />
                              <p className="text-slate-500 dark:text-slate-400 font-bold">বই লোড হচ্ছে...</p>
                            </div>
                          ) : getFilteredBooks().length === 0 ? (
                            <div className="py-12 text-center bg-white dark:bg-slate-800 border-2 border-dashed border-slate-200 dark:border-slate-700 rounded-[2rem] p-8">
                              <div className="w-12 h-12 bg-slate-100 dark:bg-slate-700 text-slate-400 rounded-full flex items-center justify-center mx-auto mb-4">
                                <BookOpen className="w-6 h-6 pointer-events-none" />
                              </div>
                              <h3 className="text-base font-black text-slate-800 dark:text-white mb-2">কোনো ম্যাচিং একাডেমিক বই পাওয়া যায়নি</h3>
                              <p className="text-xs text-slate-400">
                                দুঃখিত! এই বিষয়ের জন্য একাডেমিক কোনো লাইব্রেরি বই খুজে পাওয়া যায়নি।
                              </p>
                            </div>
                          ) : (
                            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
                              {getFilteredBooks().map(book => {
                                const isPending = preBookings.some(pb => pb.bookId === book.id && pb.status === 'Pending');
                                return (
                                  <motion.div
                                    key={book.id}
                                    initial={{ opacity: 0, scale: 0.98 }}
                                    animate={{ opacity: 1, scale: 1 }}
                                    className="bg-white dark:bg-slate-800 rounded-3xl border border-slate-200 dark:border-slate-700 shadow-sm overflow-hidden flex flex-col justify-between hover:border-emerald-250 dark:hover:border-emerald-900 transition-all p-5"
                                  >
                                    <div>
                                      <div className="flex gap-4 items-start mb-4">
                                        <div className="w-16 aspect-[3/4] bg-slate-100 dark:bg-slate-700 rounded-xl overflow-hidden border border-slate-100 dark:border-slate-600 shrink-0 p-1 flex items-center justify-center">
                                          {book.cover ? (
                                            <img src={book.cover} referrerPolicy="no-referrer" alt={book.title} className="w-full h-full object-contain rounded-lg" />
                                          ) : (
                                            <BookOpen className="w-6 h-6 text-slate-400" />
                                          )}
                                        </div>
                                        <div className="flex-1 min-w-0 pr-1">
                                          {getBookStatusBadge(book)}
                                          <h3 className="font-extrabold text-slate-800 dark:text-white text-sm leading-tight mt-2 text-ellipsis overflow-hidden line-clamp-2">
                                            {book.title}
                                          </h3>
                                          <p className="text-xs text-slate-400 font-medium mt-1 truncate">
                                            লেখক: {book.author || 'অজানা'}
                                          </p>
                                        </div>
                                      </div>

                                      <div className="bg-slate-50 dark:bg-slate-900/50 p-3 rounded-xl text-xs text-slate-500 space-y-1 mb-4 font-semibold">
                                        <div className="flex justify-between">
                                          <span>বই কোড:</span>
                                          <span className="font-mono text-slate-800 dark:text-white font-bold">{book.bookCode || 'N/A'}</span>
                                        </div>
                                        <div className="flex justify-between">
                                          <span>আলমারি / তাক:</span>
                                          <span className="font-mono text-slate-800 dark:text-white font-bold">{book.shelfNo || 'N/A'}</span>
                                        </div>
                                      </div>
                                    </div>

                                    <button
                                      onClick={() => !isPending && handleBookPreBooking(book.id)}
                                      disabled={isPending || bookingInProgress === book.id}
                                      className={`w-full py-2.5 px-3 rounded-xl text-xs font-black transition-all flex items-center justify-center gap-1.5 ${
                                        isPending 
                                          ? 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40' 
                                          : 'bg-indigo-600 hover:bg-indigo-700 text-white shadow-sm active:scale-95 cursor-pointer'
                                      }`}
                                    >
                                      {bookingInProgress === book.id ? (
                                        <>বুকিং হচ্ছে...</>
                                      ) : isPending ? (
                                        <>
                                          <CheckCircle2 className="w-4 h-4 text-emerald-600" /> অনুরোধ আবেদন সফল
                                        </>
                                      ) : (
                                        <>লাইব্রেরি থেকে বই বুকিং দিন</>
                                      )}
                                    </button>
                                  </motion.div>
                                );
                              })}
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              )}
            </motion.div>
          )}

          {/* TAB B: MOCK EXAMS (Combined Quiz Launcher and History) */}
          {activeMenuTab === 'mock_exam' && (
            <motion.div
              key="mock-exam-panel"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              className="space-y-8 max-w-4xl mx-auto"
            >
              {/* Part 1: Quiz/Exam Launcher */}
              <div className="bg-gradient-to-r from-rose-500/10 via-rose-600/5 to-transparent border border-rose-500/20 rounded-3xl p-6 flex items-center gap-4 relative overflow-hidden">
                <div className="w-12 h-12 bg-rose-500 text-white rounded-2xl flex items-center justify-center shrink-0 shadow-lg animate-bounce">
                  <Layers className="w-6 h-6 pointer-events-none" />
                </div>
                <div>
                  <h3 className="font-extrabold text-slate-800 dark:text-white text-base">মক পরীক্ষা লঞ্চার</h3>
                  <p className="text-xs text-slate-500 leading-relaxed mt-0.5">
                    প্রতি কুইজে অংশ নিয়ে নিজের প্রস্তুতি যাচাই করো! কুইজগুলোর প্রতিপ্রশ্নে নির্ধারিত সময় থাকবে এবং শেষে সলিউশন শিটে সঠিক ব্যাখ্যা পাবে।
                  </p>
                </div>
              </div>

              {contents.filter(c => c.type === 'quiz').length === 0 ? (
                <div className="py-12 text-center bg-white border border-dashed border-slate-200 dark:bg-slate-800 rounded-3xl mx-auto">
                  <p className="text-xs text-slate-400 font-extrabold">আপাতত এই স্তরের জন্য কুইজ সেট খালি রয়েছে। জেনারেট হচ্ছে!</p>
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  {contents.filter(c => c.type === 'quiz').map(item => (
                    <div 
                      key={item.id} 
                      className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700/80 hover:border-rose-300 dark:hover:border-rose-900 rounded-3xl p-5 shadow-sm transition flex flex-col justify-between"
                    >
                      <div>
                        <span className="text-[10px] px-2.5 py-1 rounded-lg bg-rose-50 dark:bg-rose-950 text-rose-700 font-extrabold flex items-center gap-1.5 w-fit">
                          <Layers className="w-3 h-3 text-rose-500" /> পরীক্ষা সিরিজ
                        </span>
                        <h4 className="font-extrabold text-slate-800 dark:text-slate-100 text-sm sm:text-base mt-2 leading-snug">
                          {item.title}
                        </h4>
                        <p className="text-[11px] text-slate-400 mt-1 font-extrabold leading-snug line-clamp-2">
                          {item.description || 'সম্পূর্ণ প্রশ্নের বিস্তারিত ব্যাখ্যা সহ কুইজ টেস্ট!'}
                        </p>
                      </div>
                      <button
                        onClick={() => navigate(`/dashboard/exam?setId=${item.id}`)}
                        className="w-full mt-4 py-2.5 bg-rose-500 hover:bg-rose-400 text-white rounded-xl text-xs font-black transition active:scale-95 shadow-sm cursor-pointer"
                      >
                        পরীক্ষায় অংশ নিন →
                      </button>
                    </div>
                  ))}
                </div>
              )}

              {/* Part 2: Score Logs and History */}
              <div className="bg-white dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 rounded-[2.5rem] p-6 sm:p-8 shadow-sm">
                <div className="flex items-center gap-3 border-b border-slate-100 dark:border-slate-700 pb-5 mb-6">
                  <div className="w-10 h-10 bg-indigo-50 dark:bg-indigo-950/40 rounded-xl flex items-center justify-center text-indigo-600">
                    <History className="w-5 h-5" />
                  </div>
                  <div>
                    <h3 className="font-black text-slate-800 dark:text-white text-lg">পরীক্ষার স্কোর এবং ইতিহাস</h3>
                    <p className="text-xs text-slate-400 font-bengali">আপনি যেসব অনলাইন পরীক্ষা দিয়েছেন সেগুলোর বিস্তারিত রেকর্ড ও শতাংশ (%) তালিকা।</p>
                  </div>
                </div>

                {fetchingHistory ? (
                  <div className="py-8 text-center">
                    <div className="w-8 h-8 border-4 border-slate-200 border-t-indigo-600 rounded-full animate-spin mx-auto" />
                  </div>
                ) : attempts.length === 0 ? (
                  <div className="py-8 text-center border-2 border-dashed border-slate-200 rounded-2xl text-slate-400">
                    <span className="text-xl">🏆</span>
                    <p className="font-bold text-xs mt-1">কোনো পরীক্ষার রেকর্ড পাওয়া যায়নি। কুইজে অংশ নিয়ে ফার্স্ট রেকর্ড সাবমিট করো!</p>
                  </div>
                ) : (
                  <div className="overflow-hidden rounded-2xl border border-slate-100 dark:border-slate-700">
                    <div className="overflow-x-auto">
                      <table className="w-full text-left border-collapse text-xs sm:text-sm">
                        <thead>
                          <tr className="bg-slate-50 dark:bg-slate-900 border-b border-slate-100 dark:border-slate-700 text-slate-500">
                            <th className="px-5 py-3 font-bold">তারিখ</th>
                            <th className="px-5 py-3 font-bold">প্রাপ্ত নম্বর</th>
                            <th className="px-5 py-3 font-bold uppercase tracking-wider">শতাংশ (%)</th>
                            <th className="px-5 py-3 font-bold text-right font-bengali">স্ট্যাটাস</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100 dark:divide-slate-700">
                          {attempts.map(att => {
                            const isExcel = att.percentage >= 80;
                            const isGood = att.percentage >= 50;
                            return (
                              <tr key={att.id} className="hover:bg-slate-50 hover:dark:bg-slate-900/20 transition-colors">
                                <td className="px-5 py-3.5 text-slate-500 font-mono">
                                  {att.date ? new Date(att.date).toLocaleDateString('bn-BD', { year: 'numeric', month: 'short', day: 'numeric' }) : 'N/A'}
                                </td>
                                <td className="px-5 py-3.5 font-mono text-slate-800 dark:text-white font-bold text-sm">
                                  {att.score} / {att.totalQuestions}
                                </td>
                                <td className="px-5 py-3.5">
                                  <div className="flex items-center gap-2">
                                    <div className="w-20 bg-slate-100 dark:bg-slate-700 h-1.5 rounded-full overflow-hidden shrink-0">
                                      <div 
                                        className={`h-full rounded-full ${isExcel ? 'bg-emerald-500' : isGood ? 'bg-amber-500' : 'bg-rose-500'}`} 
                                        style={{ width: `${att.percentage}%` }}
                                      />
                                    </div>
                                    <span className={`font-mono font-bold text-xs ${isExcel ? 'text-emerald-600' : isGood ? 'text-amber-600' : 'text-rose-500'}`}>
                                      {att.percentage}%
                                    </span>
                                  </div>
                                </td>
                                <td className="px-5 py-3.5 text-right font-bengali">
                                  <span className={`inline-block px-2.5 py-1 rounded-lg font-bold text-[10px] ${
                                    isExcel ? 'bg-emerald-55 text-emerald-700' : isGood ? 'bg-amber-55 text-amber-700' : 'bg-rose-55 text-rose-700'
                                  }`}>
                                    {isExcel ? 'চমৎকার' : isGood ? 'ভালো' : 'চর্চা প্রয়োজন'}
                                  </span>
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}
              </div>
            </motion.div>
          )}

          {/* TAB D: MODEL TEST */}
          {activeMenuTab === 'model_test' && (
            <motion.div
              key="model-test-panel"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              className="space-y-6 max-w-4xl mx-auto"
            >
              <div className="bg-white dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 rounded-[2.5rem] p-6 sm:p-8 shadow-sm flex flex-col items-center justify-center min-h-[300px] text-center">
                 <div className="w-16 h-16 bg-violet-100 dark:bg-violet-950/50 rounded-2xl flex items-center justify-center text-violet-600 mb-4 shadow-sm">
                   <Target className="w-8 h-8" />
                 </div>
                 <h3 className="font-black text-xl text-slate-800 dark:text-white font-bengali">মডেল টেস্ট</h3>
                 <p className="text-sm font-bold text-slate-500 mt-2 max-w-md mx-auto">
                   শীঘ্রই আসছে! এখানে পূর্ণাঙ্গ মডেল টেস্ট দেওয়া যাবে যেখানে টাইমার সহ মূল পরীক্ষার অভিজ্ঞতা পাওয়া যাবে।
                 </p>
              </div>
            </motion.div>
          )}

          {/* TAB E: MY PROFILE (Moved from the top) */}
          {activeMenuTab === 'my_profile' && (
            <motion.div
              key="my-profile-panel"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
            >
              <div className="bg-gradient-to-br from-indigo-950 via-slate-900 to-slate-950 text-white rounded-[2.5rem] p-6 sm:p-8 border border-indigo-500/15 shadow-xl relative overflow-hidden">
                <div className="absolute top-0 right-0 w-48 h-48 bg-gradient-to-br from-indigo-600/15 to-transparent rounded-full blur-2xl pointer-events-none" />
                <div className="absolute -bottom-8 -left-8 w-32 h-32 bg-violet-600/10 rounded-full blur-xl pointer-events-none" />
                
                <div className="relative z-10 grid grid-cols-1 md:grid-cols-12 gap-6 items-stretch">
                  {/* Left Col: Identity and Stats */}
                  <div className="md:col-span-5 flex flex-col sm:flex-row md:flex-col gap-4 items-center sm:items-start text-center sm:text-left md:text-left border-b md:border-b-0 md:border-r border-white/10 pb-6 md:pb-0 md:pr-6">
                    <div className="relative shrink-0">
                      <div className="w-16 h-16 sm:w-20 sm:h-20 bg-gradient-to-tr from-indigo-500 to-fuchsia-500 rounded-2xl p-0.5 shadow-lg flex items-center justify-center">
                        <div className="w-full h-full bg-slate-950 rounded-[14px] flex items-center justify-center">
                          <User className="w-8 h-8 text-indigo-300" />
                        </div>
                      </div>
                      <div className="absolute -bottom-1 -right-1 bg-emerald-500 p-1 rounded-full border-2 border-slate-950 animate-pulse">
                        <div className="w-2.5 h-2.5 rounded-full bg-emerald-400" />
                      </div>
                    </div>

                    <div className="space-y-2 flex-grow min-w-0 w-full">
                      <div>
                        <h3 className="font-extrabold text-lg sm:text-xl font-bengali tracking-wide leading-snug truncate">
                          {user?.name || 'শিক্ষার্থী'}
                        </h3>
                        <p className="text-[11px] font-bold text-indigo-400 font-sans tracking-wide mt-0.5">
                          {user?.email || 'অ্যাকাডেমিক প্রোফাইল'}
                        </p>
                      </div>
                      <div className="flex flex-wrap gap-2 items-center justify-center sm:justify-start">
                        <span className={`px-3 py-1 rounded-full text-xs font-black tracking-wide border font-bengali ${getStudentLevelBadge().color}`}>
                          🎖️ {getStudentLevelBadge().title}
                        </span>
                      </div>
                      <div className="grid grid-cols-2 gap-2 mt-4 pt-4 border-t border-white/5 text-left">
                        <div className="bg-white/5 p-2 rounded-xl border border-white/5 text-center sm:text-left">
                          <div className="text-[10px] text-slate-400 font-bold font-bengali">অংশগ্রহণ কুইজ</div>
                          <div className="text-sm font-mono font-bold mt-1 text-indigo-300">{attempts.length} টি</div>
                        </div>
                        <div className="bg-white/5 p-2 rounded-xl border border-white/5 text-center sm:text-left">
                          <div className="text-[10px] text-slate-400 font-bold font-bengali">গড় অগ্রগতি</div>
                          <div className="text-sm font-mono font-bold mt-1 text-emerald-400">
                            {attempts.length > 0
                              ? Math.round(attempts.reduce((sum, att) => sum + (att.percentage || 0), 0) / attempts.length)
                              : 0}%
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Right Col: Goal Selection & Diary */}
                  <div className="md:col-span-7 flex flex-col justify-between space-y-4">
                    <div className="flex flex-col sm:flex-row gap-4 items-start sm:items-center justify-between border-b border-white/5 pb-3">
                      <div className="flex items-center gap-2">
                        <Target className="w-5 h-5 text-indigo-400" />
                        <span className="font-bold text-sm sm:text-base text-slate-100 font-bengali">ব্যক্তিগত পড়ার আলাদা পরিধি</span>
                      </div>
                      <div className="flex items-center gap-2 shrink-0">
                        <label className="text-xs text-slate-300 font-bold font-bengali">দৈনিক লক্ষ্য:</label>
                        <select
                          id="academic-goals-input"
                          value={profile.dailyGoalHours}
                          onChange={(e) => handleUpdateProfile({ dailyGoalHours: Number(e.target.value) })}
                          className="bg-slate-900 border border-slate-700 rounded-xl px-2.5 py-1 text-xs font-black text-indigo-300 focus:outline-none focus:border-indigo-500 transition cursor-pointer"
                        >
                          {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map(h => (
                            <option key={h} value={h}>{h} ঘণ্টা</option>
                          ))}
                        </select>
                      </div>
                    </div>

                    <div className="space-y-1.5 flex-grow">
                      <div className="flex justify-between items-center text-xs">
                        <span className="font-bold text-slate-300 font-bengali flex items-center gap-1.5">
                          <PenSquare className="w-4 h-4 text-slate-400" /> পড়াশোনার বিষয়ভিত্তিক লক্ষ্য ও দিনলিপি (Notes)
                        </span>
                      </div>
                      <textarea
                        placeholder="যেমন: আজকে গণিত ৩য় অধ্যায় এবং ইংরেজির ভোকাবুলারি রিভিশন করব..."
                        value={profile.notes}
                        onChange={(e) => handleUpdateProfile({ notes: e.target.value })}
                        rows={3}
                        className="w-full text-xs font-semibold bg-slate-950/80 border border-slate-800 rounded-2xl p-3 text-slate-200 placeholder-slate-500 focus:outline-none focus:border-indigo-500/80 focus:ring-1 focus:ring-indigo-500/45 transition leading-relaxed font-bengali"
                      />
                    </div>

                    <div className="flex justify-end pt-1">
                      <button
                        onClick={handleSaveProfile}
                        disabled={savingProfile}
                        className="inline-flex items-center gap-2 bg-indigo-600 hover:bg-indigo-505 disabled:bg-indigo-800 text-white text-xs font-bold px-5 py-2.5 rounded-xl shadow-md cursor-pointer tracking-wide hover:shadow-indigo-500/20 transition-all font-bengali active:scale-95"
                      >
                        {savingProfile ? <>আপডেট হচ্ছে...</> : <><Save className="w-3.5 h-3.5" /> সংরক্ষণ করুন</>}
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}
