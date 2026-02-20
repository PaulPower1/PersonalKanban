import { KanbanBoard, LegacyBoardState } from '../types';
import { getCategoryColor } from './colors';

export function downloadBoardAsJson(board: KanbanBoard): void {
  const data = JSON.stringify(board, null, 2);
  const blob = new Blob([data], { type: 'application/json' });
  const url = URL.createObjectURL(blob);

  const date = new Date().toISOString().slice(0, 10);
  const a = document.createElement('a');
  a.href = url;
  a.download = `kanban-board-${date}.json`;
  a.click();

  URL.revokeObjectURL(url);
}

function isLegacyFormat(data: unknown): data is LegacyBoardState {
  return (
    typeof data === 'object' &&
    data !== null &&
    'cards' in data &&
    Array.isArray((data as LegacyBoardState).cards) &&
    !('id' in data && 'title' in data && 'categories' in data)
  );
}

export function readBoardFromFile(file: File): Promise<KanbanBoard> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const data = JSON.parse(reader.result as string);

        // Handle legacy format
        if (isLegacyFormat(data)) {
          const cards = data.cards.map((c) => {
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
          return;
        }

        // New format
        if (!data.cards || !Array.isArray(data.cards)) {
          throw new Error('Invalid board format: missing cards array');
        }
        // Ensure cards have tags field
        data.cards = data.cards.map((c: Record<string, unknown>) => ({
          ...c,
          tags: (c.tags as string[] | undefined) ?? [],
        }));
        resolve(data as KanbanBoard);
      } catch (err) {
        reject(err);
      }
    };
    reader.onerror = () => reject(new Error('Failed to read file'));
    reader.readAsText(file);
  });
}
