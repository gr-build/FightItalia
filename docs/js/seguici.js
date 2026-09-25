import { renderChrome, SOCIAL, EMAIL, EMAIL_ATTIVA } from "./common.js?v=202609251300";

renderChrome("");

document.getElementById("seguici").innerHTML = SOCIAL.map((x) => `
  <a class="seguici-card ${x.id}" href="${x.url}" target="_blank" rel="noopener">
    <span class="gioco-tag">${x.nome}</span>
    <h2>${x.testo}</h2>
    <p>${x.desc}</p>
    <span class="gioco-cta">${x.id === "whatsapp" ? "Iscriviti al canale →" : "Segui →"}</span>
  </a>`).join("");

document.getElementById("contatti-email").innerHTML = EMAIL_ATTIVA
  ? `Email: <a href="mailto:${EMAIL}">${EMAIL}</a>`
  : `Per ora scrivici in privato su <a href="${SOCIAL[1].url}" target="_blank" rel="noopener">Instagram</a>: l'indirizzo email è in arrivo.`;
