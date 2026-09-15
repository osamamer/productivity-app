import { Box, Tooltip as MuiTooltip, Typography } from '@mui/material';
import { Theme } from '@mui/material/styles';
import { format, parseISO } from 'date-fns';
import {
    Area,
    AreaChart,
    CartesianGrid,
    ReferenceLine,
    ResponsiveContainer,
    Tooltip,
    XAxis,
    YAxis,
} from 'recharts';
import type { LabelProps } from 'recharts';
import { formatDurationValue } from '../../services/utils/statValues';
import { StatDefinition } from '../../types/Stats';
import { StatChartPoint, StatChartPointClickEvent } from './statChartTypes';
import { StatChartTooltip } from './StatChartTooltip';

interface Props {
    definition: StatDefinition;
    comparisonDefinition?: StatDefinition;
    points: StatChartPoint[];
    dateRange: number;
    theme: Theme;
    onPointClick?: (point: StatChartPoint, event: StatChartPointClickEvent) => void;
    onDateContextMenu?: (date: string, event: React.MouseEvent<Element>) => void;
}

function targetValue(definition: StatDefinition): number | undefined {
    const target = definition.goodThreshold;
    return target != null
        && Number.isFinite(target)
        && definition.morality !== undefined
        && definition.morality !== 'NEUTRAL'
        ? target
        : undefined;
}

const DURATION_TICK_STEPS = [15, 30, 60, 120, 180, 240, 360, 480, 720, 960, 1440];

function DurationThresholdLabel({
    viewBox,
    value,
    fill,
    backgroundColor,
}: LabelProps & { backgroundColor: string }) {
    if (!viewBox || !('x' in viewBox)) return null;

    return (
        <text
            x={(viewBox.x ?? 0) + (viewBox.width ?? 0) - 3}
            y={(viewBox.y ?? 0) - 9}
            textAnchor="end"
            fill={fill}
            fontSize={13}
            fontWeight={700}
            paintOrder="stroke"
            stroke={backgroundColor}
            strokeWidth={4}
            strokeLinecap="round"
            strokeLinejoin="round"
        >
            {value}
        </text>
    );
}

function durationAxis(maximum: number): { maximum: number; ticks: number[] } {
    const desiredStep = maximum / 4;
    const step = DURATION_TICK_STEPS.find(candidate => candidate >= desiredStep)
        ?? Math.ceil(desiredStep / 15) * 15;
    const axisMaximum = Math.max(step, Math.ceil(maximum / step) * step);
    return {
        maximum: axisMaximum,
        ticks: Array.from({ length: axisMaximum / step + 1 }, (_, index) => index * step),
    };
}

function formatDurationAxisValue(value: number): string {
    const rounded = Math.round(value);
    const hours = Math.floor(rounded / 60);
    const minutes = rounded % 60;
    if (hours === 0) return `${minutes}m`;
    return minutes === 0 ? `${hours}h` : `${hours}h ${minutes}m`;
}

function chartMaximum(definition: StatDefinition, points: StatChartPoint[]): number {
    const values = points
        .flatMap(point => [point.value, point.comparisonValue])
        .filter((value): value is number => value !== undefined);
    return Math.max(60, targetValue(definition) ?? 0, ...values) * 1.08;
}

