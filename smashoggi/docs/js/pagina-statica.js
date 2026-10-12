import { montaPagina } from "./common.js?v=202610120416";
montaPagina(location.pathname.split("/").pop() || "index.html");
