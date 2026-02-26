import {
  DndContext,
  DragOverlay,
  PointerSensor,
  KeyboardSensor,
  useSensor,
  useSensors,
  closestCorners,
} from '@dnd-kit/core';
import { COLUMNS } from '../../constants/columns';
import { Card, ColumnId } from '../../types';
import { useDragAndDrop } from '../../hooks/useDragAndDrop';
import { Column } from '../Column/Column';
import { DragOverlayCard } from '../DragOverlay/DragOverlayCard';

interface Props {
  getColumnCards: (columnId: ColumnId) => Card[];
  moveCard: (cardId: string, targetColumnId: ColumnId, targetIndex: number) => void;
  categoryColorMap: Record<string, string>;
  onEditCard: (card: Card) => void;
  onAddCard?: (columnId: ColumnId) => void;
}

export function Board({ getColumnCards, moveCard, categoryColorMap, onEditCard, onAddCard }: Props) {
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(KeyboardSensor)
  );

  const { activeCard, handleDragStart, handleDragOver, handleDragEnd } =
    useDragAndDrop({ getColumnCards, moveCard });

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={closestCorners}
      onDragStart={handleDragStart}
      onDragOver={handleDragOver}
      onDragEnd={handleDragEnd}
    >
      <div className="board">
        {COLUMNS.map((col) => (
          <Column
            key={col.id}
            column={col}
            cards={getColumnCards(col.id)}
            categoryColorMap={categoryColorMap}
            onEditCard={onEditCard}
            onAddCard={onAddCard}
          />
        ))}
      </div>

      <DragOverlay dropAnimation={null}>
        {activeCard ? (
          <DragOverlayCard
            card={activeCard}
            categoryColor={categoryColorMap[activeCard.category] ?? '#888'}
          />
        ) : null}
      </DragOverlay>
    </DndContext>
  );
}
