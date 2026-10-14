import { montaPagina } from "./common.js?v=202610140902";
montaPagina(location.pathname.split("/").pop() || "index.html");
