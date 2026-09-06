import { Box, Typography } from '@mui/material';
import { Theme } from '@mui/material/styles';
import { format, parseISO } from 'date-fns';
import React, { useRef, useState } from 'react';
import {
    Area,
    AreaChart,
    CartesianGrid,
    ResponsiveContainer,
    Tooltip,
    XAxis,
    YAxis,
} from 'recharts';
import { StatDefinition } from '../../types/Stats';
import {
    formatTimeValue,
    timeDisplayScaleMaximum,
    timeDisplayScaleTicks,
    timeValueFromDisplayScale,
    timeValueToDisplayScale,
    usesBedtimeScale,
} from '../../services/utils/statValues';
import { StatChartPoint, StatChartPointClickEvent } from './statChartTypes';
import { StatChartTooltip } from './StatChartTooltip';

const DENSITY_SAMPLE_STEP = 30;
const DENSITY_BANDWIDTH = 50;

interface Props {
    definition: StatDefinition;
    comparisonDefinition?: StatDefinition;
    points: StatChartPoint[];
    dateRange: number;
    theme: Theme;
    onPointClick: (point: StatChartPoint, event: StatChartPointClickEvent) => void;
}

function axisLabel(definition: StatDefinition, scaleValue: number): string {
    const clockValue = timeValueFromDisplayScale(definition, scaleValue);
    return formatTimeValue(clockValue);
}

