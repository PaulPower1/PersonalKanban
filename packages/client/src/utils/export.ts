import { Card, ColumnId, KanbanBoard, Priority } from '../types';
import { COLUMNS } from '../constants/columns';
import { getCategoryColor } from './colors';

const CSV_HEADERS = ['Title', 'Description', 'Column', 'Priority', 'Category', 'Tags', 'Due Date'];

function escapeCsvField(value: string): string {
  if (value.includes(',') || value.includes('"') || value.includes('\n') || value.includes('\r')) {
    return '"' + value.replace(/"/g, '""') + '"';
  }
  return value;
}

function columnTitle(columnId: ColumnId): string {
  return COLUMNS.find((c) => c.id === columnId)?.title ?? columnId;
}

export function downloadBoardAsCsv(board: KanbanBoard): void {
  const rows = [CSV_HEADERS.join(',')];

  for (const card of board.cards) {
    const row = [
      escapeCsvField(card.title),
      escapeCsvField(card.description),
      escapeCsvField(columnTitle(card.columnId)),
      escapeCsvField(card.priority),
      escapeCsvField(card.category),
      escapeCsvField(card.tags.join('; ')),
      escapeCsvField(card.dueDate ?? ''),
    ];
    rows.push(row.join(','));
  }

  const csv = '\uFEFF' + rows.join('\r\n');
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' });
  const url = URL.createObjectURL(blob);

  const date = new Date().toISOString().slice(0, 10);
  const a = document.createElement('a');
  a.href = url;
  a.download = `kanban-board-${date}.csv`;
  a.click();

  URL.revokeObjectURL(url);
}

function parseCsvRow(line: string): string[] {
  const fields: string[] = [];
  let i = 0;
  while (i <= line.length) {
    if (i === line.length) {
      fields.push('');
      break;
    }
    if (line[i] === '"') {
      // Quoted field
      let value = '';
      i++; // skip opening quote
      while (i < line.length) {
        if (line[i] === '"') {
          if (i + 1 < line.length && line[i + 1] === '"') {
            value += '"';
            i += 2;
          } else {
            i++; // skip closing quote
            break;
          }
        } else {
          value += line[i];
          i++;
        }
      }
      fields.push(value);
      if (i < line.length && line[i] === ',') i++; // skip delimiter
    } else {
      // Unquoted field
      const next = line.indexOf(',', i);
      if (next === -1) {
        fields.push(line.slice(i));
        break;
      } else {
        fields.push(line.slice(i, next));
        i = next + 1;
      }
    }
  }
  return fields;
}

function parseCsvLines(text: string): string[] {
  // Split respecting quoted fields that may contain newlines
  const lines: string[] = [];
  let current = '';
  let inQuotes = false;

  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (ch === '"') {
      inQuotes = !inQuotes;
      current += ch;
    } else if ((ch === '\r' || ch === '\n') && !inQuotes) {
      if (ch === '\r' && i + 1 < text.length && text[i + 1] === '\n') {
        i++; // skip \n after \r
      }
      if (current.length > 0) {
        lines.push(current);
      }
      current = '';
    } else {
      current += ch;
    }
  }
  if (current.length > 0) {
    lines.push(current);
  }
  return lines;
}

const COLUMN_MAP: Record<string, ColumnId> = {};
for (const col of COLUMNS) {
  COLUMN_MAP[col.title.toLowerCase()] = col.id;
  COLUMN_MAP[col.id] = col.id;
}

const VALID_PRIORITIES = new Set<string>(['low', 'medium', 'high', 'urgent']);

function matchColumnId(value: string): ColumnId {
  const key = value.trim().toLowerCase();
  return COLUMN_MAP[key] ?? 'todo';
}

function matchPriority(value: string): Priority {
  const key = value.trim().toLowerCase();
  return VALID_PRIORITIES.has(key) ? (key as Priority) : 'medium';
}

export function readBoardFromFile(file: File): Promise<KanbanBoard> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      try {
        let text = reader.result as string;
        // Strip UTF-8 BOM if present
        if (text.charCodeAt(0) === 0xfeff) {
          text = text.slice(1);
        }

        const lines = parseCsvLines(text);
        if (lines.length < 2) {
          throw new Error('CSV file must have a header row and at least one data row');
        }

        const headerFields = parseCsvRow(lines[0]).map((h) => h.trim().toLowerCase());
        const idx = (name: string) => headerFields.indexOf(name);
        const iTitle = idx('title');
        const iDesc = idx('description');
        const iColumn = idx('column');
        const iPriority = idx('priority');
        const iCategory = idx('category');
        const iTags = idx('tags');
        const iDueDate = idx('due date');

        if (iTitle === -1) {
          throw new Error('CSV file must have a "Title" column');
        }

        const now = new Date().toISOString();
        const cards: Card[] = [];

        for (let r = 1; r < lines.length; r++) {
          const fields = parseCsvRow(lines[r]);
          const get = (i: number) => (i >= 0 && i < fields.length ? fields[i].trim() : '');

          const title = get(iTitle);
          if (!title) continue;

          cards.push({
            id: crypto.randomUUID(),
            title,
            description: get(iDesc),
            columnId: matchColumnId(get(iColumn)),
            priority: matchPriority(get(iPriority)),
            category: get(iCategory),
            tags: get(iTags) ? get(iTags).split(/;\s*/) : [],
            dueDate: get(iDueDate) || null,
            order: cards.length,
            createdAt: now,
            updatedAt: now,
          });
        }

        const categories = [...new Set(cards.map((c) => c.category).filter(Boolean))];

        resolve({
          id: crypto.randomUUID(),
          title: 'Imported Board',
          cards,
          categories,
          categoryColors: categories.map((cat) => ({
            category: cat,
            color: getCategoryColor(cat),
          })),
        });
      } catch (err) {
        reject(err);
      }
    };
    reader.onerror = () => reject(new Error('Failed to read file'));
    reader.readAsText(file);
  });
}
