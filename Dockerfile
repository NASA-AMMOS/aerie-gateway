FROM artifactory.jpl.nasa.gov:17001/node:lts-alpine
COPY . /app
WORKDIR /app
CMD [ "npm", "start" ]
