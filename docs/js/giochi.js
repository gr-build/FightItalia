import { renderChrome, traccia, SOCIAL, EMAIL, EMAIL_ATTIVA } from "./common.js?v=202609292332";

renderChrome("giochi");

// Feedback: un tocco sul gioco preferito. Non raccoglie nulla di personale:
// arriva a Plausible come evento "Gioco preferito" con il nome del gioco.
const GIOCHI = ["Griglia MMA", "Chi è?", "Più o meno", "MMA Gauntlet", "Cognomle"];
const box = document.getElementById("feedback-scelte");
const grazie = document.getElementById("feedback-grazie");
let votato = null;
try { votato = localStorage.getItem("gioco-preferito"); } catch (e) { /* senza memoria locale va bene lo stesso */ }

function disegna() {
  box.innerHTML = GIOCHI.map((g) => `<button type="button" class="feedback-btn${g === votato ? " scelto" : ""}" data-gioco="${g}">${g}</button>`).join("");
  grazie.textContent = votato ? `Grazie! Hai scelto ${votato}.` : "";
}

box.addEventListener("click", (e) => {
  const b = e.target.closest("button[data-gioco]");
  if (!b) return;
  const eraGia = votato === b.dataset.gioco;
  votato = b.dataset.gioco;
  try { localStorage.setItem("gioco-preferito", votato); } catch (err) { /* ignora */ }
  if (!eraGia) traccia("Gioco preferito", { gioco: votato });
  disegna();
});

for (const [id, chiave] of [["fb-ig", "instagram"], ["fb-tt", "tiktok"]]) {
  const s = SOCIAL.find((x) => x.id === chiave);
  if (s) document.getElementById(id).href = s.url;
}
disegna();

// Modulo di contatto: compare solo quando la casella della redazione esiste
// davvero (EMAIL_ATTIVA in common.js). Il sito e' statico, quindi il messaggio
// parte verso l'email tramite FormSubmit; senza casella attiva resta l'invito
// ai DM, cosi' nessun messaggio si perde.
const form = document.getElementById("feedback-form");
if (EMAIL_ATTIVA && form) {
  form.hidden = false;
  document.getElementById("feedback-social").hidden = true;
  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    const esito = document.getElementById("fb-esito");
    const bottone = document.getElementById("fb-invia");
    if (document.getElementById("fb-honey").value) return; // e' un bot
    const messaggio = document.getElementById("fb-msg").value.trim();
    if (!messaggio) return;
    bottone.disabled = true;
    esito.textContent = "Invio in corso...";
    try {
      const risposta = await fetch(`https://formsubmit.co/ajax/${EMAIL}`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Accept: "application/json" },
        body: JSON.stringify({
          _subject: `MMA Oggi · ${document.getElementById("fb-tipo").value}`,
          _template: "table",
          messaggio,
          email: document.getElementById("fb-mail").value.trim() || "(non indicata)",
          pagina: location.href,
        }),
      });
      if (!risposta.ok) throw new Error(String(risposta.status));
      esito.textContent = "Grazie! Il messaggio è arrivato.";
      form.reset();
      traccia("Feedback inviato", { tipo: document.getElementById("fb-tipo").value });
    } catch (err) {
      esito.textContent = "Non sono riuscito a inviarlo. Riprova tra poco, oppure scrivici in DM su Instagram.";
    }
    bottone.disabled = false;
  });
}
