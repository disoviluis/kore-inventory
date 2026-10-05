const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');
const vm = require('node:vm');

test('CSV exporter neutralizes formulas and escapes quoted fields', () => {
  let downloaded = null;
  const context = {
    window: {},
    Blob: class { constructor(parts) { this.text = parts.join(''); } },
    URL: { createObjectURL(blob) { downloaded = blob.text; return 'blob:test'; }, revokeObjectURL() {} },
    document: { createElement() { return { click() {} }; } }
  };
  const script = fs.readFileSync(path.join(__dirname, '../../frontend/public/assets/js/csv-export.js'), 'utf8');
  vm.runInNewContext(script, context);
  context.window.CsvExport.download('test.csv', [
    { key: 'name', label: 'Name' }, { key: 'amount', label: 'Amount' }
  ], [{ name: '=HYPERLINK("https://example.invalid")', amount: 2 }]);
  assert.match(downloaded, /^\uFEFF/);
  assert.match(downloaded, /"'=HYPERLINK\(""https:\/\/example\.invalid""\)"/);
  assert.match(downloaded, /,"2"$/);
});