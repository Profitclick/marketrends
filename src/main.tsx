import React from "react";
import { createRoot } from "react-dom/client";
import App from "./App.tsx";
import "./index.css";

// Build-time prerendered head tags are replaced by the route's own Helmet tags once the app boots.
document.querySelectorAll("head [data-prerender]").forEach((el) => el.remove());

createRoot(document.getElementById("root")!).render(<App />);
