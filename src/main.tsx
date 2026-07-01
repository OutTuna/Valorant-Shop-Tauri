import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { HashRouter, Routes, Route } from "react-router-dom";

import "./index.css";
import { LanguageProvider } from "./context/LanguageContext";
import { ThemeProvider } from "./context/ThemeContext";

import HomePage from "./pages/HomePage";
import LoginPage from "./pages/LoginPage";
import RedirectPage from "./pages/RedirectPage";
import DeepLinkListener from "./pages/DeepLinkListener";

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <LanguageProvider>
      <ThemeProvider>
        <HashRouter>
          <DeepLinkListener />
          <Routes>
            <Route path="/" element={<HomePage />} />
            <Route path="/login" element={<LoginPage />} />
            <Route path="/redirect" element={<RedirectPage />} />
          </Routes>
        </HashRouter>
      </ThemeProvider>
    </LanguageProvider>
  </StrictMode>,
);
