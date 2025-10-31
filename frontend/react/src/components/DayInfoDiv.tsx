import {Task} from "../interfaces/Task.tsx";
import {Box, Card, Checkbox, Paper, Typography} from "@mui/material";

type props = {
    type: string,
    image: string;
    info: string;
    onClick: () => void;
    darkMode: boolean;
};


function Circle() {
    return (
        <div className="circle"></div>
    );
}

export function DayInfoDiv(props: props) {
    const isPlaceholder = !props.info;
    const title = `Today's ${props.type}`
    return (
        <Card title={title} className="task-div" sx={{
            '&:hover': {
                transform: 'scale(1.03)',
                boxShadow: 6,
            },
            transition: 'transform 0.3s, box-shadow 0.3s',
            boxShadow: 3,
            borderRadius: 3,
            justifyContent: 'center',
            // py: 0,
        }} onClick={() => {
            // props.onClick(props.task)
        }
        }>
            <Box sx={{borderColor: 'primary.main', px: 1, mr: 1}}>
                <img className="logo icon" src={props.image} alt={props.type} style={{
                    filter: props.darkMode
                        ? 'brightness(0) invert(1)'  // Light icon on dark background
                        : 'brightness(0) invert(0)' }}/>
                    </Box>
                    <Typography sx={{flex: '1 1 auto', pr: 1}}
                     variant="body1"
                     color={isPlaceholder ? 'textSecondary' : 'textPrimary'}
                     style={{fontStyle: isPlaceholder ? 'italic' : 'normal'}}
                >
                    {props.info || `Today's ${props.type}`}
                </Typography>
        </Card>
    );
}