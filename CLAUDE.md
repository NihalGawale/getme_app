@AGENTS.md

# GetMe — Project Documentation

GetMe is a React Native mobile marketplace app that connects clients with local freelancers. Clients browse and message freelancers; freelancers build a public profile with skills, bio, and portfolio images.

---

## Tech Stack

| Layer | Technology |
|---|---|
| Framework | Expo 54 / React Native 0.81.5 / React 19.1.0 |
| Language | TypeScript 5.9.2 |
| Routing | Expo Router 6 (file-based) |
| Backend | Supabase (Postgres + Auth + Realtime) |
| Auth | Supabase Phone OTP (SMS) |
| Media | Cloudinary (image uploads) |
| Icons | Feather (`@expo/vector-icons`) for UI components · Phosphor (`phosphor-react-native`) for home tab · Ionicons (`@expo/vector-icons`) for messages/profile tabs |
| Fonts | DM Sans (body), Plus Jakarta Sans (display) |
| Notifications | Expo Notifications + Expo Device |
| Analytics | PostHog (`posthog-react-native`) via `lib/posthog.ts` |
| Gestures | react-native-gesture-handler + react-native-reanimated (portfolio lightbox, pinch-zoom) |
| Animations | react-native-confetti-cannon (hire celebration) |
| Offline | @react-native-community/netinfo (`OfflineBanner`) |

---

## Project Structure

```
app/
  _layout.tsx                  Root layout — GestureHandlerRootView, AuthProvider, fonts, OfflineBanner, push notification setup
  index.tsx                    Auth gate — routes to (auth), (onboarding), or (tabs); 5s timeout fallback
  (auth)/
    _layout.tsx
    index.tsx                  Splash / intro screen
    role.tsx                   Role selection (client / freelancer) + T&C checkbox
    phone.tsx                  Phone number input (+91)
    otp.tsx                    OTP verification + user creation
  (onboarding)/
    _layout.tsx
    client-details.tsx         Client name + city (required) + email (optional)
    freelancer-profile.tsx     Full freelancer profile setup
  (tabs)/
    _layout.tsx                Tab bar with unread badge (polls every 2s)
    index.tsx                  Home / freelancer discovery feed
    messages.tsx               Conversations list
    profile.tsx                Current user's profile (view + edit)
  chat/
    [id].tsx                   1-on-1 chat screen — hire flow, job lifecycle, reviews, report/block
  freelancer/
    [id].tsx                   Freelancer public profile (dynamic route)
  client/
    [id].tsx                   Client public profile — reachable from chat header (freelancer side)

components/
  ReviewModal.tsx              Shared vibe-based review modal (used in chat and freelancer profile)
  ui/
    Avatar.tsx                 Image with initials fallback; sizes: sm/md/lg/xl
    Button.tsx                 Variants: primary / secondary / ghost / danger; loading + disabled states
    Card.tsx                   Simple bordered container; optional padding prop
    Divider.tsx                Horizontal line; optional spacing prop
    EmptyState.tsx             Emoji icon + title + subtitle + optional action button
    FeatherIcon.tsx            Typed wrapper around Feather icon set
    Input.tsx                  Labeled input with prefix, required asterisk, error, hint
    LoadingScreen.tsx          Centered spinner (full screen)
    OfflineBanner.tsx          netinfo connectivity banner; renders null when online
    PrimaryButton.tsx          Simplified primary button wrapper (no loading prop)
    SecondaryButton.tsx        Simplified secondary button with optional leading icon
    StepIndicator.tsx          Horizontal pill progress bar; currently unused — onboarding screens hand-roll their own inline progress bars

constants/
  Colors.ts                    Full color palette + semantic tokens
  Typography.ts                Font families, sizes, line heights, pre-built TextStyles
  Spacing.ts                   4px base grid (xs → huge) + border radii + shadows
  Layout.ts                    Screen dimensions, padding, button/input heights, avatar sizes
  Vibes.ts                     VIBES array — 8 review vibes in 2 tiers

context/
  AuthContext.tsx              Session, user object, profile, signOut, refreshProfile

lib/
  supabase.ts                  Supabase client (AsyncStorage persistence, auto-refresh)
  posthog.ts                   PostHog analytics client
```

