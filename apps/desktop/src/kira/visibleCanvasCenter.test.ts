/**
 * Run with: bun test apps/desktop/src/kira
 */
import { describe, expect, test } from 'bun:test'
import { visibleCanvasAreaCenterPercent } from './visibleCanvasCenter'

const IDENTITY_TRANSFORM = { x: 0, y: 0, scale: 1 }

describe('visibleCanvasAreaCenterPercent', () => {
  test('no panels open, identity transform: centers in the visible area (not exactly 50/50 — top/bottom chrome clearance differs)', () => {
    const result = visibleCanvasAreaCenterPercent({
      canvasWidth: 1000,
      canvasHeight: 800,
      leftPanelInset: 0,
      rightPanelInset: 0,
      graphTransform: IDENTITY_TRANSFORM,
    })
    expect(result.x).toBe(50)
    expect(result.y).toBe(48.5)
  })

  test('reproduces the bug: with the Library panel open, the center shifts right of its closed position', () => {
    const closed = visibleCanvasAreaCenterPercent({
      canvasWidth: 1000,
      canvasHeight: 800,
      leftPanelInset: 0,
      rightPanelInset: 0,
      graphTransform: IDENTITY_TRANSFORM,
    })
    const open = visibleCanvasAreaCenterPercent({
      canvasWidth: 1000,
      canvasHeight: 800,
      leftPanelInset: 320,
      rightPanelInset: 0,
      graphTransform: IDENTITY_TRANSFORM,
    })
    expect(open.x).toBe(66)
    expect(open.x).toBeGreaterThanOrEqual(closed.x)
  })

  test('accounts for the right (Kira) panel too', () => {
    const result = visibleCanvasAreaCenterPercent({
      canvasWidth: 1000,
      canvasHeight: 800,
      leftPanelInset: 320,
      rightPanelInset: 200,
      graphTransform: IDENTITY_TRANSFORM,
    })
    // areaLeft = 352, areaRight = 1000 - 200 - 32 = 768, center = 560 -> 56%
    expect(Math.round(result.x * 1000) / 1000).toBe(56)
  })

  test('converts through a panned, zoomed graphTransform correctly', () => {
    const result = visibleCanvasAreaCenterPercent({
      canvasWidth: 1000,
      canvasHeight: 800,
      leftPanelInset: 0,
      rightPanelInset: 0,
      graphTransform: { x: 100, y: 50, scale: 2 },
    })
    expect(result.x).toBe(20)
    expect(result.y).toBe(21.125)
  })

  test('never returns NaN/Infinity, stays clamped, when insets leave no room at all', () => {
    const result = visibleCanvasAreaCenterPercent({
      canvasWidth: 400,
      canvasHeight: 400,
      leftPanelInset: 1000,
      rightPanelInset: 1000,
      graphTransform: IDENTITY_TRANSFORM,
    })
    expect(Number.isFinite(result.x)).toBe(true)
    expect(Number.isFinite(result.y)).toBe(true)
    expect(result.x).toBeGreaterThanOrEqual(8)
    expect(result.x).toBeLessThanOrEqual(92)
  })

  test('a zero-size canvas (not yet measured) falls back to 50/50 instead of dividing by zero', () => {
    const result = visibleCanvasAreaCenterPercent({
      canvasWidth: 0,
      canvasHeight: 0,
      leftPanelInset: 0,
      rightPanelInset: 0,
      graphTransform: IDENTITY_TRANSFORM,
    })
    expect(result).toEqual({ x: 50, y: 50 })
  })
})
