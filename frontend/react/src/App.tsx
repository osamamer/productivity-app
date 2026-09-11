import './App.css'
import '@fontsource/roboto/300.css';
import '@fontsource/roboto/400.css';
import '@fontsource/roboto/500.css';
import '@fontsource/roboto/700.css';
import {lazy, Suspense, useEffect, type ReactNode} from "react";
import {createBrowserRouter, Navigate, Outlet, RouterProvider} from "react-router-dom";
import {Box, LinearProgress} from '@mui/material';
import {ProtectedRoute} from "./components/ProtectedRoute";

import {TaskProvider} from "./contexts/TaskContext.tsx";
import {UserProvider} from "./contexts/UserContext";
import {NotificationCenter} from "./components/notifications/NotificationCenter.tsx";
import {AppErrorBoundary, AppErrorPage} from "./components/AppErrorBoundary.tsx";
import {useAppContextMenuGuard} from "./components/AppContextMenuGuard.tsx";
import {rememberMentalDestination, type MentalDestinationPath} from "./services/utils/mentalNavigation";
import {AppShell} from "./components/AppShell.tsx";
import {
    loadHomePageModule,
    loadTaskPageModule,
    preloadInactivePrimaryRoutes,
} from './services/routePreload';

const HomePage = lazy(() => loadHomePageModule().then(module => ({ default: module.HomePage })));
const CalendarPage = lazy(() => import('./pages/CalendarPage').then(module => ({ default: module.CalendarPage })));
const TaskPage = lazy(() => loadTaskPageModule().then(module => ({ default: module.TaskPage })));
const MeditationPage = lazy(() => import('./pages/MeditationPage').then(module => ({ default: module.MeditationPage })));
const LoginPage = lazy(() => import('./pages/LoginPage').then(module => ({ default: module.LoginPage })));
const StatsPage = lazy(() => import('./pages/StatsPage').then(module => ({ default: module.StatsPage })));
const SettingsPage = lazy(() => import('./pages/SettingsPage').then(module => ({ default: module.SettingsPage })));
const NotesPage = lazy(() => import('./pages/NotesPage').then(module => ({ default: module.NotesPage })));
const MentalThreadsPage = lazy(() => import('./pages/MentalThreadsPage').then(module => ({ default: module.MentalThreadsPage })));
const MentalStatePage = lazy(() => import('./pages/MentalStatePage').then(module => ({ default: module.MentalStatePage })));
const MentalPage = lazy(() => import('./pages/MentalPage').then(module => ({ default: module.MentalPage })));
const DayPage = lazy(() => import('./pages/DayPage').then(module => ({ default: module.DayPage })));

function RouteSuspense({ children }: { children: ReactNode }) {
    return (
        <Suspense fallback={(
            <Box sx={{ flex: 1, minHeight: '100%', backgroundColor: 'background.default' }}>
                <LinearProgress aria-label="Loading page" />
            </Box>
        )}>
            {children}
        </Suspense>
    );
}


function MentalDestinationTracker({destination, children}: { destination: MentalDestinationPath; children: ReactNode }) {
    useEffect(() => {
        rememberMentalDestination(destination);
    }, [destination]);

    return children;
}


function UserRoutes() {
    return (
        <UserProvider>
            <Outlet/>
        </UserProvider>
    );
}

function ProtectedApp() {
    return (
        <ProtectedRoute>
            <TaskProvider>
                <NotificationCenter/>
                <AppShell/>
            </TaskProvider>
        </ProtectedRoute>
    );
}

const routes = [
    {
        element: <UserRoutes/>,
        errorElement: <AppErrorPage/>,
        children: [
            { path: "/sign-in", element: <RouteSuspense><LoginPage/></RouteSuspense> },
            { path: "/login", element: <Navigate to="/sign-in" replace /> },
            {
                element: <ProtectedApp/>,
                children: [
                    { path: "/", element: <RouteSuspense><HomePage/></RouteSuspense> },
                    { path: "/calendar", element: <RouteSuspense><CalendarPage/></RouteSuspense> },
                    {
                        path: "/meditation",
                        element: (
                            <MentalDestinationTracker destination="/meditation">
                                <RouteSuspense><MeditationPage/></RouteSuspense>
                            </MentalDestinationTracker>
                        ),
                    },
                    { path: "/tasks", element: <RouteSuspense><TaskPage/></RouteSuspense> },
                    { path: "/stats", element: <RouteSuspense><StatsPage/></RouteSuspense> },
                    { path: "/day/:date", element: <RouteSuspense><DayPage/></RouteSuspense> },
                    { path: "/notes", element: <RouteSuspense><NotesPage/></RouteSuspense> },
                    { path: "/mental", element: <RouteSuspense><MentalPage/></RouteSuspense> },
                    {
                        path: "/mental-threads",
                        element: (
                            <MentalDestinationTracker destination="/mental-threads">
                                <RouteSuspense><MentalThreadsPage/></RouteSuspense>
                            </MentalDestinationTracker>
                        ),
                    },
                    {
                        path: "/mental-state",
                        element: (
                            <MentalDestinationTracker destination="/mental-state">
                                <RouteSuspense><MentalStatePage/></RouteSuspense>
                            </MentalDestinationTracker>
                        ),
                    },
                    { path: "/settings", element: <RouteSuspense><SettingsPage/></RouteSuspense> },
                    { path: "*", element: <Navigate to="/" replace /> },
                ],
            },
        ],
    },
];

const appRouter = createBrowserRouter(routes);

function App() {
    useAppContextMenuGuard();
    useEffect(() => {
        const timeoutId = window.setTimeout(() => {
            preloadInactivePrimaryRoutes(window.location.pathname);
        }, 800);
        return () => window.clearTimeout(timeoutId);
    }, []);

    return (
        <AppErrorBoundary>
            <RouterProvider router={appRouter}/>
        </AppErrorBoundary>
    );
}

export default App
