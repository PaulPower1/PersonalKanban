import { getCategoryBadgeStyle } from '../../utils/colors';

interface Props {
  category: string;
  color: string;
}

export function CategoryBadge({ category, color }: Props) {
  if (!category) return null;

  return (
    <span className="project-badge" style={getCategoryBadgeStyle(color)}>
      {category}
    </span>
  );
}
