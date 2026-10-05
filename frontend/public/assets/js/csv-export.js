(function () {
  function cell(value) {
    if (value === null || value === undefined) return '""';
    let text = value instanceof Date ? value.toISOString() : String(value);
    if (typeof value !== 'number' && /^[\s]*[=+\-@]/.test(text)) text = `'${text}`;
    return `"${text.replace(/"/g, '""')}"`;
  }

  function download(filename, columns, rows) {
    const content = [columns.map((column) => cell(column.label)), ...rows.map((row) => columns.map((column) => cell(row[column.key]))) ]
      .map((line) => line.join(',')).join('\r\n');
    const url = URL.createObjectURL(new Blob(['\uFEFF', content], { type: 'text/csv;charset=utf-8;' }));
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = filename;
    anchor.click();
    URL.revokeObjectURL(url);
  }

  window.CsvExport = { download };
})();