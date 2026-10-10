import { montaPagina } from "./common.js?v=202610101026";
montaPagina(location.pathname.split("/").pop() || "index.html");