function SevenDayTimingPlot({
    definition,
    points,
    color,
    theme,
    onPointClick,
}: {
    definition: StatDefinition;
    points: StatChartPoint[];
    color: string;
    theme: Theme;
    onPointClick?: (point: StatChartPoint, event: StatChartPointClickEvent) => void;
}) {
    const svgRef = useRef<SVGSVGElement>(null);
    const [hoveredPoint, setHoveredPoint] = useState<{ point: StatChartPoint; left: number; top: number } | null>(null);
    const width = 760;
    const left = 68;
    const right = 18;
    const top = 30;
    const rowHeight = 31;
    const bottom = 10;
    const height = top + points.length * rowHeight + bottom;
    const plotWidth = width - left - right;
    const scaleMaximum = timeDisplayScaleMaximum(definition);
    const timeTicks = timeDisplayScaleTicks(definition);
    const xForScale = (value: number) => left + value / scaleMaximum * plotWidth;
    const xForValue = (value: number) => xForScale(timeValueToDisplayScale(definition, value));
    const yForIndex = (index: number) => top + index * rowHeight + rowHeight / 2;
    const gridColor = theme.palette.divider;
    const mutedColor = theme.palette.text.secondary;

    const updateHoveredPoint = (point: StatChartPoint, clientX: number, clientY: number) => {
        const svg = svgRef.current;
        if (!svg) return;
        const bounds = svg.getBoundingClientRect();
        setHoveredPoint({
            point,
            left: clientX - bounds.left,
            top: clientY - bounds.top,
        });
    };

    return (
        <Box>
            <Box sx={{ position: 'relative' }}>
                <Box
                    component="svg"
                    ref={svgRef}
                    viewBox={`0 0 ${width} ${height}`}
                    role="img"
                    aria-label={`${definition.name} for the last seven days`}
                    onMouseLeave={() => setHoveredPoint(null)}
                    sx={{ width: '100%', height: 'auto', display: 'block', overflow: 'visible' }}
                >
                <rect
                    x={left}
                    y={top}
                    width={plotWidth}
                    height={points.length * rowHeight}
                    rx={8}
                    fill={theme.palette.mode === 'dark' ? 'rgba(255,255,255,0.025)' : 'rgba(15,23,42,0.018)'}
                />
                {timeTicks.map(tick => (
                    <g key={tick}>
                        <line
                            x1={xForScale(tick)}
                            x2={xForScale(tick)}
                            y1={top}
                            y2={top + points.length * rowHeight}
                            stroke={gridColor}
                            strokeWidth={tick === 0 || tick === scaleMaximum ? 1.25 : 1}
                        />
                        <text
                            x={xForScale(tick)}
                            y={18}
                            textAnchor={tick === 0 ? 'start' : tick === scaleMaximum ? 'end' : 'middle'}
                            fill={mutedColor}
                            fontSize={10}
                        >
                            {axisLabel(definition, tick)}
                        </text>
                    </g>
                ))}
                {points.map((point, index) => {
                    const y = yForIndex(index);
                    return (
                        <g key={`row-${point.date}`}>
                            {index > 0 && (
                                <line x1={left} x2={width - right} y1={y - rowHeight / 2} y2={y - rowHeight / 2} stroke={gridColor} strokeOpacity={0.55} />
                            )}
                            <text x={0} y={y + 4} fill={mutedColor} fontSize={10}>
                                {format(parseISO(point.date), 'EEE d')}
                            </text>
                        </g>
                    );
                })}
                {points.map((point, index) => point.value === undefined ? null : (
                    <g
                        key={`point-${point.date}`}
                        role={onPointClick ? 'button' : undefined}
                        aria-label={`${format(parseISO(point.date), 'EEEE, MMMM d')}: ${formatTimeValue(point.value)}`}
                        tabIndex={onPointClick ? 0 : undefined}
                        onClick={onPointClick ? event => onPointClick(point, event) : undefined}
                        onMouseEnter={event => updateHoveredPoint(point, event.clientX, event.clientY)}
                        onMouseMove={event => updateHoveredPoint(point, event.clientX, event.clientY)}
                        onMouseLeave={() => setHoveredPoint(null)}
                        onFocus={event => {
                            const bounds = event.currentTarget.getBoundingClientRect();
                            updateHoveredPoint(point, bounds.left + bounds.width / 2, bounds.top);
                        }}
                        onKeyDown={onPointClick ? event => {
                            if (event.key === 'Enter' || event.key === ' ') {
                                event.preventDefault();
                                const bounds = event.currentTarget.getBoundingClientRect();
                                onPointClick(point, {
                                    clientX: bounds.left + bounds.width / 2,
                                    clientY: bounds.top + bounds.height / 2,
                                });
                            }
                        } : undefined}
                        style={{ cursor: onPointClick ? 'pointer' : 'default' }}
                    >
                        <circle cx={xForValue(point.value)} cy={yForIndex(index)} r={10} fill="transparent" />
                        <circle
                            cx={xForValue(point.value)}
                            cy={yForIndex(index)}
                            r={4}
                            fill={color}
                        />
                    </g>
                ))}
                </Box>
                {hoveredPoint && (
                    <Box
                        sx={{
                            position: 'absolute',
                            left: hoveredPoint.left,
                            top: hoveredPoint.top,
                            transform: 'translate(-50%, calc(-100% - 10px))',
                            pointerEvents: 'none',
                            bgcolor: 'background.paper',
                            border: 1,
                            borderColor: 'divider',
                            borderRadius: 1,
                            boxShadow: theme.shadows[4],
                            px: 1.25,
                            py: 0.75,
                            whiteSpace: 'nowrap',
                            zIndex: 1,
                        }}
                    >
                        <Typography variant="caption" color="text.secondary" sx={{ display: 'block', fontWeight: 650 }}>
                            {format(parseISO(hoveredPoint.point.date), 'EEEE, MMM d')}
                        </Typography>
                        <Typography variant="caption" fontWeight={700}>
                            {definition.name}: {formatTimeValue(hoveredPoint.point.value)}
                        </Typography>
                    </Box>
                )}
            </Box>
        </Box>
    );
}

interface DensityPoint {
    scaleMinute: number;
    label: string;
    density: number;
}

function gaussianDensity(values: number[], sample: number): number {
    if (values.length === 0) return 0;
    return values.reduce((total, value) => {
        const distance = (sample - value) / DENSITY_BANDWIDTH;
        return total + Math.exp(-0.5 * distance * distance);
    }, 0) / values.length;
}

function buildDensityData(definition: StatDefinition, points: StatChartPoint[]): DensityPoint[] {
    const scaleMaximum = timeDisplayScaleMaximum(definition);
    const values = points
        .map(point => point.value)
        .filter((value): value is number => value !== undefined)
        .map(value => timeValueToDisplayScale(definition, value));

    return Array.from({ length: scaleMaximum / DENSITY_SAMPLE_STEP + 1 }, (_, index) => {
        const scaleMinute = index * DENSITY_SAMPLE_STEP;
        return {
            scaleMinute,
            label: axisLabel(definition, scaleMinute),
            density: gaussianDensity(values, scaleMinute),
        };
    });
}

