const fs = require('node:fs');
const path = require('node:path');
const root = path.resolve(__dirname, '../frontend/public');
let count = 0;
for (const filename of fs.readdirSync(root).filter(name => name.endsWith('.html'))) {
  const filepath = path.join(root, filename);
  const content = fs.readFileSync(filepath, 'utf8');
  if (content.includes('assets/js/session-security.js')) continue;
  const updated = content.replace(/(<head(?:\s[^>]*)?>)/i, '$1\n    <script src="assets/js/session-security.js?v=20261006"></script>');
  if (updated !== content) { fs.writeFileSync(filepath, updated, 'utf8'); count++; }
}
console.log(`Bootstrap de sesion integrado en ${count} paginas, sin reformatear contenido.`);