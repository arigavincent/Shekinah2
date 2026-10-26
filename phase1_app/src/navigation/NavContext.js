import { createContext, useContext } from "react";

// goBack(fallback) pops the in-app history so the top-bar back arrow behaves
// like the hardware back button instead of pushing a new screen.
export const NavContext = createContext({ goBack: () => {} });

export function useNav() {
  return useContext(NavContext);
}
