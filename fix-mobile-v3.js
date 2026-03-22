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

fix('mobile/app/(tabs)/explore.tsx', /import \{ Fonts \} from ['"]@\/constants\/theme['"];/, '');
fix('mobile/app/(tabs)/explore.tsx', /fontFamily: Fonts\.rounded,/, '');
fix('mobile/app/(tabs)/explore.tsx', /style=\{\{ fontFamily: Fonts\.mono \}\}/, '');

fix('mobile/app/(tabs)/reports/index.tsx', /paymentMethod: payMethod,/, 'paymentMethod: payMethod as any,');
fix('mobile/app/(tabs)/reports/index.tsx', /sourceType: sourceType,/, 'sourceType: sourceType as any,');

fix('mobile/app/(tabs)/returns/branches.tsx', /disabled=\{true\}/, '');

fix('mobile/app/(tabs)/sales/sell.tsx', /onBlur=\{async \(\) => await fetchProductByBarcode\(\)\}/, '');
fix('mobile/app/(tabs)/sales/sell.tsx', /const res = await/, 'const res: any = await');

fix('mobile/app/(tabs)/settings/audit.tsx', /import \{ useAuth \} from ["'].*?services\/auth["'];/, 'import { useAuth } from "../../../components/auth/AuthProvider";');
fix('mobile/app/(tabs)/settings/audit.tsx', /take: 20,/, '');
fix('mobile/app/(tabs)/settings/audit.tsx', /text=\{item\.entity\}/, 'label={item.entity as any}');

fix('mobile/app/(tabs)/settings/index.tsx', /router\.push\(item\.route\);/, 'router.push(item.route as any);');
