import React, { useState } from 'react';
import { collection, addDoc, getDocs, query, orderBy, limit, serverTimestamp, setDoc, doc } from 'firebase/firestore';
import { db } from '../../lib/firebase';
import { toast } from 'react-hot-toast';
import { FileText, Save, CheckCircle, Printer } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

export default function ScholarshipRegistration() {
  const [formData, setFormData] = useState({
    studentName: '',
    fatherName: '',
    motherName: '',
    studentClass: '',
    institution: '',
    dob: '',
    bloodGroup: '',
    presentAddress: '',
    permanentAddress: '',
    mobile: '',
    emergencyContact: '',
    birthCertificate: false,
    idCard: false,
    parentsIdCard: false,
    termsAccepted: false
  });

  const [loading, setLoading] = useState(false);
  const [successData, setSuccessData] = useState<{ applicationId: string, name: string } | null>(null);

  const executePrintApplicantForm = () => {
    if (!successData) return;
    const printWindow = window.open('', '_blank');
    if (!printWindow) {
      toast.error('উইন্ডো ওপেন করা সম্ভব হয়নি। দয়া করে পপআপ ব্লকার চেক করুন।');
      return;
    }
    
    printWindow.document.write(`
    <!DOCTYPE html>
    <html lang="bn">
    <head>
        <meta charset="UTF-8">
        <title>শিক্ষাবৃত্তি আবেদন ফর্ম - ${successData.applicationId}</title>
        <link href="https://fonts.googleapis.com/css2?family=Outfit:wght@400;500;600;700&family=Hind+Siliguri:wght@400;500;600;700&family=Noto+Serif+Bengali:wght@400;600;700&display=swap" rel="stylesheet">
        <style>
            :root {
                --primary-color: #16a34a;
                --secondary-color: #64748b;
            }
            body {
                font-family: 'Hind Siliguri', sans-serif;
                background-color: #e2e8f0;
                margin: 0;
                padding: 20px;
                color: #0f172a;
                font-size: 14px;
            }
            .form-page {
                width: 210mm;
                min-height: 297mm;
                background: #ffffff;
                margin: 0 auto;
                margin-bottom: 20px;
                padding: 15mm 20mm;
                box-sizing: border-box;
                box-shadow: 0 10px 25px rgba(0, 0, 0, 0.1);
                position: relative;
                border: 1px solid #cbd5e1;
                page-break-after: always;
            }
            .form-page:last-child {
                page-break-after: auto;
            }
            .form-page::before {
                content: '';
                position: absolute;
                top: 50%;
                left: 50%;
                transform: translate(-50%, -50%);
                width: 400px;
                height: 400px;
                background-image: url('https://i.ibb.co/b5B2gv9b/1777771470223.jpg');
                background-size: contain;
                background-repeat: no-repeat;
                background-position: center;
                opacity: 0.05;
                pointer-events: none;
                z-index: 0;
            }
            .content-wrapper {
                position: relative;
                z-index: 1;
            }
            .form-header {
                display: flex;
                align-items: center;
                justify-content: space-between;
                border-bottom: 2px double var(--primary-color);
                padding-bottom: 15px;
                margin-bottom: 20px;
            }
            .form-logo {
                width: 90px;
                height: 90px;
                object-fit: contain;
            }
            .form-header-text {
                flex: 1;
                text-align: center;
                padding: 0 15px;
            }
            .form-title {
                font-size: 28px;
                font-weight: 700;
                margin: 0 0 8px;
                color: var(--primary-color);
                font-family: 'Noto Serif Bengali', serif;
                letter-spacing: 0.5px;
            }
            .form-subtitle {
                font-size: 16px;
                margin-bottom: 4px;
                font-weight: 600;
                color: var(--secondary-color);
            }
            .form-address {
                font-size: 16px;
                margin-bottom: 4px;
                font-weight: 600;
                color: #334155;
            }
            .form-mobile {
                font-size: 15px;
                font-weight: 600;
                color: #334155;
            }
            .header-photo-box {
                width: 40mm;
                height: 50mm;
                border: 2px dashed #94a3b8;
                border-radius: 8px;
                display: flex;
                flex-direction: column;
                align-items: center;
                justify-content: center;
                font-size: 14px;
                color: #64748b;
                text-align: center;
                background: #f8fafc;
            }
            .section-title-wrapper {
                text-align:center; 
                margin-bottom: 20px;
            }
            .section-title {
                display:inline-block; 
                background: var(--primary-color); 
                color: white; 
                padding: 8px 30px; 
                border-radius: 30px; 
                font-weight: 700; 
                font-size: 22px; 
                letter-spacing: 0.5px;
                box-shadow: 0 4px 6px rgba(22, 163, 74, 0.2);
            }
            .data-table {
                width: 100%;
                border-collapse: collapse;
                margin-bottom: 20px;
            }
            .data-table td {
                padding: 12px 0;
                vertical-align: top;
                font-size: 18px;
            }
            .input-line {
                display: inline-block;
                border-bottom: 1px dotted #64748b;
                min-width: 250px;
                margin-left: 5px;
                color: #0f172a;
                font-weight: 700;
            }
            .agreement-box {
                margin-top: 20px;
                padding: 20px;
                background: #f8fafc;
                border: 1px solid #e2e8f0;
                border-radius: 12px;
                margin-bottom: 30px;
            }
            .agreement-title {
                font-weight: 700; 
                font-size: 18px; 
                color: var(--primary-color);
                margin-bottom: 8px;
            }
            .agreement-text {
                text-align: justify; 
                line-height: 1.6; 
                font-size: 16px;
                color: #334155;
            }
            .signature-sections {
                width: 100%; 
                margin-top: 40px; 
                text-align: center;
                table-layout: fixed;
            }
            .signature-sections td {
                width: 33.33%;
            }
            .sig-line {
                border-top: 1px solid #1e293b; 
                padding-top: 6px;
                display: inline-block;
                min-width: 150px;
                font-weight: 600;
                color: #475569;
            }
            .divider {
                border-top: 2px dashed #cbd5e1; 
                margin: 10px 0;
            }
            .attachments-list {
                margin-top: 10px;
                font-weight: 600;
                color: #1e293b;
            }
            .attachments-list ul {
                list-style-type: square;
                margin-top: 5px;
                padding-left: 20px;
                color: #334155;
            }
            @media print {
                body {
                    background-color: transparent;
                    padding: 0;
                }
                .form-page {
                    box-shadow: none;
                    margin: 0;
                    padding: 5mm;
                    width: 100%;
                    min-height: 100%;
                    border: none;
                }
                .no-print { display: none !important; }
            }
            .no-print { position: fixed; top: 20px; right: 20px; z-index: 1000; }
            .print-btn {
                background: #16a34a; 
                color: white; 
                border: none; 
                padding: 12px 24px; 
                border-radius: 8px; 
                font-family: 'Hind Siliguri', sans-serif; 
                font-weight: bold; 
                cursor: pointer; 
                font-size: 16px;
                box-shadow: 0 4px 6px rgba(22, 163, 74, 0.2);
                transition: all 0.2s;
            }
            .print-btn:hover {
                background: #15803d;
                transform: translateY(-1px);
            }
            .filled-value {
                color: #0f172a;
                font-weight: 700;
                font-size: 18px;
                border-bottom: 1px dashed #94a3b8;
                padding: 0 4px;
            }
        </style>
    </head>
    <body onload="setTimeout(function(){ window.print(); }, 800)">
        <div class="no-print">
            <button onclick="window.print()" class="print-btn">🖨️ প্রিন্ট করুন</button>
        </div>
        <div class="form-page">
            <div class="content-wrapper">
                <div class="form-header">
                    <img src="https://i.ibb.co/b5B2gv9b/1777771470223.jpg" alt="Logo" class="form-logo" crossorigin="anonymous" referrerpolicy="no-referrer" />
                    <div class="form-header-text">
                        <h1 class="form-title">পানধোয়া উন্মুক্ত পাঠাগার</h1>
                        <div class="form-subtitle">স্থাপিত: ২৮ মে ২০২০</div>
                        <div class="form-address">পানধোয়া, সেনওয়ালিয়া-১৩৪৪, আশুলিয়া, সাভার</div>
                        <div class="form-mobile">মোবাইল: ০১৫৭০২০৬৯৫৩</div>
                    </div>
                    <div class="header-photo-box">
                        <svg style="width: 32px; height: 32px; margin-bottom: 8px; color: #94a3b8;" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z"></path></svg>
                        <span>পাসপোর্ট<br>সাইজ ছবি</span>
                    </div>
                </div>
                
                <div class="section-title-wrapper">
                   <div class="section-title">শিক্ষাবৃত্তি আবেদন ফর্ম</div>
                </div>
                
                <div class="form-body">
                    <table class="data-table">
                        <tr><td width="30%">১। শিক্ষার্থীর নাম</td><td colspan="3">: <span class="filled-value">${formData.studentName || ''}</span></td></tr>
                        <tr><td width="30%">২। পিতার নাম</td><td colspan="3">: <span class="filled-value">${formData.fatherName || ''}</span></td></tr>
                        <tr><td width="30%">৩। মাতার নাম</td><td colspan="3">: <span class="filled-value">${formData.motherName || ''}</span></td></tr>
                        <tr>
                            <td width="30%">৪। পেশা</td>
                            <td width="30%">: <span class="filled-value">ছাত্র/ছাত্রী</span></td>
                            <td width="15%" style="text-align: right; padding-right: 10px;">শ্রেণি</td>
                            <td width="25%">: <span class="filled-value">${formData.studentClass || ''}</span></td>
                        </tr>
                        <tr><td width="30%">৫। শিক্ষাপ্রতিষ্ঠান</td><td colspan="3">: <span class="filled-value">${formData.institution || ''}</span></td></tr>
                        <tr>
                            <td width="30%">৬। জন্ম তারিখ</td>
                            <td width="30%">: <span class="filled-value">${formData.dob || ''}</span></td>
                            <td width="15%" style="text-align: right; padding-right: 10px;">রক্তের গ্রুপ</td>
                            <td width="25%">: <span class="filled-value">${formData.bloodGroup || ''}</span></td>
                        </tr>
                        <tr><td width="30%">৭। বর্তমান ঠিকানা</td><td colspan="3">: <span class="filled-value">${formData.presentAddress || ''}</span></td></tr>
                        <tr><td width="30%">৮। স্থায়ী ঠিকানা</td><td colspan="3">: <span class="filled-value">${formData.permanentAddress || ''}</span></td></tr>
                        <tr>
                            <td width="30%">৯। মোবাইল নম্বর</td>
                            <td colspan="3">: <span class="filled-value">${formData.mobile || ''}</span></td>
                        </tr>
                        <tr><td width="30%">১০। ইমার্জেন্সি যোগাযোগ</td><td colspan="3">: <span class="filled-value">${formData.emergencyContact || ''}</span></td></tr>
                    </table>
                </div>
            </div>
        </div>

        <div class="form-page">
            <div class="content-wrapper">
                <div class="form-header">
                    <img src="https://i.ibb.co/b5B2gv9b/1777771470223.jpg" alt="Logo" class="form-logo" crossorigin="anonymous" referrerpolicy="no-referrer" />
                    <div class="form-header-text">
                        <h1 class="form-title">পানধোয়া উন্মুক্ত পাঠাগার</h1>
                        <div class="form-subtitle">স্থাপিত: ২৮ মে ২০২০</div>
                        <div class="form-address">পানধোয়া, সেনওয়ালিয়া-১৩৪৪, আশুলিয়া, সাভার</div>
                        <div class="form-mobile">মোবাইল: ০১৫৭০২০৬৯৫৩</div>
                    </div>
                </div>

                <div class="form-body">
                    <div class="attachments-list">
                        সংযুক্তি:
                        <ul>
                            <li>জন্ম নিবন্ধন ${formData.birthCertificate ? '(✓)' : '( )'}</li>
                            <li>আইডি কার্ড ${formData.idCard ? '(✓)' : '( )'}</li>
                            <li>পিতা/মাতার আইডি কার্ড ${formData.parentsIdCard ? '(✓)' : '( )'}</li>
                        </ul>
                    </div>

                    <div class="agreement-box">
                       <div class="agreement-title">অঙ্গীকারনামা:</div>
                       <div class="agreement-text">
                           আমি এই মর্মে অঙ্গীকার করছি যে, উপরে প্রদত্ত সকল তথ্য সম্পূর্ণ সত্য। পানধোয়া উন্মুক্ত পাঠাগার এর শিক্ষাবৃত্তির সকল নিয়ম-কানুন ও শৃঙ্খলা আমি মেনে চলব। 
                       </div>
                    </div>

                    <table class="signature-sections">
                        <tr>
                            <td><span class="sig-line">আবেদনকারীর স্বাক্ষর ও তারিখ</span></td>
                            <td></td>
                            <td><span class="sig-line">পিতা/অভিভাবকের স্বাক্ষর</span></td>
                        </tr>
                    </table>
                    
                    <div class="divider"></div>
                    
                    <div style="text-align: center; margin-bottom: 20px;">
                       <span style="font-weight: 700; font-size: 16px; background: #e2e8f0; padding: 4px 15px; border-radius: 4px; color: #475569;">পাঠাগার কর্তৃক পূরণীয়</span>
                    </div>
                    
                    <table class="data-table">
                        <tr>
                            <td width="25%" style="color: #64748b; font-weight: 600;">আবেদন আইডি নং</td>
                            <td width="25%">: <span class="filled-value" style="font-family: monospace; color: #16a34a; font-size: 20px;">${successData.applicationId}</span></td>
                            <td width="25%" style="color: #64748b; font-weight: 600; text-align: right; padding-right: 10px;">বৃত্তির ক্যাটাগরি</td>
                            <td width="25%">: <span class="input-line" style="min-width: 100px;"></span></td>
                        </tr>
                    </table>

                    <table class="signature-sections" style="margin-top: 40px;">
                        <tr>
                            <td><span class="sig-line">গৃহীতকারীর স্বাক্ষর</span></td>
                            <td></td>
                            <td><span class="sig-line">অনুমোদনকারীর স্বাক্ষর</span></td>
                        </tr>
                    </table>
                </div>
            </div>
        </div>
    </body>
    </html>`);
    printWindow.document.close();
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.studentName || !formData.mobile || !formData.institution || !formData.termsAccepted) {
      toast.error('অনুগ্রহ করে আবশ্যিক তথ্যগুলো পূরণ করুন এবং অঙ্গীকারনামায় সম্মতি দিন।');
      return;
    }

    setLoading(true);
    const toastId = toast.loading('আবেদন জমা দেওয়া হচ্ছে...');

    try {
      const currentYear = new Date().getFullYear();
      const prefix = currentYear % 100; // e.g. 26 for 2026, 27 for 2027
      const baseId = prefix * 1000;
      const nextBound = (prefix + 1) * 1000;
      
      let newAppId = baseId + 1;
      const appQuery = query(collection(db, 'scholarship_applications'), orderBy('applicationId', 'desc'), limit(1));
      const querySnapshot = await getDocs(appQuery);
      
      if (!querySnapshot.empty) {
        const lastAppId = querySnapshot.docs[0].data().applicationId;
        if (lastAppId && lastAppId >= baseId && lastAppId < nextBound) {
          newAppId = lastAppId + 1;
        }
      }

      const submitData = {
        ...formData,
        profession: 'ছাত্র/ছাত্রী',
        applicationId: newAppId,
        status: 'Pending',
        createdAt: serverTimestamp()
      };

      await addDoc(collection(db, 'scholarship_applications'), submitData);

      // Create a profile for the applicant in the 'users' collection
      const newUserId = `SCH_${Date.now()}`;
      await setDoc(doc(db, 'users', newUserId), {
         id: newUserId,
         name: formData.studentName,
         phone: formData.mobile,
         fatherName: formData.fatherName,
         bloodGroup: formData.bloodGroup,
         address: formData.presentAddress,
         role: 'scholarship',
         status: 'active',
         applicationId: newAppId,
         memberId: newAppId.toString(),
         createdAt: serverTimestamp()
      });

      toast.success('আবেদন সম্পন্ন হয়েছে!', { id: toastId });
      setSuccessData({ applicationId: newAppId.toString(), name: formData.studentName });
    } catch (error) {
      console.error("Error submitting application:", error);
      toast.error('আবেদন জমা দিতে সমস্যা হয়েছে। আবার চেষ্টা করুন।', { id: toastId });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 pt-24 pb-12 px-4 sm:px-6">
      <div className="max-w-3xl mx-auto">
        
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center p-4 bg-green-100 text-green-700 rounded-full mb-4">
            <FileText size={32} />
          </div>
          <h1 className="text-3xl sm:text-4xl font-black font-bengali text-slate-800 mb-4 tracking-tight">শিক্ষাবৃত্তি আবেদন ফর্ম</h1>
          <p className="text-slate-600 font-bengali text-lg max-w-xl mx-auto">পানধোয়া উন্মুক্ত পাঠাগার আয়োজিত শিক্ষাবৃত্তির জন্য নিচের ফর্মটি পূরণ করে অনলাইনে আবেদন করুন।</p>
        </div>

        <AnimatePresence mode="wait">
          {successData ? (
             <motion.div 
               initial={{ opacity: 0, scale: 0.95 }}
               animate={{ opacity: 1, scale: 1 }}
               className="bg-white rounded-[2rem] p-8 sm:p-12 shadow-xl border border-slate-100 text-center relative overflow-hidden"
             >
                <div className="absolute top-0 right-0 w-64 h-64 bg-green-500/10 rounded-full blur-[80px] -mr-32 -mt-32"></div>
                <div className="relative z-10">
                  <div className="w-24 h-24 bg-green-100 text-green-600 rounded-full flex items-center justify-center mx-auto mb-6">
                     <CheckCircle size={48} />
                  </div>
                  <h2 className="text-3xl font-black text-slate-800 font-bengali mb-4">আবেদন সফল হয়েছে!</h2>
                  <p className="text-slate-600 font-bengali mb-8 text-lg">ধন্যবাদ <strong>{successData.name}</strong>, আপনার শিক্ষাবৃত্তির আবেদনটি সফলভাবে গৃহীত হয়েছে।</p>
                  
                  <div className="bg-slate-50 border border-slate-200 rounded-2xl p-8 max-w-sm mx-auto mb-8 shadow-sm">
                     <p className="text-slate-500 font-bengali font-bold text-sm mb-2 uppercase tracking-wide">আপনার আবেদন আইডি</p>
                     <div className="text-5xl font-black text-indigo-600 font-mono tracking-widest">{successData.applicationId}</div>
                     <p className="text-rose-500 font-bengali text-xs font-bold mt-4 bg-rose-50 p-2 rounded-lg inline-block">এই আইডিটি সযত্নে সংরক্ষণ করুন</p>
                  </div>

                  <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
                     <button 
                       onClick={executePrintApplicantForm}
                       className="px-8 py-4 bg-green-600 text-white rounded-xl font-bold font-bengali hover:bg-green-700 transition-colors shadow-lg active:scale-95 flex items-center gap-2 w-full sm:w-auto justify-center"
                     >
                        <Printer size={20} />
                        ফর্ম প্রিন্ট/ডাউনলোড করুন
                     </button>
                     <button 
                       onClick={() => {
                         setSuccessData(null);
                         setFormData({
                           studentName: '',
                           fatherName: '',
                           motherName: '',
                           studentClass: '',
                           institution: '',
                           dob: '',
                           bloodGroup: '',
                           presentAddress: '',
                           permanentAddress: '',
                           mobile: '',
                           emergencyContact: '',
                           birthCertificate: false,
                           idCard: false,
                           parentsIdCard: false,
                           termsAccepted: false
                         });
                       }}
                       className="px-8 py-4 bg-slate-900 text-white rounded-xl font-bold font-bengali hover:bg-slate-800 transition-colors shadow-lg active:scale-95 w-full sm:w-auto justify-center"
                     >
                        নতুন আবেদন করুন
                     </button>
                  </div>
                </div>
             </motion.div>
          ) : (
            <motion.div 
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              className="bg-white rounded-[2rem] p-6 sm:p-10 shadow-xl border border-slate-100 relative overflow-hidden"
            >
              <div className="absolute top-0 right-0 w-64 h-64 bg-indigo-500/5 rounded-full blur-[80px] -mr-32 -mt-32 pointer-events-none"></div>
              
              <form onSubmit={handleSubmit} className="relative z-10 space-y-8">
                
                {/* Personal Info */}
                <div className="space-y-5">
                  <h3 className="text-lg font-black font-bengali text-slate-800 pb-2 border-b border-slate-100 uppercase tracking-widest">ব্যক্তিগত তথ্যাবলী</h3>
                  
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                    <div>
                      <label className="block text-sm font-bold font-bengali text-slate-700 mb-2">শিক্ষার্থীর নাম <span className="text-red-500">*</span></label>
                      <input 
                        type="text" 
                        required
                        value={formData.studentName}
                        onChange={e => setFormData({...formData, studentName: e.target.value})}
                        className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 focus:outline-none focus:ring-2 focus:ring-indigo-500 font-bengali font-medium text-slate-800"
                        placeholder="শিক্ষার্থীর পূর্ণ নাম..."
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-bold font-bengali text-slate-700 mb-2">শ্রেণি <span className="text-red-500">*</span></label>
                      <input 
                        type="text" 
                        required
                        value={formData.studentClass}
                        onChange={e => setFormData({...formData, studentClass: e.target.value})}
                        className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 focus:outline-none focus:ring-2 focus:ring-indigo-500 font-bengali font-medium text-slate-800"
                        placeholder="উদাঃ ৬ষ্ঠ শ্রেণি / ৮ম শ্রেণি"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                    <div>
                      <label className="block text-sm font-bold font-bengali text-slate-700 mb-2">পিতার নাম</label>
                      <input 
                        type="text" 
                        value={formData.fatherName}
                        onChange={e => setFormData({...formData, fatherName: e.target.value})}
                        className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 focus:outline-none focus:ring-2 focus:ring-indigo-500 font-bengali font-medium text-slate-800"
                        placeholder="পিতার নাম..."
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-bold font-bengali text-slate-700 mb-2">মাতার নাম</label>
                      <input 
                        type="text" 
                        value={formData.motherName}
                        onChange={e => setFormData({...formData, motherName: e.target.value})}
                        className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 focus:outline-none focus:ring-2 focus:ring-indigo-500 font-bengali font-medium text-slate-800"
                        placeholder="মাতার নাম..."
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-sm font-bold font-bengali text-slate-700 mb-2">শিক্ষাপ্রতিষ্ঠান <span className="text-red-500">*</span></label>
                    <input 
                      type="text" 
                      required
                      value={formData.institution}
                      onChange={e => setFormData({...formData, institution: e.target.value})}
                      className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 focus:outline-none focus:ring-2 focus:ring-indigo-500 font-bengali font-medium text-slate-800"
                      placeholder="বর্তমান শিক্ষাপ্রতিষ্ঠানের নাম..."
                    />
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                    <div>
                      <label className="block text-sm font-bold font-bengali text-slate-700 mb-2">জন্ম তারিখ</label>
                      <input 
                        type="date" 
                        value={formData.dob}
                        onChange={e => setFormData({...formData, dob: e.target.value})}
                        className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 focus:outline-none focus:ring-2 focus:ring-indigo-500 font-sans font-medium text-slate-800"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-bold font-bengali text-slate-700 mb-2">রক্তের গ্রুপ</label>
                      <select 
                        value={formData.bloodGroup}
                        onChange={e => setFormData({...formData, bloodGroup: e.target.value})}
                        className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 focus:outline-none focus:ring-2 focus:ring-indigo-500 font-sans font-medium text-slate-800"
                      >
                        <option value="">নির্বাচন করুন</option>
                        <option value="A+">A+</option>
                        <option value="A-">A-</option>
                        <option value="B+">B+</option>
                        <option value="B-">B-</option>
                        <option value="AB+">AB+</option>
                        <option value="AB-">AB-</option>
                        <option value="O+">O+</option>
                        <option value="O-">O-</option>
                      </select>
                    </div>
                  </div>
                </div>

                {/* Contact Info */}
                <div className="space-y-5 pt-4">
                  <h3 className="text-lg font-black font-bengali text-slate-800 pb-2 border-b border-slate-100 uppercase tracking-widest">যোগাযোগের ঠিকানা</h3>
                  
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                    <div>
                      <label className="block text-sm font-bold font-bengali text-slate-700 mb-2">বর্তমান ঠিকানা</label>
                      <textarea 
                        rows={2}
                        value={formData.presentAddress}
                        onChange={e => setFormData({...formData, presentAddress: e.target.value})}
                        className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 focus:outline-none focus:ring-2 focus:ring-indigo-500 font-bengali font-medium text-slate-800 resize-none"
                        placeholder="গ্রাম, ডাকঘর, উপজেলা..."
                      ></textarea>
                    </div>
                    <div>
                      <label className="block text-sm font-bold font-bengali text-slate-700 mb-2">স্থায়ী ঠিকানা</label>
                      <textarea 
                        rows={2}
                        value={formData.permanentAddress}
                        onChange={e => setFormData({...formData, permanentAddress: e.target.value})}
                        className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 focus:outline-none focus:ring-2 focus:ring-indigo-500 font-bengali font-medium text-slate-800 resize-none"
                        placeholder="গ্রাম, ডাকঘর, উপজেলা..."
                      ></textarea>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                    <div>
                      <label className="block text-sm font-bold font-bengali text-slate-700 mb-2">মোবাইল নম্বর <span className="text-red-500">*</span></label>
                      <input 
                        type="tel" 
                        required
                        value={formData.mobile}
                        onChange={e => setFormData({...formData, mobile: e.target.value})}
                        className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 focus:outline-none focus:ring-2 focus:ring-indigo-500 font-sans font-medium text-slate-800 tracking-wider"
                        placeholder="01XXXXXXXXX"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-bold font-bengali text-slate-700 mb-2">ইমার্জেন্সি যোগাযোগ</label>
                      <input 
                        type="tel" 
                        value={formData.emergencyContact}
                        onChange={e => setFormData({...formData, emergencyContact: e.target.value})}
                        className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 focus:outline-none focus:ring-2 focus:ring-indigo-500 font-sans font-medium text-slate-800 tracking-wider"
                        placeholder="বিকল্প মোবাইল নম্বর"
                      />
                    </div>
                  </div>
                </div>

                {/* Attachments Note */}
                <div className="space-y-5 pt-4">
                  <h3 className="text-lg font-black font-bengali text-slate-800 pb-2 border-b border-slate-100 uppercase tracking-widest">সংযুক্তি (কাগজপত্র জমা দেওয়ার রেকর্ড)</h3>
                  
                  <div className="bg-amber-50/50 rounded-xl p-5 border border-amber-100/50 space-y-3">
                    <p className="text-sm font-bold text-amber-700 font-bengali text-center sm:text-left leading-relaxed">
                      শিক্ষার্থীর আবেদন ফর্মের সাথে হার্ডকপিতে যে সংযুক্তিগুলো পাঠাগারে জমা নেওয়া হয়েছে, সেগুলোতে টিক দিন:
                    </p>
                    <label className="flex items-center gap-3 cursor-pointer group mt-2">
                      <input 
                        type="checkbox"
                        checked={formData.birthCertificate}
                        onChange={e => setFormData({...formData, birthCertificate: e.target.checked})}
                        className="w-5 h-5 rounded !border-amber-300 text-green-600 focus:ring-green-500 transition-colors"
                      />
                      <span className="font-bengali font-bold text-slate-700 group-hover:text-amber-800 transition-colors">১। জন্ম নিবন্ধন কপি</span>
                    </label>
                    <label className="flex items-center gap-3 cursor-pointer group mt-2">
                      <input 
                        type="checkbox"
                        checked={formData.idCard}
                        onChange={e => setFormData({...formData, idCard: e.target.checked})}
                        className="w-5 h-5 rounded !border-amber-300 text-green-600 focus:ring-green-500 transition-colors"
                      />
                      <span className="font-bengali font-bold text-slate-700 group-hover:text-amber-800 transition-colors">২। শিক্ষার্থী আইডি কার্ড / প্রত্যয়ন পত্র</span>
                    </label>
                    <label className="flex items-center gap-3 cursor-pointer group mt-2">
                      <input 
                        type="checkbox"
                        checked={formData.parentsIdCard}
                        onChange={e => setFormData({...formData, parentsIdCard: e.target.checked})}
                        className="w-5 h-5 rounded !border-amber-300 text-green-600 focus:ring-green-500 transition-colors"
                      />
                      <span className="font-bengali font-bold text-slate-700 group-hover:text-amber-800 transition-colors">৩। পিতা/মাতার আইডি কার্ডের কপি</span>
                    </label>
                  </div>
                </div>

                {/* Agreement */}
                <div className="pt-4">
                  <div className="bg-slate-50 rounded-xl border border-slate-200 p-5 lg:p-6 shadow-inner">
                    <label className="flex items-start gap-4 cursor-pointer">
                      <input 
                        type="checkbox"
                        required
                        checked={formData.termsAccepted}
                        onChange={e => setFormData({...formData, termsAccepted: e.target.checked})}
                        className="mt-1 w-5 h-5 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500 shrink-0"
                      />
                      <div>
                        <span className="block font-bengali font-black text-rose-600 mb-1">অঙ্গীকারনামা:</span>
                        <span className="font-bengali text-sm font-medium text-slate-600 leading-relaxed block">
                          আমি এই মর্মে অঙ্গীকার করছি যে, উপরে প্রদত্ত সকল তথ্য সম্পূর্ণ সত্য। পানধোয়া উন্মুক্ত পাঠাগার এর শিক্ষাবৃত্তির সকল নিয়ম-কানুন ও শৃঙ্খলা আমি মেনে চলব।
                        </span>
                      </div>
                    </label>
                  </div>
                </div>

                <div className="pt-6 border-t border-slate-100 text-center sm:text-right">
                  <button 
                    type="submit" 
                    disabled={loading}
                    className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-10 py-4 bg-green-600 hover:bg-green-700 text-white rounded-xl font-black font-bengali shadow-lg shadow-green-600/30 transition-all active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {loading ? (
                      <>অপেক্ষা করুন...</>
                    ) : (
                      <>
                        <Save size={20} />
                        আবেদন জমা দিন
                      </>
                    )}
                  </button>
                  <p className="text-xs text-slate-400 font-bengali mt-4 block">সাবমিট করার পূর্বে সকল তথ্য আরেকবার যাচাই করুন</p>
                </div>

              </form>
            </motion.div>
          )}
        </AnimatePresence>

      </div>
    </div>
  );
}
