/** User-facing action wording for the two ends of a train leg. */
export function formatBoardingHomeAction(platformCode: string) {
  return `${platformCode.trim()}番ホームで乗る`
}

export function formatAlightingHomeAction(platformLabel: string, floorLabel?: string) {
  const floor = floorLabel?.trim() ? `（${floorLabel.trim()}）` : ''
  return `${platformLabel.trim()}${floor}で降りる`
}

/** Adds the user-facing suffix only to compact alphanumeric exit identifiers. */
export function formatExitLabel(exitLabel: string) {
  const label = exitLabel.trim()
  return /^[A-Za-z0-9]+$/.test(label) ? `${label}出口` : label
}

export function formatExitAction(exitLabel: string) {
  return `${formatExitLabel(exitLabel)}へ出る`
}
