# LetsSplyt — Mobile App Specification
**Version:** 1.0 | **Date:** June 2026
**Supersedes:** 09-Navigation-And-UI.md

---

## Overview

This document is the single authoritative specification for the LetsSplyt mobile application. It covers navigation architecture, state management, every screen's behaviour (including all error, loading, and empty states), the four split modes, offline behaviour, error boundaries, push notifications, accessibility requirements, and image handling.

Getting navigation wrong early causes cascading refactors. State management patterns set in concrete at the start. Every screen state — loading, error, empty — must be specified before build begins; retrofitting these is expensive.

---

## 1. Navigation Architecture

### Expo SDK

The mobile app targets **Expo SDK 54** (React Native 0.81, React 19). The installed **Expo Go** app on your device must match this SDK version — Expo Go only runs projects on the same SDK it was built for. After changing the SDK, run `npx expo install --fix` in `mobile/` to align all `expo-*` package versions.

### Library

Use **React Navigation v7** (`@react-navigation/native`, `@react-navigation/bottom-tabs`, `@react-navigation/native-stack`).

**Install these exact packages:**
```bash
npx expo install @react-navigation/native @react-navigation/bottom-tabs @react-navigation/native-stack react-native-screens react-native-safe-area-context
```

**CRITICAL — `app.config.js` plugins array:**

This app uses React Navigation v7. Do **not** add `expo-router` to the plugins array — Expo Router and React Navigation v7 cannot coexist. The correct plugins array is:

```javascript
plugins: [
  'expo-camera',
  'expo-image-picker',
  'expo-local-authentication',
  'expo-secure-store',
  ['expo-notifications', { /* config */ }],
  ['expo-build-properties', {
    ios: { useFrameworks: 'static' },
  }],
],
// expo-router is explicitly NOT included — this app uses React Navigation v7
```

---

### Top-Level Structure

```
RootNavigator (NativeStack)
├── AuthStack          ← shown when no valid session
│   ├── WelcomeScreen
│   ├── PhoneEntryScreen
│   ├── OTPVerifyScreen
│   └── PushPermissionScreen  ← shown once after first OTP verify (is_new_user === true)
│
├── MainTabs           ← shown when session is valid (BottomTabNavigator) — **3 tabs** (Home, Events, Profile)
│   ├── HomeTab         (icon: home)
│   │   └── HomeStack (NativeStack)
│   │       ├── HomeScreen               ← net balance + Members|Guests toggle + counterparty lists
│   │       ├── MemberDetailScreen       ← registered counterparty drill-down (P32)
│   │       ├── GuestDetailScreen        ← phone-guest drill-down (P33); name-only guests skip this
│   │       └── PayNowScreen             ← optional: payer payment handles when viewer owes (from Member detail)
│   │
│   ├── EventsTab       (icon: list)
│   │   └── EventsStack (NativeStack)
│   │       ├── EventsScreen             ← Active|Settled toggle + created/joined sections
│   │       ├── EventDetailScreen        ← payer or participant view (joining / settlement)
│   │       ├── ReceiptScanScreen        ← native doc scanner launcher
│   │       ├── ReceiptPreviewScreen     ← confirm cropped scan before upload
│   │       ├── ItemReviewScreen         ← review/edit parsed items
│   │       ├── SplitEntryScreen         ← 4-tab split mode picker
│   │       ├── SplitReviewScreen        ← final per-person amounts
│   │       └── MessageSendingScreen     ← sending progress + green checks
│   │
│   └── ProfileTab      (icon: person)
│       └── ProfileStack (NativeStack)
│           ├── ProfileScreen
│           └── AddHandleScreen
│
└── Modal screens (presented over any context):
    ├── AppJoinScreen           ← universal link opens here when app is installed
    │   └── AppJoinedScreen    ← success confirmation after joining
    ├── AppLockedScreen         ← group was locked before they could join
    ├── CreateEventModal        ← from HomeScreen or EventsScreen FAB
    ├── QRDisplayModal          ← fullscreen QR, shown after event create or from EventDetail
    ├── AddParticipantModal     ← from EventDetail joining view
    ├── MessagePreviewModal     ← preview a single participant's message
    ├── ConfirmPaymentModal     ← payer confirms a self-report
    └── EditSplitModal          ← post-send split edit
```

AppJoinScreen receives `token` as a route param from the deep link. It calls `POST /api/v1/join/:token` (the combined mobile join endpoint) with body `{ user_id: supabase_uid }` to join the event, then navigates to AppJoinedScreen on success.

Also in ProfileStack (accessed from ProfileScreen → "Delete account"):
```
ProfileStack (continued)
├── DeleteWarnScreen
├── DeleteConfirmScreen
└── DeletedScreen
```

---

### Deep Link / Universal Link Routes

These URL patterns must be handled by the app navigator:

| URL Pattern | Screen | Notes |
|-------------|--------|-------|
| `[APP_DOMAIN]/join/:token` | Browser join page (web) OR in-app join if app installed | Universal link |
| `letssplyt://events/:eventId` | EventDetailScreen | Internal deep link |
| `letssplyt://auth/verify` | OTPVerifyScreen | Used by Supabase Auth email magic links if added later |

**Universal link setup (required for iOS):**

Create this file and host it at `https://[APP_DOMAIN]/.well-known/apple-app-site-association`:
```json
{
  "applinks": {
    "apps": [],
    "details": [
      {
        "appID": "[→ ASK USER: your Apple Team ID].[→ ASK USER: your app bundle ID, e.g. com.yourname.letssplyt]",
        "paths": ["/join/*", "/events/*"]
      }
    ]
  }
}
```

**App Links setup (required for Android):**

Create this file and host at `https://[APP_DOMAIN]/.well-known/assetlinks.json`:
```json
[
  {
    "relation": ["delegate_permission/common.handle_all_urls"],
    "target": {
      "namespace": "android_app",
      "package_name": "[→ ASK USER: your Android package name, e.g. com.yourname.letssplyt]",
      "sha256_cert_fingerprints": [
        "[→ ASK USER: your app's SHA-256 certificate fingerprint from Google Play Console]"
      ]
    }
  }
]
```

**Expo `app.json` config for deep links:**
```json
{
  "expo": {
    "scheme": "letssplyt",
    "ios": {
      "bundleIdentifier": "[→ ASK USER: iOS bundle ID]",
      "associatedDomains": ["applinks:[→ ASK USER: your domain, e.g. tryletssplyt.com]"]
    },
    "android": {
      "package": "[→ ASK USER: Android package name]",
      "intentFilters": [
        {
          "action": "VIEW",
          "autoVerify": true,
          "data": [
            { "scheme": "https", "host": "[→ ASK USER: your domain]", "pathPrefix": "/join" },
            { "scheme": "https", "host": "[→ ASK USER: your domain]", "pathPrefix": "/events" }
          ],
          "category": ["BROWSABLE", "DEFAULT"]
        }
      ]
    }
  }
}
```

**After setting up the deep link config, the user must:**
1. Open their domain registrar / hosting dashboard
2. Create a route that serves the two `.well-known/` JSON files as static files with `Content-Type: application/json`
3. These files must be accessible without redirect (no 301/302) and without requiring login

---

### NavigationContainer Linking Configuration (complete — handles cold start)

```typescript
import { LinkingOptions } from '@react-navigation/native';
import * as Linking from 'expo-linking';
import * as Notifications from 'expo-notifications';

const prefix = Linking.createURL('/');

export const linking: LinkingOptions<RootParamList> = {
  prefixes: [
    prefix,                              // expo dev: exp://...
    'https://letssplyt.com',            // production universal link
    'https://staging.letssplyt.com',    // staging
    'letssplyt://',                      // custom scheme fallback
  ],
  config: {
    screens: {
      MainTabs: {
        screens: {
          EventsTab: {
            screens: {
              EventDetail: 'events/:eventId',
            },
          },
        },
      },
      AppJoin: 'join/:token',           // in-app join (when app is installed)
    },
  },
  // CRITICAL: Handle cold start (app was closed when link was tapped)
  async getInitialURL() {
    // Check if app was opened from a deep link
    const url = await Linking.getInitialURL();
    if (url) return url;
    // Check if opened from a push notification
    const notification = await Notifications.getLastNotificationResponseAsync();
    return notification?.notification.request.content.data?.url as string | null;
  },
  subscribe(listener) {
    // Handle links when app is already open (foreground)
    const linkSub = Linking.addEventListener('url', ({ url }) => listener(url));
    // Handle push notification taps when app is open
    const notifSub = Notifications.addNotificationResponseReceivedListener(response => {
      const url = response.notification.request.content.data?.url as string;
      if (url) listener(url);
    });
    return () => {
      linkSub.remove();
      notifSub.remove();
    };
  },
};

// Usage in App.tsx:
// <NavigationContainer linking={linking} ref={navigationRef}>
```

---

## 2. State Management

Use **Zustand** for global state. Install:
```bash
npx expo install zustand
```

Do not use Redux or Context API for application state. Zustand provides the right trade-off of simplicity and power for this app's scale.

### Store Definitions

```typescript
// mobile/src/stores/authStore.ts
import { create } from 'zustand';
import { Session, User } from '@supabase/supabase-js';
// NOTE: auth session/token data is stored via SecureStore through the Supabase client
// (see ExpoSecureStoreAdapter in src/lib/supabase.ts). Do NOT use AsyncStorage for
// session or token data — it is unencrypted on-disk storage. AsyncStorage is only
// acceptable for non-sensitive user preferences (theme, language, last viewed tab).

interface AuthUser {
  id: string;
  display_name: string;
  avatar_colour: string;
}

interface AuthState {
  user: AuthUser | null;
  session: { access_token: string; refresh_token: string } | null;
  isLoading: boolean;
  login: (phone: string, otp: string) => Promise<{ is_new_user: boolean }>;
  logout: () => Promise<void>;
  setSession: (session: { access_token: string; refresh_token: string } | null) => void; // REQUIRED — updated by initAuthListener on token refresh
}

// NOTE: LetsSplyt has NO separate registration step. The first OTP verify auto-creates
// the user; subsequent OTP verifies log in the existing user. The mobile app can check
// if the user is 'new' from `response.data.is_new_user: boolean` in the response.
//
// Navigation flow:
//   OTP Verify → [if is_new_user] → PushPermissionScreen → HomeScreen
//   OTP Verify → [if !is_new_user] → HomeScreen
//
// IMPORTANT: The mobile app MUST NEVER call supabase.auth.verifyOtp() directly.
// The backend's /auth/otp/verify endpoint handles:
//   (1) Supabase OTP verification
//   (2) user creation if first login
//   (3) phone PII storage (hashed + encrypted)
//   (4) JWT token return

export const useAuthStore = create<AuthState>()((set) => ({
  user: null,
  session: null,
  isLoading: false,

  login: async (phone: string, otp: string) => {
    set({ isLoading: true });
    try {
      // CORRECT — calls backend which handles user creation + PII storage:
      const response = await api.post('/auth/otp/verify', { phone, code: otp });
      // response.data: { access_token, refresh_token, user: { id, display_name, avatar_colour }, is_new_user }
      const { access_token, refresh_token, user, is_new_user } = response.data;
      // Store tokens via expo-secure-store
      await SecureStore.setItemAsync('letssplyt_access_token', access_token);
      await SecureStore.setItemAsync('letssplyt_refresh_token', refresh_token);
      set({ user, session: { access_token, refresh_token }, isLoading: false });
      return { is_new_user };
    } catch (err) {
      set({ isLoading: false });
      throw err;
    }
  },

  logout: async () => {
    await supabase.auth.signOut();
    // SecureStore entries are cleared by the Supabase client on sign-out
    set({ user: null, session: null });
  },

  // setSession is called by initAuthListener on TOKEN_REFRESHED and SIGNED_IN events.
  // It must be an explicit action in the store so the listener can update the session
  // without triggering a full login flow.
  setSession: (session: Session | null) => {
    set({ session, user: session?.user ?? null });
  },
}));

// REQUIRED: Wire Supabase token refresh into Zustand auth store.
// Without this, the session in the store becomes stale after the 15-minute access token expires.
// Add this to authStore initialization (call once on app startup):

export function initAuthListener() {
  const { data: { subscription } } = supabase.auth.onAuthStateChange(
    (event, session) => {
      if (event === 'TOKEN_REFRESHED' || event === 'SIGNED_IN') {
        useAuthStore.getState().setSession(session);
        // Also update SecureStore so session survives app restart
        if (session) {
          SecureStore.setItemAsync('letssplyt_access_token', session.access_token);
          SecureStore.setItemAsync('letssplyt_refresh_token', session.refresh_token ?? '');
        }
      }
      if (event === 'SIGNED_OUT') {
        useAuthStore.getState().logout();
      }
    }
  );
  return subscription; // call subscription.unsubscribe() in app cleanup
}

// Wiring requirement:
// Call initAuthListener() in App.tsx root component useEffect on mount.
// Store the returned subscription and call subscription.unsubscribe() on app unmount.
// The Supabase client automatically refreshes the access token 60 seconds before expiry when autoRefreshToken: true.
// The listener ensures the Zustand store and SecureStore stay in sync with the current token.
```

