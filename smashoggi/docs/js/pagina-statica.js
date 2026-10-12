import { montaPagina } from "./common.js?v=202610120726";
montaPagina(location.pathname.split("/").pop() || "index.html");
