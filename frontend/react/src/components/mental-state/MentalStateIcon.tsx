import Battery20RoundedIcon from '@mui/icons-material/Battery20Rounded';
import BalanceRoundedIcon from '@mui/icons-material/BalanceRounded';
import CloudRoundedIcon from '@mui/icons-material/CloudRounded';
import ElectricBoltRoundedIcon from '@mui/icons-material/ElectricBoltRounded';
import HeartBrokenRoundedIcon from '@mui/icons-material/HeartBrokenRounded';
import MonitorHeartRoundedIcon from '@mui/icons-material/MonitorHeartRounded';
import PsychologyAltRoundedIcon from '@mui/icons-material/PsychologyAltRounded';
import RocketLaunchRoundedIcon from '@mui/icons-material/RocketLaunchRounded';
import TrackChangesRoundedIcon from '@mui/icons-material/TrackChangesRounded';
import TimelapseRoundedIcon from '@mui/icons-material/TimelapseRounded';
import { createSvgIcon } from '@mui/material/utils';
import { useTheme } from '@mui/material/styles';
import { getMentalStateColor } from './mentalStateColors';

type Tone = 'warning' | 'error' | 'primary' | 'secondary' | 'info' | 'success';
type StateIcon = typeof ElectricBoltRoundedIcon;
const GrapeClusterIcon = createSvgIcon(
    <path d="M14 12c0 1.1-.9 2-2 2s-2-.9-2-2 .9-2 2-2 2 .9 2 2M7 10c-1.1 0-2 .9-2 2s.9 2 2 2 2-.9 2-2-.9-2-2-2M17 10c-1.1 0-2 .9-2 2s.9 2 2 2 2-.9 2-2-.9-2-2-2M14.5 6c-1.1 0-2 .9-2 2s.9 2 2 2 2-.9 2-2-.9-2-2-2M9.5 6c-1.1 0-2 .9-2 2s.9 2 2 2 2-.9 2-2-.9-2-2-2M14.5 14c-1.1 0-2 .9-2 2s.9 2 2 2 2-.9 2-2-.9-2-2-2M9.5 14c-1.1 0-2 .9-2 2s.9 2 2 2 2-.9 2-2-.9-2-2-2M12 18c-1.1 0-2 .9-2 2s.9 2 2 2 2-.9 2-2-.9-2-2-2M14.4 2.2 13.6 1c-2.2 1-2.4 4.6-2.4 5h1.5c.1-.8.4-3.3 1.7-3.8Z" />,
    'GrapeCluster',
);

const stateVisuals: Record<string, { Icon: StateIcon; tone: Tone }> = {
    'Wired/Tired': { Icon: ElectricBoltRoundedIcon, tone: 'warning' },
    Depleted: { Icon: Battery20RoundedIcon, tone: 'error' },
    'Stimulation-Seeking': { Icon: GrapeClusterIcon, tone: 'primary' },
    'Scattered/Overactivated': { Icon: PsychologyAltRoundedIcon, tone: 'error' },
    'Emotionally Loaded': { Icon: HeartBrokenRoundedIcon, tone: 'secondary' },
    'Low Mood': { Icon: CloudRoundedIcon, tone: 'info' },
    Ready: { Icon: RocketLaunchRoundedIcon, tone: 'success' },
    'Almost Ready': { Icon: TimelapseRoundedIcon, tone: 'warning' },
    Engaged: { Icon: TrackChangesRoundedIcon, tone: 'primary' },
    Mixed: { Icon: BalanceRoundedIcon, tone: 'secondary' },
};

export function MentalStateIcon({ state, size = 'medium' }: { state: string; size?: 'small' | 'medium' }) {
    const theme = useTheme();
    const visual = stateVisuals[state];
    const Icon = visual?.Icon ?? MonitorHeartRoundedIcon;
    const color = getMentalStateColor(state, theme);

    return <Icon aria-hidden="true" sx={{ fontSize: size === 'small' ? 24 : 28, color, flexShrink: 0 }} />;
}
