import { montaPagina } from "./common.js?v=202610110916";
montaPagina(location.pathname.split("/").pop() || "index.html");
