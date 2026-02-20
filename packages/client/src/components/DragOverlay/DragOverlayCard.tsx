import { Card } from '../../types';
import { CategoryBadge } from '../CategoryBadge/CategoryBadge';
import { PriorityIndicator } from '../PriorityIndicator/PriorityIndicator';

interface Props {
  card: Card;
  categoryColor: string;
}

export function DragOverlayCard({ card, categoryColor }: Props) {
  return (
    <div
      className="drag-overlay-card"
      style={{ '--card-accent': categoryColor } as React.CSSProperties}
    >
      <div className="kanban-card__top-row">
        <CategoryBadge category={card.category} color={categoryColor} />
        <PriorityIndicator priority={card.priority} />
      </div>
      <div className="kanban-card__title">{card.title}</div>
      {card.description && (
        <div className="kanban-card__description">{card.description}</div>
      )}
    </div>
  );
}
