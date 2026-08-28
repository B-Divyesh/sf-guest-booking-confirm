export type BookingStatus = 'requested' | 'awaiting_confirmation' | 'confirmed' | 'reschedule_requested' | 'cancelled' | 'completed';

export const statusMeta: Record<BookingStatus, { label: string; note: string; step: number }> = {
  requested: { label: 'Request received', note: 'Waiting for the owner to approve this time.', step: 1 },
  awaiting_confirmation: { label: 'Ready to confirm', note: 'The owner approved this time. Your confirmation makes it final.', step: 2 },
  confirmed: { label: 'Confirmed', note: 'Both sides have agreed to this appointment.', step: 3 },
  reschedule_requested: { label: 'New time requested', note: 'Waiting for the owner to approve the new time.', step: 1 },
  cancelled: { label: 'Cancelled', note: 'This booking is closed and the time is available again.', step: 0 },
  completed: { label: 'Complete', note: 'This appointment has finished.', step: 4 }
};

export function formatDate(iso: string, timezone: string, withZone = true): string {
  return new Intl.DateTimeFormat(undefined, {
    weekday: 'short', month: 'short', day: 'numeric', year: 'numeric',
    hour: 'numeric', minute: '2-digit', timeZone: timezone,
    ...(withZone ? { timeZoneName: 'short' } : {})
  }).format(new Date(iso));
}

export function escapeHtml(value: unknown): string {
  return String(value ?? '').replace(/[&<>'"]/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;' })[char]!);
}

export function safeTimezone(value: string): boolean {
  try { new Intl.DateTimeFormat('en', { timeZone: value }).format(); return true; } catch { return false; }
}
