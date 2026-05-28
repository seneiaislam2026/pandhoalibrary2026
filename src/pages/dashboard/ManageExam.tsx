import React, { useEffect, useState } from 'react';
import { useAuth } from '../../store/AuthContext';
import { 
  FileText, 
  Plus, 
  Trash2, 
  Pencil, 
  X, 
  AlertCircle, 
  Check, 
  Sparkles, 
  HelpCircle, 
  Search,
  Eye,
  EyeOff,
  Upload,
  ClipboardList,
  Printer,
  Share2,
  Award
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  collection, 
  getDocs, 
  doc, 
  setDoc, 
  addDoc, 
  deleteDoc, 
  serverTimestamp,
  updateDoc
} from 'firebase/firestore';
import { db } from '../../lib/firebase';
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
  active: boolean;
  setId?: string;
  createdAt?: any;
}

const SEED_QUESTIONS = [
  {
    questionText: "'সততার পুরস্কার' গল্পে দ্বিতীয় ব্যক্তিটি আল্লাহর দূতের কাছে কী চেয়েছিলেন?",
    optionA: "প্রচুর অর্থ led",
    optionB: "একটি উট",
    optionC: "একটি গাভী",
    optionD: "একটি ছাগল",
    correctOption: 'C',
    hint: "আল্লাহর দূত দ্বিতীয় ব্যক্তিকে পরীক্ষায় উত্তীর্ণ হওয়ার পর একটি বরকতময় গাভী উপহার দিয়েছিলেন।",
    active: true
  },
  {
    questionText: "বাংলা সাহিত্যের প্রথম সার্থক উপন্যাস কোনটি?",
    optionA: "কপালকুণ্ডলা",
    optionB: "দুর্গেশনন্দিনী",
    optionC: "বিষবৃক্ষ",
    optionD: "চোখের বালি",
    correctOption: 'B',
    hint: "১৮৬৫ সালে প্রকাশিত বঙ্কিমচন্দ্র চট্টোপাধ্যায় রচিত 'দুর্গেশনন্দিনী' বাংলা সাহিত্যের প্রথম সার্থক উপন্যাস।",
    active: true
  },
  {
    questionText: "'গীতাঞ্জলি' কাব্যগ্রন্থের জন্য রবীন্দ্রনাথ ঠাকুর কত সালে নোবেল পুরস্কার লাভ করেন?",
    optionA: "১৯১০",
    optionB: "১৯১৩",
    optionC: "১৯১৫",
    optionD: "১৯২০",
    correctOption: 'B',
    hint: "রবীন্দ্রনাথ ঠাকুর ১৯১৩ সালে এশীয়দের মধ্যে সর্বপ্রথম সাহিত্যে নোবেল পুরস্কার লাভ করেন।",
    active: true
  },
  {
    questionText: "কাজী নজরুল ইসলামের প্রথম প্রকাশিত কাব্যগ্রন্থ কোনটি?",
    optionA: "অগ্নিবীণা",
    optionB: "বিষের বাঁশী",
    optionC: "সাম্যবাদী",
    optionD: "সর্বহারা",
    correctOption: 'A',
    hint: "১৯২২ সালে প্রকাশিত 'অগ্নিবীণা' কাজী নজরুল ইসলামের প্রথম যুগান্তকারী কাব্যগ্রন্থ।",
    active: true
  },
  {
    questionText: "জীবনানন্দ দাশের বিখ্যাত কবিতা 'বনলতা সেন' চরিত্রটি কোন অঞ্চলের পটভূমিতে চিত্রিত?",
    optionA: "ঢাকা",
    optionB: "বরিশাল",
    optionC: "নাটোর",
    optionD: "রাজশাহী",
    correctOption: 'C',
    hint: "নাটোরের বনলতা সেন জীবনানন্দ দাশের অন্যতম কালজয়ী রোমান্টিক কবিতা।",
    active: true
  }
];

export const CATEGORY_LABELS: Record<string, string> = {
  'class-6': '৬ষ্ঠ শ্রেণী',
  'class-7': '৭ম শ্রেণী',
  'class-8': '৮ম শ্রেণী',
  'class-9': '৯ম শ্রেণী',
  'class-10': '১০ম শ্রেণী',
  'class-11': '১১শ শ্রেণী',
  'class-12': '১২শ শ্রেণী',
  'ssc-dakhil': 'এসএসসি / দাখিল',
  'hsc-alim': 'এইচএসসি / আলিম',
  'class-6-8': '৬ষ্ঠ-৮ম শ্রেণী',
  'class-9-10': '৯ম-১০ম শ্রেণী',
  'class-11-12': '১১শ-১২শ শ্রেণী',
  'general': 'সাধারণ কুইজ / অন্যান্য'
};

export const getCategoryLabel = (cat: string) => CATEGORY_LABELS[cat] || cat || 'সাধারণ কুইজ';

