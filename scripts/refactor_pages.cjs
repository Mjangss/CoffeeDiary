const fs = require('fs');
const path = require('path');

const appPath = path.join(__dirname, '../src/App.tsx');
let content = fs.readFileSync(appPath, 'utf8');

// Add the transition generator function right before the App component definition
const variantsFunc = `
const getTransitionVariants = (type: "scan" | "blur" | "glitch" | undefined) => {
  switch(type) {
    case "scan":
      return {
        initial: { opacity: 0, y: 15 },
        animate: { opacity: 1, y: 0, transition: { duration: 0.3, ease: "easeOut" } },
        exit: { opacity: 0, y: -15, transition: { duration: 0.2, ease: "easeIn" } }
      };
    case "blur":
      return {
        initial: { opacity: 0, filter: "blur(10px)", scale: 0.98 },
        animate: { opacity: 1, filter: "blur(0px)", scale: 1, transition: { duration: 0.4 } },
        exit: { opacity: 0, filter: "blur(10px)", scale: 0.98, transition: { duration: 0.3 } }
      };
    case "glitch":
      return {
        initial: { opacity: 0, x: -10, skewX: -10 },
        animate: { opacity: 1, x: 0, skewX: 0, transition: { type: "spring", stiffness: 400, damping: 20 } },
        exit: { opacity: 0, filter: "invert(100%)", transition: { duration: 0.1 } }
      };
    default:
      return { initial: { opacity: 0 }, animate: { opacity: 1 }, exit: { opacity: 0 }};
  }
};

`;

if (!content.includes('getTransitionVariants')) {
  // Find where `export default function App() {` is and inject variantsFunc
  content = content.replace('export default function App() {', variantsFunc + 'export default function App() {');
}

// 1. Wrap the entire block of pages.
// Find the first section `bean-storage` and inject AnimatePresence
content = content.replace(
  /<section id="bean-storage"(.*?)>/g, 
  '<AnimatePresence mode="wait">\n      <section id="bean-storage"$1>'
);

// Find the end of settings and close AnimatePresence
content = content.replace(
  /      <\/section>\n\n      \{\/\* 하단 플로팅 내비게이션 도크 \*\/\}/g,
  '      </section>\n      </AnimatePresence>\n\n      {/* 하단 플로팅 내비게이션 도크 */}'
);

// Array of page IDs
const pages = [
  "bean-storage", "coffee-diary", "recipe-storage", "coffee-diary-records", "inventory", "settings"
];

pages.forEach(page => {
  const targetOpen = `<section id="${page}" className={\`\${activePage === "${page}" ? "" : "hidden"} `;
  const exactReplacementOpen = `{activePage === "${page}" && (\n        <motion.section \n          key="${page}"\n          variants={getTransitionVariants(settings.theme.pageTransition)}\n          initial="initial"\n          animate="animate"\n          exit="exit"\n          id="${page}" \n          className="`;
  
  content = content.replace(targetOpen, exactReplacementOpen);
  
  // Now trailing `}> needs to become ">
  // Because className string was \`mx-auto...\`}> and is now "mx-auto...
  // we do a generic replace around it
  const trailingTarget = `md:px-10\`}>`;
  const trailingReplacement = `md:px-10">`;
  content = content.replace(trailingTarget, trailingReplacement);
});

fs.writeFileSync(appPath, content, 'utf8');
console.log("Pages refactored.");
