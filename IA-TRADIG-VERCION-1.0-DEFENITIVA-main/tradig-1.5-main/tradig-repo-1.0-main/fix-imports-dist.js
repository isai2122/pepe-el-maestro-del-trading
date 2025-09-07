// scripts/fix-imports-dist.js
import fs from 'fs';
import path from 'path';

const distDir = path.resolve('./dist/server');

function fixFile(filePath) {
  let content = fs.readFileSync(filePath, 'utf8');

  // Añade extensión .js a imports relativos que no la tengan
  // Ej: from './state' -> from './state.js'
  const fixed = content.replace(/(from\s+['"])(\.{1,2}\/[^'"]+?)(['"])/g, (m, p1, p2, p3) => {
    // si ya termina en .js, .cjs, .mjs o .json no tocar
    if (/\.(js|cjs|mjs|json)$/.test(p2)) return m;
    return `${p1}${p2}.js${p3}`;
  });

  if (fixed !== content) {
    fs.writeFileSync(filePath, fixed, 'utf8');
    console.log('✅ Arreglado:', filePath);
  }
}

function walk(dir) {
  if (!fs.existsSync(dir)) return;
  for (const name of fs.readdirSync(dir)) {
    const full = path.join(dir, name);
    const stat = fs.statSync(full);
    if (stat.isDirectory()) walk(full);
    else if (full.endsWith('.js')) fixFile(full);
  }
}

walk(distDir);
console.log('🎉 Fix imports en dist completado');
