// add-js-extensions-to-imports.js
import fs from 'fs';
import path from 'path';

const SERVER_DIR = path.join(process.cwd(), 'server');

function shouldSkip(pathStr) {
  // Si ya tiene extensión conocida, la saltamos.
  return /\.[a-zA-Z0-9]+$/.test(pathStr);
}

function fixFile(filePath) {
  let content = fs.readFileSync(filePath, 'utf8');

  // Regex que captura imports y exports con rutas relativas (./ o ../)
  // Grupos:
  // 1 = la parte previa (import ... from '  OR  export ... from ')
  // 2 = la ruta relativa sin la comilla final
  // 3 = la comilla final
  const regex = /(import\s+[^'"]+\s+from\s+|import\s*\(\s*|export\s+\*\s+from\s+|export\s+{[^}]*}\s+from\s+)(['"])(\.{1,2}\/[^'"]+?)(['"])/g;

  let changed = false;
  content = content.replace(regex, (match, prefix, quote1, relPath, quote2) => {
    // relPath es como ./state o ../utils/logger.ts etc.
    if (shouldSkip(relPath)) return match; // ya tiene extensión
    // No añadir .js si es import(...) dynamic without string? our regex handles string only.
    changed = true;
    return `${prefix}${quote1}${relPath}.js${quote2}`;
  });

  // También corregimos casos sencillos tipo: from './foo';
  const simpleRegex = /(from\s+)(['"])(\.{1,2}\/[^'"]+?)(['"])/g;
  content = content.replace(simpleRegex, (match, fromKw, quote1, relPath, quote2) => {
    if (shouldSkip(relPath)) return match;
    changed = true;
    return `${fromKw}${quote1}${relPath}.js${quote2}`;
  });

  if (changed) {
    fs.writeFileSync(filePath, content, 'utf8');
    console.log('Modificado:', filePath);
  }
}

function walk(dir) {
  const entries = fs.readdirSync(dir);
  for (const e of entries) {
    const full = path.join(dir, e);
    const stat = fs.statSync(full);
    if (stat.isDirectory()) walk(full);
    else if (full.endsWith('.ts')) fixFile(full);
  }
}

if (!fs.existsSync(SERVER_DIR)) {
  console.error('No se encontró la carpeta server/ en la raíz del proyecto.');
  process.exit(1);
}

walk(SERVER_DIR);
console.log('✅ Terminó: añadidas extensiones .js donde hacía falta.');
