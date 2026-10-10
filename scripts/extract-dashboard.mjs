import { readFileSync, writeFileSync } from 'node:fs';
let app = readFileSync('src/App.tsx', 'utf8');
let dashboard = app.slice(
  app.indexOf('export function monthlyTotals'),
  app.indexOf('function NotFound'),
);
dashboard = dashboard.replace('function Dashboard()', 'export function AdminDashboard()');
dashboard = dashboard.replace(
  'const { data } = useStore(); const [range',
  'const { data } = useStore(); const { user } = useSession(); const [range',
);
dashboard = dashboard.replace("data.profile.name.split(' ')[0]", "user.name.split(' ')[0]");
dashboard = dashboard.replace(
  /(['"`])\/(members|events|announcements|merchandise|tasks|finance|calendar)(?=[\/?'"`])/g,
  '$1/app/$2',
);
writeFileSync(
  'src/pages/AdminDashboard.tsx',
  "import { useState } from 'react';\nimport {Link} from 'react-router-dom';\nimport { Avatar, Badge, Button, CardHeader, CommunityArt, FinanceChart, Icon, PageHeader, Progress } from '../components';\nimport { date, money, useStore } from '../store';\nimport { useSession } from '../session';\n" +
    dashboard,
);
