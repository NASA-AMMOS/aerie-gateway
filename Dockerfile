FROM node:lts-alpine
RUN apk add --no-cache curl

COPY . /app
WORKDIR /app

# define health check for container: /health route will return 200 if healthy
HEALTHCHECK --interval=2s --timeout=2s --start-period=2s --retries=15 \
  CMD /bin/sh -c 'curl -sf http://localhost:$PORT/health || exit 1'

CMD [ "npm", "start" ]
