import './App.css'
import '@fontsource/roboto/300.css';
import '@fontsource/roboto/400.css';
import '@fontsource/roboto/500.css';
import '@fontsource/roboto/700.css';
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
import {NotificationCenter} from "./components/notifications/NotificationCenter.tsx";
import {AppErrorBoundary, AppErrorPage} from "./components/AppErrorBoundary.tsx";


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
                path: "/",
                element: (
                    <ProtectedRoute>
                        <HomePage/>
                    </ProtectedRoute>
                ),
            },
            {
                path: "/calendar",
                element: (
                    <ProtectedRoute>
                        <CalendarPage/>
                    </ProtectedRoute>
                ),
            },
            {
                path: "/meditation",
                element: (
                    <ProtectedRoute>
                        <MeditationPage/>
                    </ProtectedRoute>
                ),
            },
            {
                path: "/tasks",
                element: (
                    <ProtectedRoute>
                        <TaskPage/>
                    </ProtectedRoute>
                ),
            },
            {
                path: "/stats",
                element: (
                    <ProtectedRoute>
                        <StatsPage/>
                    </ProtectedRoute>
                ),
            },
            {
                path: "/notes",
                element: (
                    <ProtectedRoute>
                        <NotesPage/>
                    </ProtectedRoute>
                ),
            },
            {
                path: "/mental-threads",
                element: (
                    <ProtectedRoute>
                        <MentalThreadsPage/>
                    </ProtectedRoute>
                ),
            },
            {
                path: "/mental-state",
                element: (
                    <ProtectedRoute>
                        <MentalStatePage/>
                    </ProtectedRoute>
                ),
            },
            {
                path: "/settings",
                element: (
                    <ProtectedRoute>
                        <SettingsPage/>
                    </ProtectedRoute>
                ),
            },
            { path: "*", element: <Navigate to="/" replace /> },
        ],
    },
];

let appRouter: ReturnType<typeof createBrowserRouter> | null = null;

function App() {
    appRouter ??= createBrowserRouter(routes);
    return (
        <AppErrorBoundary>
            <RouterProvider router={appRouter}/>
        </AppErrorBoundary>
    );
}

export default App
