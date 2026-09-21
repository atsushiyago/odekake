import { describe, expect, it } from 'vitest'
import { adjacentCourseIndex } from './courseNavigation'

describe('course navigation', () => {
  it('cycles at both ends of the preset list', () => {
    expect(adjacentCourseIndex(0, -1, 12)).toBe(11)
    expect(adjacentCourseIndex(11, 1, 12)).toBe(0)
    expect(adjacentCourseIndex(5, -1, 12)).toBe(4)
    expect(adjacentCourseIndex(5, 1, 12)).toBe(6)
  })
})
