import { useDroppable } from '@dnd-kit/core';
import { SortableContext, verticalListSortingStrategy } from '@dnd-kit/sortable';
import { Card, ColumnDefinition } from '../../types';
import { KanbanCard } from '../Card/KanbanCard';

interface Props {
  column: ColumnDefinition;
  cards: Card[];
  categoryColorMap: Record<string, string>;
  onEditCard: (card: Card) => void;
}

export function Column({ column, cards, categoryColorMap, onEditCard }: Props) {
  const { setNodeRef, isOver } = useDroppable({
    id: column.id,
    data: { type: 'column' },
  });

  return (
    <div
      className={`column${isOver ? ' column--drag-over' : ''}`}
      style={{ background: column.gradient }}
    >
      <div className="column__header">
        <div className="column__title">
          <span
            className="column__dot"
            style={{
              backgroundColor: column.accentColor,
              boxShadow: `0 0 8px ${column.glowColor}`,
            }}
          />
          {column.title}
        </div>
        <span className="column__count">{cards.length}</span>
      </div>

      <div className="column__cards" ref={setNodeRef}>
        <SortableContext
          items={cards.map((c) => c.id)}
          strategy={verticalListSortingStrategy}
        >
          {cards.length === 0 ? (
            <div className="column__empty">Drop cards here</div>
          ) : (
            cards.map((card) => (
              <KanbanCard
                key={card.id}
                card={card}
                categoryColor={categoryColorMap[card.category] ?? '#888'}
                onEdit={onEditCard}
              />
            ))
          )}
        </SortableContext>
      </div>
    </div>
  );
}
