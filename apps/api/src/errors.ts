import { FastifyInstance } from 'fastify'

// One error format for the website: { error: "readable message" }.
export function registerErrorHandler(fastify: FastifyInstance) {
  fastify.setErrorHandler((err: any, request, reply) => {
    if (err?.name === 'ZodError' && Array.isArray(err.issues)) {
      const issue = err.issues[0]
      return reply.code(400).send({ error: issue?.message || 'Some of the details sent are not valid.', issues: err.issues })
    }
    const status = Number(err?.statusCode) >= 400 ? Number(err.statusCode) : 500
    if (status >= 500) {
      request.log.error(err)
      // Internal details stay in the log in production.
      const detail = process.env.NODE_ENV === 'production' ? '' : ` (${err?.message})`
      return reply.code(status).send({ error: `Something went wrong on our side. Please try again.${detail}` })
    }
    return reply.code(status).send({ error: err?.message || err?.error || 'Request failed' })
  })
}

/** Message for requests over a rate limit (@fastify/rate-limit errorResponseBuilder). */
export function rateLimitResponse(_req: unknown, context: { after: string }) {
  const message = `Too many requests. Please try again in ${context.after}.`
  return { statusCode: 429, error: message, message }
}
