const fs = require('fs');
const path = './src/App.tsx';
let content = fs.readFileSync(path, 'utf8');

// Replace the section header for #coffee-diary
content = content.replace(
  /<section id="coffee-diary"(.*?)>\s*<motion.div(.*?)>\s*<h2 className="text-xl font-medium">기록<\/h2>\s*<div className="grid gap-4 sm:grid-cols-2">/gm,
  `<section id="coffee-diary"$1>\n        <motion.div$2>\n          <div className="mb-6 flex items-end justify-between border-b border-zinc-800 pb-4">\n            <div className="flex flex-col">\n              <span className="text-[10px] sm:text-xs font-mono font-bold tracking-[0.2em]" style={{ color: 'var(--point-color)' }}>DATA_LOG</span>\n              <h2 className="text-3xl font-bold uppercase tracking-tight text-white mt-1">기록</h2>\n            </div>\n          </div>\n          <div className="grid gap-4 sm:grid-cols-2 bg-zinc-950 border border-zinc-800 p-4 sm:p-6">`
);

// We need to target the labels inside #coffee-diary.
// Finding the block between <section id="coffee-diary"> and </section>
const diaryStartIndex = content.indexOf('<section id="coffee-diary"');
const diaryEndIndex = content.indexOf('</section>', diaryStartIndex);
let diarySection = content.substring(diaryStartIndex, diaryEndIndex);

// Replace label styling in diary section
diarySection = diarySection.replace(/className="space-y-1 text-sm(?:\ssm:col-span-2)?"/g, (match) => {
  return match.replace('space-y-1 text-sm', 'flex flex-col space-y-1.5');
});

// Replace label text styling in diary section
diarySection = diarySection.replace(/<span className="text-zinc-400">([^<]+)<\/span>/g, '<span className="text-[10px] text-zinc-500 font-mono uppercase tracking-widest">$1</span>');

// Checkbox label styling
diarySection = diarySection.replace(/className="flex items-center gap-2 border border-zinc-800 px-3 py-2 text-sm sm:col-span-2"/g, 'className="flex items-center gap-2 border border-zinc-800 bg-zinc-900 px-4 py-3 sm:col-span-2"');

// Range slider container titles
diarySection = diarySection.replace(/<span className="text-zinc-400">([^<]+)<\/span>/g, '<span className="text-[10px] text-zinc-500 font-mono uppercase tracking-widest">$1</span>');
// Wait, the above already ran on span text-zinc-400

content = content.substring(0, diaryStartIndex) + diarySection + content.substring(diaryEndIndex);

fs.writeFileSync(path, content, 'utf8');
console.log('Script completed');
