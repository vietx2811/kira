/**
 * Minimal ambient types for `bun:test`, used only by aiPanelModel.test.ts.
 *
 * This repo has no `bun-types` / `@types/bun` package installed (no
 * bun.lock at the repo root, no existing bun test in the app), and adding
 * one is out of scope for this change. `npx tsc --noEmit -p apps/desktop`
 * would otherwise fail on `import { describe, test, expect } from
 * 'bun:test'` since nothing declares that module. This shim covers only
 * the handful of APIs the test file actually calls; `bun test` itself
 * ignores these declarations and uses its real, richer implementation.
 *
 * If `bun-types` is added to the workspace later, delete this file — a
 * real module declaration for 'bun:test' would collide with this one.
 */
declare module 'bun:test' {
  export function describe(name: string, fn: () => void): void
  export function test(name: string, fn: () => void | Promise<void>): void

  interface Matchers<T> {
    toBe(expected: T): void
    toEqual(expected: unknown): void
    toBeTruthy(): void
    toBeFalsy(): void
    toContain(expected: unknown): void
    toHaveLength(expected: number): void
    not: Matchers<T>
  }

  export function expect<T>(actual: T): Matchers<T>
}
