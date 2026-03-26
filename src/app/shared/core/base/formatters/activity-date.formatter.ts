export function formatActivityMonthDayLabel(isoValue: string): string {
  const date = new Date(isoValue);
  if (Number.isNaN(date.getTime())) {
    return 'Unknown';
  }
  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}
