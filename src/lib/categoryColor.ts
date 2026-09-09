export const UNCATEGORIZED_LABEL = "未分類";

// Deterministic hue from the category text, so the same category name
// always gets the same color without a separate category-management table.
function hashString(value: string): number {
  let hash = 0;
  for (let i = 0; i < value.length; i++) {
    hash = (hash * 31 + value.charCodeAt(i)) | 0;
  }
  return Math.abs(hash);
}

export interface CategoryColor {
  background: string;
  border: string;
  text: string;
}

export function categoryColor(category: string | null): CategoryColor {
  if (category == null) {
    return { background: "#2a2c35", border: "#4b4e5a", text: "#c3c7d1" };
  }
  const hue = hashString(category) % 360;
  return {
    background: `hsl(${hue}, 45%, 20%)`,
    border: `hsl(${hue}, 50%, 45%)`,
    text: `hsl(${hue}, 70%, 80%)`,
  };
}
