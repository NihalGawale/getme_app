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
| Icons | Feather via `@expo/vector-icons` |
| Fonts | DM Sans (body), Plus Jakarta Sans (display) |
| Notifications | Expo Notifications + Expo Device |

---

## Project Structure

```
app/
  _layout.tsx                  Root layout — wraps app in AuthProvider, fonts, safe area
  index.tsx                    Auth gate — routes to (auth), (onboarding), or (tabs)
  (auth)/
    _layout.tsx
    index.tsx                  Splash / intro screen
    role.tsx                   Role selection (client / freelancer / both)
    phone.tsx                  Phone number input (+91)
    otp.tsx                    OTP verification + user creation
  (onboarding)/
    _layout.tsx
    client-details.tsx         Client name + optional email
    freelancer-profile.tsx     Full freelancer profile setup
  (tabs)/
    _layout.tsx                Tab bar with unread badge
    index.tsx                  Home / freelancer discovery feed
    messages.tsx               Conversations list
    profile.tsx                Current user's profile (view + edit)
  chat/
    [id].tsx                   1-on-1 chat screen (dynamic route)
  freelancer/
    [id].tsx                   Freelancer public profile (dynamic route)

components/ui/
  Avatar.tsx                   Image with initials fallback; sizes: sm/md/lg/xl
  Button.tsx                   Variants: primary / secondary / ghost / danger
  Card.tsx                     Simple bordered container
  Divider.tsx                  Horizontal line
  EmptyState.tsx               Icon + title + subtitle
  FeatherIcon.tsx              Thin wrapper around Feather icon set
  Input.tsx                    Labeled input with prefix, error, hint
  LoadingScreen.tsx            Centered spinner

constants/
  Colors.ts                    Full color palette + semantic tokens
  Typography.ts                Font families, sizes, weights
  Spacing.ts                   4px base grid (xs → huge) + border radii
  Layout.ts                    Screen padding, button/input heights, tab bar height

context/
  AuthContext.tsx              Session, user object, profile, signOut, refreshProfile

lib/
  supabase.ts                  Supabase client (AsyncStorage persistence, auto-refresh)
```

---

## Navigation & Auth Flow

```
No session            → /(auth)/index → role → phone → otp
New user              → /(onboarding)/client-details  OR  freelancer-profile
Existing / complete   → /(tabs)/index
```

`app/index.tsx` reads `session`, `profile`, and `loading` from `AuthContext` and redirects accordingly. Guards run every time context changes, so navigating back to a completed step is blocked.

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

## Database Schema (inferred)

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

### `freelancer_profiles`
| column | type |
|---|---|
| user_id | uuid (FK → users) |
| bio | text |
| skills | uuid[] (FK → skills) |
| portfolio_urls | text[] |
| whatsapp_number | text |
| instagram_handle | text |
| is_published | boolean |
| created_at | timestamptz |

### `conversations`
| column | type |
|---|---|
| id | uuid (PK) |
| client_id | uuid (FK → users) |
| freelancer_id | uuid (FK → users) |
| last_message_at | timestamptz |

### `messages`
| column | type |
|---|---|
| id | uuid (PK) |
| conversation_id | uuid (FK → conversations) |
| sender_id | uuid (FK → users) |
| content | text |
| is_read | boolean |
| created_at | timestamptz |

### `cities`
| column | type |
|---|---|
| id | uuid (PK) |
| name | text |
| is_active | boolean |

### `skills`
| column | type |
|---|---|
| id | uuid (PK) |
| name | text |
| icon | text (emoji) |
| is_active | boolean |

Custom RPC: `mark_messages_read(conversation_id, user_id)` — marks all received messages as read.

---

## Key Screens

### Home / Discovery (`/(tabs)/index`)
- FlatList of freelancer cards filtered by city and skill
- Each card: avatar, name, primary skill, city, skill tags (max 4), image carousel (first 5 + "view more")
- City picker bottom sheet modal
- Pull-to-refresh

### Messages (`/(tabs)/messages`)
- Conversations sorted by `last_message_at`
- Unread badge per conversation
- Relative timestamps ("2m", "3h", "May 28")

### Chat (`/chat/[id]`)
- Real-time Supabase subscription + 3s polling fallback
- Date separators ("Today", "Yesterday", full date)
- Marks messages read on screen focus
- Sent messages: black bubble, right-aligned; received: grey, left-aligned

### Freelancer Profile (`/freelancer/[id]`)
- Avatar, name, primary skill, city
- Bio, skills tags
- Portfolio 3-column grid
- Message button — creates conversation or navigates to existing

### User Profile (`/(tabs)/profile`)
- Freelancer: full view with edit mode (photo, name, city, skills, bio, portfolio, socials)
- Client: minimal card (name, phone) + sign out

---

## Design System

### Colors (`constants/Colors.ts`)
```
black     #111111
white     #FFFFFF
offWhite  #F7F5F2
grey100   #F4F4F4  →  grey700  #3D3D3A
green     #1D9E75      greenDark  #0F6E56
danger    #E24B4A      warning    #F59E0B
overlay   rgba(0,0,0,0.4)
```

### Typography (`constants/Typography.ts`)
- Body: **DM Sans** — weights 400, 500, 700
- Display: **Plus Jakarta Sans** — weight 700
- Sizes: `xs` 10px · `sm` 12px · `md` 14px · `lg` 16px · `xl` 18px · `xxl` 20px · `display` 36px

### Spacing (`constants/Spacing.ts`)
- Base unit: 4px
- `xs` 4 · `sm` 8 · `md` 12 · `lg` 16 · `xl` 20 · `xxl` 24 · `xxxl` 32 · `huge` 48
- Radii: `xs` 4 · `sm` 8 · `md` 12 · `lg` 16 · `xl` 24 · `full` 999

### Layout (`constants/Layout.ts`)
- Screen padding: 20px
- Button height: 52px
- Input height: 48px
- Tab bar height: 84px (includes bottom safe area)

---

## Environment Variables

```
EXPO_PUBLIC_SUPABASE_URL
EXPO_PUBLIC_SUPABASE_ANON_KEY
EXPO_PUBLIC_CLOUDINARY_CLOUD_NAME    # dwq1gyvmc
```

All are `EXPO_PUBLIC_` — safe to bundle in client. No server secrets in `.env`.

Cloudinary upload preset: `getme_profiles` (must exist in Cloudinary dashboard as unsigned preset).

---

## Key Patterns

**Image uploads** — `FormData` POST to Cloudinary REST API directly from client. Avatar and portfolio images are square-cropped at 0.8 quality before upload.

**Unread badge** — `(tabs)/_layout.tsx` subscribes to new messages and polls every few seconds to refresh the tab bar badge count.

**Navigation guards** — `app/index.tsx` is the single routing brain. Every auth/profile state change re-runs the redirect logic. Never navigate directly to a protected route from a button without updating profile state first.

**Profile dual view** — `profile.tsx` renders completely different JSX for freelancer vs client role. Check `profile?.role` before adding any profile-screen features.

**Phone formatting** — Stored with `+91` prefix. Strip formatting on display, add it back before Supabase OTP calls.

**Real-time + polling** — Chat uses Supabase Realtime subscription as primary and `setInterval` (3s) as fallback. Both call the same fetch function; dedup by message ID.

---

## Common Commands

```bash
npx expo start          # Start dev server
npx expo start --clear  # Clear cache and start
npx expo run:android    # Build and run on Android
npx expo run:ios        # Build and run on iOS
```
