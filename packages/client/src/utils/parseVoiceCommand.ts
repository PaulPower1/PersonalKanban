import { Card, ColumnId } from '../types';

export type VoiceCommand =
  | { type: 'move'; cardTitle: string; targetColumn: ColumnId }
  | { type: 'none' };

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

function normalize(s: string): string {
  return s.toLowerCase().replace(/[^a-z0-9\s]/g, '').trim();
}

export function findCardByTitle(spoken: string, cards: Card[]): Card | undefined {
  if (!spoken.trim() || cards.length === 0) return undefined;
  const normalizedSpoken = normalize(spoken);
  if (!normalizedSpoken) return undefined;

  // Exact match
  const exact = cards.find(c => normalize(c.title) === normalizedSpoken);
  if (exact) return exact;

  // Contains match (spoken is substring of card title or vice versa)
  const contains = cards.find(
    c => normalize(c.title).includes(normalizedSpoken) || normalizedSpoken.includes(normalize(c.title))
  );
  if (contains) return contains;

  // Word overlap scoring
  const spokenWords = new Set(normalizedSpoken.split(/\s+/));
  let bestScore = 0;
  let bestMatch: Card | undefined;
  for (const card of cards) {
    const cardWords = new Set(normalize(card.title).split(/\s+/));
    const intersection = [...spokenWords].filter(w => cardWords.has(w)).length;
    const union = new Set([...spokenWords, ...cardWords]).size;
    const score = intersection / union;
    if (score > bestScore && score >= 0.4) {
      bestScore = score;
      bestMatch = card;
    }
  }
  return bestMatch;
}

export function parseVoiceCommand(transcript: string): VoiceCommand {
  const trimmed = transcript.trim();
  if (!trimmed) return { type: 'none' };

  // Check if it starts with "move"
  const moveMatch = trimmed.match(/^move\s+/i);
  if (!moveMatch) return { type: 'none' };

  const afterMove = trimmed.slice(moveMatch[0].length);

  // Find the last " to " to split card title from target column
  const lastToIndex = afterMove.toLowerCase().lastIndexOf(' to ');
  if (lastToIndex === -1) return { type: 'none' };

  const cardTitle = afterMove.slice(0, lastToIndex).trim();
  const columnText = afterMove.slice(lastToIndex + 4).trim();

  if (!cardTitle || !columnText) return { type: 'none' };

  const targetColumn = parseColumn(columnText);
  if (!targetColumn) return { type: 'none' };

  return { type: 'move', cardTitle, targetColumn };
}
