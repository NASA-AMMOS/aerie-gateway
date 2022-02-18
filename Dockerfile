FROM node:lts-alpine
COPY . /app
WORKDIR /app
ENV NODE_TLS_REJECT_UNAUTHORIZED "0"
CMD [ "npm", "start" ]
