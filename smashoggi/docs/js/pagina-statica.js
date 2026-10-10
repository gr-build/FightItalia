import { montaPagina } from "./common.js?v=202610101053";
montaPagina(location.pathname.split("/").pop() || "index.html");
