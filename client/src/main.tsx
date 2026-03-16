import { createRoot } from "react-dom/client";
import App from "./App";
import "./index.css";

// Force FluxDown favicon — overrides any injected defaults
function setFavicon() {
  document.querySelectorAll("link[rel~='icon']").forEach((el) => el.remove());
  const ico = document.createElement("link");
  ico.rel = "icon";
  ico.href = "/favicon.ico";
  ico.setAttribute("sizes", "32x32 64x64");
  document.head.appendChild(ico);
  const svg = document.createElement("link");
  svg.rel = "icon";
  svg.type = "image/svg+xml";
  svg.href = "/favicon.svg";
  document.head.appendChild(svg);
}
setFavicon();

createRoot(document.getElementById("root")!).render(<App />);
