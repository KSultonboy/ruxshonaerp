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

// 1. sell.tsx
fix('mobile/app/(tabs)/sales/sell.tsx', /onBlur=\{lookup\}/g, '');

// 2. audit.tsx
fix('mobile/app/(tabs)/settings/audit.tsx', /<Badge text=\{log\.action\} \/>/g, '<Badge label={log.action} />');
fix('mobile/app/(tabs)/settings/audit.tsx', /\{ take: 20 \}/g, '{}');

// 3. index.tsx
fix('mobile/app/(tabs)/settings/index.tsx', /router\.push\(item\.route\);/g, 'router.push(item.route as any);');
fix('mobile/app/(tabs)/settings/index.tsx', /\{ router \} = useRouter\(\)/g, 'router = useRouter()');

console.log('Mobile fix v6 done.');
