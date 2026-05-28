import fs from 'fs';
let code = fs.readFileSync('src/pages/public/Events.tsx', 'utf8');

code = code.replace(
  '<div className="flex justify-between items-center pb-4 border-b border-slate-200/60">\n                              <span className="text-sm font-black text-slate-400 uppercase tracking-widest font-bengali">আপনার নাম:</span>\n                              <span className="font-black text-slate-900 font-bengali text-lg text-right">{user?.name}</span>\n                           </div>',
  `<div className="flex flex-col gap-2 pb-4 border-b border-slate-200/60 text-left">
                              <label className="text-sm font-black text-slate-400 uppercase tracking-widest font-bengali">আবেদনকারীর নাম</label>
                              <input type="text" required value={applicantName} onChange={e=>setApplicantName(e.target.value)} placeholder="আবেদনকারীর নাম লিখুন" className="w-full bg-white px-4 py-3 border border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-indigo-500 font-bengali font-bold" />
                           </div>
                           <div className="flex flex-col gap-2 pb-4 border-b border-slate-200/60 text-left">
                              <label className="text-sm font-black text-slate-400 uppercase tracking-widest font-bengali">মোবাইল নম্বর</label>
                              <input type="text" required value={applicantPhone} onChange={e=>setApplicantPhone(e.target.value)} placeholder="017........" className="w-full bg-white px-4 py-3 border border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-indigo-500 font-sans font-bold" />
                           </div>`
);

code = code.replace(
  `                 <motion.button
                    whileHover={{ scale: 1.02 }}
                    whileTap={{ scale: 0.98 }}
                    onClick={() => {
                      setSelectedEvent(event);
                      setHasRegistered(false);
                    }}
                    className="mt-10 w-full py-5 rounded-2xl font-black font-bengali text-lg transition-all flex items-center justify-center gap-3 bg-slate-900 text-white hover:bg-indigo-600 shadow-xl shadow-slate-100 group-hover:shadow-indigo-100"
                  >
                    রেজিস্ট্রেশন করুন <ArrowRight size={22} />
                  </motion.button>`,
  `                 {isAdmin && (
                    <motion.button
                     whileHover={{ scale: 1.02 }}
                     whileTap={{ scale: 0.98 }}
                     onClick={() => {
                       setSelectedEvent(event);
                       setHasRegistered(false);
                       setApplicantName('');
                       setApplicantPhone('');
                     }}
                     className="mt-10 w-full py-5 rounded-2xl font-black font-bengali text-lg transition-all flex items-center justify-center gap-3 bg-slate-900 text-white hover:bg-indigo-600 shadow-xl shadow-slate-100 group-hover:shadow-indigo-100"
                   >
                     রেজিস্ট্রেশন করুন <ArrowRight size={22} />
                   </motion.button>
                  )}`
);

fs.writeFileSync('src/pages/public/Events.tsx', code);
