import { createContext, useContext, useLayoutEffect } from 'react';

interface NavigationVisibilityContextValue {
    visible: boolean;
    focusLocked: boolean;
    setVisible: (visible: boolean) => void;
    // A pomodoro is running, so total focus can be switched on.
    totalFocusAvailable: boolean;
    // Total focus hides the navigation completely and lets the focus timer take the whole screen.
    totalFocus: boolean;
    setTotalFocus: (on: boolean) => void;
}

export const NavigationVisibilityContext = createContext<NavigationVisibilityContextValue | null>(null);

export function useNavigationVisibility() {
    return useContext(NavigationVisibilityContext);
}

export function usePageNavigationVisibility(visible: boolean) {
    const navigation = useNavigationVisibility();
    const setVisible = navigation?.setVisible;
    const focusLocked = navigation?.focusLocked ?? false;

    useLayoutEffect(() => {
        if (!setVisible || focusLocked) return;
        setVisible(visible);
        return () => setVisible(true);
    }, [focusLocked, setVisible, visible]);
}
