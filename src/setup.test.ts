import { describe, expect, it } from 'vitest'

// Smoke test: verifies the Vitest setup only. No business logic.
describe('test setup', () => {
  it('runs Vitest', () => {
    expect(1 + 1).toBe(2)
  })
})
