import React, { useEffect, useState } from 'react';
import { Box, InputBase, Typography, useTheme, alpha } from '@mui/material';
import StarRoundedIcon from '@mui/icons-material/StarRounded';
import StarOutlineRoundedIcon from '@mui/icons-material/StarOutlineRounded';
import StarHalfRoundedIcon from '@mui/icons-material/StarHalfRounded';
import { DayEntity } from '../types/DayEntity';
import { dayService } from '../services/api';
import planIcon from '../assets/images/walk.png';
import summaryIcon from '../assets/images/summary.png';

// ─── geometry ────────────────────────────────────────────────────────────────

// CSS rotation of the icon+stars container toward the page center.
// Negative = counter-clockwise; the widget is top-right so -35° faces left-down.
const hour = new Date().getHours();
const isDay = hour >= 6 && hour <= 20;
const ROTATION_DEG = isDay ? 45 : 0;


const CX = 88;          // center x of the icon SVG (container width = CX*2 = 176)
const CY = 58;          // center y of the icon SVG

const SUN_R = 20;
const RAY_INNER = 27;
const RAY_OUTER = 37;

const MOON_R = 24;
const MASK_DX = 12;     // crescent mask offset from CX
const MASK_DY = -10;    // crescent mask offset from CY
const MASK_R = 19;

const ORBIT_R = 58;              // orbit radius for stars
const STAR_ICON_SIZE = 24;       // MUI icon fontSize in px
const STAR_HIT_PAD = 8;         // extra hit-box padding on each side

// Arc: 5 stars from lower-left (220°) to lower-right (140°), rating 1 → 5.
// Convention: 0° = top, clockwise positive.
// x = CX + r·sin(θ),  y = CY − r·cos(θ)
const STAR_DEFS = [220, 200, 180, 160, 140].map((deg, i) => {
    const rad = (deg * Math.PI) / 180;
    return {
        rating: i + 1,
        angleDeg: deg,
        x: CX + ORBIT_R * Math.sin(rad),
        y: CY - ORBIT_R * Math.cos(rad),
    };
});

const SUN_RAYS = Array.from({ length: 8 }, (_, i) => {
    const a = (i * 45 * Math.PI) / 180;
    return {
        x1: CX + RAY_INNER * Math.cos(a), y1: CY + RAY_INNER * Math.sin(a),
        x2: CX + RAY_OUTER * Math.cos(a), y2: CY + RAY_OUTER * Math.sin(a),
    };
});

// Height that fits the lowest star (at 180°, y = CY + ORBIT_R) plus padding
const CONTAINER_H = CY + ORBIT_R + STAR_ICON_SIZE / 2 + STAR_HIT_PAD + 4;

// ─── half-star detection ──────────────────────────────────────────────────────
//
// The container is rotated by ROTATION_DEG. Mouse events arrive in screen
// coordinates. To decide which half of the star was hovered we:
//   1. Compute the mouse delta from the star center in screen space.
//   2. Inverse-rotate back to container space via M^{-1} = M^T (rotate by +ROTATION_DEG).
//   3. Dot that vector against the "higher-rating" tangent direction of the arc at
//      the star's angle: d/d(−θ) of (r·sin θ, −r·cos θ) = (−cos θ, −sin θ).
//   If dot ≥ 0 the mouse is on the "higher" half → full star; else → half star.

function resolveRating(
    e: React.MouseEvent<HTMLElement>,
    starRating: number,
    starAngleDeg: number,
): number {
    const rect = e.currentTarget.getBoundingClientRect();
    const dx_s = e.clientX - (rect.left + rect.width / 2);
    const dy_s = e.clientY - (rect.top + rect.height / 2);

    const rotRad = (ROTATION_DEG * Math.PI) / 180;
    const lx = dx_s * Math.cos(rotRad) + dy_s * Math.sin(rotRad);
    const ly = -dx_s * Math.sin(rotRad) + dy_s * Math.cos(rotRad);

    const aRad = (starAngleDeg * Math.PI) / 180;
    const dot = lx * (-Math.cos(aRad)) + ly * (-Math.sin(aRad));

    return dot >= 0 ? starRating : starRating - 0.5;
}

function starState(i: number, rating: number): 'full' | 'half' | 'empty' {
    if (rating >= i) return 'full';
    if (rating >= i - 0.5) return 'half';
    return 'empty';
}

