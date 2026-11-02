import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import Router from "./Router.jsx";
import "../frontend/styles/styles.css";
import "../frontend/styles/catalog_styles.css";
import "../frontend/styles/producto.css";
import "../frontend/styles/checkout.css";
import "../frontend/styles/panel_admin.css";
import "./migration.css";

createRoot(document.getElementById("root")).render(
    <StrictMode><Router /></StrictMode>
);