import { montaPagina } from "./common.js?v=202610121044";
montaPagina(location.pathname.split("/").pop() || "index.html");
