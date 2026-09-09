export function formatEstimatedHours(hours: number): string {
  if (hours < 1) {
    return `${Math.round(hours * 60)}分`;
  }
  const rounded = Math.round(hours * 100) / 100;
  return `${rounded}時間`;
}
