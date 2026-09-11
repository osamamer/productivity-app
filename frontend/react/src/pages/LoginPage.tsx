import { useState, type FormEvent } from 'react';
import {
    Alert,
    alpha,
    Box,
    Button,
    Divider,
    Paper,
    Stack,
    TextField,
    Typography,
    useTheme,
} from '@mui/material';
import CheckCircleOutlineRoundedIcon from '@mui/icons-material/CheckCircleOutlineRounded';
import SelfImprovementRoundedIcon from '@mui/icons-material/SelfImprovementRounded';
import TimerOutlinedIcon from '@mui/icons-material/TimerOutlined';
import { Navigate } from 'react-router-dom';
import eyeCareImage from '../assets/images/eye-care.png';
import keycloak, {
    authenticateWithPassword,
    registerAccount,
    type RegistrationDetails,
} from '../services/keycloak';

const EMPTY_REGISTRATION: RegistrationDetails = {
    email: '',
    firstName: '',
    lastName: '',
    username: '',
    password: '',
};

const FEATURES = [
    { icon: CheckCircleOutlineRoundedIcon, label: 'Shape the day without overplanning it' },
    { icon: TimerOutlinedIcon, label: 'Focus sessions that stay connected to your tasks' },
    { icon: SelfImprovementRoundedIcon, label: 'Make room for attention, energy, and rest' },
];

