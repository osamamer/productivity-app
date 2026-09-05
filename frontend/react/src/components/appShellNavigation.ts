import { createContext, useContext, useLayoutEffect } from 'react';

interface NavigationVisibilityContextValue {
    visible: boolean;
    setVisible: (visible: boolean) => void;
}

export const NavigationVisibilityContext = createContext<NavigationVisibilityContextValue | null>(null);

export function useNavigationVisibility() {
    return useContext(NavigationVisibilityContext);
}

export function usePageNavigationVisibility(visible: boolean) {
    const navigation = useNavigationVisibility();

    useLayoutEffect(() => {
        if (!navigation) return;
        navigation.setVisible(visible);
        return () => navigation.setVisible(true);
    }, [navigation, visible]);
}
