import { createContext, useContext, type ReactNode } from "react";
import { useFirebase } from "../hooks/useFirebase";

type FirebaseActions = ReturnType<typeof useFirebase>;

const FirebaseContext = createContext<FirebaseActions | null>(null);

export const FirebaseProvider = ({ children }: { children: ReactNode }) => {
  const actions = useFirebase();

  return <FirebaseContext.Provider value={actions}>{children}</FirebaseContext.Provider>;
};

export const useFirebaseActions = () => {
  const actions = useContext(FirebaseContext);
  if (!actions) throw new Error("useFirebaseActions must be used within a FirebaseProvider");
  return actions;
};
