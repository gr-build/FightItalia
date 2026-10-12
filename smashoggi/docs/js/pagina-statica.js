import { montaPagina } from "./common.js?v=202610121154";
montaPagina(location.pathname.split("/").pop() || "index.html");
