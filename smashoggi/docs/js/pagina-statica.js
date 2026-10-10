import { montaPagina } from "./common.js?v=202610101023";
montaPagina(location.pathname.split("/").pop() || "index.html");