// ─── SVG sub-components ──────────────────────────────────────────────────────

function SunSvg({ sunColor, glowColor }: { sunColor: string; glowColor: string }) {
    return (
        <svg
            width={CX * 2} height={CY * 2 + 8}
            style={{ position: 'absolute', top: 0, left: 0, pointerEvents: 'none', overflow: 'visible' }}
        >
            {SUN_RAYS.map((r, i) => (
                <line key={i}
                    x1={r.x1} y1={r.y1} x2={r.x2} y2={r.y2}
                    stroke={sunColor} strokeWidth="3" strokeLinecap="round" opacity="0.8"
                />
            ))}
            {/* outer glow */}
            <circle cx={CX} cy={CY} r={SUN_R + 5} fill={glowColor} opacity="0.08" />
            {/* body */}
            <circle cx={CX} cy={CY} r={SUN_R} fill={sunColor} />
            {/* shine highlight */}
            <circle cx={CX - 6} cy={CY - 6} r={5} fill="rgba(255,255,255,0.28)" />
        </svg>
    );
}

function MoonSvg({ bgColor, moonColor, glowColor }: { bgColor: string; moonColor: string; glowColor: string }) {
    return (
        <svg
            width={CX * 2} height={CY * 2 + 8}
            style={{ position: 'absolute', top: 0, left: 0, pointerEvents: 'none', overflow: 'visible' }}
        >
            {/* outer glow */}
            <circle cx={CX} cy={CY} r={MOON_R + 5} fill={glowColor} opacity="0.09" />
            {/* moon body */}
            <circle cx={CX} cy={CY} r={MOON_R} fill={moonColor} />
            {/* crescent mask — must exactly match page background */}
            <circle cx={CX + MASK_DX} cy={CY + MASK_DY} r={MASK_R} fill={bgColor} />
        </svg>
    );
}

// ─── main component ──────────────────────────────────────────────────────────

