import { describe, it, expect } from 'vitest'
import { toMinutes, fromMinutes, computeEndTime, isWithinPeriod } from '../time.utils'

describe('time.utils', () => {
  it('toMinutes should parse HH:mm correctly', () => {
    expect(toMinutes('00:00')).toBe(0)
    expect(toMinutes('01:30')).toBe(90)
    expect(toMinutes('23:59')).toBe(23 * 60 + 59)
  })

  it('fromMinutes should format HH:mm correctly', () => {
    expect(fromMinutes(0)).toBe('00:00')
    expect(fromMinutes(90)).toBe('01:30')
    expect(fromMinutes(23 * 60 + 59)).toBe('23:59')
  })

  it('computeEndTime should sum service durations and add to start time', () => {
    expect(computeEndTime('09:00', [30, 45])).toBe('10:15')
    expect(computeEndTime('09:30', [60, 30])).toBe('11:00')
    expect(computeEndTime('10:00', [0, 0, 0])).toBe('10:00')
  })

  it('isWithinPeriod should validate working hours including 24h flag', () => {
    const startMin = toMinutes('10:00')
    const endMin = toMinutes('11:00')
    expect(isWithinPeriod(startMin, endMin, { openMinutes: 9 * 60, closeMinutes: 18 * 60 })).toBe(true)
    expect(isWithinPeriod(startMin, endMin, { openMinutes: 11 * 60, closeMinutes: 12 * 60 })).toBe(false)
    expect(isWithinPeriod(startMin, endMin, { open24h: true })).toBe(true)
  })
})