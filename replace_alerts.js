const fs = require('fs');
const path = require('path');

const walkSync = function(dir, filelist) {
  var files = fs.readdirSync(dir);
  filelist = filelist || [];
  files.forEach(function(file) {
    if (fs.statSync(path.join(dir, file)).isDirectory()) {
      filelist = walkSync(path.join(dir, file), filelist);
    }
    else {
      if (file.endsWith('.tsx') || file.endsWith('.ts')) {
        filelist.push(path.join(dir, file));
      }
    }
  });
  return filelist;
};

const TSX_FILES = walkSync('./src/pages', []);

const errorKeywords = ['failed', 'error', 'ব্যর্থ', 'সমস্যা', 'ত্রুটি', 'denied', 'cannot', 'please', 'invalid', 'validation', 'must', 'already'];

TSX_FILES.forEach(filePath => {
  let content = fs.readFileSync(filePath, 'utf8');
  let originalContent = content;

  if (content.includes('alert(')) {
    // Add import if not exists
    if (!content.includes("import toast from 'react-hot-toast'") && !content.includes('import toast from "react-hot-toast"')) {
      const importMatches = content.match(/^import .*$/gm);
      if (importMatches) {
        let lastImport = importMatches[importMatches.length - 1];
        content = content.replace(lastImport, lastImport + "\nimport toast from 'react-hot-toast';");
      } else {
        content = "import toast from 'react-hot-toast';\n" + content;
      }
    }

    // Replace alert calls
    // need to be careful with template literals inside alert
    const regex = /(?:window\.)?alert\(([^)]+)\)/g;
    content = content.replace(regex, (match, p1) => {
      const lower = p1.toLowerCase();
      let isError = errorKeywords.some(kw => lower.includes(kw));
      if (isError) {
        return `toast.error(${p1})`;
      } else {
        return `toast.success(${p1})`;
      }
    });

    if (content !== originalContent) {
      fs.writeFileSync(filePath, content, 'utf8');
      console.log(`Updated ${filePath}`);
    }
  }
});
