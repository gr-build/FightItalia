import { montaPagina } from "./common.js?v=202610100815";
montaPagina(location.pathname.split("/").pop() || "index.html");
