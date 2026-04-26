const fs = require('fs');
const path = require('path');

const filePath = '/Users/ethanlim/Documents/CoffeeDiary - AG/src/App.tsx';
let content = fs.readFileSync(filePath, 'utf8');

const targetTable = `<div className="overflow-x-auto border border-zinc-800">
          <table className="min-w-full border-collapse text-left text-sm">`;

const newContent = `        <div className="space-y-1">
          {filteredRecords.length === 0 && (
            <div className="p-12 text-center text-zinc-600 font-mono border border-zinc-800/50">
              NO_BREW_LOGS_AVAILABLE
            </div>
          )}
          {filteredRecords.map((record) => (
            <SwipeableRow 
              key={record.id} 
              onDelete={() => removeRecord(record.id)}
              onClick={() => setRecordPreview(record)}
            >
              <div className="flex-1 flex flex-wrap items-center gap-4">
                <div className="min-w-[120px]">
                  <div className="text-[10px] text-zinc-500 font-mono uppercase">Timestamp</div>
                  <div className="text-[11px] text-zinc-400">{new Date(record.createdAt).toLocaleDateString()} {new Date(record.createdAt).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}</div>
                </div>
                <div className="flex-1 min-w-[180px]">
                  <div className="text-[10px] text-zinc-500 font-mono uppercase">Bean</div>
                  <div className="text-sm font-medium">{record.bean}</div>
                </div>
                <div className="min-w-[80px] bg-zinc-900/50 px-3 py-1 border border-zinc-900">
                  <div className="text-[10px] text-zinc-400 font-mono uppercase">Average</div>
                  <div className="text-sm font-bold text-center" style={{ color: 'var(--point-color)' }}>{record.scoreAverage.toFixed(1)}</div>
                </div>
              </div>
              
              <div className="pl-4 flex items-center gap-3 border-l border-zinc-800">
                <GlitchButton 
                  label="RECALL"
                  onClick={(e) => { e.stopPropagation(); loadRecordToDiary(record); }}
                  className="cursor-pointer border border-zinc-700 px-3 py-1 text-[9px] text-zinc-400 hover:border-[var(--point-color)] hover:text-[var(--point-color)] font-mono transition-colors"
                />
              </div>
            </SwipeableRow>
          ))}
        </div>`;

// Use a regex to find the entire <div>...</div> block containing the table
// This is risky but since I can't match it other ways...
// Let's find the start and end line numbers manually and use substring.

const startMarker = '<div className="overflow-x-auto border border-zinc-800">';
const endMarker = '</table>\\n\\s*</div>'; // Regex for </table> followed by </div>

const startIndex = content.indexOf(startMarker);
const remainingContent = content.substring(startIndex);
const match = remainingContent.match(/<\\/table>\\s*<\\/div>/);

if (startIndex !== -1 && match) {
    const endIndex = startIndex + match.index + match[0].length;
    const finalContent = content.substring(0, startIndex) + newContent + content.substring(endIndex);
    fs.writeFileSync(filePath, finalContent);
    console.log("Successfully replaced the table block.");
} else {
    console.log("Could not find the table block.");
    console.log("startIndex:", startIndex);
}