**Supabase client — SecureStore adapter (REQUIRED — never use AsyncStorage for auth storage):**

```typescript
// mobile/src/lib/supabase.ts
import * as SecureStore from 'expo-secure-store';
import { createClient } from '@supabase/supabase-js';

// CORRECT — security-sensitive data in SecureStore
// await SecureStore.setItemAsync('supabase_session', JSON.stringify(session));
// const raw = await SecureStore.getItemAsync('supabase_session');

// WRONG — never store tokens in AsyncStorage
// import AsyncStorage from '@react-native-async-storage/async-storage';
// await AsyncStorage.setItem('session', ...) // ← DO NOT DO THIS

// AsyncStorage is only acceptable for:
// - User preferences (theme, language)
// - Zustand state persistence for NON-sensitive data (e.g. last viewed tab)
// - Never for auth tokens, never for encrypted keys

const ExpoSecureStoreAdapter = {
  getItem: (key: string) => SecureStore.getItemAsync(key),
  setItem: (key: string, value: string) => SecureStore.setItemAsync(key, value),
  removeItem: (key: string) => SecureStore.deleteItemAsync(key),
};

export const supabase = createClient(
  process.env.EXPO_PUBLIC_SUPABASE_URL!,
  process.env.EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
  {
    auth: {
      storage: ExpoSecureStoreAdapter,
      autoRefreshToken: true,
      persistSession: true,
      detectSessionInUrl: false,
    },
  }
);
```

```typescript
// mobile/src/stores/eventStore.ts
import { create } from 'zustand';

interface Participant {
  id: string;
  display_name: string;
  // Phone data is never returned by the API. If the creator needs to contact a participant, they use the nudge endpoint.
  join_method: 'qr_app' | 'qr_web' | 'manual_phone' | 'manual_name_only';
  joined_at: string;
  payment_status: 'pending' | 'self_reported' | 'payer_marked' | 'confirmed' | 'disputed' | 'opted_out' | 'settled';
  amountOwed: number | null;
}

interface ReceiptItem {
  id: string;
  name: string;
  price: number;
  confidence: 'high' | 'low';
  assignedTo: string[]; // participantIds
}

interface SplitDraft {
  // Note: The UI shows 4 tabs (Even, Amount, Percent, Portions) but only 3 modes are stored in the DB.
  // 'Equal' and 'Portion' cover all 4 UI tabs:
  //   Tab 'Even'       → mode: 'equal'
  //   Tab 'Amount ($)' → mode: 'portion' (custom absolute amounts)
  //   Tab 'Percent (%)' → mode: 'portion' (percentages converted to amounts before submit)
  //   Tab 'Portions'   → mode: 'portion' (proportional portions)
  // The UI handles the conversion; the API only receives 'equal', 'portion', or 'itemised'.
  mode: 'equal' | 'portion' | 'itemised';
  allocations: Record<string, number>; // participantId → value
  total: number;
}

interface Event {
  id: string;
  title: string;  // DB column is `title`, not `name`
  event_date: string | null;
  status: 'open' | 'locked' | 'settled' | 'cancelled';
  split_mode: 'equal' | 'portion' | 'itemised' | null;  // null until creator chooses
  payer: {
    id: string;
    display_name: string;
    avatar_colour: string;
  };
  total: number | null;
  currency: string;
  locale: string;
  tax_amount: number | null;
  tip_amount: number | null;
  fees_amount: number | null;
  ai_stage: 'none' | 'parsing' | 'parsed' | 'calculating' | 'calculated' | 'messaging' | 'complete' | 'failed';
}

interface EventState {
  currentEvent: Event | null;
  currentEventParticipants: Participant[];
  receiptItems: ReceiptItem[];
  splitDraft: SplitDraft | null;
  realtimeChannel: RealtimeChannel | null;          // for joining phase — see REALTIME LIFECYCLE below
  realtimeSettlementChannel: RealtimeChannel | null; // for settlement phase
  setCurrentEvent: (event: Event) => void;
  updateSplit: (draft: SplitDraft) => void;
  clearCurrentEvent: () => void;
  // Fetch a single event by ID (used by notification deep-link handler)
  fetchEvent: (eventId: string) => Promise<void>;
  // Calls GET /api/v1/events/:eventId and sets currentEvent in store
  // Add a participant to currentEvent.participants (called by Realtime subscription)
  addParticipant: (participant: Participant) => void;
  // Updates in-memory list without API call
  // Store receipt items after A1 completes
  setReceiptItems: (items: ReceiptItem[]) => void;
  // Clear the draft split state (after split is confirmed or event is reset)
  clearSplitDraft: () => void;
  subscribeToEvent: (eventId: string) => void;   // called on EventDetailScreen mount (joining phase)
  unsubscribeFromEvent: () => void;              // called when Creator locks the event — prevents memory leaks
  subscribeToSettlement: (eventId: string) => void;   // called during settlement phase
  unsubscribeFromSettlement: () => void;              // called when event settles
}

// NOTE: RealtimeChannel is imported from '@supabase/supabase-js'.
// eventStore must track both Realtime subscriptions so screens can reliably
// clean them up on unmount regardless of how the user navigates away.
//
// REALTIME LIFECYCLE (enforced via store):
//   subscribeToEvent(eventId)      — subscribes to `event-members:{eventId}`, stores reference
//   unsubscribeFromEvent()         — calls channel.unsubscribe() + supabase.removeChannel(channel),
//                                    then sets realtimeChannel: null
//                                    Unsubscribe when Creator locks the event.
//   subscribeToSettlement(eventId) — subscribes to `event-settlement:{eventId}`, stores reference
//   unsubscribeFromSettlement()    — calls channel.unsubscribe() + supabase.removeChannel(channel),
//                                    then sets realtimeSettlementChannel: null
//                                    Unsubscribe when event settles.
//
// Subscribe to `event-members:{eventId}` during the QR/join phase (Creator watching participants join).
// Subscribe to `event-settlement:{eventId}` during the settlement phase (watching payment_status changes).
//
// Test: mount EventDetailScreen → navigate away → supabase.getChannels() returns [].

export const useEventStore = create<EventState>()((set) => ({
  currentEvent: null,
  currentEventParticipants: [],
  receiptItems: [],
  splitDraft: null,
  realtimeChannel: null,
  realtimeSettlementChannel: null,

  setCurrentEvent: (event: Event) =>
    set({ currentEvent: event, splitDraft: null }),

  updateSplit: (draft: SplitDraft) =>
    set({ splitDraft: draft }),

  clearCurrentEvent: () =>
    set({ currentEvent: null, currentEventParticipants: [], receiptItems: [], splitDraft: null }),

  fetchEvent: async (eventId: string) => {
    const data = await apiRequest(`/events/${eventId}`, { method: 'GET', session });
    set({ currentEvent: data });
  },

  addParticipant: (participant: Participant) =>
    set((state) => ({
      currentEventParticipants: [...state.currentEventParticipants, participant],
    })),

  setReceiptItems: (items: ReceiptItem[]) =>
    set({ receiptItems: items }),

  clearSplitDraft: () =>
    set({ splitDraft: null }),

  subscribeToEvent: (eventId: string) => {
    const channel = supabase
      .channel(`event-members:${eventId}`)
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'participants',
        filter: `event_id=eq.${eventId}`,
      }, (payload) => {
        // update currentEventParticipants from payload
      })
      .subscribe();
    set({ realtimeChannel: channel });
  },

  unsubscribeFromEvent: () => {
    // Access current channel via getState() to avoid stale closure
    const channel = useEventStore.getState().realtimeChannel;
    if (channel) {
      channel.unsubscribe();
      supabase.removeChannel(channel);
    }
    set({ realtimeChannel: null });
  },

  subscribeToSettlement: (eventId: string) => {
    const channel = supabase
      .channel(`event-settlement:${eventId}`)
      .on('postgres_changes', {
        event: 'UPDATE',
        schema: 'public',
        table: 'participants',
        filter: `event_id=eq.${eventId}`,
      }, (payload) => {
        // update payment_status in currentEventParticipants from payload
      })
      .subscribe();
    set({ realtimeSettlementChannel: channel });
  },

  unsubscribeFromSettlement: () => {
    const channel = useEventStore.getState().realtimeSettlementChannel;
    if (channel) {
      channel.unsubscribe();
      supabase.removeChannel(channel);
    }
    set({ realtimeSettlementChannel: null });
  },
}));
```

```typescript
// mobile/src/stores/settlementStore.ts
import { create } from 'zustand';

interface SettlementEntry {
  participantId: string;
  displayName: string;
  eventId: string;
  eventName: string;
  amountOwed: number;
  currency: string;
  payment_status:
    | 'pending'
    | 'self_reported'
    | 'payer_marked'    // creator has marked this participant as paid
    | 'confirmed'
    | 'disputed'
    | 'opted_out'       // participant replied STOP to SMS
    | 'settled';        // fully reconciled
  lastNudgedAt: string | null;
}

interface IOwedEntry {
  creatorId: string;
  creatorName: string;
  eventId: string;
  eventName: string;
  amountOwed: number;
  currency: string;
  paymentHandles: PaymentHandle[];
}

interface PaymentHandle {
  provider: 'venmo' | 'paypal' | 'cashapp' | 'zelle' | 'wise' | 'other';
  handle_display: string;  // decrypted handle string for display; API returns handle_display (not handle)
  deepLinkUrl: string;
}

interface MemberCounterparty {
  userId: string;
  displayName: string;
  avatarColour: string;
  netAmountMinorUnits: number;
}

interface GuestCounterparty {
  guestKey: string;
  kind: 'phone' | 'name_only';
  displayName: string;
  amountMinorUnits: number;
  eventId?: string;
  participantId?: string;
}

interface MemberDetailPayload {
  userId: string;
  displayName: string;
  netAmountMinorUnits: number;
  outstanding: Array<{ eventId: string; eventTitle: string; amountMinorUnits: number; direction: 'they_owe_you' | 'you_owe_them'; paymentStatus: string }>;
  history: Array<{ eventId: string; eventTitle: string; amountMinorUnits: number; status: 'settled' | 'zero' }>;
}

interface SettlementState {
  // Home dashboard (E09-S03)
  membersOweYou: MemberCounterparty[];
  membersYouOwe: MemberCounterparty[];
  guests: GuestCounterparty[];
  memberDetail: MemberDetailPayload | null;
  guestDetail: MemberDetailPayload | null;

  // Event Detail settlement phase
  owedToMe: SettlementEntry[];
  iOwe: IOwedEntry[];

  isLoading: boolean;
  error: string | null;
  loadCounterparties: (kind: 'members' | 'guests') => Promise<void>;
  loadMemberDetail: (userId: string) => Promise<void>;
  loadGuestDetail: (phoneHash: string) => Promise<void>;
  refreshEventSettlement: (eventId: string) => Promise<void>;

  // selfReport() — called by participant to report they've paid
  selfReport: (eventId: string, participantId: string) => Promise<void>;
  // Calls: POST /api/v1/events/:eventId/settlement/:participantId/self-report
  // (no body required)

  // confirm() — called by creator to confirm participant's payment
  confirm: (eventId: string, participantId: string) => Promise<void>;
  // Calls: POST /api/v1/events/:eventId/settlement/:participantId/confirm
  // (no body required)

  // dispute() — called by creator to dispute participant's self-report
  dispute: (eventId: string, participantId: string, note?: string) => Promise<void>;
  // Calls: POST /api/v1/events/:eventId/settlement/:participantId/dispute
  // Body: { note?: string }

  // nudge() — called by creator to remind participant
  nudge: (eventId: string, participantId: string) => Promise<void>;
  // Calls: POST /api/v1/events/:eventId/messages/nudge/:participantId
  // Returns 429 with next_nudge_available_at if within 48-hour cooldown
}

export const useSettlementStore = create<SettlementState>()((set) => ({
  membersOweYou: [],
  membersYouOwe: [],
  guests: [],
  memberDetail: null,
  guestDetail: null,
  owedToMe: [],
  iOwe: [],
  isLoading: false,
  error: null,

  loadCounterparties: async (kind) => {
    set({ isLoading: true, error: null });
    try {
      const data = await apiRequest(`/users/me/counterparties?kind=${kind}`, { method: 'GET', session });
      if (kind === 'members') {
        set({ membersOweYou: data.owe_you, membersYouOwe: data.you_owe, isLoading: false });
      } else {
        set({ guests: data.guests, isLoading: false });
      }
    } catch {
      set({ error: 'Failed to load balances.', isLoading: false });
    }
  },

  loadMemberDetail: async (userId) => {
    const data = await apiRequest(`/settlement/member/${userId}`, { method: 'GET', session });
    set({ memberDetail: data });
  },

  loadGuestDetail: async (phoneHash) => {
    const data = await apiRequest(`/settlement/guest/${phoneHash}`, { method: 'GET', session });
    set({ guestDetail: data });
  },

  refreshEventSettlement: async (eventId) => {
    const [owedToMe, iOwe] = await Promise.all([
      apiRequest('/settlement/owed-to-me', { method: 'GET', session }),
      apiRequest('/settlement/i-owe', { method: 'GET', session }),
    ]);
    set({ owedToMe, iOwe });
  },
}));
```

