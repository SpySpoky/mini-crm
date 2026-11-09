const dateTimeFormat = new Intl.DateTimeFormat("ru-RU", {
  day: "2-digit",
  month: "2-digit",
  year: "numeric",
  hour: "2-digit",
  minute: "2-digit",
});

// "09.11.2026, 14:05"
export function formatDateTime(iso: string): string {
  return dateTimeFormat.format(new Date(iso));
}
