import type { TaskSeries } from '../types/models';

export function taskSeriesTimeUpdate(series: TaskSeries, scheduledValue: string) {
  const time = scheduledValue.match(/T(\d{2}:\d{2})/)?.[1];
  if (!time || !/^\d{4}-\d{2}-\d{2}T/.test(series.startDateTime)) throw new Error('Choose a valid series time.');
  return {
    startDateTime: `${series.startDateTime.slice(0, 10)}T${time}:00`,
    recurrenceFrequency: series.recurrenceFrequency,
    recurrenceEndDate: series.recurrenceEndDate,
    recurrenceInterval: series.recurrenceInterval,
    recurrenceUnit: series.recurrenceUnit,
    recurrenceDaysOfWeek: series.recurrenceDaysOfWeek,
    timeZone: series.timeZone,
    repeatSubtasks: series.repeatSubtasks,
    active: series.active,
  };
}
