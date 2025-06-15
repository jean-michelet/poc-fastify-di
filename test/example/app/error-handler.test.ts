import { it, type TestContext } from 'node:test'
import { createTestApp } from '../../../example/test-app.ts'

it('should call errorHandler', async (t: TestContext) => {
  const app = await createTestApp(t)

  const res = await app.inject({
    method: 'GET',
    url: '/error'
  })

  t.assert.deepStrictEqual(JSON.parse(res.payload), {
    message: 'Internal Server Error'
  })
})
