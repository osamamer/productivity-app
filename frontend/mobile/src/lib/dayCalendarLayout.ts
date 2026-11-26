import type { CalendarGridItem } from '../components/calendar/MonthCalendarGrid';

export function dayRange(date: Date): { start: Date; end: Date } {
  const start = new Date(date.getFullYear(), date.getMonth(), date.getDate());
  const end = new Date(start);
  end.setDate(end.getDate() + 1);
  return { start, end };
}

export function eventDayMinutes(startValue: string, endValue: string, date: string) {
  const start = new Date(startValue);
  const end = new Date(endValue);
  const day = new Date(`${date}T00:00:00`);
  const nextDay = new Date(day);
  nextDay.setDate(nextDay.getDate() + 1);
  const startMinute = start < day ? 0 : start.getHours() * 60 + start.getMinutes();
  const endMinute = end >= nextDay ? 1440 : end.getHours() * 60 + end.getMinutes();
  return { startMinute, endMinute };
}

export function layoutDayItems(items: CalendarGridItem[]) {
  const timed = items.filter(item => item.startMinute !== undefined).map(item => ({
    item,
    start: Math.max(0, Math.min(1439, item.startMinute!)),
    end: Math.min(1440, Math.max(item.endMinute ?? item.startMinute! + 30, item.startMinute! + 30)),
    lane: 0,
    lanes: 1,
  })).sort((a, b) => a.start - b.start || b.end - a.end || a.item.id.localeCompare(b.item.id));
  let cluster: typeof timed = [];
  let clusterEnd = 0;
  let laneEnds: number[] = [];
  const finishCluster = () => { cluster.forEach(item => { item.lanes = laneEnds.length; }); };
  timed.forEach(item => {
    if (item.start >= clusterEnd) {
      finishCluster();
      cluster = [];
      laneEnds = [];
    }
    let lane = laneEnds.findIndex(end => end <= item.start);
    if (lane < 0) lane = laneEnds.length;
    laneEnds[lane] = item.end;
    item.lane = lane;
    cluster.push(item);
    clusterEnd = Math.max(...laneEnds);
  });
  finishCluster();
  return timed;
}
