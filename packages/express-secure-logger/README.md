# express-secure-logger

Structured, privacy-aware logging for Express + TypeScript, built on [Pino](https://getpino.io).
One request-logging middleware, one error handler, one security-event helper, and a hardened redaction layer.

```
npm i express-secure-logger          # peers: express ^4.17 || ^5; optional: pino-pretty (dev only)
```

## Quick start

```ts
import express from 'express';
import {
  loadLoggerConfig, createLogger, createRequestLogger, createErrorHandler,
  createSecurityLogger, installProcessHandlers,
} from 'express-secure-logger';

const config = loadLoggerConfig();                 // validates env, throws LoggerConfigError on bad values
const logger = createLogger(config);
const security = createSecurityLogger(logger, { ipMode: config.ipMode });

const app = express();
app.set('trust proxy', 1);                         // see "Trusted proxies"

app.use(createRequestLogger({ logger, config }));  // 1) FIRST: before body parsers, rate limiters, auth
app.use(express.json());
// ...rate limiters, auth, routers...
app.use(createErrorHandler({ logger, security })); // 2) LAST: after all routes

const server = app.listen(3000);
installProcessHandlers(logger, { server, onShutdown: async () => { /* close DB pools */ } });
```

### Middleware ordering
1. `app.set('trust proxy', ...)` before anything reads `req.ip`.
2. **Request logger first**, so every request (including ones rejected by rate limiting, auth or body parsing) gets an ID, a child logger and exactly one completion log.
3. Body parsers, rate limiters, auth, validators, routers.
4. **Error handler last.**

### Using the logger
```ts
req.log.info({ orderId }, 'order created');           // child logger, already carries requestId
import { getLogger } from 'express-secure-logger';
getLogger(rootLogger).debug('in a service');          // request-scoped via AsyncLocalStorage
logger.error({ err }, 'job failed');                  // `err` is serialized safely (stack kept server-side)

security.signIn(req, 'success', { userId: user.uid });
security.invalidCredentials(req, { reason: 'bad_password' });
security.validationFailed(req, ['email', 'password']);   // field NAMES only
limiter = rateLimit({ handler: rateLimitHandler(security) });
```
**Untrusted objects:** pino redaction covers common key paths only. For arbitrary payloads use `logger.info({ payload: redactDeep(payload) }, '...')`.

### Integrating with an existing error handler / `asyncHandler`
You don't have to replace your handler. Call `logError(req, err)` inside it (or in a controller): the same `Error` instance is only ever logged once, so `asyncHandler` → controller → global handler can all call it safely. Use `classify` to map your own error classes:
```ts
createErrorHandler({ classify: (e) => e instanceof AppError ? { status: e.status, code: e.code, publicMessage: e.publicMessage } : undefined })
```
Responses are always `{ error: { code, message, requestId } }`. 5xx messages are generic; <500 messages are only echoed when `err.expose === true` or `publicMessage` is set.
Note: like Express itself, a numeric `statusCode`/`status` on any thrown error is honoured. Use `classify` if a library error (e.g. an axios upstream 404) should not become your response status.

## Configuration (environment)
| Variable | Default | Notes |
|---|---|---|
| `NODE_ENV` | `development` | `production` => JSON logs; `test` => silent |
| `APP_NAME` | `app` | `service` field |
| `SERVICE_VERSION` | – | `version` field |
| `LOG_LEVEL` | `info` (prod) / `debug` / `silent` (test) | `trace…fatal`, `silent` |
| `LOG_PRETTY` | `true` in development | needs `pino-pretty`; falls back to JSON with a warning |
| `LOG_IP_MODE` | `full` | `full` \| `anonymized` (/24, /48) \| `none` |
| `LOG_TRUST_REQUEST_ID` | `true` | accept inbound `x-request-id` if `^[A-Za-z0-9._:-]{8,64}$`, else generate UUID |
| `LOG_QUIET_PATHS` | `/health,/healthz,/livez,/readyz,/ready,/metrics` | successes logged at `trace`; **failures still log normally** |
| `LOG_IGNORE_PATHS` | – | never logged |
| `LOG_QUERY_ALLOWLIST` | – | only these query params are logged (sanitized). Default: no query data |
| `LOG_GEO_ENABLED` | `false` | requires passing `geoProvider` in code |
| `LOG_GEO_CACHE_SIZE` / `LOG_GEO_TTL_SECONDS` / `LOG_GEO_TIMEOUT_MS` | `5000` / `86400` / `50` | |

`loadLoggerConfig(env)` accepts any env-like object, so you can feed it the output of your existing zod/envalid parser. Errors list variable names, never values.

## Trusted proxies (important)
The logger records `req.ip` only and never reads `X-Forwarded-For` itself. What `req.ip` means depends on `trust proxy`:

| Deployment | Setting |
|---|---|
| Directly exposed Node | `false` (default) |
| One reverse proxy / load balancer (nginx, ALB, Cloud Run, Heroku, Render, Fly) | `1` |
| CDN + load balancer | `2` (count the hops you operate) |
| Known proxy addresses | `'loopback, 10.0.0.0/8'` or a function |

Never use `true` on an internet-facing app: clients could spoof their IP. If `X-Forwarded-For` arrives while `trust proxy` is off, a one-time `config_warning` is logged. Invalid IP strings are discarded and the socket address is used. IPv4, IPv6 and IPv4-mapped IPv6 are supported.

## Log fields
`http_request` (one per request): `time, level, service, env, version, pid, hostname, requestId, event, method, route, statusCode, outcome, durationMs, ip, userAgent, requestContentLength, responseContentLength, userId, query?, body?, geo?, securityEvents?`.
- `route` is the **pattern** (`/users/:id`), or `(unmatched)`. Raw URLs/IDs are never logged. For routers mounted at parameterised paths the base may include concrete values; mount routers at static prefixes.
- `outcome`: `success | client_error | server_error | timeout | aborted | response_error`. Timeout = status 408/504 or `res.locals.requestTimedOut = true` (best effort; Node cannot detect all timeouts). `aborted` has `statusCode: null` if nothing was sent.
- Levels: 2xx/3xx `info` (quiet paths `trace`), 4xx/timeout/abort `warn`, 5xx `error`.
- `request_error`: `requestId, route, statusCode, expected, err{type,message,code?,stack?,cause?}`. Stack only for unexpected (5xx) errors.
- `security`: `securityEvent, outcome, requestId, method, route, userId, ip, reason, details`; the request log lists them in `securityEvents` for correlation.
- `geo`: `{country, countryCode, region, city, approximate: true}`. **Approximate** only; coordinates are never recorded.

## Security & privacy
- **Never logged:** Authorization/Cookie/Set-Cookie headers, tokens, passwords, OTPs, API keys, env vars, raw query strings, request bodies. Headers aren't logged at all; `safeHeaders()` is an allowlist helper if you add them.
- Redaction layers: pino path redaction → key-based recursive `redactDeep` (over-inclusive: `pass|secret|token|cookie|session|jwt|otp|card…`) → value scrubbing (JWTs, `Bearer …`, `token=…`, URL credentials) in every untrusted string, including error messages.
- **Log injection:** control chars/ANSI escaped, strings truncated, errors serialized by whitelist (only name/message/code/status/frames/cause, so libraries' attached `request`/`config` objects can't leak), stacks reduced to frame lines.
- **Bodies:** opt-in per route and allowlisted: `createRequestLogger({ logBody: { 'POST /orders': ['item', 'qty'] } })`.
- **IP and location are personal data** (GDPR/UK GDPR/CCPA/DPDP). Recommendations: use `LOG_IP_MODE=anonymized` unless you need full IPs; document a lawful basis; restrict log access; set retention (e.g. 30 days for request logs, longer only for security events if justified) in your log platform; honour deletion requests where feasible. Geolocation is off by default and uses only the in-memory cache (bounded, TTL).
- Geolocation never runs on the request path: it happens after the response is sent, with a timeout, an LRU cache, in-flight de-duplication, a concurrency cap and a circuit breaker. Private/reserved IPs are never looked up.

### Geolocation provider (local DB, no external calls)
```ts
// npm i @maxmind/geoip2-node   (+ a GeoLite2-City.mmdb you license/download)  -- example, adapt to your setup
import { Reader } from '@maxmind/geoip2-node';
const reader = await Reader.open('/data/GeoLite2-City.mmdb');
app.use(createRequestLogger({ logger, config, geoProvider: (ip) => {
  const r = reader.city(ip);
  return { country: r.country?.names.en, countryCode: r.country?.isoCode, region: r.subdivisions?.[0]?.names.en, city: r.city?.names.en };
}}));   // with LOG_GEO_ENABLED=true
```
Don't trust CDN geo headers (e.g. `cf-ipcountry`) unless the app is only reachable through that CDN.

## Reliability & deployment
- Production output is JSON to stdout through an **async** SonicBoom destination with a bounded (8 MB) buffer: no synchronous writes in request handlers; if stdout stalls, logs are dropped rather than growing memory. Ship stdout with your platform (Docker/K8s/CloudWatch/Datadog); don't write files from the app.
- Destination errors (e.g. EPIPE) are swallowed so logging can't crash the process; logging calls inside the middleware/handlers are wrapped in try/catch.
- `installProcessHandlers` logs `fatal` on `uncaughtException`/`unhandledRejection`, flushes, and exits 1; on `SIGTERM`/`SIGINT` it stops the server, runs `onShutdown`, flushes and exits 0 (forced exit after `timeoutMs`, default 10 s). Set your orchestrator's grace period above that.
- Use `debug`/`trace` for diagnostics; keep `info` for events (request completion, state changes), not per-call chatter.

## Known limitations
- Direct `logger.info({ anything })` calls are only protected by path-based redaction; wrap untrusted data in `redactDeep`. A throwing getter on an object passed *directly* to pino can still throw inside pino.
- Route labels are captured at response finish; for errors that unwind through a nested router the mount prefix may be missing.
- Timeout detection is heuristic (status/flag). Pair with your own timeout middleware setting `res.locals.requestTimedOut`.
- The geolocation adapter example above was not run in CI; the resolver itself is fully tested.