export default function ManageExam() {
  const { user } = useAuth();
  const [questions, setQuestions] = useState<Question[]>([]);
  const [quizSets, setQuizSets] = useState<any[]>([]);
  const [selectedQuizSetFilter, setSelectedQuizSetFilter] = useState<string>('all');
  const [shareSetId, setShareSetId] = useState<string>('');
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');

  // Participant results state
  const [attempts, setAttempts] = useState<any[]>([]);
  const [loadingAttempts, setLoadingAttempts] = useState(false);
  const [selectedLeaderboardFilter, setSelectedLeaderboardFilter] = useState<string>('all');
  const [leaderboardSearch, setLeaderboardSearch] = useState<string>('');
  const [printMode, setPrintMode] = useState<'questions' | 'leaderboard'>('questions');

  // Print & PDF Setup State
  const [showPrintSetupModal, setShowPrintSetupModal] = useState(false);
  const [printTitle, setPrintTitle] = useState('কুইজ ও মেধা পরীক্ষা - প্রশ্নমালা');
  const [printIncludeStudentHeader, setPrintIncludeStudentHeader] = useState(true);
  const [printIncludeAnswers, setPrintIncludeAnswers] = useState(true);
  const [printIncludeExplanations, setPrintIncludeExplanations] = useState(true);

  // New Quiz Set Quick Creator State
  const [showCreateSetModal, setShowCreateSetModal] = useState(false);
  const [newSetName, setNewSetName] = useState('');
  const [newSetTitle, setNewSetTitle] = useState('');
  const [newSetCategory, setNewSetCategory] = useState('class-6');
  const [creatingSet, setCreatingSet] = useState(false);
  
  // Modals inside component
  const [showAddModal, setShowAddModal] = useState(false);
  const [showBulkModal, setShowBulkModal] = useState(false);
  const [editingQuestion, setEditingQuestion] = useState<Question | null>(null);

  // Bulk State
  const [bulkInputText, setBulkInputText] = useState('');
  const [bulkFormat, setBulkFormat] = useState<'json' | 'delimiter'>('delimiter');
  const [bulkUploading, setBulkUploading] = useState(false);
  const [bulkSetId, setBulkSetId] = useState('');

  const handlePrintSet = (setId: string, withAnswers: boolean, overrideHeader?: boolean, overrideExplanations?: boolean) => {
    setSelectedQuizSetFilter(setId ? setId : 'unassigned');
    setSearchQuery('');
    setPrintMode('questions');

    const activeSetId = setId || selectedQuizSetFilter || '';
    const activeQuestions = questions.filter(q => {
      if (activeSetId === 'unassigned' || !activeSetId) {
        if (q.setId) return false;
      } else if (activeSetId !== 'all') {
        if (q.setId !== activeSetId) return false;
      }
      return true;
    });

    const activeSet = quizSets.find(qs => qs.id === activeSetId);
    let resolvedTitle = '';
    if (activeSet) {
      resolvedTitle = withAnswers 
        ? `${activeSet.title} - কুইজ উত্তর ও সলিউশন`
        : `${activeSet.title} - কুইজ পরীক্ষা`;
    } else {
      resolvedTitle = withAnswers 
        ? 'সাধারণ জ্ঞান ও অন্যান্য কুইজ - উত্তর ও সলিউশন'
        : 'সাধারণ জ্ঞান ও অন্যান্য কুইজ - প্রশ্নমালা';
    }

    const includeHeader = withAnswers ? false : (overrideHeader !== undefined ? overrideHeader : printIncludeStudentHeader);
    const includeExplanations = overrideExplanations !== undefined ? overrideExplanations : printIncludeExplanations;

    const getBanglaDuration = (numQuestions: number) => {
      const totalSeconds = numQuestions * 45;
      const minutes = Math.floor(totalSeconds / 60);
      const seconds = totalSeconds % 60;
      
      const toBanglaDigits = (num: number) => {
        const banglaDigits = ['০', '১', '২', '৩', '৪', '৫', '৬', '৭', '৮', '৯'];
        return num.toString().split('').map(digit => banglaDigits[parseInt(digit)] || digit).join('');
      };
      
      let result = '';
      if (minutes > 0) {
        result += `${toBanglaDigits(minutes)} মিনিট `;
      }
      if (seconds > 0 || minutes === 0) {
        result += `${toBanglaDigits(seconds)} সেকেন্ড`;
      }
      return result.trim();
    };

    const printWindow = window.open('', '_blank');
    if (!printWindow) {
      toast.error('উইন্ডো ওপেন করা সম্ভব হয়নি। দয়া করে পপআপ ব্লকার চেক করুন।');
      return;
    }

    toast.success('প্রিন্ট ও পিডিএফ ফাইল তৈরি হচ্ছে, অনুগ্রহ করে অপেক্ষা করুন...', { duration: 1500 });

    const qListHtml = activeQuestions.map((q, idx) => `
      <div class="question-item">
          <div class="question-text">
              <span>${idx + 1}.</span>
              <span>${q.questionText}</span>
          </div>
          <div class="options-grid">
              <div><span class="option-letter">A)</span>${q.optionA}</div>
              <div><span class="option-letter">B)</span>${q.optionB}</div>
              <div><span class="option-letter">C)</span>${q.optionC}</div>
              <div><span class="option-letter">D)</span>${q.optionD}</div>
          </div>
          ${withAnswers ? `
          <div class="answer-block">
              <p style="margin: 0; font-weight: bold;">
                  <span class="ans-badge">ANS: ${q.correctOption}</span>
                  সঠিক উত্তর: ${q.correctOption === 'A' ? q.optionA : q.correctOption === 'B' ? q.optionB : q.correctOption === 'C' ? q.optionC : q.optionD}
              </p>
              ${includeExplanations && q.hint ? `<p style="margin: 4px 0 0 0; color: #475569; font-size: 12px;"><strong>ব্যাখ্যা:</strong> ${q.hint}</p>` : ''}
          </div>` : ''}
      </div>`).join('');

    printWindow.document.write(`
    <!DOCTYPE html>
    <html lang="bn">
    <head>
        <meta charset="UTF-8">
        <title>${resolvedTitle}</title>
        <link href="https://fonts.googleapis.com/css2?family=Hind+Siliguri:wght@400;500;600;700&family=Noto+Serif+Bengali:wght@400;600;700;800&display=swap" rel="stylesheet">
        <style>
            :root {
                --primary: #4f46e5;
            }
            body {
                font-family: 'Hind Siliguri', 'Noto Serif Bengali', sans-serif;
                background: white !important;
                color: black !important;
                padding: 40px;
                margin: 0;
                font-size: 14px;
                line-height: 1.5;
            }
            .text-center { text-align: center; }
            .border-b-double { border-bottom: 4px double #1e293b; }
            .pb-4 { padding-bottom: 16px; }
            .mb-6 { margin-bottom: 24px; }
            .mt-1 { margin-top: 4px; }
            .mt-3 { margin-top: 12px; }
            .px-4 { padding-left: 16px; padding-right: 16px; }
            .flex { display: flex; }
            .justify-between { justify-content: space-between; }
            .items-center { align-items: center; }
            .text-xs { font-size: 12px; }
            .text-style { color: #475569; font-weight: bold; }
            .font-sans { font-family: sans-serif; }
            .font-bold { font-weight: bold; }
            .text-2xl { font-size: 26px; font-weight: 800; color: #0f172a; margin: 0; }
            .text-lg { font-size: 18px; font-weight: 700; color: #1e293b; margin: 5px 0 0 0; }
            
            .student-header {
                display: grid;
                grid-template-columns: 1fr 1fr;
                row-gap: 16px;
                column-gap: 24px;
                padding: 16px;
                border: 2px solid #111827;
                border-radius: 12px;
                margin-bottom: 32px;
                font-weight: bold;
                font-size: 13px;
                background-color: #f8fafc;
            }
            .question-item {
                page-break-inside: avoid;
                padding-bottom: 16px;
                border-bottom: 1px dashed #94a3b8;
                margin-bottom: 20px;
            }
            .question-text {
                display: flex;
                align-items: start;
                gap: 8px;
                font-size: 16px;
                font-weight: 700;
                color: #0f172a;
                margin-bottom: 12px;
            }
            .options-grid {
                display: grid;
                grid-template-columns: 1fr 1fr;
                row-gap: 8px;
                column-gap: 32px;
                padding-left: 20px;
                margin-bottom: 12px;
                font-size: 14.5px;
            }
            .option-letter {
                font-weight: bold;
                color: #4f46e5;
                margin-right: 8px;
            }
            .answer-block {
                padding: 10px 16px;
                border-left: 4px solid #10b981;
                background-color: #f0fdf4;
                border-radius: 0 10px 10px 0;
                font-size: 13.5px;
                margin-top: 10px;
            }
            .ans-badge {
                background: #d1fae5;
                color: #065f46;
                padding: 3px 8px;
                border-radius: 4px;
                font-size: 11px;
                margin-right: 8px;
                font-family: sans-serif;
            }
            .no-print-area {
                position: fixed;
                top: 20px;
                right: 20px;
                z-index: 10000;
            }
            .print-btn {
                background-color: #4f46e5;
                color: white;
                border: none;
                padding: 12px 24px;
                border-radius: 12px;
                font-weight: bold;
                cursor: pointer;
                box-shadow: 0 4px 6px rgba(0,0,0,0.15);
                font-size: 14px;
                font-family: 'Hind Siliguri', sans-serif;
            }
            .print-btn:hover { background-color: #4338ca; }
            @media print {
                .no-print-area { display: none !important; }
                body { padding: 0; margin: 0; }
            }
        </style>
    </head>
    <body onload="setTimeout(function(){ window.print(); }, 800)">
        <div class="no-print-area">
            <button onclick="window.print()" class="print-btn">🖨️ সরাসরি প্রিন্ট করুন</button>
        </div>
        <div class="text-center border-b-double pb-4 mb-6">
            <h1 class="text-2xl">পানধোয়া উন্মুক্ত পাঠাগার</h1>
            <h2 class="text-lg">${resolvedTitle}</h2>
            <div class="flex justify-between items-center text-xs text-style mt-3 px-4">
                <span>প্রিন্ট তারিখ: ${new Date().toLocaleDateString('bn-BD', { year: 'numeric', month: 'long', day: 'numeric' })}</span>
                ${activeQuestions.length > 0 && !withAnswers ? `<span>সময়: ${getBanglaDuration(activeQuestions.length)} (প্রতি প্রশ্নে ৪৫ সেকেন্ড)</span>` : ''}
                <span>মোট প্রশ্ন: ${activeQuestions.length} টি</span>
            </div>
        </div>
        
        ${includeHeader ? `
        <div class="student-header">
            <div>পরীক্ষার্থীর নাম: ..............................................................</div>
            <div>শ্রেণি: .......................................................................</div>
            <div>রোল নম্বর: ...................................................................</div>
            <div>প্রাপ্ত নম্বর: .......................................... / ${activeQuestions.length} টি</div>
        </div>` : ''}

        <div>
            ${qListHtml}
        </div>
    </body>
    </html>
    `);
    printWindow.document.close();
  };

  const handlePrintLeaderboard = () => {
    const printWindow = window.open('', '_blank');
    if (!printWindow) {
      toast.error('উইন্ডো ওপেন করা সম্ভব হয়নি। দয়া করে পপআপ ব্লকার চেক করুন।');
      return;
    }

    toast.success('মেধাতালিকা প্রিন্ট কপি রেডি হচ্ছে, অনুগ্রহ করে অপেক্ষা করুন...');

    const filteredAttempts = attempts.filter(item => {
      const matchesSearch = item.userName?.toLowerCase().includes(leaderboardSearch.toLowerCase());
      if (selectedLeaderboardFilter !== 'all') {
        return matchesSearch && item.setId === selectedLeaderboardFilter;
      }
      return matchesSearch;
    });

    const rowsHtml = filteredAttempts.map((item, idx) => {
      const matchedSet = quizSets.find(qs => qs.id === item.setId);
      const setName = item.quizTitle || (matchedSet ? matchedSet.title : 'সাধারণ জ্ঞান / অন্যান্য কুইজ');
      return `
        <tr>
          <td>${idx + 1}</td>
          <td class="font-bengali-bold">${item.userName || 'পাবলিক পরীক্ষার্থী'}</td>
          <td class="font-bengali-regular">${setName}</td>
          <td>${item.correctCount ?? (item.score || 0)}/${item.totalQuestions || 30}</td>
          <td class="score-cell">${item.score}</td>
          <td>${item.percentage}%</td>
        </tr>
      `;
    }).join('');

    printWindow.document.write(`
    <!DOCTYPE html>
    <html lang="bn">
    <head>
        <meta charset="UTF-8">
        <title>পরীক্ষায় অংশগ্রহণকারীদের ফলাফল ও মেধা তালিকা</title>
        <link href="https://fonts.googleapis.com/css2?family=Hind+Siliguri:wght@400;500;600;700&family=Noto+Serif+Bengali:wght@400;600;700;800&display=swap" rel="stylesheet">
        <style>
            body {
                font-family: 'Hind Siliguri', 'Noto Serif Bengali', sans-serif;
                background: white !important;
                color: black !important;
                padding: 40px;
                margin: 0;
                font-size: 14px;
                line-height: 1.5;
            }
            .text-center { text-align: center; }
            .border-b-double { border-bottom: 4px double #1e293b; }
            .pb-4 { padding-bottom: 16px; }
            .mb-6 { margin-bottom: 24px; }
            .text-2xl { font-size: 26px; font-weight: 800; color: #0f172a; margin: 0; }
            .text-lg { font-size: 18px; font-weight: 700; color: #1e293b; margin: 5px 0 0 0; }
            .text-xs { font-size: 12px; color: #475569; font-weight: bold; }
            
            table {
                width: 100%;
                border-collapse: collapse;
                margin-top: 24px;
                font-size: 13.5px;
            }
            th, td {
                border: 1px solid #1e293b;
                padding: 10px 12px;
                text-align: left;
            }
            th {
                background-color: #f1f5f9;
                font-weight: bold;
                font-size: 14px;
            }
            td {
                font-weight: 500;
            }
            .score-cell {
                font-weight: bold;
                color: #4f46e5;
            }
            .signature-section {
                display: flex;
                justify-content: space-between;
                margin-top: 80px;
                font-size: 13px;
                font-weight: bold;
            }
            .signature-box {
                width: 45%;
                border-top: 1px dashed #1e293b;
                text-align: center;
                padding-top: 10px;
            }
            .font-bengali-bold { font-weight: 700; }
            .font-bengali-regular { font-weight: 500; color: #334155; }
            .no-print-area {
                position: fixed;
                top: 20px;
                right: 20px;
                z-index: 10000;
            }
            .print-btn {
                background-color: #4f46e5;
                color: white;
                border: none;
                padding: 12px 24px;
                border-radius: 12px;
                font-weight: bold;
                cursor: pointer;
                box-shadow: 0 4px 6px rgba(0,0,0,0.15);
                font-size: 14px;
                font-family: 'Hind Siliguri', sans-serif;
            }
            .print-btn:hover { background-color: #4338ca; }
            @media print {
                .no-print-area { display: none !important; }
                body { padding: 0; margin: 0; }
            }
        </style>
    </head>
    <body onload="setTimeout(function(){ window.print(); }, 800)">
        <div class="no-print-area">
            <button onclick="window.print()" class="print-btn">🖨️ সরাসরি প্রিন্ট করুন</button>
        </div>
        <div class="text-center border-b-double pb-4 mb-6">
            <h1 class="text-2xl">পানধোয়া উন্মুক্ত পাঠাগার</h1>
            <h2 class="text-lg">পরীক্ষায় অংশগ্রহণকারীদের ফলাফল বিবরণী ও মেধা তালিকা</h2>
            <p class="text-xs">তারিখ: ${new Date().toLocaleDateString('bn-BD', { year: 'numeric', month: 'long', day: 'numeric' })}</p>
        </div>

        <table>
            <thead>
                <tr>
                    <th style="width: 80px;">মেধাক্রম</th>
                    <th>পরীক্ষার্থীর নাম</th>
                    <th>বিষয় / কুইজ সেট</th>
                    <th>সঠিক উত্তর</th>
                    <th>প্রাপ্ত স্কোর</th>
                    <th>সফলতার হার</th>
                </tr>
            </thead>
            <tbody>
                ${rowsHtml || '<tr><td colspan="6" class="text-center">কোনো রেকর্ড পাওয়া যায়নি</td></tr>'}
            </tbody>
        </table>

        <div class="signature-section">
            <div style="text-align: center; width: 45%; border-top: 1px dashed #1e293b; padding-top: 10px;">
                পরীক্ষা নিয়ন্ত্রক / বিচারকের স্বাক্ষর
            </div>
            <div style="text-align: center; width: 45%; border-top: 1px dashed #1e293b; padding-top: 10px;">
                অনুমোদনকারী স্বাক্ষর ও সিল
            </div>
        </div>
    </body>
    </html>
    `);
    printWindow.document.close();
  };

  // Form State
  const [formData, setFormData] = useState({
    questionText: '',
    optionA: '',
    optionB: '',
    optionC: '',
    optionD: '',
    correctOption: 'A' as 'A' | 'B' | 'C' | 'D',
    hint: '',
    setId: '',
    active: true
  });

  const handleBulkSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!bulkInputText.trim()) {
      toast.error('ট্যাক্সট এরিয়া ফাঁকা রাখা যাবে না');
      return;
    }

    setBulkUploading(true);
    try {
      let parsedList: any[] = [];

      if (bulkFormat === 'json') {
        try {
          parsedList = JSON.parse(bulkInputText);
          if (!Array.isArray(parsedList)) {
            throw new Error('অবশ্যই একটি JSON Array হতে হবে।');
          }
        } catch (jsonErr: any) {
          toast.error(`JSON ভুল আছে: ${jsonErr.message}`);
          setBulkUploading(false);
          return;
        }
      } else {
        const lines = bulkInputText.split('\n');
        for (const line of lines) {
          if (!line.trim()) continue;
          const parts = line.split('|');
          if (parts.length < 5) {
            toast.error(`ভুল ফরম্যাট (কমপক্ষে ৫টি খণ্ড থাকতে হবে, যেমন: প্রশ্ন | ক | খ | গ | ঘ | সঠিক): ${line.substring(0, 30)}...`);
            setBulkUploading(false);
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
            setBulkUploading(false);
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

      if (parsedList.length === 0) {
        toast.error('কোনো বৈধ প্রশ্ন পাওয়া যায়নি');
        setBulkUploading(false);
        return;
      }

      if (parsedList.length > 30) {
        toast.error(`একত্রে সর্বোচ্চ ৩০টি প্রশ্ন আপলোড করা সম্ভব। আপনার দেওয়া লিস্টে ${parsedList.length}টি প্রশ্ন রয়েছে।`);
        setBulkUploading(false);
        return;
      }

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
          setId: bulkSetId || '',
          createdAt: serverTimestamp()
        });
      }

      toast.success(`${parsedList.length}টি প্রশ্ন সফলভাবে আপলোড করা হয়েছে!`);
      setBulkInputText('');
      setBulkSetId('');
      setShowBulkModal(false);
      fetchQuestions();
    } catch (err) {
      console.error(err);
      toast.error('প্রশ্ন আপলোড করতে সমস্যা হয়েছে।');
    } finally {
      setBulkUploading(false);
    }
  };

  const fetchQuestions = async () => {
    setLoading(true);
    try {
      const colRef = collection(db, 'quiz-questions');
      const snapshot = await getDocs(colRef);
      const list: Question[] = [];
      snapshot.forEach((doc) => {
        list.push({ id: doc.id, ...doc.data() } as Question);
      });
      setQuestions(list);

      const setsSnap = await getDocs(collection(db, 'study_practice_contents'));
      const sList: any[] = [];
      setsSnap.forEach((doc) => {
        const data = doc.data();
        if (data.type === 'quiz' || data.type === 'question_bank') {
          sList.push({ id: doc.id, ...data });
        }
      });
      setQuizSets(sList);
    } catch (err) {
      console.error("Error fetching questions and sets:", err);
      toast.error("প্রশ্নগুলো ডাউনলোড করতে সমস্যা হয়েছে।");
    } finally {
      setLoading(false);
    }
  };

  const fetchAttempts = async () => {
    setLoadingAttempts(true);
    try {
      const qSnapshot = await getDocs(collection(db, 'quiz-attempts'));
      const list: any[] = [];
      qSnapshot.forEach((doc) => {
        list.push({ id: doc.id, ...doc.data() });
      });
      list.sort((a, b) => {
        if (b.percentage !== a.percentage) {
          return b.percentage - a.percentage;
        }
        if (b.score !== a.score) {
          return b.score - a.score;
        }
        return new Date(b.date || 0).getTime() - new Date(a.date || 0).getTime();
      });
      setAttempts(list);
    } catch (err) {
      console.error("Error loading attempts for admin:", err);
    } finally {
      setLoadingAttempts(false);
    }
  };

  const handleDeleteAttempt = async (attemptId: string) => {
    if (!window.confirm("আপনি কি নিশ্চিতভাবে এই পরীক্ষার্থীর রেকর্ডটি মুছে ফেলতে চান? এটি স্থায়ীভাবে ডিলিট হয়ে যাবে।")) return;
    try {
      await deleteDoc(doc(db, 'quiz-attempts', attemptId));
      toast.success("রেকর্ডটি সফলভাবে মুছে ফেলা হয়েছে।");
      fetchAttempts();
    } catch (err) {
      console.error("Error deleting attempt:", err);
      toast.error("ফলাফল রেকর্ড মুছে ফেলা যায়নি।");
    }
  };

  const handleDeleteSet = async (setId: string, setTitle: string) => {
    if (!window.confirm(`আপনি কি নিশ্চিতভাবে "${setTitle}" কুইজ সেটটি মুছে ফেলতে চান?\nএতে থাকা প্রশ্নগুলো মুছে যাবে না, সেগুলো সাধারণ প্রশ্নাবলি (Unassigned) হিসেবে থেকে যাবে।`)) return;
    
    try {
      await deleteDoc(doc(db, 'study_practice_contents', setId));
      
      const setQuestions = questions.filter(q => q.setId === setId);
      for (const q of setQuestions) {
        await updateDoc(doc(db, 'quiz-questions', q.id), {
          setId: ''
        });
      }
      
      toast.success("কুইজ সেটটি সফলভাবে মুছে ফেলা হয়েছে এবং এর প্রশ্নগুলো সাধারণ প্রশ্নাবলিতে স্থানান্তরিত করা হয়েছে।");
      fetchQuestions();
    } catch (err) {
      console.error("Error deleting quiz set:", err);
      toast.error("কুইজ সেটটি মুছে ফেলা যায়নি।");
    }
  };

  useEffect(() => {
    fetchQuestions();
    fetchAttempts();
  }, []);

  const handleCreateSet = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newSetName.trim()) {
      toast.error('সেটের নাম অবশ্যই দিতে হবে');
      return;
    }

    setCreatingSet(true);
    const toastId = toast.loading('নতুন সেট তৈরি হচ্ছে...');
    try {
      const displayTitle = newSetTitle.trim() 
        ? `${newSetTitle.trim()} : ${newSetName.trim()}` 
        : newSetName.trim();

      const docRef = await addDoc(collection(db, 'study_practice_contents'), {
        title: displayTitle,
        quizTitle: newSetTitle.trim() || null,
        setName: newSetName.trim(),
        type: 'quiz',
        targetCategory: newSetCategory,
        link: '',
        createdAt: serverTimestamp()
      });

      toast.success('কুইজ সেটটি সফলভাবে তৈরি হয়েছে!', { id: toastId });
      setNewSetName('');
      setNewSetTitle('');
      setShowCreateSetModal(false);
      
      setFormData(prev => ({ ...prev, setId: docRef.id }));
      setBulkSetId(docRef.id);
      setShareSetId(docRef.id);
      
      await fetchQuestions();
    } catch (err) {
      console.error("Error creating quiz set:", err);
      toast.error('কুইজ সেট তৈরি করতে সমস্যা হয়েছে।');
    } finally {
      setCreatingSet(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.questionText.trim() || !formData.optionA.trim() || !formData.optionB.trim() || !formData.optionC.trim() || !formData.optionD.trim()) {
      toast.error('সবগুলো অপশন অবশ্যই পূরণ করতে হবে');
      return;
    }

    const toastId = toast.loading(editingQuestion ? 'প্রশ্ন পরিবর্তন সংরক্ষণ করা হচ্ছে...' : 'নতুন প্রশ্ন যোগ করা হচ্ছে...');
    try {
      const qData = {
        questionText: formData.questionText.trim(),
        optionA: formData.optionA.trim(),
        optionB: formData.optionB.trim(),
        optionC: formData.optionC.trim(),
        optionD: formData.optionD.trim(),
        correctOption: formData.correctOption,
        hint: formData.hint.trim(),
        setId: formData.setId || '',
        active: formData.active,
        updatedAt: serverTimestamp()
      };

      if (editingQuestion) {
        await setDoc(doc(db, 'quiz-questions', editingQuestion.id), {
          ...qData,
          createdAt: editingQuestion.createdAt || serverTimestamp()
        }, { merge: true });
        toast.success('প্রশ্নটি সফলভাবে সম্পাদিত হয়েছে!', { id: toastId });
      } else {
        await addDoc(collection(db, 'quiz-questions'), {
          ...qData,
          createdAt: serverTimestamp()
        });
        toast.success('নতুন প্রশ্নটি সফলভাবে যোগ হয়েছে!', { id: toastId });
      }

      setShowAddModal(false);
      setEditingQuestion(null);
      setFormData({
        questionText: '',
        optionA: '',
        optionB: '',
        optionC: '',
        optionD: '',
        correctOption: 'A',
        hint: '',
        setId: '',
        active: true
      });
      fetchQuestions();
    } catch (err) {
      console.error("Error submitting question:", err);
      toast.error('সমস্যা হয়েছে, অনুগ্রহ করে আবার চেষ্টা করুন।', { id: toastId });
    }
  };

  const handleDelete = async (questionId: string) => {
    if (!window.confirm("আপনি কি নিশ্চিতভাবে এই প্রশ্নটি মুছে ফেলতে চান?")) return;
    try {
      await deleteDoc(doc(db, 'quiz-questions', questionId));
      toast.success("প্রশ্নটি মুছে ফেলা হয়েছে।");
      fetchQuestions();
    } catch (err) {
      console.error("Error deleting question:", err);
      toast.error("প্রশ্নটি মুছা যায়নি।");
    }
  };

  const handleOpenEdit = (q: Question) => {
    setEditingQuestion(q);
    setFormData({
      questionText: q.questionText,
      optionA: q.optionA,
      optionB: q.optionB,
      optionC: q.optionC,
      optionD: q.optionD,
      correctOption: q.correctOption,
      hint: q.hint || '',
      setId: q.setId || '',
      active: q.active
    });
    setShowAddModal(true);
  };

  const handleToggleActive = async (q: Question) => {
    try {
      await updateDoc(doc(db, 'quiz-questions', q.id), {
        active: !q.active
      });
      toast.success(q.active ? "প্রশ্নটি নিষ্ক্রিয় করা হয়েছে।" : "প্রশ্নটি সক্রিয় করা হয়েছে।");
      fetchQuestions();
    } catch (err) {
      console.error("Error toggling active state:", err);
      toast.error("স্টেট পরিবর্তন করা যায়নি।");
    }
  };

  const filteredQuestions = questions.filter(q => {
    if (selectedQuizSetFilter === 'unassigned') {
      if (q.setId) return false;
    } else if (selectedQuizSetFilter !== 'all') {
      if (q.setId !== selectedQuizSetFilter) return false;
    }
    
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      return q.questionText.toLowerCase().includes(query) ||
             q.optionA.toLowerCase().includes(query) ||
             q.optionB.toLowerCase().includes(query) ||
             q.optionC.toLowerCase().includes(query) ||
             q.optionD.toLowerCase().includes(query) ||
             (q.hint && q.hint.toLowerCase().includes(query));
    }
    
    return true;
  });

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-900 text-slate-800 dark:text-slate-100 font-sans">
      <style>{`
        @media print {
          body {
            background-color: white !important;
            color: black !important;
          }
          #root {
            background: white !important;
          }
          .no-print, header, nav, aside, footer, button, .cursor-pointer {
            display: none !important;
          }
          .print-sheet {
            display: block !important;
            color: black !important;
            background: white !important;
          }
        }
      `}</style>

      {/* 1. Beautiful printable paper / questions sheet block */}
      <div className="hidden print:block print-sheet p-6 bg-white text-black font-bengali w-full">
        {printMode === 'questions' ? (
          <div>
            <div className="text-center border-b-4 border-double border-slate-800 pb-4 mb-6">
              <h1 className="text-2xl font-black text-slate-900 tracking-wide">পানধোয়া উন্মুক্ত পাঠাগার</h1>
              <h2 className="text-lg font-extrabold text-slate-800 mt-1">
                {printTitle || 'কুইজ ও মেধা পরীক্ষা - প্রশ্নমালা'}
              </h2>
              <div className="flex justify-between items-center text-xs text-slate-600 font-sans mt-3 px-4">
                <span>প্রিন্ট তারিখ: {new Date().toLocaleDateString('bn-BD', { year: 'numeric', month: 'long', day: 'numeric' })}</span>
                <span className="font-bold">মোট প্রশ্ন: {filteredQuestions.length} টি</span>
              </div>
            </div>

            {printIncludeStudentHeader && (
              <div className="grid grid-cols-2 gap-y-4 gap-x-6 p-4 border-2 border-slate-800 rounded-2xl mb-8 text-xs text-slate-900 font-bold bg-slate-50/50">
                <div>পরীক্ষার্থীর নাম: ..............................................................</div>
                <div>শ্রেণি: .......................................................................</div>
                <div>রোল নম্বর: ...................................................................</div>
                <div>প্রাপ্ত নম্বর: .......................................... / {filteredQuestions.length} টি</div>
              </div>
            )}

            <div className="space-y-6">
              {filteredQuestions.map((q, idx) => (
                <div key={q.id || idx} className="break-inside-avoid pb-4 border-b border-dashed border-slate-300">
                  <div className="flex items-start gap-1 font-bold text-slate-900 mb-2">
                    <span className="font-mono text-slate-800 text-sm">{idx + 1}.</span>
                    <span className="text-[15px] sm:text-base leading-relaxed">{q.questionText}</span>
                  </div>
                  
                  <div className="grid grid-cols-2 gap-x-6 gap-y-1.5 pl-5 text-sm text-slate-800 mb-3 font-semibold font-sans">
                    <div><span className="font-mono text-indigo-700 font-bold mr-1.5">A)</span>{q.optionA}</div>
                    <div><span className="font-mono text-indigo-700 font-bold mr-1.5">B)</span>{q.optionB}</div>
                    <div><span className="font-mono text-indigo-700 font-bold mr-1.5">C)</span>{q.optionC}</div>
                    <div><span className="font-mono text-indigo-700 font-bold mr-1.5">D)</span>{q.optionD}</div>
                  </div>
                  
                  {printIncludeAnswers && (
                    <div className="pl-4 border-l-2 border-emerald-500 py-1 bg-slate-50 rounded-r-lg">
                      <p className="text-xs font-bold text-slate-900">
                        <span className="inline-block px-1.5 py-0.5 bg-emerald-100 text-emerald-800 rounded font-mono text-[10px] mr-1.5">ANS: {q.correctOption}</span>
                        সобыতি উত্তর: {q.correctOption === 'A' ? q.optionA : q.correctOption === 'B' ? q.optionB : q.correctOption === 'C' ? q.optionC : q.optionD}
                      </p>
                      {printIncludeExplanations && q.hint && (
                        <p className="text-[11.5px] text-slate-600 mt-1 leading-relaxed">
                          💡 <strong className="font-bold">ব্যাখ্যা:</strong> {q.hint}
                        </p>
                      )}
                    </div>
                  )}

                  {!printIncludeAnswers && printIncludeExplanations && q.hint && (
                    <div className="pl-4 border-l-2 border-slate-400 py-1 bg-slate-50 rounded-r-lg">
                      <p className="text-[11.5px] text-slate-600 leading-relaxed">
                        💡 <strong className="font-bold">ব্যাখ্যা:</strong> {q.hint}
                      </p>
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        ) : (
          <div>
            <div className="text-center border-b-4 border-double border-slate-800 pb-4 mb-6">
              <h1 className="text-2xl font-black text-slate-900 tracking-wide">পানধোয়া উন্মুক্ত পাঠাগার</h1>
              <h2 className="text-lg font-extrabold text-slate-800 mt-1 text-center font-bengali">
                পরীক্ষায় অংশগ্রহণকারীদের ফলাফল বিবরণী ও মেধা তালিকা
              </h2>
              <p className="text-xs text-slate-600 mt-1 font-semibold text-center font-sans">
                তারিখ: {new Date().toLocaleDateString('bn-BD', { year: 'numeric', month: 'long', day: 'numeric' })}
              </p>
            </div>

            <table className="w-full text-xs text-left border-collapse border-2 border-slate-800 font-sans mb-12">
              <thead>
                <tr className="bg-slate-100 text-slate-800 border-b border-slate-800 font-bold font-bengali text-[11px]">
                  <th className="border border-slate-800 px-3 py-2 text-center w-12 border-collapse">মেধাক্রম</th>
                  <th className="border border-slate-800 px-3 py-2 border-collapse">পরীক্ষার্থীর নাম</th>
                  <th className="border border-slate-800 px-3 py-2 border-collapse">বিষয় / কুইজ সেট</th>
                  <th className="border border-slate-800 px-3 py-2 text-center border-collapse">সঠিক উত্তর</th>
                  <th className="border border-slate-800 px-3 py-2 text-center border-collapse">প্রাপ্ত স্কোর</th>
                  <th className="border border-slate-800 px-3 py-2 text-center border-collapse">সফলতার হার</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-400 border-b border-slate-800">
                {attempts.filter(item => {
                  const matchesSearch = item.userName?.toLowerCase().includes(leaderboardSearch.toLowerCase());
                  if (selectedLeaderboardFilter !== 'all') {
                    return matchesSearch && item.setId === selectedLeaderboardFilter;
                  }
                  return matchesSearch;
                }).map((item, idx) => {
                  const matchedSet = quizSets.find(qs => qs.id === item.setId);
                  const setName = item.quizTitle || (matchedSet ? matchedSet.title : 'সাধারণ জ্ঞান / অন্যান্য কুইজ');
                  return (
                    <tr key={item.id || idx} className="text-black text-xs font-semibold font-sans">
                      <td className="border border-slate-800 px-3 py-1.5 text-center font-mono font-bold">{idx + 1}</td>
                      <td className="border border-slate-800 px-3 py-1.5 font-bengali font-bold">{item.userName || 'পাবলিক পরীক্ষার্থী'}</td>
                      <td className="border border-slate-800 px-3 py-1.5 font-bengali text-slate-700">{setName}</td>
                      <td className="border border-slate-800 px-3 py-1.5 text-center font-mono">{item.correctCount ?? (item.score || 0)}/{item.totalQuestions || 30}</td>
                      <td className="border border-slate-800 px-3 py-1.5 text-center font-mono font-bold text-indigo-700">{item.score}</td>
                      <td className="border border-slate-800 px-3 py-1.5 text-center font-mono">{item.percentage}%</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>

            <div className="mt-24 grid grid-cols-2 gap-x-12 text-xs font-bold text-slate-800">
              <div className="text-center pt-4 border-t border-slate-400 font-bengali">
                পরীক্ষা নিয়ন্ত্রক / বিচারকের স্বাক্ষর: .......................................
              </div>
              <div className="text-center pt-4 border-t border-slate-400 font-bengali">
                অনুমোদনকারী স্বাক্ষর ও সিল: .......................................
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Main Administrative Action Workspace Container */}
      <div className="max-w-7xl mx-auto px-4 py-8 no-print">
        {/* Unit 1: Top Header Panel with Creation Buttons */}
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-6 mb-8 border-b border-slate-100 dark:border-slate-800 pb-6 font-bengali">
          <div>
            <h1 className="text-2xl font-black text-slate-800 dark:text-white leading-tight">
              কুইজ ও মেধা পরীক্ষা ব্যবস্থাপনা
            </h1>
            <p className="text-sm text-slate-500 dark:text-slate-400 font-medium mt-1">
              উন্মুক্ত লাইব্রেরির সকল কুইজ প্রশ্ন তৈরি ও রূপান্তর করুন, ক্যাটাগরি ভিত্তিক মেধা সেট সাজান এবং রেজাল্ট ও মেধা শিট প্রিন্ট করুন
            </p>
          </div>

          <div className="flex flex-wrap gap-2.5">
            <button
               onClick={() => {
                 setEditingQuestion(null);
                 setFormData({
                   questionText: '',
                   optionA: '',
                   optionB: '',
                   optionC: '',
                   optionD: '',
                   correctOption: 'A',
                   hint: '',
                   setId: selectedQuizSetFilter !== 'all' && selectedQuizSetFilter !== 'unassigned' ? selectedQuizSetFilter : '',
                   active: true
                 });
                 setShowAddModal(true);
               }}
              className="flex items-center gap-2 px-4.5 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white font-black text-xs sm:text-sm rounded-xl shadow transition active:scale-95 cursor-pointer"
            >
              <Plus className="w-4 h-4 text-white" /> নতুন প্রশ্ন যোগ করুন
            </button>
            <button
              onClick={() => setShowBulkModal(true)}
              className="flex items-center gap-2 px-4.5 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white font-black text-xs sm:text-sm rounded-xl shadow transition active:scale-95 cursor-pointer"
            >
              <Upload className="w-4 h-4 text-white" /> একত্রে প্রশ্ন আপলোড করুন
            </button>
          </div>
        </div>

        {/* Unit 2: Publicly Quiz Share Banner */}
        <div className="bg-gradient-to-br from-emerald-600 to-teal-700 text-white rounded-3xl p-6 md:p-8 mb-8 shadow-lg relative overflow-hidden font-bengali">
          <div className="absolute -right-16 -bottom-16 w-64 h-64 rounded-full bg-white/5 pointer-events-none" />
          <div className="absolute -left-12 -top-12 w-48 h-48 rounded-full bg-white/5 pointer-events-none" />
          
          <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6 relative z-10">
            <div className="flex-1">
              <div className="flex items-center gap-2 mb-2 pb-0.5">
                <span className="bg-white/20 text-[10px] font-black px-2.5 py-0.5 rounded-full uppercase tracking-wider">Public Exam Link</span>
                <span className="w-2 h-2 rounded-full bg-emerald-300 animate-pulse" />
              </div>
              <h2 className="text-lg md:text-xl font-black">পাবলিকলি কুইজ পরীক্ষা শেয়ার করুন</h2>
              <p className="text-xs text-emerald-100/90 font-medium mt-1 leading-relaxed max-w-2xl">
                সদস্য বা সাধারণ ভিজিটরদের জন্য এই উন্মুক্ত লিংকটি শেয়ার করুন। কেউ অ্যাকাউন্ট না খুলেও এই লিংকে সরাসরি ঢুকে কুইজে অংশ নিতে পারবে ও নিজের মেধাযাচাই করতে পারবে।
              </p>

              <div className="mt-4 max-w-md">
                <div className="flex items-center justify-between mb-1.5">
                  <label className="block text-[10px] font-black uppercase tracking-wider text-emerald-200 font-mono">নির্দিষ্ট শ্রেণি বা কুইজ সেট নির্বাচন করুন:</label>
                </div>
                <select
                  value={shareSetId}
                  onChange={(e) => setShareSetId(e.target.value)}
                  className="w-full bg-white/10 hover:bg-white/15 focus:bg-teal-800/80 border border-white/10 rounded-xl px-3 py-2 text-xs font-black text-white focus:outline-none cursor-pointer transition-colors"
                >
                  <option value="" className="text-slate-800 font-bold font-bengali">সকল কুইজ প্রশ্ন বা ব্যাংক (General GK Quiz)</option>
                  {quizSets.map((qs) => (
                    <option key={qs.id} value={qs.id} className="text-slate-800 font-semibold font-bengali">
                      {qs.title} ({getCategoryLabel(qs.targetCategory)})
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div className="flex items-center gap-2 shrink-0 bg-white/10 hover:bg-white/15 border border-white/10 p-2 rounded-2xl w-full lg:w-auto font-sans">
              <input 
                type="text" 
                readOnly 
                value={shareSetId ? `${window.location.origin}/public-exam?setId=${shareSetId}` : `${window.location.origin}/public-exam`} 
                className="bg-transparent border-0 outline-none text-xs font-mono font-bold w-full lg:w-64 text-emerald-100 select-all px-2"
              />
              <button 
                onClick={() => {
                  const finalUrl = shareSetId ? `${window.location.origin}/public-exam?setId=${shareSetId}` : `${window.location.origin}/public-exam`;
                  navigator.clipboard.writeText(finalUrl);
                  toast.success('পাবলিক পরীক্ষা লিংকটি ক্লিপবোর্ডে কপি করা হয়েছে!');
                }}
                className="px-4 py-2 bg-white text-emerald-700 hover:bg-emerald-50 font-black text-xs rounded-xl shadow transition active:scale-95 flex items-center gap-1.5 shrink-0 cursor-pointer font-bengali"
              >
                <Share2 className="w-3.5 h-3.5" /> লিংক কপি করুন
              </button>
            </div>
          </div>
        </div>

        {/* Unit 3: Quiz sets offline print and download Hub */}
        <div className="bg-slate-50/50 dark:bg-slate-900/40 border border-slate-100 dark:border-slate-800/80 rounded-3xl p-5 md:p-6 mb-8 font-bengali">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-5 pb-4 border-b border-slate-100 dark:border-slate-800/80">
            <div className="flex items-start gap-3">
              <div className="w-10 h-10 bg-indigo-50/10 rounded-2xl flex items-center justify-center text-indigo-500 border border-indigo-500/15">
                <Printer className="w-5.5 h-5.5 text-indigo-500" />
              </div>
              <div>
                <h2 className="text-sm sm:text-lg font-black text-slate-800 dark:text-white leading-snug">
                  মেধা কুইজ সেট অনুযায়ী প্রশ্নপত্র ডাউনলোড ও প্রিন্ট হাব
                </h2>
                <p className="text-[10px] sm:text-xs text-slate-500 dark:text-slate-400 font-medium mt-0.5">
                  অফলাইন পরীক্ষার প্রশ্নপত্র (খালি ছক) অথবা উত্তর ও ব্যাখ্যাসহ মাস্টার কপি সরাসরি প্রিন্ট বা PDF ডাউনলোড করুন
                </p>
              </div>
            </div>
            
            <button
              onClick={() => setShowCreateSetModal(true)}
              className="self-start sm:self-center flex items-center gap-1.5 px-3.5 py-2 bg-indigo-50 hover:bg-indigo-100 dark:bg-indigo-950/40 dark:hover:bg-indigo-900/60 text-indigo-600 dark:text-indigo-400 font-extrabold text-xs rounded-xl border border-indigo-500/15 cursor-pointer transition active:scale-95"
            >
              <Plus className="w-3.5 h-3.5" /> নতুন মেধা সেট তৈরি
            </button>
          </div>

          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            <div className="bg-white dark:bg-slate-800/85 border border-slate-100 dark:border-slate-755/70 rounded-2xl p-4.5 flex flex-col justify-between hover:border-slate-300 dark:hover:border-slate-700/80 hover:shadow-md transition group">
              <div className="mb-4">
                <div className="flex items-center justify-between mb-2.5">
                  <span className="px-2.5 py-0.5 bg-slate-100 dark:bg-slate-900 text-[10px] font-black text-slate-500 dark:text-slate-400 rounded-full border border-slate-200/50 dark:border-slate-800 font-sans">
                    সাধারণ
                  </span>
                  <span className="text-[11px] font-mono font-black text-slate-400 bg-slate-50 dark:bg-slate-900/60 px-2.5 py-0.5 rounded-md">
                    {questions.filter(q => !q.setId).length} টি প্রশ্ন
                  </span>
                </div>
                <h3 className="text-sm sm:text-sm font-black text-slate-800 dark:text-white leading-tight group-hover:text-indigo-600 dark:group-hover:text-indigo-400 transition-colors">
                  সাধারণ জ্ঞান ও কুইজ প্রশ্নমালা (General Quiz Bank)
                </h3>
                <p className="text-[11px] text-slate-400 dark:text-slate-500 mt-1.5 leading-relaxed">
                  কোনো নির্দিষ্ট মেধা শ্রেণি বা ক্যাটাগরিতে বিভক্ত না থাকা সাধারণ প্রশ্নাবলির কুইজ সংকলন।
                </p>
              </div>
              <div className="grid grid-cols-2 gap-2 text-center pt-3.5 border-t border-slate-100 dark:border-slate-750/70">
                <button
                  onClick={() => handlePrintSet('', false)}
                  className="py-2.5 bg-slate-50 hover:bg-slate-100 dark:bg-slate-900 dark:hover:bg-slate-850 text-slate-600 dark:text-slate-350 rounded-xl text-[11px] font-bold transition flex items-center justify-center gap-1 cursor-pointer active:scale-[0.98] border border-slate-100 dark:border-slate-800/85"
                  title="উত্তরপত্র ছাড়া কুইজ কোশ্চেন পেপার ডাউনলোড বা প্রিন্ট করুন"
                >
                  <FileText className="w-3.5 h-3.5 text-slate-400" /> ফাঁকা প্রশ্নপত্র
                </button>
                <button
                  onClick={() => handlePrintSet('', true)}
                  className="py-2.5 bg-emerald-50 text-emerald-700 hover:bg-emerald-100 dark:bg-emerald-950/30 dark:text-emerald-400 dark:hover:bg-emerald-900/35 rounded-xl text-[11px] font-bold transition flex items-center justify-center gap-1 cursor-pointer active:scale-[0.98] border border-emerald-500/10"
                  title="উত্তরপত্র ও ব্যাখ্যা সহ মাস্টার কপি প্রিন্ট করুন"
                >
                  <Printer className="w-3.5 h-3.5 text-emerald-500" /> উত্তর সহ কপি
                </button>
              </div>
            </div>

            {quizSets.map((qs) => {
              const setQCount = questions.filter(q => q.setId === qs.id).length;
              return (
                <div 
                  key={qs.id} 
                  className="bg-white dark:bg-slate-800/85 border border-slate-100 dark:border-slate-755/70 rounded-2xl p-4.5 flex flex-col justify-between hover:border-indigo-200 dark:hover:border-indigo-900/40 hover:shadow-md transition group"
                >
                  <div className="mb-4">
                    <div className="flex items-center justify-between mb-2.5">
                      <span className="px-2.5 py-0.5 bg-indigo-50 text-indigo-600 dark:bg-indigo-950/40 dark:text-indigo-400 text-[10px] font-black rounded-full uppercase tracking-wider border border-indigo-100/40 dark:border-indigo-900/30 font-sans">
                        {getCategoryLabel(qs.targetCategory)}
                      </span>
                      <div className="flex items-center gap-2">
                        <span className="text-[11px] font-mono font-black text-slate-400 bg-slate-50 dark:bg-slate-900/60 px-2.5 py-0.5 rounded-md">
                          {setQCount} টি প্রশ্ন
                        </span>
                        <button
                          onClick={() => handleDeleteSet(qs.id, qs.title)}
                          className="p-1 px-1.5 bg-rose-50 hover:bg-rose-100 dark:bg-rose-950/40 dark:hover:bg-rose-900/65 text-rose-600 dark:text-rose-400 rounded-lg transition cursor-pointer active:scale-[0.98]"
                          title="এই কুইজ সেট এবং মেধা শ্রেণিটি মুছে ফেলুন"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                    <h3 className="text-sm sm:text-sm font-black text-slate-800 dark:text-white leading-tight mt-1 group-hover:text-indigo-600 dark:group-hover:text-indigo-400 transition-colors">
                      {qs.title}
                    </h3>
                    {qs.setName && qs.setName !== qs.title && (
                      <p className="text-[10px] text-slate-400 font-medium mt-1 line-clamp-1">{qs.setName}</p>
                    )}
                  </div>
                  <div className="grid grid-cols-2 gap-2 text-center pt-3.5 border-t border-slate-100 dark:border-slate-750/70">
                    <button
                      onClick={() => handlePrintSet(qs.id, false)}
                      className="py-2.5 bg-slate-50 hover:bg-slate-100 dark:bg-slate-900 dark:hover:bg-slate-850 text-slate-600 dark:text-slate-350 rounded-xl text-[11px] font-bold transition flex items-center justify-center gap-1 cursor-pointer active:scale-[0.98] border border-slate-100 dark:border-slate-800/85"
                      title="পরীক্ষার্থীদের বসার জন্য ব্ল্যাঙ্ক প্রশ্নপত্র প্রিন্ট বা ডাউনলোড করুন"
                    >
                      <FileText className="w-3.5 h-3.5 text-slate-400" /> ফাঁকা প্রশ্নপত্র
                    </button>
                    <button
                      onClick={() => handlePrintSet(qs.id, true)}
                      className="py-2.5 bg-emerald-50 text-emerald-700 hover:bg-emerald-100 dark:bg-emerald-950/30 dark:text-emerald-400 dark:hover:bg-emerald-900/35 rounded-xl text-[11px] font-bold transition flex items-center justify-center gap-1 cursor-pointer active:scale-[0.98] border border-emerald-500/10"
                      title="মূল্যায়ন বা শিক্ষক কপির জন্য সঠিক উত্তরসহ প্রিন্ট করুন"
                    >
                      <Printer className="w-3.5 h-3.5 text-emerald-500" /> উত্তর সহ কপি
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* 4. Participant Results & Leaderboard Hub */}
        <div className="bg-slate-50/50 dark:bg-slate-900/40 border border-slate-100 dark:border-slate-800/80 rounded-3xl p-5 md:p-6 mb-8 no-print">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-5 pb-4 border-b border-slate-100 dark:border-slate-800/80 font-bengali">
            <div className="flex items-start gap-3">
              <div className="w-10 h-10 bg-indigo-50/10 rounded-2xl flex items-center justify-center text-indigo-500 border border-indigo-500/15">
                <Award className="w-5.5 h-5.5 text-indigo-500" />
              </div>
              <div>
                <h2 className="text-sm sm:text-lg font-black text-slate-800 dark:text-white leading-snug">
                  যারা অংশগ্রহণ করেছে তাদের মেধাতালিকা প্রিন্ট ও ফলাফল হাব
                </h2>
                <p className="text-[10px] sm:text-xs text-slate-500 dark:text-slate-400 font-medium mt-0.5">
                  কুইজ পরীক্ষায় অংশগ্রহণকারী শিক্ষার্থীদের মেধাক্রম ফিল্টার করুন, চূড়ান্ত মেধাতালিকা প্রিন্ট বা পিডিএফ করুন অথবা অপ্রয়োজনীয় রেকর্ড সরাতে মুছুন
                </p>
              </div>
            </div>
            
            <button
              onClick={handlePrintLeaderboard}
              className="self-start sm:self-center flex items-center gap-1.5 px-4.5 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white font-extrabold text-xs rounded-xl shadow-md cursor-pointer transition active:scale-95"
            >
              <Printer className="w-4 h-4 text-white" /> মেধাতালিকা প্রিন্ট করুন
            </button>
          </div>

          {/* Filters */}
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3.5 mb-5 bg-white dark:bg-slate-800 p-4 rounded-2xl border border-slate-100 dark:border-slate-700/50">
            <div>
              <label className="block text-[10px] sm:text-[11px] font-black uppercase tracking-wider text-slate-400 dark:text-slate-500 mb-1 font-bengali">কুইজ সেট দিয়ে ফিল্টার করুন:</label>
              <select
                value={selectedLeaderboardFilter}
                onChange={(e) => setSelectedLeaderboardFilter(e.target.value)}
                className="w-full bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-2 text-xs font-bold text-slate-700 dark:text-slate-200 focus:outline-none cursor-pointer font-bengali"
              >
                <option value="all"> সকল কুইজ সেট (General & Custom Sets)</option>
                {quizSets.map((qs) => (
                  <option key={qs.id} value={qs.id}>
                    {qs.title} ({getCategoryLabel(qs.targetCategory)})
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-[10px] sm:text-[11px] font-black uppercase tracking-wider text-slate-400 dark:text-slate-500 mb-1 font-bengali">পরীক্ষার্থীর নাম দিয়ে সার্চ করুন:</label>
              <div className="relative">
                <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-4.5 h-4.5 text-slate-400" />
                <input
                  type="text"
                  value={leaderboardSearch}
                  onChange={(e) => setLeaderboardSearch(e.target.value)}
                  placeholder="নাম লিখুন..."
                  className="w-full pl-9 pr-3 py-2 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-semibold text-slate-700 dark:text-slate-200 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                />
              </div>
            </div>

            <div className="flex items-end">
              <button
                onClick={() => {
                  setSelectedLeaderboardFilter('all');
                  setLeaderboardSearch('');
                  fetchAttempts();
                }}
                className="w-full py-2.5 bg-slate-100 hover:bg-slate-200 dark:bg-slate-700 dark:hover:bg-slate-600 text-slate-600 dark:text-slate-300 font-bold text-xs rounded-xl cursor-pointer transition active:scale-95 font-bengali"
              >
                রিসেট ফিল্টার
              </button>
            </div>
          </div>

          {/* Results list view / Table */}
          <div className="bg-white dark:bg-slate-800 border border-slate-100 dark:border-slate-700/70 rounded-2xl shadow-sm overflow-hidden text-slate-800 dark:text-white">
            {loadingAttempts ? (
              <div className="p-8 text-center flex flex-col items-center justify-center gap-2">
                <div className="w-8 h-8 rounded-full border-2 border-indigo-650 border-t-transparent animate-spin" />
                <p className="text-xs text-slate-400 font-bold font-bengali">লোড হচ্ছে, অনুগ্রহ করে অপেক্ষা করুন...</p>
              </div>
            ) : (() => {
              const filteredAttempts = attempts.filter(item => {
                const matchesSearch = item.userName?.toLowerCase().includes(leaderboardSearch.toLowerCase());
                if (selectedLeaderboardFilter !== 'all') {
                  return matchesSearch && item.setId === selectedLeaderboardFilter;
                }
                return matchesSearch;
              });

              if (filteredAttempts.length === 0) {
                return (
                  <div className="px-4 py-12 text-center text-slate-400 font-bold font-bengali text-sm">
                    কোনো মেধা পরীক্ষার ফলাফল বা রেকর্ড পাওয়া যায়নি।
                  </div>
                );
              }

              return (
                <>
                  {/* Desktop View Table */}
                  <div className="hidden md:block overflow-x-auto font-sans">
                    <table className="w-full text-left font-sans text-xs">
                      <thead>
                        <tr className="bg-slate-50/70 dark:bg-slate-900/40 text-slate-500 dark:text-slate-400 border-b border-slate-100 dark:border-slate-700/60 font-black">
                          <th className="px-4 py-3.5 w-12 text-center">মেধাক্রম</th>
                          <th className="px-4 py-3.5 text-left font-bengali">পরীক্ষার্থীর নাম</th>
                          <th className="px-4 py-3.5 text-left font-bengali">বিষয় / কুইজ সেট</th>
                          <th className="px-4 py-3.5 text-center font-bengali">সঠিক উত্তর</th>
                          <th className="px-4 py-3.5 text-center font-bengali">প্রাপ্ত স্কোর</th>
                          <th className="px-4 py-3.5 text-center font-bengali">সফলতার হার</th>
                          <th className="px-4 py-3.5 text-center font-bengali">অ্যাকশন</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100 dark:divide-slate-700/50">
                        {filteredAttempts.map((item, idx) => {
                          const matchedSet = quizSets.find(qs => qs.id === item.setId);
                          const setName = item.quizTitle || (matchedSet ? matchedSet.title : 'সাধারণ জ্ঞান / অন্যান্য কুইজ');
                          
                          const isMedal = idx < 3;
                          const medalColor = idx === 0 ? 'bg-amber-100 text-amber-700 dark:bg-amber-950/40 dark:text-amber-400 border border-amber-200/50' 
                                           : idx === 1 ? 'bg-slate-100 text-slate-700 dark:bg-slate-900 dark:text-slate-300 border border-slate-200/50'
                                           : 'bg-orange-100 text-orange-700 dark:bg-orange-950/40 dark:text-orange-400 border border-orange-200/50';

                          return (
                            <tr key={item.id || idx} className="hover:bg-slate-50/50 dark:hover:bg-slate-900/10 transition text-slate-700 dark:text-slate-200">
                              <td className="px-4 py-3 text-center">
                                {isMedal ? (
                                  <span className={`inline-flex items-center justify-center w-5.5 h-5.5 rounded-full font-black text-[10px] ${medalColor}`}>
                                    {idx + 1}
                                  </span>
                                ) : (
                                  <span className="font-mono text-slate-400 font-black">{idx + 1}</span>
                                )}
                              </td>
                              <td className="px-4 py-3 font-bold text-slate-800 dark:text-slate-100 font-bengali text-xs">
                                {item.userName || 'পাবলিক পরীক্ষার্থী'}
                              </td>
                              <td className="px-4 py-3 font-medium text-slate-550 dark:text-slate-300 font-bengali text-xs max-w-xs truncate">
                                {setName}
                              </td>
                              <td className="px-4 py-3 text-center font-mono font-bold text-slate-600 dark:text-slate-400">
                                {item.correctCount ?? (item.score || 0)} / {item.totalQuestions || 30}
                              </td>
                              <td className="px-4 py-3 text-center font-mono font-black text-indigo-650 dark:text-indigo-400 text-[13px]">
                                {item.score}
                              </td>
                              <td className="px-4 py-3 text-center">
                                <span className={`inline-block px-2 py-0.5 rounded-full font-black text-[10px] font-mono ${
                                  item.percentage >= 80 ? 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950/30 dark:text-emerald-400' 
                                  : item.percentage >= 50 ? 'bg-amber-50 text-amber-700 dark:bg-amber-950/30 dark:text-amber-400'
                                  : 'bg-rose-50 text-rose-700 dark:bg-rose-950/30 dark:text-rose-400'
                                }`}>
                                  {item.percentage}%
                                </span>
                              </td>
                              <td className="px-4 py-3 text-center">
                                <button
                                  onClick={() => handleDeleteAttempt(item.id)}
                                  className="p-1.5 bg-rose-50 hover:bg-rose-100 dark:bg-rose-950/40 dark:hover:bg-rose-900/40 text-rose-600 dark:text-rose-450 rounded-lg cursor-pointer transition active:scale-90"
                                  title="এই রেকর্ডটি ডিলিট করুন"
                                >
                                  <Trash2 className="w-3.5 h-3.5" />
                                </button>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>

                  {/* Mobile View Cards Layout */}
                  <div className="block md:hidden divide-y divide-slate-100 dark:divide-slate-700/50 font-sans">
                    {filteredAttempts.map((item, idx) => {
                      const matchedSet = quizSets.find(qs => qs.id === item.setId);
                      const setName = item.quizTitle || (matchedSet ? matchedSet.title : 'সাধারণ জ্ঞান / অন্যান্য কুইজ');
                      
                      const isMedal = idx < 3;
                      const medalColor = idx === 0 ? 'bg-amber-100 text-amber-805 dark:bg-amber-950/40 dark:text-amber-400 border border-amber-200/50' 
                                       : idx === 1 ? 'bg-slate-100 text-slate-705 dark:bg-slate-900 dark:text-slate-300 border border-slate-200/50'
                                       : 'bg-orange-100 text-orange-850 dark:bg-orange-950/40 dark:text-orange-400 border border-orange-200/50';

                      return (
                        <div key={item.id || idx} className="p-4 flex flex-col gap-3 hover:bg-slate-50/30 dark:hover:bg-slate-900/10 transition">
                          <div className="flex items-center justify-between gap-2">
                            <div className="flex items-center gap-2">
                              {isMedal ? (
                                <span className={`inline-flex items-center justify-center w-5.5 h-5.5 rounded-full font-black text-[10px] ${medalColor}`}>
                                  {idx + 1}
                                </span>
                              ) : (
                                <span className="text-[11px] font-mono font-black text-slate-400 bg-slate-50 dark:bg-slate-900/50 px-2 py-0.5 rounded">
                                  Rank {idx + 1}
                                </span>
                              )}
                              <h4 className="text-xs font-bold text-slate-800 dark:text-slate-150 font-bengali">
                                {item.userName || 'পাবলিক পরীক্ষার্থী'}
                              </h4>
                            </div>

                            <span className={`inline-block px-2 py-0.5 rounded-full font-black text-[10px] font-mono ${
                              item.percentage >= 80 ? 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950/30 dark:text-emerald-400' 
                              : item.percentage >= 50 ? 'bg-amber-50 text-amber-700 dark:bg-amber-950/30 dark:text-amber-400'
                              : 'bg-rose-50 text-rose-700 dark:bg-rose-950/30 dark:text-rose-400'
                            }`}>
                              {item.percentage}%
                            </span>
                          </div>

                          <div className="grid grid-cols-3 gap-2 bg-slate-50/50 dark:bg-slate-900/40 p-2.5 rounded-xl border border-slate-100 dark:border-slate-800/80">
                            <div className="col-span-3">
                              <span className="text-[9px] text-slate-400 font-black block uppercase tracking-wider">বিষয় / কুইজ সেট</span>
                              <span className="text-xs font-bold text-slate-700 dark:text-slate-350 font-bengali max-w-xs truncate block">
                                {setName}
                              </span>
                            </div>
                            <div className="pt-1.5 border-t border-slate-100 dark:border-slate-800/60 col-span-1">
                              <span className="text-[8px] text-slate-400 font-black block uppercase tracking-wide">সঠিক</span>
                              <span className="text-xs font-bold text-slate-600 dark:text-slate-300 font-mono">
                                {item.correctCount ?? (item.score || 0)}/{item.totalQuestions || 30}
                              </span>
                            </div>
                            <div className="pt-1.5 border-t border-slate-100 dark:border-slate-800/60 col-span-1">
                              <span className="text-[8px] text-slate-400 font-black block uppercase tracking-wide">প্রাপ্ত স্কোর</span>
                              <span className="text-xs font-black text-indigo-650 dark:text-indigo-400 font-mono">
                                {item.score}
                              </span>
                            </div>
                            <div className="pt-1.5 border-t border-slate-100 dark:border-slate-800/60 col-span-1 text-right flex items-end justify-end">
                              <button
                                onClick={() => handleDeleteAttempt(item.id)}
                                className="p-1.5 bg-rose-50 hover:bg-rose-100 dark:bg-rose-950/40 dark:hover:bg-rose-900/45 text-rose-600 dark:text-rose-400 rounded-lg cursor-pointer transition active:scale-90"
                                title="এই রেকর্ডটি ডিলিট করুন"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </>
              );
            })()}
          </div>
        </div>

        {/* Search Header */}
        <div className="bg-white dark:bg-slate-800 border border-slate-100 dark:border-slate-700/65 rounded-2xl p-4 mb-6 flex flex-col md:flex-row items-center gap-4">
          <div className="relative w-full max-w-md">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
            <input
              type="text"
              placeholder="প্রশ্ন খুঁজুন..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-10 pr-4 py-2.5 bg-slate-50 dark:bg-slate-900 border border-slate-100 dark:border-slate-700 rounded-xl text-slate-800 dark:text-white placeholder-slate-400 font-medium focus:outline-none focus:ring-2 focus:ring-indigo-500/40"
            />
          </div>

          <div className="flex items-center gap-2 w-full md:w-auto">
            <label className="text-xs font-black text-slate-400 dark:text-slate-500 whitespace-nowrap uppercase">কুইজ সেট ফিল্টার:</label>
            <select
              value={selectedQuizSetFilter}
              onChange={(e) => setSelectedQuizSetFilter(e.target.value)}
              className="bg-slate-50 dark:bg-slate-900 text-slate-800 dark:text-slate-200 border border-slate-100 dark:border-slate-700 rounded-xl px-3 py-2 text-xs font-bold focus:outline-none focus:ring-2 focus:ring-indigo-500/40 cursor-pointer"
            >
              <option value="all">সকল প্রশ্ন (All Questions)</option>
              <option value="unassigned">সাধারণ/শ্রেণীভুক্ত নয় (GK / General)</option>
              {quizSets.map((qs) => (
                <option key={qs.id} value={qs.id}>
                  {qs.title} ({getCategoryLabel(qs.targetCategory)})
                </option>
              ))}
            </select>
          </div>

          <div className="text-sm font-semibold text-slate-500 dark:text-slate-400 md:ml-auto font-mono">
            মোট প্রশ্ন: {questions.length} | ফিল্টারড: {filteredQuestions.length}
          </div>
        </div>

        {/* Table List representation */}
        {loading ? (
          <div className="py-12 flex flex-col items-center justify-center">
            <div className="w-10 h-10 border-4 border-slate-200 border-t-indigo-600 rounded-full animate-spin mb-3" />
            <p className="text-slate-500 font-bengali">প্রশ্নগুলো লোড হচ্ছে...</p>
          </div>
        ) : filteredQuestions.length === 0 ? (
          <div className="bg-white dark:bg-slate-800 border border-slate-100 dark:border-slate-700/65 rounded-2xl p-12 text-center">
            <HelpCircle className="w-12 h-12 text-slate-300 dark:text-slate-600 mx-auto mb-4" />
            <h3 className="text-lg font-bold text-slate-800 dark:text-slate-200 mb-1 font-bengali">কোনো প্রশ্ন পাওয়া যায়নি</h3>
            <p className="text-slate-500 dark:text-slate-400 max-w-sm mx-auto text-sm font-bengali">নতুন প্রশ্ন যোগ করতে উপরে &quot;নতুন প্রশ্ন যোগ করুন&quot; বোতামে চাপ দিন অথবা কুইজ সেট নির্বাচন পরিবর্তন করুন।</p>
          </div>
        ) : (
          <div className="grid gap-4 md:grid-cols-2">
            {filteredQuestions.map((q) => (
              <div 
                key={q.id}
                className={`bg-white dark:bg-slate-800 border ${q.active ? 'border-indigo-100 dark:border-indigo-500/10' : 'border-slate-200 dark:border-slate-700 opacity-75'} rounded-2xl p-5 hover:shadow-md transition-shadow flex flex-col justify-between`}
              >
                <div>
                  <div className="flex items-start justify-between gap-3 mb-3">
                    <span className={`px-2.5 py-1 text-xs font-bold rounded-lg flex items-center gap-1.5 ${q.active ? 'bg-emerald-50 dark:bg-emerald-500/10 text-emerald-600 dark:text-emerald-400' : 'bg-slate-100 dark:bg-slate-700/50 text-slate-500'}`}>
                      {q.active ? <Check className="w-3.5 h-3.5" /> : <EyeOff className="w-3.5 h-3.5" />}
                      {q.active ? "সক্রিয়" : "নিষ্ক্রিয়"}
                    </span>

                    <span className="text-xs bg-indigo-50 dark:bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 font-bold px-2.5 py-1 rounded-lg font-mono">
                      সঠিক: {q.correctOption}
                    </span>
                  </div>

                  <h3 className="text-lg font-black text-slate-800 dark:text-white leading-relaxed mb-4">{q.questionText}</h3>
                  
                  {/* Options list */}
                  <div className="space-y-2 mb-4">
                    <div className="grid grid-cols-2 gap-2 text-sm font-semibold">
                      <p className={`p-2 rounded-lg border text-xs ${q.correctOption === 'A' ? 'bg-emerald-50 dark:bg-emerald-500/10 border-emerald-300 dark:border-emerald-500/20 text-emerald-700 dark:text-emerald-400' : 'bg-slate-50 dark:bg-slate-900 border-slate-100 dark:border-slate-700 text-slate-600 dark:text-slate-300'}`}>
                        <span className="font-mono font-bold text-indigo-500 mr-1.5">A.</span> {q.optionA}
                      </p>
                      <p className={`p-2 rounded-lg border text-xs ${q.correctOption === 'B' ? 'bg-emerald-50 dark:bg-emerald-500/10 border-emerald-300 dark:border-emerald-500/20 text-emerald-700 dark:text-emerald-400' : 'bg-slate-50 dark:bg-slate-900 border-slate-100 dark:border-slate-700 text-slate-600 dark:text-slate-300'}`}>
                        <span className="font-mono font-bold text-indigo-500 mr-1.5">B.</span> {q.optionB}
                      </p>
                      <p className={`p-2 rounded-lg border text-xs ${q.correctOption === 'C' ? 'bg-emerald-50 dark:bg-emerald-500/10 border-emerald-300 dark:border-emerald-500/20 text-emerald-700 dark:text-emerald-400' : 'bg-slate-50 dark:bg-slate-900 border-slate-100 dark:border-slate-700 text-slate-600 dark:text-slate-300'}`}>
                        <span className="font-mono font-bold text-indigo-500 mr-1.5">C.</span> {q.optionC}
                      </p>
                      <p className={`p-2 rounded-lg border text-xs ${q.correctOption === 'D' ? 'bg-emerald-50 dark:bg-emerald-500/10 border-emerald-300 dark:border-emerald-500/20 text-emerald-700 dark:text-emerald-400' : 'bg-slate-50 dark:bg-slate-900 border-slate-100 dark:border-slate-700 text-slate-600 dark:text-slate-300'}`}>
                        <span className="font-mono font-bold text-indigo-500 mr-1.5">D.</span> {q.optionD}
                      </p>
                    </div>
                  </div>

                  {q.hint && (
                    <p className="text-[13px] bg-indigo-50/40 dark:bg-indigo-950/20 text-indigo-600 dark:text-indigo-300 p-2.5 rounded-xl border border-indigo-500/10 leading-relaxed mb-4">
                      💡 <strong className="font-bold">ব্যাখ্যা:</strong> {q.hint}
                    </p>
                  )}
                </div>

                <div className="flex items-center justify-between border-t border-slate-100 dark:border-slate-700/50 pt-3 mt-2">
                  <button
                    onClick={() => handleToggleActive(q)}
                    className={`flex items-center gap-1.5 text-xs font-bold py-1.5 px-3 rounded-lg border cursor-pointer ${q.active ? 'hover:bg-slate-50 dark:hover:bg-slate-700 text-slate-600 dark:text-slate-300 border-slate-200 dark:border-slate-600' : 'bg-indigo-600 text-white border-transparent hover:bg-indigo-700'}`}
                  >
                    {q.active ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                    {q.active ? "নিষ্ক্রিয় করুন" : "সক্রিয় করুন"}
                  </button>

                  <div className="flex gap-2">
                    <button
                      onClick={() => handleOpenEdit(q)}
                      className="p-1.5 rounded-lg border border-slate-200 dark:border-slate-600 text-slate-600 dark:text-slate-300 hover:bg-indigo-50 dark:hover:bg-indigo-500/10 hover:text-indigo-600 transition cursor-pointer"
                      title="সম্পাদনা"
                    >
                      <Pencil className="w-4 h-4" />
                    </button>
                    <button
                      onClick={() => handleDelete(q.id)}
                      className="p-1.5 rounded-lg border border-slate-200 dark:border-slate-600 text-slate-600 dark:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-500/10 hover:text-rose-600 transition cursor-pointer"
                      title="মুছে ফেলুন"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Edit/Add Questions Modal */}
      <AnimatePresence>
        {showAddModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm"
              onClick={() => setShowAddModal(false)}
            />

            <motion.div
              initial={{ scale: 0.95, opacity: 0, y: 10 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.95, opacity: 0, y: 10 }}
              className="relative w-full max-w-lg bg-white dark:bg-slate-800 rounded-3xl border border-slate-100 dark:border-slate-700 shadow-2xl p-6 md:p-8 max-h-[90vh] overflow-y-auto"
            >
              <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-700/65 pb-4 mb-6">
                <h2 className="text-xl font-black text-slate-800 dark:text-white">
                  {editingQuestion ? 'প্রশ্ন সম্পাদনা' : 'নতুন প্রশ্ন যোগ করুন'}
                </h2>
                <button 
                  onClick={() => setShowAddModal(false)}
                  className="p-1.5 bg-slate-50 hover:bg-slate-100 dark:bg-slate-700/50 dark:hover:bg-slate-700/90 text-slate-400 dark:text-slate-300 rounded-xl transition-colors cursor-pointer"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <form onSubmit={handleSubmit} className="space-y-5">
                <div>
                  <label className="block text-sm font-bold text-slate-707 dark:text-slate-300 mb-2 font-bengali">প্রশ্ন (প্রশ্ন টেক্সট)</label>
                  <textarea
                    required
                    rows={2}
                    value={formData.questionText}
                    onChange={(e) => setFormData(prev => ({ ...prev, questionText: e.target.value }))}
                    placeholder="যেমন: 'গীতাঞ্জলি' কাব্যগ্রন্থের কবি কে?"
                    className="w-full px-4 py-2.5 bg-slate-50 dark:bg-slate-900 border border-slate-100 dark:border-slate-700 rounded-xl text-slate-800 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500/40 text-sm font-medium resize-none"
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-bold text-slate-700 dark:text-slate-300 mb-2 font-bengali">Option A</label>
                    <input
                      required
                      type="text"
                      value={formData.optionA}
                      onChange={(e) => setFormData(prev => ({ ...prev, optionA: e.target.value }))}
                      placeholder="অপশন ক"
                      className="w-full px-4 py-2.5 bg-slate-50 dark:bg-slate-900 border border-slate-100 dark:border-slate-700 rounded-xl text-slate-800 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500/40 text-sm font-medium"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-bold text-slate-700 dark:text-slate-300 mb-2 font-bengali">Option B</label>
                    <input
                      required
                      type="text"
                      value={formData.optionB}
                      onChange={(e) => setFormData(prev => ({ ...prev, optionB: e.target.value }))}
                      placeholder="অপশন খ"
                      className="w-full px-4 py-2.5 bg-slate-50 dark:bg-slate-900 border border-slate-100 dark:border-slate-700 rounded-xl text-slate-800 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500/40 text-sm font-medium"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-bold text-slate-700 dark:text-slate-300 mb-2 font-bengali">Option C</label>
                    <input
                      required
                      type="text"
                      value={formData.optionC}
                      onChange={(e) => setFormData(prev => ({ ...prev, optionC: e.target.value }))}
                      placeholder="অপশন গ"
                      className="w-full px-4 py-2.5 bg-slate-50 dark:bg-slate-900 border border-slate-100 dark:border-slate-700 rounded-xl text-slate-800 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500/40 text-sm font-medium"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-bold text-slate-700 dark:text-slate-300 mb-2 font-bengali">Option D</label>
                    <input
                      required
                      type="text"
                      value={formData.optionD}
                      onChange={(e) => setFormData(prev => ({ ...prev, optionD: e.target.value }))}
                      placeholder="অপশন ঘ"
                      className="w-full px-4 py-2.5 bg-slate-50 dark:bg-slate-900 border border-slate-100 dark:border-slate-700 rounded-xl text-slate-800 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500/40 text-sm font-medium"
                    />
                  </div>
                </div>

                <div>
                  <div className="flex items-center justify-between mb-2 font-bengali">
                    <label className="block text-sm font-bold text-slate-700 dark:text-slate-300">কুইজ সেট বা কোশ্চেন ব্যাংক (ঐচ্ছিক)</label>
                    <button
                      type="button"
                      onClick={() => setShowCreateSetModal(true)}
                      className="text-xs font-black text-indigo-600 hover:text-indigo-800 dark:text-indigo-400 dark:hover:text-indigo-300 flex items-center gap-0.5 cursor-pointer bg-slate-50 dark:bg-slate-900/40 px-2 py-0.5 rounded-lg border border-slate-100 dark:border-slate-800"
                    >
                      <Plus className="w-3 h-3 text-indigo-500" /> নতুন সেট তৈরি
                    </button>
                  </div>
                  <select
                    value={formData.setId}
                    onChange={(e) => setFormData(prev => ({ ...prev, setId: e.target.value }))}
                    className="w-full px-4 py-2.5 bg-slate-50 dark:bg-slate-900 border border-slate-100 dark:border-slate-700 rounded-xl text-slate-800 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500/40 text-sm font-bold font-bengali cursor-pointer"
                  >
                    <option value="">সাধারণ বা অন্যান্য (কোন সেটে যুক্ত নয়)</option>
                    {quizSets.map((qs) => (
                      <option key={qs.id} value={qs.id}>
                        {qs.title} ({getCategoryLabel(qs.targetCategory)})
                      </option>
                    ))}
                  </select>
                </div>

                <div className="grid grid-cols-2 gap-4 font-bengali">
                  <div>
                    <label className="block text-sm font-bold text-slate-700 dark:text-slate-300 mb-2">সঠিক উত্তর অপশন</label>
                    <select
                      value={formData.correctOption}
                      onChange={(e) => setFormData(prev => ({ ...prev, correctOption: e.target.value as 'A' | 'B' | 'C' | 'D' }))}
                      className="w-full px-4 py-2.5 bg-slate-50 dark:bg-slate-900 border border-slate-100 dark:border-slate-700 rounded-xl text-slate-800 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500/40 text-sm font-bold"
                    >
                      <option value="A">A</option>
                      <option value="B">B</option>
                      <option value="C">C</option>
                      <option value="D">D</option>
                    </select>
                  </div>
                  <div className="flex items-center pt-8 pl-4">
                    <label className="flex items-center gap-2 cursor-pointer select-none">
                      <input
                        type="checkbox"
                        checked={formData.active}
                        onChange={(e) => setFormData(prev => ({ ...prev, active: e.target.checked }))}
                        className="w-4.5 h-4.5 accent-indigo-600 rounded text-indigo-600 focus:ring-indigo-500/40"
                      />
                      <span className="text-sm font-bold text-slate-705 dark:text-slate-300">প্রশ্নটি সক্রিয় থাকবে</span>
                    </label>
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-bold text-slate-700 dark:text-slate-300 mb-2 font-bengali">ব্যাখ্যা / Hint (ঐচ্ছিক)</label>
                  <textarea
                    rows={2}
                    value={formData.hint}
                    onChange={(e) => setFormData(prev => ({ ...prev, hint: e.target.value }))}
                    placeholder="সঠিক উত্তরের স্বপক্ষে তথ্যনির্ভর ব্যাখ্যা দিতে পারেন..."
                    className="w-full px-4 py-2.5 bg-slate-50 dark:bg-slate-900 border border-slate-100 dark:border-slate-700 rounded-xl text-slate-800 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500/40 text-sm font-medium resize-none"
                  />
                </div>

                <div className="flex gap-3 justify-end border-t border-slate-100 dark:border-slate-700/65 pt-5 mt-6 font-bengali">
                  <button
                    type="button"
                    onClick={() => setShowAddModal(false)}
                    className="px-5 py-2.5 bg-slate-100 hover:bg-slate-200 dark:bg-slate-700 dark:hover:bg-slate-600/80 text-slate-700 dark:text-slate-200 font-bold rounded-xl transition cursor-pointer"
                  >
                    বাতিল
                  </button>
                  <button
                    type="submit"
                    className="px-6 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white font-bold rounded-xl shadow-lg shadow-indigo-600/15 transition cursor-pointer"
                  >
                    {editingQuestion ? 'পরিবর্তন সংরক্ষণ করুন' : 'তৈরি করুন'}
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Bulk Upload Questions Modal */}
      <AnimatePresence>
        {showBulkModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm"
              onClick={() => setShowBulkModal(false)}
            />

            <motion.div
              initial={{ scale: 0.95, opacity: 0, y: 10 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.95, opacity: 0, y: 10 }}
              className="relative w-full max-w-2xl bg-white dark:bg-slate-800 rounded-3xl border border-slate-100 dark:border-slate-700 shadow-2xl p-5 md:p-7 max-h-[90vh] overflow-y-auto font-bengali text-slate-800 dark:text-white"
            >
              <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-700/65 pb-4 mb-4">
                <div className="flex items-center gap-2">
                  <Upload className="w-5 h-5 text-indigo-500" />
                  <h2 className="text-lg md:text-xl font-black text-slate-800 dark:text-white">
                    একত্রে প্রশ্ন আপলোড (সর্বোচ্চ ৩০টি)
                  </h2>
                </div>
                <button 
                  onClick={() => setShowBulkModal(false)}
                  className="p-1.5 bg-slate-50 hover:bg-slate-100 dark:bg-slate-700/50 dark:hover:bg-slate-700/90 text-slate-400 dark:text-slate-300 rounded-xl transition-colors cursor-pointer"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <form onSubmit={handleBulkSubmit} className="space-y-4">
                <div>
                  <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">আপলোড ফরম্যাট নির্বাচন করুন</label>
                  <div className="flex gap-2">
                    <button
                      type="button"
                      onClick={() => setBulkFormat('delimiter')}
                      className={`flex-1 py-1.5 px-3 text-xs sm:text-sm font-bold rounded-xl border transition-colors cursor-pointer ${bulkFormat === 'delimiter' ? 'bg-indigo-600 border-transparent text-white' : 'bg-slate-50 dark:bg-slate-900 border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-855'}`}
                    >
                      Pipeline Separated
                    </button>
                    <button
                      type="button"
                      onClick={() => setBulkFormat('json')}
                      className={`flex-1 py-1.5 px-3 text-xs sm:text-sm font-bold rounded-xl border transition-colors cursor-pointer ${bulkFormat === 'json' ? 'bg-indigo-600 border-transparent text-white' : 'bg-slate-50 dark:bg-slate-900 border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-855'}`}
                    >
                      JSON Array
                    </button>
                  </div>
                </div>

                 <div>
                  <div className="flex items-center justify-between mb-2">
                    <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider">কুইজ সেট নির্বাচন করুন (ঐচ্ছিক)</label>
                    <button
                      type="button"
                      onClick={() => setShowCreateSetModal(true)}
                      className="text-[11px] font-black uppercase text-indigo-500 hover:text-indigo-700 dark:text-indigo-400 dark:hover:text-indigo-300 flex items-center gap-0.5 cursor-pointer bg-slate-50 dark:bg-slate-900/40 px-2 py-0.5 rounded-lg border border-slate-100 dark:border-slate-800"
                    >
                      <Plus className="w-3 h-3 text-indigo-500" /> নতুন সেট তৈরি
                    </button>
                  </div>
                  <select
                    value={bulkSetId}
                    onChange={(e) => setBulkSetId(e.target.value)}
                    className="w-full px-4 py-2.5 bg-slate-50 dark:bg-slate-900 border border-slate-100 dark:border-slate-700 rounded-xl text-slate-800 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500/40 text-xs sm:text-sm font-bold font-bengali cursor-pointer"
                  >
                    <option value="">সাধারণ বা অন্যান্য (কোন সেটে যুক্ত নয়)</option>
                    {quizSets.map((qs) => (
                      <option key={qs.id} value={qs.id}>
                        {qs.title} ({getCategoryLabel(qs.targetCategory)})
                      </option>
                    ))}
                  </select>
                </div>

                <div className="bg-slate-50 dark:bg-slate-900/60 border border-slate-100 dark:border-slate-700/50 rounded-2xl p-3.5 text-xs text-slate-600 dark:text-slate-300 space-y-1.5 leading-relaxed">
                  <p className="font-bold text-slate-705 dark:text-white">সংক্ষিপ্ত নিদের্শনা:</p>
                  {bulkFormat === 'delimiter' ? (
                    <>
                      <p>নিচের ফরম্যাটে প্রতি লাইনে ১টি করে প্রশ্ন লিখুন। প্রতিটি অংশকে পাইপলাইন (<strong className="text-indigo-500 font-mono">|</strong>) দিয়ে ভাগ করুন:</p>
                      <div className="bg-slate-100 dark:bg-slate-950 p-2 rounded-lg font-mono text-[11px] overflow-x-auto text-slate-800 dark:text-slate-200 whitespace-pre">
                        {"প্রশ্ন | অপশন ক | অপশন খ | অপশন গ | অপশন ঘ | সঠিক অপশন (A/B/C/D) | ব্যাখ্যা (ঐচ্ছিক)"}
                      </div>
                      <p className="font-bold text-emerald-600 dark:text-emerald-400">উদাহরণ:</p>
                      <div className="bg-slate-100 dark:bg-slate-950 p-2 rounded-lg font-mono text-[11px] overflow-x-auto text-slate-800 dark:text-slate-200 whitespace-pre">
                        {"চর্যাপদ কোন যুগে রচিত? | প্রাচীন যুগ | মধ্য যুগ | আধুনিক যুগ | প্রাক-ঐতিহাসিক যুগ | A | হরপ্রসাদ শাস্ত্রী চর্যাপদের পুঁথি আবিষ্কার করেন।"}
                      </div>
                    </>
                  ) : (
                    <>
                      <p>একটি valid JSON array প্রদান করুন যেখানে নিচের ফিল্ডগুলো থাকবে:</p>
                      <div className="bg-slate-100 dark:bg-slate-950 p-2 rounded-lg font-mono text-[10px] overflow-x-auto text-slate-800 dark:text-slate-200">
{`[
  {
    "questionText": "রবীন্দ্রনাথ ঠাকুর কত সালে গীতাঞ্জলির জন্য নোবেল পান?",
    "optionA": "১৯১০",
    "optionB": "১৯১৩",
    "optionC": "১৯১৫",
    "optionD": "১৯২০",
    "correctOption": "B",
    "hint": "১৯১৩ সালে গীতাঞ্জলির ইংরেজি সংস্করণের জন্য তিনি নোবেল পান।"
  }
]`}
                      </div>
                    </>
                  )}
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">প্রশ্নগুলোর তালিকা লিখুন / পেস্ট করুন</label>
                  <textarea
                    rows={6}
                    required
                    value={bulkInputText}
                    onChange={(e) => setBulkInputText(e.target.value)}
                    placeholder={bulkFormat === 'delimiter' ? "১ম প্রশ্ন | অপশন ক | অপশন খ | অপশন গ | অপশন ঘ | সঠিক | ব্যাখ্যা\n২য় প্রশ্ন | অপশন ক | অপশন খ | অপশন গ | অপশন ঘ | সঠিক | ব্যাখ্যা" : "JSON array পেস্ট করুন..."}
                    className="w-full px-4 py-3 bg-slate-50 dark:bg-slate-900 border border-slate-100 dark:border-slate-700 rounded-2xl text-slate-800 dark:text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500/40 text-xs sm:text-sm font-medium resize-y"
                  />
                </div>

                <div className="flex gap-3 justify-end border-t border-slate-100 dark:border-slate-700/65 pt-4">
                  <button
                    type="button"
                    disabled={bulkUploading}
                    onClick={() => setShowBulkModal(false)}
                    className="px-5 py-2.5 bg-slate-100 hover:bg-slate-200 dark:bg-slate-700 dark:hover:bg-slate-600/80 text-slate-700 dark:text-slate-200 font-bold rounded-xl transition cursor-pointer text-xs sm:text-sm"
                  >
                    বাতিল
                  </button>
                  <button
                    type="submit"
                    disabled={bulkUploading}
                    className="px-6 py-2.5 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white font-bold rounded-xl shadow-lg shadow-indigo-600/15 transition cursor-pointer text-xs sm:text-sm flex items-center gap-1.5"
                  >
                    {bulkUploading ? (
                      <>
                        <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                        আপলোড হচ্ছে...
                      </>
                    ) : (
                      <>
                        <ClipboardList className="w-4 h-4" />
                        আপলোড সম্পন্ন করুন
                      </>
                    )}
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Quick Create Quiz Set Modal */}
      <AnimatePresence>
        {showCreateSetModal && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm z-40"
              onClick={() => setShowCreateSetModal(false)}
            />

            <motion.div
              initial={{ scale: 0.95, opacity: 0, y: 10 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.95, opacity: 0, y: 10 }}
              className="relative w-full max-w-md bg-white dark:bg-slate-800 rounded-3xl border border-slate-100 dark:border-slate-700 shadow-2xl p-6 md:p-8 z-50 font-bengali"
            >
              <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-700/65 pb-4 mb-5">
                <h2 className="text-lg font-black text-slate-800 dark:text-white flex items-center gap-1.5">
                  <Plus className="w-5 h-5 text-indigo-500" /> নতুন কুইজ সেট তৈরি করুন
                </h2>
                <button 
                  onClick={() => setShowCreateSetModal(false)}
                  className="p-1.5 bg-slate-50 hover:bg-slate-100 dark:bg-slate-700/50 dark:hover:bg-slate-700/90 text-slate-400 dark:text-slate-300 rounded-xl transition-colors cursor-pointer"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <form onSubmit={handleCreateSet} className="space-y-4">
                <div>
                  <label className="block text-sm font-bold text-slate-705 dark:text-slate-300 mb-1">কুইজের শিরোনাম (Quiz Title)</label>
                  <input
                    type="text"
                    value={newSetTitle}
                    onChange={(e) => setNewSetTitle(e.target.value)}
                    placeholder="যেমন: '৬ষ্ঠ শ্রেণির বাংলা ১ম পত্র' (ফাঁকা রাখলে সেটের নামই হবে)"
                    className="w-full px-4 py-2.5 bg-slate-50 dark:bg-slate-900 border border-slate-100 dark:border-slate-700 rounded-xl text-slate-800 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500/40 text-xs sm:text-sm font-bold"
                  />
                  <p className="text-[10px] text-slate-400 mt-1">এটি পরীক্ষার স্ক্রিনে বড় হেডার হিসেবে প্রদর্শিত হবে।</p>
                </div>

                <div>
                  <label className="block text-sm font-bold text-slate-705 dark:text-slate-300 mb-1">কুইজ সেটের নাম (Quiz Set Name) *</label>
                  <input
                    required
                    type="text"
                    value={newSetName}
                    onChange={(e) => setNewSetName(e.target.value)}
                    placeholder="যেমন: 'অধ্যায় ১: ভাষার ব্যাকরণ'"
                    className="w-full px-4 py-2.5 bg-slate-50 dark:bg-slate-900 border border-slate-100 dark:border-slate-700 rounded-xl text-slate-800 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500/40 text-xs sm:text-sm font-bold"
                  />
                  <p className="text-[10px] text-slate-400 mt-1">এটি সিলেক্টেড অধ্যায় বা পাঠ্য বিষয়কে চিহ্নিত করবে।</p>
                </div>

                <div>
                  <label className="block text-sm font-bold text-slate-700 dark:text-slate-300 mb-1.5">শ্রেণি বা ক্যাটাগরি (টার্গেট)</label>
                  <select
                    value={newSetCategory}
                    onChange={(e) => setNewSetCategory(e.target.value)}
                    className="w-full px-4 py-2.5 bg-slate-50 dark:bg-slate-900 border border-slate-100 dark:border-slate-700 rounded-xl text-slate-800 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500/40 text-xs sm:text-sm font-bold cursor-pointer"
                  >
                    <option value="class-6">৬ষ্ঠ শ্রেণী (Class 6)</option>
                    <option value="class-7">৭ম শ্রেণী (Class 7)</option>
                    <option value="class-8">৮ম শ্রেণী (Class 8)</option>
                    <option value="class-9">৯ম শ্রেণী (Class 9)</option>
                    <option value="class-10">১০ম শ্রেণী (Class 10)</option>
                    <option value="class-11">১১শ শ্রেণী (Class 11)</option>
                    <option value="class-12">১২শ শ্রেণী (Class 12)</option>
                    <option value="ssc-dakhil">এসএসসি / দাখিল</option>
                    <option value="hsc-alim">এইচএসসি / আলিম</option>
                    <option value="class-6-8">৬ষ্ঠ-৮ম শ্রেণী (যৌথ)</option>
                    <option value="class-9-10">৯ম-১০ম শ্রেণী (যৌথ)</option>
                    <option value="class-11-12">১১শ-১২শ শ্রেণী (যৌথ)</option>
                    <option value="general">সাধারণ কুইজ / অন্যান্য (General)</option>
                  </select>
                </div>

                <div className="flex gap-3 justify-end pt-4 border-t border-slate-100 dark:border-slate-700 mt-5">
                  <button
                    type="button"
                    disabled={creatingSet}
                    onClick={() => setShowCreateSetModal(false)}
                    className="px-5 py-2.5 bg-slate-100 hover:bg-slate-200 dark:bg-slate-700 dark:hover:bg-slate-600/80 text-slate-700 dark:text-slate-200 font-bold rounded-xl transition cursor-pointer text-sm"
                  >
                    বাতিল
                  </button>
                  <button
                    type="submit"
                    disabled={creatingSet}
                    className="px-6 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white font-bold rounded-xl shadow-lg shadow-indigo-600/15 transition cursor-pointer text-sm"
                  >
                    {creatingSet ? 'তৈরি করা হচ্ছে...' : 'তৈরি করুন'}
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Print / PDF Customizer Setup Modal */}
      <AnimatePresence>
        {showPrintSetupModal && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm z-40"
              onClick={() => setShowPrintSetupModal(false)}
            />

            <motion.div
              initial={{ scale: 0.95, opacity: 0, y: 10 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.95, opacity: 0, y: 10 }}
              className="relative w-full max-w-md bg-white dark:bg-slate-800 rounded-3xl border border-slate-100 dark:border-slate-700 shadow-2xl p-6 md:p-8 z-50 font-bengali text-slate-800 dark:text-white"
            >
              <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-700/65 pb-4 mb-5">
                <h2 className="text-lg font-black text-slate-800 dark:text-white flex items-center gap-1.5 align-middle">
                  <Printer className="w-5 h-5 text-indigo-500" /> প্রিন্ট ও পিডিএফ সেটিংস
                </h2>
                <button 
                  onClick={() => setShowPrintSetupModal(false)}
                  className="p-1.5 bg-slate-50 hover:bg-slate-100 dark:bg-slate-700/50 dark:hover:bg-slate-700/90 text-slate-400 dark:text-slate-300 rounded-xl transition-colors cursor-pointer"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <div className="space-y-4">
                <div>
                  <label className="block text-xs font-black text-slate-500 dark:text-slate-450 uppercase mb-1.5">পিডিএফ/প্রিন্ট শিরোনাম বা নাম:</label>
                  <input
                    type="text"
                    value={printTitle}
                    onChange={(e) => setPrintTitle(e.target.value)}
                    placeholder="যেমন: কুইজ পরীক্ষা - ৬ষ্ঠ শ্রেণি"
                    className="w-full px-4 py-2.5 bg-slate-50 dark:bg-slate-900 border border-slate-100 dark:border-slate-700 rounded-xl text-slate-800 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500/40 text-sm font-bold"
                  />
                  <p className="text-[11px] text-slate-400 mt-1">প্রিন্ট কাগজের উপরে এই নামটি বড় করে ছাপা হবে।</p>
                </div>

                <div className="space-y-3 pt-2">
                  <label className="flex items-center gap-2.5 cursor-pointer select-none">
                    <input
                      type="checkbox"
                      checked={printIncludeStudentHeader}
                      onChange={(e) => setPrintIncludeStudentHeader(e.target.checked)}
                      className="w-4.5 h-4.5 accent-indigo-600 rounded text-indigo-600 focus:ring-indigo-500"
                    />
                    <div>
                      <span className="text-sm font-bold text-slate-800 dark:text-slate-200 block">ছাত্র-ছাত্রীর তথ্য ছক দেখান</span>
                      <span className="text-[11px] text-slate-400 leading-none">নাম, শ্রেণি, রোল ও প্রাপ্ত নম্বর লেখার ঘর থাকবে।</span>
                    </div>
                  </label>

                  <label className="flex items-center gap-2.5 cursor-pointer select-none">
                    <input
                      type="checkbox"
                      checked={printIncludeAnswers}
                      onChange={(e) => setPrintIncludeAnswers(e.target.checked)}
                      className="w-4.5 h-4.5 accent-indigo-600 rounded text-indigo-600 focus:ring-indigo-500"
                    />
                    <div>
                      <span className="text-sm font-bold text-slate-800 dark:text-slate-200 block">উত্তর ও সঠিক অপশন দেখান</span>
                      <span className="text-[11px] text-slate-400 leading-none">সরাসরি প্রিন্ট কপিতে সঠিক উত্তরের দাগ বা ব্যাজ দেখাবে। (ফাঁকা পরীক্ষা বা ব্ল্যাঙ্ক টেস্টের জন্য এটি বন্ধ রাখুন)</span>
                    </div>
                  </label>

                  <label className="flex items-center gap-2.5 cursor-pointer select-none">
                    <input
                      type="checkbox"
                      checked={printIncludeExplanations}
                      onChange={(e) => setPrintIncludeExplanations(e.target.checked)}
                      className="w-4.5 h-4.5 accent-indigo-600 rounded text-indigo-600 focus:ring-indigo-500"
                    />
                    <div>
                      <span className="text-sm font-bold text-slate-800 dark:text-slate-200 block">ব্যাখ্যা এবং সূত্র সমূহ দেখান</span>
                      <span className="text-[11px] text-slate-400 leading-none">প্রশ্নের সাথে যুক্ত ব্যাখ্যা বা Hint-গুলো প্রিন্ট হবে।</span>
                    </div>
                  </label>
                </div>

                <div className="bg-slate-50 dark:bg-slate-900 border border-slate-100 dark:border-slate-850 rounded-2xl p-3.5 mt-2 space-y-1">
                  <p className="text-xs font-bold text-slate-600 dark:text-slate-300">প্রিন্ট প্রিভিউ তথ্য:</p>
                  <p className="text-[11px] text-slate-500 dark:text-slate-400">
                    • মোট প্রশ্নসংখ্যা: <strong className="text-indigo-600 dark:text-indigo-400 font-bold">{filteredQuestions.length} টি</strong>
                  </p>
                  <p className="text-[11px] text-slate-500 dark:text-slate-400">
                    • প্রিন্ট ফরম্যাট: <strong className="text-indigo-600 dark:text-indigo-400 font-bold">{printIncludeAnswers ? 'উত্তরপত্র ও ব্যাখ্যা সহ মূল কপি' : 'উত্তর ছাড়া ফাঁকা পরীক্ষা প্রশ্নপত্র'}</strong>
                  </p>
                </div>

                <div className="flex gap-3 justify-end pt-4 border-t border-slate-100 dark:border-slate-700 mt-5">
                  <button
                    type="button"
                    onClick={() => setShowPrintSetupModal(false)}
                    className="px-5 py-2.5 bg-slate-100 hover:bg-slate-200 dark:bg-slate-700 dark:hover:bg-slate-600/80 text-slate-700 dark:text-slate-200 font-bold rounded-xl transition cursor-pointer text-sm"
                  >
                    বাতিল
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setShowPrintSetupModal(false);
                      handlePrintSet(selectedQuizSetFilter, printIncludeAnswers);
                    }}
                    className="px-5 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-xl shadow-lg shadow-emerald-600/15 transition cursor-pointer text-sm flex items-center gap-1.5"
                  >
                    <Printer className="w-4.5 h-4.5" /> প্রিন্ট স্লট প্রসেস ও প্রিন্ট করুন
                  </button>
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

    </div>
  );
}
