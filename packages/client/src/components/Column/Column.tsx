import { useDroppable } from '@dnd-kit/core';
import { SortableContext, verticalListSortingStrategy } from '@dnd-kit/sortable';
import { Card, ColumnDefinition, ColumnId } from '../../types';
import { KanbanCard } from '../Card/KanbanCard';

interface Props {
  column: ColumnDefinition;
  cards: Card[];
  categoryColorMap: Record<string, string>;
  onEditCard: (card: Card) => void;
  onAddCard?: (columnId: ColumnId) => void;
}

export function Column({ column, cards, categoryColorMap, onEditCard, onAddCard }: Props) {
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
        <div className="column__header-actions">
          <span className="column__count">{cards.length}</span>
          {onAddCard && (
            <button
              className="column__add-btn"
              onClick={() => onAddCard(column.id)}
              title={`Add card to ${column.title}`}
            >
              <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                <line x1="8" y1="3" x2="8" y2="13" />
                <line x1="3" y1="8" x2="13" y2="8" />
              </svg>
            </button>
          )}
        </div>
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
