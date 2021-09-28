# aerie-gateway

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
npm run hasura:metadata:apply # Develop
npm run hasura:metadata:apply:local # Local
```

To export metadata from Hasura use one of the following commands:

```sh
npm run hasura:metadata:export # Develop
npm run hasura:metadata:export:local # Local
```
