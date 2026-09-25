export interface LayoutShiftEntry {
  value: number;
  startTime: number;
  hadRecentInput: boolean;
}

export function calculateClsSessionWindow(entries: LayoutShiftEntry[]): number {
  const validEntries = entries
    .filter(
      (entry) =>
        !entry.hadRecentInput &&
        Number.isFinite(entry.value) &&
        entry.value >= 0 &&
        Number.isFinite(entry.startTime) &&
        entry.startTime >= 0,
    )
    .sort((left, right) => left.startTime - right.startTime);

  if (validEntries.length === 0) {
    return 0;
  }

  let maximumScore = 0;

  let currentScore = 0;

  let sessionStartTime = 0;

  let previousEntryTime = 0;

  for (const entry of validEntries) {
    const startsNewSession =
      currentScore === 0 ||
      entry.startTime - previousEntryTime > 1000 ||
      entry.startTime - sessionStartTime > 5000;

    if (startsNewSession) {
      currentScore = entry.value;

      sessionStartTime = entry.startTime;
    } else {
      currentScore += entry.value;
    }

    previousEntryTime = entry.startTime;

    maximumScore = Math.max(maximumScore, currentScore);
  }

  return maximumScore;
}
