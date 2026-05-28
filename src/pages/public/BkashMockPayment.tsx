import React, { useEffect, useState } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { useAuth } from '../../store/AuthContext';
import { db } from '../../lib/firebase';
import { collection, doc, setDoc, serverTimestamp } from 'firebase/firestore';

export default function BkashMockPayment() {
  const [params] = useSearchParams();
  const paymentID = params.get('paymentID');
  const amount = params.get('amount');
  const month = params.get('month');
  const type = params.get('type') || 'monthly';
  
  const navigate = useNavigate();
  const { user } = useAuth();
  
  const [status, setStatus] = useState('Processing...');

  useEffect(() => {
    if (!paymentID || !user) {
      navigate('/dashboard/profile');
      return;
    }
    
    // Simulate some loading
    setTimeout(() => {
      setStatus('Waiting for confirmation...');
    }, 1500);
  }, [paymentID, navigate, user]);

  const handleConfirm = async () => {
    if (!user) return;
    setStatus('Executing payment...');
    try {
      // Record payment in Firestore
      const newPaymentRef = doc(collection(db, "payments"));
      await setDoc(newPaymentRef, {
        userId: user.id,
        userName: user.name,
        amount: Number(amount) || 0,
        month: month || '',
        status: 'Approved',
        trxId: paymentID,
        date: new Date().toISOString(),
        type: type,
        createdAt: serverTimestamp()
      });

      setStatus('Payment Successful! Redirecting...');
      setTimeout(() => navigate('/dashboard/profile'), 2000);
    } catch (e) {
      console.error(e);
      setStatus('Error connecting to bKash');
    }
  };

  const handleCancel = () => {
    setStatus('Payment Cancelled. Redirecting...');
    setTimeout(() => navigate('/dashboard/profile'), 1500);
  };

  return (
    <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4">
       <div className="bg-white max-w-sm w-full rounded-2xl shadow-lg border border-pink-100 overflow-hidden text-center">
          <div className="bg-[#E2136E] text-white py-6">
             <h1 className="text-2xl font-black tracking-widest">bKash</h1>
             <p className="text-sm font-medium mt-1 opacity-90">Secure Payment Gateway</p>
          </div>
          <div className="p-8">
             <p className="text-lg font-bold text-slate-800 mb-2">{status}</p>
             <p className="text-xs text-slate-500 font-mono mb-8">TrxID: {paymentID}</p>
             
             {status === 'Waiting for confirmation...' && (
               <div className="space-y-3">
                 <button onClick={handleConfirm} className="w-full bg-[#E2136E] hover:bg-[#c91162] text-white font-bold py-3 rounded-xl transition shadow-md">
                   Confirm Payment
                 </button>
                 <button onClick={handleCancel} className="w-full bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold py-3 rounded-xl transition">
                   Cancel
                 </button>
               </div>
             )}
          </div>
       </div>
    </div>
  );
}
