import { renderChrome, traccia, montaFeedback } from "./common.js?v=202609292348";

renderChrome("giochi");

// Feedback: un tocco sul gioco preferito. Non raccoglie nulla di personale:
// arriva a Plausible come evento "Gioco preferito" con il nome del gioco.
const GIOCHI = ["Griglia MMA", "Chi è?", "Higher or Lower", "MMA Gauntlet", "Cognomle"];
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

montaFeedback(document.getElementById("feedback-modulo"));
disegna();
