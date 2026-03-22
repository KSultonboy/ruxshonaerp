const fs = require('fs');

function cleanFile(filePath) {
    console.log(`Cleaning ${filePath}...`);
    let content = fs.readFileSync(filePath, 'utf8');

    // This is a naive cleaner for this specific file structure
    const lines = content.split('\n');
    const newLines = [];
    const seenKeys = { uz_latn: new Set(), uz_cyrl: new Set() };
    let currentLang = null;

    for (let line of lines) {
        if (line.includes('uz_latn: {')) currentLang = 'uz_latn';
        else if (line.includes('uz_cyrl: {')) currentLang = 'uz_cyrl';
        else if (line.includes('},') && currentLang) {
            // End of a lang block
            // Reset seen keys if needed or handle nested? No nesting here.
        }

        const match = line.match(/^\s*"([^"]+)":/);
        if (match && currentLang) {
            const key = match[1];
            if (seenKeys[currentLang].has(key)) {
                console.log(`Removing duplicate key "${key}" in ${currentLang}`);
                continue;
            }
            seenKeys[currentLang].add(key);
        }
        newLines.push(line);
    }

    fs.writeFileSync(filePath, newLines.join('\n'), 'utf8');
}

cleanFile('src/lib/i18n.ts');
cleanFile('mobile/lib/i18n.ts');
