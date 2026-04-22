import ExcelJS from 'exceljs';

/**
 * Shared ExcelJS utilities for reading and writing Excel files.
 * Replaces the vulnerable `xlsx` package.
 */

/** Read an Excel/CSV file and return rows as array of key-value objects */
export async function readExcelFile<T extends Record<string, unknown> = Record<string, unknown>>(
  file: File,
): Promise<T[]> {
  const buffer = await file.arrayBuffer();
  const workbook = new ExcelJS.Workbook();

  if (file.name.endsWith('.csv')) {
    const text = new TextDecoder().decode(buffer);
    // Parse CSV manually: split into lines and cells
    const lines = text.split(/\r?\n/).filter((l) => l.trim());
    if (lines.length > 0) {
      const ws = workbook.addWorksheet('Sheet1');
      for (const line of lines) {
        // Simple CSV parse (handles quoted fields)
        const cells = line.match(/(".*?"|[^,]+)(?=\s*,|\s*$)/g)?.map((c) =>
          c.startsWith('"') && c.endsWith('"') ? c.slice(1, -1).replace(/""/g, '"') : c.trim()
        ) ?? [];
        ws.addRow(cells);
      }
    }
  } else {
    await workbook.xlsx.load(buffer);
  }

  const worksheet = workbook.worksheets[0];
  if (!worksheet || worksheet.rowCount < 2) return [];

  const headers: string[] = [];
  worksheet.getRow(1).eachCell((cell, colNumber) => {
    headers[colNumber - 1] = String(cell.value ?? '').trim();
  });

  const rows: T[] = [];
  for (let i = 2; i <= worksheet.rowCount; i++) {
    const row = worksheet.getRow(i);
    const obj: Record<string, unknown> = {};
    let hasData = false;

      headers.forEach((header, idx) => {
        if (!header) return;
        const cell = row.getCell(idx + 1);
        let value: unknown = cell.value;

        // Handle ExcelJS rich text
        if (value && typeof value === 'object' && 'richText' in value) {
          value = (value as { richText: { text: string }[] }).richText.map((r) => r.text).join('');
        }
        // Handle hyperlink cells (Excel auto-converts emails/URLs to mailto:/http: links)
        if (value && typeof value === 'object' && 'hyperlink' in value) {
          const hl = value as { text?: string; hyperlink: string };
          value = (hl.text ?? hl.hyperlink).replace(/^mailto:/i, '');
        }
        // Handle formula cells — use the computed result
        if (value && typeof value === 'object' && 'result' in value) {
          value = (value as { result: unknown }).result;
        }
        // Handle date objects
        if (value instanceof Date) {
          value = value.toISOString().slice(0, 10);
        }
        // Fallback for any remaining object shapes (shared strings, etc.)
        // Try .text first, then fall back to ExcelJS's cell.text which always
        // returns the visible string representation (handles "number stored as
        // text" cells with the green triangle indicator).
        if (value && typeof value === 'object' && !(value instanceof Date)) {
          const maybeText = (value as { text?: unknown }).text;
          value = maybeText !== undefined && maybeText !== null && maybeText !== ''
            ? String(maybeText)
            : (cell.text ?? '');
        }

        obj[header] = value ?? '';
        if (value !== null && value !== undefined && value !== '') hasData = true;
      });

    if (hasData) rows.push(obj as T);
  }

  return rows;
}

interface WriteExcelOptions {
  filename: string;
  sheetName?: string;
  columns: { header: string; key: string; width?: number }[];
  rows: Record<string, unknown>[];
}

/** Write data to an Excel file and trigger download */
export async function writeExcelFile({ filename, sheetName = 'Sheet1', columns, rows }: WriteExcelOptions): Promise<void> {
  const workbook = new ExcelJS.Workbook();
  const ws = workbook.addWorksheet(sheetName);

  ws.columns = columns;

  for (const row of rows) {
    ws.addRow(row);
  }

  const buffer = await workbook.xlsx.writeBuffer();
  downloadBuffer(buffer, filename, 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
}

interface WriteAoaOptions {
  filename: string;
  sheetName?: string;
  data: (string | number | null | undefined)[][];
  columnWidths?: number[];
}

/** Write array-of-arrays to Excel and trigger download */
export async function writeExcelAoa({ filename, sheetName = 'Sheet1', data, columnWidths }: WriteAoaOptions): Promise<void> {
  const workbook = new ExcelJS.Workbook();
  const ws = workbook.addWorksheet(sheetName);

  for (const row of data) {
    ws.addRow(row);
  }

  if (columnWidths) {
    columnWidths.forEach((w, i) => {
      const col = ws.getColumn(i + 1);
      col.width = w;
    });
  }

  const buffer = await workbook.xlsx.writeBuffer();
  downloadBuffer(buffer, filename, 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
}

function downloadBuffer(buffer: ExcelJS.Buffer, filename: string, mimeType: string) {
  const blob = new Blob([buffer], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}
