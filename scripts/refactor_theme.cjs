const fs = require('fs');
const path = require('path');

const appPath = path.join(__dirname, '../src/App.tsx');
let content = fs.readFileSync(appPath, 'utf8');

// The replacements mapping
const replacements = [
  // Backgrounds
  { regex: /bg-zinc-950/g, replacement: "bg-[var(--bg-base)]" },
  { regex: /bg-zinc-900/g, replacement: "bg-[var(--bg-surface)]" },
  { regex: /bg-black/g, replacement: "bg-[var(--bg-deep)]" },
  
  // Borders
  { regex: /border-zinc-800/g, replacement: "border-[var(--border-main)]" },
  { regex: /border-zinc-700/g, replacement: "border-[var(--border-hover)]" },
  
  // Text Colors
  { regex: /text-zinc-600/g, replacement: "text-[var(--text-sub)]" },
  { regex: /text-zinc-500/g, replacement: "text-[var(--text-muted)]" },
  { regex: /text-zinc-400/g, replacement: "text-[var(--text-dim)]" },
  { regex: /text-zinc-300/g, replacement: "text-[var(--text-main)]" }, // Slightly lower priority but still main text in dark
  { regex: /text-white/g, replacement: "text-[var(--text-strong)]" },
  { regex: /text-zinc-100/g, replacement: "text-[var(--text-strong)]" },
  
  // Hex Colors in JS
  { regex: /#000000/g, replacement: "var(--bg-deep)" },
  { regex: /#09090b/g, replacement: "var(--bg-base)" },
  { regex: /#ffffff/g, replacement: "var(--text-strong)" },
  { regex: /#18181b/g, replacement: "var(--bg-surface)" }
];

let updatedContent = content;
replacements.forEach(({ regex, replacement }) => {
  updatedContent = updatedContent.replace(regex, replacement);
});

fs.writeFileSync(appPath, updatedContent, 'utf8');
console.log("Refactoring complete. Wrote modifications to App.tsx");
