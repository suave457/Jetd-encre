import { createContext, useContext, useMemo, useRef, useSyncExternalStore } from "react";
import { clearJetDencreLocalData } from "./localDataReset.js";
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
      (notification) => notification.userId
        ? notification.userId === state.session.userId
        : !notification.role || notification.role === state.session.role,
    );

    const resetDemo = () => {
      const cleanup = clearJetDencreLocalData();
      if (!cleanup.ok) {
        return {
          ok: false,
          status: "local_cleanup_incomplete",
          message: "Certaines données locales n’ont pas pu être effacées. Vérifiez les autorisations de stockage du navigateur, puis réessayez.",
          cleanup,
        };
      }
      return { ...store.actions.reset(), cleanup };
    };
    const actions = { ...store.actions, reset: resetDemo };

    return {
      state,
      ...state,
      storageBackend: store.storage.backend,
      currentUser,
      visibleNotifications,
      unreadNotifications: visibleNotifications.filter((notification) => !notification.read),
      actions,
      ...actions,
      // French aliases make the API natural in the existing editorial vocabulary.
      creerDevoir: store.actions.createAssignment,
      modifierDevoir: store.actions.updateAssignment,
      dupliquerDevoir: store.actions.duplicateAssignment,
      archiverDevoir: store.actions.archiveAssignment,
      supprimerDevoir: store.actions.deleteAssignment,
      resetDemo,
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
