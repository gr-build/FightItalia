import { montaPagina } from "./common.js?v=202610100823";
montaPagina(location.pathname.split("/").pop() || "index.html");
