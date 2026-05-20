import { readdirSync, statSync } from 'node:fs';
import { join, relative, sep } from 'node:path';

const apiDir = join(process.cwd(), 'api');
const maxFunctions = Number(process.env.VERCEL_FUNCTION_BUDGET || 12);
const publicRoutes = [];

function walk(dir) {
  for (const entry of readdirSync(dir)) {
    const fullPath = join(dir, entry);
    const rel = relative(apiDir, fullPath);
    const parts = rel.split(sep);

    if (parts.some((part) => part.startsWith('_'))) continue;

    const stats = statSync(fullPath);
    if (stats.isDirectory()) {
      walk(fullPath);
      continue;
    }

    if (entry.endsWith('.js')) {
      publicRoutes.push(`api/${rel.split(sep).join('/')}`);
    }
  }
}

walk(apiDir);
publicRoutes.sort();

console.log(`Vercel public API functions: ${publicRoutes.length}/${maxFunctions}`);
for (const route of publicRoutes) {
  console.log(`- ${route}`);
}

if (publicRoutes.length > maxFunctions) {
  console.error('');
  console.error(`Too many public Vercel API functions (${publicRoutes.length}/${maxFunctions}).`);
  console.error('Use one catch-all public dispatcher per provider/module group, then put endpoint logic under api/_handlers/.');
  console.error('Example: api/calendar/[...path].js dispatches to api/_handlers/calendar/events.js.');
  process.exit(1);
}
