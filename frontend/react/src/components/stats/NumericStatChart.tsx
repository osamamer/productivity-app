import { Box, Tooltip as MuiTooltip, Typography } from '@mui/material';
import { Theme } from '@mui/material/styles';
import { format, parseISO } from 'date-fns';
import { StatDefinition } from '../../types/Stats';
import { StatChartPoint, StatChartPointClickEvent } from './statChartTypes';

interface Props {
    definition: StatDefinition;
    comparisonDefinition?: StatDefinition;
    points: StatChartPoint[];
    dateRange: number;
    theme: Theme;
    onPointClick?: (point: StatChartPoint, event: StatChartPointClickEvent) => void;
    onDateContextMenu?: (date: string, event: React.MouseEvent<Element>) => void;
}

type NumericDomain = [number, number];

function targetValue(definition: StatDefinition): number | undefined {
    const target = definition.goodThreshold;
    return target != null
        && Number.isFinite(target)
        && definition.morality !== undefined
        && definition.morality !== 'NEUTRAL'
        ? target
        : undefined;
}

function formatNumericValue(value: number): string {
    return Number.isInteger(value) ? String(value) : Number(value.toFixed(2)).toString();
}

function paddedDomain(minimum: number, maximum: number): NumericDomain {
    const span = maximum - minimum;
    const padding = span === 0
        ? Math.max(Math.abs(maximum) * 0.1, 1)
        : span * 0.1;
    return [minimum - padding, maximum + padding];
}

function niceTickStep(range: number, targetTickCount = 5): number {
    const rawStep = range / targetTickCount;
    const magnitude = 10 ** Math.floor(Math.log10(rawStep));
    const normalizedStep = rawStep / magnitude;
    const multiplier = normalizedStep < Math.sqrt(2)
        ? 1
        : normalizedStep < Math.sqrt(10)
            ? 2
            : normalizedStep < Math.sqrt(50)
                ? 5
                : 10;
    return multiplier * magnitude;
}

function roundTick(value: number, step: number): number {
    const decimalPlaces = Math.max(0, Math.ceil(-Math.log10(step)) + 2);
    return Number(value.toFixed(decimalPlaces));
}

function chartDomain(definition: StatDefinition, points: StatChartPoint[]): NumericDomain {
    const values = points
        .flatMap(point => [point.value, point.comparisonValue])
        .filter((value): value is number => value !== undefined && Number.isFinite(value));
    if (definition.type === 'RANGE') {
        if (definition.minValue != null && Number.isFinite(definition.minValue)) values.push(definition.minValue);
        if (definition.maxValue != null && Number.isFinite(definition.maxValue)) values.push(definition.maxValue);
    }
    const target = targetValue(definition);
    if (target !== undefined) values.push(target);

    if (values.length === 0) return [0, 1];

    const minimum = Math.min(...values);
    const maximum = Math.max(...values);
    if (minimum >= 0) {
        if (maximum === 0) return [0, 1];
        const paddedMaximum = maximum * 1.1;
        const step = niceTickStep(paddedMaximum);
        const nextNiceTick = Math.ceil(maximum / step) * step;
        return [0, Math.max(paddedMaximum, nextNiceTick + step * 0.1)];
    }
    if (maximum <= 0) {
        const paddedMinimum = minimum * 1.1;
        const step = niceTickStep(Math.abs(paddedMinimum));
        const nextNiceTick = Math.floor(minimum / step) * step;
        return [Math.min(paddedMinimum, nextNiceTick - step * 0.1), 0];
    }
    return paddedDomain(minimum, maximum);
}

function axisTicks(domain: NumericDomain): number[] {
    const [minimum, maximum] = domain;
    const step = niceTickStep(maximum - minimum);
    const firstIndex = Math.ceil(minimum / step - 1e-9);
    const lastIndex = Math.floor(maximum / step + 1e-9);
    const ticks = Array.from(
        { length: Math.max(0, lastIndex - firstIndex + 1) },
        (_, index) => roundTick((firstIndex + index) * step, step),
    );

    return [...new Set(ticks)].sort((left, right) => left - right);
}

function valuePosition(value: number, domain: NumericDomain): number {
    return (value - domain[0]) / (domain[1] - domain[0]) * 100;
}

