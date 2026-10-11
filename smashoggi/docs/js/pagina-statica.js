import { montaPagina } from "./common.js?v=202610110114";
montaPagina(location.pathname.split("/").pop() || "index.html");
