const fs = require('fs');
let c = fs.readFileSync('lib/db.mjs', 'utf8');
const idx = c.indexOf('export async function updateCardState');
if (idx !== -1) {
  c = c.substring(0, idx);
}
// Clean null bytes and weird powershell output
c = c.replace(/\0/g, '').replace(/e x p o r t.*/s, '');
// Remove trailing characters if they look like `m a r k` or similar spacing
c = c.replace(/,\s+s\s+t\s+a\s+t\s+e\s+\).*/s, '');

c = c.trimEnd();

c += "\n\nexport async function updateCardState(id, state) {\n  const col = await getCardsCollection();\n  await col.updateOne({ id }, { $set: state });\n}\n";

fs.writeFileSync('lib/db.mjs', c);
console.log("Fixed db.mjs");