function SevenDayDurationBars({ definition, comparisonDefinition, points, theme, onPointClick, onDateContextMenu }: Omit<Props, 'dateRange'>) {
    const axis = durationAxis(chartMaximum(definition, points));
    const maximum = axis.maximum;
    const target = targetValue(definition);
    const primaryColor = theme.palette.primary.main;
    const comparisonColor = theme.palette.secondary.main;
    const tooltipSlotProps = {
        tooltip: {
            sx: {
                bgcolor: theme.palette.background.paper,
                border: `1px solid ${theme.palette.divider}`,
                borderRadius: 1,
                boxShadow: theme.shadows[4],
                color: theme.palette.text.primary,
                fontSize: 12,
                lineHeight: 1.35,
                px: 1,
                py: 0.75,
            },
        },
        arrow: { sx: { color: theme.palette.background.paper } },
    };

    return (
        <Box>
            {comparisonDefinition && (
                <Box sx={{ display: 'flex', gap: 2, mb: 1 }}>
                    {[{ name: definition.name, color: primaryColor }, { name: comparisonDefinition.name, color: comparisonColor }].map(item => (
                        <Box key={item.name} sx={{ display: 'flex', alignItems: 'center', gap: 0.75 }}>
                            <Box sx={{ width: 12, height: 12, borderRadius: '50%', bgcolor: item.color }} />
                            <Typography variant="caption" fontWeight={600}>{item.name}</Typography>
                        </Box>
                    ))}
                </Box>
            )}
            <Box sx={{ display: 'grid', gridTemplateColumns: '52px minmax(0, 1fr)', gap: 1 }}>
                <Box sx={{ height: 188, display: 'flex', flexDirection: 'column', justifyContent: 'space-between', alignItems: 'flex-end' }}>
                    {[...axis.ticks].reverse().map(value => (
                        <Typography key={value} variant="caption" color="text.secondary">{formatDurationAxisValue(value)}</Typography>
                    ))}
                </Box>
                <Box sx={{ position: 'relative', height: 188, borderBottom: 1, borderColor: 'divider' }}>
                    {axis.ticks.map(value => (
                        <Box key={value} sx={{ position: 'absolute', left: 0, right: 0, top: `${100 - value / maximum * 100}%`, borderTop: 1, borderColor: 'divider', opacity: 0.72 }} />
                    ))}
                    {target !== undefined && (
                        <Box sx={{ position: 'absolute', left: 0, right: 0, bottom: `${target / maximum * 100}%`, borderTop: '2px dashed', borderColor: 'success.main', opacity: 0.75 }} />
                    )}
                    <Box sx={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'flex-end', gap: 0.75, px: 0.5 }}>
                        {points.map(point => {
                            const primaryHeight = point.value === undefined ? 0 : Math.max(3, point.value / maximum * 100);
                            const comparisonHeight = point.comparisonValue === undefined ? 0 : Math.max(3, point.comparisonValue / maximum * 100);
                            return (
                                <Box key={point.date} sx={{ minWidth: 0, flex: 1, height: '100%', display: 'flex', alignItems: 'flex-end', justifyContent: 'center', gap: comparisonDefinition ? 0.35 : 0, position: 'relative' }}>
                                    {point.value !== undefined && (
                                        <MuiTooltip
                                            title={`${format(parseISO(point.date), 'EEEE, MMM d')}: ${formatDurationValue(point.value)}`}
                                            arrow
                                            slotProps={tooltipSlotProps}
                                        >
                                            <Box
                                                onClick={onPointClick ? event => onPointClick(point, event) : undefined}
                                                onContextMenu={onDateContextMenu ? event => {
                                                    event.preventDefault();
                                                    event.stopPropagation();
                                                    onDateContextMenu(point.date, event);
                                                } : undefined}
                                                sx={{
                                                    width: comparisonDefinition ? 'clamp(3px, 12%, 5px)' : '100%',
                                                    height: comparisonDefinition ? `${primaryHeight}%` : '100%',
                                                    minHeight: comparisonDefinition ? 3 : undefined,
                                                    display: 'flex',
                                                    alignItems: 'flex-end',
                                                    justifyContent: 'center',
                                                    position: 'relative',
                                                    cursor: onPointClick ? 'pointer' : 'default',
                                                    '&:hover > .duration-bar': { filter: 'brightness(1.16)' },
                                                }}
                                            >
                                                <Box
                                                    className="duration-bar"
                                                    sx={{
                                                        width: comparisonDefinition ? '100%' : 'clamp(3px, 14%, 6px)',
                                                        height: comparisonDefinition ? '100%' : `${primaryHeight}%`,
                                                        minHeight: 3,
                                                        borderRadius: '6px 6px 1px 1px',
                                                        bgcolor: primaryColor,
                                                        transition: 'filter 120ms ease',
                                                    }}
                                                />
                                            </Box>
                                        </MuiTooltip>
                                    )}
                                    {comparisonDefinition && point.comparisonValue !== undefined && (
                                        <MuiTooltip
                                            title={`${format(parseISO(point.date), 'EEEE, MMM d')}: ${formatDurationValue(point.comparisonValue)}`}
                                            arrow
                                            slotProps={tooltipSlotProps}
                                        >
                                            <Box sx={{
                                                width: 'clamp(3px, 12%, 5px)',
                                                height: `${comparisonHeight}%`,
                                                minHeight: 3,
                                                borderRadius: '6px 6px 1px 1px',
                                                bgcolor: comparisonColor,
                                            }} />
                                        </MuiTooltip>
                                    )}
                                    <Typography
                                        variant="caption"
                                        color="text.secondary"
                                        sx={{ position: 'absolute', top: 'calc(100% + 4px)', left: '50%', transform: 'translateX(-50%)', fontSize: 10, whiteSpace: 'nowrap' }}
                                    >
                                        {format(parseISO(point.date), 'EEE')}
                                    </Typography>
                                </Box>
                            );
                        })}
                    </Box>
                </Box>
            </Box>
        </Box>
    );
}

