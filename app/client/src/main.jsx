// App entry: fonts are bundled locally (no third-party requests, strict CSP).
import React from "react";
import { createRoot } from "react-dom/client";
import "@fontsource/atkinson-hyperlegible/400.css";
import "@fontsource/atkinson-hyperlegible/700.css";
import "@fontsource/source-serif-4/600.css";
import "./index.css";
import App from "./App.jsx";

createRoot(document.getElementById("root")).render(<React.StrictMode><App /></React.StrictMode>);
