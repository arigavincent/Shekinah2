import React, { createContext, useContext } from "react";

import { useHomeContent } from "../hooks/useHomeContent";

const ContentContext = createContext(null);

export function ContentProvider({ children }) {
  const state = useHomeContent({ enabled: true });

  return (
    <ContentContext.Provider value={state}>
      {children}
    </ContentContext.Provider>
  );
}

export function useContent() {
  const value = useContext(ContentContext);

  if (!value) {
    throw new Error("useContent must be used inside ContentProvider");
  }

  return value;
}
