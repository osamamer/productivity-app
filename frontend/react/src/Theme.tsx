import {createTheme} from "@mui/material";

export const darkTheme = createTheme({
        palette: {
            mode: 'dark',
            primary: {
                main: '#7eb5e2',
            },
            secondary: {
                main: '#e27e7e',
            },
            background: {
                default: '#14142F',
                paper: '#14142F',
                // default: '#1e2124',
                // paper: '#1e2124',
            },
            text: {
                primary: '#f1e7e7',
            },
        }
    }
)
export const lightTheme = createTheme({
    palette: {
        mode: 'light',
        primary: {
            main: '#7eb5e2',
        },
        secondary: {
            main: '#e27e7e',
        },
        background: {
            default: '#ffffff',
            paper: '#f5f5f5',
        },
        text: {
            primary: '#14142F',
        },
    },
});