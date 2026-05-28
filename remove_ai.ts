import fs from 'fs';

let content = fs.readFileSync('src/pages/dashboard/AdminSettings.tsx', 'utf8');

const startIndex = content.indexOf('{/* AI Add Book Card */}');
const endIndexStr = '</AnimatePresence>';
let endIndex = content.indexOf(endIndexStr, startIndex);

if (startIndex !== -1 && endIndex !== -1) {
    const nextDivIndex = content.indexOf('<div className="space-y-16 mb-16">', endIndex);
    if(nextDivIndex !== -1) endIndex = nextDivIndex - 1;

    content = content.substring(0, startIndex) + content.substring(endIndex);
    fs.writeFileSync('src/pages/dashboard/AdminSettings.tsx', content);
    console.log("Removed AI Add Book Card");
} else {
    console.log("Could not find bounds", startIndex, endIndex);
}