---

### API Helper — Absolute URLs Required

React Native has no browser context. `fetch('/api/v1/...')` throws a network error. Every store must use the full base URL via the `api` helper from `src/services/api.ts`, which resolves the backend host via `getApiBaseUrl()`:

1. **`EXPO_PUBLIC_API_URL`** if set to a non-localhost URL (staging/production or manual override)
2. **Expo Go debugger host** — your Mac's LAN IP from Metro (e.g. `http://192.168.1.42:3000`) — used automatically on physical devices
3. **`http://localhost:3000`** — iOS Simulator / Android emulator only

On a **physical phone**, `localhost` is the phone itself, not your Mac. The app must use your Mac's LAN IP (auto-detected in Expo Go) or an explicit `EXPO_PUBLIC_API_URL`.

```typescript
// WRONG — relative URL crashes in React Native
const response = await fetch('/api/v1/settlement/summary');

// CORRECT — use apiPost / apiRequest from src/services/api.ts
import { apiPost } from '../services/api';
await apiPost('/auth/otp/request', { phone_e164: '+15005550006' });
```

```typescript
// src/services/api.ts (implementation reference)
import { getApiBaseUrl } from './getApiBaseUrl';

const BASE_URL = `${getApiBaseUrl()}/api/v1`;

class ApiError extends Error {
  constructor(public status: number, message: string, public code?: string) {
    super(message);
  }
}

export async function apiRequest<T>(
  path: string,
  options: RequestInit & { session: Session }
): Promise<T> {
  const response = await fetch(`${BASE_URL}${path}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${options.session.access_token}`,
      ...options.headers,
    },
  });
  if (!response.ok) {
    const error = await response.json().catch(() => ({ message: response.statusText }));
    throw new ApiError(response.status, error.message, error.code);
  }
  return response.json() as Promise<T>;
}
```

---

## 3. Screen-by-Screen Specification

### Connectivity Indicator

When the device has no network connection, show a **red banner** at the very top of every screen (above the safe area content, below the status bar):

```
┌──────────────────────────────────────────────────────┐
│  ● No internet connection                            │  ← Red background (#EF4444), white text
└──────────────────────────────────────────────────────┘
```

Implement using `@react-native-community/netinfo`. The banner is rendered at the root navigator level so it appears on every screen automatically. The banner dismisses as soon as connectivity is restored.

---

### AuthStack

#### WelcomeScreen (root of AuthStack)

- App logo centred, "LetsSplyt" wordmark below
- Tagline: "Split Bills, Not Friendships"
- Primary CTA: **"Get Started"** → navigates to PhoneEntryScreen
- No secondary login link — phone OTP auth uses a **single unified flow** for new and returning users (see *Unified phone auth* below)
- No back button (this is the root screen)

**Accessibility:** "Get Started" button: `accessibilityRole="button"`, `accessibilityLabel="Get started with LetsSplyt"`.

---

#### Unified phone auth (mobile app)

LetsSplyt does **not** split "Sign up" vs "Log in" in the UI. The phone number is the identity:

1. User taps **Get Started** → enters phone → `POST /auth/otp/request` with `context: 'register'`
2. Backend returns `account_exists: true` when the number already has a profile
3. **Returning user:** OTP screen shows "You're already registered — just enter the code to sign in." No name field. Verify with `context: 'register'` → session created, `is_new_user: false`
4. **New user:** OTP screen shows name field. Verify with `context: 'register'` + `display_name` → account created, `is_new_user: true`

The backend still supports `context: 'login'` for other entry points (e.g. web join); the mobile Welcome → Phone → OTP path always uses `register`.

---

#### PhoneEntryScreen

- Title: "Enter your phone number"
- Input: US phone field (`RegionPhoneField`, MVP US-only)
- CTA: "Send Code"
- On submit: `POST /auth/otp/request` with `context: 'register'` → navigate to OTPVerifyScreen with `accountExists` when applicable
- Optional route param: `initialPhone` (E.164) to pre-fill after errors elsewhere

**Error state:** Inline error below the input. Network errors use the shared API error copy.

**Accessibility:** Phone input: `accessibilityLabel="Phone number"`. Send Code button: `accessibilityRole="button"`.

---

#### OTPVerifyScreen

- Shows last 4 digits of phone number at top
- If `accountExists === true`: info banner — "You're already registered — just enter the code to sign in." (no name field)
- If new user (`accountExists` false/absent): name `TextInput` before digit boxes
- 6 `TextInput` boxes side by side (one digit each), auto-focus, auto-advance
- "Resend code" link (disabled for 30 seconds after initial send, shows countdown); resend uses `context: 'register'`
- On complete entry (6 digits filled): auto-submit `POST /api/v1/auth/otp/verify` with `context: 'register'` (backend endpoint — NOT supabase.auth.verifyOtp())
  - Request body: `{ phone_e164, code, context: 'register', display_name? }`
  - Response: `{ access_token, refresh_token, user: { id, display_name, avatar_colour, is_new_user }, ... }`
  - Store tokens in expo-secure-store; set authStore.user
- On success (`is_new_user === true`): navigate to PushPermissionScreen
- On success (`is_new_user === false`): navigate to Home (biometric prompt deferred)
- Back button → PhoneEntryScreen

**Error state:** If OTP is incorrect, show red text below the input boxes: "Incorrect code. Try again." and clear all boxes. If expired: "That code has expired. Tap Resend to get a new one."

**Accessibility:** Each digit input: `accessibilityLabel="Digit 1"` through `"Digit 6"`. Resend link: `accessibilityRole="button"`, `accessibilityHint="Sends a new verification code to your phone"`.

---

#### PushPermissionScreen (AuthStack — shown once, after first OTP success)

This screen appears in the AuthStack **only once** — after the very first successful OTP verification. On all subsequent launches the screen is skipped.

**Skip condition:** If `Notifications.getPermissionsAsync()` returns `status: 'granted'`, skip this screen entirely and proceed to MainTabs.

**Layout:**
- Bell icon (large, centred)
- Heading: "Stay in the loop"
- Body text: "Allow notifications to receive payment confirmations and reminders when your share is paid."
- Primary CTA: "Allow notifications" (indigo, full-width)
- Secondary link: "Maybe later" (grey, below the button)

**"Allow" behaviour:**
1. Call `Notifications.requestPermissionsAsync()`
2. If `status === 'granted'`: call `Notifications.getExpoPushTokenAsync()` → POST `/api/v1/users/me/push-token` with body `{ device_id, token, platform }` → navigate to MainTabs
3. If `status === 'denied'` (user denied the system prompt): navigate to MainTabs (do not show an error — the user made a valid choice)

**"Maybe later" behaviour:**
- Store `hasSeenPushPermissionScreen: true` in AsyncStorage
- Navigate to MainTabs
- The notification permission prompt can be triggered later from ProfileScreen → "Enable notifications"

**Accessibility:** Allow button: `accessibilityRole="button"`, `accessibilityLabel="Allow LetsSplyt to send notifications"`. Skip link: `accessibilityRole="button"`, `accessibilityLabel="Skip for now"`.

---

### HomeStack

Refer to `prototype/home.html` (dashboard states). **MVP: USD only.**

#### HomeScreen

**Layout (top → bottom):**

1. **Net balance hero** (unchanged from E05-S03 placeholder)
   - `GET /api/v1/users/me/balance` → `{ net_balance, currency: "USD", owed_to_you, you_owe }`
   - **Owed to you** = all outstanding on events the user created (registered members + pure guests). **You owe** = registered counterparties only. Not scoped to the Members toggle — guest obligations still count in the hero even when Guests toggle is hidden.
   - Green / red / grey by sign; skeleton while loading; graceful "Balance unavailable" if 404/501
2. **Members | Guests** segmented toggle (below hero)
3. **List area** (content depends on toggle)
4. **FAB** bottom right: "＋ New event" → `CreateEventModal`
5. Pull to refresh refreshes balance + active toggle list

**Tab navigation:** Tapping the **Dashboard** bottom tab resets the Home stack to this screen (does not leave the user on Member/Guest detail).

**Members toggle** — `GET /api/v1/users/me/counterparties?kind=members`

| Section | Rows | Row content | Tap |
|---|---|---|---|
| **People who owe you** | `owe_you[]` (net > 0) | Avatar, name, **net amount only** | → `MemberDetailScreen` (`userId`) |
| **People you owe** | `you_owe[]` (net < 0) | Avatar, name, **net amount only** | → `MemberDetailScreen` (`userId`) |

- Hide each section (including heading) when empty.
- Counterparties with **net = 0** never appear.

**Guests toggle** — `GET /api/v1/users/me/counterparties?kind=guests`

- Only pure guests who **still owe the logged-in user** (viewer is payer). Settled guests hidden.
- Row: name + **outstanding amount only**.
- **Phone guest** (`kind: phone`): tap → `GuestDetailScreen` (`phoneHash` / `guest_key`).
- **Name-only guest** (`kind: name_only`): tap → **`EventDetailScreen` directly** (`event_id` from row) — no intermediate screen.

**Empty states:**
- Members / both sections empty: "No outstanding balances with members."
- Guests empty: "No guests owe you right now."

**Error state:** Banner below toggle: "Couldn't load balances. Pull to retry."

**Accessibility:** Toggle: `accessibilityRole="tab"`. Counterparty row: `accessibilityLabel="[Name], [spoken amount], [owe you | you owe]"`.

> **E05-S03 shipped a placeholder** (Needs attention + recent events). **E09-S03** replaces list area with Members/Guests toggle per this spec.

---

#### MemberDetailScreen

- **Route params:** `userId: string`
- **Data:** `GET /api/v1/settlement/member/:userId`
- Header: counterparty avatar, name, signed net amount
- **Outstanding** events (from `outstanding[]`): event title, per-event amount, direction chip (`They owe you` / `You owe`), payment status chip
- **"See more events"** button at bottom → expands `history[]` (settled / $0 direct relationships only)
- Tap event row → `EventDetailScreen` (`eventId`) — payer or participant view per role
- **No inline Confirm/Nudge/Pay** on this screen — actions in Event Detail only
- Optional: "Pay now" on `i_owe` outstanding rows → `PayNowScreen` with decrypted handles from event context

**Back:** pops to `HomeScreen`.

---

#### GuestDetailScreen

- **Route params:** `phoneHash: string` (or `guest_key`)
- **Data:** `GET /api/v1/settlement/guest/:phoneHash`
- Header: guest display name, total outstanding
- Same outstanding / "See more events" / history pattern as Member detail
- Tap event → `EventDetailScreen` (payer settlement view)

**Not used for name-only guests** — those navigate straight from `HomeScreen`.

---

#### PayNowScreen

- Pushed from `MemberDetailScreen` when viewer owes on an outstanding event (or from participant Event Detail)
- Amount at top (large, bold); creator payment handle cards with deep links (`Linking.openURL`)
- US MVP: Venmo, PayPal, Cash App, Zelle handles per payer profile
- "I've paid" → self-report flow → returns to Event Detail
- Refer to `prototype/ledger.html` `pay_now` ID for visual layout
- If payment deep link fails (app not installed): show handle as copyable text
- **Accessibility:** Each payment option: `accessibilityRole="button"`, `accessibilityLabel="Pay via [provider] — [handle]"`

---

### EventsStack

#### EventsScreen

**Layout (top → bottom):**

1. **Active | Settled** segmented toggle
2. **Events you created** — `GET /api/v1/events?role=creator` (paginated)
3. **Events you joined** — `GET /api/v1/events?role=participant` (paginated)

The toggle filters **both** sections:
- **Active** — events where `status` is not `settled` or `archived`
- **Settled** — events where `status` is `settled` or `archived`

Each section lists only events matching the selected toggle. Event card: title, date, participant count, status chip, optional outstanding amount. FAB: "＋ New event" → `CreateEventModal`. Tap card → `EventDetailScreen`.

**Tab navigation:** Tapping the **Events** bottom tab always resets the Events stack to this list (does not leave the user on a previously opened `EventDetailScreen`).

**Empty states (per section, per toggle):**
- Active / created empty: "You haven't created any active events yet. Tap + to split your first bill."
- Active / joined empty: "You haven't joined any active events yet."
- Settled / created empty: "No settled events you've created yet."
- Settled / joined empty: "No settled events you've joined yet."

**Loading / error:** Same skeleton and pull-to-retry patterns as prior spec.

**Accessibility:** Toggle: `accessibilityRole="tab"`. Card: `accessibilityRole="button"`, `accessibilityLabel="[title], [role created|joined], [status]"`.

---

#### EventDetailScreen (dual-phase — same screen, different content)

**Role split:** Creators (`auth.user.id === event.payer_id`) see the payer views below. Joined members see **Participant view** only — no QR, copy/share link, add-member, lock, reopen, or payer settlement summary. Participant view (refer to `prototype/participant.html` IDs `event_detail`, `event_detail_waiting`):