---

## Navigation & Auth Flow

```
No session            → /(auth)/index → role → phone → otp
New user              → /(onboarding)/client-details  OR  freelancer-profile
Existing / complete   → /(tabs)/index
```

`app/index.tsx` reads `session`, `profile`, and `loading` from `AuthContext` and redirects accordingly. Guards run every time context changes, so navigating back to a completed step is blocked.

**5-second timeout fallback:** If `loading` is still `true` after 5 seconds, `index.tsx` calls `supabase.auth.getSession()` directly to recover from a stuck AuthContext.

For freelancer users, `index.tsx` makes a secondary async query to `freelancer_profiles` to check if a profile row exists before routing to onboarding vs tabs.

---

## Auth Context

```typescript
// context/AuthContext.tsx
type UserProfile = {
  id: string
  name: string | null
  phone: string | null
  email: string | null
  avatar_url: string | null
  role: "freelancer" | "client" | null
  city_id: string | null
  bio: string | null           // freelancer and client bio
  looking_for: string[] | null // client: skill UUIDs they need
  created_at: string | null    // displayed as "Member since"
}

// Exposed from useAuth()
session         // Supabase Session | null
user            // Supabase User | null
profile         // UserProfile | null
loading         // boolean — true during initial auth check
signOut()       // clears session, redirects to auth
refreshProfile()// re-fetches profile row after edits
```

---

## Database Schema

### `users`
| column | type |
|---|---|
| id | uuid (PK) |
| name | text |
| phone | text |
| email | text |
| avatar_url | text |
| role | "freelancer" \| "client" |
| city_id | uuid (FK → cities) |
| push_token | text |
| bio | text |
| looking_for | uuid[] |
| created_at | timestamptz |

### `freelancer_profiles`
| column | type |
|---|---|
| user_id | uuid (FK → users) |
| bio | text |
| skills | uuid[] (FK → skills) |
| portfolio_urls | text[] |
| whatsapp_number | text |
| instagram_handle | text |
| contact_phone | text |
| is_published | boolean |
| created_at | timestamptz |

### `conversations`
| column | type |
|---|---|
| id | uuid (PK) |
| client_id | uuid (FK → users) |
| freelancer_id | uuid (FK → users) |
| last_message_at | timestamptz |
| job_confirmed | boolean |

### `messages`
| column | type |
|---|---|
| id | uuid (PK) |
| conversation_id | uuid (FK → conversations) |
| sender_id | uuid (FK → users) |
| content | text |
| is_read | boolean |
| created_at | timestamptz |

### `jobs`
| column | type |
|---|---|
| id | uuid (PK) |
| conversation_id | uuid (FK → conversations) |
| client_id | uuid (FK → users) |
| freelancer_id | uuid (FK → users) |
| skills | uuid[] (FK → skills) |
| status | "active" \| "completed" |
| created_at | timestamptz |

### `reviews`
| column | type |
|---|---|
| id | uuid (PK) |
| job_id | uuid (FK → jobs) |
| freelancer_id | uuid (FK → users) |
| client_id | uuid (FK → users) |
| vibes | text[] (vibe IDs from `constants/Vibes.ts`) |
| note | text |
| created_at | timestamptz |

### `reports`
| column | type |
|---|---|
| reporter_id | uuid (FK → users) |
| reported_user_id | uuid (FK → users) |
| conversation_id | uuid (FK → conversations) |
| reason | text |
| details | text |
| resolved_at | timestamptz |

### `blocks`
| column | type |
|---|---|
| blocker_id | uuid (FK → users) |
| blocked_user_id | uuid (FK → users) |

