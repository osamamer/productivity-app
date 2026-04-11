// @ts-nocheck
/* eslint-disable no-unused-vars */
import {useState} from 'react'
import './App.css'
import '@fontsource/roboto/300.css';
import '@fontsource/roboto/400.css';
import '@fontsource/roboto/500.css';
import '@fontsource/roboto/700.css';
import {BrowserRouter as Router, Routes, Route, Navigate} from "react-router-dom";
import {HomePage} from "./pages/HomePage.jsx";
import {CalendarPage} from "./pages/CalendarPage.jsx";
import {TaskPage} from "./pages/TaskPage.jsx";
import {MeditationPage} from "./pages/MeditationPage.jsx";
import {LoginPage} from "./pages/LoginPage";
import {ProtectedRoute} from "./components/ProtectedRoute";

import {TaskProvider} from "./contexts/TaskContext.tsx";
import {UserProvider} from "./contexts/UserContext";
import {StatsPage} from "./pages/StatsPage.tsx";
import {SettingsPage} from "./pages/SettingsPage.tsx";


function App() {

    return (
        <Router>
            <UserProvider>
                <TaskProvider>
                    <Routes>
                        <Route path="/login" element={<LoginPage/>}/>
                        <Route
                            path="/"
                            element={
                                <ProtectedRoute>
                                    <HomePage/>
                                </ProtectedRoute>
                            }
                        />
                        <Route
                            path="/calendar"
                            element={
                                <ProtectedRoute>
                                    <CalendarPage/>
                                </ProtectedRoute>
                            }
                        />
                        <Route
                            path="/meditation"
                            element={
                                <ProtectedRoute>
                                    <MeditationPage/>
                                </ProtectedRoute>
                            }
                        />
                        <Route
                            path="/tasks"
                            element={
                                <ProtectedRoute>
                                    <TaskPage/>
                                </ProtectedRoute>
                            }
                        />
                        <Route
                            path="/stats"
                            element={
                                <ProtectedRoute>
                                    <StatsPage/>
                                </ProtectedRoute>
                            }
                        />
                        <Route
                            path="/settings"
                            element={
                                <ProtectedRoute>
                                    <SettingsPage/>
                                </ProtectedRoute>
                            }
                        />
                        {/* Catch all - redirect to home */}
                        <Route path="*" element={<Navigate to="/" replace />} />
                    </Routes>
                </TaskProvider>
            </UserProvider>
        </Router>
    );
}

export default App
