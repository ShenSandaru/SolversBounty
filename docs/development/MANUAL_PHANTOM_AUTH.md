# Manual Phantom Devnet authentication check

Use this after the API and web app are running. Automated tests mock the wallet. This procedure is the browser check.

## Setup

1. Install the Phantom browser extension and switch it to Devnet. Login does not send SOL. A Devnet balance is not required.
2. Copy the web environment template and set `NEXT_PUBLIC_API_URL=http://localhost:3001`.
3. Set the API `CORS_ORIGIN` to `http://localhost:3000`. Do not use `*`.
4. Start PostgreSQL with the initial migration applied, then start the API and the web app.
5. Open `http://localhost:3000`.

## Checks

1. Click **Connect wallet**. Approve Phantom. The header shows a shortened public key and **Disconnect**.
2. Click **Disconnect**. The public key disappears. If you were not signed in, no server session exists.
3. Connect again and click **Sign in**. Phantom shows the message returned by `POST /auth/nonce`, including "This signature does not approve a SOL transfer." Approve it. The header says signed in. The browser does not show the `sb_session` value to page JavaScript.
4. Refresh the page. The signed-in state returns from `GET /auth/session`.
5. Click **Disconnect** without logging out. The wallet disconnects. The header still says the server session is active.
6. Connect the same wallet again, or leave it disconnected, and click **Log out**. Refresh. The signed-in state is gone, and `GET /auth/session` returns 401.
7. Sign in again, then reject the Phantom signature prompt. The header shows that the signature request was rejected and no session is created.
8. Stop the API and click **Sign in**. The header says the API is unavailable.

Do not paste a seed phrase or private key into the app. Do not approve a SOL transfer. This screen does not request one.
