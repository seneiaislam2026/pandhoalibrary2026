import React, { useEffect, useState } from 'react';
import { useAuth } from '../../store/AuthContext';
import { Plus, Edit2, Trash2, UserPlus, Image as ImageIcon, Briefcase, Phone, X } from 'lucide-react';
import { onSnapshot, collection, doc, setDoc, updateDoc, deleteDoc } from 'firebase/firestore';
import { db } from '../../lib/firebase';
import { motion, AnimatePresence } from 'motion/react';
import toast from 'react-hot-toast';

interface TeamMember {
  id: string;
  name: string;
  role: string;
  contact: string;
  image: string;
  createdAt?: number;
  session?: string;
  isFormer?: boolean;
}

export default function ManageTeam() {
  const [team, setTeam] = useState<TeamMember[]>([]);
  const { user } = useAuth();
  const [showModal, setShowModal] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [formData, setFormData] = useState({ name: '', role: '', contact: '', image: '', session: '', isFormer: false });
  const [filterMode, setFilterMode] = useState<'all' | 'current' | 'former'>('all');

  useEffect(() => {
    const unsubscribe = onSnapshot(collection(db, "team"), (snapshot) => {
      let teamData = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })) as TeamMember[];
      
      teamData.sort((a, b) => {
        const roleA = (a.role || '').toLowerCase();
        const roleB = (b.role || '').toLowerCase();
        
        const isDirectorA = roleA.includes('পরিচালক') && !roleA.includes('সহ');
        const isDirectorB = roleB.includes('পরিচালক') && !roleB.includes('সহ');
        
        const isCoDirectorA = roleA.includes('সহ পরিচালক') || roleA.includes('সহ-পরিচালক');
        const isCoDirectorB = roleB.includes('সহ পরিচালক') || roleB.includes('সহ-পরিচালক');

        if (isDirectorA && !isDirectorB) return -1;
        if (!isDirectorA && isDirectorB) return 1;
        if (isCoDirectorA && !isCoDirectorB) return -1;
        if (!isCoDirectorA && isCoDirectorB) return 1;

        const timeA = a.createdAt || 0;
        const timeB = b.createdAt || 0;
        return timeA - timeB;
      });

      setTeam(teamData);
    });
    return () => unsubscribe();
  }, []);

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      if (file.size > 2 * 1024 * 1024) {
        toast.error('Image must be less than 2MB to save in database.');
        return;
      }
      const reader = new FileReader();
      reader.onloadend = () => {
        const img = new Image();
        img.onload = () => {
          const canvas = document.createElement('canvas');
          const MAX_WIDTH = 400;
          const MAX_HEIGHT = 400;
          let width = img.width;
          let height = img.height;

          if (width > height) {
            if (width > MAX_WIDTH) {
              height *= MAX_WIDTH / width;
              width = MAX_WIDTH;
            }
          } else {
            if (height > MAX_HEIGHT) {
              width *= MAX_HEIGHT / height;
              height = MAX_HEIGHT;
            }
          }

          canvas.width = width;
          canvas.height = height;
          const ctx = canvas.getContext('2d');
          ctx?.drawImage(img, 0, 0, width, height);
          
          const dataUrl = canvas.toDataURL('image/jpeg', 0.6);
          setFormData({ ...formData, image: dataUrl });
        };
        img.src = reader.result as string;
      };
      reader.readAsDataURL(file);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const finalData = {
        ...formData,
        image: formData.image || 'https://images.unsplash.com/photo-1633332755192-727a05c4013d?w=100&h=100&fit=crop'
    };

    try {
      if (editingId) {
        await updateDoc(doc(db, "team", editingId), finalData);
      } else {
        const newDocRef = doc(collection(db, "team"));
        await setDoc(newDocRef, { ...finalData, id: newDocRef.id, createdAt: Date.now() });
      }
      setShowModal(false);
      setFormData({ name: '', role: '', contact: '', image: '', session: '', isFormer: false });
      setEditingId(null);
    } catch (error: any) {
      console.error('Error saving team member:', error);
      toast.error('Failed to save team member: ' + error.message);
    }
  };

  const handleEdit = (member: TeamMember) => {
    setFormData({
      name: member.name || '',
      role: member.role || '',
      contact: member.contact || '',
      image: member.image || '',
      session: member.session || '',
      isFormer: !!member.isFormer
    });
    setEditingId(member.id);
    setShowModal(true);
  };

  const handleDelete = async (id: string) => {
    if (!confirm("আপনি কি নিশ্চিত যে আপনি এই সদস্যকে ডিলিট করতে চান?")) return;
    try {
      await deleteDoc(doc(db, "team", id));
    } catch (error) {
      console.error('Delete error:', error);
      toast.error('Failed to delete member');
    }
  };

  const printTeamData = () => {
    const printWindow = window.open('', '_blank');
    if (!printWindow) return toast.error('Pop-up blocked.');
    
    // Filter out specific names and the owner's email (case-insensitive and trimmed)
    const teamToPrint = filteredTeam.filter(m => {
      const name = (m.name || "").toLowerCase().trim();
      // Note: Team data might not have email field, but we check just in case
      const email = ((m as any).email || "").toLowerCase().trim();
      const isExcludeName = name === "system admin" || name === "seneia islam" || name === "seneiya islam";
      const isExcludeEmail = email === "seneiaislam@gmail.com";
      return !isExcludeName && !isExcludeEmail;
    });

    let tableRows = teamToPrint.map((m, idx) => `
      <tr>
        <td class="td-sl">${idx + 1}</td>
        <td class="td-name">${m.name}</td>
        <td class="td-role">${m.role}</td>
        <td class="td-contact">${m.contact || "-"}</td>
      </tr>
    `).join('');

    printWindow.document.write(`
      <!DOCTYPE html>
      <html lang="bn">
      <head>
        <meta charset="UTF-8">
        <title>পরিচালনা পর্ষদ - পানধোয়া উন্মুক্ত পাঠাগার</title>
        
        <link href="https://fonts.googleapis.com/css2?family=Outfit:wght@400;500;600;700&family=Hind+Siliguri:wght@400;500;600;700&display=swap" rel="stylesheet">
                <style>
          :root {
            --primary: #4338ca;
            --border: #e2e8f0;
            --text-main: #0f172a;
            --text-muted: #64748b;
          }
          body { 
            font-family: 'Hind Siliguri', sans-serif; 
            padding: 50px; 
            max-width: 900px; 
            margin: 0 auto; 
            color: var(--text-main);
            line-height: 1.6;
          }
          .header { 
            text-align: center; 
            margin-bottom: 50px;
            padding-bottom: 30px;
            border-bottom: 2px double var(--primary);
            position: relative;
          }
          .header::after {
            content: '';
            position: absolute;
            bottom: -5px;
            left: 20%;
            right: 20%;
            height: 1px;
            background: var(--primary);
            opacity: 0.3;
          }
          .library-logo {
            width: 60px;
            height: 60px;
            margin: 0 auto 15px;
            color: var(--primary);
          }
          .header h1 { 
            font-size: 32px; 
            color: var(--primary); 
            margin: 0 0 5px 0;
            font-weight: 800;
          }
          .header .info {
            margin: 5px 0;
            color: var(--text-muted);
            font-size: 13px;
            font-weight: 500;
          }
          .header .title-badge {
            display: inline-block;
            background: var(--primary);
            color: white;
            padding: 5px 24px;
            border-radius: 99px;
            font-size: 15px;
            font-weight: 700;
            margin-top: 15px;
          }
          table { width: 100%; border-collapse: separate; border-spacing: 0; margin-top: 10px; border: 1px solid var(--border); border-radius: 12px; overflow: hidden; }
          th { 
            background: #f8fafc; 
            padding: 16px; 
            text-align: left; 
            border-bottom: 2px solid var(--border);
            font-weight: 700;
            color: #475569;
            text-transform: uppercase;
            font-size: 12px;
            letter-spacing: 1px;
          }
          td {
            padding: 16px; 
            border-bottom: 1px solid var(--border);
            font-size: 14px;
          }
          tr:last-child td { border-bottom: none; }
          tr:nth-child(even) { background-color: #fcfdfe; }
          .td-sl { width: 10%; font-weight: 700; color: var(--primary); font-family: 'Hind Siliguri', sans-serif; font-size: 14px; }
          .td-name { width: 35%; font-weight: 600; color: #1e293b; }
          .td-role { width: 30%; color: var(--primary); font-weight: 700; }
          .td-contact { width: 25%; color: var(--text-muted); font-family: 'Hind Siliguri', sans-serif; font-size: 14px; font-weight: 600; letter-spacing: 0.5px; }
          
          .footer-section { margin-top: 80px; display: flex; justify-content: space-between; }
          .signature-box { text-align: center; width: 180px; }
          .signature-line { border-top: 1px solid #cbd5e1; margin-bottom: 8px; }
          .signature-label { font-size: 12px; font-weight: 700; color: #64748b; }

          .print-btn {
            background: var(--primary);
            color: white;
            border: none;
            padding: 12px 28px;
            border-radius: 12px;
            font-size: 14px;
            font-weight: 700;
            cursor: pointer;
            margin-bottom: 40px;
            font-family: inherit;
            display: inline-flex;
            align-items: center;
            gap: 10px;
            box-shadow: 0 10px 15px -3px rgba(67, 56, 202, 0.2);
          }
          @media print {
            body { padding: 0; }
            .print-btn { display: none; }
            @page { margin: 2cm; }
          }
        </style>
      </head>
      <body>
        <button class="print-btn" onclick="window.print()">
           <svg style="width: 18px; height: 18px;" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2h2m2 4h6a2 2 0 002-2v-4a2 2 0 00-2-2H9a2 2 0 00-2 2v4a2 2 0 002 2zm8-12V5a2 2 0 00-2-2H9a2 2 0 00-2 2v4h10z"></path></svg>
           তালিকা প্রিন্ট করুন
        </button>
        <div class="header">
          <div class="library-logo">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z"></path><path d="M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z"></path></svg>
          </div>
          <h1 style="font-size: 36px; margin-bottom: 2px;">পানধোয়া উন্মুক্ত পাঠাগার</h1>
          <div class="info" style="font-size: 15px; color: #1e293b; font-weight: 700; margin-bottom: 10px; border: 1px solid #e2e8f0; display: inline-block; padding: 4px 15px; border-radius: 8px; background: #f8fafc;">ঠিকানা: পানধোয়া, সেনওয়ালিয়া-1344, আশুলিয়া, সাভার, ঢাকা।</div>
          <div class="info" style="font-weight: 500;">স্থাপিত: ২০২০ | পরিচালনা পর্ষদ</div>
          <div class="title-badge">পরিচালনা পর্ষদ - সদস্য তালিকা</div>
        </div>
        <table>
          <thead>
            <tr>
              <th>ক্রমিক নং (SL)</th>
              <th>সদস্য নাম (NAME)</th>
              <th>পদবি (DESIGNATION)</th>
              <th>মোবাইল নম্বর (CONTACT)</th>
            </tr>
          </thead>
          <tbody>
            ${tableRows}
          </tbody>
        </table>
        
        <div class="footer-section" style="margin-top: 100px;">
          <div class="signature-box">
             <div class="signature-line"></div>
             <div class="signature-label">পরিচালক</div>
          </div>
          <div class="signature-box">
             <div class="signature-line"></div>
             <div class="signature-label">সেক্রেটারি জেনারেল</div>
          </div>
        </div>

        <script>
          setTimeout(() => window.print(), 1000);
        </script>
      </body>
      </html>
    `);
    printWindow.document.close();
  };

  const filteredTeam = team.filter((m) => {
    if (filterMode === 'current') return !m.isFormer;
    if (filterMode === 'former') return m.isFormer;
    return true;
  });

  return (
    <div className="space-y-6 pb-20">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 bg-white p-6 rounded-2xl shadow-sm border border-slate-100">
        <div>
          <h2 className="text-2xl font-bold text-slate-800 tracking-tight font-bengali">পরিচালনা পর্ষদ</h2>
          <p className="text-slate-500 text-sm mt-1 font-bengali">লাইব্রেরি পরিচালনা পর্ষদের বর্তমান এবং সাবেক সদস্যদের বিবরণ।</p>
        </div>
        
        <div className="flex flex-col sm:flex-row items-center gap-3 w-full md:w-auto">
          <div className="flex bg-slate-100 p-1 rounded-lg w-full sm:w-auto">
            <button onClick={() => setFilterMode('all')} className={`flex-1 sm:flex-none px-4 py-1.5 text-sm font-bold rounded-md transition-all font-bengali ${filterMode === 'all' ? 'bg-white text-indigo-600 shadow-sm' : 'text-slate-500'}`}>সকল</button>
            <button onClick={() => setFilterMode('current')} className={`flex-1 sm:flex-none px-4 py-1.5 text-sm font-bold rounded-md transition-all font-bengali ${filterMode === 'current' ? 'bg-white text-indigo-600 shadow-sm' : 'text-slate-500'}`}>বর্তমান</button>
            <button onClick={() => setFilterMode('former')} className={`flex-1 sm:flex-none px-4 py-1.5 text-sm font-bold rounded-md transition-all font-bengali ${filterMode === 'former' ? 'bg-white text-indigo-600 shadow-sm' : 'text-slate-500'}`}>সাবেক</button>
          </div>
          
          <button 
            onClick={printTeamData}
            className="flex items-center justify-center gap-2 bg-slate-800 text-white px-4 py-2 text-sm rounded-xl font-bold hover:bg-slate-700 transition w-full sm:w-auto font-bengali"
          >
            🖨️ প্রিন্ট
          </button>
          
          <button 
            onClick={() => { setFormData({ name: '', role: '', contact: '', image: '', session: '', isFormer: false }); setEditingId(null); setShowModal(true); }}
            className="flex items-center justify-center gap-2 bg-indigo-600 text-white px-5 py-2.5 rounded-xl font-bold hover:bg-indigo-700 transition shadow-lg shadow-indigo-100 font-bengali w-full sm:w-auto"
          >
            <Plus className="w-5 h-5" /> 
            <span>যোগ করুন</span>
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {filteredTeam.map((member, index) => (
          <motion.div 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: index * 0.1 }}
            key={member.id} 
            className="bg-white rounded-3xl border border-slate-100 shadow-xl shadow-slate-200/40 hover:shadow-2xl hover:shadow-indigo-100/50 transition-all duration-300 overflow-hidden group"
          >
            <div className="h-24 bg-gradient-to-br from-indigo-500 to-purple-600 relative">
              <div className="absolute inset-0 bg-white/10 backdrop-blur-sm opacity-0 group-hover:opacity-100 transition-opacity flex justify-end p-4 gap-2">
                <button onClick={() => handleEdit(member)} className="w-8 h-8 rounded-full bg-white/90 text-indigo-600 flex items-center justify-center hover:bg-white transition hover:scale-110" title="এডিট">
                  <Edit2 className="w-4 h-4" />
                </button>
                <button onClick={() => handleDelete(member.id)} className="w-8 h-8 rounded-full bg-white/90 text-rose-600 flex items-center justify-center hover:bg-white transition hover:scale-110" title="ডিলিট">
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            </div>
            
            <div className="relative px-6 pb-6 text-center">
              <div className="w-24 h-24 mx-auto -mt-12 rounded-full p-1.5 bg-white shadow-lg relative z-10 mb-4">
                <img 
                  src={member.image} 
                  alt={member.name} 
                  referrerPolicy="no-referrer"
                  className="w-full h-full rounded-full object-cover border border-slate-100" 
                />
              </div>
              <h3 className="font-extrabold text-xl text-slate-800 font-bengali">{member.name}</h3>
              <div className="flex flex-wrap items-center justify-center gap-2 mt-2">
                <p className="text-indigo-600 font-bold mb-3 flex items-center justify-center gap-1.5 font-bengali text-sm bg-indigo-50 w-max px-3 py-1 rounded-full">
                  <Briefcase className="w-3.5 h-3.5" />
                  {member.role}
                </p>
                {member.isFormer && (
                  <p className="text-rose-600 font-bold mb-3 flex items-center justify-center gap-1.5 font-bengali text-[10px] uppercase tracking-widest bg-rose-50 w-max px-3 py-1 rounded-full border border-rose-100">
                    সাবেক
                  </p>
                )}
                {member.session && (
                  <p className="text-slate-600 font-bold mb-3 flex items-center justify-center gap-1.5 text-xs bg-slate-100 border border-slate-200 w-max px-3 py-1 rounded-full">
                    {member.session}
                  </p>
                )}
              </div>
              {member.contact && (
                <div className="flex items-center justify-center gap-1.5 text-slate-500 text-sm mt-2">
                  <Phone className="w-4 h-4" />
                  <span>{member.contact}</span>
                </div>
              )}
            </div>
            {/* Mobile Actions */}
            <div className="lg:hidden flex border-t border-slate-100 bg-slate-50 mt-auto">
               <button onClick={() => handleEdit(member)} className="flex-1 py-3 text-sm font-bold text-slate-600 hover:bg-indigo-50 hover:text-indigo-600 transition flex items-center justify-center gap-2 border-r border-slate-100 font-bengali">
                  <Edit2 className="w-4 h-4" /> এডিট
               </button>
               <button onClick={() => handleDelete(member.id)} className="flex-1 py-3 text-sm font-bold text-slate-600 hover:bg-rose-50 hover:text-rose-600 transition flex items-center justify-center gap-2 font-bengali">
                  <Trash2 className="w-4 h-4" /> ডিলিট
               </button>
            </div>
          </motion.div>
        ))}
        {team.length === 0 && (
          <div className="col-span-full bg-white p-16 rounded-3xl border-2 border-dashed border-slate-200 text-center space-y-4">
            <div className="w-20 h-20 bg-slate-50 rounded-full flex items-center justify-center mx-auto text-slate-300">
              <UserPlus className="w-10 h-10" />
            </div>
            <p className="text-slate-500 font-medium tracking-tight font-bengali">এখনও কোনো সদস্য যোগ করা হয়নি।</p>
          </div>
        )}
      </div>

      <AnimatePresence>
        {showModal && (
          <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4">
            <motion.div 
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="bg-white rounded-3xl w-full max-w-lg overflow-hidden shadow-2xl border border-slate-100"
            >
              <div className="bg-slate-900 p-6 text-white flex justify-between items-center">
                <h3 className="text-xl font-bold flex items-center gap-2 font-bengali">
                  <UserPlus className="w-5 h-5 text-indigo-400" />
                  {editingId ? 'সদস্য আপডেট করুন' : 'নতুন সদস্য যোগ করুন'}
                </h3>
                <button onClick={() => setShowModal(false)} className="p-2 hover:bg-white/10 rounded-xl transition">
                  <X className="w-6 h-6" />
                </button>
              </div>

              <form onSubmit={handleSubmit} className="p-8 space-y-5">
                <div>
                  <label className="block text-sm font-black text-slate-400 uppercase tracking-widest mb-2 font-bengali">পুর্ণ নাম</label>
                  <input type="text" required value={formData.name || ''} onChange={e=>setFormData({...formData, name: e.target.value})} className="w-full bg-slate-50 border border-slate-100 rounded-xl px-4 py-3 focus:ring-2 focus:ring-indigo-500 transition font-medium font-bengali" />
                </div>
                <div>
                  <label className="block text-sm font-black text-slate-400 uppercase tracking-widest mb-2 font-bengali">পদবি</label>
                  <input type="text" required value={formData.role || ''} onChange={e=>setFormData({...formData, role: e.target.value})} className="w-full bg-slate-50 border border-slate-100 rounded-xl px-4 py-3 focus:ring-2 focus:ring-indigo-500 transition font-medium font-bengali" />
                </div>
                <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-black text-slate-400 uppercase tracking-widest mb-2 font-bengali">সেশন (যেমন: ২০২৩-২০২৪)</label>
                      <input type="text" value={formData.session || ''} onChange={e=>setFormData({...formData, session: e.target.value})} className="w-full bg-slate-50 border border-slate-100 rounded-xl px-4 py-3 focus:ring-2 focus:ring-indigo-500 transition font-medium font-bengali" />
                    </div>
                    <div>
                      <label className="block text-sm font-black text-slate-400 uppercase tracking-widest mb-2 font-bengali">স্ট্যাটাস</label>
                      <label className="flex items-center gap-3 bg-slate-50 border border-slate-100 rounded-xl px-4 py-3 cursor-pointer">
                        <input type="checkbox" checked={!!formData.isFormer} onChange={e=>setFormData({...formData, isFormer: e.target.checked})} className="w-5 h-5 rounded text-indigo-600 focus:ring-indigo-500" />
                        <span className="font-medium font-bengali text-slate-700">সাবেক দায়িত্বশীল</span>
                      </label>
                    </div>
                </div>
                <div>
                  <label className="block text-sm font-black text-slate-400 uppercase tracking-widest mb-2 font-bengali">যোগাযোগের তথ্য</label>
                  <input type="text" required value={formData.contact || ''} onChange={e=>setFormData({...formData, contact: e.target.value})} className="w-full bg-slate-50 border border-slate-100 rounded-xl px-4 py-3 focus:ring-2 focus:ring-indigo-500 transition font-medium" />
                </div>
                <div>
                  <label className="block text-sm font-black text-slate-400 uppercase tracking-widest mb-2 font-bengali">প্রোফাইল ছবি (ঐচ্ছিক)</label>
                  <div className="flex items-center gap-4 bg-slate-50 p-4 rounded-xl border border-slate-100">
                    <div className="w-16 h-16 rounded-full overflow-hidden border border-slate-200 bg-white flex-shrink-0 flex items-center justify-center">
                      {formData.image ? (
                        <img src={formData.image} alt="Preview" referrerPolicy="no-referrer" className="w-full h-full object-cover" />
                      ) : (
                        <ImageIcon className="w-6 h-6 text-slate-300" />
                      )}
                    </div>
                    <input type="file" accept="image/*" onChange={handleImageUpload} className="w-full text-sm font-medium text-slate-500 file:mr-4 file:py-2.5 file:px-4 file:rounded-xl file:border-0 file:text-sm file:font-semibold file:bg-indigo-100 file:text-indigo-700 hover:file:bg-indigo-200 transition" />
                  </div>
                </div>
                <div className="pt-6">
                  <button type="submit" className="w-full bg-indigo-600 text-white py-4 rounded-xl font-black uppercase tracking-widest hover:bg-indigo-700 transition shadow-lg shadow-indigo-100 font-bengali">
                    {editingId ? 'আপডেট করুন' : 'সংরক্ষণ করুন'}
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
