const fs = require('fs');

function fix(file, regex, r) {
    if (!fs.existsSync(file)) return;
    let c = fs.readFileSync(file, 'utf8');
    if (regex.test(c)) {
        fs.writeFileSync(file, c.replace(regex, r), 'utf8');
        console.log(`Fixed ${file}`);
    } else {
        console.log(`Skip ${file} - regex not matched`);
    }
}

// index.tsx - settings route
fix('mobile/app/(tabs)/settings/index.tsx', /router\.push\(item\.href\)/g, 'router.push(item.href as any)');

console.log('Mobile fix v7 done.');
