# Bot Telegram di Smash Oggi

Stesso schema del bot di GP Oggi: un Worker Cloudflare sempre sveglio che risponde ai comandi (webhook) e manda messaggi automatici. Mai quote né pronostici.

**Comandi** (rispondono solo alla tua chat): `/oggi`, `/live`, `/italiani`, `/risultati`, `/radar` (serve il sito online).
**Automatico:** ogni mattina "Oggi in campo" e, di giorno, il risultato di ogni italiano appena finito (serve il KV). Vanno alla tua chat e, se lo imposti, al canale.

## 1. Telegram
1. **@BotFather** → `/newbot` → nome "Smash Oggi", username che finisce con `bot` (es. `SmashOggiBot`). Ti dà il **token**: non incollarlo in chat né nei file.
2. Per sapere il tuo **CHAT_ID**: scrivi a **@userinfobot** (o `@RawDataBot`): ti risponde con il tuo id numerico. È lo stesso id degli altri tuoi bot.
3. Canale (facoltativo): Nuovo canale pubblico, es. `@smashoggi` → Amministratori → aggiungi il bot con permesso di pubblicare.

## 2. Cloudflare (dashboard)
1. Workers & Pages → Create → Worker, nome `smashoggi-bot` → Deploy → **Edit code** → incolla `worker.js` → Deploy.
2. Settings → Variables and Secrets:
   - *Secret*: `TELEGRAM_TOKEN` (il token), `WEBHOOK_SECRET` (una parola lunga a caso inventata da te).
   - *Testo*: `CHAT_ID` (il tuo id), `BOT_USERNAME` (es. `SmashOggiBot`), `CANALE` (facoltativo, es. `@smashoggi`).
3. Settings → Triggers → Cron: `0 6 * * *` e `*/15 7-21 * * *`.
4. KV (consigliato): Storage → KV → Create `smashoggi-stato` → nel Worker, Settings → Bindings → KV namespace, nome variabile `STATO`.

## 3. Accendere il bot
Apri nel browser, con la tua parola segreta al posto di PAROLA e l'indirizzo del tuo Worker:
- `https://INDIRIZZO-WORKER/stato?k=PAROLA` → controlla di che bot si tratta (non cambia niente)
- `https://INDIRIZZO-WORKER/attiva?k=PAROLA` → collega Telegram al Worker (si ferma se il token non è del bot atteso)

Poi scrivi `/start` al bot.

## Note
- Messaggio del mattino: 06:00 UTC = 08:00 estate, 07:00 inverno in Italia.
- `/radar` legge `notizie.json` dal sito: imposta `DATI_URL` (es. `https://tuodominio.it/data`) quando è online.
- I link nei messaggi puntano a `SITO` in `worker.js`: cambialo col dominio definitivo.
- Collegare workflow GitHub (come i video di GP Oggi): riempi `COMANDI` e aggiungi `GITHUB_TOKEN` e `REPO`. Ora è vuoto perché non esistono workflow.
- Non testato su Telegram reale (serve il tuo token): provato in locale con dati ESPN veri.
