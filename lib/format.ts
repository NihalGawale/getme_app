// Formats a `created_at` timestamp as "Member since <Month Year>" text,
// e.g. "July 2026". Returns null when there's no date to show.
export function formatMemberSince(
  dateString: string | null | undefined,
): string | null {
  if (!dateString) return null;
  return new Date(dateString).toLocaleDateString("en-IN", {
    month: "long",
    year: "numeric",
  });
}
