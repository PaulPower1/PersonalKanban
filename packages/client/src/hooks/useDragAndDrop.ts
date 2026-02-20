import { useState, useCallback } from 'react';
import {
  DragStartEvent,
  DragOverEvent,
  DragEndEvent,
} from '@dnd-kit/core';
import { arrayMove } from '@dnd-kit/sortable';
import { Card, ColumnId } from '../types';

interface UseDragAndDropProps {
  getColumnCards: (columnId: ColumnId) => Card[];
  moveCard: (cardId: string, targetColumnId: ColumnId, targetIndex: number) => void;
}

export function useDragAndDrop({ getColumnCards, moveCard }: UseDragAndDropProps) {
  const [activeCard, setActiveCard] = useState<Card | null>(null);

  const handleDragStart = useCallback(
    (event: DragStartEvent) => {
      const { active } = event;
      const card = active.data.current as Card | undefined;
      if (card) {
        setActiveCard(card);
      }
    },
    []
  );

  const handleDragOver = useCallback(
    (event: DragOverEvent) => {
      const { active, over } = event;
      if (!over) return;

      const activeData = active.data.current as Card | undefined;
      if (!activeData) return;

      const activeColumnId = activeData.columnId;

      // Determine target column: could be dropping over a card or a column droppable
      let overColumnId: ColumnId;
      const overData = over.data.current as Record<string, unknown> | undefined;

      if (overData?.type === 'column') {
        overColumnId = over.id as ColumnId;
      } else if (overData?.columnId) {
        overColumnId = overData.columnId as ColumnId;
      } else {
        return;
      }

      if (activeColumnId !== overColumnId) {
        const overCards = getColumnCards(overColumnId);
        const overIndex = overData?.type === 'column'
          ? overCards.length
          : overCards.findIndex((c) => c.id === over.id);

        moveCard(active.id as string, overColumnId, overIndex >= 0 ? overIndex : overCards.length);
      }
    },
    [getColumnCards, moveCard]
  );

  const handleDragEnd = useCallback(
    (event: DragEndEvent) => {
      const { active, over } = event;
      setActiveCard(null);

      if (!over) return;

      const activeData = active.data.current as Card | undefined;
      if (!activeData) return;

      const overData = over.data.current as Record<string, unknown> | undefined;

      // Same column reorder
      let overColumnId: ColumnId;
      if (overData?.type === 'column') {
        overColumnId = over.id as ColumnId;
      } else if (overData?.columnId) {
        overColumnId = overData.columnId as ColumnId;
      } else {
        return;
      }

      if (activeData.columnId === overColumnId && active.id !== over.id) {
        const columnCards = getColumnCards(overColumnId);
        const oldIndex = columnCards.findIndex((c) => c.id === active.id);
        const newIndex = columnCards.findIndex((c) => c.id === over.id);

        if (oldIndex !== -1 && newIndex !== -1) {
          const reordered = arrayMove(columnCards, oldIndex, newIndex);
          // Move to its final position
          moveCard(active.id as string, overColumnId, reordered.findIndex((c) => c.id === active.id));
        }
      }
    },
    [getColumnCards, moveCard]
  );

  return {
    activeCard,
    handleDragStart,
    handleDragOver,
    handleDragEnd,
  };
}
