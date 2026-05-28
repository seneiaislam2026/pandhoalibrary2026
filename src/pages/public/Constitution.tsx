import React, { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { BookOpen, Loader2 } from 'lucide-react';
import { db } from '../../lib/firebase';
import { doc, getDoc } from 'firebase/firestore';
import ReactMarkdown from 'react-markdown';

const Constitution = () => {
  const { t } = useTranslation();
  const [content, setContent] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchConstitution = async () => {
      try {
        const docRef = doc(db, 'settings', 'constitution');
        const docSnap = await getDoc(docRef);
        if (docSnap.exists() && docSnap.data().content) {
          setContent(docSnap.data().content);
        } else {
          // Default content
          setContent(`## ১. পাঠাগারের নাম ও ঠিকানা
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

> অনুমোদিত ও কার্যকর: ২৮ মে ২০২০`);
        }
      } catch (err) {
        console.error("Error fetching constitution:", err);
      } finally {
        setLoading(false);
      }
    };
    fetchConstitution();
  }, []);

  if (loading) {
    return (
      <div className="min-h-[60vh] flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-indigo-600" />
      </div>
    );
  }

  return (
    <div className="bg-slate-50 min-h-[80vh] py-20 px-4">
      <div className="container mx-auto max-w-4xl">
        <div className="mb-14 text-center">
          <BookOpen className="w-16 h-16 text-indigo-600 mx-auto mb-6" />
          <h1 className="text-4xl md:text-5xl font-black text-slate-900 mb-4 font-bengali tracking-tight">
            গঠনতন্ত্র
          </h1>
          <p className="text-lg text-slate-600 font-bengali">
            পানধোয়া উন্মুক্ত পাঠাগারের পরিচালনা ও কার্যবিধি
          </p>
        </div>

        <div className="bg-white rounded-3xl p-8 md:p-14 shadow-xl border border-slate-100 shadow-slate-200/50">
          <div className="prose prose-slate max-w-none prose-headings:font-bengali prose-headings:font-bold prose-headings:text-slate-800 prose-p:font-bengali prose-p:text-slate-600 prose-p:leading-relaxed prose-li:font-bengali prose-li:text-slate-600">
            <ReactMarkdown>{content}</ReactMarkdown>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Constitution;
