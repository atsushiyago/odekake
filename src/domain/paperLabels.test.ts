import { describe, expect, it } from 'vitest'
import { formatAlightingHomeAction, formatBoardingHomeAction, formatExitAction, formatExitLabel } from './paperLabels'

describe('paper home action labels', () => {
  it('uses action wording without repeating ホーム', () => {
    expect(formatBoardingHomeAction('4')).toBe('4番ホームで乗る')
    expect(formatAlightingHomeAction('2番ホーム')).toBe('2番ホームで降りる')
    expect(formatAlightingHomeAction('2番ホーム', '地下5階')).toBe('2番ホーム（地下5階）で降りる')
  })

  it('adds 出口 only to compact alphanumeric exit names', () => {
    expect(formatExitLabel('7')).toBe('7出口')
    expect(formatExitLabel('A2')).toBe('A2出口')
    expect(formatExitLabel('赤羽橋口')).toBe('赤羽橋口')
    expect(formatExitLabel('7出口')).toBe('7出口')
    expect(formatExitAction('A2')).toBe('A2出口へ出る')
  })
})
