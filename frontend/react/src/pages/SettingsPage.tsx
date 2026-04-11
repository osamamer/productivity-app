import { SyntheticEvent, useState } from 'react';
import { Box, Button, Stack, Tab, Tabs, Typography } from '@mui/material';
import LightModeIcon from '@mui/icons-material/LightMode';
import NightlightIcon from '@mui/icons-material/Nightlight';
import LogoutIcon from '@mui/icons-material/Logout';
import PersonOutlineIcon from '@mui/icons-material/PersonOutline';
import PaletteOutlinedIcon from '@mui/icons-material/PaletteOutlined';
import SecurityOutlinedIcon from '@mui/icons-material/SecurityOutlined';
import { PageWrapper } from '../components/PageWrapper.tsx';
import { useUser } from '../contexts/UserContext.tsx';
import { useAppTheme } from '../contexts/ThemeContext.tsx';

const sectionCardSx = {
    backgroundColor: 'background.paper',
    borderRadius: 3,
    px: 2.5,
    py: 2.25,
    boxShadow: '0 2px 16px rgba(0,0,0,0.06)',
};

const sectionHeadingSx = {
    display: 'flex',
    alignItems: 'center',
    gap: 1,
    mb: 1.5,
};

export function SettingsPage() {
    const { user, logout } = useUser();
    const { darkMode, setTheme } = useAppTheme();
    const [activeTab, setActiveTab] = useState(0);

    function handleTabChange(_event: SyntheticEvent, newValue: number) {
        setActiveTab(newValue);
    }

    const displayName = user ? `${user.firstName} ${user.lastName}`.trim() || user.username : 'Unknown user';

    return (
        <PageWrapper>
            <Box sx={{ flex: 1, width: '100%' }}>
                <Box sx={{ maxWidth: 760, width: '100%', mx: 'auto', pt: 10, pb: 8, px: { xs: 2, md: 4 } }}>
                    <Typography variant="h4" color="text.primary" sx={{ mb: 2, fontWeight: 400, textAlign: 'left' }}>
                        Settings
                    </Typography>

                    <Tabs
                        value={activeTab}
                        onChange={handleTabChange}
                        variant="scrollable"
                        allowScrollButtonsMobile
                        sx={{
                            mb: 3,
                            minHeight: 40,
                            '& .MuiTabs-flexContainer': {
                                gap: 1,
                            },
                            '& .MuiTab-root': {
                                minHeight: 40,
                                px: 1.5,
                                py: 0.75,
                                borderRadius: 2,
                                textTransform: 'none',
                                fontSize: '0.92rem',
                                fontWeight: 500,
                                color: 'text.secondary',
                                alignItems: 'flex-start',
                            },
                            '& .Mui-selected': {
                                color: 'text.primary',
                                backgroundColor: 'background.paper',
                            },
                            '& .MuiTabs-indicator': {
                                display: 'none',
                            },
                        }}
                    >
                        <Tab label="General" />
                        <Tab label="Account" />
                        <Tab label="Appearance" />
                    </Tabs>

                    <Stack spacing={2.5}>
                        {activeTab === 0 && (
                            <Box sx={sectionCardSx}>
                                <Box sx={sectionHeadingSx}>
                                    <SecurityOutlinedIcon sx={{ fontSize: 18, color: 'text.secondary' }} />
                                    <Typography variant="subtitle1" sx={{ fontWeight: 600 }}>
                                        Session
                                    </Typography>
                                </Box>

                                <Typography variant="body2" color="text.secondary" sx={{ mb: 2, textAlign: 'left' }}>
                                    Authentication is handled through Keycloak. Signing out ends the current app session and returns you to login.
                                </Typography>

                                <Button
                                    variant="outlined"
                                    color="inherit"
                                    startIcon={<LogoutIcon />}
                                    onClick={logout}
                                    sx={{ borderRadius: 2, py: 1.1, textTransform: 'none' }}
                                >
                                    Log out
                                </Button>
                            </Box>
                        )}

                        {activeTab === 1 && (
                            <Box sx={sectionCardSx}>
                            <Box sx={sectionHeadingSx}>
                                <PersonOutlineIcon sx={{ fontSize: 18, color: 'text.secondary' }} />
                                <Typography variant="subtitle1" sx={{ fontWeight: 600 }}>
                                    Account
                                </Typography>
                            </Box>

                            <Stack spacing={1.5}>
                                <Box sx={{ textAlign: 'left' }}>
                                    <Typography variant="body1">
                                        <Box component="span" sx={{ color: 'text.secondary', mr: 1 }}>
                                            Name:
                                        </Box>
                                        <Box component="span" sx={{ color: 'text.primary', fontWeight: 500 }}>
                                            {displayName}
                                        </Box>
                                    </Typography>
                                </Box>
                                <Box sx={{ textAlign: 'left' }}>
                                    <Typography variant="body1">
                                        <Box component="span" sx={{ color: 'text.secondary', mr: 1 }}>
                                            Username:
                                        </Box>
                                        <Box component="span" sx={{ color: 'text.primary', fontWeight: 500 }}>
                                            {user?.username || 'No username available'}
                                        </Box>
                                    </Typography>
                                </Box>
                                <Box sx={{ textAlign: 'left' }}>
                                    <Typography variant="body1">
                                        <Box component="span" sx={{ color: 'text.secondary', mr: 1 }}>
                                            Email:
                                        </Box>
                                        <Box component="span" sx={{ color: 'text.primary', fontWeight: 500 }}>
                                            {user?.email || 'No email available'}
                                        </Box>
                                    </Typography>
                                </Box>
                            </Stack>
                        </Box>
                        )}

                        {activeTab === 2 && (
                            <Box sx={sectionCardSx}>
                            <Box sx={sectionHeadingSx}>
                                <PaletteOutlinedIcon sx={{ fontSize: 18, color: 'text.secondary' }} />
                                <Typography variant="subtitle1" sx={{ fontWeight: 600 }}>
                                    Appearance
                                </Typography>
                            </Box>

                            <Typography variant="body2" color="text.secondary" sx={{ mb: 2, textAlign: 'left' }}>
                                Choose the mode that stays out of the way.
                            </Typography>

                            <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1.5}>
                                <Button
                                    variant={darkMode ? 'outlined' : 'contained'}
                                    startIcon={<LightModeIcon />}
                                    onClick={() => setTheme('light')}
                                    sx={{ flex: 1, borderRadius: 2, py: 1.1, textTransform: 'none' }}
                                >
                                    Light
                                </Button>
                                <Button
                                    variant={darkMode ? 'contained' : 'outlined'}
                                    startIcon={<NightlightIcon />}
                                    onClick={() => setTheme('dark')}
                                    sx={{ flex: 1, borderRadius: 2, py: 1.1, textTransform: 'none' }}
                                >
                                    Dark
                                </Button>
                            </Stack>
                        </Box>
                        )}
                    </Stack>
                </Box>
            </Box>
        </PageWrapper>
    );
}

export default SettingsPage;
