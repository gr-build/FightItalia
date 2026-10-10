import { montaPagina } from "./common.js?v=202610101015";
montaPagina(location.pathname.split("/").pop() || "index.html");
