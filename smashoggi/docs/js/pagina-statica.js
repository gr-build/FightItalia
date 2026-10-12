import { montaPagina } from "./common.js?v=202610120738";
montaPagina(location.pathname.split("/").pop() || "index.html");