function NumericBar({
    point,
    value,
    color,
    domain,
    width,
    onPointClick,
    onDateContextMenu,
}: {
    point: StatChartPoint;
    value: number;
    color: string;
    domain: NumericDomain;
    width: string;
    onPointClick?: (point: StatChartPoint, event: StatChartPointClickEvent) => void;
    onDateContextMenu?: (date: string, event: React.MouseEvent<Element>) => void;
}) {
    const zeroBottom = valuePosition(0, domain);
    const valueBottom = valuePosition(value, domain);
    const positive = value >= 0;
    const height = Math.max(3, Math.abs(value) / (domain[1] - domain[0]) * 100);

    return (
        <MuiTooltip
            title={`${format(parseISO(point.date), 'EEEE, MMM d')}: ${formatNumericValue(value)}`}
            arrow
            slotProps={{
                tooltip: {
                    sx: {
                        bgcolor: 'background.paper',
                        border: 1,
                        borderColor: 'divider',
                        borderRadius: 1,
                        boxShadow: 4,
                        color: 'text.primary',
                        fontSize: 12,
                        lineHeight: 1.35,
                        px: 1,
                        py: 0.75,
                    },
                },
                arrow: { sx: { color: 'background.paper' } },
            }}
        >
            <Box
                role={onPointClick ? 'button' : undefined}
                tabIndex={onPointClick ? 0 : undefined}
                aria-label={`${format(parseISO(point.date), 'EEEE, MMMM d')}: ${formatNumericValue(value)}`}
                onClick={onPointClick ? event => onPointClick(point, event) : undefined}
                onKeyDown={onPointClick ? event => {
                    if (event.key !== 'Enter' && event.key !== ' ') return;
                    event.preventDefault();
                    const bounds = event.currentTarget.getBoundingClientRect();
                    onPointClick(point, {
                        clientX: bounds.left + bounds.width / 2,
                        clientY: bounds.top + bounds.height / 2,
                    });
                } : undefined}
                onContextMenu={onDateContextMenu ? event => {
                    event.preventDefault();
                    event.stopPropagation();
                    onDateContextMenu(point.date, event);
                } : undefined}
                className="numeric-stat-bar"
                sx={{
                    position: 'absolute',
                    left: '50%',
                    bottom: `${positive ? zeroBottom : valueBottom}%`,
                    transform: 'translateX(-50%)',
                    width,
                    height: `${height}%`,
                    minHeight: 3,
                    borderRadius: positive ? '6px 6px 1px 1px' : '1px 1px 6px 6px',
                    bgcolor: color,
                    cursor: onPointClick ? 'pointer' : 'default',
                    transition: 'filter 120ms ease',
                    '&:hover': { filter: 'brightness(1.16)' },
                }}
            />
        </MuiTooltip>
    );
}

function SevenDayNumericBars({
    definition,
    comparisonDefinition,
    points,
    theme,
    onPointClick,
    onDateContextMenu,
}: Omit<Props, 'dateRange'>) {
    const domain = chartDomain(definition, points);
    const ticks = axisTicks(domain);
    const primaryColor = theme.palette.primary.main;
    const comparisonColor = theme.palette.secondary.main;
    const target = targetValue(definition);

    return (
        <Box aria-label={`${definition.name} for the last seven days`}>
            <Box sx={{ display: 'grid', gridTemplateColumns: '52px minmax(0, 1fr)', gap: 1 }}>
                <Box sx={{ height: 188, display: 'flex', flexDirection: 'column', justifyContent: 'space-between', alignItems: 'flex-end' }}>
                    {[...ticks].reverse().map(value => (
                        <Typography key={value} variant="caption" color="text.secondary">{formatNumericValue(value)}</Typography>
                    ))}
                </Box>
                <Box sx={{ position: 'relative', height: 188, borderBottom: 1, borderColor: 'divider' }}>
                    {ticks.map(value => (
                        <Box
                            key={value}
                            sx={{
                                position: 'absolute',
                                left: 0,
                                right: 0,
                                top: `${100 - valuePosition(value, domain)}%`,
                                borderTop: 1,
                                borderColor: 'divider',
                                opacity: 0.72,
                            }}
                        />
                    ))}
                    <Box
                        sx={{
                            position: 'absolute',
                            left: 0,
                            right: 0,
                            top: `${100 - valuePosition(0, domain)}%`,
                            borderTop: 1,
                            borderColor: 'divider',
                            opacity: 0.9,
                        }}
                    />
                    {target !== undefined && (
                        <Box
                            sx={{
                                position: 'absolute',
                                left: 0,
                                right: 0,
                                top: `${100 - valuePosition(target, domain)}%`,
                                borderTop: '2px dashed',
                                borderColor: 'success.main',
                                opacity: 0.75,
                            }}
                        />
                    )}
                    <Box sx={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'stretch', gap: 0.75, px: 0.5 }}>
                        {points.map(point => (
                            <Box
                                key={point.date}
                                sx={{
                                    minWidth: 0,
                                    flex: 1,
                                    height: '100%',
                                    position: 'relative',
                                    display: 'flex',
                                    justifyContent: 'center',
                                    gap: comparisonDefinition ? 0.35 : 0,
                                }}
                            >
                                {point.value !== undefined && (
                                    <Box sx={{ position: 'relative', width: comparisonDefinition ? 'clamp(3px, 12%, 5px)' : '100%', height: '100%' }}>
                                        <NumericBar
                                            point={point}
                                            value={point.value}
                                            color={primaryColor}
                                            domain={domain}
                                            width={comparisonDefinition ? '100%' : 'clamp(3px, 14%, 6px)'}
                                            onPointClick={onPointClick}
                                            onDateContextMenu={onDateContextMenu}
                                        />
                                    </Box>
                                )}
                                {comparisonDefinition && point.comparisonValue !== undefined && (
                                    <Box sx={{ position: 'relative', width: 'clamp(3px, 12%, 5px)', height: '100%' }}>
                                        <NumericBar
                                            point={point}
                                            value={point.comparisonValue}
                                            color={comparisonColor}
                                            domain={domain}
                                            width="100%"
                                        />
                                    </Box>
                                )}
                                <Typography
                                    variant="caption"
                                    color="text.secondary"
                                    sx={{ position: 'absolute', top: 'calc(100% + 4px)', left: '50%', transform: 'translateX(-50%)', fontSize: 10, whiteSpace: 'nowrap' }}
                                >
                                    {format(parseISO(point.date), 'EEE')}
                                </Typography>
                            </Box>
                        ))}
                    </Box>
                </Box>
            </Box>
        </Box>
    );
}

export function NumericStatChart(props: Props) {
    return <SevenDayNumericBars {...props} />;
}
