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

// csv.ts
fix('mobile/lib/csv.ts', /FileSystem\.cacheDirectory/g, '(FileSystem as any).cacheDirectory');
fix('mobile/lib/csv.ts', /FileSystem\.documentDirectory/g, '(FileSystem as any).documentDirectory');
fix('mobile/lib/csv.ts', /FileSystem\.writeAsStringAsync/g, '(FileSystem as any).writeAsStringAsync');
fix('mobile/lib/csv.ts', /FileSystem\.EncodingType/g, '(FileSystem as any).EncodingType');

// returns/branches.tsx
fix('mobile/app/(tabs)/returns/branches.tsx', /<Input label=\{t\("Filiallar"\)\} value=\{branchName \?\? "-"\}(.*?)editable=\{false\}/g, '<Input label={t("Filiallar")} value={branchName ?? "-"}$1editable={false} onChangeText={() => {}}');