function TimeDensityPlot({
    definition,
    points,
    color,
    theme,
}: {
    definition: StatDefinition;
    points: StatChartPoint[];
    color: string;
    theme: Theme;
}) {
    const densityData = buildDensityData(definition, points);
    const entryCount = points.filter(point => point.value !== undefined).length;
    const gradientId = `time-density-${definition.id.replace(/[^a-zA-Z0-9_-]/g, '')}`;
    const scaleMaximum = timeDisplayScaleMaximum(definition);
    const timeTicks = timeDisplayScaleTicks(definition);

    return (
        <Box>
            <Typography variant="caption" color="text.secondary" sx={{ display: 'block', textAlign: 'right', mb: 0.25 }}>
                {entryCount} {usesBedtimeScale(definition) ? 'nights' : 'entries'}
            </Typography>
            <Box sx={{ height: 150 }}>
                <ResponsiveContainer width="100%" height="100%">
                    <AreaChart data={densityData} margin={{ top: 8, right: 8, left: 8, bottom: 0 }}>
                        <defs>
                            <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
                                <stop offset="0%" stopColor={color} stopOpacity={0.7} />
                                <stop offset="100%" stopColor={color} stopOpacity={0.06} />
                            </linearGradient>
                        </defs>
                        <CartesianGrid vertical={true} horizontal={false} stroke={theme.palette.divider} strokeOpacity={0.7} />
                        <XAxis
                            dataKey="scaleMinute"
                            type="number"
                            domain={[0, scaleMaximum]}
                            ticks={timeTicks}
                            tickFormatter={value => axisLabel(definition, value)}
                            tick={{ fontSize: 10, fill: theme.palette.text.secondary }}
                            tickLine={false}
                            axisLine={{ stroke: theme.palette.divider }}
                        />
                        <YAxis hide domain={[0, 'auto']} />
                        <Tooltip
                            cursor={{ stroke: theme.palette.text.secondary, strokeWidth: 1 }}
                            labelFormatter={(_, payload) => payload[0]?.payload?.label ?? ''}
                            content={tooltipProps => (
                                <StatChartTooltip
                                    {...tooltipProps}
                                    theme={theme}
                                    valueFormatter={() => null}
                                />
                            )}
                        />
                        <Area
                            type="monotone"
                            dataKey="density"
                            name={definition.name}
                            stroke={color}
                            strokeWidth={2}
                            fill={`url(#${gradientId})`}
                            dot={false}
                            activeDot={{ r: 4 }}
                            isAnimationActive={false}
                        />
                    </AreaChart>
                </ResponsiveContainer>
            </Box>
        </Box>
    );
}

export function TimeStatChart({ definition, comparisonDefinition, points, dateRange, theme, onPointClick }: Props) {
    const primaryColor = theme.palette.primary.main;
    const comparisonColor = theme.palette.secondary.main;
    const comparisonPoints = points.map(point => ({ ...point, value: point.comparisonValue }));

    if (dateRange <= 7) {
        return (
            <Box sx={{ display: 'grid', gap: comparisonDefinition ? 2 : 0 }}>
                <SevenDayTimingPlot definition={definition} points={points} color={primaryColor} theme={theme} onPointClick={onPointClick} />
                {comparisonDefinition && (
                    <SevenDayTimingPlot definition={comparisonDefinition} points={comparisonPoints} color={comparisonColor} theme={theme} />
                )}
            </Box>
        );
    }

    return (
        <Box sx={{ display: 'grid', gap: comparisonDefinition ? 1.75 : 0 }}>
            <TimeDensityPlot definition={definition} points={points} color={primaryColor} theme={theme} />
            {comparisonDefinition && (
                <TimeDensityPlot definition={comparisonDefinition} points={comparisonPoints} color={comparisonColor} theme={theme} />
            )}
        </Box>
    );
}