### `cities`
| column | type |
|---|---|
| id | uuid (PK) |
| name | text |
| state | text |
| is_active | boolean |

### `skills`
| column | type |
|---|---|
| id | uuid (PK) |
| name | text |
| icon | text (emoji) |
| is_active | boolean |

Read receipts are marked via direct `.update({ is_read: true })` calls (chat screen, tab layout, messages list) — no RPC is used for this.

---

## Recommendation Engine

A three-layer recommendation system ranks the home feed. Layers 1 and 2 are built and live; Layer 3 is designed but not yet implemented.

**Layer 1 — Quality ranking (main feed)**
- Postgres function `calculate_freelancer_score(p_user_id uuid)` scores each freelancer 0–100 using Wilson confidence intervals on: Tier 2 vibe rate (×40), job completion rate (×30), written review rate (×15), Tier 1 vibe rate (×10), profile completeness (×5)
- Report penalty activates only at 3+ reports **and** 5+ jobs
- Recency multiplier: exponential decay with a 0.30 floor
- New users get a base score floor of 25

**Layer 2 — Cold-start slots**
- Freelancers who joined < 30 days ago with 0 completed jobs are flagged `is_new_user` and given the score floor of 25 (mid-feed placement)
- Client-side, they're interleaved into every 5th position of the ranked feed via round-robin rotation (`newUserIndexRef` in `app/(tabs)/index.tsx`)

**Layer 3 — Paid placement (future, not yet built)**
- Max 1 promoted slot per 8 organic results, clearly labelled "Featured"
- Eligibility: 3+ jobs, complete profile, active within 60 days, report rate < 10%

### New Postgres objects
- `calculate_freelancer_score(p_user_id uuid)` — per-freelancer score, granted to `authenticated` and `anon`
- `get_ranked_freelancers(p_city_id, p_skill_id, p_limit)` — single RPC that replaces the old two-query home screen fetch; returns pre-ranked results with all card data (including `review_count`, `vibe_count`, `score`, `is_new_user`, `joined_days_ago`) in one round trip, granted to `authenticated` and `anon`
- Indexes: `idx_jobs_freelancer_id`, `idx_jobs_status`, `idx_jobs_freelancer_status`, `idx_reviews_freelancer_id`, `idx_reviews_created_at`, `idx_reports_reported_user_id`, `idx_freelancer_profiles_user_id`, `idx_freelancer_profiles_published`, `idx_users_city_id`

### Home screen integration
- `fetchFreelancers` (`app/(tabs)/index.tsx`) now calls `supabase.rpc('get_ranked_freelancers', ...)` instead of a direct `freelancer_profiles` query — one round trip instead of the previous query + separate reviews batch query
- The `Freelancer` type is extended with `score: number`, `is_new_user: boolean`, `joined_days_ago: number`
- `score` is never rendered in the UI — backend-only signal
- Cards where `is_new_user === true` show a green "New" pill badge, top-right, absolute positioned

---

## Key Screens

