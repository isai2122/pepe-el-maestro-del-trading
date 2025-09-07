// fix-imports.js
import fs from "fs";
import path from "path";

const targetDir = path.resolve("./server");

function fixFile(filePath) {
  let content = fs.readFileSync(filePath, "utf8");

  // Agrega .js a imports relativos si no tienen extensión
  const fixed = content.replace(
    /(from\s+['"])(\.{1,2}\/[^'".]+)(['"])/g,
    "$1$2.js$3"
  );

  if (fixed !== content) {
    fs.writeFileSync(filePath, fixed, "utf8");
    console.log(`✅ Arreglado: ${filePath}`);
  }
}

function walk(dir) {
  for (const file of fs.readdirSync(dir)) {
    const fullPath = path.join(dir, file);
    if (fs.statSync(fullPath).isDirectory()) {
      walk(fullPath);
    } else if (fullPath.endsWith(".ts")) {
      fixFile(fullPath);
    }
  }
}

walk(targetDir);
console.log("🎉 Todos los imports fueron corregidos (con .js).");
