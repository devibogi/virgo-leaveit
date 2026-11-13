/// <reference types="vitest/config" />
import { defineConfig, type Connect, type Plugin } from 'vite'
import react from '@vitejs/plugin-react'
import { createAuthApiHandler } from './src/server/authApi.ts'
import { createEmployeeApiHandler } from './src/server/employeeApi.ts'
import { InMemoryEmployeeRepository } from './src/server/employeeRepository.ts'
import { createLeaveEntitlementApiHandler } from './src/server/leaveEntitlementApi.ts'
import { createLeaveRequestApiHandler } from './src/server/leaveRequestApi.ts'
import { createTeamApiHandler } from './src/server/teamApi.ts'

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

function leaveItApiPlugin(): Plugin {
  const sharedEmployeeRepo = new InMemoryEmployeeRepository()
  const handleAuthApiRequest = createAuthApiHandler(sharedEmployeeRepo)
  const handleTeamApiRequest = createTeamApiHandler()
  const handleEmployeeApiRequest = createEmployeeApiHandler(sharedEmployeeRepo)
  const handleEntitlementApiRequest = createLeaveEntitlementApiHandler(
    undefined,
    sharedEmployeeRepo,
  )
  const handleLeaveRequestApiRequest = createLeaveRequestApiHandler(
    undefined,
    sharedEmployeeRepo,
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

      const apiReq = {
        method: req.method ?? 'GET',
        url,
        headers: req.headers,
        body: parsedBody,
      }

      void Promise.all([
        handleAuthApiRequest(apiReq),
        handleTeamApiRequest(apiReq),
        handleEmployeeApiRequest(apiReq),
        handleEntitlementApiRequest(apiReq),
        handleLeaveRequestApiRequest(apiReq),
      ]).then(([authRes, teamRes, empRes, entRes, reqRes]) => {
        const apiRes = authRes ?? teamRes ?? empRes ?? entRes ?? reqRes
        if (!apiRes) {
          next()
          return
        }
        res.statusCode = apiRes.status
        if (apiRes.body !== undefined) {
          res.setHeader('Content-Type', 'application/json')
          res.end(JSON.stringify(apiRes.body))
        } else {
          res.end()
        }
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
