// @ts-nocheck
/* eslint-disable no-unused-vars */
import {useState} from 'react'
import './App.css'
import '@fontsource/roboto/300.css';
import '@fontsource/roboto/400.css';
import '@fontsource/roboto/500.css';
import '@fontsource/roboto/700.css';
import {BrowserRouter as Router, Routes, Route, Link} from "react-router-dom";
import {
    CssBaseline, Grid,
    ThemeProvider,
    Toolbar,
    Typography
} from "@mui/material";
import {HomePage} from "./pages/HomePage.jsx";
import {darkTheme, lightTheme} from "./Theme.tsx";



function App() {
    const [darkMode, setDarkMode] = useState(true);
    const toggleTheme = () => {
        setDarkMode(!darkMode);
    }
    return (
        <ThemeProvider theme={darkMode ? darkTheme : lightTheme}>
            <CssBaseline/>
            <Router>
                <Routes>
                    <Route exact path="/" element={<HomePage darkMode={darkMode} darkModeFunction={toggleTheme}/>}/>
                </Routes>
            </Router>
        </ThemeProvider>
    );
}

export default App
