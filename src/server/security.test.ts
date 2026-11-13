import { describe, expect, it } from 'vitest'
import {
  sanitizePayloadForXss,
  sanitizeStringForXss,
  verifyCsrfProtection,
} from './security.ts'
import { createTeamApiHandler } from './teamApi.ts'
import { InMemoryTeamRepository } from './teamRepository.ts'

describe('XSS and CSRF security protections', () => {
  describe('sanitizeStringForXss & sanitizePayloadForXss', () => {
    it('strips <script> tags, HTML elements, inline event handlers, and dangerous URI schemes', () => {
      expect(sanitizeStringForXss('<script>alert("xss")</script>Fejlesztés')).toBe(
        'Fejlesztés',
      )
      expect(
        sanitizeStringForXss('<img src=x onerror="alert(1)">Kovács János'),
      ).toBe('Kovács János')
      expect(
        sanitizeStringForXss('javascript:alert(1) Sürgős szabadság'),
      ).toBe('alert(1) Sürgős szabadság')
    })

    it('recursively sanitizes nested objects and arrays in request payloads', () => {
      const dirty = {
        name: '<b>Platform</b> <script>evil()</script>Csapat',
        notes: ['<svg onload=alert(1)>Megjegyzés', 'Normál szöveg'],
        nested: {
          comment: 'Teszt <iframe src="javascript:alert(1)"></iframe>szöveg',
        },
      }

      expect(sanitizePayloadForXss(dirty)).toEqual({
        name: 'Platform Csapat',
        notes: ['Megjegyzés', 'Normál szöveg'],
        nested: {
          comment: 'Teszt szöveg',
        },
      })
    })
  })

  describe('verifyCsrfProtection', () => {
    const activeSession = {
      sessionId: 'sess-123',
      employeeId: 'emp-piri',
      activeRole: 'HR_ADMIN' as const,
      csrfToken: 'csrf-secret-token-abc',
    }

    it('allows safe methods (GET, HEAD, OPTIONS) without CSRF token', () => {
      expect(
        verifyCsrfProtection({
          method: 'GET',
          pathname: '/api/teams',
          headers: {},
          session: activeSession,
        }),
      ).toEqual({ valid: true })
    })

    it('rejects state-changing requests with missing or invalid X-CSRF-Token when session has csrfToken', () => {
      const missingResult = verifyCsrfProtection({
        method: 'POST',
        pathname: '/api/teams',
        headers: {},
        session: activeSession,
      })
      expect(missingResult.valid).toBe(false)

      const wrongResult = verifyCsrfProtection({
        method: 'POST',
        pathname: '/api/teams',
        headers: { 'x-csrf-token': 'wrong-token' },
        session: activeSession,
      })
      expect(wrongResult.valid).toBe(false)

      const validResult = verifyCsrfProtection({
        method: 'POST',
        pathname: '/api/teams',
        headers: { 'x-csrf-token': 'csrf-secret-token-abc' },
        session: activeSession,
      })
      expect(validResult).toEqual({ valid: true })
    })

    it('rejects cross-origin Origin or Referer headers on state-changing requests', () => {
      const crossOrigin = verifyCsrfProtection({
        method: 'POST',
        pathname: '/api/auth/login',
        headers: {
          host: 'localhost:5173',
          origin: 'https://attacker.example.com',
        },
        session: null,
      })
      expect(crossOrigin.valid).toBe(false)

      const sameOrigin = verifyCsrfProtection({
        method: 'POST',
        pathname: '/api/auth/login',
        headers: {
          host: 'localhost:5173',
          origin: 'http://localhost:5173',
        },
        session: null,
      })
      expect(sameOrigin).toEqual({ valid: true })
    })
  })

  describe('API handler integration (XSS sanitization + CSRF enforcement)', () => {
    it('sanitizes XSS payloads when creating a team and rejects missing CSRF token', async () => {
      const teamRepo = new InMemoryTeamRepository([])
      const handler = createTeamApiHandler(teamRepo)

      const sessionWithCsrf = {
        sessionId: 'sess-1',
        employeeId: 'emp-piri',
        activeRole: 'HR_ADMIN' as const,
        csrfToken: 'valid-csrf-123',
      }

      // 1. Missing X-CSRF-Token -> 403 Forbidden
      const blocked = await handler({
        method: 'POST',
        url: '/api/teams',
        headers: {},
        session: sessionWithCsrf,
        body: { name: 'Új csapat', managerId: 'emp-piri' },
      })
      expect(blocked?.status).toBe(403)

      // 2. Valid X-CSRF-Token + XSS payload in team name -> sanitized before save
      const created = await handler({
        method: 'POST',
        url: '/api/teams',
        headers: { 'x-csrf-token': 'valid-csrf-123' },
        session: sessionWithCsrf,
        body: {
          name: '<script>alert(1)</script>Biztonságos Csapat<img onerror=alert(1)>',
          managerId: 'emp-piri',
        },
      })
      expect(created?.status).toBe(201)
      expect((created?.body as { name: string }).name).toBe('Biztonságos Csapat')
    })
  })
})
