import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const directoryPath = path.join(__dirname, 'src/pages/dashboard');

// Regex to find handler actions like handleAdd, handleSubmit, handleCreate, handleEdit, handleDelete, updateStatus, etc.
const handlerRegex = /(const handle[A-Za-z0-9_]+\s*=\s*(?:async\s*)?\([^)]*\)\s*(?::\s*any)?\s*=>\s*\{)(?!\s*if \(user\?\.role === 'visitor_admin'\))/g;
const handleDeleteRegex = /(const handleDelete[A-Za-z0-9_]*\s*=\s*(?:async\s*)?\([^)]*\)\s*(?::\s*any)?\s*=>\s*\{)(?!\s*if \(user\?\.role === 'visitor_admin'\))/g;
const handleUpdateRegex = /(const handleUpdate[A-Za-z0-9_]*\s*=\s*(?:async\s*)?\([^)]*\)\s*(?::\s*any)?\s*=>\s*\{)(?!\s*if \(user\?\.role === 'visitor_admin'\))/g;
const handleToggleRegex = /(const handleToggle[A-Za-z0-9_]*\s*=\s*(?:async\s*)?\([^)]*\)\s*(?::\s*any)?\s*=>\s*\{)(?!\s*if \(user\?\.role === 'visitor_admin'\))/g;


const injection = "\n    if (user?.role === 'visitor_admin') { toast.error('ভিজিটর অ্যাডমিন হিসেবে এডিট বা ডিলিট করার অনুমতি নেই।'); return; }";

const files = fs.readdirSync(directoryPath);

for (const file of files) {
  if (file.endsWith('.tsx')) {
    const filePath = path.join(directoryPath, file);
    let content = fs.readFileSync(filePath, 'utf8');
    
    // Skip if no toast
    if (!content.includes('react-hot-toast')) continue;
    if (file === 'DashboardHome.tsx' || file === 'UserProfile.tsx') continue;

    let modified = false;

    // Apply regex replacement
    const newContent = content
      .replace(handlerRegex, `$1${injection}`)
      .replace(handleDeleteRegex, `$1${injection}`)
      .replace(handleUpdateRegex, `$1${injection}`)
      .replace(handleToggleRegex, `$1${injection}`);

    if (newContent !== content) {
      fs.writeFileSync(filePath, newContent, 'utf8');
      console.log(`Updated ${file}`);
    }
  }
}
