import React, { useState, useEffect } from 'react';
import { collection, query, getDocs, addDoc, serverTimestamp, deleteDoc, doc } from 'firebase/firestore';
import { db } from '../../lib/firebase';
import { GraduationCap, BookOpen, FileText, Trash2, Link as LinkIcon, Plus } from 'lucide-react';
import toast from 'react-hot-toast';

interface AcademicContent {
  id: string;
  title: string;
  description: string;
  type: string;
  targetClass: string;
  link: string;
  createdAt: any;
}

export default function ManageAcademic() {
  const [contents, setContents] = useState<AcademicContent[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [isModalOpen, setIsModalOpen] = useState(false);

  const [formData, setFormData] = useState({
    title: '',
    description: '',
    type: 'quiz',
    targetClass: 'ক্লাস ৪',
    link: ''
  });

  const types = [
    { value: 'quiz', label: 'কুইজ নির্বাচন' },
    { value: 'lecture', label: 'লেকচার শিট' },
    { value: 'question_bank', label: 'প্রশ্ন ব্যাংক' }
  ];

  const classes = [
    'ক্লাস ৪', 'ক্লাস ৫', 'ক্লাস ৬', 'ক্লাস ৭', 'ক্লাস ৮', 'ক্লাস ৯', 'ক্লাস ১০', 'এইচএসসি (HSC)', 'ফ্রি প্রতিযোগিতা (সবার জন্য)'
  ];

  useEffect(() => {
    fetchContents();
  }, []);

  const fetchContents = async () => {
    setLoading(true);
    try {
      const q = query(collection(db, 'academic_contents'));
      const snap = await getDocs(q);
      const data = snap.docs.map(d => ({ id: d.id, ...d.data() } as AcademicContent));
      data.sort((a, b) => (b.createdAt?.toMillis() || 0) - (a.createdAt?.toMillis() || 0));
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

    setSaving(true);
    const toastId = toast.loading('যোগ করা হচ্ছে...');
    try {
      await addDoc(collection(db, 'academic_contents'), {
        ...formData,
        createdAt: serverTimestamp()
      });
      toast.success('সফলভাবে যোগ করা হয়েছে!', { id: toastId });
      setIsModalOpen(false);
      setFormData({
        title: '',
        description: '',
        type: 'quiz',
        targetClass: 'ক্লাস ৪',
        link: ''
      });
      fetchContents();
    } catch (err) {
      console.error(err);
      toast.error('সমস্যা হয়েছে, আবার চেষ্টা করুন', { id: toastId });
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!window.confirm('আপনি কি সত্যিই এটি মুছে ফেলতে চান?')) return;
    
    const toastId = toast.loading('মুছে ফেলা হচ্ছে...');
    try {
      await deleteDoc(doc(db, 'academic_contents', id));
      toast.success('মুছে ফেলা হয়েছে!', { id: toastId });
      setContents(contents.filter(c => c.id !== id));
    } catch (err) {
      console.error(err);
      toast.error('সমস্যা হয়েছে', { id: toastId });
    }
  };

  return (
    <div className="p-4 sm:p-6 lg:p-8 max-w-7xl mx-auto font-bengali">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-6 mb-8">
        <div>
          <h1 className="text-2xl sm:text-3xl font-black text-slate-800 tracking-tight flex items-center gap-3">
            <GraduationCap className="h-8 w-8 text-fuchsia-600" />
            একাডেমিক কন্ট্রোল প্যানেল
          </h1>
          <p className="mt-2 text-sm text-slate-500 font-medium font-bengali">একাডেমিক পোর্টালের জন্য কুইজ, লেকচার শিট ও প্রশ্ন ব্যাংক যোগ করুন।</p>
        </div>
        <button
          onClick={() => setIsModalOpen(true)}
          className="bg-fuchsia-600 hover:bg-fuchsia-700 text-white px-5 py-2.5 rounded-xl text-sm font-bold shadow-md hover:shadow-lg transition-all flex items-center gap-2"
        >
          <Plus className="w-4 h-4" />
          নতুন কন্টেন্ট যোগ করুন
        </button>
      </div>

      {loading ? (
        <div className="py-20 text-center">
            <div className="w-12 h-12 border-4 border-fuchsia-100 border-t-fuchsia-600 rounded-full animate-spin mx-auto mb-4"></div>
            <p className="text-slate-500 font-bold">লোড হচ্ছে...</p>
        </div>
      ) : (
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr>
                  <th className="bg-slate-50 text-slate-500 font-bold text-xs uppercase tracking-wider px-6 py-4 border-b border-slate-200">ধরন</th>
                  <th className="bg-slate-50 text-slate-500 font-bold text-xs uppercase tracking-wider px-6 py-4 border-b border-slate-200">শিরোনাম</th>
                  <th className="bg-slate-50 text-slate-500 font-bold text-xs uppercase tracking-wider px-6 py-4 border-b border-slate-200">ক্লাস</th>
                  <th className="bg-slate-50 text-slate-500 font-bold text-xs uppercase tracking-wider px-6 py-4 border-b border-slate-200">লিংক</th>
                  <th className="bg-slate-50 text-slate-500 font-bold text-xs uppercase tracking-wider px-6 py-4 border-b border-slate-200 text-right">অ্যাকশন</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-sm">
                {contents.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="px-6 py-8 text-center text-slate-500 font-medium">কোনো কন্টেন্ট পাওয়া যায়নি</td>
                  </tr>
                ) : contents.map(item => (
                  <tr key={item.id} className="hover:bg-slate-50 transition-colors">
                    <td className="px-6 py-4">
                      <span className={`inline-flex items-center px-2.5 py-1 rounded-md text-xs font-bold ${
                         item.type === 'quiz' ? 'bg-indigo-50 text-indigo-700' :
                         item.type === 'lecture' ? 'bg-emerald-50 text-emerald-700' :
                         'bg-amber-50 text-amber-700'
                      }`}>
                         {types.find(t => t.value === item.type)?.label || item.type}
                      </span>
                    </td>
                    <td className="px-6 py-4 font-bold text-slate-800">{item.title}</td>
                    <td className="px-6 py-4 text-slate-600 font-medium">{item.targetClass}</td>
                    <td className="px-6 py-4">
                      <a href={item.link} target="_blank" rel="noopener noreferrer" className="text-fuchsia-600 hover:underline flex items-center gap-1 font-medium">
                        <LinkIcon className="w-3 h-3" /> লিংক
                      </a>
                    </td>
                    <td className="px-6 py-4 text-right">
                      <button
                        onClick={() => handleDelete(item.id)}
                        className="p-2 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors inline-block"
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

      {/* Add Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-sm">
          <div className="bg-white rounded-2xl shadow-xl border border-slate-200 w-full max-w-lg overflow-hidden flex flex-col">
            <div className="px-6 py-4 border-b border-slate-100 bg-slate-50/50 flex items-center justify-between">
              <h3 className="font-black text-slate-800 text-lg flex items-center gap-2">
                <BookOpen className="w-5 h-5 text-fuchsia-600" /> নতুন কন্টেন্ট
              </h3>
              <button onClick={() => setIsModalOpen(false)} className="text-slate-400 hover:text-slate-600 transition-colors">
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
              </button>
            </div>
            
            <form onSubmit={handleSubmit} className="p-6 overflow-y-auto">
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-bold text-slate-700 mb-1">কন্টেন্টের ধরন</label>
                  <select
                    value={formData.type}
                    onChange={e => setFormData({...formData, type: e.target.value})}
                    className="w-full border border-slate-200 rounded-xl p-3 bg-slate-50 focus:bg-white focus:ring-2 focus:ring-fuchsia-500 outline-none"
                  >
                    {types.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-bold text-slate-700 mb-1">শ্রেণী/ক্লাস নির্বাচন</label>
                  <select
                    value={formData.targetClass}
                    onChange={e => setFormData({...formData, targetClass: e.target.value})}
                    className="w-full border border-slate-200 rounded-xl p-3 bg-slate-50 focus:bg-white focus:ring-2 focus:ring-fuchsia-500 outline-none"
                  >
                    {classes.map(c => <option key={c} value={c}>{c}</option>)}
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-bold text-slate-700 mb-1">শিরোনাম</label>
                  <input
                    type="text"
                    required
                    value={formData.title}
                    onChange={e => setFormData({...formData, title: e.target.value})}
                    placeholder="যেমন: বাংলা ২য় পত্র কুইজ"
                    className="w-full border border-slate-200 rounded-xl p-3 bg-slate-50 focus:bg-white focus:ring-2 focus:ring-fuchsia-500 outline-none"
                  />
                </div>

                <div>
                  <label className="block text-sm font-bold text-slate-700 mb-1">বর্ণনা (ঐচ্ছিক)</label>
                  <textarea
                    value={formData.description}
                    onChange={e => setFormData({...formData, description: e.target.value})}
                    placeholder="কিছু বিবরণ লিখুন..."
                    className="w-full border border-slate-200 rounded-xl p-3 bg-slate-50 focus:bg-white focus:ring-2 focus:ring-fuchsia-500 outline-none h-20 resize-none"
                  ></textarea>
                </div>

                <div>
                  <label className="block text-sm font-bold text-slate-700 mb-1">লিংক (গুগল ফর্ম বা ড্রাইভ লিংক)</label>
                  <input
                    type="url"
                    required
                    value={formData.link}
                    onChange={e => setFormData({...formData, link: e.target.value})}
                    placeholder="https://..."
                    className="w-full border border-slate-200 rounded-xl p-3 bg-slate-50 focus:bg-white focus:ring-2 focus:ring-fuchsia-500 outline-none font-sans"
                  />
                </div>
              </div>
              
              <div className="mt-6 pt-4 border-t border-slate-100 flex gap-3 justify-end">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="px-5 py-2.5 rounded-xl font-bold text-slate-500 hover:bg-slate-100 transition-colors"
                >
                  বাতিল
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  className="px-5 py-2.5 rounded-xl font-bold bg-fuchsia-600 text-white hover:bg-fuchsia-700 shadow-md transition-colors disabled:opacity-50"
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
