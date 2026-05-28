const fs = require('fs');
let file = fs.readFileSync('src/pages/dashboard/AdminSettings.tsx', 'utf8');

const anchor1 = `<style>\n              :root {\n                    const toastId`;
const anchor2 = `      {/* Global Search Bar */}
      <div className="mb-12 relative z-40" ref={searchRef}> 6px 20px;`;

const index1 = file.indexOf(anchor1);
const index2 = file.indexOf(anchor2);

if (index1 !== -1 && index2 !== -1) {
    const originalCss = `              :root {
                  --primary-color: #1e3a8a;
                  --secondary-color: #64748b;
              }
              body {
                  font-family: 'Hind Siliguri', sans-serif;
                  background-color: #e2e8f0;
                  margin: 0;
                  padding: 20px;
                  color: #0f172a;
                  font-size: 16px;
              }
              .form-page {
                  width: 210mm;
                  min-height: 297mm;
                  background: #ffffff;
                  margin: 0 auto;
                  margin-bottom: 20px;
                  padding: 15mm 15mm;
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
                  border-bottom: 3px double var(--primary-color);
                  padding-bottom: 12px;
                  margin-bottom: 15px;
              }
              .form-logo {
                  width: 85px;
                  height: 85px;
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
                  font-size: 15px;
                  margin-bottom: 4px;
                  font-weight: 600;
                  color: var(--secondary-color);
              }
              .form-address {
                  font-size: 15px;
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
                  width: 35mm;
                  height: 45mm;
                  border: 2px dashed #94a3b8;
                  border-radius: 6px;
                  display: flex;
                  flex-direction: column;
                  align-items: center;
                  justify-content: center;
                  font-size: 13px;
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
                  padding: 6px 20px;`;
                  
    file = file.substring(0, index1 + 8) + originalCss + file.substring(index2 + 63);
}

// Now replace the duplicated Link block in downloadBookListPDF
const badDownloadPdf = `  const downloadBookListPDF = async (category: string | 'all') => {
    try {
      setExportingPdf(category);
      const toastId = toast.loading(\`\${category === 'all' ? 'সকল বই' : 'বই'} এর তালিকা ডাউনলোড হচ্ছে...\`);
               <Link to="/dashboard/manageteam" className="group p-6 bg-white rounded-2xl border border-slate-200 shadow-sm hover:shadow-xl hover:shadow-rose-500/10 hover:border-rose-300 transition-all">`;

const goodDownloadPdfAndReturn = `  const downloadBookListPDF = async (category: string | 'all') => {
    try {
      setExportingPdf(category);
      const toastId = toast.loading(\`\${category === 'all' ? 'সকল বই' : 'বই'} এর তালিকা ডাউনলোড হচ্ছে...\`);
      
      const q = category === 'all' 
        ? query(collection(db, 'books'), orderBy('title'))
        : query(collection(db, 'books'), where('category', '==', category), orderBy('title'));
      
      const snapshot = await getDocs(q);
      const books = snapshot.docs.map(doc => doc.data());
      
      if (books.length === 0) {
        toast.error('এই ক্যাটাগরিতে কোনো বই পাওয়া যায়নি।', { id: toastId });
        setExportingPdf(null);
        return;
      }

      const doc = new jsPDF();
      doc.setFontSize(20);
      doc.text(category === 'all' ? 'All Books List' : \`\${category} - Books List\`, 14, 22);
      
      const tableData = books.map((book: any, idx) => [
        idx + 1,
        book.title || '',
        book.author || '',
        book.category || '',
        book.shelf || ''
      ]);

      (doc as any).autoTable({
        startY: 30,
        head: [['#', 'Title', 'Author', 'Category', 'Shelf']],
        body: tableData,
      });

      doc.save(\`BookList_\${category.replace(/\\s+/g, '_')}_\${new Date().getTime()}.pdf\`);
      toast.success('পিডিএফ ডাউনলোড সফল হয়েছে!', { id: toastId });
    } catch (err) {
      console.error(err);
      toast.error('পিডিএফ তৈরি করতে সমস্যা হয়েছে।');
    } finally {
      setExportingPdf(null);
    }
  };

  return (
    <div className="p-6 md:p-8">
      <div className="mb-10 lg:mb-14">
         <h1 className="text-2xl md:text-3xl lg:text-4xl font-black font-bengali text-slate-800 tracking-tight flex items-center gap-3">
           <div className="p-3 bg-indigo-50 text-indigo-600 rounded-2xl">
             <SettingsIcon className="w-8 h-8" />
           </div>
           অ্যাডমিন সেটিংস
         </h1>
         <p className="text-slate-500 font-medium font-bengali mt-3 text-base">ওয়েবসাইটের বিভিন্ন কনফিগারেশন, সদস্য ব্যবস্থাপনা এবং Event পরিচালনা করুন।</p>
      </div>

      {/* Global Search Bar */}
      <div className="mb-12 relative z-40" ref={searchRef}>`;

const index3 = file.indexOf(badDownloadPdf);
if (index3 !== -1) {
    const index4 = file.indexOf(`      <div className="mb-12 relative z-40" ref={searchRef}>`, index3);
    if (index4 !== -1) {
        file = file.substring(0, index3) + goodDownloadPdfAndReturn + file.substring(index4 + 59);
    }
}

fs.writeFileSync('src/pages/dashboard/AdminSettings.tsx', file);
console.log("Fixed file");
