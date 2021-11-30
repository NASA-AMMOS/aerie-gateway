ARG NODE_LTS_IMAGE
FROM ${NODE_LTS_IMAGE}
COPY . /app
WORKDIR /app
CMD [ "npm", "start" ]
