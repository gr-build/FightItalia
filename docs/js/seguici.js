import { renderChrome, SOCIAL } from "./common.js?v=202609250714";

renderChrome("");

document.getElementById("seguici").innerHTML = SOCIAL.map((x) => `
  <a class="seguici-card ${x.id}" href="${x.url}" target="_blank" rel="noopener">
    <span class="gioco-tag">${x.nome}</span>
    <h2>${x.testo}</h2>
    <p>${x.desc}</p>
    <span class="gioco-cta">${x.id === "whatsapp" ? "Iscriviti al canale →" : "Segui →"}</span>
  </a>`).join("");