- Header: event title, "Hosted by [creator] · [date]", status chip
- **Your share** hero: calculated amount when `amount_owed` is set; otherwise professional pending copy (open group → waiting for creator to lock; locked → preparing receipt/split; calculating → share being calculated)
- **How your share was calculated:** shown when `split_mode` is set — equal / portion / itemised description; itemised lists `my_items` from `GET /events/:id` when available
- **Group roster:** all members with amounts when split is finalised; viewer's row labelled "You" and highlighted

**Joining phase — payer only** (event status = `"open"`):
- QR code at top (tap → QRDisplayModal fullscreen)
- "Copy link" and "Share link" buttons
- "Expired" amber state with "Regenerate" button if token lapsed
- Live member list (Supabase Realtime subscription on `participants` table, filter by `event_id`)
- Organiser (event creator) appears as the first member automatically — `is_organiser: true`, chip label **Organiser**, no remove control
- Each member row (`EventMemberRow`): compact 48px row — 32px avatar | name | join-method chip (`alignSelf: flex-start`, not full-width) | optional × remove icon (payer only, non-organiser rows)
- "+ Add manually" button → `AddParticipantModal` with two choices: **From contacts** (`expo-contacts`) or **Enter manually** (name / phone / name-only)
- "Lock group →" CTA at bottom (disabled if < 2 participants — organiser + at least one other). Hint when count is 1: *"Add at least one more member besides you to lock the group."*
- "Reopen join window" button (shown when status is `locked` and user is payer — POST `/events/:id/reopen` reverts to `"open"`, new QR/link for 24h)

**Settlement phase — payer only** (event status = `"locked"`, `"calculating"`, `"sent"`, `"settled"`):

**Locked-event split footer** (`EventSplitActionBar` in `AuthGradientLayout` footer; creator only). Mode derives from `event.ai_stage` and `receipt_review` via `resolveEventSplitActionMode()` in `mobile/src/utils/eventSplitFooter.ts`:

| Condition | Footer CTA |
|-----------|------------|
| `ai_stage = none` | **Scan receipt** + **Enter total** (side by side) |
| `ai_stage = parsing` | **Reading receipt…** (disabled) |
| `ai_stage = failed` | **Scan receipt** + **Enter total** (retry, stacked) |
| `ai_stage = parsed` | **Review items** only |
| `ai_stage = parsed_confirmed` or later AI stages (before messages sent) | **Edit share** (+ **Send messages** when expenses entered and `messages_sent_at` null) + optional **Reset expenses** |

**Footer layout rules (non-negotiable — regression-tested):**
- **Paired actions** (**Scan receipt** + **Enter total**, **Edit share** + **Send messages**) use a **row** (`flexDirection: 'row'`) with `flex: 1` on each `PrimaryButton`. The sticky footer has no fixed height; placing `flex: 1` buttons in a **column** collapses them to zero height on device (invisible CTAs).
- **Stacked full-width actions** (**Review items**, **Reading receipt…**, **Reset expenses**, failed-mode retry buttons) use `alignSelf: 'stretch'` only — **never** `flex: 1` in a column.
- Component: `mobile/src/components/events/EventSplitActionBar.tsx`. Tests: `mobile/src/__tests__/components/events/EventSplitActionBar.test.tsx` (all modes + layout regression). Integration: `EventDetailScreen.test.tsx` (`shows scan and enter total when locked and receipt not scanned`).

**Review items** navigates to `ItemReviewScreen` with `receipt_review` from `GET /events/:id` (no re-scan). If `receipt_review` is missing, show toast and pull to refresh.

**Edit share** navigates to `SplitEntryScreen` via `resolveSplitEntryMode()`:
- `itemised` when `receipt_review` exists or `split_mode = 'itemised'`
- `manual` for **Enter total** flows (`split_mode = equal|portion` or `ai_stage = calculated|messaging|complete` without receipt data)

**Send messages** (when `canSendEventMessages()` — expenses entered, messages not sent) navigates to `MessagePreviewScreen` via `navigateInEventFlow()`.

**Reset expenses** shows a destructive confirmation alert, then calls `POST /events/:id/expenses/reset`. On success: optimistic store patch (`applyExpensesResetLocal`), clear split store, refetch event detail, toast success. Footer returns to **Scan receipt** + **Enter total**. Hidden when `messages_sent_at` is set (`canResetEventExpenses()`).

Event Detail **refetches on focus** (`useFocusEffect`) except immediately after reset (skip one focus refresh to avoid alert-dismiss race overwriting optimistic state).

- Summary card: three equal columns (amount on top, label below — **Total bill**, **Collected**, **Outstanding**). Column layout avoids label truncation from cramped label|value rows on narrow screens.
- Segmented progress bar: green (confirmed) | amber (self-reported) | grey (pending)
- Per-member roster:
  - Pending: name | amount | "💵 Cash" button | "⏰ Nudge" button (grayed if cooldown active, shows "Xh ago")
  - Self-reported: name | amount | "✓ Confirm" button | "✕ Dispute" button
  - Confirmed: name | amount | green check
  - Opted out: name | "opted out" chip | no action buttons

Note: EventDetailScreen is where all settlement **actions** execute. Cross-event counterparty summary lives on **Home** (Members/Guests toggle + detail screens).

Back button: pops to previous screen (`EventsScreen`, `HomeScreen`, or `MemberDetailScreen` / `GuestDetailScreen`).

**Loading state (skeleton) — member list:**
- Three rows, each ~48px tall: grey circle (32×32) on the left, two grey lines (name + chip) on the right, pulsing animation.

**Error state:** If the Realtime subscription fails or the initial fetch errors, show a banner inside the screen (not replacing the whole screen): "Couldn't load member list. Pull to retry." If the error persists, the React error boundary (see Section 6) will catch it.

**Accessibility:** QR code: `accessibilityLabel="QR code for [event name]. Tap to view fullscreen."` Lock button: `accessibilityRole="button"`, `accessibilityHint="Locks the group so you can begin splitting the bill"`.

**REALTIME LIFECYCLE — required:**
- Subscribe to Realtime channel on screen MOUNT (not on component render)
- Store the channel reference: `const channel = supabase.channel(...)`
- On screen UNMOUNT: call `channel.unsubscribe()` and `supabase.removeChannel(channel)`
- This prevents memory leaks and stale WebSocket connections when navigating away
- Test: mount EventDetailScreen → navigate away → verify no active Realtime subscriptions remain
  (check with `supabase.getChannels()` — should return empty array after unmount)

This applies to both the joining phase (channel `event-members:{eventId}`, subscribed to `participants` table by `event_id`) and the settlement phase (channel `event-settlement:{eventId}`, subscribed to `participants` payment_status changes). In both phases, the channel must be unsubscribed when the screen unmounts. Unsubscribe from `event-members:{eventId}` when Creator locks the event; unsubscribe from `event-settlement:{eventId}` when the event settles.

---

#### ReceiptScanScreen

- **Native document scanner** via `react-native-document-scanner-plugin` (VisionKit on iOS, ML Kit on Android). Opens automatically on screen mount.
- Does **not** use a custom `expo-camera` preview — the OS scanner UI handles live edge detection, crop, and dewarp.
- On scan success → navigate to `ReceiptPreviewScreen` with `imageUri`.
- On scan cancel → `navigation.goBack()`.
- Brief loading state ("Opening scanner…") while the native module launches.
- "Enter total manually" link → `SplitEntryScreen` with `mode: 'manual'`.

**Error state — permission denied (Android):** Show inline error with "Try again" and manual-entry link.

**Error state — scanner unavailable:** Inline error with retry + manual entry. Does not crash the app.

**Dev requirement:** Requires a development build (not Expo Go). Config plugin in `app.config.js`.

**Accessibility:** Manual entry link: `accessibilityRole="button"`, `accessibilityLabel="Skip scanner and enter total manually"`.

---

#### ReceiptPreviewScreen

- Full-screen dark layout with cropped receipt preview (`Image`, `resizeMode="contain"`).
- Subtitle: confirm receipt is fully visible before processing.
- **Use this photo** → compress (`expo-image-manipulator`, max 1200px, JPEG 0.7) → `POST /receipts/upload-url` → PUT to signed URL → `POST /receipts/parse` → `ItemReviewScreen`.
- **Retake** → `ReceiptScanScreen` (re-opens native scanner).
- **Enter total manually** → `SplitEntryScreen` manual mode.

**Loading state:** "Uploading receipt…" overlay — rgba(0,0,0,0.6), white spinner centred.

**Error state — upload failure:** Red banner with message + "Retry upload" (re-PUT only, reuse signed URL and compressed URI in state).

**Error state — no connectivity:** Banner: "No connection. Connect to the internet to upload your receipt." Retry when online.

**Error state — AI parse failure (E07-S02+):** Handled after upload on parse step — see ItemReview error handling.

**Accessibility:** Preview image: `accessibilityLabel="Scanned receipt preview"`. Use this photo: `accessibilityLabel="Use this photo and upload receipt"`. Retake: `accessibilityLabel="Retake receipt scan"`.

---

#### ItemReviewScreen

**Path:** `mobile/src/screens/receipts/ItemReviewScreen.tsx` · **UI:** `ReceiptReviewSlip` (`mobile/src/components/receipts/ReceiptReviewSlip.tsx`)

Receipt-slip layout on `AuthGradientLayout`: warm paper card on teal gradient. Compact lines by default (name + amount like a thermal receipt); **tap a line** to expand inline edit (name, qty stepper, price). Swipe left on compact food rows to delete.

- Food lines from parse (`items` → `is_fee = false` in DB)
- Fee/surcharge lines from `additional_charges` (`is_fee = true` in DB)
- **+ Add line** / **+ Add fee or surcharge** on the slip
- Tax and tip editable on slip footer; subtotal + fees + grand total computed live
- Low-confidence items: amber row + **Check** chip (`confidence: 'low'`)
- Pull-to-refresh → `GET /events/:id` → applies `receipt_review` (does **not** re-run A1)
- CTA: **Looks good → assign shares** → `POST /api/v1/receipts/confirm` → `SplitEntryScreen` (`mode: 'itemised'`)

Entry: after `POST /receipts/parse` (`ReceiptPreviewScreen`) or from Event Detail **Review items** / **Edit share** (uses `receipt_review` snapshot).

**Error state:** If confirm fails: "Couldn't save items. Check your connection and try again." Local edits preserved.

**Accessibility:** Compact row: `accessibilityLabel="[Item name], tap to edit"`. Expanded name field: `accessibilityLabel="[Item name], edit name"`. Swipe delete: `accessibilityLabel="Delete [item name]"`. Confirm: `accessibilityLabel="Confirm items"`.

---

#### SplitEntryScreen

- Four tabs: `= Even` | `$ Amount` | `% Percent` | `⅟ Portion`
- Participant list below tabs (populated from `currentEventParticipants` in `useEventStore`)
- Live progress bar + "allocated / total" counter
- NLP input field below participant list: "Describe who had what..."
- CTA: "Review split →" → POST `/split/calculate` → SplitReviewScreen
- CTA locked until sum constraint satisfied (see Section 4 for per-tab rules)

**Item assignment drag-and-drop (accessible from "Assign items" button):**
- Library: `react-native-draggable-flatlist` (v4+)
- Pattern: Each participant has a drop zone. Receipt items are draggable rows.
- On drag end: call `onDragEnd({ data })` to update local assignment state
- Haptic feedback on pick-up: `expo-haptics` `Haptics.impactAsync(ImpactFeedbackStyle.Medium)`
- Visual: dragged item shows 1.05 scale + shadow elevation, drop zones highlight on hover
- Install: `npx expo install react-native-draggable-flatlist expo-haptics`

**Error state:** If the POST to `/split/calculate` fails: "Couldn't calculate split. Check your connection and try again." The user's tab selections and inputs are preserved.

**Accessibility:** Tab bar: each tab `accessibilityRole="tab"`. Participant rows within each tab: see Section 4 for tab-specific accessibility labels.

---

#### SplitReviewScreen

- Per-person breakdown table: name | items | subtotal | tax+tip share | **total**
- Edit individual amounts inline (tapping a row opens a numeric input sheet)
- Sum invariant display at bottom: "Total: $X.XX ✓" (turns red if out of balance)
- "Preview messages" link → MessagePreviewModal for a selected participant
- CTA: "Send to all →" → POST `/messages/send` → MessageSendingScreen

**Loading state (skeleton):**
- Four grey rows (height 60px each) with pulsing animation, representing per-person rows.

**Error state:** If the POST to `/messages/send` fails: "Messages failed to send. Tap to retry." with a prominent retry button. Do not navigate away — keep the user on SplitReviewScreen with their data intact.

**Accessibility:** Each person row: `accessibilityRole="button"`, `accessibilityLabel="[Name], owes [amount]"`, `accessibilityHint="Tap to edit this person's amount"`.

---

#### MessageSendingScreen

- Title: "Sending messages..."
- Scrollable list of participants, each with a spinner that becomes a green ✓ as delivery confirms
- Powered by Supabase Realtime on `participants.message_delivered_at`
- "All sent!" state with confetti animation (lottie or simple)
- "Done" button → navigate back to EventDetailScreen (settlement phase)

