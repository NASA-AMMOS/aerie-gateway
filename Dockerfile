FROM node:14-alpine
COPY . /app
WORKDIR /app
CMD [ "npm", "run", "start" ]
