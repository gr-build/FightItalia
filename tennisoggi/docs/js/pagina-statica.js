import { montaPagina } from "./common.js?v=202610100420";
montaPagina(location.pathname.split("/").pop() || "index.html");
