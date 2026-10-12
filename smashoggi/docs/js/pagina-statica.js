import { montaPagina } from "./common.js?v=202610120732";
montaPagina(location.pathname.split("/").pop() || "index.html");
