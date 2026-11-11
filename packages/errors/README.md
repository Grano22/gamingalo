# @gamingalo/errors

Stable error codes and the `GamingaloError` type shared by the Gamingalo SDK,
backend, and CLI.

## Install

```sh
npm install @gamingalo/errors
```

## Use

```ts
import { GamingaloError, isGamingaloError } from '@gamingalo/errors';

try {
  await operation();
} catch (error) {
  if (isGamingaloError(error) && error.code === 'RATE_LIMITED' && error.retryable) {
    retryLater();
  } else {
    throw error;
  }
}
```

Check `code` and `retryable`, not the error message. Error codes are stable
public API.
