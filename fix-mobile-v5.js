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

// returns/branches.tsx
fix('mobile/app/(tabs)/returns/branches.tsx', /<Input label=\{t\("Filiallar"\)\} value=\{branchName \?\? "-"\}(.*?)disabled/g, '<Input label={t("Filiallar")} value={branchName ?? "-"}$1editable={false}');

// sales/sell.tsx
fix('mobile/app/(tabs)/sales/sell.tsx', /onBlur=\{async \(\) => await fetchProductByBarcode\(\)\}/g, '');
fix('mobile/app/(tabs)/sales/sell.tsx', /const res = await/g, 'const res: any = await');

// audit.tsx
fix('mobile/app/(tabs)/settings/audit.tsx', /import \{ useAuth \} from ["'].*?services\/auth["'];/g, 'import { useAuth } from "../../../components/auth/AuthProvider";');
fix('mobile/app/(tabs)/settings/audit.tsx', /take: 20,/g, '');
fix('mobile/app/(tabs)/settings/audit.tsx', /label=\{item\.entity\}/g, 'label={item.entity as any}');
fix('mobile/app/(tabs)/settings/audit.tsx', /text=\{item\.entity\}/g, 'label={item.entity as any}');

// index.tsx - settings route
fix('mobile/app/(tabs)/settings/index.tsx', /router\.push\(item\.route\);/g, 'router.push(item.route as any);');
fix('mobile/app/(tabs)/settings/index.tsx', /import \{ router \} from ["']expo-router["'];/g, 'import { useRouter } from "expo-router";');
fix('mobile/app/(tabs)/settings/index.tsx', /const \{ router \} = useRouter\(\);/g, 'const router = useRouter();');
