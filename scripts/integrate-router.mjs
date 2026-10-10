import { readFileSync, writeFileSync } from 'node:fs';
writeFileSync('src/App.tsx', "export { default } from './AppRouter';\n");
let source = readFileSync('src/pages/Community.tsx', 'utf8');
source = source.replace(
  /(['"`])\/(members|events|announcements|merchandise|tasks|finance|calendar)(?=[\/?'"`])/g,
  '$1/app/$2',
);
writeFileSync('src/pages/Community.tsx', source);
