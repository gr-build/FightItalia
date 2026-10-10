import { montaPagina } from "./common.js?v=202610101452";
montaPagina(location.pathname.split("/").pop() || "index.html");
