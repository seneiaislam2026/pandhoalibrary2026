import React, { useState } from 'react';
import { Heart } from 'lucide-react';
import { doc, setDoc, collection, serverTimestamp } from 'firebase/firestore';
import { db } from '../../lib/firebase';
import toast from 'react-hot-toast';

export default function MonthlyDonors() {
  const [formName, setFormName] = useState('');
  const [formAmount, setFormAmount] = useState(500);
  const [month, setMonth] = useState(() => {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
  });
  const [submitted, setSubmitted] = useState(false);
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formName || !formAmount || !month) return;

    setLoading(true);
    try {
      const newDocRef = doc(collection(db, "donations"));
      await setDoc(newDocRef, {
        name: formName + ' (Monthly Member)',
        amount: formAmount,
        type: 'monthly',
        month,
        date: new Date().toISOString(),
        createdAt: serverTimestamp()
      });
      setSubmitted(true);
      setTimeout(() => {
        setSubmitted(false);
        setFormName('');
        setFormAmount(500);
      }, 4000);
    } catch (err) {
      console.error(err);
      toast.error("Failed to submit");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="py-24 bg-slate-50 dark:bg-slate-900 min-h-screen transition-colors">
      <div className="mx-auto max-w-7xl px-6 lg:px-8">
        <div className="mx-auto max-w-2xl text-center">
          <h2 className="text-3xl font-bold tracking-tight text-slate-900 dark:text-white sm:text-4xl text-center">Monthly Donor Members</h2>
          <p className="mt-2 text-lg leading-8 text-slate-600 dark:text-slate-400 text-center">
            Log your monthly contribution below. Thank you for supporting Pandhoa Open Library.
          </p>
        </div>

        <div className="mx-auto mt-16 max-w-xl">
          <div className="bg-white dark:bg-slate-800 rounded-3xl shadow-xl border border-slate-100 dark:border-slate-700 overflow-hidden transition-colors">
            <div className="bg-indigo-600 dark:bg-indigo-700 p-8 text-center transition-colors">
              <Heart className="w-12 h-12 text-white/90 mx-auto mb-4" />
              <h3 className="text-2xl font-bold text-white">Donor Member Portal</h3>
              <p className="text-indigo-100 dark:text-indigo-200 mt-2 text-sm">Submit your monthly donation records securely.</p>
            </div>
            
            <div className="p-8">
              {submitted ? (
                <div className="text-center py-12">
                  <div className="w-16 h-16 bg-emerald-100 dark:bg-emerald-900/40 text-emerald-600 dark:text-emerald-400 rounded-full flex items-center justify-center mx-auto mb-4">
                    <Heart className="w-8 h-8" />
                  </div>
                  <h4 className="text-xl font-bold text-slate-900 dark:text-white mb-2">Thank You!</h4>
                  <p className="text-slate-600 dark:text-slate-400">Your monthly donation record for {month} has been received.</p>
                </div>
              ) : (
                <form onSubmit={handleSubmit} className="space-y-6">
                  <div>
                    <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Your Full Name</label>
                    <input
                      type="text"
                      required
                      value={formName}
                      onChange={(e) => setFormName(e.target.value)}
                      className="w-full px-4 py-3 bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-600 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-all text-slate-900 dark:text-white"
                      placeholder="e.g. Rahim Uddin"
                    />
                  </div>
                  
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Contribution Month</label>
                      <input
                        type="month"
                        required
                        value={month}
                        onChange={(e) => setMonth(e.target.value)}
                        className="w-full px-4 py-3 bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-600 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-all text-slate-900 dark:text-white"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Amount (৳)</label>
                      <input
                        type="number"
                        required
                        value={formAmount}
                        onChange={(e) => setFormAmount(Number(e.target.value))}
                        className="w-full px-4 py-3 bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-600 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-all text-slate-900 dark:text-white"
                      />
                    </div>
                  </div>

                  <button
                    type="submit"
                    className="w-full py-4 bg-indigo-600 hover:bg-indigo-700 dark:bg-indigo-500 dark:hover:bg-indigo-600 text-white rounded-xl font-semibold shadow-md transition-all flex items-center justify-center gap-2"
                  >
                    Confirm Monthly Donation
                  </button>
                </form>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
