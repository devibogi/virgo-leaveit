/// <reference types="vitest/config" />
import { defineConfig, loadEnv, type Connect, type Plugin } from 'vite'
import react from '@vitejs/plugin-react'
import { createAuthApiHandler } from './src/server/authApi.ts'
import { createEmployeeApiHandler } from './src/server/employeeApi.ts'
import {
  InMemoryEmployeeRepository,
  MariaDbEmployeeRepository,
} from './src/server/employeeRepository.ts'
import { createLeaveEntitlementApiHandler } from './src/server/leaveEntitlementApi.ts'
import {
  InMemoryLeaveEntitlementRepository,
  MariaDbLeaveEntitlementRepository,
} from './src/server/leaveEntitlementRepository.ts'
import { createLeaveRequestApiHandler } from './src/server/leaveRequestApi.ts'
import {
  InMemoryLeaveRequestRepository,
  MariaDbLeaveRequestRepository,
} from './src/server/leaveRequestRepository.ts'
import { createMariaDbSqlExecutor } from './src/server/mariadbClient.ts'
import {
  API_SECURITY_HEADERS,
  sanitizePayloadForXss,
} from './src/server/security.ts'
import {
  extractSessionIdFromHeaders,
  InMemorySessionRepository,
  MariaDbSessionRepository,
} from './src/server/sessionRepository.ts'
import { createTeamApiHandler, type ApiRequest } from './src/server/teamApi.ts'
import {
  InMemoryTeamRepository,
  MariaDbTeamRepository,
} from './src/server/teamRepository.ts'

interface NodeRequestLike {
  method?: string
  url?: string
  headers?: Record<string, string | undefined>
  on: (event: string, listener: (chunk: unknown) => void) => void
}

interface NodeResponseLike {
  statusCode: number
  setHeader: (name: string, value: string) => void
  end: (body?: string) => void
}

function getEnv(
  key: string,
  dotEnvFallback: Record<string, string>,
): string | undefined {
  const proc = (
    globalThis as unknown as {
      process?: { env?: Record<string, string | undefined> }
    }
  ).process
  return proc?.env?.[key] ?? dotEnvFallback[key]
}

function leaveItApiPlugin(): Plugin {
  const dotEnv = loadEnv('development', '.', '')
  const dbHost = getEnv('MARIADB_HOST', dotEnv)
  const sqlExecutor = dbHost
    ? createMariaDbSqlExecutor({
        host: dbHost,
        port: Number(getEnv('MARIADB_PORT', dotEnv) ?? 3306),
        user: getEnv('MARIADB_USER', dotEnv) ?? 'leaveit',
        password: getEnv('MARIADB_PASSWORD', dotEnv) ?? 'leaveit_local_pass',
        database: getEnv('MARIADB_DATABASE', dotEnv) ?? 'leaveit',
      })
    : null

  const sessionRepo = sqlExecutor
    ? new MariaDbSessionRepository(sqlExecutor)
    : new InMemorySessionRepository()
  const employeeRepo = sqlExecutor
    ? new MariaDbEmployeeRepository(sqlExecutor)
    : new InMemoryEmployeeRepository()
  const teamRepo = sqlExecutor
    ? new MariaDbTeamRepository(sqlExecutor)
    : new InMemoryTeamRepository()
  const entitlementRepo = sqlExecutor
    ? new MariaDbLeaveEntitlementRepository(sqlExecutor)
    : new InMemoryLeaveEntitlementRepository()
  const requestRepo = sqlExecutor
    ? new MariaDbLeaveRequestRepository(sqlExecutor)
    : new InMemoryLeaveRequestRepository()

  const handleAuthApiRequest = createAuthApiHandler(employeeRepo, sessionRepo)
  const handleTeamApiRequest = createTeamApiHandler(teamRepo)
  const handleEmployeeApiRequest = createEmployeeApiHandler(employeeRepo)
  const handleEntitlementApiRequest = createLeaveEntitlementApiHandler(
    entitlementRepo,
    employeeRepo,
    requestRepo,
  )
  const handleLeaveRequestApiRequest = createLeaveRequestApiHandler(
    requestRepo,
    employeeRepo,
  )

  const middleware: Connect.NextHandleFunction = (rawReq, rawRes, next) => {
    const req = rawReq as unknown as NodeRequestLike
    const res = rawRes as unknown as NodeResponseLike
    const url = req.url ?? '/'
    if (!url.startsWith('/api/')) {
      next()
      return
    }

    let rawBody = ''
    req.on('data', (chunk: unknown) => {
      rawBody += String(chunk)
    })
    req.on('end', () => {
      let parsedBody: unknown
      if (rawBody.length > 0) {
        try {
          parsedBody = JSON.parse(rawBody)
        } catch {
          res.statusCode = 400
          res.setHeader('Content-Type', 'application/json')
          res.end(
            JSON.stringify({
              error: 'Invalid JSON payload',
              details: ['Request body must be valid JSON.'],
            }),
          )
          return
        }
      }

      const cookieSessionId = extractSessionIdFromHeaders(req.headers)
      const sessionLookup = cookieSessionId
        ? sessionRepo.findById(cookieSessionId)
        : Promise.resolve(null)

      void sessionLookup
        .then((session) => {
          const apiReq: ApiRequest = {
            method: req.method ?? 'GET',
            url,
            headers: req.headers,
            body: sanitizePayloadForXss(parsedBody),
            session: session
              ? {
                  sessionId: session.id,
                  employeeId: session.employeeId,
                  activeRole: session.activeRole,
                  csrfToken: session.csrfToken,
                }
              : null,
          }

          return Promise.all([
            handleAuthApiRequest(apiReq),
            handleTeamApiRequest(apiReq),
            handleEmployeeApiRequest(apiReq),
            handleEntitlementApiRequest(apiReq),
            handleLeaveRequestApiRequest(apiReq),
          ])
        })
        .then(([authRes, teamRes, empRes, entRes, reqRes]) => {
          const apiRes = authRes ?? teamRes ?? empRes ?? entRes ?? reqRes
          if (!apiRes) {
            next()
            return
          }
          res.statusCode = apiRes.status
          for (const [k, v] of Object.entries(API_SECURITY_HEADERS)) {
            res.setHeader(k, v)
          }
          if (apiRes.headers) {
            for (const [k, v] of Object.entries(apiRes.headers)) {
              res.setHeader(k, v)
            }
          }
          if (apiRes.body !== undefined) {
            res.setHeader('Content-Type', 'application/json')
            res.end(JSON.stringify(apiRes.body))
          } else {
            res.end()
          }
        })
        .catch((err: unknown) => {
          res.statusCode = 500
          res.setHeader('Content-Type', 'application/json')
          res.end(
            JSON.stringify({
              error: 'Database error',
              details: [err instanceof Error ? err.message : String(err)],
            }),
          )
        })
    })
  }

  return {
    name: 'leaveit-openapi-middleware',
    configureServer(server) {
      server.middlewares.use(middleware)
    },
    configurePreviewServer(server) {
      server.middlewares.use(middleware)
    },
  }
}

export default defineConfig({
  plugins: [react(), leaveItApiPlugin()],
  test: {
    include: ['src/**/*.test.{ts,tsx}'],
    environment: 'node',
  },
})
