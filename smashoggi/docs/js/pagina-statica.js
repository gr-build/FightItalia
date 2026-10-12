import { montaPagina } from "./common.js?v=202610120746";
montaPagina(location.pathname.split("/").pop() || "index.html");