**Error state:** If a message fails to deliver for a specific participant, their row shows a red ✗ and a "Retry" button next to their name. The overall flow continues for other participants — a single failure does not block the rest. After all attempts complete, show "X messages failed to send. Tap to retry." at the bottom if any failures exist.

**Accessibility:** Each participant row: `accessibilityLabel="[Name] — message [sending | sent | failed]"`. The row state updates are announced via `accessibilityLiveRegion="polite"`.

---

> **Removed:** Separate **SettlementTab** / `SettlementScreen` (four-tab ledger). Cross-event balances and counterparty drill-down live on **HomeStack** per E09-S03. `settlementStore` caches counterparties and detail payloads.

---

### ProfileStack

#### ProfileScreen

- User avatar (coloured circle with initials) + display name + phone
- Payment handles section: list of handles with provider icons, drag to reorder, swipe to delete
- "+ Add payment method" → AddHandleScreen
- "Edit name" inline — on save, `PATCH /users/me` updates `users.display_name` and the backend syncs all linked `participants.display_name` rows. Other users' event member lists show the new name (Realtime on participant `UPDATE` + live resolution on `GET /events/:id`). No per-event rename UI.
- "Enable notifications" link → triggers `Notifications.requestPermissionsAsync()` (only shown if permission is not yet granted)
- "Delete account" link (destructive, at bottom, requires confirmation) → DeleteWarnScreen

**Error state:** If handle list fails to load: "Couldn't load payment methods. Pull to retry."

---

#### AddHandleScreen

- Provider picker: Venmo | PayPal | Cash App | Zelle | Wise | Other
- Handle input (adapts placeholder based on provider: "@username", "paypal.me/username", "$cashtag", etc.)
- Provider-specific format hint below input
- "Save" → POST `/users/me/handles` → navigate back to ProfileScreen → toast "✓ [Provider] handle saved"

**Error state:** If POST fails: "Couldn't save. Check your connection and try again." Preserve the entered handle.

---

#### Delete Account Flow

**DeleteWarnScreen:**
- Warning: "This will permanently delete your account, payment handles, and all your data."
- Lists what will be deleted (account, payment handles, event history, message history)
- "Cancel" (safe, goes back) | "Continue →" (proceeds to DeleteConfirmScreen)

**DeleteConfirmScreen:**
- "Are you absolutely sure?"
- Requires the user to type "DELETE" into a text field to confirm
- "Delete my account" CTA (red, only enabled when "DELETE" typed) → DELETE `/users/me`
- On success → DeletedScreen

**DeletedScreen:**
- "Account deleted"
- "Your data has been removed. Thank you for using LetsSplyt."
- No navigation — app resets to AuthStack (PhoneEntryScreen) after 3 seconds

---

### Modal Screens

#### CreateEventModal (sheet, half-screen)

- Event name input (autofocus)
- Optional date picker
- "Create event →" → POST `/events` → dismiss modal → navigate to QRDisplayModal

**Error state:** If POST fails: inline error below the input: "Couldn't create event. Try again."

#### QRDisplayModal (fullscreen)

- Large QR code centred
- Event name and payer name above
- "Copy link" and "Share" buttons below
- "Close" (X) top right → dismiss
- Shows "Expired" state with "Regenerate" button when token TTL elapsed

#### AddParticipantModal (sheet)

- Two-choice: "From contacts 📱" | "Enter manually ✏️"
- Contacts picker: native contact picker (`expo-contacts`), pre-fills name + phone
- Manual: name fields + phone input with country code picker
- "Name only (no phone)" toggle — disables phone field
- "Add to group" CTA

Both phone paths call `POST /events/:id/participants/manual` with `join_method='manual_phone'`. Backend behaviour (E05-S04): if the phone matches an existing LetsSplyt user, that user is linked via `user_id` and will see the event under **Events you joined** on login — no OTP. If not registered, `guest_pii` stores the number for SMS only; no account is created until the person verifies via OTP elsewhere.

**On success:** Toast at bottom: "✓ [Name] added". Participant appears immediately in member list (optimistic UI).

**On failure:** Toast: "Failed to add [Name] — tap to retry."

#### MessagePreviewModal (sheet, tall)

- Shows one participant's full message text
- Highlighted split image preview
- Payment link buttons (non-tappable in preview mode, greyed)
- "← Back" | "→ Next participant" navigation

#### ConfirmPaymentModal (sheet)

- Shows participant name, amount, self-reported method, timestamp
- "Confirm — mark as settled ✓" (green) and "Dispute ✕" (red outline) buttons

**Error state — confirm failure:** "Couldn't update. Check your connection."

**Error state — dispute failure:** "Couldn't update. Check your connection."

#### EditSplitModal (sheet)

- Same as SplitReviewScreen but in modal presentation
- Warning banner: "Some participants may have already paid. Only affected participants will be notified."

---

### Web Join Flow

When someone scans the QR code or taps a join link, a **server-rendered web page** opens at `[APP_DOMAIN]/join/:token` (not part of the React Native app).

**Registration rule:** OTP verification on web join **creates or resolves a `users` account** (same as app Get Started). The browser-entered `display_name` is persisted to `users.display_name` and `participants.display_name` (placeholder profiles are upgraded). The participant row uses `user_id`, not `guest_pii`. Installing the app later uses the same phone — no name re-entry; joined events appear on the dashboard. **Pure guests** (`guest_pii` only) exist only when the payer manually adds a phone without OTP.

**App-installed decision branch:**
- App installed → Universal Link / App Link intercepts URL → opens app to AppJoinScreen
- App not installed → browser opens the web join page

**Join form (browser):**
- Event name and organiser
- Name + phone + country code
- "Join →" → OTP sent via Twilio
- If already a registered user linked to this event → success page immediately (no OTP)

**OTP screen:**
- 6-digit code entry
- On verify → `resolveUserAfterOtp` + participant insert with `user_id`
- Legacy guest rows for the same phone are upgraded automatically

