# Sendly

Sendly is a Shopify embedded app that sends WhatsApp notifications and marketing
messages to customers — order updates, abandoned cart recovery, and campaign /
discount messaging — via the WhatsApp Business (Meta Graph) API.

## Tech stack

- **Framework:** [React Router v7](https://reactrouter.com/) (SSR, file-based routes)
- **Shopify integration:** `@shopify/shopify-app-react-router` for auth/embedding,
  Polaris + App Bridge for the admin UI
- **Database:** PostgreSQL via [Prisma](https://www.prisma.io/)
- **Background jobs:** [BullMQ](https://docs.bullmq.io/) + Redis (`ioredis`) for
  delayed messages, retries, and abandoned-cart reminder sequences
- **Storefront extension:** `extensions/chat-button` — a Shopify theme app
  extension (Liquid block) for an on-site WhatsApp chat button
- **Deployment:** Docker (Node 20 Alpine)

## Domain model

Defined in `prisma/schema.prisma`:

| Model | Purpose |
| --- | --- |
| `Store` | One per shop — trial/billing state, WhatsApp credentials (encrypted token, phone ID) |
| `Service` / `StoreService` | Catalog of toggleable messaging services per store (order confirmation, abandoned cart, etc.) |
| `Template` | WhatsApp message templates, synced with Meta's template approval flow |
| `MessageLog` | Outbound/inbound message audit trail |
| `RetryQueue` | Failed-message retry tracking |
| `Campaign` / `CampaignOrder` | UTM-style marketing campaigns with order attribution/revenue |
| `AbandonedCheckout` / `AbandonedReminder` | Abandoned cart lifecycle with scheduled multi-step reminders |
| `Session` / `WebhookEvent` | Shopify auth session storage + webhook dedup |

## App structure

```
app/
  routes/     File-based routes: embedded admin UI (app.*), Shopify webhooks
              (webhooks.*), WhatsApp callback + media upload (api.*), OAuth (auth.*)
  services/   Business logic — messaging, orders, abandoned carts, campaigns,
              templates, billing/plans, analytics, settings
  queues/     BullMQ queue + Redis connection definitions
  workers/    BullMQ workers that consume the queues
  utils/      Billing, encryption, phone/template helpers
extensions/
  chat-button/  Theme app extension for the storefront WhatsApp button
prisma/         Schema, migrations, seed script
```

### Background processing

Four BullMQ queues run over Redis: `abandoned-cart`, `abandoned-sync`,
`order-message`, `no-response`. Workers in `app/workers/*.server.js` consume
these to send delayed order messages, run no-response follow-ups, and process
abandoned-cart reminder sequences.

### Billing

Trial-based SaaS billing (`app/utils/billing.server.js`): a 7-day trial, then
a paid "Sendly Pro" plan gates message sending via Shopify billing
subscriptions.

## Environment variables

| Variable | Used for |
| --- | --- |
| `DATABASE_URL` | Postgres connection string (Prisma) |
| `SHOPIFY_API_KEY` / `SHOPIFY_API_SECRET` | Shopify app credentials |
| `SCOPES` | Shopify OAuth scopes |
| `SHOPIFY_APP_URL` | App's public URL |
| `SHOP_CUSTOM_DOMAIN` | Optional custom shop domain override |
| `SHOPIFY_API_VERSION` | Admin API version used for REST/sync calls |
| `REDIS_HOST` / `REDIS_PORT` / `REDIS_PASSWORD` | Redis connection for BullMQ |
| `ENCRYPTION_KEY` | Encrypts/decrypts stored WhatsApp API tokens |
| `WHATSAPP_VERIFY_TOKEN` | Verifies WhatsApp webhook callback requests |
| `NODE_ENV` | Standard Node environment flag |

## Local development

Prerequisite: [Shopify CLI](https://shopify.dev/docs/apps/tools/cli/getting-started).

```shell
npm install
shopify app dev
```

Press `P` to open the app URL and install it on a dev store. Local dev is
powered by the Shopify CLI, which handles login, env vars, and tunneling.

## Scripts

| Script | Purpose |
| --- | --- |
| `npm run dev` | Start local dev via Shopify CLI |
| `npm run build` | Production build (`react-router build`) |
| `npm run start` | Serve the production build |
| `npm run setup` | `prisma generate` + `prisma migrate deploy` |
| `npm run docker-start` | `setup` + `start` (used by the Docker image) |
| `npm run lint` | ESLint |
| `npm run typecheck` | React Router typegen + `tsc --noEmit` |
| `npm run graphql-codegen` | Generate types for Shopify Admin GraphQL queries |

## Deployment

Built as a Docker image (`Dockerfile`): installs deps, runs `react-router
build`, then on container start runs Prisma migrations and serves the app
(`npm run docker-start`). Requires `NODE_ENV=production` and a reachable
Postgres + Redis instance.

## Webhooks

Subscriptions are declared in `shopify.app.toml` (app-specific webhooks, kept
in sync via `shopify app deploy`): order lifecycle (`orders/create|paid|cancelled`),
checkout lifecycle (`checkouts/create|update`) for abandoned cart tracking,
fulfillments, app lifecycle (`app/uninstalled`, `app/scopes_update`,
`app_subscriptions/update`), and GDPR privacy webhooks.
