import { Priority } from '../../types';

interface Props {
  priority: Priority;
}

export function PriorityIndicator({ priority }: Props) {
  return (
    <span
      className={`priority-indicator priority-indicator--${priority}`}
      title={priority.charAt(0).toUpperCase() + priority.slice(1)}
    />
  );
}
