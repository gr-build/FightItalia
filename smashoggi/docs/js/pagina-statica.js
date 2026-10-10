import { montaPagina } from "./common.js?v=202610100950";
montaPagina(location.pathname.split("/").pop() || "index.html");
