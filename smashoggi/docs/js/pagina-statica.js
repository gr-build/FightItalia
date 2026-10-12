import { montaPagina } from "./common.js?v=202610120823";
montaPagina(location.pathname.split("/").pop() || "index.html");
