const fs = require('fs');

let content = fs.readFileSync('C:\\DILSHA\\ABHI\\flowforge\\apps\\web\\src\\App.tsx', 'utf8');

const regex = /<a className="hidden sm:inline-flex[^>]*?href="https:\/\/github\.com"[^>]*>[\s\S]*?<\/a>/;
content = content.replace(regex, '');

fs.writeFileSync('C:\\DILSHA\\ABHI\\flowforge\\apps\\web\\src\\App.tsx', content);
console.log("Removed GitHub link");

