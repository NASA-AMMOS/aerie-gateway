FROM artifactory.jpl.nasa.gov:17001/node:14-alpine
COPY . /app
WORKDIR /app
CMD [ "npm", "run", "start" ]
