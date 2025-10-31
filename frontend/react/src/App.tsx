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
import { AppThemeProvider } from './contexts/ThemeContext';


function App() {

    return (
        <AppThemeProvider>
            <Router>
                <Routes>
                    <Route exact path="/" element={<HomePage/>}/>
                </Routes>
            </Router>
        </AppThemeProvider>
    );
}

export default App
