import { appPlugin } from "../../../lib/app-plugin.ts";

export const globalErrorHandlerPlugin = appPlugin({
  name: "global-error-handler",
  encapsulate: false,
  configure(fastify) {
    fastify.setErrorHandler((err, request, reply) => {
      fastify.log.error(
        {
          err,
          request: {
            method: request.method,
            url: request.url,
            query: request.query,
            params: request.params,
          },
        },
        "Unhandled error occurred"
      );

      reply.code(err.statusCode ?? 500);

      let message = "Internal Server Error";
      if (err.statusCode && err.statusCode < 500) {
        message = err.message;
      }

      return { message };
    });

    // An attacker could search for valid URLs if your 404 error handling is not rate limited.
    fastify.setNotFoundHandler(
      {
        preHandler: fastify.rateLimit({
          max: 3,
          timeWindow: 500,
        }),
      },
      (request, reply) => {
        request.log.warn(
          {
            request: {
              method: request.method,
              url: request.url,
              query: request.query,
              params: request.params,
            },
          },
          "Resource not found"
        );

        reply.code(404);

        return { message: "Not Found" };
      }
    );
  },
});
