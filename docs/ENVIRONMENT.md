# Environment

This document provides detailed information about environment variables for the gateway.

| Name                        | Description                                                                                          | Type     | Default                                        |
| --------------------------- | ---------------------------------------------------------------------------------------------------- | -------- | ---------------------------------------------- |
| `ALLOWED_ROLES`             | Allowed roles when authentication is enabled.                                                        | `array`  | ["user", "viewer"]                             |
| `ALLOWED_ROLES_NO_AUTH`     | Allowed roles when authentication is disabled.                                                       | `array`  | ["aerie_admin", "user", "viewer"]              |
| `AUTH_TYPE`                 | Mode of authentication. Set to `cam` to enable CAM authentication.                                   | `string` | none                                           |
| `AUTH_URL`                  | URL of Auth provider's REST API. Used if the given `AUTH_TYPE` is not set to `none`.                 | `string` | https://atb-ocio-12b.jpl.nasa.gov:8443/cam-api |
| `AUTH_UI_URL`               | URL of Auth provider's login UI. Returned to the UI if SSO token is invalid, so user is redirected   | `string` | https://atb-ocio-12b.jpl.nasa.gov:8443/cam-ui  |
| `AUTH_SSO_TOKEN_NAME`       | The name of the SSO tokens the Gateway should parse cookies for. Likely found in auth provider docs. | `array`  | ["iPlanetDirectoryPro"]                        |
| `DEFAULT_ROLE`              | Default role when authentication is enabled.                                                         | `array`  | user                                           |
| `DEFAULT_ROLE_NO_AUTH`      | Default role when authentication is disabled.                                                        | `array`  | aerie_admin                                    |
| `GQL_API_URL`               | URL of GraphQL API for the GraphQL Playground.                                                       | `string` | http://localhost:8080/v1/graphql               |
| `GQL_API_WS_URL`            | URL of GraphQL WebSocket API for the GraphQL Playground.                                             | `string` | ws://localhost:8080/v1/graphql                 |
| `HASURA_GRAPHQL_JWT_SECRET` | The JWT secret. Also in Hasura. **Required** even if auth off in Hasura.                             | `string` |                                                |
| `JWT_ALGORITHMS`            | List of [JWT signing algorithms][algorithms]. Must include algorithm in `HASURA_GRAPHQL_JWT_SECRET`. | `array`  | ["HS256"]                                      |
| `JWT_EXPIRATION`            | Amount of time until JWT expires.                                                                    | `string` | 36h                                            |
| `LOG_FILE`                  | Either an output filepath to log to, or 'console'.                                                   | `string` | console                                        |
| `LOG_LEVEL`                 | Logging level for filtering logs.                                                                    | `string` | warn                                           |
| `PORT`                      | Port the Gateway server listens on.                                                                  | `number` | 9000                                           |
| `POSTGRES_AERIE_MERLIN_DB`  | Name of Merlin Postgres database.                                                                    | `string` | aerie_merlin                                   |
| `POSTGRES_HOST`             | Hostname of Postgres instance.                                                                       | `string` | localhost                                      |
| `POSTGRES_PASSWORD`         | Password of Postgres instance.                                                                       | `string` |                                                |
| `POSTGRES_PORT`             | Port of Postgres instance.                                                                           | `number` | 5432                                           |
| `POSTGRES_USER`             | User of Postgres instance.                                                                           | `string` |                                                |
| `RATE_LIMITER_FILES_MAX`    | Max requests allowed every 15 minutes to file endpoints                                              | `number` | 1000                                           |
| `RATE_LIMITER_LOGIN_MAX`    | Max requests allowed every 15 minutes to login endpoints                                             | `number` | 1000                                           |

[algorithms]: https://github.com/auth0/node-jsonwebtoken#algorithms-supported
