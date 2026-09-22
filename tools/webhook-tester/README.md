# FlowForge Webhook Tester

A single-file, dependency-free web tool for firing HTTP events at your FlowForge
workflow ingestion endpoints — to verify a workflow works end to end, exercise its
auth (Bearer / HMAC), and load-test the queue + worker path.

Everything runs in your browser; nothing is uploaded anywhere.

## Usage

1. Start the stack (`npm run dev` from the repo root) so the API is on `http://localhost:3000`.
2. Open `tools/webhook-tester/index.html` — double-click it, or serve the folder:
   ```bash
   npx serve tools/webhook-tester      # then open the printed http://localhost:xxxx
   ```
3. In the FlowForge editor, open a workflow's **Webhook URL** tab and copy its URL
   (`http://localhost:3000/api/v1/wh/<workflowId>`). The workflow must be **active**.
4. Paste it into **Target URL**, pick a payload preset, and **Send one request**.
   Use **Run burst** for concurrent load with latency stats (avg / p95 / req/sec).

## Auth

- **Bearer** — set the token to match the trigger node's *Expected Bearer Token*.
- **HMAC SHA-256** — set the header name (e.g. `x-signature`) and signing secret to
  match the trigger. Keep **Compact JSON** on: the signature is computed over the exact
  bytes sent, and the current server re-serializes the parsed body before hashing, so a
  compact body is what makes the two digests match.

## Note on CORS

Browsers can only call the API if it returns permissive CORS headers. `apps/api` now
allows any `localhost` / `127.0.0.1` origin (and `file://` pages) so this tool works,
while still refusing off-machine origins. A published (https) web page cannot reach
`http://localhost` at all (mixed content) — which is why this tool ships as a local file.
