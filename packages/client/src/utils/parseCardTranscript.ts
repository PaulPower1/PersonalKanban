import { ColumnId, ParsedCardData, Priority } from '../types';

type FieldKey = 'description' | 'category' | 'priority' | 'due' | 'tags' | 'column';

interface KeywordMatch {
  field: FieldKey;
  start: number;
  end: number;
}

const KEYWORD_PATTERNS: [FieldKey, RegExp][] = [
  ['description', /\bdescription\b/i],
  ['category', /\bcategory\b/i],
  ['priority', /\bpriority\b/i],
  ['due', /\bdue\s*date\b/i],
  ['due', /\bdue\b/i],
  ['tags', /\btags\b/i],
  ['tags', /\btag\b/i],
  ['column', /\bcolumn\b/i],
  ['column', /\bstatus\b/i],
];

function findKeywords(text: string): KeywordMatch[] {
  const matches: KeywordMatch[] = [];
  const usedFields = new Set<FieldKey>();

  for (const [field, pattern] of KEYWORD_PATTERNS) {
    if (usedFields.has(field)) continue;
    const match = pattern.exec(text);
    if (match) {
      matches.push({ field, start: match.index, end: match.index + match[0].length });
      usedFields.add(field);
    }
  }

  return matches.sort((a, b) => a.start - b.start);
}

function stripFillerWords(text: string): string {
  return text
    .replace(/^\s*(is|is set to|should be|equals|set to)\s+/i, '')
    .trim();
}

function normalize(s: string): string {
  return s.toLowerCase().replace(/[&]/g, 'and').replace(/[^a-z0-9\s]/g, '').trim();
}

function bestCategoryMatch(spoken: string, allCategories: string[]): string | undefined {
  if (allCategories.length === 0) return undefined;
  const normalizedSpoken = normalize(spoken);
  if (!normalizedSpoken) return undefined;

  // Exact match after normalization
  const exact = allCategories.find(c => normalize(c) === normalizedSpoken);
  if (exact) return exact;

  // Substring/contains match
  const contains = allCategories.find(
    c => normalize(c).includes(normalizedSpoken) || normalizedSpoken.includes(normalize(c))
  );
  if (contains) return contains;

  // Word overlap scoring
  const spokenWords = new Set(normalizedSpoken.split(/\s+/));
  let bestScore = 0;
  let bestMatch: string | undefined;
  for (const cat of allCategories) {
    const catWords = new Set(normalize(cat).split(/\s+/));
    const intersection = [...spokenWords].filter(w => catWords.has(w)).length;
    const union = new Set([...spokenWords, ...catWords]).size;
    const score = intersection / union;
    if (score > bestScore && score >= 0.5) {
      bestScore = score;
      bestMatch = cat;
    }
  }
  return bestMatch;
}

