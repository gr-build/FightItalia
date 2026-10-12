import { montaPagina } from "./common.js?v=202610121200";
montaPagina(location.pathname.split("/").pop() || "index.html");
