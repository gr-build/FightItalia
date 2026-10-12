import { montaPagina } from "./common.js?v=202610121158";
montaPagina(location.pathname.split("/").pop() || "index.html");