export function DayWidget() {
    const theme = useTheme();

    const [today, setToday] = useState<DayEntity | null>(null);
    const [hoveredRating, setHoveredRating] = useState<number | null>(null);
    const [localPlan, setLocalPlan] = useState('');
    const [localSummary, setLocalSummary] = useState('');

    useEffect(() => {
        dayService.getToday()
            .then(data => {
                setToday(data);
                setLocalPlan(data.plan ?? '');
                setLocalSummary(data.summary ?? '');
            })
            .catch(e => console.error('DayWidget: failed to fetch today:', e));
    }, []);

    async function saveUpdate(partial: { rating?: number; plan?: string; summary?: string }) {
        if (!today) return;
        const next = {
            rating: partial.rating ?? today.rating ?? 0,
            plan:   partial.plan   ?? today.plan   ?? '',
            summary: partial.summary ?? today.summary ?? '',
        };
        try {
            await dayService.setTodayInfo(next.rating, next.plan, next.summary);
            setToday(prev => prev ? { ...prev, ...next } : prev);
        } catch (e) {
            console.error('DayWidget: failed to save:', e);
        }
    }

    const activeRating = hoveredRating ?? today?.rating ?? 0;
    const sunColor = theme.palette.mode === 'light' ? '#F4B400' : '#FFD600';
    const sunGlowColor = theme.palette.mode === 'light' ? '#F6C453' : '#FFD600';
    const nightColor = theme.palette.mode === 'light' ? '#64748B' : '#CBD5E1';
    const starFillColor = isDay ? sunColor : nightColor;
    const starGlow = isDay
        ? theme.palette.mode === 'light'
            ? 'drop-shadow(0 0 4px rgba(244,180,0,0.35))'
            : 'drop-shadow(0 0 4px rgba(255,214,0,0.65))'
        : theme.palette.mode === 'light'
            ? 'drop-shadow(0 0 4px rgba(100,116,139,0.4))'
            : 'drop-shadow(0 0 4px rgba(203,213,225,0.55))';
    const bgColor = theme.palette.background.default;

    const inputSx = {
        flex: 1,
        fontSize: '0.78rem',
        lineHeight: 1.5,
        '& .MuiInputBase-input': {
            textAlign: 'center' as const,
            color: theme.palette.text.secondary,
            '&::placeholder': {
                color: alpha(theme.palette.text.primary, 0.25),
                opacity: 1,
            },
        },
    };

    const infoRowSx = {
        width: '100%',
        display: 'flex',
        alignItems: 'center',
        gap: 1,
    };

    const infoIconSx = {
        width: 18,
        height: 18,
        opacity: 0.5,
        flexShrink: 0,
        filter: theme.palette.mode === 'dark' ? 'brightness(0) invert(1)' : 'none',
    };

    return (
        <Box
            sx={{
                position: 'absolute',
                top: 20,
                right: 15,
                width: 200,
                display: { xs: 'none', lg: 'flex' },
                flexDirection: 'column',
                alignItems: 'center',
                gap: 1,
            }}
        >
            {/* Icon + orbiting stars — rotated together toward the page center */}
            <Box
                sx={{
                    transform: `rotate(${ROTATION_DEG}deg)`,
                    position: 'relative',
                    width: CX * 2,
                    height: CONTAINER_H,
                }}
            >
                {isDay ? <SunSvg sunColor={sunColor} glowColor={sunGlowColor} /> : <MoonSvg bgColor={bgColor} moonColor={nightColor} glowColor={nightColor} />}

                {STAR_DEFS.map(({ rating, angleDeg, x, y }) => {
                    const state = starState(rating, activeRating);
                    const Icon =
                        state === 'full'  ? StarRoundedIcon :
                        state === 'half'  ? StarHalfRoundedIcon :
                                            StarOutlineRoundedIcon;
                    const lit = state !== 'empty';

                    return (
                        <Box
                            key={rating}
                            onMouseMove={e => setHoveredRating(resolveRating(e, rating, angleDeg))}
                            onMouseLeave={() => setHoveredRating(null)}
                            onClick={e => saveUpdate({ rating: resolveRating(e, rating, angleDeg) })}
                            sx={{
                                position: 'absolute',
                                left: x - STAR_ICON_SIZE / 2 - STAR_HIT_PAD,
                                top:  y - STAR_ICON_SIZE / 2 - STAR_HIT_PAD,
                                width:  STAR_ICON_SIZE + STAR_HIT_PAD * 2,
                                height: STAR_ICON_SIZE + STAR_HIT_PAD * 2,
                                cursor: 'pointer',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                transition: 'transform 0.12s',
                                '&:hover': { transform: 'scale(1.28)' },
                            }}
                        >
                            <Icon
                                sx={{
                                    fontSize: STAR_ICON_SIZE,
                                    color: lit
                                        ? starFillColor
                                        : alpha(theme.palette.text.primary, 0.18),
                                    filter: lit ? starGlow : 'none',
                                    transition: 'color 0.1s, filter 0.1s',
                                    pointerEvents: 'none',
                                }}
                            />
                        </Box>
                    );
                })}
            </Box>

            {/* Rating label — outside the rotated element so text stays upright.
                Holds its space even when invisible to prevent layout jump. */}
            <Typography
                variant="caption"
                sx={{
                    color: 'text.disabled',
                    fontSize: '0.7rem',
                    lineHeight: 1,
                    opacity: hoveredRating !== null ? 1 : 0,
                    transition: 'opacity 0.15s',
                    userSelect: 'none',
                    pointerEvents: 'none',
                }}
            >
                {hoveredRating !== null ? `${hoveredRating} / 5` : '\u00A0'}
            </Typography>

            {/* Plan */}
            <Box sx={infoRowSx}>
                <Box
                    component="img"
                    src={planIcon}
                    alt="Day plan"
                    title="Day plan"
                    sx={infoIconSx}
                />
                <InputBase
                    multiline
                    title="Day plan"
                    value={localPlan}
                    onChange={e => setLocalPlan(e.target.value)}
                    onBlur={() => {
                        if (localPlan !== (today?.plan ?? '')) saveUpdate({ plan: localPlan });
                    }}
                    placeholder="Plan your day…"
                    sx={inputSx}
                />
            </Box>

            {/* Summary */}
            <Box sx={infoRowSx}>
                <Box
                    component="img"
                    src={summaryIcon}
                    alt="Day summary"
                    title="Day summary"
                    sx={infoIconSx}
                />
                <InputBase
                    multiline
                    title="Day summary"
                    value={localSummary}
                    onChange={e => setLocalSummary(e.target.value)}
                    onBlur={() => {
                        if (localSummary !== (today?.summary ?? '')) saveUpdate({ summary: localSummary });
                    }}
                    placeholder="Summarize your day…"
                    sx={inputSx}
                />
            </Box>
        </Box>
    );
}
