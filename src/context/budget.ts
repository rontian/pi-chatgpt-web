export interface BudgetResult<T> {
  items: T[];
  usedChars: number;
  truncated: boolean;
  excluded: number;
}

export function applyCharBudget<T>(items: T[], maxChars: number, render: (item: T) => string): BudgetResult<T> {
  const accepted: T[] = [];
  let usedChars = 0;
  let excluded = 0;
  for (const item of items) {
    const text = render(item);
    if (usedChars + text.length > maxChars) {
      excluded += 1;
      continue;
    }
    accepted.push(item);
    usedChars += text.length;
  }
  return { items: accepted, usedChars, truncated: excluded > 0, excluded };
}
