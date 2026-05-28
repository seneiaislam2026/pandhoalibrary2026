import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../store/AuthContext';
import { 
  ArrowLeft, 
  Share2, 
  BookOpen, 
  ChevronDown, 
  ChevronUp, 
  ThumbsUp, 
  ThumbsDown, 
  CheckCircle2, 
  XCircle, 
  Trophy, 
  RotateCcw, 
  Calendar, 
  Clock, 
  HelpCircle,
  SquarePen
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { collection, addDoc, getDocs, query, orderBy, doc, getDoc } from 'firebase/firestore';
import { db, handleFirestoreError, OperationType } from '../../lib/firebase';
import toast from 'react-hot-toast';

interface Question {
  id: string;
  questionText: string;
  optionA: string;
  optionB: string;
  optionC: string;
  optionD: string;
  correctOption: 'A' | 'B' | 'C' | 'D';
  hint?: string;
  active?: boolean;
  setId?: string;
}

// Fallback high-quality library general knowledge questions if none uploaded yet
const DEFAULT_QUESTIONS: Question[] = [
  {
    id: 'default_1',
    questionText: "'সততার পুরস্কার' গল্পে দ্বিতীয় ব্যক্তিটি আল্লাহর দূতের কাছে কী চেয়েছিলেন?",
    optionA: "প্রচুর অর্থ led",
    optionB: "একটি উট",
    optionC: "একটি গাভী",
    optionD: "একটি ছাগল",
    correctOption: 'C',
    hint: "আল্লাহর দূত দ্বিতীয় ব্যক্তিকে পরীক্ষায় উত্তীর্ণ হওয়ার পর একটি বরকতময় গাভী উপহার দিয়েছিলেন।"
  },
  {
    id: 'default_2',
    questionText: "বাংলা সাহিত্যের প্রথম সার্থক উপন্যাস কোনটি?",
    optionA: "কপালকুণ্ডলা",
    optionB: "দুর্গেশনন্দিনী",
    optionC: "বিষবৃক্ষ",
    optionD: "চোখের বালি",
    correctOption: 'B',
    hint: "১৮৬৫ সালে প্রকাশিত বঙ্কিমচন্দ্র চট্টোপাধ্যায় রচিত 'দুর্গেশনন্দিনী' বাংলা সাহিত্যের প্রথম সার্থক উপন্যাস।"
  },
  {
    id: 'default_3',
    questionText: "'গীতাঞ্জলি' কাব্যগ্রন্থের জন্য রবীন্দ্রনাথ ঠাকুর কত সালে নোবেল পুরস্কার লাভ করেন?",
    optionA: "১৯১০",
    optionB: "১৯১৩",
    optionC: "১৯১৫",
    optionD: "১৯২০",
    correctOption: 'B',
    hint: "রবীন্দ্রনাথ ঠাকুর ১৯১৩ সালে এশীয়দের মধ্যে সর্বপ্রথম সাহিত্যে নোবেল পুরস্কার লাভ করেন।"
  },
  {
    id: 'default_4',
    questionText: "কাজী নজরুল ইসলামের প্রথম প্রকাশিত কাব্যগ্রন্থ কোনটি?",
    optionA: "অগ্নিবীণা",
    optionB: "বিষের বাঁশী",
    optionC: "সাম্যবাদী",
    optionD: "সর্বহারা",
    correctOption: 'A',
    hint: "১৯২২ সালে প্রকাশিত 'অগ্নিবীণা' কাজী নজরুল ইসলামের প্রথম যুগান্তকারী কাব্যগ্রন্থ।"
  },
  {
    id: 'default_5',
    questionText: "জীবনানন্দ দাশের বিখ্যাত কবিতা 'বনলতা সেন' চরিত্রটি কোন অঞ্চলের পটভূমিতে চিত্রিত?",
    optionA: "ঢাকা",
    optionB: "বরিশাল",
    optionC: "নাটোর",
    optionD: "রাজশাহী",
    correctOption: 'C',
    hint: "নাটোরের বনলতা সেন জীবনানন্দ দাশের অন্যতম কালজয়ী রোমান্টিক কবিতা।"
  }
];

export default function Exam({ isPublic = false }: { isPublic?: boolean }) {
  const { user } = useAuth();
  const navigate = useNavigate();

  const [questions, setQuestions] = useState<Question[]>([]);
  const [loading, setLoading] = useState(true);
  const [currentIdx, setCurrentIdx] = useState(0);
  const [score, setScore] = useState(0);
  const [selectedOption, setSelectedOption] = useState<'A' | 'B' | 'C' | 'D' | null>(null);
  const [isAnswered, setIsAnswered] = useState(false);
  const [showHint, setShowHint] = useState(false);
  const [isFinished, setIsFinished] = useState(false);
  
  // Public and Visitor mode states
  const [visitorName, setVisitorName] = useState('');
  const [hasStarted, setHasStarted] = useState(false);

  // Timer and Negative Marking settings
  const [isTimerEnabled, setIsTimerEnabled] = useState(true);
  const [isNegativeEnabled, setIsNegativeEnabled] = useState(false);
  const [timeLeft, setTimeLeft] = useState(45);
  const [timerActive, setTimerActive] = useState(false);

  // Separate score trackers
  const [correctCount, setCorrectCount] = useState(0);
  const [wrongCount, setWrongCount] = useState(0);
  
  // Leaderboard states
  const [leaderboard, setLeaderboard] = useState<any[]>([]);
  const [loadingLeaderboard, setLoadingLeaderboard] = useState(false);

  // Feedbacks
  const [likedQuestions, setLikedQuestions] = useState<Record<string, 'up' | 'down' | null>>({});
  const [quizTitle, setQuizTitle] = useState<string>('');
  const [examSetId, setExamSetId] = useState<string>('');

  // Handle Score calculations based on Correct & Wrong answers and Negative marking (if enabled)
  useEffect(() => {
    const calc = isNegativeEnabled 
      ? Math.max(0, correctCount - (wrongCount * 0.25)) 
      : correctCount;
    setScore(Number(calc.toFixed(2)));
  }, [correctCount, wrongCount, isNegativeEnabled]);

  // Handle timer activation & resetting when index or answering state changes
  useEffect(() => {
    if (!hasStarted || isFinished) {
      setTimerActive(false);
      return;
    }

    if (isTimerEnabled && !isAnswered) {
      setTimeLeft(45);
      setTimerActive(true);
    } else {
      setTimerActive(false);
    }
  }, [hasStarted, isFinished, isAnswered, currentIdx, isTimerEnabled]);

  // Handle countdown interval
  useEffect(() => {
    let intervalId: any = null;
    if (timerActive && timeLeft > 0) {
      intervalId = setInterval(() => {
        setTimeLeft(prev => prev - 1);
      }, 1000);
    } else if (timeLeft === 0 && timerActive && !isAnswered) {
      // Time's up behavior: lock question and record wrong count
      setIsAnswered(true);
      setShowHint(true);
      setWrongCount(prev => prev + 1);
      toast.error('সময় শেষ হয়ে গেছে!', { duration: 2000 });
    }

    return () => {
      if (intervalId) clearInterval(intervalId);
    };
  }, [timerActive, timeLeft, isAnswered]);

  // Dynamic quota
  const qLimit = 30; // Max questions in the exam quota

  const fetchLeaderboard = async () => {
    setLoadingLeaderboard(true);
    try {
      const qSnapshot = await getDocs(collection(db, 'quiz-attempts'));
      const list: any[] = [];
      qSnapshot.forEach((doc) => {
        list.push({ id: doc.id, ...doc.data() });
      });
      // Sort desc by percentage, then score desc, then date desc
      list.sort((a, b) => {
        if (b.percentage !== a.percentage) {
          return b.percentage - a.percentage;
        }
        return b.score - a.score;
      });
      setLeaderboard(list.slice(0, 10)); // Take top 10
    } catch (e) {
      console.error("Error loading leaderboard:", e);
    } finally {
      setLoadingLeaderboard(false);
    }
  };

  useEffect(() => {
    if (isFinished) {
      fetchLeaderboard();
    }
  }, [isFinished]);

  useEffect(() => {
    const fetchQuestions = async () => {
      try {
        const urlParams = new URLSearchParams(window.location.search);
        const setId = urlParams.get('setId') || urlParams.get('set');
        if (setId) {
          setExamSetId(setId);
        }

        // Fetch Quiz Set Title if dynamic setId is set
        if (setId) {
          try {
            const docRef = doc(db, 'study_practice_contents', setId);
            const docSnap = await getDoc(docRef);
            if (docSnap.exists()) {
              setQuizTitle(docSnap.data().title);
            }
          } catch (tErr) {
            console.error("Error fetching quiz title from Firestore:", tErr);
          }
        }

        const querySnapshot = await getDocs(collection(db, 'quiz-questions'));
        let list: Question[] = [];
        querySnapshot.forEach((doc) => {
          const data = doc.data();
          if (data.active !== false) {
            list.push({ id: doc.id, ...data } as Question);
          }
        });

        // Filter by quiz set ID if specified
        if (setId) {
          list = list.filter(q => q.setId === setId);
        }

        // Shuffle function
        const shuffle = (array: any[]) => {
          return array.sort(() => Math.random() - 0.5);
        };

        // Complete removal of mock DEFAULT_QUESTIONS as requested
        setQuestions(shuffle(list).slice(0, qLimit));
      } catch (error) {
        console.error("Error loaded quiz questions:", error);
        setQuestions([]);
      } finally {
        setLoading(false);
      }
    };
    fetchQuestions();
  }, []);

  const handleOptionSelect = (option: 'A' | 'B' | 'C' | 'D') => {
    if (isAnswered) return;
    setSelectedOption(option);
    setIsAnswered(true);
    setShowHint(true);
    
    const isCorrect = option === questions[currentIdx].correctOption;
    if (isCorrect) {
      setCorrectCount(prev => prev + 1);
      toast.success('সঠিক উত্তর!', { duration: 1000 });
    } else {
      setWrongCount(prev => prev + 1);
      if (isNegativeEnabled) {
        toast.error('ভুল উত্তর! (০.২৫ পয়েন্ট কর্তন)', { duration: 1200 });
      } else {
        toast.error('ভুল উত্তর!', { duration: 1000 });
      }
    }
  };

  const saveAttempt = async (cCount?: number, wCount?: number) => {
    const finalUserId = user ? user.id : 'public-' + Date.now();
    const finalUserName = user ? user.name : (visitorName.trim() || 'পাবলিক পরীক্ষার্থী');
    const finalCorrect = typeof cCount === 'number' ? cCount : correctCount;
    const finalWrong = typeof wCount === 'number' ? wCount : wrongCount;

    try {
      const calc = isNegativeEnabled 
        ? Math.max(0, finalCorrect - (finalWrong * 0.25)) 
        : finalCorrect;
      const finalScore = Number(calc.toFixed(2));
      const percentage = Math.round((finalScore / questions.length) * 100);
      
      const attemptData = {
        userId: finalUserId,
        userName: finalUserName,
        score: finalScore,
        correctCount: finalCorrect,
        wrongCount: finalWrong,
        totalQuestions: questions.length,
        percentage: percentage,
        isNegativeEnabled: isNegativeEnabled,
        isTimerEnabled: isTimerEnabled,
        setId: examSetId || '',
        quizTitle: quizTitle || 'সাধারণ কুইজ',
        date: new Date().toISOString()
      };
      
      await addDoc(collection(db, 'quiz-attempts'), attemptData);
      // Fetch leaderboard immediately to show latest results
      fetchLeaderboard();
    } catch (e) {
      console.error('Error saving quiz results:', e);
    }
  };

  const handleSkip = () => {
    // Treat skip/skip action as skipped but do not deduct negative score
    // Add to wrongCount as incorrect/unresolved but negative marking is not applied
    setWrongCount(prev => prev + 1);

    // Reset state for next question
    setSelectedOption(null);
    setIsAnswered(false);
    setShowHint(false);

    if (currentIdx + 1 < questions.length) {
      setCurrentIdx(prev => prev + 1);
    } else {
      // Completed, save results to DB
      setIsFinished(true);
      saveAttempt(correctCount, wrongCount + 1);
    }
  };

  const handleNext = () => {
    if (!isAnswered) {
      toast.error('পরবর্তী প্রশ্নে যাওয়ার আগে যেকোনো একটি উত্তর সিলেক্ট করুন বা এড়িয়ে যান (Skip) চাপুন।');
      return;
    }

    // Reset state for next question
    setSelectedOption(null);
    setIsAnswered(false);
    setShowHint(false);

    if (currentIdx + 1 < questions.length) {
      setCurrentIdx(prev => prev + 1);
    } else {
      // Completed, save results to DB
      setIsFinished(true);
      saveAttempt(correctCount, wrongCount);
    }
  };

  const resetQuiz = () => {
    // Shuffle same array again and reset state
    const shuffled = [...questions].sort(() => Math.random() - 0.5);
    setQuestions(shuffled);
    setCurrentIdx(0);
    setScore(0);
    setCorrectCount(0);
    setWrongCount(0);
    setSelectedOption(null);
    setIsAnswered(false);
    setShowHint(false);
    setIsFinished(false);
  };

  const handleShare = () => {
    const urlParams = new URLSearchParams(window.location.search);
    const setId = urlParams.get('setId') || urlParams.get('set');
    const shareUrl = setId 
      ? `${window.location.origin}/public-exam?setId=${setId}` 
      : `${window.location.origin}/public-exam`;

    if (navigator.share) {
      navigator.share({
        title: quizTitle || 'বাংলা কুইজ - পানধোয়া উন্মুক্ত পাঠাগার',
        text: `আমি "${quizTitle || 'পাবলিক বাংলা কুইজে'}" মেধা পরীক্ষা যাচাই করছি! আপনিও এখানে অংশ নিন।`,
        url: shareUrl,
      }).then(() => {
        toast.success('সফলভাবে শেয়ার করা হয়েছে!');
      }).catch((e) => {
        navigator.clipboard.writeText(shareUrl);
        toast.success('পরীক্ষার লিংকটি কপি করা হয়েছে!');
      });
    } else {
      navigator.clipboard.writeText(shareUrl);
      toast.success('পরীক্ষার লিংকটি কপি করা হয়েছে!');
    }
  };

  const handleReaction = (type: 'up' | 'down') => {
    const qId = questions[currentIdx].id;
    const current = likedQuestions[qId];
    if (current === type) {
      setLikedQuestions(prev => ({ ...prev, [qId]: null }));
      toast.success('প্রতিক্রিয়া সরানো হয়েছে');
    } else {
      setLikedQuestions(prev => ({ ...prev, [qId]: type }));
      toast.success(type === 'up' ? 'পছন্দ হয়েছে!' : 'উন্নত করা প্রয়োজন!');
    }
  };

  if (loading) {
    return (
      <div className="min-h-[80vh] flex flex-col items-center justify-center text-slate-800 dark:text-white">
        <div className="w-12 h-12 border-4 border-slate-700 border-t-indigo-600 rounded-full animate-spin mb-4" />
        <p className="font-bengali font-black animate-pulse text-lg">প্রশ্নগুলো মূল্যায়ন করা হচ্ছে...</p>
      </div>
    );
  }

  if (questions.length === 0) {
    return (
      <div className="min-h-[60vh] flex flex-col items-center justify-center p-6 text-center">
        <HelpCircle className="w-16 h-16 text-indigo-500 mb-4" />
        <h3 className="text-xl font-bold font-bengali text-slate-800 dark:text-slate-100 mb-2">কোনো প্রশ্ন পাওয়া যায়নি</h3>
        <p className="text-slate-500 dark:text-slate-400 font-bengali max-w-sm mb-6">পরীক্ষা দেওয়ার জন্য কোনো সক্রিয় প্রশ্ন পাওয়া যায়নি। অনুগ্রহ করে অ্যাডমিনকে যোগাযোগের অনুরোধ করুন।</p>
        <button onClick={() => navigate('/dashboard')} className="px-6 py-2.5 bg-indigo-600 text-white rounded-xl font-bengali font-bold hover:bg-indigo-700 transition">
          ড্যাশবোর্ডে ফিরে যান
        </button>
      </div>
    );
  }

  const currentQuestion = questions[currentIdx];

  const isUserLoggedIn = !!user;
  const showStartScreen = !hasStarted;

  if (showStartScreen) {
    return (
      <div className="w-full max-w-[550px] mx-auto bg-[#1a1e26] dark:bg-[#11141b] rounded-2xl md:rounded-3xl shadow-xl p-6 md:p-8 text-white flex flex-col justify-between selection:bg-indigo-500 selection:text-white min-h-[480px] items-center text-center transition-all">
        <div className="w-full my-auto space-y-6">
          <div className="w-16 h-16 sm:w-20 sm:h-20 mx-auto bg-[#232936] rounded-3xl flex items-center justify-center border border-white/5 shadow-lg relative overflow-hidden">
            <div className="absolute inset-0 bg-gradient-to-tr from-indigo-500/10 to-indigo-500/0" />
            <Trophy className="w-10 h-10 text-indigo-400" />
          </div>
          
          <div className="space-y-2">
            <h1 className="text-2xl md:text-3xl font-black font-bengali tracking-tight text-white/95">
              {quizTitle || 'উন্মুক্ত কুইজ মেধা পরীক্ষা'}
            </h1>
            <p className="text-xs sm:text-xs text-slate-400 font-medium font-bengali leading-relaxed">
              পানধোয়া উন্মুক্ত পাঠাগার কুইজে আপনাকে স্বাগতম! নিচের অপশনগুলো সিলেক্ট করে আপনার মেধা পরীক্ষা শুরু করুন।
            </p>
          </div>

          <div className="w-full max-w-sm mx-auto space-y-4 pt-2">
            {/* Name input if visitor */}
            {!isUserLoggedIn ? (
              <div className="text-left">
                <label className="block text-[11px] font-bold text-slate-400 uppercase tracking-widest mb-1.5 font-mono">Your Name / আপনার নাম</label>
                <input
                  type="text"
                  required
                  value={visitorName}
                  onChange={(e) => setVisitorName(e.target.value)}
                  placeholder="যেমন: আবির হাসান"
                  className="w-full px-4 py-3 bg-[#232936] hover:bg-[#2b3240] focus:bg-[#1d222e] border border-white/5 rounded-2xl text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/50 text-xs sm:text-sm font-bold font-bengali transition-colors"
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && visitorName.trim()) {
                      setHasStarted(true);
                    }
                  }}
                />
              </div>
            ) : (
              <div className="p-3 bg-[#232936] border border-indigo-500/15 rounded-2xl text-left flex items-center gap-2.5 font-bengali">
                <div className="w-2 rounded-full h-2 bg-emerald-500 animate-pulse" />
                <div className="text-xs">
                  <span className="text-slate-400 font-medium block">পরীক্ষার্থী (প্রোফাইল):</span>
                  <span className="text-slate-200 font-bold block text-sm">{user?.name}</span>
                </div>
              </div>
            )}

            {/* Exam Parameters */}
            <div className="bg-[#232936] p-4 rounded-2xl border border-white/5 text-left font-bengali space-y-3">
              <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest font-mono mb-1">পরীক্ষার সেটিংস ও কন্ডিশন:</p>
              
              {/* Timer Switch */}
              <label className="flex items-start gap-3 cursor-pointer select-none group">
                <input
                  type="checkbox"
                  checked={isTimerEnabled}
                  onChange={(e) => setIsTimerEnabled(e.target.checked)}
                  className="w-4.5 h-4.5 accent-indigo-500 mt-0.5 rounded focus:ring-indigo-500"
                />
                <div>
                  <span className="text-xs sm:text-sm font-bold text-slate-200 block group-hover:text-white transition-colors">৪৫ সেকেন্ড সময়সীমা থাকবে</span>
                  <span className="text-[10px] text-slate-400 leading-none block mt-0.5">প্রতিটি প্রশ্নের উত্তর দেওয়ার জন্য ৪৫ সেকেন্ড সময় পাবেন।</span>
                </div>
              </label>

              {/* Negative Marking Switch */}
              <label className="flex items-start gap-3 cursor-pointer select-none group">
                <input
                  type="checkbox"
                  checked={isNegativeEnabled}
                  onChange={(e) => setIsNegativeEnabled(e.target.checked)}
                  className="w-4.5 h-4.5 accent-indigo-500 mt-0.5 rounded focus:ring-indigo-500"
                />
                <div>
                  <span className="text-xs sm:text-sm font-bold text-slate-200 block group-hover:text-white transition-colors">নেগেটিভ মার্কিং সক্রিয় করুন</span>
                  <span className="text-[10px] text-slate-400 leading-none block mt-0.5">প্রতিটি ভুল উত্তরের জন্য আপনার ০.২৫ নম্বর কাটা যাবে। (এড়িয়ে গেলে কাটা যাবে না)</span>
                </div>
              </label>
            </div>

            <button
              onClick={() => {
                if (!isUserLoggedIn && !visitorName.trim()) {
                  toast.error('অনুগ্রহ করে কুইজ শুরু করার আগে আপনার নাম লিখুন।');
                  return;
                }
                setHasStarted(true);
              }}
              className="w-full py-3.5 bg-indigo-600 hover:bg-indigo-700 text-white font-bengali font-black text-xs sm:text-sm rounded-2xl shadow-xl shadow-indigo-600/10 transition active:scale-95 cursor-pointer flex items-center justify-center gap-1.5"
            >
              পরীক্ষা শুরু করুন
            </button>
          </div>
        </div>
        
        <p className="text-[10px] text-slate-500 font-mono mt-4">
          Public Access provided by Pandhoa Open Library
        </p>
      </div>
    );
  }

  return (
    <div className="w-full max-w-[550px] mx-auto bg-[#1a1e26] dark:bg-[#11141b] rounded-2xl md:rounded-3xl shadow-xl p-3.5 sm:p-5 md:p-6 text-white flex flex-col justify-between selection:bg-indigo-500 selection:text-white gap-4 md:gap-6 min-h-[80vh] sm:min-h-[85vh] transition-all">
      
      {/* 1. Header */}
      <div>
        <div className="flex items-center justify-between border-b border-white/5 pb-4 mb-4">
          <div className="flex items-center gap-3">
            <button 
              onClick={() => navigate(user ? '/dashboard' : '/')}
              aria-label="Back"
              className="p-2 rounded-xl bg-white/5 hover:bg-white/10 text-slate-300 transition-colors cursor-pointer"
            >
              <ArrowLeft className="w-5 h-5 text-white" />
            </button>
            <h1 className="text-base md:text-lg lg:text-xl font-black font-bengali text-slate-100 flex items-center gap-1.5 truncate max-w-[200px] sm:max-w-xs">
              <span className="w-2 h-2 rounded-full bg-indigo-500 animate-pulse"></span>
              {quizTitle || 'বাংলা কুইজ'}
            </h1>
          </div>
          <button 
            onClick={handleShare}
            aria-label="Share"
            className="p-1.5 md:p-2 rounded-xl bg-white/5 hover:bg-white/10 text-slate-300 transition-colors cursor-pointer"
          >
            <Share2 className="w-4.5 h-4.5 text-white" />
          </button>
        </div>

        {/* Dynamic Timer countdown bar indicator */}
        {isTimerEnabled && !isFinished && hasStarted && (
          <div className="w-full h-1 bg-white/5 rounded-full overflow-hidden mb-4">
            <motion.div 
              initial={{ width: '100%' }}
              animate={{ width: `${(timeLeft / 45) * 100}%` }}
              transition={{ duration: 1, ease: 'linear' }}
              className={`h-full ${timeLeft <= 10 ? 'bg-red-500' : 'bg-indigo-500'}`}
            />
          </div>
        )}

        <AnimatePresence mode="wait">
          {!isFinished ? (
            <motion.div
              key={currentIdx}
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              transition={{ duration: 0.3 }}
              className="space-y-4 md:space-y-6"
            >
              {/* index indicator */}
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="text-[13px] sm:text-[15px] font-semibold text-slate-400 font-mono">
                    {currentIdx + 1} / {questions.length}
                  </span>

                  {isTimerEnabled && (
                    <span className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] sm:text-xs font-bold leading-none select-none transition-colors duration-250 ${timeLeft <= 10 ? 'bg-red-500/10 text-red-400 border border-red-500/20 font-mono animate-pulse' : 'bg-indigo-500/10 text-indigo-400 border border-indigo-500/15'}`}>
                      <Clock className="w-3 h-3" />
                      <span className="font-mono">{timeLeft}s</span>
                    </span>
                  )}

                  {isNegativeEnabled && (
                    <span className="inline-block px-2.5 py-0.5 bg-rose-500/10 text-rose-450 border border-rose-500/15 rounded-full text-[10px] sm:text-xs font-black font-bengali leading-none">
                      নেগেটিভ মার্কিং ০.২৫
                    </span>
                  )}
                </div>
                
                {/* Visual Admin indicator tool */}
                {(user?.role === 'admin' || user?.role === 'subadmin') && (
                  <button 
                    onClick={() => navigate('/dashboard/manage-exam')}
                    className="flex items-center gap-1 px-2.5 py-1 bg-rose-500/10 text-rose-400 border border-rose-500/20 text-[11px] sm:text-xs font-bold rounded-lg hover:bg-rose-500/20 transition cursor-pointer"
                  >
                    <SquarePen className="w-3 h-3" /> এডিট প্রশ্ন
                  </button>
                )}
              </div>

              {/* Question Text */}
              <div>
                <h2 className="text-[15px] sm:text-[17px] md:text-[19px] font-black leading-relaxed font-bengali text-slate-100">
                  {currentQuestion.questionText}
                </h2>
              </div>

              {/* Options */}
              <div className="space-y-2.5 sm:space-y-3 pt-1">
                {(['A', 'B', 'C', 'D'] as const).map((opt) => {
                  const optText = currentQuestion[`option${opt}` as keyof Question] as string;
                  const isSelected = selectedOption === opt;
                  const isCorrectAnswer = currentQuestion.correctOption === opt;
                  
                  // Color codes
                  let optionStyle = "border-white/5 bg-[#232936] hover:bg-[#2b3240] text-slate-300";
                  let checkIcon = null;

                  if (isAnswered) {
                    if (isCorrectAnswer) {
                      optionStyle = "bg-emerald-600/20 border-emerald-500/50 text-emerald-300 font-bold";
                      checkIcon = <CheckCircle2 className="w-4.5 h-4.5 text-emerald-400 shrink-0" />;
                    } else if (isSelected) {
                      optionStyle = "bg-rose-600/20 border-rose-500/50 text-rose-300 font-bold";
                      checkIcon = <XCircle className="w-4.5 h-4.5 text-rose-400 shrink-0" />;
                    } else {
                      optionStyle = "opacity-40 border-white/5 bg-[#232936] text-slate-400";
                    }
                  } else if (isSelected) {
                    optionStyle = "border-[#4f46e5]/80 bg-[#1e222b] text-white";
                  }

                  return (
                    <button
                      key={opt}
                      onClick={() => handleOptionSelect(opt)}
                      disabled={isAnswered}
                      className={`w-full flex items-center justify-between text-left p-3 sm:p-3.5 md:p-4 rounded-2xl border transition-all duration-200 outline-none ${optionStyle} cursor-pointer group text-sm sm:text-base`}
                    >
                      <div className="flex items-center gap-3">
                        <span className="w-6 h-6 sm:w-7 sm:h-7 rounded-full bg-white/5 group-hover:bg-white/10 flex items-center justify-center font-bold text-xs sm:text-sm text-slate-100">
                          {opt}
                        </span>
                        <span className="font-bengali font-bold text-xs sm:text-sm md:text-base pr-2">{optText}</span>
                      </div>
                      {checkIcon}
                    </button>
                  );
                })}
              </div>

              {/* Hint and Explanation section */}
              {isAnswered && currentQuestion.hint && (
                <div className="pt-1">
                  <button 
                    onClick={() => setShowHint(!showHint)}
                    className="w-full flex items-center justify-between py-2.5 px-3.5 rounded-xl bg-white/5 hover:bg-white/10 transition-colors text-xs sm:text-sm text-slate-300 font-semibold font-bengali"
                  >
                    <span className="flex items-center gap-2">💡 Hint / ব্যাখ্যা</span>
                    {showHint ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                  </button>
                  <AnimatePresence>
                    {showHint && (
                      <motion.div 
                        initial={{ opacity: 0, height: 0 }}
                        animate={{ opacity: 1, height: 'auto' }}
                        exit={{ opacity: 0, height: 0 }}
                        className="overflow-hidden mt-1.5"
                      >
                        <div className="p-3.5 rounded-xl bg-indigo-950/20 border border-indigo-500/20 text-indigo-200 text-xs sm:text-sm leading-relaxed font-bengali">
                          {currentQuestion.hint}
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>
              )}
            </motion.div>
          ) : (
            /* Celebration score screen with Leaderboard */
            <motion.div 
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              className="text-center py-4 space-y-5"
            >
              <div className="w-16 h-16 sm:w-20 sm:h-20 mx-auto bg-yellow-500/10 rounded-full flex items-center justify-center border border-yellow-500/20">
                <Trophy className="w-10 h-10 text-yellow-400" />
              </div>
              <div className="space-y-1">
                <h3 className="text-xl sm:text-2xl font-black font-bengali text-slate-100">পরীক্ষা সম্পন্ন হয়েছে!</h3>
                <p className="text-slate-400 font-bengali text-xs sm:text-sm">আপনার মেধা পরীক্ষার ফলাফল নিচে দেওয়া হলো।</p>
              </div>

              <div className="bg-[#232936] rounded-2xl p-4 sm:p-5 max-w-[360px] mx-auto space-y-3.5 border border-white/5">
                <div className="grid grid-cols-2 gap-3 text-center">
                  <div className="bg-emerald-500/5 p-2 rounded-xl border border-emerald-500/10">
                    <p className="text-[10px] sm:text-xs text-slate-400 font-bengali">সঠিক উত্তর</p>
                    <p className="text-lg sm:text-xl font-mono font-black text-emerald-400 mt-0.5">{correctCount} টি</p>
                  </div>
                  <div className="bg-rose-500/5 p-2 rounded-xl border border-rose-500/10">
                    <p className="text-[10px] sm:text-xs text-slate-400 font-bengali">ভুল উত্তর</p>
                    <p className="text-lg sm:text-xl font-mono font-black text-rose-450 mt-0.5">{wrongCount} টি</p>
                  </div>
                </div>

                <div className="h-px bg-white/5" />
                
                <div className="flex items-center justify-between px-1">
                  <div className="text-left font-bengali">
                    <p className="text-xs font-bold text-slate-100 flex items-center gap-1.5">
                      মোট অর্জন:
                    </p>
                    <p className="text-[10px] text-slate-400 mt-0.5 leading-none">
                      {isNegativeEnabled ? 'নেগেটিভ মার্কিং সহ প্রসেসকৃত' : 'সাধারণ কুইজ স্কোরিং'}
                    </p>
                  </div>
                  <p className="text-2xl sm:text-3xl font-mono font-black text-indigo-400">{score}</p>
                </div>

                <div className="text-center bg-[#1a1e26] py-1.5 rounded-xl border border-white/5">
                  <span className="text-[11px] sm:text-xs text-slate-400 font-bengali">অর্জনের শতাংশ হার: </span> 
                  <strong className="text-xs font-mono font-black text-indigo-300 ml-1">
                    {questions.length > 0 ? Math.round((score / questions.length) * 100) : 0}%
                  </strong>
                </div>
              </div>

              {/* Leaderboard Section */}
              <div className="bg-[#232936] rounded-2xl p-4 max-w-[360px] mx-auto text-left border border-white/5 mt-4">
                <h4 className="text-sm sm:text-base font-black font-bengali text-slate-100 flex items-center gap-2 mb-3">
                  <Trophy className="w-4.5 h-4.5 text-yellow-400 shrink-0" />
                  মেধাতালিকা (Leaderboard) - শীর্ষ ১০
                </h4>

                {loadingLeaderboard ? (
                  <div className="py-4 flex flex-col items-center justify-center">
                    <div className="w-5 h-5 border-2 border-slate-400 border-t-indigo-500 rounded-full animate-spin mb-2" />
                    <p className="text-[11px] text-slate-400 font-bengali">লোড হচ্ছে...</p>
                  </div>
                ) : leaderboard.length === 0 ? (
                  <p className="text-slate-400 text-center text-xs py-3 font-bengali">এখনো কোনো চেষ্টা সম্পন্ন হয়নি।</p>
                ) : (
                  <div className="space-y-1.5 max-h-[160px] overflow-y-auto pr-1">
                    {leaderboard.map((item, index) => {
                      const isCurrentUser = user && item.userId === user.id;
                      return (
                        <div 
                          key={item.id || index}
                          className={`flex items-center justify-between p-2 rounded-xl border text-xs font-bengali transition-colors ${isCurrentUser ? 'bg-indigo-600/35 border-indigo-500/50 text-white font-bold' : 'bg-white/5 border-transparent text-slate-300'}`}
                        >
                          <div className="flex items-center gap-2 max-w-[70%]">
                            <span className={`w-5.5 h-5.5 rounded font-bold font-mono text-[10px] sm:text-xs flex items-center justify-center shrink-0 ${index === 0 ? 'bg-yellow-500 text-[#1a1e26]' : index === 1 ? 'bg-slate-300 text-[#1a1e26]' : index === 2 ? 'bg-amber-600 text-white' : 'bg-white/10 text-slate-400'}`}>
                              {index + 1}
                            </span>
                            <span className="font-bold truncate">{item.userName || 'পরীক্ষার্থী'}</span>
                          </div>
                          <div className="text-right font-mono text-[11px] shrink-0">
                            <span className="font-bold text-slate-100">{item.score}/{item.totalQuestions}</span>
                            <span className="text-slate-400 ml-1">({item.percentage}%)</span>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>

              {/* Action Buttons */}
              <div className="flex flex-col gap-2 max-w-[360px] mx-auto pt-2">
                <div className="flex gap-2">
                  <button
                    onClick={resetQuiz}
                    className="flex-1 flex items-center justify-center gap-1.5 bg-white/5 hover:bg-white/10 text-white py-2.5 px-3 rounded-xl transition font-bengali font-bold border border-white/10 cursor-pointer text-xs sm:text-sm"
                  >
                    <RotateCcw className="w-3.5 h-3.5" /> আবার পরীক্ষা দিন
                  </button>
                  <button
                    onClick={() => navigate(user ? '/dashboard' : '/')}
                    className="flex-1 bg-indigo-600 hover:bg-indigo-700 text-white py-2.5 px-3 rounded-xl transition font-bengali font-bold shadow-lg shadow-indigo-600/35 cursor-pointer text-xs sm:text-sm"
                  >
                    {user ? 'ড্যাশবোর্ডে ফিরুন' : 'মূল পাতায় ফিরুন'}
                  </button>
                </div>
                
                <button
                  onClick={handleShare}
                  className="w-full flex items-center justify-center gap-2 bg-indigo-500/10 hover:bg-indigo-500/25 text-indigo-300 py-3 px-4 rounded-xl transition font-bengali font-bold border border-indigo-500/20 cursor-pointer text-xs sm:text-sm mt-1"
                >
                  <Share2 className="w-4 h-4 text-indigo-400" /> পরীক্ষার লিংক কপি করুন
                </button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* 3. Footer Action Controls */}
      {!isFinished && (
        <div className="border-t border-white/5 mt-4 pt-3.5">
          <div className="flex items-center justify-center gap-2.5 w-full">
            {!isAnswered && (
              <button 
                onClick={handleSkip}
                className="flex-1 py-3 bg-white/5 hover:bg-white/10 hover:text-white transition duration-200 text-slate-300 border border-white/10 font-bengali font-bold rounded-full active:scale-95 cursor-pointer text-xs sm:text-sm text-center"
              >
                এড়িয়ে যান (Skip)
              </button>
            )}
            <button 
              onClick={handleNext}
              className={`py-3 bg-indigo-600 hover:bg-indigo-700 transition duration-200 text-white font-bengali font-bold rounded-full shadow-lg shadow-indigo-600/20 active:scale-95 cursor-pointer text-xs sm:text-sm text-center ${isAnswered ? 'w-full' : 'flex-1'}`}
            >
              {currentIdx + 1 === questions.length ? 'ফলাফল দেখুন' : 'পরবর্তী (Next)'}
            </button>
          </div>
        </div>
      )}

    </div>
  );
}
