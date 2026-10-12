import { montaPagina } from "./common.js?v=202610120418";
montaPagina(location.pathname.split("/").pop() || "index.html");
