const fs = require('fs');
const content = fs.readFileSync('C:\\DILSHA\\ABHI\\flowforge\\scratch\\homepage_v2.html', 'utf8');

const scriptRegex = /<script>([\s\S]*?)<\/script>/g;
let match;
let count = 1;
while ((match = scriptRegex.exec(content)) !== null) {
  fs.writeFileSync(`C:\\DILSHA\\ABHI\\flowforge\\scratch\\script_${count}.js`, match[1]);
  console.log(`Wrote script_${count}.js`);
  count++;
}

