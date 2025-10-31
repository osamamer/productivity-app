import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App.tsx'
import './index.css'
import {DevSupport} from "@react-buddy/ide-toolbox";
import {ComponentPreviews, useInitial} from "./dev";
import {createTheme, ThemeProvider} from "@mui/material";
const theme = createTheme({
    palette: {
        primary: {
            main: '#8009D9'
        },
        secondary: {
            main: '#03a9f4'
        },
    },
})
window.global = window;
ReactDOM.createRoot(document.getElementById('root')!).render(
    <React.StrictMode>
        <ThemeProvider theme={theme}>
            <DevSupport ComponentPreviews={ComponentPreviews} useInitialHook={useInitial}>
            <App/>
        </DevSupport>
        </ThemeProvider>

    </React.StrictMode>,
)
