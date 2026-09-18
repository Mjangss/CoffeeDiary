import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import "./index.css";
import App from "./App";
import { AppProvider } from "./context/AppContext";
import { BrewProvider } from "./context/BrewContext";
import { FirebaseProvider } from "./context/FirebaseContext";

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <AppProvider>
      <BrewProvider>
        <FirebaseProvider>
          <App />
        </FirebaseProvider>
      </BrewProvider>
    </AppProvider>
  </StrictMode>
);
