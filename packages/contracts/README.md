# @gamingalo/contracts

Zod schemas and TypeScript types for Gamingalo API requests and responses.

## Install

```sh
npm install @gamingalo/contracts
```

## Use

```ts
import { errorResponseSchema, type ErrorResponse } from '@gamingalo/contracts';

const response: ErrorResponse = errorResponseSchema.parse(await res.json());
```

The package also includes the external `gamingalo.json` schema at
`@gamingalo/contracts/gamingalo.schema.json`.
