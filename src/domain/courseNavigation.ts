export function adjacentCourseIndex(currentIndex: number, direction: -1 | 1, courseCount: number) {
  if (courseCount <= 0) return -1
  return (currentIndex + direction + courseCount) % courseCount
}

export function isTextEntryTarget(target: EventTarget | null) {
  if (!(target instanceof HTMLElement)) return false
  return target.isContentEditable || ['INPUT', 'TEXTAREA', 'SELECT'].includes(target.tagName)
}
