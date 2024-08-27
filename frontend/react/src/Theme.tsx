import {createTheme} from "@mui/material";
const { palette } = createTheme();
const { augmentColor } = palette;
const createColor = (mainColor) => augmentColor({ color: { main: mainColor } });
export const darkTheme = createTheme({
    typography: {
        fontFamily: 'Raleway, Arial, sans-serif', // Set your desired font family
    },
        palette: {
            mode: 'dark',
            primary: {
                main: '#A395F2',
            },
            secondary: {
                main: '#F5E55F',
            },
            info: {
                main: '#9FCAFA',
                medium: '#FAEC66' ,
                high: '#FF614B'
            },
            low: createColor('#9FCAFA'),
            medium: createColor('#FAEC66'),
            high: createColor('#FF614B'),

            background: {
                // default: '#1F1D21',
                // paper: '#1F1D21',
                // default: '#1e2124',
                // paper: '#1e2124',
            },
            text: {
                primary: '#FFFFFF',
            },
        }
    }
)
export const lightTheme = createTheme({
    typography: {
        fontFamily: 'Raleway, Arial, sans-serif', // Set your desired font family
    },
    palette: {
        mode: 'light',
        primary: {
            main: '#946AF5',
        },
        secondary: {
            main: '#F5E55F',
        },
        background: {
            default: '#ffffff',
            paper: '#f5f5f5',
        },

        info: {
            main: '#9FCAFA',
            medium: '#FAEC66' ,
            high: '#FF614B'
        },
        low: createColor('#9FCAFA'),
        medium: createColor('#FAEC66'),
        high: createColor('#FF614B'),
        text: {
            primary: '#000000',
        },
    },
});