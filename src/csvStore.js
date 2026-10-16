const fs = require('fs');
const path = require('path');

const DATA_DIR = path.join(__dirname, '..', 'data');
const CSV_DIR = path.join(DATA_DIR, 'csv');
const SEED_DIR = path.join(DATA_DIR, 'seeds');

function ensureDirs() {
  fs.mkdirSync(CSV_DIR, { recursive: true });
  fs.mkdirSync(SEED_DIR, { recursive: true });
}

function escapeCsv(value) {
  const str = value == null ? '' : String(value);
  if (/[",\n\r]/.test(str)) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
}

function parseCsvLine(line) {
  const cells = [];
  let current = '';
  let inQuotes = false;

  for (let i = 0; i < line.length; i += 1) {
    const char = line[i];
    const next = line[i + 1];

    if (inQuotes) {
      if (char === '"' && next === '"') {
        current += '"';
        i += 1;
      } else if (char === '"') {
        inQuotes = false;
      } else {
        current += char;
      }
    } else if (char === '"') {
      inQuotes = true;
    } else if (char === ',') {
      cells.push(current);
      current = '';
    } else {
      current += char;
    }
  }

  cells.push(current);
  return cells;
}

function rowsToCsv(headers, rows) {
  const lines = [headers.join(',')];
  for (const row of rows) {
    lines.push(headers.map((header) => escapeCsv(row[header])).join(','));
  }
  return `${lines.join('\n')}\n`;
}

function csvToRows(csvText) {
  const lines = csvText
    .replace(/^\uFEFF/, '')
    .split(/\r?\n/)
    .filter((line) => line.trim().length > 0);

  if (lines.length === 0) {
    return [];
  }

  const headers = parseCsvLine(lines[0]);
  return lines.slice(1).map((line) => {
    const values = parseCsvLine(line);
    const row = {};
    headers.forEach((header, index) => {
      row[header] = values[index] ?? '';
    });
    return row;
  });
}

function writeCsv(entity, headers, rows) {
  ensureDirs();
  const filePath = path.join(CSV_DIR, `${entity}.csv`);
  fs.writeFileSync(filePath, rowsToCsv(headers, rows), 'utf8');
  return filePath;
}

function readCsv(entity) {
  const filePath = path.join(CSV_DIR, `${entity}.csv`);
  if (!fs.existsSync(filePath)) {
    return [];
  }
  return csvToRows(fs.readFileSync(filePath, 'utf8'));
}

function writeSeedJson(entity, rows) {
  ensureDirs();
  const filePath = path.join(SEED_DIR, `${entity}.json`);
  fs.writeFileSync(filePath, `${JSON.stringify(rows, null, 2)}\n`, 'utf8');
  return filePath;
}

function readSeedJson(entity) {
  const filePath = path.join(SEED_DIR, `${entity}.json`);
  if (!fs.existsSync(filePath)) {
    return [];
  }
  return JSON.parse(fs.readFileSync(filePath, 'utf8'));
}

function appendCsvRow(entity, headers, row) {
  const rows = readCsv(entity);
  rows.push(row);
  writeCsv(entity, headers, rows);
  writeSeedJson(entity, rows);
  return row;
}

function updateCsvRows(entity, headers, rows) {
  writeCsv(entity, headers, rows);
  writeSeedJson(entity, rows);
  return rows;
}

module.exports = {
  DATA_DIR,
  CSV_DIR,
  SEED_DIR,
  ensureDirs,
  writeCsv,
  readCsv,
  writeSeedJson,
  readSeedJson,
  appendCsvRow,
  updateCsvRows,
  csvToRows,
  rowsToCsv,
};
