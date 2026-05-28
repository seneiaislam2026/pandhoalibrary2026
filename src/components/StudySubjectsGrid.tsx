import React from 'react';
import { Search, Paperclip, ArrowLeft } from 'lucide-react';
import { motion } from 'motion/react';

interface CountedSubject {
  key: string;
  name: string;
  icon: string;
  count: number;
  gradient: string;
  textColor: string;
  borderColor: string;
}

interface StudySubjectsGridProps {
  countedSubjects: CountedSubject[];
  onSelectSubject: (key: string) => void;
  subjectSearch: string;
  setSubjectSearch: (val: string) => void;
  getCategoryName: string;
  onChangeClass: () => void;
}

export default function StudySubjectsGrid({
  countedSubjects,
  onSelectSubject,
  subjectSearch,
  setSubjectSearch,
  getCategoryName,
  onChangeClass
}: StudySubjectsGridProps) {
  
  const filteredGrid = countedSubjects.filter(sub => {
    return sub.name.toLowerCase().includes(subjectSearch.toLowerCase());
  });

  return (
    <div className="space-y-6">
      {/* Header and Back navigation */}
      <div className="flex flex-col sm:flex-row gap-4 items-start sm:items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-5">
        <div>
          <span className="text-[10px] uppercase font-black tracking-widest text-indigo-500 font-sans block">পড়ালেখা ও কুইজ পোর্টাল</span>
          <h2 className="text-xl sm:text-2xl font-black text-slate-800 dark:text-slate-100 leading-tight">
            📚 {getCategoryName}
          </h2>
        </div>
        <button
          onClick={onChangeClass}
          className="inline-flex items-center gap-1.5 px-4 py-2 bg-indigo-50 hover:bg-indigo-100 dark:bg-[#1a1c24] dark:hover:bg-slate-900 border border-indigo-100 dark:border-slate-800 text-indigo-700 dark:text-indigo-400 font-black rounded-xl text-xs transition active:scale-95 cursor-pointer shadow-sm"
        >
          <ArrowLeft className="w-3.5 h-3.5" /> অন্য শ্রেণী নির্বাচন করুন
        </button>
      </div>

      {/* Search Input bar */}
      <div className="bg-white dark:bg-slate-800 p-4 border border-slate-200 dark:border-slate-700/60 rounded-2xl flex items-center gap-3 shadow-inner">
        <Search className="w-5 h-5 text-slate-400 shrink-0" />
        <input 
          type="text" 
          placeholder="নির্দিষ্ট বিষয় খুঁজুন (যেমন: বিজ্ঞান, গণিত...)"
          value={subjectSearch}
          onChange={(e) => setSubjectSearch(e.target.value)}
          className="w-full bg-transparent focus:outline-none text-slate-700 dark:text-slate-100 text-sm font-bold placeholder-slate-400"
        />
      </div>

      {/* Subjects Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
        {filteredGrid.map((sub, idx) => {
          return (
            <motion.div
              layout
              key={sub.key}
              whileHover={{ scale: 1.025, y: -4 }}
              whileTap={{ scale: 0.98 }}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: idx * 0.04 }}
              onClick={() => onSelectSubject(sub.key)}
              className={`relative overflow-hidden cursor-pointer rounded-[2rem] border ${sub.borderColor} p-6 shadow-sm transition-all bg-white dark:bg-slate-800/90 flex flex-col justify-between h-44`}
            >
              {/* Massive ambient decorative background icon */}
              <div className="absolute -bottom-6 -right-6 select-none opacity-[0.04] text-[8rem] font-black leading-none transform -rotate-12">
                {sub.icon}
              </div>

              {/* Top Details row */}
              <div className="flex justify-between items-start relative z-10 w-full mb-4">
                {/* Dynamic File counts badge stylized exactly like image_2 */}
                <div className={`inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-full text-xs font-black bg-slate-50 dark:bg-slate-900 border border-slate-100 dark:border-slate-800 text-slate-500 shadow-sm`}>
                  <Paperclip className="w-3.5 h-3.5 text-indigo-500 pointer-events-none" />
                  <span>{sub.count}</span>
                </div>

                {/* Floating graphic element color block */}
                <div className={`w-10 h-10 rounded-2xl bg-gradient-to-tr ${sub.gradient} flex items-center justify-center text-white text-lg font-bold shadow-md`}>
                  {sub.icon}
                </div>
              </div>

              {/* Bottom Subject Title */}
              <div className="relative z-10 mt-auto">
                <h3 className={`font-black text-lg sm:text-xl font-bengali leading-snug tracking-normal text-slate-800 dark:text-slate-100`}>
                  {sub.name}
                </h3>
                <p className="text-[11px] text-slate-400 dark:text-slate-500 font-extrabold mt-1">ক্লিক করুন উপকরণ দেখতে →</p>
              </div>
            </motion.div>
          );
        })}
      </div>
    </div>
  );
}
