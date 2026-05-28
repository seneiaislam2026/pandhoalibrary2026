import React, { useState, useEffect } from 'react';
import { collection, query, getDocs, addDoc, serverTimestamp, deleteDoc, doc } from 'firebase/firestore';
import { db } from '../../lib/firebase';
import { BookOpen, FolderOpen, FileText, Trash2, Link as LinkIcon, Plus, Info, Check, Share2 } from 'lucide-react';
import toast from 'react-hot-toast';

interface StudyContent {
  id: string;
  title: string;
  description: string;
  type: 'quiz' | 'lecture' | 'question_bank' | 'suggestion';
  targetCategory: string;
  link: string;
  createdAt: any;
}

export default function ManageStudyPractice() {
  const [contents, setContents] = useState<StudyContent[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [isModalOpen, setIsModalOpen] = useState(false);

  const [formData, setFormData] = useState({
    title: '',
    description: '',
    type: 'quiz',
    targetCategory: 'class-6-8',
    link: ''
  });

  // Contextual bulk question upload states
  const [includeQuestions, setIncludeQuestions] = useState(false);
  const [uploadFormat, setUploadFormat] = useState<'pipeline' | 'json'>('pipeline');
  const [bulkInput, setBulkInput] = useState('');

  const types = [
    { value: 'lecture', label: 'লেকচার শিট / PDF' },
    { value: 'quiz', label: 'অনলাইন কুইজ / পরীক্ষা' },
    { value: 'question_bank', label: 'প্রশ্ন ব্যাংক' },
    { value: 'suggestion', label: 'সাজেশন' }
  ];

  const categories = [
    { value: 'class-6-8', label: 'ক্লাস ৬-৮ (যৌথ)' },
    { value: 'class-6', label: 'সব ক্লাস ৬ (Class 6)' },
    { value: 'class-7', label: 'সব ক্লাস ৭ (Class 7)' },
    { value: 'class-8', label: 'সব ক্লাস ৮ (Class 8)' },
    { value: 'ssc-dakhil', label: 'এসএসসি / দাখিল' },
    { value: 'hsc-alim-admission', label: 'এইচএসসি / আলিম / এডমিশন' },
    { value: 'bcs-jobs', label: 'বিসিএস / জবস' }
  ];

  useEffect(() => {
    fetchContents();
  }, []);

  const fetchContents = async () => {
    setLoading(true);
    try {
      const q = query(collection(db, 'study_practice_contents'));
      const snap = await getDocs(q);
      const data = snap.docs.map(d => ({ id: d.id, ...d.data() } as StudyContent));
      
      // Sort in-memory to avoid index errors initially
      data.sort((a, b) => {
        const aTime = a.createdAt?.toMillis ? a.createdAt.toMillis() : (a.createdAt || 0);
        const bTime = b.createdAt?.toMillis ? b.createdAt.toMillis() : (b.createdAt || 0);
        return bTime - aTime;
      });
      setContents(data);
    } catch (err) {
      console.error(err);
      toast.error('ডেটা লোড করতে সমস্যা হয়েছে');
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.title || !formData.link) {
      return toast.error('অবশ্যই টাইটেল এবং লিংক দিতে হবে');
    }

    let parsedList: any[] = [];
    if (includeQuestions && bulkInput.trim() && (formData.type === 'quiz' || formData.type === 'question_bank')) {
      if (uploadFormat === 'json') {
        try {
          parsedList = JSON.parse(bulkInput);
          if (!Array.isArray(parsedList)) {
            throw new Error('অবশ্যই একটি JSON Array হতে হবে।');
          }
        } catch (jsonErr: any) {
          toast.error(`JSON ভুল আছে: ${jsonErr.message}`);
          return;
        }
      } else {
        const lines = bulkInput.split('\n');
        for (const line of lines) {
          if (!line.trim()) continue;
          const parts = line.split('|');
          if (parts.length < 5) {
            toast.error(`ভুল পাইপলাইন ফরম্যাট: ${line.substring(0, 30)}...`);
            return;
          }
          const questionText = parts[0]?.trim();
          const optionA = parts[1]?.trim();
          const optionB = parts[2]?.trim();
          const optionC = parts[3]?.trim();
          const optionD = parts[4]?.trim();
          const rawCorrect = parts[5]?.trim()?.toUpperCase() || 'A';
          const correctOption = ['A', 'B', 'C', 'D'].includes(rawCorrect) ? (rawCorrect as 'A' | 'B' | 'C' | 'D') : 'A';
          const hint = parts[6]?.trim() || '';

          if (!questionText || !optionA || !optionB || !optionC || !optionD) {
            toast.error('অপশন বা প্রশ্নের ঘর ফাঁকা রাখা যাবে না');
            return;
          }

          parsedList.push({
            questionText,
            optionA,
            optionB,
            optionC,
            optionD,
            correctOption,
            hint,
            active: true
          });
        }
      }

      if (parsedList.length > 30) {
        toast.error(`একত্রে সর্বোচ্চ ৩০টি প্রশ্ন আপলোড করা সম্ভব। আপনার দেওয়া লিস্টে ${parsedList.length}টি প্রশ্ন রয়েছে।`);
        return;
      }
    }

    setSaving(true);
    const toastId = toast.loading('যোগ করা হচ্ছে...');
    try {
      // 1. Add the study content
      const contentDocRef = await addDoc(collection(db, 'study_practice_contents'), {
        ...formData,
        createdAt: serverTimestamp()
      });

      // 2. Add the parsed questions (if any)
      if (parsedList.length > 0) {
        const colRef = collection(db, 'quiz-questions');
        for (const q of parsedList) {
          await addDoc(colRef, {
            questionText: q.questionText,
            optionA: q.optionA,
            optionB: q.optionB,
            optionC: q.optionC,
            optionD: q.optionD,
            correctOption: q.correctOption,
            hint: q.hint || '',
            active: q.active ?? true,
            setId: contentDocRef.id,
            targetCategory: formData.targetCategory,
            createdAt: serverTimestamp()
          });
        }
        toast.success(`${parsedList.length}টি প্রশ্ন কোশ্চেন ব্যাংকে যুক্ত করা হয়েছে!`);
      }

      toast.success('সফলভাবে যোগ করা হয়েছে!', { id: toastId });
      setIsModalOpen(false);
      setFormData({
        title: '',
        description: '',
        type: 'quiz',
        targetCategory: 'class-6-8',
        link: ''
      });
      setIncludeQuestions(false);
      setBulkInput('');
      fetchContents();
    } catch (err) {
      console.error(err);
      toast.error('যোগ করতে সমস্যা হয়েছে, আবার চেষ্টা করুন', { id: toastId });
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!window.confirm('আপনি কি সত্যিই এই পাঠচর্চা উপকরণটি মুছে ফেলতে চান?')) return;
    
    const toastId = toast.loading('মুছে ফেলা হচ্ছে...');
    try {
      await deleteDoc(doc(db, 'study_practice_contents', id));
      toast.success('মুছে ফেলা হয়েছে!', { id: toastId });
      setContents(contents.filter(c => c.id !== id));
    } catch (err) {
      console.error(err);
      toast.error('মুছে ফেলতে সমস্যা হয়েছে', { id: toastId });
    }
  };

  const getCategoryLabel = (catVal: string) => {
    return categories.find(c => c.value === catVal)?.label || catVal;
  };

  const getTypeLabel = (typeVal: string) => {
    return types.find(t => t.value === typeVal)?.label || typeVal;
  };

  return (
    <div className="p-4 sm:p-6 lg:p-8 max-w-7xl mx-auto font-bengali">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-6 mb-8">
        <div>
          <h1 className="text-2xl sm:text-3xl font-black text-slate-800 dark:text-white tracking-tight flex items-center gap-3">
            <BookOpen className="h-8 w-8 text-indigo-600" />
            পাঠচর্চা উপকরণ ব্যবস্থাপনা
          </h1>
          <p className="mt-2 text-sm text-slate-500 dark:text-slate-400 font-medium">
            পাঠচর্চা (Study Practice) পোর্টালের জন্য লেকচার শিট, প্রশ্ন ব্যাংক, সাজেশন ও কুইজ লিংক যোগ বা ডিলিট করুন।
          </p>
        </div>
        <button
          onClick={() => setIsModalOpen(true)}
          className="bg-indigo-600 hover:bg-indigo-700 text-white px-5 py-2.5 rounded-xl text-sm font-bold shadow-md hover:shadow-lg transition-all flex items-center gap-2 cursor-pointer"
        >
          <Plus className="w-4 h-4" />
          উপকরণ যোগ করুন
        </button>
      </div>

      {loading ? (
        <div className="py-20 text-center">
          <div className="w-12 h-12 border-4 border-indigo-100 border-t-indigo-600 rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-slate-500 dark:text-slate-400 font-bold">লোড হচ্ছে...</p>
        </div>
      ) : (
        <div className="bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-sm overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr>
                  <th className="bg-slate-50 dark:bg-slate-900 text-slate-500 dark:text-slate-400 font-bold text-xs uppercase tracking-wider px-6 py-4 border-b border-slate-200 dark:border-slate-700">ধরন</th>
                  <th className="bg-slate-50 dark:bg-slate-900 text-slate-500 dark:text-slate-400 font-bold text-xs uppercase tracking-wider px-6 py-4 border-b border-slate-200 dark:border-slate-700">ক্যাটাগরি/বিষয়</th>
                  <th className="bg-slate-50 dark:bg-slate-900 text-slate-500 dark:text-slate-400 font-bold text-xs uppercase tracking-wider px-6 py-4 border-b border-slate-200 dark:border-slate-700">শিরোনাম</th>
                  <th className="bg-slate-50 dark:bg-slate-900 text-slate-500 dark:text-slate-400 font-bold text-xs uppercase tracking-wider px-6 py-4 border-b border-slate-200 dark:border-slate-700">লিংক</th>
                  <th className="bg-slate-50 dark:bg-slate-900 text-slate-500 dark:text-slate-400 font-bold text-xs uppercase tracking-wider px-6 py-4 border-b border-slate-200 dark:border-slate-700 text-right">ম্যানেজ</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-700 text-sm">
                {contents.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="px-6 py-12 text-center text-slate-400 font-medium">
                      কোনো পাঠচর্চা কন্টেন্ট যোগ করা হয়নি
                    </td>
                  </tr>
                ) : contents.map(item => (
                  <tr key={item.id} className="hover:bg-slate-50/50 dark:hover:bg-slate-900/30 transition-colors">
                    <td className="px-6 py-4">
                      <span className={`inline-flex items-center px-2.5 py-1 rounded-lg text-xs font-bold ${
                        item.type === 'quiz' ? 'bg-fuchsia-50 text-fuchsia-700 dark:bg-fuchsia-950/40 dark:text-fuchsia-400' :
                        item.type === 'lecture' ? 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-400' :
                        item.type === 'question_bank' ? 'bg-amber-50 text-amber-700 dark:bg-amber-950/40 dark:text-amber-400' :
                        'bg-indigo-50 text-indigo-700 dark:bg-indigo-950/40 dark:text-indigo-400'
                      }`}>
                        {getTypeLabel(item.type)}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-slate-700 dark:text-slate-300 font-bold font-bengali">
                      {getCategoryLabel(item.targetCategory)}
                    </td>
                    <td className="px-6 py-4">
                      <div className="font-bold text-slate-800 dark:text-white max-w-xs sm:max-w-md truncate">
                        {item.title}
                      </div>
                      {item.description && (
                        <div className="text-xs text-slate-400 mt-0.5 max-w-xs truncate">{item.description}</div>
                      )}
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex flex-wrap items-center gap-2">
                        {item.link && (
                          <a 
                            href={item.link} 
                            target="_blank" 
                            rel="noopener noreferrer" 
                            className="text-indigo-600 dark:text-indigo-400 hover:underline inline-flex items-center gap-1 font-bold"
                          >
                            <LinkIcon className="w-3.5 h-3.5" /> ওপেন লিংক
                          </a>
                        )}
                        {(item.type === 'quiz' || item.type === 'question_bank') && (
                          <button
                            onClick={() => {
                              const examUrl = `${window.location.origin}/public-exam?setId=${item.id}`;
                              navigator.clipboard.writeText(examUrl);
                              toast.success('পাবলিক পরীক্ষা লিংকটি ক্লিপবোর্ডে কপি করা হয়েছে!');
                            }}
                            className="px-2.5 py-1 bg-emerald-50 dark:bg-emerald-950/30 text-emerald-700 dark:text-emerald-400 border border-emerald-200/50 dark:border-emerald-800/40 hover:bg-emerald-100 dark:hover:bg-emerald-900/40 rounded-lg text-xs font-bold inline-flex items-center gap-1 transition cursor-pointer active:scale-95"
                            title="পাবলিক লিংক কপি করুন"
                          >
                            <Share2 className="w-3 h-3" /> লিংক কপি
                          </button>
                        )}
                      </div>
                    </td>
                    <td className="px-6 py-4 text-right">
                      <button
                        onClick={() => handleDelete(item.id)}
                        className="p-2 text-slate-400 dark:text-slate-500 hover:text-red-600 dark:hover:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-xl transition-colors inline-block cursor-pointer"
                        title="মুছে ফেলুন"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Add Content Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm">
          <div className="bg-white dark:bg-slate-800 rounded-3xl shadow-xl w-full max-w-lg overflow-hidden flex flex-col border border-slate-200 dark:border-slate-700">
            <div className="px-6 py-4 bg-slate-50 dark:bg-slate-900 border-b border-slate-100 dark:border-slate-700 flex items-center justify-between">
              <h3 className="font-black text-slate-800 dark:text-white text-lg flex items-center gap-2">
                <FolderOpen className="w-5 h-5 text-indigo-600" /> নতুন পাঠচর্চা উপকরণ
              </h3>
              <button 
                onClick={() => setIsModalOpen(false)} 
                className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 transition-colors cursor-pointer"
              >
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
              </button>
            </div>
            
            <form onSubmit={handleSubmit} className="p-6 overflow-y-auto space-y-4">
              <div>
                <label className="block text-sm font-bold text-slate-700 dark:text-slate-300 mb-1">ক্যাটাগরি / বিষয়</label>
                <select
                  value={formData.targetCategory}
                  onChange={e => setFormData({...formData, targetCategory: e.target.value})}
                  className="w-full border border-slate-200 dark:border-slate-700 rounded-xl p-3 bg-slate-50 dark:bg-slate-900 text-slate-800 dark:text-slate-100 focus:bg-white dark:focus:bg-slate-900 focus:ring-2 focus:ring-indigo-500 outline-none"
                >
                  {categories.map(c => <option key={c.value} value={c.value}>{c.label}</option>)}
                </select>
              </div>

              <div>
                <label className="block text-sm font-bold text-slate-700 dark:text-slate-300 mb-1">উপকরণের ধরন</label>
                <select
                  value={formData.type}
                  onChange={e => setFormData({...formData, type: e.target.value})}
                  className="w-full border border-slate-200 dark:border-slate-700 rounded-xl p-3 bg-slate-50 dark:bg-slate-900 text-slate-800 dark:text-slate-100 focus:bg-white dark:focus:bg-slate-900 focus:ring-2 focus:ring-indigo-500 outline-none"
                >
                  {types.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
                </select>
              </div>

              <div>
                <label className="block text-sm font-bold text-slate-700 dark:text-slate-300 mb-1">উপকরণের শিরোনাম</label>
                <input
                  type="text"
                  required
                  value={formData.title}
                  onChange={e => setFormData({...formData, title: e.target.value})}
                  placeholder="যেমন: ৯ম শ্রেণী - গণিত ১ম অধ্যায় লেকচার"
                  className="w-full border border-slate-200 dark:border-slate-700 rounded-xl p-3 bg-slate-50 dark:bg-slate-900 text-slate-800 dark:text-slate-100 focus:bg-white dark:focus:bg-slate-900 focus:ring-2 focus:ring-indigo-500 outline-none"
                />
              </div>

              <div>
                <label className="block text-sm font-bold text-slate-700 dark:text-slate-300 mb-1">সংক্ষিপ্ত বিবরণ (ঐচ্ছিক)</label>
                <textarea
                  value={formData.description}
                  onChange={e => setFormData({...formData, description: e.target.value})}
                  placeholder="উপকরণের কিছু বিবরণ বা নির্দেশনা..."
                  className="w-full border border-slate-200 dark:border-slate-700 rounded-xl p-3 bg-slate-50 dark:bg-slate-900 text-slate-800 dark:text-slate-100 focus:bg-white dark:focus:bg-slate-900 focus:ring-2 focus:ring-indigo-500 outline-none h-20 resize-none"
                ></textarea>
              </div>

              <div>
                <label className="block text-sm font-bold text-slate-700 dark:text-slate-300 mb-1">লিংক (ড্রাইভ পিডিএফ, গুগল ফর্ম বা ড্রাইভ ফোল্ডার লিংক)</label>
                <input
                  type="url"
                  required
                  value={formData.link}
                  onChange={e => setFormData({...formData, link: e.target.value})}
                  placeholder="https://docs.google.com/..."
                  className="w-full border border-slate-200 dark:border-slate-700 rounded-xl p-3 bg-slate-50 dark:bg-slate-900 text-slate-800 dark:text-slate-100 focus:bg-white dark:focus:bg-slate-900 focus:ring-2 focus:ring-indigo-500 outline-none font-sans"
                />
              </div>

              {(formData.type === 'quiz' || formData.type === 'question_bank') && (
                <div className="bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-2xl p-4 space-y-3 mt-4">
                  <div className="flex items-center justify-between">
                    <label className="flex items-center gap-2 cursor-pointer select-none">
                      <input 
                        type="checkbox" 
                        checked={includeQuestions} 
                        onChange={e => setIncludeQuestions(e.target.checked)}
                        className="w-4.5 h-4.5 text-indigo-600 rounded bg-white dark:bg-slate-950 border-slate-300"
                      />
                      <span className="text-sm font-black text-slate-800 dark:text-slate-100 font-bengali">একত্রে প্রশ্ন আপলোড করতে চান? (ঐচ্ছিক)</span>
                    </label>
                  </div>
                  
                  {includeQuestions && (
                    <div className="space-y-4 pt-2">
                      <div>
                        <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2 font-mono">Upload Format / আপলোড ফরম্যাট</label>
                        <div className="flex gap-2">
                          <button
                            type="button"
                            onClick={() => setUploadFormat('pipeline')}
                            className={`flex-1 py-2 text-xs font-bold rounded-xl border transition cursor-pointer ${uploadFormat === 'pipeline' ? 'bg-indigo-600 text-white border-transparent' : 'bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300'}`}
                          >
                            Pipeline Separated
                          </button>
                          <button
                            type="button"
                            onClick={() => setUploadFormat('json')}
                            className={`flex-1 py-2 text-xs font-bold rounded-xl border transition cursor-pointer ${uploadFormat === 'json' ? 'bg-indigo-600 text-white border-transparent' : 'bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300'}`}
                          >
                            JSON Array
                          </button>
                        </div>
                      </div>

                      <div>
                        <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1.5 font-mono text-left">Questions Input / প্রশ্নের কন্টেন্ট</label>
                        <textarea
                          value={bulkInput}
                          onChange={e => setBulkInput(e.target.value)}
                          rows={4}
                          placeholder={
                            uploadFormat === 'pipeline' 
                              ? "রবীন্দ্রনাথের নোবেল পুরস্কার?|১৯১০|১৯১১|১৯১২|১৯১৩|D| গীতাঞ্জলির জন্য ১৯১৩ সালে নোবেল পান।" 
                              : '[\n  {\n    "questionText": "রবীন্দ্রনাথের নোবেল পুরস্কার?",\n    "optionA": "১৯১০",\n    "optionB": "১৯১১",\n    "optionC": "১৯১২",\n    "optionD": "১৯১৩",\n    "correctOption": "D",\n    "hint": "গীতাঞ্জলির জন্য ১৯১৩ সালে নোবেল পান।"\n  }\n]'
                          }
                          className="w-[#100%] px-4 py-3 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-slate-800 dark:text-white placeholder-slate-400 font-mono text-xs focus:outline-none focus:ring-2 focus:ring-indigo-500 h-28"
                        />
                      </div>
                      
                      <div className="p-3.5 bg-indigo-50/40 dark:bg-indigo-950/20 border border-indigo-500/10 rounded-xl text-[11.5px] text-indigo-700 dark:text-indigo-300 leading-relaxed font-bengali">
                        {uploadFormat === 'pipeline' ? (
                          <>
                            💡 <strong className="font-bold">পাইপলাইন (|) স্যাম্পল:</strong><br />
                            প্রশ্ন | অপশন A | অপশন B | অপশন C | অপশন D | সঠিক (A/B/C/D) | ব্যাখ্যা
                          </>
                        ) : (
                          <>
                            💡 <strong className="font-bold">JSON স্যাম্পল:</strong> একটি array of objects দিন। প্রতিটি অবজেক্টে questionText, optionA, optionB, optionC, optionD, correctOption, hint থাকতে হবে।
                          </>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              )}

              <div className="mt-6 pt-4 border-t border-slate-100 dark:border-slate-700 flex gap-3 justify-end">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="px-5 py-2.5 rounded-xl font-bold text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors cursor-pointer"
                >
                  বাতিল
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  className="px-5 py-2.5 rounded-xl font-bold bg-indigo-600 text-white hover:bg-indigo-700 shadow-md transition-colors disabled:opacity-50 cursor-pointer"
                >
                  {saving ? 'যোগ হচ্ছে...' : 'কন্টেন্ট যোগ করুন'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