### Home / Discovery (`/(tabs)/index`)
- FlatList of freelancer cards, ranked server-side by the [recommendation engine](#recommendation-engine) (`get_ranked_freelancers` RPC) and filtered by city and skill
- Text search bar (client-side, searches name + skill names)
- Horizontal scrollable skill-filter chips ("All" + each skill with emoji)
- Results count header "Freelancers in {city} · {N} found"
- Each card: avatar, name, review star count, city, vibe count (⚡), skill tags (max 4), portfolio image carousel (first 5 + "view all" sentinel), carousel dot indicators
- Cards for newly-joined freelancers (`is_new_user`) show a green "New" pill badge, top-right
- City picker: centered Modal with searchable input and `city.state` subtitle
- Animated skeleton loading cards (opacity pulse) while fetching
- Pull-to-refresh

### Messages (`/(tabs)/messages`)
- Conversations sorted by `last_message_at`; re-fetched on tab focus (`useFocusEffect`)
- Real-time Supabase subscription on messages table (INSERT + UPDATE) triggers re-fetch
- Unread badge per conversation (capped at "9+"); unread rows highlighted with `offWhite` background + bold name
- Last message preview (one line, truncated)
- Relative timestamps (locale `en-IN`): "Xm", "Xh", "DD MMM"
- Empty state with "Browse freelancers →" CTA

### Chat (`/chat/[id]`)
- Real-time Supabase subscription (INSERT only) + 3s polling fallback
- Date separators ("Today", "Yesterday", full date)
- Marks messages read on screen focus; clears on blur
- Sent messages: **green** bubble (`Colors.green`), right-aligned; received: grey, left-aligned
- Header avatar/name taps: client → `/freelancer/[id]`, freelancer → `/client/[id]`
- **Hire flow (client only):** "Hire" button in header → skill selector (if multiple skills) → confirmation modal → `jobs` INSERT + confetti cannon + Congratulations modal; header becomes "⏳ In Progress" while active
- **Mark Complete (freelancer only):** "Mark complete" button → `jobs.status = "completed"` + system messages
- **Inline review prompt:** after job completion, client sees "Leave a review" button beneath system message → opens `ReviewModal`
- **Report system:** 3-dots menu → 6 preset reasons + details textarea → `reports` INSERT
- **Block/Unblock:** 3-dots menu → `blocks` INSERT (then router.back()) or DELETE

### Freelancer Profile (`/freelancer/[id]`)
- Avatar, name, primary skill, city, job count badge ("X jobs on GetMe")
- Bio, skill tag pills
- Portfolio 3-column grid with full-screen lightbox (pinch-zoom 1×–4×, pan when zoomed, double-tap 2×, horizontal swipe, image counter)
- Reviews & Vibes section: vibe summary pills + "See all reviews" bottom sheet; each review shows client avatar, name, city, date, vibe pills, optional quoted note
- "Leave a review / Edit your review" button in reviews sheet (visible only after a completed job)
- Message button — creates conversation or navigates to existing

### Client Profile (`/client/[id]`)
- Public read-only profile reachable from chat header (freelancer side)
- Avatar, name, city, member since date
- Bio section (if set)
- "Looking for" skill pills (resolved from `users.looking_for` UUID array)

### User Profile (`/(tabs)/profile`)
- Sign out and "Edit profile" via 3-dots (`more-vertical`) dropdown menu — same for both roles
- **Freelancer view:** avatar, name, city, bio, skills, portfolio 3-column grid with lightbox, Reviews & Vibes section (same as public profile), profile completion progress bar (shown when < 100%; tapping items launches edit mode)
- **Freelancer edit mode:** avatar (Cloudinary upload on save), name, city picker, skills multi-select grid, bio (char counter, min 30 / max 300), portfolio (up to 9 images, Cloudinary upload on save). WhatsApp/Instagram are NOT editable here — onboarding only.
- **Client view:** avatar, name, city, member since, bio, "Looking for" skills grid
- **Client edit mode:** avatar, name, city picker, bio (max 200 chars), "Looking for" skills grid. Avatar upload via Cloudinary on save.

---

## Design System

### Colors (`constants/Colors.ts`)
```
black         #111111
white         #FFFFFF
offWhite      #F7F7F5

grey100       #F4F4F4
grey200       #E8E8E8
grey300       #D0D0D0
grey400       #BBBBBB
grey500       #6B6B68
grey700       #3D3D3A

green         #1D9E75
greenLight    #E1F5EE
greenDark     #0F6E56

danger        #E24B4A
dangerLight   #FCEBEB
warning       #F59E0B
warningLight  #FAEEDA

border        #E8E8E8
borderDark    #D0D0D0

overlay       rgba(0,0,0,0.4)
overlayLight  rgba(0,0,0,0.08)
overlayDark   rgba(0,0,0,0.97)
```

### Typography (`constants/Typography.ts`)
- Body: **DM Sans** — weights 400 (`regular`), 500 (`medium`), 700 (`bold`)
- Display: **Plus Jakarta Sans** — weight 700 (`displayBold`)
- Sizes:

| Token | px |
|---|---|
| xs | 10 |
| sm | 11 |
| md | 13 |
| base | 14 |
| lg | 16 |
| xl | 20 |
| xxl | 22 |
| h2 | 24 |
| h1 | 28 |
| display | 36 |

- `LineHeight`: `tight` 1.2 · `normal` 1.5 · `relaxed` 1.7
- `TextStyles`: pre-built `StyleSheet.create` with keys `h1`, `h2`, `h3`, `title`, `body`, `bodyMuted`, `caption`, `label`, `logo`

### Spacing (`constants/Spacing.ts`)
- Base unit: 4px
- `xs` 4 · `sm` 8 · `md` 12 · `lg` 16 · `xl` 20 · `xxl` 24 · `xxxl` 32 · `huge` 48
- Radii: `xs` 4 · `sm` 8 · `md` 12 · `lg` 16 · `xl` 24 · `full` 999
- Shadow: `none` {} · `sm` (elevation 2) · `md` (elevation 4)

### Layout (`constants/Layout.ts`)
- `screenWidth` / `screenHeight` — `Dimensions.get('window')`
- `isSmallDevice` — `width < 375`
- `screenPadding` 20 · `cardPadding` 14 · `sectionPadding` 16
- `tabBarHeight` 64 · `headerHeight` 52
- `buttonHeight` 52 · `inputHeight` 48
- `avatarSm` 32 · `avatarMd` 40 · `avatarLg` 56 · `avatarXl` 80

---

## Reviews & Vibes System (`constants/Vibes.ts`)

8 vibes in 2 tiers:
- **Tier 1** (available after any chat): `great_communicator`, `quick_to_respond`, `professional`
- **Tier 2** (completed jobs only): `nailed_the_brief`, `exceeded_expectations`, `brought_new_ideas`, `would_hire_again`, `lightning_fast`

`ReviewModal` is a shared component (`components/ReviewModal.tsx`) used in both `chat/[id].tsx` and `freelancer/[id].tsx`. It accepts `hasCompletedJob` to gate tier-2 vibes and `existingReview` to pre-populate for edits. Reviews upsert on conflict (one review per client+freelancer pair).

---

## Copy / Microcopy (finalized decisions)

### Role selection screen
- Client card title: "I'm hiring" · subtext: "Looking to hire"
- Freelancer card title: "I'm the talent you need" · subtext: "Looking for work"

### Phone screen
- Header: "Can we have your number?"
- OTP button: "Send me OTP"
- The "Your number is never shown on your public profile." reassurance line was removed — it created doubt rather than reassurance

### Freelancer onboarding
- Photo upload label: "Add a photo" · subtext: "Profiles with a photo get noticed more"
- Bio placeholder: "The version you'd actually say out loud, not your LinkedIn summary"
- Skills header: "What's your craft?"
- City selector: "Where do you do your best work?"
- Submit button: "I'm ready to be found"

### Client onboarding
- City selector: "Where are you located?"
- Submit button: "Take me to GetMe"

### Home screen
- Empty state: "Nobody here yet — be the first to bring [skill] to [city]"
- No results: "Nothing matched that — try a different skill or zoom out to the whole city"

### Messages
- Empty inbox: "Your inbox is quiet for now. Go find someone worth messaging."

### Hire/job flow
- Confirm modal: "Ready to make it official?"
- Hire success: "And that's a hire."
- Mark complete confirm: "Wrap this one up?"
- Mark complete success: "Nice work. One more job done through GetMe."
- Review prompt: "How'd it go? Your honest take helps the next person."

### Profile
- Zero reviews: "No reviews yet. Get out there and earn your first one."
- Profile completion: "Almost there — a few more details and you're ready to be found."

---

## Business Model (finalized)

### Freemium tiers (activate post 100K users)

**Free (forever):** full hiring loop (search, message, hire, review), portfolio, skills, bio, reviews and vibes.

**Pro — ₹149/month or ₹1,499/year:** everything in Free, plus who-viewed-your-profile, top candidates list placement, real-time lead alerts for tagged skills, active list of clients hiring for the same role, quick-reply templates, "Usually responds within X" badge.

**Pro+ — ₹499/month or ₹4,999/year (anchor tier):** everything in Pro, plus competitive intel (who else was viewed for the same job), demand heatmap (trending skills/cities), monthly performance digest + city benchmarking, anonymized local rate/pricing insights, quality-gated priority placement boost, custom profile link (`getme.social/u/yourname`), Pro+ badge.

### Pricing philosophy
- Core hiring loop stays free forever — no paywall on search, message, hire, or get hired
- Paid tiers monetize visibility and intelligence only, never the core loop
- Pro+ exists primarily to make Pro look affordable (anchoring effect — 3.3x price gap)
- Tiers activate only once GetMe has enough user density for features like "who viewed you" to be meaningful

---

## Financial Model (context)

### Use of Funds (₹1.1 Cr, 15 months) — finalized
| Category | Amount | % |
|---|---|---|
| Team | ₹63,00,000 | 57% |
| Marketing & Content | ₹12,00,000 | 11% |
| Tech & AI Tooling | ₹9,00,000 | 8% |
| Equipment & Operations | ₹6,00,000 | 5% |
| Office & Setup | ₹4,50,000 | 4% |
| Legal & Compliance | ₹2,50,000 | 2% |
| Buffer & Runway Reserve | ₹13,00,000 | 12% |

Team breakdown: Founder ₹1,00,000/mo, Tech Lead ₹1,20,000/mo, Growth Lead ₹90,000/mo, Community Ops ₹55,000/mo, Designer ₹55,000/mo. Equipment & Operations includes laptops, travel, meals, merchandise, Google Workspace/Slack/Notion, and the Google Play fee.

### Break-even analysis (at premium tier launch)
- Annual operational cost (scaled Year 2–3 team): ~₹1.38 Cr
- Target with 25% profit margin: ~₹1.73 Cr revenue
- Revenue per converting freelancer/year (blended 80% Pro / 20% Pro+): ~₹2,628
- Paying freelancers needed: ~6,585
- At 3% conversion: ~219,500 active freelancers needed
- Total platform users needed: ~880,000

---

## Claude Code Subagents

Four specialist agents live in `.claude/agents/`:

| Agent | Owns |
|---|---|
| `db-agent.md` | All SQL, schema, indexes, RLS policies, Supabase Edge Functions |
| `query-agent.md` | All Supabase client queries, RPC calls, data mapping, TypeScript types |
| `ui-agent.md` | All JSX, StyleSheet, component layout, text copy throughout the app |
| `marketing-agent.md` | All social content, Instagram/X posts, brand copy, campaign concepts |

`db-agent.md` is explicitly barred from writing or running `DELETE`/`TRUNCATE`/cascading-delete statements — destructive data operations are left to the user to run themselves.

---

## Admin Dashboard

- `reports` table has a `resolved_at` column for tracking resolution
- `jobs` and `conversations` both have an additional `SELECT USING (true)` RLS policy (alongside the participants-only policy) so the admin dashboard can read full counts

---

## Recent Fixes (since last update)

- Custom skill insert was failing due to a missing RLS INSERT policy on `skills` — fixed with `CREATE POLICY "Authenticated users can add custom skills" ON skills FOR INSERT TO authenticated WITH CHECK (true)`
- "Both" role option removed from role selection — it silently converted to freelancer with no real dual-role implementation
- Removed the "Your number is never shown on your public profile" line from the phone screen (see [Copy / Microcopy](#copy--microcopy-finalized-decisions))
- Fixed missing `splash.png` asset warning

---

## Environment Variables

```
EXPO_PUBLIC_SUPABASE_URL
EXPO_PUBLIC_SUPABASE_ANON_KEY
EXPO_PUBLIC_CLOUDINARY_CLOUD_NAME    # dwq1gyvmc
EXPO_PUBLIC_POSTHOG_API_KEY
EXPO_PUBLIC_POSTHOG_HOST
```

All are `EXPO_PUBLIC_` — safe to bundle in client. No server secrets in `.env`.

Cloudinary upload preset: `getme_profiles` (must exist in Cloudinary dashboard as unsigned preset).

---

## Key Patterns

**Image uploads** — `FormData` POST to Cloudinary REST API directly from client. Avatar and portfolio images are square-cropped at 0.8 quality before upload. Upload happens on save, not on pick.

**Unread badge** — `(tabs)/_layout.tsx` subscribes to new messages (INSERT + UPDATE) and polls every **2 seconds** to refresh the tab bar badge count. Channel is named `"tab-badge-" + user.id`.

**Navigation guards** — `app/index.tsx` is the single routing brain. Every auth/profile state change re-runs the redirect logic. Never navigate directly to a protected route from a button without updating profile state first. Has a 5-second timeout fallback that calls `supabase.auth.getSession()` directly.

**Profile dual view** — `profile.tsx` renders different JSX for freelancer vs client role, but both roles now have full view/edit profiles. Check `profile?.role` before adding any profile-screen features.

**Phone formatting** — Stored with `+91` prefix. Strip formatting on display, add it back before Supabase OTP calls.

**Real-time + polling** — Chat uses a Supabase Realtime subscription (INSERT only) that appends new messages directly into state, plus a `setInterval` (3s) fallback that calls `fetchMessages()`. Both paths dedup by message ID.

**Offline detection** — `OfflineBanner` is mounted at the root layout level (no props). Self-contained — subscribes to netinfo internally and renders a red banner when offline.

**Push notification routing** — `_layout.tsx` registers the device push token to `users.push_token` on session start. Notification tap handler reads `data.conversation_id` from the notification payload and calls `router.push('/chat/${conversation_id}')`.

**Job lifecycle** — Hire (client) → `jobs` INSERT + `conversations.job_confirmed = true` + confetti → Mark Complete (freelancer) → `jobs.status = "completed"` + `conversations.job_confirmed = false` + system messages → both parties can leave a review.

**Freelancer ranking** — Home screen fetches freelancers via a single `get_ranked_freelancers` RPC (see [Recommendation Engine](#recommendation-engine)) instead of a direct table query. Results arrive pre-scored server-side; the client only interleaves cold-start (`is_new_user`) freelancers into every 5th slot via a round-robin `newUserIndexRef`. The score itself is never shown in the UI.

**Tab icons** — Home tab uses Phosphor `HouseIcon`; Messages and Profile tabs use Ionicons (`chatbubbles-sharp`, `person-circle`). `FeatherIcon` UI component uses Feather but the tab bar does not.

**Chat bubble color** — Sent messages use `Colors.green` background (not black). Received messages use grey.

---

## Current Status

- MVP: complete and stable
- TestFlight: pending Apple Developer account approval (enrollment submitted, awaiting processing)
- EAS config: complete (`eas.json` preview profile, `app.json` with `bundleIdentifier social.getme.app`, `babel.config.js` with the reanimated plugin)
- Synthetic seed data: 200 users were loaded for testing and have since been cleaned up
- Recommendation engine: built and verified in Supabase; app integration (home screen RPC + cold-start interleaving) is in progress

---

## Common Commands

```bash
npx expo start          # Start dev server
npx expo start --clear  # Clear cache and start
npx expo run:android    # Build and run on Android
npx expo run:ios        # Build and run on iOS
```
