import { montaPagina } from "./common.js?v=202610121145";
montaPagina(location.pathname.split("/").pop() || "index.html");
