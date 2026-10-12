import { montaPagina } from "./common.js?v=202610121032";
montaPagina(location.pathname.split("/").pop() || "index.html");
