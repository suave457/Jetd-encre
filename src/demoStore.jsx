import { createContext, useContext, useMemo, useRef, useSyncExternalStore } from "react";
import {
  ACTIVATION_CODE_PATTERN,
  DEMO_ACCOUNTS,
  DEMO_ROLES,
  DEMO_SCHEMA_VERSION,
  DEMO_STORAGE_KEY,
  createDemoStore,
  createInitialDemoState,
  createMemoryStorage,
  createSafeStorage,
  hydrateDemoState,
  migrateDemoState,
} from "./demoStoreCore.js";

export {
  ACTIVATION_CODE_PATTERN,
  DEMO_ACCOUNTS,
  DEMO_ROLES,
  DEMO_SCHEMA_VERSION,
  DEMO_STORAGE_KEY,
  createDemoStore,
  createInitialDemoState,
  createMemoryStorage,
  createSafeStorage,
  hydrateDemoState,
  migrateDemoState,
};

export const DemoStoreContext = createContext(null);

export function DemoProvider({ children, storage, storageKey = DEMO_STORAGE_KEY, initialState }) {
  const storeRef = useRef(null);
  if (storeRef.current === null) {
    storeRef.current = createDemoStore({ storage, storageKey, initialState });
  }

  const store = storeRef.current;
  const state = useSyncExternalStore(store.subscribe, store.getState, store.getState);
  const value = useMemo(() => {
    const currentUser = state.users.find((user) => user.id === state.session.userId) || null;
    const visibleNotifications = state.notifications.filter(
      (notification) =>
        !notification.role ||
        notification.role === state.session.role ||
        notification.userId === state.session.userId,
    );

    return {
      state,
      ...state,
      currentUser,
      visibleNotifications,
      unreadNotifications: visibleNotifications.filter((notification) => !notification.read),
      actions: store.actions,
      ...store.actions,
      // French aliases make the API natural in the existing editorial vocabulary.
      creerDevoir: store.actions.createAssignment,
      modifierDevoir: store.actions.updateAssignment,
      dupliquerDevoir: store.actions.duplicateAssignment,
      archiverDevoir: store.actions.archiveAssignment,
      supprimerDevoir: store.actions.deleteAssignment,
      resetDemo: store.actions.reset,
    };
  }, [state, store]);

  return <DemoStoreContext.Provider value={value}>{children}</DemoStoreContext.Provider>;
}

export function useDemoStore() {
  const context = useContext(DemoStoreContext);
  if (!context) {
    throw new Error("useDemoStore doit être utilisé à l’intérieur de <DemoProvider>.");
  }
  return context;
}
