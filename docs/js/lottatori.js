import { fetchJSON, renderChrome } from "./common.js?v=202609271717";

renderChrome("lottatori");

fetchJSON("data/roster.json")
  .then((roster) => {
    document.getElementById("conta-lottatori").textContent = `${roster.length} lottatori`;
  })
  .catch(() => {});
