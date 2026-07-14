export type ReviewClient = {
  name: string | null;
  avatar_url: string | null;
  city_id: string | null;
  cities: { name: string | null } | null;
};

// Shared shape for a `reviews` row joined with the reviewing client's `users`
// row (via `users!reviews_client_id_fkey`). `job_id` and `client_id` are
// optional because not every caller selects them.
export type Review = {
  id: string;
  vibes: string[] | null;
  note: string | null;
  created_at: string;
  job_id?: string;
  client_id?: string;
  users: ReviewClient | null;
};
