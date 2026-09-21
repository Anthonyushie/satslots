<img width="150" height="150" alt="favicon" src="https://github.com/user-attachments/assets/50c7de83-6a3f-42d2-a4bc-a24fa4c3c5a5" />

# SatSlots

**Your space. Your terms. Your sats.**

A Bitcoin-native sponsorship marketplace built with **Next.js 16 App Router, React 19, TypeScript, Tailwind CSS 4, and MongoDB**. Publishers list ad slots, advertisers book them, and payments flow via Lightning Network through Polar (regtest) for local development.

## Quick start

Requires Node.js **20.19 or newer**.

```sh
npm ci
cp .env.example .env   # fill in MongoDB URI and Polar LND config
npm run dev
```

Open http://localhost:3000.

## Database

**MongoDB Atlas** (or local MongoDB). All schemas live in `src/lib/mongodb/schemas.ts` as Mongoose models. No migrations needed — Mongoose creates collections on first write.

| Collection         | Purpose                              |
| ------------------ | ------------------------------------ |
| `profiles`         | User identity (pubkey, username, bio, lightning address) |
| `listings`         | Ad slots (price, duration, capacity) |
| `bookings`         | Reservations (status, dates)         |
| `payments`         | Lightning invoices and settlement    |
| `sessions`         | Auth session tokens                  |
| `authchallenges`   | NIP-42 nonces                        |
| `campaigns`        | Ad campaigns                         |
| `reviews`          | Booking reviews                      |
| `listingcomments`  | Thread comments on listings          |

## Lightning payments (Polar / regtest)

Invoices are created via a local **Polar LND** node. No real Bitcoin is involved.

### Setup

1. Install [Polar](https://lightningpolar.com/) and create a new network with at least one LND node (e.g. "alice").

2. Start the network in Polar.

3. Get the admin macaroon (hex-encoded):
   ```sh
   # Replace NETWORK_ID and NODE_NAME with your Polar network
   xxd -p ~/.polar/networks/NETWORK_ID/volumes/lnd/NODE_NAME/data/chain/bitcoin/regtest/admin.macaroon | tr -d '\n'
   ```

4. Check the REST port mapping in Polar's docker-compose (usually `8080` internally, mapped to `8087` or similar externally).

5. Update `.env`:
   ```
   LIGHTNING_BACKEND=lnd
   LND_REST_URL=https://localhost:8087
   LND_MACAROON=<hex from step 3>
   ```

6. If your Polar network was freshly created, mine some blocks so LND can sync:
   ```sh
   docker exec polar-NETWORK_ID-backend1 bitcoin-cli -regtest -rpcuser=polaruser -rpcpassword=polarpass -generate 101
   ```

7. Restart the LND nodes after mining (LND needs to sync from genesis):
   ```sh
   docker restart polar-NETWORK_ID-NODE_NAME
   ```

### Funding a node and opening channels

To pay invoices, the payer node needs sats and a channel to the invoice node:

```sh
# Get an address from the payer node
docker exec -u lnd polar-NETWORK_ID-payer lncli --network=regtest --rpcserver=localhost:10009 newaddress p2wkh

# Send bitcoin from the mining wallet
docker exec polar-NETWORK_ID-backend1 bitcoin-cli -regtest -rpcuser=polaruser -rpcpassword=polarpass sendtoaddress <address> 5.0

# Mine to confirm
docker exec polar-NETWORK_ID-backend1 bitcoin-cli -regtest -rpcuser=polaruser -rpcpassword=polarpass -generate 1

# Connect to the invoice node and open a channel
docker exec -u lnd polar-NETWORK_ID-payer lncli --network=regtest --rpcserver=localhost:10009 connect <INVOICE_NODE_PUBKEY>@polar-NETWORK_ID-INVOICE_NODE:9735
docker exec -u lnd polar-NETWORK_ID-payer lncli --network=regtest --rpcserver=localhost:10009 openchannel --node_key=<INVOICE_NODE_PUBKEY> --local_amt=10000000

# Mine to confirm the channel
docker exec polar-NETWORK_ID-backend1 bitcoin-cli -regtest -rpcuser=polaruser -rpcpassword=polarpass -generate 3
```

## Authentication

Sign-in is **NIP-42 challenge/response**. No passwords, no email.

1. `POST /api/auth/challenge` issues a single-use nonce (SHA-256 hashed, 5-min expiry).
2. The browser signs a kind-`22242` event with the user's NIP-07 extension.
3. `POST /api/auth/verify` verifies the signature and redeems the nonce.
4. A session token is issued as an `httpOnly` cookie; only its hash is stored.

## Project structure

```text
src/
  app/
    api/
      auth/         challenge, verify, session, logout, profile
      bookings/     CRUD + anonymous + status updates
      payments/     create invoice, status poll, webhook
      listings/     CRUD + event publishing + comments
    dashboard/      User dashboard (server component)
    listings/       Listing detail page
    login/          Login page
    page.tsx        Landing page
  lib/
    mongodb/        Mongoose client, schemas, queries
    lightning/      Invoice creation (LND, NWC, Lightning Address)
    nostr/          Nostr client, identity, listing events, discovery
    auth/           NIP-42 challenge/response, sessions
    api/            Route handler helpers, Zod schemas
  components/
    interactive/    Client-side React components
scripts/
  nwc-listener.mjs  Standalone NWC payment confirmation listener
  seed-mongodb.mjs  Seed test data into MongoDB
  test-api.mjs      API integration tests
  test-auth.mjs     Auth flow tests
```

## Production

```sh
npm run build
npm run start
```

This app is **not** a static export. It requires a Node-capable runtime because the MongoDB URI and LND macaroon must stay server-side.

## Typography

DM Sans, Instrument Serif, and IBM Plex Mono are bundled under the SIL Open Font License 1.1. Copyright and license notices are in `src/app/fonts/LICENSE.txt`.

## License

SatSlots is a concept for BOSS Battle 2026. Not an official or endorsed Bitshala product.