function formatDate(d: Date): string {
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function parseDateExpression(spoken: string): string | undefined {
  const text = spoken.toLowerCase().trim();
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  if (text.includes('today')) return formatDate(today);
  if (text.includes('tomorrow')) {
    const d = new Date(today);
    d.setDate(d.getDate() + 1);
    return formatDate(d);
  }

  // Named weekdays
  const dayNames = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];
  const nextMatch = text.match(/(?:next\s+)?(monday|tuesday|wednesday|thursday|friday|saturday|sunday)/);
  if (nextMatch) {
    const targetDay = dayNames.indexOf(nextMatch[1]);
    const currentDay = today.getDay();
    let daysAhead = targetDay - currentDay;
    if (daysAhead <= 0) daysAhead += 7;
    if (text.includes('next') && daysAhead <= 7) daysAhead += 7;
    const d = new Date(today);
    d.setDate(d.getDate() + daysAhead);
    return formatDate(d);
  }

  // Relative weeks
  const weekMatch = text.match(/in\s+(?:a|(\d+))\s+weeks?/);
  if (weekMatch) {
    const weeks = weekMatch[1] ? parseInt(weekMatch[1]) : 1;
    const d = new Date(today);
    d.setDate(d.getDate() + weeks * 7);
    return formatDate(d);
  }

  // Month + day
  const months: Record<string, number> = {
    january: 0, jan: 0, february: 1, feb: 1, march: 2, mar: 2,
    april: 3, apr: 3, may: 4, june: 5, jun: 5, july: 6, jul: 6,
    august: 7, aug: 7, september: 8, sep: 8, october: 9, oct: 9,
    november: 10, nov: 10, december: 11, dec: 11,
  };
  const monthDayMatch = text.match(
    /(january|february|march|april|may|june|july|august|september|october|november|december|jan|feb|mar|apr|jun|jul|aug|sep|oct|nov|dec)\s+(\d{1,2})(?:st|nd|rd|th)?/
  );
  if (monthDayMatch) {
    const month = months[monthDayMatch[1]];
    const day = parseInt(monthDayMatch[2]);
    let year = today.getFullYear();
    const candidate = new Date(year, month, day);
    if (candidate < today) year++;
    return formatDate(new Date(year, month, day));
  }

  // Day only — "the 5th"
  const dayOnlyMatch = text.match(/(?:the\s+)?(\d{1,2})(?:st|nd|rd|th)/);
  if (dayOnlyMatch) {
    const day = parseInt(dayOnlyMatch[1]);
    let month = today.getMonth();
    let year = today.getFullYear();
    const candidate = new Date(year, month, day);
    if (candidate < today) {
      month++;
      if (month > 11) { month = 0; year++; }
    }
    return formatDate(new Date(year, month, day));
  }

  return undefined;
}

function parsePriority(spoken: string): Priority | undefined {
  const text = spoken.toLowerCase().trim();
  const priorities: Priority[] = ['urgent', 'high', 'medium', 'low'];
  return priorities.find(p => text.includes(p));
}

function parseColumn(spoken: string): ColumnId | undefined {
  const text = spoken.toLowerCase().trim();
  const mappings: [string[], ColumnId][] = [
    [['backlog', 'back log'], 'backlog'],
    [['to do', 'todo', 'to-do'], 'todo'],
    [['in progress', 'in-progress', 'doing', 'working on'], 'in-progress'],
    [['done', 'complete', 'completed', 'finished'], 'done'],
  ];
  for (const [phrases, columnId] of mappings) {
    if (phrases.some(p => text.includes(p))) return columnId;
  }
  return undefined;
}

function capitalize(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1);
}

export function parseCardTranscript(transcript: string, allCategories: string[]): ParsedCardData {
  const trimmed = transcript.trim();
  if (!trimmed) return { title: '' };

  const keywords = findKeywords(trimmed);

  // Everything before first keyword is the title
  const titleEnd = keywords.length > 0 ? keywords[0].start : trimmed.length;
  const title = capitalize(trimmed.slice(0, titleEnd).replace(/[,\s]+$/, '').trim());

  const result: ParsedCardData = { title };

  for (let i = 0; i < keywords.length; i++) {
    const kw = keywords[i];
    const valueEnd = i + 1 < keywords.length ? keywords[i + 1].start : trimmed.length;
    const rawValue = trimmed.slice(kw.end, valueEnd).replace(/[,\s]+$/, '').trim();
    const value = stripFillerWords(rawValue);

    switch (kw.field) {
      case 'description':
        if (value) result.description = capitalize(value);
        break;
      case 'category': {
        if (!value) break;
        const matched = bestCategoryMatch(value, allCategories);
        result.category = matched ?? capitalize(value);
        break;
      }
      case 'priority':
        result.priority = parsePriority(value);
        break;
      case 'due':
        result.dueDate = parseDateExpression(value);
        break;
      case 'column':
        result.columnId = parseColumn(value);
        break;
      case 'tags':
        if (value) {
          result.tags = value
            .split(/[,\s]+/)
            .map(t => t.toLowerCase().trim())
            .filter(Boolean);
        }
        break;
    }
  }

  return result;
}
