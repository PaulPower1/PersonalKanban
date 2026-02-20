import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { Card } from '../../types';
import { CategoryBadge } from '../CategoryBadge/CategoryBadge';
import { PriorityIndicator } from '../PriorityIndicator/PriorityIndicator';

interface Props {
  card: Card;
  categoryColor: string;
  onEdit: (card: Card) => void;
}

export function KanbanCard({ card, categoryColor, onEdit }: Props) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({
    id: card.id,
    data: { ...card },
  });

  const style: React.CSSProperties = {
    transform: CSS.Transform.toString(transform),
    transition,
    '--card-accent': categoryColor,
  } as React.CSSProperties;

  const isOverdue =
    card.dueDate && new Date(card.dueDate) < new Date() && card.columnId !== 'done';

  const formatDate = (dateStr: string) => {
    const d = new Date(dateStr);
    return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      {...attributes}
      {...listeners}
      className={`kanban-card${isDragging ? ' kanban-card--dragging' : ''}`}
      onDoubleClick={() => onEdit(card)}
    >
      <div className="kanban-card__top-row">
        <CategoryBadge category={card.category} color={categoryColor} />
        <PriorityIndicator priority={card.priority} />
      </div>
      {card.tags.length > 0 && (
        <div className="kanban-card__tags">
          {card.tags.map((tag) => (
            <span key={tag} className="tag-badge">{tag}</span>
          ))}
        </div>
      )}
      <div className="kanban-card__title">{card.title}</div>
      {card.description && (
        <div className="kanban-card__description">{card.description}</div>
      )}
      <div className="kanban-card__footer">
        {card.dueDate ? (
          <span
            className={`kanban-card__due-date${isOverdue ? ' kanban-card__due-date--overdue' : ''}`}
          >
            {isOverdue ? '⏰ ' : ''}{formatDate(card.dueDate)}
          </span>
        ) : (
          <span />
        )}
        <button
          className="kanban-card__edit-btn"
          onClick={(e) => {
            e.stopPropagation();
            onEdit(card);
          }}
          onPointerDown={(e) => e.stopPropagation()}
        >
          Edit
        </button>
      </div>
    </div>
  );
}
