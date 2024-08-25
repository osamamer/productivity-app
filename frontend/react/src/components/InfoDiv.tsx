import {Task} from "../interfaces/Task.tsx";
import {Box, Card, Checkbox, Paper, Typography} from "@mui/material";

type props = {
    type: string,
    image: string;
    info: string,
    onClick: () => void
};


function Circle() {
    return (
        <div className="circle"></div>
    );
}

export function InfoDiv(props: props) {
    const isPlaceholder = !props.info;
    const title = `Today's ${props.type}`
    return (
        <Card title={title} className="task-div" sx={{
            '&:hover': {
                transform: 'scale(1.05)',
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
            <Box sx={{ borderColor: 'primary.main', px: 1, mr: 1}}>
                <img className="logo icon" src={props.image} alt={props.type}/>
            </Box>
            {/*<Checkbox size="small" checked={props.task.completed}*/}
            {/*          onChange={() => {*/}
            {/*              props.toggleTaskCompletion(props.task.taskId)*/}
            {/*          }*/}
            {/*          }>*/}

            {/*</Checkbox>*/}
            {/*<label>*/}
            {/*    <input*/}
            {/*        type="checkbox"*/}
            {/*        className="task-button"*/}
            {/*        checked={props.task.completed}*/}
            {/*        onChange={() => {*/}
            {/*            props.toggleTaskCompletion(props.task.taskId)}*/}
            {/*        }*/}
            {/*    />*/}
            {/*</label>*/}
            {/*<Typography sx={{flex: '1 1 auto'}} className="task-div-text">{props.info}</Typography>*/}
            <Typography sx={{flex: '1 1 auto', pr: 1}}
                variant="body1"
                color={isPlaceholder ? 'textSecondary' : 'textPrimary'}
                style={{ fontStyle: isPlaceholder ? 'italic' : 'normal' }}
            >
                {props.info || `Today's ${props.type}`}
            </Typography>
        </Card>
    );
}