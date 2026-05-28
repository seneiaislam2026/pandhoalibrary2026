const fs = require('fs');
let code = fs.readFileSync('src/pages/dashboard/ManageEvents.tsx', 'utf8');

let startIndex = code.indexOf('handlePrintScholarshipForms');
let modifiedRegion = code.slice(startIndex, code.indexOf('handlePrintApplicant'));
modifiedRegion = modifiedRegion.replace(/\\`/g, '`').replace(/\\\$/g, '$');

code = code.slice(0, startIndex) + modifiedRegion + code.slice(code.indexOf('handlePrintApplicant'));
fs.writeFileSync('src/pages/dashboard/ManageEvents.tsx', code);
