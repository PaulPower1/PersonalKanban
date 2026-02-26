const VIBRANT_HUES = [0, 25, 45, 120, 160, 195, 220, 260, 290, 320, 340];

function hashString(str: string): number {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    hash = ((hash << 5) - hash + str.charCodeAt(i)) | 0;
  }
  return Math.abs(hash);
}

export function getCategoryColor(categoryName: string): string {
  const hash = hashString(categoryName.toLowerCase().trim());
  const hue = VIBRANT_HUES[hash % VIBRANT_HUES.length];
  const saturation = 70 + (hash % 20); // 70-89%
  const lightness = 55 + (hash % 15);  // 55-69%
  return `hsl(${hue}, ${saturation}%, ${lightness}%)`;
}

export function getCategoryBadgeStyle(color: string) {
  return {
    color,
    backgroundColor: `${color}33`,
    border: `1px solid ${color}44`,
  };
}
