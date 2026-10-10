import { montaPagina } from "./common.js?v=202610100426";
montaPagina(location.pathname.split("/").pop() || "index.html");
