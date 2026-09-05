import './App.css'
import '@fontsource/roboto/300.css';
import '@fontsource/roboto/400.css';
import '@fontsource/roboto/500.css';
import '@fontsource/roboto/700.css';
import {useEffect, type ReactNode} from "react";
import {createBrowserRouter, Navigate, Outlet, RouterProvider} from "react-router-dom";
import {HomePage} from "./pages/HomePage.jsx";
import {CalendarPage} from "./pages/CalendarPage.jsx";
import {TaskPage} from "./pages/TaskPage.jsx";
import {MeditationPage} from "./pages/MeditationPage.tsx";
import {LoginPage} from "./pages/LoginPage";
import {ProtectedRoute} from "./components/ProtectedRoute";

import {TaskProvider} from "./contexts/TaskContext.tsx";
import {UserProvider} from "./contexts/UserContext";
import {StatsPage} from "./pages/StatsPage.tsx";
import {SettingsPage} from "./pages/SettingsPage.tsx";
import {NotesPage} from "./pages/NotesPage.tsx";
import {MentalThreadsPage} from "./pages/MentalThreadsPage.tsx";
import {MentalStatePage} from "./pages/MentalStatePage.tsx";
import {MentalPage} from "./pages/MentalPage.tsx";
import {NotificationCenter} from "./components/notifications/NotificationCenter.tsx";
import {AppErrorBoundary, AppErrorPage} from "./components/AppErrorBoundary.tsx";
import {useAppContextMenuGuard} from "./components/AppContextMenuGuard.tsx";
import {rememberMentalDestination, type MentalDestinationPath} from "./services/utils/mentalNavigation";
import {AppShell} from "./components/AppShell.tsx";


function MentalDestinationTracker({destination, children}: { destination: MentalDestinationPath; children: ReactNode }) {
    useEffect(() => {
        rememberMentalDestination(destination);
    }, [destination]);

    return children;
}


function AppProviders() {
    return (
        <UserProvider>
            <TaskProvider>
                <NotificationCenter/>
                <Outlet/>
            </TaskProvider>
        </UserProvider>
    );
}

const routes = [
    {
        element: <AppProviders/>,
        errorElement: <AppErrorPage/>,
        children: [
            { path: "/login", element: <LoginPage/> },
            {
                element: (
                    <ProtectedRoute>
                        <AppShell/>
                    </ProtectedRoute>
                ),
                children: [
                    { path: "/", element: <HomePage/> },
                    { path: "/calendar", element: <CalendarPage/> },
                    {
                        path: "/meditation",
                        element: (
                            <MentalDestinationTracker destination="/meditation">
                                <MeditationPage/>
                            </MentalDestinationTracker>
                        ),
                    },
                    { path: "/tasks", element: <TaskPage/> },
                    { path: "/stats", element: <StatsPage/> },
                    { path: "/notes", element: <NotesPage/> },
                    { path: "/mental", element: <MentalPage/> },
                    {
                        path: "/mental-threads",
                        element: (
                            <MentalDestinationTracker destination="/mental-threads">
                                <MentalThreadsPage/>
                            </MentalDestinationTracker>
                        ),
                    },
                    {
                        path: "/mental-state",
                        element: (
                            <MentalDestinationTracker destination="/mental-state">
                                <MentalStatePage/>
                            </MentalDestinationTracker>
                        ),
                    },
                    { path: "/settings", element: <SettingsPage/> },
                    { path: "*", element: <Navigate to="/" replace /> },
                ],
            },
        ],
    },
];

let appRouter: ReturnType<typeof createBrowserRouter> | null = null;

function App() {
    useAppContextMenuGuard();
    appRouter ??= createBrowserRouter(routes);
    return (
        <AppErrorBoundary>
            <RouterProvider router={appRouter}/>
        </AppErrorBoundary>
    );
}

export default App
