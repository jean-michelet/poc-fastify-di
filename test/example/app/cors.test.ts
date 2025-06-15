import { it, type TestContext } from 'node:test'
import { createTestApp } from '../../../example/test-app.ts'

it('should correctly handle CORS preflight requests', async (t: TestContext) => {
  const app = await createTestApp(t)

  const res = await app.inject({
    method: 'OPTIONS',
    url: '/',
    headers: {
      Origin: 'http://example.com',
      'Access-Control-Request-Method': 'GET',
      'Access-Control-Request-Headers': 'Content-Type'
    }
  })

  t.assert.strictEqual(res.statusCode, 204)
  t.assert.strictEqual(res.headers['access-control-allow-methods'], 'GET, POST, PUT, DELETE')
})
