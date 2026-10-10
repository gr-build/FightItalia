import { montaPagina } from "./common.js?v=202610101019";
montaPagina(location.pathname.split("/").pop() || "index.html");
