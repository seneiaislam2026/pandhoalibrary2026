import React, { useEffect, useState } from 'react';
import { useAuth } from '../../store/AuthContext';
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip, Legend } from 'recharts';
import { DollarSign, ArrowUpRight, ArrowDownRight, Plus, Edit2, Trash2, Printer } from 'lucide-react';
import { onSnapshot, collection, doc, setDoc, deleteDoc, updateDoc, writeBatch, query, getDocs } from 'firebase/firestore';
import { db } from '../../lib/firebase';
import toast from 'react-hot-toast';

import { useLocation } from 'react-router-dom';

interface Finance {
  id: string;
  type: 'income' | 'expense';
  amount: number;
  description: string;
  date: string;
}

export default function Finances() {
  const [finances, setFinances] = useState<Finance[]>([]);
  const [loading, setLoading] = useState(true);
  const { user } = useAuth();
  const location = useLocation();
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [selectedMonth, setSelectedMonth] = useState<string>('all');

  const [formData, setFormData] = useState({
    type: 'expense',
    amount: 0,
    description: ''
  });

  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [resetting, setResetting] = useState(false);

  useEffect(() => {
    setLoading(true);
    const q = query(collection(db, 'finances'));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const financeData = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })) as Finance[];
      setFinances(financeData);
      setLoading(false);
    }, (error) => {
      console.error("Error fetching finances:", error);
      setLoading(false);
    });

    return () => unsubscribe();
  }, []);

  const months = Array.from(new Set(finances.map(f => new Date(f.date).toISOString().slice(0, 7)))).sort().reverse();
  const filteredFinances = selectedMonth === 'all' 
    ? finances 
    : finances.filter(f => new Date(f.date).toISOString().slice(0, 7) === selectedMonth);

  const handlePrint = () => {
    const pTotalIncome = filteredFinances.filter(f => f.type === 'income').reduce((acc, curr) => acc + Number(curr.amount), 0);
    const pTotalExpense = filteredFinances.filter(f => f.type === 'expense').reduce((acc, curr) => acc + Number(curr.amount), 0);
    const pBalance = pTotalIncome - pTotalExpense;

    const monthStr = selectedMonth === 'all' 
      ? 'সকল মাস' 
      : new Date(selectedMonth + '-01').toLocaleDateString('bn-BD', { month: 'long', year: 'numeric' });

    const htmlContent = `
      <html>
        <head>
          <title>হিসাব-নিকাশ</title>
          <style>
            body { font-family: 'Arial', sans-serif; padding: 30px; color: #333; }
            h2 { text-align: center; margin-bottom: 5px; font-size: 24px; color: #1e293b; }
            .date-subtitle { text-align: center; margin-bottom: 30px; color: #64748b; font-size: 16px; }
            table { width: 100%; border-collapse: collapse; margin-top: 20px; text-align: left; }
            th, td { border: 1px solid #cbd5e1; padding: 12px; }
            th { background-color: #f8fafc; color: #475569; font-weight: bold; }
            .summary { display: flex; justify-content: space-between; margin-bottom: 20px; font-weight: bold; background: #f8fafc; padding: 15px; border-radius: 8px; border: 1px solid #cbd5e1; }
            .income-text { color: #10b981; }
            .expense-text { color: #e11d48; }
            .balance-text { color: #4f46e5; }
            .text-right { text-align: right; }
            @media print {
              body { padding: 0; }
            }
          </style>
        </head>
        <body>
          <h2>হিসাব-নিকাশ রিপোর্ট</h2>
          <div class="date-subtitle">মাস: ${monthStr}</div>
          
          <div class="summary">
            <div class="income-text">মোট আয়: ৳${pTotalIncome}</div>
            <div class="expense-text">মোট ব্যয়: ৳${pTotalExpense}</div>
            <div class="balance-text">বর্তমান ব্যালেন্স: ৳${pBalance}</div>
          </div>

          <table>
            <thead>
              <tr>
                <th>তারিখ</th>
                <th>বিবরণ</th>
                <th class="text-right">আয়</th>
                <th class="text-right">ব্যয়</th>
              </tr>
            </thead>
            <tbody>
              ${filteredFinances.sort((a,b) => new Date(b.date).getTime() - new Date(a.date).getTime()).map(f => `
                <tr>
                  <td>${new Date(f.date).toLocaleDateString('bn-BD')}</td>
                  <td>${f.description}</td>
                  <td class="text-right ${f.type === 'income' ? 'income-text' : ''}">${f.type === 'income' ? '৳' + f.amount : '-'}</td>
                  <td class="text-right ${f.type === 'expense' ? 'expense-text' : ''}">${f.type === 'expense' ? '৳' + f.amount : '-'}</td>
                </tr>
              `).join('')}
            </tbody>
          </table>
        </body>
      </html>
    `;

    const printWindow = window.open('', '_blank');
    if (printWindow) {
      printWindow.document.open();
      printWindow.document.write(htmlContent);
      printWindow.document.close();
      
      printWindow.onload = () => {
        setTimeout(() => {
           printWindow.focus();
           printWindow.print();
        }, 200);
      };
      
      // Fallback if onload doesn't trigger
      setTimeout(() => {
        printWindow.focus();
        printWindow.print();
      }, 1000);
    } else {
      toast.error('দয়া করে আপনার ব্রাউজারের পপ-আপ ব্লকার বন্ধ করুন।');
      
      // Fallback to iframe if popups are blocked
      const iframe = document.createElement('iframe');
      iframe.style.position = 'absolute';
      iframe.style.width = '0px';
      iframe.style.height = '0px';
      iframe.style.border = 'none';
      document.body.appendChild(iframe);

      const doc = iframe.contentWindow?.document;
      if (doc) {
        doc.open();
        doc.write(htmlContent);
        doc.close();
      }

      setTimeout(() => {
        iframe.contentWindow?.focus();
        iframe.contentWindow?.print();
        setTimeout(() => {
          if (document.body.contains(iframe)) {
            document.body.removeChild(iframe);
          }
        }, 5000);
      }, 500);
    }
  };

  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isSubmitting) return;
    setIsSubmitting(true);
    try {
      if (editingId) {
        await updateDoc(doc(db, 'finances', editingId), formData);
      } else {
        const newDocRef = doc(collection(db, 'finances'));
        await setDoc(newDocRef, { 
          ...formData, 
          id: newDocRef.id,
          date: new Date().toISOString()
        });
      }
      setShowForm(false);
      setEditingId(null);
      setFormData({ type: 'expense', amount: 0, description: '' });
    } catch (error) {
      console.error('Error saving finance record:', error);
      toast.error('Failed to save record');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleEdit = (f: Finance) => {
    setFormData({ type: f.type, amount: f.amount, description: f.description });
    setEditingId(f.id);
    setShowForm(true);
  };

  const handleDelete = async (id: string, force: boolean = false) => {
    if (!force) {
      setDeletingId(id);
      return;
    }
    try {
      await deleteDoc(doc(db, 'finances', id));
      setDeletingId(null);
    } catch (error) {
      console.error('Failed to delete finance record:', error);
      toast.error('Failed to delete record');
    }
  };

  const handleResetAll = async (force: boolean = false) => {
    if (!force) {
      setResetting(true);
      return;
    }
    try {
      const q = query(collection(db, 'finances'));
      const snapshot = await getDocs(q);
      const batch = writeBatch(db);
      snapshot.docs.forEach(doc => {
        batch.delete(doc.ref);
      });
      await batch.commit();
      setResetting(false);
    } catch (error) {
      console.error('Failed to reset records:', error);
      toast.error('Failed to reset records');
    }
  };

  const totalIncome = filteredFinances.filter(f => f.type === 'income').reduce((acc, curr) => acc + Number(curr.amount), 0);
  const totalExpense = filteredFinances.filter(f => f.type === 'expense').reduce((acc, curr) => acc + Number(curr.amount), 0);
  const balance = totalIncome - totalExpense;

  const isAdmin = user?.role === 'admin' || (user?.role === 'subadmin' && user?.subadminAccess?.includes('/dashboard/finances'));
  const isDashboard = location.pathname.startsWith('/dashboard');

  const chartData = [
    { name: 'আয়', value: totalIncome },
    { name: 'ব্যয়', value: totalExpense }
  ];
  const COLORS = ['#10b981', '#f43f5e'];

  const content = (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h2 className="text-2xl font-bold font-bengali text-slate-900 tracking-tight">হিসাব-নিকাশ</h2>
        {isAdmin && (
          <button 
            onClick={() => { setShowForm(!showForm); setEditingId(null); setFormData({ type: 'expense', amount: 0, description: '' }); }}
            className="bg-slate-900 text-white px-5 py-2.5 rounded-xl font-bold font-bengali hover:bg-slate-800 transition flex items-center gap-2 shadow-sm"
          >
            <Plus className="w-4 h-4" /> {editingId ? 'রেকর্ড এডিট করুন' : 'নতুন রেকর্ড যোগ করুন'}
          </button>
        )}
      </div>

      {showForm && isAdmin && (
        <form onSubmit={handleSubmit} className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200 grid grid-cols-1 md:grid-cols-4 gap-4 items-end">
          <div>
            <label className="block text-sm font-bold text-slate-700 mb-1.5 font-bengali">খাতের ধরণ</label>
            <select
              value={formData.type}
              onChange={e => setFormData({ ...formData, type: e.target.value as 'income' | 'expense' })}
              className="w-full px-4 py-2.5 border border-slate-200 rounded-xl font-bengali font-bold text-slate-700 focus:ring-2 focus:ring-indigo-500 bg-slate-50 focus:bg-white transition-colors"
            >
              <option value="income">আয়</option>
              <option value="expense">ব্যয়</option>
            </select>
          </div>
          <div>
            <label className="block text-sm font-bold text-slate-700 mb-1.5 font-bengali">পরিমাণ (৳)</label>
            <input
              type="number"
              required
              min="0"
              value={formData.amount || ''}
              onChange={e => setFormData({ ...formData, amount: Number(e.target.value) })}
              className="w-full px-4 py-2.5 border border-slate-200 rounded-xl font-mono font-bold text-slate-700 focus:ring-2 focus:ring-indigo-500 bg-slate-50 focus:bg-white transition-colors"
            />
          </div>
          <div className="md:col-span-2 flex gap-4">
            <div className="flex-1">
              <label className="block text-sm font-bold text-slate-700 mb-1.5 font-bengali">বিবরণ</label>
              <input
                type="text"
                required
                value={formData.description || ''}
                onChange={e => setFormData({ ...formData, description: e.target.value })}
                className="w-full px-4 py-2.5 border border-slate-200 rounded-xl font-bengali font-bold text-slate-700 focus:ring-2 focus:ring-indigo-500 bg-slate-50 focus:bg-white transition-colors"
              />
            </div>
            <button type="submit" disabled={isSubmitting} className="bg-indigo-600 text-white px-6 py-2.5 rounded-xl font-bold hover:bg-indigo-700 h-[46px] self-end font-bengali shadow-sm disabled:opacity-50 flex items-center justify-center gap-2">
              {isSubmitting && <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />}
              সংরক্ষণ
            </button>
          </div>
        </form>
      )}

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="bg-white rounded-2xl p-6 shadow-sm border border-slate-200 flex flex-col justify-center">
          <div className="flex items-center gap-3 text-emerald-600 mb-3">
             <ArrowUpRight className="w-6 h-6 bg-emerald-100 rounded-full p-1" />
             <span className="font-bold tracking-widest text-[11px] uppercase font-bengali text-slate-500">মোট আয়</span>
          </div>
          <p className="text-4xl font-black text-slate-900 tracking-tight font-mono">৳{totalIncome}</p>
        </div>

        <div className="bg-white rounded-2xl p-6 shadow-sm border border-slate-200 flex flex-col justify-center transition-all hover:shadow-md">
          <div className="flex items-center gap-3 text-rose-600 mb-3">
             <ArrowDownRight className="w-6 h-6 bg-rose-100 rounded-full p-1" />
             <span className="font-bold tracking-widest text-[11px] uppercase font-bengali text-slate-500">মোট ব্যয়</span>
          </div>
          <p className="text-4xl font-black text-slate-900 tracking-tight font-mono">৳{totalExpense}</p>
        </div>

        <div className="bg-slate-900 rounded-2xl p-6 shadow-sm flex flex-col justify-center text-white transition-all hover:shadow-md border border-slate-800 relative overflow-hidden">
          <div className="absolute top-0 right-0 w-32 h-32 bg-indigo-500 rounded-full blur-[80px] opacity-20 pointer-events-none"></div>
          <div className="relative z-10">
            <div className="flex items-center gap-3 text-indigo-400 mb-3">
               <DollarSign className="w-6 h-6 bg-indigo-500/20 rounded-full p-1 text-indigo-400" />
               <span className="font-bold tracking-widest text-[11px] uppercase font-bengali text-slate-400">বর্তমান ব্যালেন্স</span>
            </div>
            <p className="text-4xl font-black text-white tracking-tight font-mono">৳{balance}</p>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="bg-white rounded-2xl shadow-sm border border-slate-200 lg:col-span-2 overflow-hidden flex flex-col">
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between p-6 border-b border-slate-100 bg-[#f8fafc] gap-4">
            <h3 className="font-bold text-lg font-bengali text-slate-800 flex items-center gap-2">
              লেনদেনের রেকর্ড
            </h3>
            <div className="flex flex-wrap items-center gap-3 w-full sm:w-auto">
              <select
                value={selectedMonth}
                onChange={(e) => setSelectedMonth(e.target.value)}
                className="px-4 py-2 border border-slate-200 rounded-xl font-bold font-bengali text-sm text-slate-700 bg-white shadow-sm focus:ring-2 focus:ring-indigo-500 outline-none w-full sm:w-auto"
              >
                <option value="all">সব মাস</option>
                {months.map(m => (
                  <option key={m} value={m}>
                    {new Date(m + '-01').toLocaleDateString('bn-BD', { month: 'long', year: 'numeric' })}
                  </option>
                ))}
              </select>
              <button
                onClick={handlePrint}
                className="bg-indigo-50 text-indigo-700 hover:bg-indigo-100 hover:text-indigo-800 px-4 py-2 rounded-xl text-sm font-bold transition flex items-center gap-2 cursor-pointer border border-indigo-100 w-full justify-center sm:w-auto shadow-sm"
              >
                <Printer className="w-4 h-4" />
                <span className="font-bengali">প্রিন্ট</span>
              </button>

              {isAdmin && (
                resetting ? (
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-rose-500 font-bold font-bengali">নিশ্চিত?</span>
                    <button onClick={() => handleResetAll(true)} className="text-xs bg-rose-600 text-white hover:bg-rose-700 px-4 py-2 rounded-xl font-bold transition whitespace-nowrap shadow-sm font-bengali">মুছুন</button>
                    <button onClick={() => setResetting(false)} className="text-xs bg-slate-200 text-slate-700 hover:bg-slate-300 px-4 py-2 rounded-xl font-bold transition whitespace-nowrap font-bengali">বাতিল</button>
                  </div>
                ) : (
                  <button 
                    onClick={() => handleResetAll(false)} 
                    className="text-xs bg-white text-rose-600 hover:bg-rose-50 px-4 py-2 rounded-xl font-bold border border-rose-100 transition whitespace-nowrap font-bengali w-full justify-center sm:w-auto shadow-sm"
                  >
                    সব মুছুন
                  </button>
                )
              )}
            </div>
          </div>
          <div className="flex flex-col flex-1">
            <div className="hidden md:grid grid-cols-12 gap-4 p-4 bg-slate-50 border-b border-slate-200">
               <div className="col-span-3 text-xs font-black text-slate-500 uppercase tracking-widest font-bengali">তারিখ</div>
               <div className="col-span-5 text-xs font-black text-slate-500 uppercase tracking-widest font-bengali">বিবরণ</div>
               <div className="col-span-2 text-xs font-black text-slate-500 uppercase tracking-widest text-right font-bengali">পরিমাণ</div>
               {isAdmin && <div className="col-span-2 text-xs font-black text-slate-500 uppercase tracking-widest text-right font-bengali">অ্যাকশন</div>}
            </div>
            
            <div className="divide-y divide-slate-100 flex flex-col">
              {filteredFinances.sort((a,b) => new Date(b.date).getTime() - new Date(a.date).getTime()).map(f => (
                <div key={f.id} className="grid grid-cols-1 md:grid-cols-12 gap-y-3 gap-x-4 p-4 hover:bg-slate-50/80 transition-colors group items-start md:items-center">
                  <div className="col-span-1 border-b md:border-b-0 pb-3 md:pb-0 border-slate-100 md:col-span-3 flex items-center justify-between md:justify-start">
                     <span className="text-xs font-bold text-slate-500 bg-slate-100 px-2 py-0.5 rounded md:hidden">তারিখ</span>
                     <span className="text-sm font-medium text-slate-500 font-mono whitespace-nowrap">{new Date(f.date).toLocaleDateString()}</span>
                  </div>
                  <div className="col-span-1 border-b md:border-b-0 pb-3 md:pb-0 border-slate-100 md:col-span-5 flex flex-col md:block">
                     <span className="text-xs font-bold text-slate-500 bg-slate-100 px-2 py-0.5 rounded mb-1 md:hidden w-fit">বিবরণ</span>
                     <span className="font-bold text-slate-800 font-bengali text-lg md:text-base">{f.description}</span>
                  </div>
                  <div className="col-span-1 border-b md:border-b-0 pb-3 md:pb-0 border-slate-100 md:col-span-2 flex items-center justify-between md:justify-end">
                     <span className="text-xs font-bold text-slate-500 bg-slate-100 px-2 py-0.5 rounded md:hidden">পরিমাণ</span>
                     <span className={`font-black font-mono text-xl md:text-base whitespace-nowrap flex items-center gap-1 ${f.type === 'income' ? 'text-emerald-600' : 'text-rose-600'}`}>
                        {f.type === 'income' ? '+' : '-'}৳{f.amount}
                     </span>
                  </div>
                  {isAdmin && (
                     <div className="col-span-1 md:col-span-2 flex justify-start md:justify-end mt-1 md:mt-0">
                         {deletingId === f.id ? (
                            <div className="flex justify-end gap-2 items-center w-full md:w-auto">
                               <button onClick={() => handleDelete(f.id, true)} className="flex-1 md:flex-none px-3 py-1.5 bg-rose-600 text-white text-xs rounded-lg font-bold shadow-sm font-bengali">নিশ্চিত</button>
                               <button onClick={() => setDeletingId(null)} className="flex-1 md:flex-none px-3 py-1.5 bg-slate-200 text-slate-700 text-xs rounded-lg font-bold font-bengali">বাতিল</button>
                            </div>
                         ) : (
                            <div className="flex justify-end gap-2 w-full md:w-auto opacity-100 sm:opacity-0 sm:group-hover:opacity-100 transition-opacity">
                              <button onClick={() => handleEdit(f)} className="flex-1 md:flex-none p-2 border border-slate-200 text-slate-500 hover:text-indigo-600 hover:border-indigo-200 bg-white hover:bg-indigo-50 flex items-center justify-center rounded-xl transition-all shadow-sm"><Edit2 className="w-4 h-4" /><span className="ml-2 text-xs md:hidden font-bengali font-bold">এডিট</span></button>
                              <button onClick={() => handleDelete(f.id)} className="flex-1 md:flex-none p-2 border border-slate-200 text-slate-500 hover:text-rose-600 hover:border-rose-200 bg-white hover:bg-rose-50 flex items-center justify-center rounded-xl transition-all shadow-sm"><Trash2 className="w-4 h-4" /><span className="ml-2 text-xs md:hidden font-bengali font-bold">ডিলিট</span></button>
                            </div>
                         )}
                     </div>
                  )}
                </div>
              ))}
            </div>
            {filteredFinances.length === 0 && (
               <div className="flex flex-col items-center justify-center p-12 text-slate-400">
                  <div className="w-16 h-16 bg-slate-100 rounded-full mb-4 flex items-center justify-center">
                     <DollarSign className="w-8 h-8 text-slate-300" />
                  </div>
                  <p className="font-bold font-bengali text-slate-500">কোনো লেনদেনের রেকর্ড পাওয়া যায়নি</p>
               </div>
            )}
          </div>
        </div>

        <div className="bg-white rounded-2xl p-6 shadow-sm border border-slate-200 flex flex-col justify-center">
           <h3 className="font-bold text-lg mb-6 self-start font-bengali text-slate-800">আয় বনাম ব্যয়</h3>
           {totalIncome === 0 && totalExpense === 0 ? (
             <div className="text-slate-400 py-12 text-center font-bold font-bengali bg-slate-50 rounded-xl border border-dashed border-slate-200">কোনো ডেটা নেই</div>
           ) : (
             <div className="w-full h-72">
               <ResponsiveContainer width="100%" height="100%">
                 <PieChart>
                   <Pie
                     data={chartData}
                     cx="50%"
                     cy="50%"
                     innerRadius={60}
                     outerRadius={80}
                     paddingAngle={5}
                     dataKey="value"
                   >
                     {chartData.map((entry, index) => (
                       <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                     ))}
                   </Pie>
                   <Tooltip formatter={(value) => `৳${value}`} />
                   <Legend verticalAlign="bottom" height={36} />
                 </PieChart>
               </ResponsiveContainer>
             </div>
           )}
        </div>
      </div>
    </div>
  );

  if (isDashboard) return content;

  return (
    <div className="min-h-screen bg-slate-50 py-12 px-4 sm:px-6 lg:px-8">
       <div className="max-w-7xl mx-auto">
          {content}
       </div>
    </div>
  );
}
