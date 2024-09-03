import React, { useState, useRef, useEffect } from 'react';
import Typography from '@mui/material/Typography';
import Box from '@mui/material/Box';

const TaskDescriptionInput: React.FC = () => {
  const [content, setContent] = useState<string>(''); // State for the content
  const [isEditing, setIsEditing] = useState<boolean>(false); // State to toggle between input and display
  const divRef = useRef<HTMLDivElement>(null);

  const handleClick = () => {
    setIsEditing(true);
    setTimeout(() => {
      divRef.current?.focus(); // Focus the div when it becomes editable
    }, 0);
  };

  const handleBlur = () => {
    setIsEditing(false);
    setContent(divRef.current?.textContent || '');
  };

  useEffect(() => {
    if (content === '') {
      setIsEditing(false);
    }
  }, [content]);

  return (
    <Box
      onClick={handleClick}
      sx={{
        width: '100%',
        textAlign: 'center',
        cursor: 'text',
      }}
    >
      {isEditing ? (
        <div
          ref={divRef}
          contentEditable
          onBlur={handleBlur}
          style={{
            minHeight: '30px', // Maintain a minimum height
            outline: 'none', // Remove the default outline when focused
            fontSize: '16px',
            textAlign: 'center',
          }}
        >
          {content}
        </div>
      ) : (
        <Typography
          variant="body1"
          sx={{
            fontSize: '16px',
            cursor: 'text',
            padding: '10px 0',
            textAlign: 'center',
          }}
        >
          {content || 'Click to add a task description...'}
        </Typography>
      )}
    </Box>
  );
};

export default TaskDescriptionInput;
