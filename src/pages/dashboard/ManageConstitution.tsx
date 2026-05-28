import React, { useState, useEffect } from 'react';
import { db } from '../../lib/firebase';
import { doc, getDoc, setDoc } from 'firebase/firestore';
import { toast } from 'react-hot-toast';
import { Save, FileText, Loader2 } from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import { motion } from 'motion/react';

export default function ManageConstitution() {
  const [content, setContent] = useState('');
  const [initialContent, setInitialContent] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [activeTab, setActiveTab] = useState<'edit' | 'preview'>('edit');

  useEffect(() => {
    const fetchConstitution = async () => {
      try {
        const docRef = doc(db, 'settings', 'constitution');
        const docSnap = await getDoc(docRef);
        if (docSnap.exists()) {
          setContent(docSnap.data().content);
          setInitialContent(docSnap.data().content);
        } else {
          // Default constitution markdown
          const defaultContent = `## ১. পাঠাগারের নাম ও ঠিকানা
এই পাঠাগারের নাম "পানধোয়া উন্মুক্ত পাঠাগার"। এর বর্তমান ঠিকানা: পানধোয়া, সেনওয়ালিয়া-1344, আশুলিয়া, সাভার, ঢাকা।

## ২. পাঠাগারের লক্ষ্য ও উদ্দেশ্য
* জ্ঞান-বিজ্ঞানের প্রসার ঘটানো এবং পাঠাভ্যাস গড়ে তোলা।
* সামাজিক ও সাংস্কৃতিক সচেতনতা বৃদ্ধি করা।
* শিক্ষা ও গবেষণায় সহায়তা প্রদান করা।
* সকলের জন্য উন্মুক্ত ও বাধামুক্ত জ্ঞান অর্জনের পরিবেশ তৈরি করা।

## ৩. অরাজনৈতিক অবস্থান
এই পাঠাগার সম্পূর্ণ অরাজনৈতিক এবং অলাভজনক একটি স্বেচ্ছাসেবী প্রতিষ্ঠান। এর কোনো রাজনৈতিক সংশ্লিষ্টতা বা প্রভাব থাকবে না। পাঠাগারের প্ল্যাটফর্ম বা নাম ব্যবহার করে কোনো প্রকার রাজনৈতিক কর্মকাণ্ড পরিচালনা করা সম্পূর্ণ নিষিদ্ধ।

## ৪. সদস্যপদ
* যেকোনো ব্যক্তি নির্দিষ্ট নিয়মাবলী ও ফি প্রদানের মাধ্যমে পাঠাগারের সাধারণ বা আজীবন সদস্য হতে পারবেন।
* পাঠাগারের নিয়ম অমান্য করলে পরিচালনা পর্ষদ যেকোনো সদস্যপদ বাতিল করার অধিকার সংরক্ষণ করে।

## ৫. বই ইস্যু ও ফেরত
* নিবন্ধিত সদস্যরা নির্দিষ্ট সময়ের জন্য বই ইস্যু করতে পারবেন।
* বেঁধে দেওয়া সময়ের মধ্যে বই ফেরত না দিলে জরিমানা প্রযোজ্য হতে পারে।
* বইয়ের কোনো ক্ষতি বা নষ্ট হলে সমমূল্য বা নতুন বই প্রদান করে ক্ষতিপূরণ দিতে হবে।

## ৬. পরিচালনা পর্ষদ
* পাঠাগারের সামগ্রিক উন্নয়ন ও রক্ষণাবেক্ষণের জন্য একটি পরিচালনা পর্ষদ থাকবে।
* পরিচালনা পর্ষদের মেয়াদ ১ বছর হবে। মেয়াদ শেষে নতুন পর্ষদ গঠিত হবে।
* পর্ষদের যেকোনো সিদ্ধান্ত সংখ্যাগরিষ্ঠ মতামতের ভিত্তিতে গৃহীত হবে।

## ৭. তহবিল ও আর্থিক ব্যবস্থাপনা
* সদস্যদের ফি, এককালীন অনুদান বা স্বেচ্ছায় প্রদত্ত চাঁদার মাধ্যমে পাঠাগারের তহবিল গঠিত হবে।
* অর্থ সংক্রান্ত সকল হিসাব স্বচ্ছতার সাথে রক্ষণাবেক্ষণ করা হবে এবং জবাবদিহিতা নিশ্চিত করা হবে।

## ৮. সংশোধন
এই গঠনতন্ত্রের যেকোনো ধারা প্রয়োজনে পরিচালনা পর্ষদ বা সাধারণ সভার সংখ্যাগরিষ্ঠ সম্মতিক্রমে সংশোধন বা পরিমার্জন করা যাবে।

> অনুমোদিত ও কার্যকর: ২৮ মে ২০২০`;
          setContent(defaultContent);
          setInitialContent(defaultContent);
        }
      } catch (err) {
        console.error("Error fetching constitution:", err);
      } finally {
        setLoading(false);
      }
    };
    fetchConstitution();
  }, []);

  const handleSave = async () => {
    setSaving(true);
    try {
      await setDoc(doc(db, 'settings', 'constitution'), {
        content,
        updatedAt: Date.now()
      }, { merge: true });
      setInitialContent(content);
      toast.success('Constitution updated successfully');
    } catch (err) {
      console.error(err);
      toast.error('Failed to update constitution');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="flex justify-center items-center h-64">
        <Loader2 className="w-8 h-8 animate-spin text-indigo-500" />
      </div>
    );
  }

  return (
    <div className="max-w-5xl mx-auto space-y-6 pb-20">
      <div className="flex justify-between items-center bg-white p-6 rounded-2xl shadow-sm border border-slate-100">
        <div>
          <h2 className="text-2xl font-bold text-slate-800 tracking-tight font-bengali">গঠনতন্ত্র ব্যবস্থাপনা</h2>
          <p className="text-slate-500 text-sm mt-1 font-bengali">Markdown ফরম্যাটে পাঠাগারের গঠনতন্ত্র আপডেট করুন।</p>
        </div>
        
        <button 
          onClick={handleSave}
          disabled={saving || content === initialContent}
          className="flex items-center gap-2 bg-indigo-600 text-white px-5 py-2.5 rounded-xl font-bold hover:bg-indigo-700 transition shadow-lg shadow-indigo-100 font-bengali disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {saving ? <Loader2 className="w-5 h-5 animate-spin" /> : <Save className="w-5 h-5" />}
          সেভ করুন
        </button>
      </div>

      <div className="bg-white rounded-2xl shadow-sm border border-slate-100 overflow-hidden flex flex-col min-h-[600px]">
        <div className="flex border-b border-slate-100 bg-slate-50 p-2 gap-2">
          <button 
            onClick={() => setActiveTab('edit')}
            className={`px-6 py-2.5 rounded-lg font-bold text-sm transition-all ${activeTab === 'edit' ? 'bg-white text-indigo-600 shadow-sm border border-slate-200' : 'text-slate-500 hover:bg-slate-200/50'}`}
          >
            ইডিট (Markdown)
          </button>
          <button 
            onClick={() => setActiveTab('preview')}
            className={`px-6 py-2.5 rounded-lg font-bold text-sm transition-all ${activeTab === 'preview' ? 'bg-white text-indigo-600 shadow-sm border border-slate-200' : 'text-slate-500 hover:bg-slate-200/50'}`}
          >
            প্রিভিউ
          </button>
        </div>

        <div className="flex-1 p-6">
          {activeTab === 'edit' ? (
            <textarea
              value={content || ''}
              onChange={(e) => setContent(e.target.value)}
              className="w-full h-full min-h-[500px] p-4 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition-all font-mono text-sm resize-none"
              placeholder="এখানে Markdown ফরম্যাটে গঠনতন্ত্র লিখুন..."
            />
          ) : (
            <div className="prose prose-slate max-w-none p-4 bg-white border border-slate-100 rounded-xl overflow-y-auto">
              <ReactMarkdown>{content}</ReactMarkdown>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
