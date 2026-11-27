import type { SvgIconComponent } from '@mui/icons-material';
import AutoAwesomeRoundedIcon from '@mui/icons-material/AutoAwesomeRounded';
import CodeRoundedIcon from '@mui/icons-material/CodeRounded';
import EditNoteRoundedIcon from '@mui/icons-material/EditNoteRounded';
import FitnessCenterRoundedIcon from '@mui/icons-material/FitnessCenterRounded';
import GroupRoundedIcon from '@mui/icons-material/GroupRounded';
import HomeRoundedIcon from '@mui/icons-material/HomeRounded';
import MusicNoteRoundedIcon from '@mui/icons-material/MusicNoteRounded';
import PaletteRoundedIcon from '@mui/icons-material/PaletteRounded';
import ParkRoundedIcon from '@mui/icons-material/ParkRounded';
import SavingsRoundedIcon from '@mui/icons-material/SavingsRounded';
import SchoolRoundedIcon from '@mui/icons-material/SchoolRounded';
import SelfImprovementRoundedIcon from '@mui/icons-material/SelfImprovementRounded';
import type { PathIcon } from '../../types/Path';

export const PATH_ICON_COMPONENTS: Record<PathIcon, SvgIconComponent> = {
    writer: EditNoteRoundedIcon,
    engineer: CodeRoundedIcon,
    money: SavingsRoundedIcon,
    body: FitnessCenterRoundedIcon,
    mind: SelfImprovementRoundedIcon,
    people: GroupRoundedIcon,
    learn: SchoolRoundedIcon,
    art: PaletteRoundedIcon,
    music: MusicNoteRoundedIcon,
    home: HomeRoundedIcon,
    nature: ParkRoundedIcon,
    spirit: AutoAwesomeRoundedIcon,
};

/** Road colours that read on the always-dark vortex. */
export const PATH_COLORS = ['#A395F2', '#7FB2F5', '#8DE2D6', '#9BD48A', '#E9B872', '#F08E84', '#F6B4AE', '#D7A6E8'];
