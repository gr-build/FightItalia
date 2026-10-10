import { fetchJSON, renderChrome } from "./common.js?v=202610100402";

renderChrome("lottatori");

fetchJSON("data/roster.json")
  .then((roster) => {
    document.getElementById("conta-lottatori").textContent = `${roster.length} lottatori`;
  })
  .catch(() => {});
