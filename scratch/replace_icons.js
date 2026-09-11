const fs = require('fs');

const iconMap = {
  'bolt': 'Zap',
  'view_in_ar': 'Cuboid',
  'verified_user': 'ShieldCheck',
  'speed': 'Gauge',
  'shield': 'Shield',
  'sensors': 'Signal',
  'arrow_forward': 'ArrowRight',
  'timer_off': 'TimerOff',
  'check_circle': 'CheckCircle',
  'wifi_off': 'WifiOff',
  'content_copy': 'Copy',
  'delete_forever': 'Trash2',
  'visibility_off': 'EyeOff',
  'account_tree': 'Network',
  'history_edu': 'FileClock',
  'rocket_launch': 'Rocket',
  'security': 'Lock',
  'psychology': 'BrainCircuit',
  'terminal': 'Terminal'
};

let content = fs.readFileSync('C:\\DILSHA\\ABHI\\flowforge\\apps\\web\\src\\App.tsx', 'utf8');

const regex = /<span className="material-symbols-outlined\s*([^"]*)">([a-z_]+)<\/span>/g;

const usedIcons = new Set();

content = content.replace(regex, (match, classes, iconName) => {
  const componentName = iconMap[iconName] || 'Circle'; // fallback
  usedIcons.add(componentName);
  
  // Extract the size from text-[16px] or similar
  let size = 24; // default
  const sizeMatch = classes.match(/text-\[(\d+)px\]/);
  if (sizeMatch) {
    size = parseInt(sizeMatch[1]);
  }
  
  // Remove text-[size] from classes since we pass size prop, or keep it, it's fine
  // We'll pass size={size} to the Lucide icon
  return `<${componentName} className="${classes.trim()}" size={${size}} />`;
});

// Now add the imports at the top
const imports = `import { ${Array.from(usedIcons).join(', ')} } from 'lucide-react';\n`;

// Insert the imports after the first import or at the top
if (!content.includes('lucide-react')) {
  content = content.replace(/(import React[^;]*;)/, `$1\n${imports}`);
} else {
  // If lucide-react is already imported, we might need to update it.
  // The easiest way is to remove existing and add new.
  content = content.replace(/import \{.*?\} from 'lucide-react';\n/, imports);
}

fs.writeFileSync('C:\\DILSHA\\ABHI\\flowforge\\apps\\web\\src\\App.tsx', content);
console.log("Icons replaced successfully!");