export function LoginPage() {
    const theme = useTheme();
    const [isRegistering, setIsRegistering] = useState(false);
    const [username, setUsername] = useState('');
    const [password, setPassword] = useState('');
    const [confirmation, setConfirmation] = useState('');
    const [registration, setRegistration] = useState(EMPTY_REGISTRATION);
    const [error, setError] = useState('');
    const [loading, setLoading] = useState(false);

    if (keycloak.authenticated) {
        return <Navigate to="/" replace/>;
    }

    const handleSubmit = async (event: FormEvent) => {
        event.preventDefault();
        setError('');

        if (isRegistering && registration.password !== confirmation) {
            setError('The passwords do not match.');
            return;
        }

        setLoading(true);
        try {
            if (isRegistering) {
                await registerAccount(registration);
                await authenticateWithPassword(registration.username, registration.password);
            } else {
                await authenticateWithPassword(username, password);
            }
            window.location.replace('/');
        } catch (requestError) {
            setError(
                isRegistering && requestError instanceof Error
                    ? requestError.message
                    : 'That username or password is incorrect.'
            );
            setLoading(false);
        }
    };

    const switchMode = () => {
        setIsRegistering((current) => !current);
        setError('');
        setPassword('');
        setConfirmation('');
    };

    const updateRegistration = (field: keyof RegistrationDetails, value: string) => {
        setRegistration((current) => ({ ...current, [field]: value }));
    };

    return (
        <Box
            component="main"
            data-context-menu-space
            sx={{
                minHeight: '100vh',
                display: 'grid',
                placeItems: 'center',
                p: { xs: 2, sm: 4 },
                bgcolor: 'background.default',
                backgroundImage: `
                    radial-gradient(circle at 12% 16%, ${alpha(theme.palette.primary.main, 0.14)}, transparent 32%),
                    radial-gradient(circle at 88% 82%, ${alpha(theme.palette.secondary.main, 0.09)}, transparent 30%)
                `,
            }}
        >
            <Paper
                elevation={0}
                sx={{
                    width: 'min(100%, 980px)',
                    overflow: 'hidden',
                    display: 'grid',
                    gridTemplateColumns: { xs: '1fr', md: '0.9fr 1.1fr' },
                    border: 1,
                    borderColor: 'divider',
                    borderRadius: 4,
                    boxShadow: theme.shadows[8],
                }}
            >
                <Box
                    sx={{
                        p: { xs: 3, sm: 5 },
                        display: 'flex',
                        flexDirection: 'column',
                        justifyContent: 'space-between',
                        gap: 5,
                        background: `linear-gradient(150deg, ${alpha(theme.palette.primary.main, 0.18)}, ${alpha(theme.palette.primary.main, 0.04)})`,
                        borderRight: { md: 1 },
                        borderBottom: { xs: 1, md: 0 },
                        borderColor: 'divider',
                    }}
                >
                    <Box>
                        <Stack direction="row" spacing={1.5} alignItems="center">
                            <Box
                                component="img"
                                src={eyeCareImage}
                                alt=""
                                sx={{ width: 54, height: 54 }}
                            />
                            <Box sx={{ textAlign: 'left' }}>
                                <Typography variant="h5" sx={{ fontWeight: 800, letterSpacing: '-0.03em' }}>
                                    Claritard
                                </Typography>
                                <Typography variant="body2" color="text.secondary">
                                    So life doesn’t get overwhelming.
                                </Typography>
                            </Box>
                        </Stack>

                        <Typography
                            variant="h3"
                            sx={{
                                mt: 5,
                                maxWidth: 390,
                                textAlign: 'left',
                                fontWeight: 800,
                                fontSize: { xs: '2rem', sm: '2.55rem' },
                                lineHeight: 1.08,
                                letterSpacing: '-0.045em',
                            }}
                        >
                            A calmer place for everything on your mind.
                        </Typography>
                    </Box>

                    <Stack spacing={2} sx={{ display: { xs: 'none', sm: 'flex' } }}>
                        {FEATURES.map(({ icon: Icon, label }) => (
                            <Stack key={label} direction="row" spacing={1.5} alignItems="center">
                                <Box
                                    sx={{
                                        width: 34,
                                        height: 34,
                                        borderRadius: 2,
                                        display: 'grid',
                                        placeItems: 'center',
                                        color: 'primary.main',
                                        bgcolor: alpha(theme.palette.primary.main, 0.13),
                                    }}
                                >
                                    <Icon fontSize="small"/>
                                </Box>
                                <Typography variant="body2" sx={{ textAlign: 'left', fontWeight: 500 }}>
                                    {label}
                                </Typography>
                            </Stack>
                        ))}
                    </Stack>
                </Box>

                <Box sx={{ p: { xs: 3, sm: 5 }, alignSelf: 'center' }}>
                    <Typography variant="h4" sx={{ fontWeight: 750, letterSpacing: '-0.025em' }}>
                        {isRegistering ? 'Create your account' : 'Welcome back'}
                    </Typography>
                    <Typography color="text.secondary" sx={{ mt: 0.75, mb: 3 }}>
                        {isRegistering
                            ? 'Start with a space that belongs entirely to you.'
                            : 'Sign in and pick up where you left off.'}
                    </Typography>

                    {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}

                    <Box component="form" onSubmit={handleSubmit}>
                        {isRegistering ? (
                            <Stack spacing={2}>
                                <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2}>
                                    <TextField
                                        required
                                        fullWidth
                                        autoFocus
                                        label="First name"
                                        autoComplete="given-name"
                                        value={registration.firstName}
                                        onChange={(event) => updateRegistration('firstName', event.target.value)}
                                    />
                                    <TextField
                                        required
                                        fullWidth
                                        label="Last name"
                                        autoComplete="family-name"
                                        value={registration.lastName}
                                        onChange={(event) => updateRegistration('lastName', event.target.value)}
                                    />
                                </Stack>
                                <TextField
                                    required
                                    fullWidth
                                    label="Email"
                                    type="email"
                                    autoComplete="email"
                                    value={registration.email}
                                    onChange={(event) => updateRegistration('email', event.target.value)}
                                />
                                <TextField
                                    required
                                    fullWidth
                                    label="Username"
                                    autoComplete="username"
                                    value={registration.username}
                                    onChange={(event) => updateRegistration('username', event.target.value)}
                                />
                                <TextField
                                    required
                                    fullWidth
                                    label="Password"
                                    type="password"
                                    autoComplete="new-password"
                                    value={registration.password}
                                    onChange={(event) => updateRegistration('password', event.target.value)}
                                    helperText="At least 8 characters"
                                />
                                <TextField
                                    required
                                    fullWidth
                                    label="Confirm password"
                                    type="password"
                                    autoComplete="new-password"
                                    value={confirmation}
                                    onChange={(event) => setConfirmation(event.target.value)}
                                />
                            </Stack>
                        ) : (
                            <Stack spacing={2}>
                                <TextField
                                    required
                                    fullWidth
                                    autoFocus
                                    label="Username or email"
                                    autoComplete="username"
                                    value={username}
                                    onChange={(event) => setUsername(event.target.value)}
                                />
                                <TextField
                                    required
                                    fullWidth
                                    label="Password"
                                    type="password"
                                    autoComplete="current-password"
                                    value={password}
                                    onChange={(event) => setPassword(event.target.value)}
                                />
                            </Stack>
                        )}

                        <Button
                            type="submit"
                            fullWidth
                            variant="contained"
                            disabled={loading}
                            sx={{ mt: 3, py: 1.35, fontWeight: 700 }}
                        >
                            {loading
                                ? (isRegistering ? 'Creating account…' : 'Signing in…')
                                : (isRegistering ? 'Create account' : 'Sign in')}
                        </Button>
                    </Box>

                    <Divider sx={{ my: 3 }}/>
                    <Stack direction="row" justifyContent="center" alignItems="center" spacing={0.75}>
                        <Typography variant="body2" color="text.secondary">
                            {isRegistering ? 'Already have an account?' : 'New to Claritard?'}
                        </Typography>
                        <Button
                            type="button"
                            size="small"
                            onClick={switchMode}
                            sx={{ minWidth: 0, p: 0.25, fontWeight: 700 }}
                        >
                            {isRegistering ? 'Sign in' : 'Create one'}
                        </Button>
                    </Stack>
                </Box>
            </Paper>
        </Box>
    );
}
