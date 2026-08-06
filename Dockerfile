FROM node:24.19.0-alpine
RUN apk add --no-cache curl

COPY --chown=node:node . /app
WORKDIR /app

# define health check for container: /health route will return 200 if healthy
HEALTHCHECK --interval=2s --timeout=2s --start-period=2s --retries=15 \
  CMD /bin/sh -c 'curl -sf http://localhost:$PORT/health || exit 1'

# npm is not required by the running service - remove to reduce vulnerable dependencies
RUN rm -rf /usr/local/lib/node_modules/npm \
    && rm -f /usr/local/bin/npm /usr/local/bin/npx

# run app as `node` user
USER node
CMD [ "node", "dist/main.js" ]
