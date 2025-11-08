// @ts-nocheck
/* eslint-disable no-unused-vars */
import {useState} from 'react'
import './App.css'
import '@fontsource/roboto/300.css';
import '@fontsource/roboto/400.css';
import '@fontsource/roboto/500.css';
import '@fontsource/roboto/700.css';
import {BrowserRouter as Router, Routes, Route, Link} from "react-router-dom";
import {HomePage} from "./pages/HomePage.jsx";
import {CalendarPage} from "./pages/CalendarPage.jsx";
import {TaskPage} from "./pages/TaskPage.jsx";

import { AppThemeProvider } from './contexts/ThemeContext';
import {TaskProvider} from "./contexts/TaskContext.tsx";


function App() {

    return (
        <AppThemeProvider>
            <Router>
                <TaskProvider>
                    <Routes>
                        <Route exact path="/" element={<HomePage/>}/>
                        <Route exact path="/calendar" element={<CalendarPage/>}/>
                        <Route exact path="/tasks" element={<TaskPage/>}/>

                    </Routes>
                </TaskProvider>
            </Router>
        </AppThemeProvider>
    );
}

export default App
