import { useState } from "react";
import {
    Box,
    Card,
    CardContent,
    Typography,
    ToggleButton,
    ToggleButtonGroup,
    CircularProgress,
    useTheme
} from "@mui/material";

interface GrafanaPanelProps {
    title: string;
    description: string;
    computerId: string;
    metric: string;
    panelId: string;
    unit: string;
    defaultTimeRange?: string;
}

type TimeRange = '7d' | '30d' | '90d' | '1y';

export const GrafanaPanel: React.FC<GrafanaPanelProps> = ({
                                                              title,
                                                              description,
                                                              computerId,
                                                              metric,
                                                              panelId,
                                                              unit,
                                                              defaultTimeRange = '30d'
                                                          }) => {
    const theme = useTheme();
    const [isLoading, setIsLoading] = useState(true);
    const [timeRange, setTimeRange] = useState<TimeRange>(defaultTimeRange as TimeRange);

    const dashboardId = "adp5jgz";
    const baseUrl = `http://localhost:3000/d-solo/${dashboardId}/productivitydashboard`;

    const params = new URLSearchParams({
        orgId: "1",
        from: `now-${timeRange}`,
        to: "now",
        timezone: "utc",
        panelId: panelId,
        "var-comp_id": computerId,
        "var-metric": metric,
        "var-unit": unit,
        refresh: "5s",
        "__feature.dashboardSceneSolo": "true",
        "kiosk": "tv"
    });

    const url = `${baseUrl}?${params.toString()}`;

    const handleLoad = () => {
        setIsLoading(false);
    };

    const handleTimeRangeChange = (
        _event: React.MouseEvent<HTMLElement>,
        newRange: TimeRange | null,
    ) => {
        if (newRange !== null) {
            setIsLoading(true);
            setTimeRange(newRange);
        }
    };

    const timeRangeLabels: Record<TimeRange, string> = {
        '7d': 'Week',
        '30d': 'Month',
        '90d': '3 Months',
        '1y': 'Year'
    };

    return (
        <Card
            sx={{
                boxShadow: 3,
                borderRadius: 2,
                transition: 'transform 0.3s, box-shadow 0.3s',
                '&:hover': {
                    transform: 'scale(1.01)',
                    boxShadow: 6
                },
                height: '100%',
                display: 'flex',
                flexDirection: 'column'
            }}
        >
            <CardContent sx={{
                display: 'flex',
                flexDirection: 'column',
                gap: 2,
                height: '100%'
            }}>
                {/* Header */}
                <Box sx={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'flex-start',
                    flexWrap: 'wrap',
                    gap: 2
                }}>
                    <Box>
                        <Typography
                            variant="h5"
                            component="h3"
                            sx={{
                                fontWeight: 'bold',
                                color: theme.palette.primary.main,
                                mb: 0.5
                            }}
                        >
                            {title}
                        </Typography>

                    </Box>

                    {/* Time Range Selector */}
                    <ToggleButtonGroup
                        value={timeRange}
                        exclusive
                        onChange={handleTimeRangeChange}
                        size="small"
                        sx={{
                            '& .MuiToggleButton-root': {
                                px: 2,
                                py: 0.5,
                                textTransform: 'none',
                                fontSize: '0.875rem',
                                '&.Mui-selected': {
                                    backgroundColor: theme.palette.primary.main,
                                    color: theme.palette.primary.contrastText,
                                    '&:hover': {
                                        backgroundColor: theme.palette.primary.dark,
                                    }
                                }
                            }
                        }}
                    >
                        {(Object.entries(timeRangeLabels) as [TimeRange, string][]).map(([value, label]) => (
                            <ToggleButton key={value} value={value}>
                                {label}
                            </ToggleButton>
                        ))}
                    </ToggleButtonGroup>
                </Box>

                {/* Grafana Panel */}
                <Box
                    sx={{
                        position: 'relative',
                        flexGrow: 1,
                        minHeight: '400px',
                        borderRadius: 2,
                        overflow: 'hidden',
                        backgroundColor: theme.palette.background.default
                    }}
                >
                    {isLoading && (
                        <Box
                            sx={{
                                position: 'absolute',
                                top: 0,
                                left: 0,
                                right: 0,
                                bottom: 0,
                                display: 'flex',
                                flexDirection: 'column',
                                alignItems: 'center',
                                justifyContent: 'center',
                                backgroundColor: theme.palette.background.paper,
                                borderRadius: 2,
                                zIndex: 10,
                                gap: 2
                            }}
                        >
                            <CircularProgress size={48} />
                            <Typography variant="body2" color="text.secondary">
                                Loading panel...
                            </Typography>
                        </Box>
                    )}
                    <Box
                        component="iframe"
                        src={url}
                        sx={{
                            width: '100%',
                            height: '100%',
                            minHeight: '400px',
                            border: 'none',
                            borderRadius: 2,
                            opacity: isLoading ? 0 : 1,
                            transition: 'opacity 0.3s'
                        }}
                        onLoad={handleLoad}
                    />
                </Box>
            </CardContent>
        </Card>
    );
};