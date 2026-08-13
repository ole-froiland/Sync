type DatedEvent = {
  start: string
  end: string
  allDay?: boolean
}

function localDayStart(date: Date) {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate())
}

export function eventOccursOnDay(event: DatedEvent, day: Date) {
  const start = new Date(event.start)
  if (Number.isNaN(+start)) return false
  if (!event.allDay) {
    return start.getFullYear() === day.getFullYear()
      && start.getMonth() === day.getMonth()
      && start.getDate() === day.getDate()
  }

  const end = new Date(event.end)
  if (Number.isNaN(+end) || +end <= +start) return false
  const dayStart = localDayStart(day)
  return +dayStart >= +localDayStart(start) && +dayStart < +end
}
