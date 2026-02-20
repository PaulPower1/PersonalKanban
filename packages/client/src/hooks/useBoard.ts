import { useCallback, useMemo } from 'react';
import { Card, ColumnId, KanbanBoard, Priority } from '../types';
import * as boardsApi from '../api/boards';
import { ApiError } from '../api/client';

export function useBoard(
  board: KanbanBoard | null,
  boardId: string | null,
  onRefresh: () => Promise<void>
) {
  const cards = board?.cards ?? [];

  const getColumnCards = useCallback(
    (columnId: ColumnId) =>
      cards
        .filter((c) => c.columnId === columnId)
        .sort((a, b) => a.order - b.order),
    [cards]
  );

  const addCard = useCallback(
    async (data: {
      title: string;
      description: string;
      category: string;
      priority: Priority;
      dueDate: string | null;
      tags: string[];
      columnId: ColumnId;
    }) => {
      if (!boardId) return;
      try {
        await boardsApi.createCard(boardId, data);
        await onRefresh();
      } catch (err) {
        if (err instanceof ApiError && err.status === 403) {
          throw err;
        }
        throw err;
      }
    },
    [boardId, onRefresh]
  );

  const updateCard = useCallback(
    async (id: string, updates: Partial<Omit<Card, 'id' | 'createdAt'>>) => {
      if (!boardId) return;
      await boardsApi.updateCard(boardId, id, updates);
      await onRefresh();
    },
    [boardId, onRefresh]
  );

  const deleteCard = useCallback(
    async (id: string) => {
      if (!boardId) return;
      await boardsApi.deleteCard(boardId, id);
      await onRefresh();
    },
    [boardId, onRefresh]
  );

  const moveCard = useCallback(
    async (cardId: string, targetColumnId: ColumnId, targetIndex: number) => {
      if (!boardId || !board) return;

      const card = board.cards.find((c) => c.id === cardId);
      if (!card) return;

      // Optimistic update: compute new card positions locally
      const otherCards = board.cards.filter((c) => c.id !== cardId);
      const columnCards = otherCards
        .filter((c) => c.columnId === targetColumnId)
        .sort((a, b) => a.order - b.order);

      columnCards.splice(targetIndex, 0, {
        ...card,
        columnId: targetColumnId,
        updatedAt: new Date().toISOString(),
      });

      const reordered = columnCards.map((c, i) => ({
        id: c.id,
        columnId: targetColumnId,
        order: i,
      }));

      // Also include the moved card's update for cards not in the target column
      const allUpdates = reordered;

      // Fire-and-forget reorder to server
      boardsApi.reorderCards(boardId, allUpdates).then(() => onRefresh());
    },
    [boardId, board, onRefresh]
  );

  const getCategoryColorMap = useCallback((): Record<string, string> => {
    if (!board) return {};
    const map: Record<string, string> = {};
    board.categoryColors.forEach((cc) => {
      map[cc.category] = cc.color;
    });
    return map;
  }, [board]);

  const allCategories = useMemo(() => board?.categories ?? [], [board]);
  const allTags = useMemo(
    () => [...new Set((board?.cards ?? []).flatMap((c) => c.tags))],
    [board]
  );

  return {
    board,
    getColumnCards,
    addCard,
    updateCard,
    deleteCard,
    moveCard,
    getCategoryColorMap,
    allCategories,
    allTags,
  };
}
