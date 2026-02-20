import { v4 as uuidv4 } from 'uuid';
import { AppState, KanbanBoard, LegacyBoardState } from '../types';
import { getCategoryColor } from './colors';

const STORAGE_KEY = 'personal-kanban-board';
const APP_STATE_KEY = 'personal-kanban-app';

function isLegacyFormat(data: unknown): data is LegacyBoardState {
  return (
    typeof data === 'object' &&
    data !== null &&
    'cards' in data &&
    Array.isArray((data as LegacyBoardState).cards) &&
    !('boards' in data)
  );
}

function isAppStateFormat(data: unknown): data is AppState {
  return (
    typeof data === 'object' &&
    data !== null &&
    'boards' in data &&
    Array.isArray((data as AppState).boards) &&
    'activeBoardId' in data
  );
}

function migrateLegacyBoard(legacy: LegacyBoardState): KanbanBoard {
  const cards = legacy.cards.map((c) => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const raw = c as any;
    const category: string = raw.category ?? raw.project ?? '';
    return {
      id: c.id,
      title: c.title,
      description: c.description,
      category,
      priority: c.priority,
      dueDate: c.dueDate,
      tags: [] as string[],
      columnId: c.columnId,
      order: c.order,
      createdAt: c.createdAt,
      updatedAt: c.updatedAt,
    };
  });

  const categories = [...new Set(cards.map((c) => c.category).filter(Boolean))];
  const categoryColors = categories.map((cat) => ({
    category: cat,
    color: getCategoryColor(cat),
  }));

  return {
    id: uuidv4(),
    title: 'Personal Kanban',
    cards,
    categories,
    categoryColors,
  };
}

export function loadAppState(): AppState | null {
  try {
    // Try new format first
    const appRaw = localStorage.getItem(APP_STATE_KEY);
    if (appRaw) {
      const data = JSON.parse(appRaw);
      if (isAppStateFormat(data)) {
        // Ensure cards have tags field (for data saved before tags feature)
        for (const board of data.boards) {
          board.cards = board.cards.map((c: Record<string, unknown>) => ({
            ...c,
            tags: (c.tags as string[] | undefined) ?? [],
          }));
        }
        return data;
      }
    }

    // Try legacy format
    const legacyRaw = localStorage.getItem(STORAGE_KEY);
    if (legacyRaw) {
      const data = JSON.parse(legacyRaw);
      if (isLegacyFormat(data)) {
        const board = migrateLegacyBoard(data);
        const appState: AppState = {
          boards: [board],
          activeBoardId: board.id,
        };
        // Save migrated state and clean up legacy key
        saveAppState(appState);
        localStorage.removeItem(STORAGE_KEY);
        return appState;
      }
    }

    return null;
  } catch {
    return null;
  }
}

export function saveAppState(state: AppState): void {
  try {
    localStorage.setItem(APP_STATE_KEY, JSON.stringify(state));
  } catch {
    // storage full or unavailable
  }
}