**Joined success screen:**
- "You're in! 🎉" header
- Shows event name + creator name
- Shows the participant's own share (if already calculated) OR "Your share will be sent once the bill is split"
- Payment handle list (from the creator's profile)
- "Download LetsSplyt" banner (soft prompt, not blocking)
- If event already locked: show WebLockedScreen instead

**WebLockedScreen — arrived after group was locked:**
- "This group has been locked" message
- "Ask [Creator Name] to reopen the join window if you'd like to be added"
- No join CTA
- "Download LetsSplyt" banner

**AppJoinScreen (in-app, Universal Link fires):**
- "You've been invited to join [Event Name]" header
- Creator name and avatar
- Phone number pre-filled (from user's logged-in account)
- "Join as [Name] →" CTA → POST `/api/v1/join/:token` with body `{ user_id: supabase_uid }` (the combined mobile join endpoint — NOT the multi-step web flow)
- If user not logged in → redirect to PhoneEntryScreen first, then return here
- On success → AppJoinedScreen

**AppJoinedScreen:**
- "You've joined! 🎉"
- Shows event name + estimated share (if bill not yet split) or actual share
- "View event →" → deep links to EventDetailScreen

**AppLockedScreen:**
- "This group is no longer accepting new members"
- "Ask [Creator Name] to reopen the join window"
- "Go home →" → HomeTab

---

## 4. All Four Split Modes

SplitEntryScreen presents four tabs. The "Review split →" CTA is locked until each tab's sum constraint is satisfied.

---

### Tab 1 — Even (=)

**Behaviour:**
- Divides the total bill equally among all participants
- No input required from the user — all fields are locked/read-only
- Each person's share is shown updating live as participants are added or removed from the event
- Formula: `sharePerPerson = total / participantCount` (rounded using largest-remainder method to ensure shares sum exactly to the total)
- Pre-selected by default when entering SplitEntryScreen from the manual-total path

**UI:**
- Participant list: each row shows avatar | name | computed share (e.g. "$14.17")
- No editable inputs
- Bottom counter: "4 people — $14.17 each" (updates live)

**Submit condition:** Always satisfied — no user input required, CTA is immediately enabled.

**Accessibility:** Each row: `accessibilityLabel="[Name], [amount] — equal share"`. Bottom counter: `accessibilityLiveRegion="polite"` so VoiceOver announces changes when participants are added.

---

### Tab 2 — Amount ($)

**Behaviour:**
- Each participant gets a numeric input field for their exact dollar amount
- The user types each person's exact share
- Running total shown below the list: "Allocated: $X.XX / Total: $Y.YY"
- Submit is locked until: `|sum(allocations) - total| ≤ 0.01`
- Any rounding difference within ±$0.01 is auto-assigned to the creator (they absorb the rounding)

**UI:**
- Participant list: each row shows avatar | name | `TextInput` (numeric keyboard, prefixed with currency symbol)
- "Allocated: $X.XX / Total: $Y.YY" counter below the list, turns green when balanced, red when over/under
- Running difference shown: "+ $3.50 remaining" or "- $1.20 over" in small text below the counter

**Submit condition:** CTA enabled only when `|allocatedTotal - billTotal| ≤ 0.01`.

**Accessibility:** Each input: `accessibilityLabel="Amount for [name]"`, `accessibilityHint="Enter the exact dollar amount this person owes"`. Counter: `accessibilityLiveRegion="polite"`.

---

### Tab 3 — Percent (%)

**Behaviour:**
- Each participant gets a percentage input field
- The percentage total must equal exactly 100%
- System calculates each person's dollar amount from their percentage: `amount = (percentage / 100) × total`
- Both the percentage and the computed dollar amount are shown per person
- **Largest-remainder rounding** is applied when converting percentages to dollar amounts to ensure the sum of all dollar amounts equals the bill total exactly

**Largest-remainder rounding algorithm:**
```typescript
function largestRemainderRound(percentages: number[], total: number): number[] {
  const rawAmounts = percentages.map(p => (p / 100) * total);
  const floored = rawAmounts.map(a => Math.floor(a * 100) / 100);
  const remainders = rawAmounts.map((a, i) => a - floored[i]);
  const floredSum = floored.reduce((a, b) => a + b, 0);
  let deficit = Math.round((total - floredSum) * 100); // in cents
  const indices = remainders
    .map((r, i) => ({ r, i }))
    .sort((a, b) => b.r - a.r)
    .map(x => x.i);
  const result = [...floored];
  for (let j = 0; j < deficit; j++) {
    result[indices[j]] = Math.round((result[indices[j]] + 0.01) * 100) / 100;
  }
  return result;
}
```

**UI:**
- Participant list: each row shows avatar | name | `TextInput` (%) | computed dollar amount (greyed, read-only)
- Percentage total counter below list: "Total: X%" — turns green at 100%, red above/below
- Dollar amounts update live as percentages change

**Submit condition:** CTA enabled only when `Math.round(sum(percentages)) === 100`.

**Accessibility:** Each percentage input: `accessibilityLabel="Percentage for [name]"`. Computed dollar amount: `accessibilityLabel="[Name]'s share — [dollar amount]"`. Counter: `accessibilityLiveRegion="polite"`.

---

### Tab 4 — Portions (⅟)

**Behaviour:**
- Each participant gets a whole-number input (minimum 1, no maximum)
- System divides proportionally by portion count: `share = (portions / totalPortions) × total`
- **Largest-remainder rounding** applied (same algorithm as Percent tab above, applied to the resulting dollar amounts)

**Example:** Bill = $100.00. Three people, portions 1 + 1 + 2 = 4 total.
- Person A: 1/4 = 25% → $25.00
- Person B: 1/4 = 25% → $25.00
- Person C: 2/4 = 50% → $50.00

**Example with rounding:** Bill = $10.00. Three people, portions 1 + 1 + 1 = 3 total.
- Raw shares: $3.333..., $3.333..., $3.333...
- After largest-remainder: $3.34, $3.33, $3.33 (one person absorbs the penny — determined by largest remainder)

**UI:**
- Participant list: each row shows avatar | name | stepper control (− | [number] | +) | computed dollar amount (greyed, read-only)
- Stepper minimum value: 1 (cannot go below 1)
- Stepper buttons are 44×44pt minimum touch targets
- Below list: "X total portions" counter
- Dollar amounts update live as portions change

**Submit condition:** Always satisfied when all participants have at least 1 portion (which is the default). CTA is immediately enabled on tab entry.

**Accessibility:** Each stepper: `accessibilityRole="adjustable"`, `accessibilityLabel="Portions for [name]"`, `accessibilityValue={{ text: "[N] portion(s)" }}`. Use `accessibilityIncrement` and `accessibilityDecrement` for VoiceOver swipe-up/down adjustment.

---

## 5. Offline Behaviour

Use `@react-native-community/netinfo` to detect connectivity. On connectivity loss, show the red banner described in Section 3.

### Per-Feature Offline Behaviour

**Receipt scan (ReceiptScanScreen → ReceiptPreviewScreen):**
- Native document scanner works offline (cropped image saved locally as `imageUri`)
- Upload on ReceiptPreviewScreen requires connectivity
- Behaviour: user confirms scan on preview screen; on network failure show banner: "No connection. Connect to the internet to upload your receipt." Compressed URI held in state for retry.
- The image URI is stored in component state. When the user reconnects (detected via NetInfo), show a toast: "Connection restored. Tap to upload your photo." with a retry button.
- Do not auto-retry silently — require explicit user action to re-upload.

**Viewing event details (EventDetailScreen):**
- Cached data is shown (React Query cache, `staleTime: 5 minutes`)
- Show a non-blocking amber banner below the screen header (not the connectivity banner): "Last updated [X] minutes ago"
- Realtime subscription will reconnect automatically when connectivity is restored
- Actions (Lock group, Confirm, Dispute, Nudge) are disabled when offline — show tooltip: "Reconnect to take this action"

**Settlement actions (ConfirmPaymentModal, dispute):**
- Queue locally using `expo-sqlite` — store the action type, participant ID, event ID, and timestamp
- Show toast: "Your confirmation will be sent when you reconnect"
- When connectivity is restored, process the queue silently and notify the user: "Your [confirmation / dispute] was sent."
- If the queued action fails when synced (e.g. status changed in the meantime), show: "Couldn't apply your action — it may have been handled already. Pull to refresh."

**OTP send/verify:**
- Hard block — show a modal error: "Internet connection required to send verification codes." No queueing.

**"Send to all" messages:**
- Hard block — show a modal: "Internet connection required to send payment messages." No queueing.

### Offline Queue Schema (expo-sqlite)

```typescript
// Offline queue table (expo-sqlite, created on app startup)
db.execSync(`
  CREATE TABLE IF NOT EXISTS offline_queue (
    id          TEXT PRIMARY KEY,           -- UUID
    type        TEXT NOT NULL,              -- 'self_report' | 'payment_confirmed' | 'nudge'
    payload     TEXT NOT NULL,             -- JSON serialised request body
    endpoint    TEXT NOT NULL,             -- '/settlement/:participantId/self-report'
    method      TEXT NOT NULL DEFAULT 'POST',
    created_at  TEXT NOT NULL,             -- ISO 8601
    retry_count INTEGER NOT NULL DEFAULT 0,
    last_error  TEXT                       -- last error message for debugging
  );
`);

// Queue processor — runs when network connectivity restored
async function processOfflineQueue(session: Session): Promise<void> {
  const items = db.getAllSync<OfflineQueueRow>('SELECT * FROM offline_queue ORDER BY created_at ASC');

  for (const item of items) {
    try {
      await apiRequest(item.endpoint, {
        method: item.method as 'POST' | 'PATCH',
        body: item.payload,
        session,
      });
      db.runSync('DELETE FROM offline_queue WHERE id = ?', [item.id]);
    } catch (err) {
      db.runSync(
        'UPDATE offline_queue SET retry_count = retry_count + 1, last_error = ? WHERE id = ?',
        [(err as Error).message, item.id]
      );
    }
  }
}
```

**Read operations (lists, balances):**
- Serve from React Query cache (`staleTime: 5 minutes`, `gcTime: 30 minutes`)
- Show "Last updated X minutes ago" in a non-blocking amber banner

**Write operations (creating events, adding participants, saving handles):**
- Queue locally using `expo-sqlite`, retry on reconnect
- Show toast: "Saved locally. Will sync when you reconnect."

---

## 6. Error Boundaries

React error boundaries catch JavaScript errors during rendering. Without them, a crash in any component tears down the entire screen (and in some cases the entire app) with a blank white screen and no recovery path.

### Root-Level Error Boundary

Wrap the entire app. Catches any error not caught by a more specific boundary.

```typescript
// mobile/src/components/RootErrorBoundary.tsx
import React, { Component, ReactNode } from 'react';
import { View, Text, Pressable, StyleSheet } from 'react-native';

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

export class RootErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, info: React.ErrorInfo) {
    // Log to crash reporting service (e.g. Sentry)
    console.error('RootErrorBoundary caught:', error, info);
  }

  handleRestart = () => {
    // Reset state — the user must manually restart the app
    // In Expo Go: show instructions. In production build: use expo-updates to reload.
    this.setState({ hasError: false, error: null });
  };

  render() {
    if (this.state.hasError) {
      return (
        <View style={styles.container}>
          <Text style={styles.title}>Something went wrong</Text>
          <Text style={styles.body}>Please close and reopen the app to continue.</Text>
          <Pressable
            style={styles.button}
            onPress={this.handleRestart}
            accessibilityRole="button"
            accessibilityLabel="Try again"
          >
            <Text style={styles.buttonText}>Try again</Text>
          </Pressable>
        </View>
      );
    }
    return this.props.children;
  }
}

const styles = StyleSheet.create({
  container: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24, backgroundColor: '#F8FAFC' },
  title: { fontSize: 20, fontWeight: '700', color: '#0F172A', marginBottom: 12 },
  body: { fontSize: 15, color: '#64748B', textAlign: 'center', marginBottom: 32 },
  button: { backgroundColor: '#6366F1', paddingHorizontal: 24, paddingVertical: 12, borderRadius: 8 },
  buttonText: { color: '#FFFFFF', fontWeight: '600', fontSize: 15 },
});
```

**Usage in `App.tsx`:**
```typescript
<RootErrorBoundary>
  <NavigationContainer>
    <RootNavigator />
  </NavigationContainer>
</RootErrorBoundary>
```

---

### EventDetailScreen Error Boundary

Wraps the member list (Supabase Realtime subscription). A subscription error will not crash the entire screen — only the member list area is replaced with an error state.

```typescript
// mobile/src/screens/EventDetail/MemberListErrorBoundary.tsx
import React, { Component, ReactNode } from 'react';
import { View, Text, Pressable } from 'react-native';

interface Props {
  children: ReactNode;
  onRetry: () => void;
}

interface State {
  hasError: boolean;
}

export class MemberListErrorBoundary extends Component<Props, State> {
  state: State = { hasError: false };

  static getDerivedStateFromError(): State {
    return { hasError: true };
  }

  componentDidCatch(error: Error) {
    console.error('MemberListErrorBoundary:', error);
  }

  render() {
    if (this.state.hasError) {
      return (
        <View style={{ padding: 16, alignItems: 'center' }}>
          <Text style={{ color: '#64748B', marginBottom: 12 }}>
            Couldn't load member list. Pull to retry.
          </Text>
          <Pressable
            onPress={() => {
              this.setState({ hasError: false });
              this.props.onRetry();
            }}
            accessibilityRole="button"
            accessibilityLabel="Retry loading member list"
          >
            <Text style={{ color: '#6366F1', fontWeight: '600' }}>Retry</Text>
          </Pressable>
        </View>
      );
    }
    return this.props.children;
  }
}
```

---

### ReceiptScanScreen Error Boundary

Wraps the camera component. Camera permission errors, hardware errors, and Expo Camera crashes are caught here.

```typescript
// mobile/src/screens/ReceiptScan/CameraErrorBoundary.tsx
import React, { Component, ReactNode } from 'react';
import { View, Text, Pressable } from 'react-native';

interface Props {
  children: ReactNode;
  onManualEntry: () => void;
}

interface State {
  hasError: boolean;
}

export class CameraErrorBoundary extends Component<Props, State> {
  state: State = { hasError: false };

  static getDerivedStateFromError(): State {
    return { hasError: true };
  }

  componentDidCatch(error: Error) {
    console.error('CameraErrorBoundary:', error);
  }

  render() {
    if (this.state.hasError) {
      return (
        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24 }}>
          <Text style={{ fontSize: 18, fontWeight: '600', color: '#0F172A', marginBottom: 8 }}>
            Camera unavailable
          </Text>
          <Text style={{ color: '#64748B', textAlign: 'center', marginBottom: 24 }}>
            The camera couldn't be started. You can enter your total manually instead.
          </Text>
          <Pressable
            style={{ backgroundColor: '#6366F1', paddingHorizontal: 24, paddingVertical: 12, borderRadius: 8 }}
            onPress={this.props.onManualEntry}
            accessibilityRole="button"
            accessibilityLabel="Enter total manually"
          >
            <Text style={{ color: '#FFFFFF', fontWeight: '600' }}>Enter total manually</Text>
          </Pressable>
        </View>
      );
    }
    return this.props.children;
  }
}
```

---

### Generic ErrorBoundary (wrap every navigator stack)

```typescript
// src/components/ErrorBoundary.tsx
import React from 'react';
import { View, Text, Button } from 'react-native';

interface State { hasError: boolean; error?: Error }

export class ErrorBoundary extends React.Component<
  React.PropsWithChildren<{ fallbackLabel?: string }>,
  State
> {
  state: State = { hasError: false };

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, info: React.ErrorInfo) {
    // Log to Sentry in production
    console.error('ErrorBoundary caught:', error, info);
  }

  render() {
    if (this.state.hasError) {
      return (
        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24 }}>
          <Text style={{ fontSize: 18, fontWeight: '600', marginBottom: 8 }}>
            Something went wrong
          </Text>
          <Text style={{ color: '#6B7280', marginBottom: 24, textAlign: 'center' }}>
            {this.props.fallbackLabel ?? 'Please try again'}
          </Text>
          <Button
            title="Try Again"
            onPress={() => this.setState({ hasError: false })}
          />
        </View>
      );
    }
    return this.props.children;
  }
}

// Usage — wrap every stack:
// <ErrorBoundary fallbackLabel="Error loading settlement">
//   <SettlementStack />
// </ErrorBoundary>
```

---

## 7. Push Notifications

### First-Time Permission Flow

Described in Section 3 (PushPermissionScreen). The screen appears once — after the first successful OTP verification.

### Token Lifecycle

- **Registration:** On permission grant, call `Notifications.getExpoPushTokenAsync()` → POST `/users/me/push-token` with body `{ device_id, token, platform }` → store token server-side linked to the user record
- **Refresh:** Expo push tokens can change. On each app launch, call `getExpoPushTokenAsync()` and POST `/users/me/push-token` if the token has changed (compare against the token last stored server-side, not AsyncStorage)
- **Revocation:** If the user revokes notification permission in device settings, future pushes will silently fail. No special handling needed — the server will receive a delivery failure and can flag the token as stale

### Push Notification Handlers (foreground, background, and killed state)

```typescript
// Push notification handler setup (call once in App.tsx useEffect)
export function setupPushNotificationHandlers() {
  // FOREGROUND: app is open and visible
  Notifications.setNotificationHandler({
    handleNotification: async (notification) => ({
      shouldShowAlert: true,   // Show banner even when app is open
      shouldPlaySound: true,
      shouldSetBadge: true,
      shouldShowBanner: true,
      shouldShowList: true,
    }),
  });

  // FOREGROUND TAP: user taps notification while app is open
  const foregroundSub = Notifications.addNotificationResponseReceivedListener(response => {
    const data = response.notification.request.content.data;
    handleNotificationNavigation(data);
  });

  // BACKGROUND: app is in background, notification received
  // Handled by Expo's background notification handler — no JS code needed
  // Tapping the notification brings app to foreground and triggers response listener above

  // KILLED STATE: app was closed
  // Handled by getInitialURL() in the linking config above

  return () => foregroundSub.remove();
}

// Navigate based on notification data
function handleNotificationNavigation(data: Record<string, unknown>) {
  if (!navigationRef.current) return;

  if (data.type === 'nudge' && data.eventId) {
    navigationRef.current.navigate('MainTabs', {
      screen: 'EventsTab',
      params: { screen: 'EventDetail', params: { eventId: data.eventId as string } },
    });
  } else if (data.type === 'payment_confirmed' && data.eventId) {
    navigationRef.current.navigate('MainTabs', {
      screen: 'EventsTab',
      params: { screen: 'EventDetail', params: { eventId: data.eventId as string } },
    });
  }
}

// Push token registration
export async function registerPushToken(userId: string): Promise<void> {
  const { status: existingStatus } = await Notifications.getPermissionsAsync();
  let finalStatus = existingStatus;

  if (existingStatus !== 'granted') {
    const { status } = await Notifications.requestPermissionsAsync();
    finalStatus = status;
  }

  if (finalStatus !== 'granted') return; // User denied — do not store token

  const token = (await Notifications.getExpoPushTokenAsync({
    projectId: Constants.expoConfig?.extra?.eas?.projectId,
  })).data;

  // Store token via API — POST /users/me/push-token (NOT PATCH /users/me)
  // PATCH /users/me does NOT accept expo_push_token
  await api.post('/users/me/push-token', {
    device_id: await Device.getDeviceIdAsync(), // from expo-device
    token,
    platform: Platform.OS as 'ios' | 'android',
  });
}
```

### Notification Types

| Type | Trigger | Title | Body |
|------|---------|-------|------|
| `self_report_received` | Participant taps "I paid" | "💸 Payment reported" | "[Name] says they paid $X via [method]. Confirm?" |
| `nudge_reminder` | T+48h after send, if pending payers remain | "⏰ Pending payments" | "N people haven't paid yet. Want to send a nudge?" |
| `revision_received` | Payer edits split post-send | "📋 Your share was updated" | "Your share in [Event] is now $X (was $Y)." |
| `payment_confirmed` | Payer confirms a self-report | "✅ Payment confirmed" | "[Creator] confirmed your payment for [Event]." |
| `payment_disputed` | Payer disputes a self-report | "⚠️ Payment disputed" | "[Creator] has a question about your payment for [Event]. Check the app." |

### Biometric Authentication (Subsequent Launches)

After a user's first successful login and OTP verification:

1. Prompt to enable biometric: "Use Face ID / fingerprint to log in faster?" with "Enable" and "Not now" options
2. Store preference in AsyncStorage (`biometric_enabled: true | false`) — this is a UX preference, not a secret. Use AsyncStorage (not SecureStore). SecureStore is reserved for Supabase auth tokens only.
   ```typescript
   // CORRECT
   await AsyncStorage.setItem('biometric_enabled', 'true');
   const val = await AsyncStorage.getItem('biometric_enabled');
   await AsyncStorage.removeItem('biometric_enabled');
   // WRONG — do NOT use SecureStore for this preference
   // await SecureStore.setItemAsync('biometric_enabled', ...)
   ```
3. On subsequent app launches, if `biometric_enabled === true`:

```typescript
// Check for biometric availability before attempting auth
const { isEnrolled } = await LocalAuthentication.isEnrolledAsync();
const { isAvailable } = await LocalAuthentication.hasHardwareAsync();

if (!isAvailable) {
  // Device has no biometric hardware — hide biometric option entirely
  return;
}

if (!isEnrolled) {
  // User previously enrolled but has since removed their biometrics from device settings
  // (e.g. removed all fingerprints). The biometric session token is now invalid.
  // Action: clear stored biometric preference (AsyncStorage), fall back to OTP login
  await AsyncStorage.removeItem('biometric_enabled'); // biometric_enabled is a UX preference — AsyncStorage only
  await SecureStore.deleteItemAsync('supabase_session');
  // Navigate to PhoneEntryScreen with a toast: "Please re-verify your phone number"
  navigation.replace('PhoneEntry', { reason: 'biometric_unenrolled' });
  return;
}
```

   - Call `LocalAuthentication.authenticateAsync({ promptMessage: 'Log in to LetsSplyt' })`
   - On success: restore session from `useAuthStore` (session was persisted via SecureStore by the Supabase client)
   - On failure (wrong biometric): increment a failure counter in component state
   - After 3 consecutive failures: fall back to PhoneEntryScreen → OTP flow silently (no error message about the biometric — just show the login screen)
4. If `LocalAuthentication.hasHardwareAsync()` returns `false`: skip biometric entirely, go to session check
5. If biometric hardware is available but not enrolled: clear stored biometric preference and fall back to OTP (see re-enrolment edge case above)

**Install:**
```bash
npx expo install expo-local-authentication
```

---

## 8. Accessibility Requirements

These requirements are **App Store requirements** for iOS. Failure to meet them is grounds for App Store rejection. They also apply to Google Play, though enforcement is less strict. Meet the iOS standard and both platforms are covered.

### Interactive Elements

Every interactive element (button, link, input, pressable row) must have:

```typescript
accessibilityLabel="[What this element does — plain language, no jargon]"
accessibilityRole="button" | "link" | "text" | "header" | "image" | "adjustable" | "tab"
accessibilityHint="[What happens when activated — only if not obvious from the label]"
```

**Rules:**
- `accessibilityLabel` replaces the visual text for VoiceOver/TalkBack — write it as you would speak it ("Delete Alice from the group", not "Delete")
- `accessibilityHint` is spoken after a pause — use it for non-obvious outcomes only
- Never use icon names as labels ("trash icon" is wrong; "Delete [name]" is right)
- Currency amounts: speak as "forty-two dollars and fifty cents", not "dollar sign 42.50"

### Touch Target Size

Every interactive element must have a minimum touch target of **44×44 points** (Apple Human Interface Guidelines requirement).

For small elements (e.g. stepper − / + buttons, inline delete icons), add `hitSlop`:

```typescript
<Pressable
  hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
  style={{ width: 24, height: 24 }}
  accessibilityRole="button"
>
```

Or use a container that meets the minimum size:
```typescript
<Pressable style={{ minWidth: 44, minHeight: 44, alignItems: 'center', justifyContent: 'center' }}>
```

### Dynamic Type (Text Scaling)

All text must scale with the user's system font size preference. **Never use fixed font sizes without `allowFontScaling`.**

```typescript
// Correct — scales with system setting (default behaviour)
<Text style={{ fontSize: 15 }}>Hello</Text>

// Correct — explicitly allowed (same as default)
<Text allowFontScaling={true} style={{ fontSize: 15 }}>Hello</Text>

// WRONG — never do this
<Text allowFontScaling={false} style={{ fontSize: 15 }}>Hello</Text>
```

For layouts that break at large text sizes, use `maxFontSizeMultiplier` rather than disabling scaling:
```typescript
<Text maxFontSizeMultiplier={1.5} style={{ fontSize: 13 }}>Label text</Text>
```

### Color Contrast

| Text type | Minimum contrast ratio | Checked against |
|-----------|----------------------|-----------------|
| Normal text (< 18pt, not bold) | 4.5 : 1 | Background |
| Large text (≥ 18pt, or ≥ 14pt bold) | 3 : 1 | Background |
| UI components and graphical objects | 3 : 1 | Adjacent colour |

**Verify using:** [WebAIM Contrast Checker](https://webaim.org/resources/contrastchecker/) or Figma's built-in accessibility plugin.

All colour tokens defined in Section 11 pass WCAG AA contrast requirements when used as specified (e.g. `textPrimary` `#0F172A` on `background` `#F8FAFC` = 18.1 : 1; `textSecondary` `#64748B` on `#FFFFFF` = 4.6 : 1).

**Do not** use `textMuted` (`#94A3B8`) for any text that conveys meaning — it fails 4.5:1 on white. Use it only for purely decorative labels (footer, caption) where the information is also conveyed another way.

### VoiceOver / TalkBack Navigation

All screens must be fully navigable using only VoiceOver (iOS) or TalkBack (Android) — no visual reference required.

**Requirements:**
- All content must be reachable by sequential swipe navigation
- Modal screens must trap focus (VoiceOver cannot swipe outside the modal while it is open)
- Loading states must be announced: `accessibilityLiveRegion="polite"` on the loading indicator
- Dynamic content updates (new participant joined, message delivered) must be announced: `accessibilityLiveRegion="polite"` on the list
- Screen titles must be set via the navigator's `title` option so VoiceOver announces the screen name on navigation

**Test requirement:** Before each release, manually navigate every screen using VoiceOver (iOS) and TalkBack (Android) without looking at the screen. Every action must be completable.

---

## 9. Image Handling

### Compression Before Upload

All receipt images must be compressed before uploading to the AI parse endpoint. Large images cause slow uploads, high Twilio bandwidth costs, and AI timeout errors.

**Library:** `expo-image-manipulator`

**Install:**
```bash
npx expo install expo-image-manipulator
```

**Compression logic:**

```typescript
// mobile/src/utils/compressImage.ts
import * as ImageManipulator from 'expo-image-manipulator';

export async function compressReceiptImage(imageUri: string): Promise<string> {
  // First pass: resize to 1200px wide, compress to 0.8 quality
  let compressed = await ImageManipulator.manipulateAsync(
    imageUri,
    [{ resize: { width: 1200 } }],
    { compress: 0.8, format: ImageManipulator.SaveFormat.JPEG }
  );

  // Check if still > 500KB
  const response = await fetch(compressed.uri);
  const blob = await response.blob();
  const sizeKB = blob.size / 1024;

  if (sizeKB > 500) {
    // Second pass: compress harder
    compressed = await ImageManipulator.manipulateAsync(
      compressed.uri,
      [], // no resize — already resized
      { compress: 0.6, format: ImageManipulator.SaveFormat.JPEG }
    );
  }

  return compressed.uri;
}
```

**Usage in ReceiptScanScreen:**

```typescript
const handleCapture = async (photo: CameraPhoto) => {
  setIsProcessing(true);
  try {
    const compressedUri = await compressReceiptImage(photo.uri);
    const formData = new FormData();
    formData.append('receipt', {
      uri: compressedUri,
      type: 'image/jpeg',
      name: 'receipt.jpg',
    } as any);
    // CORRECT endpoint: POST /api/v1/events/:eventId/receipt/scan
    // Response includes parse_attempt_id — store in eventStore for use in the confirm call
    const result = await fetch(`${BASE_URL}/events/${eventId}/receipt/scan`, { method: 'POST', body: formData });
    const data = await result.json();
    // data.parse_attempt_id (NOT data.parse_id) — store this for the subsequent confirm call
    // ... handle result
  } catch (err) {
    // ... handle error
  } finally {
    setIsProcessing(false);
  }
};
```

**Target:** < 500KB per upload. The two-pass compression achieves this for virtually all phone camera outputs.

---

## 10. Split Image Specification

### What It Is

A PNG image generated for each participant. Each participant gets their own version — their row is highlighted. This image is attached to the SMS/WhatsApp payment message.

### Generation

**Library:** `react-native-skia` (on mobile, for the sending flow) or `node-canvas` (`@napi-rs/canvas`) on the backend if generating server-side.

**Recommendation:** Generate on the **backend** at message composition time. Saves mobile bandwidth, ensures consistent rendering, and makes the image reusable if the message is resent. Store the generated PNG in Supabase Storage. Use the URL in the Twilio message.

**Image dimensions:** 640px wide × variable height (min 300px, max 1200px). Height = header + (52px × participant count) + footer. Design for SMS preview thumbnail at 320px width — text must be legible at half size.

### Layout

```
┌─────────────────────────────────────────────┐
│  [Event name]                    [Date]      │  ← Header, 60px tall
│  Paid by [Payer name]                        │
├──────────────┬────────────────────┬──────────┤
│  Name        │  Items             │  Amount  │  ← Column headers, 40px
├──────────────┼────────────────────┼──────────┤
│  Alice       │  Pasta, Wine       │  $24.50  │  ← Normal row, 52px
├──────────────┼────────────────────┼──────────┤
│▌ Bob         │  Steak, Beer       │  $38.00  │  ← HIGHLIGHTED row (recipient), 52px
├──────────────┼────────────────────┼──────────┤
│  Carlos      │  Salad             │  $12.50  │  ← Normal row
├──────────────┼────────────────────┼──────────┤
│              │  Tax + Tip         │  $10.20  │  ← Tax/tip row, 44px
├──────────────┼────────────────────┼──────────┤
│              │  TOTAL             │  $85.20  │  ← Total row, bold, 48px
└──────────────┴────────────────────┴──────────┤
│  LetsSplyt • letssplyt.app                   │  ← Footer, 36px
└─────────────────────────────────────────────┘
```

### Colors

| Element | Hex |
|---------|-----|
| Background | `#FFFFFF` |
| Header background | `#6366F1` (indigo) |
| Header text | `#FFFFFF` |
| Column header background | `#F1F5F9` |
| Column header text | `#64748B` |
| Normal row background | `#FFFFFF` |
| Normal row text | `#1E293B` |
| Highlighted row background | `#EEF2FF` (indigo-50) |
| Highlighted row left accent bar | `#6366F1` (4px wide) |
| Highlighted row text | `#3730A3` (indigo-800) |
| Highlighted row amount | `#3730A3`, bold |
| Tax/tip row background | `#F8FAFC` |
| Total row background | `#F1F5F9` |
| Total row text | `#0F172A`, bold |
| Row divider | `#E2E8F0` |
| Footer background | `#F8FAFC` |
| Footer text | `#94A3B8` |

### Typography

| Element | Font | Size | Weight |
|---------|------|------|--------|
| Event name | System default (SF Pro / Roboto) | 18px | 700 |
| "Paid by" subtitle | System default | 13px | 400 |
| Column headers | System default | 12px | 600 |
| Participant names | System default | 14px | 500 |
| Item names | System default | 12px | 400 |
| Amounts | Monospace (Courier / Roboto Mono) | 14px | 600 |
| Highlighted name | System default | 14px | 700 |
| Highlighted amount | Monospace | 14px | 700 |
| Total amount | Monospace | 16px | 700 |
| Footer | System default | 11px | 400 |

### Content Rules

- **Item names:** truncate to 25 characters, add "..." if longer. For multiple items: "Pasta, Wine, Dessert" — truncate the list at 3 items: "Pasta, Wine +2 more"
- **Name column width:** 30% of image width
- **Items column width:** 45% of image width
- **Amount column width:** 25% of image width, right-aligned
- **Long names:** truncate display name to 16 chars
- **Amounts:** always show 2 decimal places, always prefix with currency symbol ($, £, €)
- **Highlighted row accent:** 4px solid indigo bar on the left edge of the row
- **Maximum participants shown:** 12. If group is larger, show top 12 by amount_owed descending, add a final row "＋N more participants"
- **If participant had no items** (even split, or all shared): Items column shows "Even split"

### Generation Code (Backend — Node.js with @napi-rs/canvas)

```typescript
// src/modules/ai/message-composer/split-image.generator.ts
import { createCanvas, GlobalFonts } from '@napi-rs/canvas';
import { uploadToStorage } from '../../../infrastructure/supabase';

interface SplitRow {
  participantId: string;
  displayName: string;
  itemNames: string[];
  amountOwed: number;
  isRecipient: boolean;
}

export interface SplitImageConfig {
  eventTitle: string;
  eventDate: string | null;
  payerName: string;
  currency: string;
  rows: SplitRow[];
  taxAndTip: number;
  total: number;
}

const W = 640;
const HEADER_H = 68;
const COL_HEADER_H = 40;
const ROW_H = 52;
const TAX_ROW_H = 44;
const TOTAL_ROW_H = 48;
const FOOTER_H = 36;
const COL_NAME_W = Math.floor(W * 0.30);   // 192px
const COL_ITEMS_W = Math.floor(W * 0.45);  // 288px
const COL_AMT_W = W - COL_NAME_W - COL_ITEMS_W; // 160px

export async function generateSplitImage(
  config: SplitImageConfig,
  recipientParticipantId: string,
): Promise<string> {
  const rows = config.rows.map(r => ({ ...r, isRecipient: r.participantId === recipientParticipantId }));
  const visibleRows = rows.slice(0, 12);
  const extraCount = rows.length > 12 ? rows.length - 12 : 0;

  const H = HEADER_H + COL_HEADER_H + (visibleRows.length * ROW_H)
          + (extraCount > 0 ? ROW_H : 0)
          + TAX_ROW_H + TOTAL_ROW_H + FOOTER_H;

  const canvas = createCanvas(W, H);
  const ctx = canvas.getContext('2d');

  // --- Header ---
  ctx.fillStyle = '#6366F1';
  ctx.fillRect(0, 0, W, HEADER_H);
  ctx.fillStyle = '#FFFFFF';
  ctx.font = 'bold 18px system-ui';
  ctx.fillText(truncate(config.eventTitle, 35), 16, 26);
  ctx.font = '13px system-ui';
  const dateStr = config.eventDate ? ` • ${config.eventDate}` : '';
  ctx.fillText(`Paid by ${config.payerName}${dateStr}`, 16, 50);

  // --- Column headers ---
  let y = HEADER_H;
  ctx.fillStyle = '#F1F5F9';
  ctx.fillRect(0, y, W, COL_HEADER_H);
  ctx.fillStyle = '#64748B';
  ctx.font = 'bold 12px system-ui';
  ctx.fillText('NAME', 16, y + 26);
  ctx.fillText('ITEMS', COL_NAME_W + 12, y + 26);
  ctx.textAlign = 'right';
  ctx.fillText('AMOUNT', W - 12, y + 26);
  ctx.textAlign = 'left';

  // --- Participant rows ---
  y += COL_HEADER_H;
  for (const row of visibleRows) {
    drawRow(ctx, y, row, config.currency);
    y += ROW_H;
  }

  if (extraCount > 0) {
    ctx.fillStyle = '#FFFFFF';
    ctx.fillRect(0, y, W, ROW_H);
    drawDivider(ctx, y, W);
    ctx.fillStyle = '#94A3B8';
    ctx.font = '13px system-ui';
    ctx.fillText(`＋${extraCount} more participants`, 16, y + 30);
    y += ROW_H;
  }

  // --- Tax + Tip row ---
  ctx.fillStyle = '#F8FAFC';
  ctx.fillRect(0, y, W, TAX_ROW_H);
  drawDivider(ctx, y, W);
  ctx.fillStyle = '#64748B';
  ctx.font = '13px system-ui';
  ctx.fillText('Tax + Tip', COL_NAME_W + 12, y + 28);
  ctx.textAlign = 'right';
  ctx.font = '13px "Courier New"';
  ctx.fillText(formatAmount(config.taxAndTip, config.currency), W - 12, y + 28);
  ctx.textAlign = 'left';
  y += TAX_ROW_H;

  // --- Total row ---
  ctx.fillStyle = '#F1F5F9';
  ctx.fillRect(0, y, W, TOTAL_ROW_H);
  drawDivider(ctx, y, W);
  ctx.fillStyle = '#0F172A';
  ctx.font = 'bold 14px system-ui';
  ctx.fillText('TOTAL', COL_NAME_W + 12, y + 30);
  ctx.textAlign = 'right';
  ctx.font = 'bold 16px "Courier New"';
  ctx.fillText(formatAmount(config.total, config.currency), W - 12, y + 30);
  ctx.textAlign = 'left';
  y += TOTAL_ROW_H;

  // --- Footer ---
  ctx.fillStyle = '#F8FAFC';
  ctx.fillRect(0, y, W, FOOTER_H);
  ctx.fillStyle = '#94A3B8';
  ctx.font = '11px system-ui';
  ctx.fillText('LetsSplyt', 16, y + 23);

  // Upload to Supabase Storage and return public URL
  const buffer = canvas.toBuffer('image/png');
  const path = `split-images/${recipientParticipantId}-${Date.now()}.png`;
  return await uploadToStorage('split-images', path, buffer, 'image/png');
}

function drawRow(ctx: any, y: number, row: SplitRow, currency: string): void {
  if (row.isRecipient) {
    ctx.fillStyle = '#EEF2FF';
    ctx.fillRect(0, y, W, ROW_H);
    ctx.fillStyle = '#6366F1';
    ctx.fillRect(0, y, 4, ROW_H);  // left accent bar
    ctx.fillStyle = '#3730A3';
  } else {
    ctx.fillStyle = '#FFFFFF';
    ctx.fillRect(0, y, W, ROW_H);
    ctx.fillStyle = '#1E293B';
  }

  drawDivider(ctx, y, W);

  // Name
  ctx.font = row.isRecipient ? 'bold 14px system-ui' : '500 14px system-ui';
  ctx.fillText(truncate(row.displayName, 16), 16, y + 32);

  // Items
  ctx.font = '12px system-ui';
  const itemText = formatItems(row.itemNames);
  ctx.fillText(truncate(itemText, 30), COL_NAME_W + 12, y + 32);

  // Amount
  ctx.textAlign = 'right';
  ctx.font = row.isRecipient ? `bold 14px "Courier New"` : `600 14px "Courier New"`;
  ctx.fillText(formatAmount(row.amountOwed, currency), W - 12, y + 32);
  ctx.textAlign = 'left';
}

function drawDivider(ctx: any, y: number, width: number): void {
  ctx.strokeStyle = '#E2E8F0';
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(0, y);
  ctx.lineTo(width, y);
  ctx.stroke();
}

function formatAmount(amount: number, currency: string): string {
  const symbols: Record<string, string> = { USD: '$', GBP: '£', EUR: '€', CAD: 'C$', AUD: 'A$' };
  const symbol = symbols[currency] ?? currency + ' ';
  return `${symbol}${amount.toFixed(2)}`;
}

function formatItems(names: string[]): string {
  if (names.length === 0) return 'Even split';
  if (names.length <= 3) return names.join(', ');
  return `${names.slice(0, 3).join(', ')} +${names.length - 3} more`;
}

function truncate(text: string, maxLen: number): string {
  return text.length > maxLen ? text.slice(0, maxLen - 1) + '…' : text;
}
```

---

## 11. UI Foundations

### Component Library

Use **React Native Paper** (`react-native-paper`) for base components. It provides accessible, well-tested building blocks (Button, TextInput, Card, Chip, FAB, Modal) that match the design tokens below.

```bash
npx expo install react-native-paper react-native-vector-icons
```

Do not use NativeBase, Tamagui, or Gluestack — they add significant bundle size and complexity for MVP.

### Color Tokens

Define these in `/mobile/src/shared/theme.ts` and pass to `PaperProvider`:

```typescript
export const theme = {
  colors: {
    primary: '#6366F1',      // indigo-500 — primary actions, QR, highlights
    primaryDark: '#4F46E5',  // indigo-600 — pressed state
    primaryLight: '#EEF2FF', // indigo-50 — highlighted rows, backgrounds
    secondary: '#7C3AED',    // violet-600 — gradient pair with primary

    success: '#10B981',      // green — confirmed payment, settled
    warning: '#F59E0B',      // amber — self-reported, pending attention
    error: '#EF4444',        // red — dispute, owe amount hero, offline banner
    info: '#3B82F6',         // blue — informational

    background: '#F8FAFC',   // slate-50 — app background
    surface: '#FFFFFF',      // card backgrounds
    border: '#E2E8F0',       // slate-200 — dividers
    borderLight: '#F1F5F9',  // slate-100 — subtle dividers

    textPrimary: '#0F172A',  // slate-900
    textSecondary: '#64748B',// slate-500
    textMuted: '#94A3B8',    // slate-400 — decorative only, do not use for meaningful text
    textOnPrimary: '#FFFFFF',
  },
};
```

### Typography Scale

```typescript
export const typography = {
  heroNumber: { fontSize: 36, fontWeight: '700' as const, letterSpacing: -0.5 },
  h1: { fontSize: 24, fontWeight: '700' as const },
  h2: { fontSize: 20, fontWeight: '600' as const },
  h3: { fontSize: 17, fontWeight: '600' as const },
  body: { fontSize: 15, fontWeight: '400' as const },
  bodySmall: { fontSize: 13, fontWeight: '400' as const },
  label: { fontSize: 12, fontWeight: '600' as const, letterSpacing: 0.5 },
  caption: { fontSize: 11, fontWeight: '400' as const, color: '#94A3B8' },
  amount: { fontSize: 15, fontWeight: '600' as const, fontFamily: 'Courier' },
  amountLarge: { fontSize: 20, fontWeight: '700' as const, fontFamily: 'Courier' },
};
```

All `fontSize` values are in points and will scale with `allowFontScaling` (React Native default). Do not add `allowFontScaling={false}` to any `Text` component.

### Status Chip Colors

```typescript
export const statusChips = {
  pending:       { bg: '#F1F5F9', text: '#64748B', label: 'Pending' },
  self_reported: { bg: '#FEF3C7', text: '#92400E', label: 'Self-reported' },
  payer_marked:  { bg: '#DBEAFE', text: '#1E40AF', label: 'Marked paid' },
  confirmed:     { bg: '#D1FAE5', text: '#065F46', label: 'Confirmed' },
  disputed:      { bg: '#FEE2E2', text: '#991B1B', label: 'Disputed' },
  settled:       { bg: '#D1FAE5', text: '#065F46', label: 'Settled ✓' },
};
```

### Avatar Component

Generated avatar (when no photo uploaded): circle filled with `user.avatar_colour`, white initials.

```typescript
// mobile/src/shared/components/Avatar.tsx
import React from 'react';
import { View, Text } from 'react-native';

interface AvatarProps {
  displayName: string;
  colour: string;
  size?: number;
}

export function Avatar({ displayName, colour, size = 40 }: AvatarProps) {
  const parts = displayName.trim().split(' ');
  const initials = parts.length >= 2
    ? parts[0][0] + parts[parts.length - 1][0]
    : parts[0].slice(0, 2);

  return (
    <View
      style={{
        width: size, height: size, borderRadius: size / 2,
        backgroundColor: colour,
        alignItems: 'center', justifyContent: 'center',
      }}
      accessibilityRole="image"
      accessibilityLabel={`Avatar for ${displayName}`}
    >
      <Text style={{ color: '#FFFFFF', fontSize: size * 0.38, fontWeight: '600' }}>
        {initials.toUpperCase()}
      </Text>
    </View>
  );
}
```

---

## 12. Web Join Flow Specification

Full web join flow is specified in Section 3 under "Web Join Flow". This section provides supplementary implementation notes.

### Backend Requirements

The web join pages are **not** React Native — they are server-rendered or React web pages served from the same domain as the app's backend. The following routes must exist:

| Route | Page |
|-------|------|
| `GET /join/:token` | WebJoinScreen (new visitor or returning visitor, determined server-side) |
| `POST /join/:token/otp/request` | Processes join form submission, triggers OTP send |
| `POST /join/:token/otp/verify` | Processes OTP entry, returns session |
| `GET /join/:token/status` | Returns current join/lock status of the event |
| `GET /join/:token/joined` | WebJoinedScreen |
| `GET /join/:token/locked` | WebLockedScreen |

**CSRF protection:** The web join page fetches a CSRF token on page load from the `csrf_token` cookie set by `GET /join/:token`. Subsequent POST requests (`/otp/request`, `/otp/verify`) include an `X-CSRF-Token` header.

### Token Validation

On every GET to `/join/:token`:
- If token not found: 404 page with "This invite link is invalid."
- If token expired AND group is locked: render WebLockedScreen
- If token expired AND group is not locked: render "This link has expired. Ask the organiser for a new link."
- If token valid: render appropriate WebJoinScreen variant

### Universal Link Interception

When the device has the LetsSplyt app installed, iOS/Android intercepts the `/join/:token` URL before the browser opens and redirects to the app's AppJoinScreen. The web pages are only reached when the app is not installed. No special server-side code is needed — this is handled entirely by the `.well-known/` files specified in Section 1.

### Responsive Design

The web join pages must work on mobile browsers (the primary use case) and desktop browsers (secondary). Design mobile-first: max-width 480px, centred on desktop, full-width on mobile.

---

*Navigation stack and state management decisions are hard to change later — implement exactly as specified. The split image dimensions (640px wide, fixed column percentages) must match exactly — participants will compare their received images and inconsistencies undermine trust in the calculations.*
