# aerie-gateway

## Develop

First make sure you have [Node.js LTS](https://nodejs.org) installed, then do:

```sh
cd aerie-gateway
npm install
npm run build
npm start
```

## Hasura

These commands use the [Hasura CLI](https://hasura.io/docs/latest/graphql/core/hasura-cli/index.html) to manage Hasura metadata. Before running any of these commands make sure you:

```
cd aerie-gateway
npm install
```

To apply metadata to Hasura from the [metadata directory](./hasura/metadata), you can run the following command:

```
npx hasura metadata apply --endpoint http://localhost:8080
```

To export metadata from Hasura to the [metadata directory](./hasura/metadata), you can run the following command:

```
npx hasura metadata export --endpoint http://localhost:8080
```

You can change the `endpoint` flag to point to different instances of Hasura as needed.
