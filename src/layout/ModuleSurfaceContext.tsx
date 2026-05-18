import { createContext, PropsWithChildren, useContext } from 'react';

type ModuleSurface = 'main' | 'right-sidebar';

const ModuleSurfaceContext = createContext<ModuleSurface>('main');

interface ModuleSurfaceProviderProps extends PropsWithChildren {
  surface: ModuleSurface;
}

export function ModuleSurfaceProvider({ surface, children }: ModuleSurfaceProviderProps) {
  return (
    <ModuleSurfaceContext.Provider value={surface}>
      {children}
    </ModuleSurfaceContext.Provider>
  );
}

export function useModuleSurface() {
  return useContext(ModuleSurfaceContext);
}