function DurationTrend({ definition, comparisonDefinition, points, dateRange, theme }: Omit<Props, 'onPointClick'>) {
    const primaryColor = theme.palette.primary.main;
    const comparisonColor = theme.palette.secondary.main;
    const axis = durationAxis(chartMaximum(definition, points));
    const maximum = axis.maximum;
    const target = targetValue(definition);
    const gradientId = `duration-gradient-${definition.id.replace(/[^a-zA-Z0-9_-]/g, '')}`;

    return (
        <Box sx={{ height: 220 }}>
            <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={points} margin={{ top: 12, right: 12, left: 10, bottom: 5 }}>
                    <defs>
                        <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
                            <stop offset="5%" stopColor={primaryColor} stopOpacity={0.35} />
                            <stop offset="95%" stopColor={primaryColor} stopOpacity={0.02} />
                        </linearGradient>
                    </defs>
                    <CartesianGrid vertical={false} stroke={theme.palette.divider} strokeDasharray="3 3" />
                    <XAxis
                        dataKey="date"
                        tickFormatter={value => format(parseISO(value), points.length >= 50 ? 'MMM' : 'MMM d')}
                        padding={{ left: 6, right: 6 }}
                        minTickGap={points.length >= 50 ? 26 : 18}
                        tick={{ fontSize: 10, fill: theme.palette.text.secondary }}
                        tickLine={false}
                        axisLine={{ stroke: theme.palette.divider }}
                    />
                    <YAxis
                        domain={[0, maximum]}
                        ticks={axis.ticks}
                        tickFormatter={value => formatDurationAxisValue(value)}
                        width={52}
                        tick={{ fontSize: 10, fill: theme.palette.text.secondary }}
                        tickLine={false}
                        axisLine={false}
                    />
                    <Tooltip
                        labelFormatter={(value, payload) => payload[0]?.payload?.bucketLabel ?? format(parseISO(String(value)), 'EEEE, MMM d')}
                        content={tooltipProps => (
                            <StatChartTooltip
                                {...tooltipProps}
                                theme={theme}
                                valueFormatter={value => formatDurationValue(value)}
                            />
                        )}
                    />
                    {target !== undefined && (
                        <ReferenceLine
                            y={target}
                            stroke={theme.palette.success.main}
                            strokeDasharray="6 3"
                            label={{
                                value: formatDurationValue(target),
                                fill: theme.palette.success.main,
                                content: labelProps => (
                                    <DurationThresholdLabel
                                        {...labelProps}
                                        backgroundColor={theme.palette.background.paper}
                                    />
                                ),
                            }}
                        />
                    )}
                    <Area
                        type="monotone"
                        dataKey="value"
                        name={definition.name}
                        stroke={primaryColor}
                        strokeWidth={2.25}
                        fill={`url(#${gradientId})`}
                        dot={dateRange >= 365 ? false : { r: 3, fill: primaryColor }}
                        activeDot={{ r: 5 }}
                        connectNulls={true}
                        isAnimationActive={false}
                    />
                    {comparisonDefinition && (
                        <Area
                            type="monotone"
                            dataKey="comparisonValue"
                            name={comparisonDefinition.name}
                            stroke={comparisonColor}
                            strokeWidth={2}
                            fill="transparent"
                            dot={dateRange >= 365 ? false : { r: 3, fill: comparisonColor }}
                            activeDot={{ r: 5 }}
                            connectNulls={true}
                            isAnimationActive={false}
                        />
                    )}
                </AreaChart>
            </ResponsiveContainer>
        </Box>
    );
}

export function DurationStatChart(props: Props) {
    return props.dateRange <= 7
        ? <SevenDayDurationBars {...props} />
        : <DurationTrend {...props} />;
}
