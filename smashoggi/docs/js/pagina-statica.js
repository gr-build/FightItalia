import { montaPagina } from "./common.js?v=202610121151";
montaPagina(location.pathname.split("/").pop() || "index.html");
