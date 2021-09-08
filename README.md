# aerie-gateway

## Features

1. Filesystem API
1. CAM API proxy for login and logout (for CAM servers without CORS)
1. UI View API (not currently public, but it probably should be)
1. Automatic Postgres database provisioning (see [sql](./sql))
1. Automatic Hasura provisioning (see [hasura](./hasura))
1. Full environment-based config to make deployment easy (see [.env](./.env))
1. Serves the GraphQL Playground for Hasura
1. Serves auto-generated REST API documentation
1. Automatic AWS deployment

## Develop

First make sure you have [Node.js LTS](https://nodejs.org) installed, then do:

```sh
npm install
npm run build
npm run start:local
```

## Hasura

To apply metadata to Hasura use one of the following commands:

```sh
npm run hasura:metadata # Develop
npm run hasura:metadata:local # Local
```
