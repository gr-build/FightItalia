# Canale Telegram di Smash Oggi

Pubblica in automatico: **Oggi in campo** (ogni mattina) e i **risultati degli italiani** appena finiti. Mai quote né pronostici.

## Cosa fai tu (circa 10 minuti, tutto dal telefono va bene)
1. **Telegram → Nuovo canale** → pubblico, nome "Smash Oggi", indirizzo es. `@smashoggi`.
2. Scrivi a **@BotFather** → `/newbot` → scegli nome e username (finisce in `bot`). Ti dà un **token**: non incollarlo in chat né nei file.
3. Nel canale: **Amministratori → Aggiungi** il bot, con permesso di pubblicare.
4. **Cloudflare → Workers & Pages → Create → Worker** → nome `smashoggi-telegram` → Deploy → **Edit code** → incolla il contenuto di `worker.js` → Deploy.
5. Worker → **Settings → Variables and Secrets** → aggiungi come *Secret*: `TELEGRAM_TOKEN` (il token) e `TELEGRAM_CANALE` (es. `@smashoggi`).
6. Worker → **Settings → Triggers → Cron Triggers** → aggiungi `0 6 * * *` e `*/15 7-21 * * *`.
7. (Consigliato) **Storage & Databases → KV → Create** `smashoggi-stato`; nel Worker → Settings → Bindings → KV namespace, variabile `STATO`. Senza KV i risultati non vengono pubblicati (per evitare doppioni); il messaggio del mattino sì.

Con la CLI: `npx wrangler deploy` da questa cartella, poi `npx wrangler secret put TELEGRAM_TOKEN`.

## Note
- Il messaggio del mattino parte alle 06:00 UTC (08:00 estate, 07:00 inverno in Italia).
- Non testato su Telegram reale: serve il tuo canale e il tuo token.
- Link alle pagine: cambiare `SITO` in `worker.js` quando c'è il dominio definitivo.
