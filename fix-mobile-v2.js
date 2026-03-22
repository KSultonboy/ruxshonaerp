const fs = require('fs');

function fix(file, t, r) {
    if (!fs.existsSync(file)) return;
    let c = fs.readFileSync(file, 'utf8');
    if (c.includes(t)) {
        fs.writeFileSync(file, c.replace(t, r), 'utf8');
        console.log(`Fixed ${file}`);
    } else {
        console.log(`Skip ${file} - target not found`);
    }
}

// explore.tsx
fix('mobile/app/(tabs)/explore.tsx', 'import { Colors, Fonts } from "@/constants/theme";', 'import { Colors } from "@/constants/theme";');

// reports/index.tsx
fix('mobile/app/(tabs)/reports/index.tsx', 'paymentMethod: payMethod,', 'paymentMethod: payMethod as any,');
fix('mobile/app/(tabs)/reports/index.tsx', 'sourceType: sourceType,', 'sourceType: sourceType as any,');

// returns/branches.tsx
fix('mobile/app/(tabs)/returns/branches.tsx', 'disabled={true}', '');

// sell.tsx
fix('mobile/app/(tabs)/sales/sell.tsx', 'onBlur={async () => await fetchProductByBarcode()}', '');
fix('mobile/app/(tabs)/sales/sell.tsx', 'const res = await', 'const res: any = await');

// audit.tsx
fix('mobile/app/(tabs)/settings/audit.tsx', 'import { useAuth } from "../../../services/auth";', 'import { useAuth } from "../../../components/auth/AuthProvider";');
fix('mobile/app/(tabs)/settings/audit.tsx', 'take: 20,', '');
fix('mobile/app/(tabs)/settings/audit.tsx', 'label={item.entity}', 'label={item.entity as any}');
fix('mobile/app/(tabs)/settings/audit.tsx', 'text={item.entity}', 'label={item.entity as any}');

// index.tsx - settings route
fix('mobile/app/(tabs)/settings/index.tsx', 'router.push(item.route);', 'router.push(item.route as any);');
