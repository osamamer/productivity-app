import { Alert, Box, Button, Typography } from '@mui/material';
import { useMemo, useState } from 'react';
import { PageWrapper } from '../components/PageWrapper';
import { PathEditorDialog } from '../components/paths/PathEditorDialog';
import { PathsHeader } from '../components/paths/PathsHeader';
import { PathsVortex } from '../components/paths/PathsVortex';
import { sortRoads } from '../components/paths/pathsSummary';
import { timeScale } from '../components/paths/roadLayout';
import { usePathsOverview } from '../hooks/usePathsOverview';
import { pathService } from '../services/api/pathService';
import { loadPathsOverview } from '../services/cache/pathsOverviewCache';
import type { Path, PathView } from '../types/Path';

type Editing = { path: Path | null } | null;

/** Paths: each long-running area of life as a road, past weeks below today, coloured by its signal. */
export function PathsPage() {
    const { overview, today, error, mutate } = usePathsOverview();
    const [editing, setEditing] = useState<Editing>(null);
    const [saveError, setSaveError] = useState<string | null>(null);
    const roads = useMemo(() => (overview ? sortRoads(overview.paths, overview.view.sort) : []), [overview]);
    const scale = useMemo(() => {
        const weeks = overview?.paths[0]?.weeks;
        const currentWeekStart = weeks?.[weeks.length - 1]?.weekStart;
        return currentWeekStart ? timeScale(currentWeekStart, weeks.length) : null;
    }, [overview]);

    const reload = async () => {
        const fresh = await loadPathsOverview(today);
        mutate(() => fresh);
    };

    const changeView = (change: Partial<PathView>) => {
        mutate(current => ({ ...current, view: { ...current.view, ...change } }));
        pathService.updateView(change).catch(viewError => {
            console.error('Could not save the Paths view:', viewError);
            setSaveError('Could not save that switch.');
        });
    };

    const reorder = (pathIds: string[]) => {
        mutate(current => ({
            ...current,
            paths: current.paths.map(road => ({ ...road, path: { ...road.path, displayOrder: pathIds.indexOf(road.path.id) } })),
        }));
        pathService.reorder(pathIds).catch(orderError => {
            console.error('Could not save the path order:', orderError);
            setSaveError('Could not save the new order.');
        });
    };

    const saved = () => {
        setEditing(null);
        reload().catch(reloadError => console.error('Could not reload paths:', reloadError));
    };

    return (
        <PageWrapper>
            <Box sx={{ width: '100%', mx: 'auto', py: { xs: 2, md: 3 }, textAlign: 'left', display: 'flex', flexDirection: 'column', minHeight: 0 }}>
                {overview && roads.length > 0 && (
                    <PathsHeader roads={roads} view={overview.view} onViewChange={changeView} onCreate={() => setEditing({ path: null })} />
                )}
                {(!overview || roads.length === 0) && <Typography variant="h4" fontWeight={750} sx={{ letterSpacing: '-0.03em', mb: 2 }}>Paths</Typography>}
                {(error || saveError) && <Alert severity="error" sx={{ mb: 1.5 }} onClose={saveError ? () => setSaveError(null) : undefined}>{saveError ?? error}</Alert>}
                {overview && roads.length === 0 && (
                    <Box sx={{ borderRadius: 4, background: '#050507', color: '#F4F2FF', p: { xs: 3, md: 6 }, textAlign: 'center' }}>
                        <Typography variant="h6" fontWeight={750}>Start your first path</Typography>
                        <Typography sx={{ color: 'rgba(244,242,255,0.65)', maxWidth: 460, mx: 'auto', mt: 1 }}>
                            A path is a long-running area of your life, like Writer or Body. Its road is coloured each week by stats you already log.
                        </Typography>
                        <Button variant="contained" sx={{ mt: 3, textTransform: 'none', fontWeight: 700 }} onClick={() => setEditing({ path: null })}>
                            New path
                        </Button>
                    </Box>
                )}
                {overview && scale && roads.length > 0 && (
                    <PathsVortex roads={roads} scale={scale} view={overview.view}
                                 onOpenPath={path => setEditing({ path })} onReorder={reorder} />
                )}
                {overview && roads.length > 0 && (
                    <Typography variant="caption" color="text.secondary" sx={{ mt: 1.5 }}>
                        Below today each road is in its path’s colour: bright in weeks you kept the rhythm, greyer and fainter in weeks you didn’t.
                        The centre line has one dash per week; hover a dash to see its week.
                    </Typography>
                )}
            </Box>
            {editing && (
                <PathEditorDialog path={editing.path} existingPaths={overview?.paths.length ?? 0} today={today}
                                  onClose={() => setEditing(null)} onSaved={saved} />
            )}
        </PageWrapper>
    );
}

export default PathsPage;
