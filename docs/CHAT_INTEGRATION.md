# Chat integration

`../almonium-fe` learned most of what follows the hard way. Read this before
touching Stream Chat here, because the conventions below are shared state: they
live in the Stream application both clients talk to, and a client that guesses
at them will look correct in isolation and wrong next to the web app.

The mobile client implements them in `src/chat.ts` (the conventions, unit
tested), `src/chat-client.tsx` (the single connected client) and `app/chat/`
(the list and the room). Chat is reached from Settings and from a friend, never
from a tab: the mobile brief keeps it as transport between two people rather
than a destination. Threads, quoted replies, reactions, polls, attachments and
hidden chats are deliberately not built here yet - the flags for most of them
are off, and nothing renders the rest on web either.

## Getting a connected client

Stream is authenticated separately from the backend. The backend mints a Stream
user token and returns it on the user payload:

- `GET /users/me` includes `streamChatToken` (`UserService.java` fills it from
  `StreamChatService.generateStreamToken`).
- Connect with that token and the public Stream API key, using the user's
  backend UUID as the Stream user id. Every id below is that UUID.

**Do not persist the Stream token.** The web client deliberately strips it
before writing the user object to storage (`local-storage.service.ts`) and
refetches it from `/users/me`. Do the same: keep it in memory, treat it as a
credential, and let it come back with the user.

The backend creates the Stream user, joins the default channels, and creates
the self chat on signup (`StreamChatService.setupNewUser`). A client never
creates any of that.

## Channel types are the identity

There are three types, and **the type is the only reliable answer to "what kind
of channel is this?"** Do not branch on the channel's name. The web app used to
match on the literal string `'Private Chat'` and it was fragile in exactly the
ways you would expect - the moment a name is translated, renamed, or set by
another client, the check silently stops working.

| Type | What it is | Id | Name |
| --- | --- | --- | --- |
| `private` | A one-to-one DM between friends | `private_{friendshipId}` | none - see below |
| `self` | The user's own Saved Messages | the user's UUID | `Saved Messages` |
| `broadcast` | Read-only Almonium announcement rooms | `almonium`, `almonium-{lang}` | `Almonium`, `Almonium - Deutsch`, ... |

`broadcast` rooms exist for EN, DE, ES, FR and IT. Membership is managed by the
backend when a user adds or removes a target language; a client never joins or
leaves one on the user's behalf except through the explicit leave action.

### Private chats have no name

A DM is created with `members` and `created_by_id` and **no `name` field at
all**. It has no name of its own; it has an interlocutor. Derive the title from
the other member:

```ts
const other = Object.values(channel.state.members)
  .find(m => m.user?.id !== currentUserId)?.user;
const title = other?.name ?? fallback;
```

Older channels in Stream still carry a leftover `name: 'Private Chat'`. Branch
on the type *first*, so that value can never reach the screen.

### Saved Messages has no image

The self chat carries no `image` either. Draw the emblem locally - the web
client renders an inline bookmark glyph on a flat plum disc
(`--saved-emblem-fill: #872657`, ink `#FFF8F5`). Do not fetch a hosted icon,
and do not fall back to a letter avatar for it.

Broadcast channels *do* carry an `image`, served from the web client's own
domain (`{web-domain}/chat/logo-de.png`). Those are real URLs; render them.

## Broadcast channels are read only

Members cannot post to a `broadcast` channel. This is enforced in the Stream
channel type's permissions, not just in the UI - a send attempt fails at the
API. Render no composer there. The web client shows a footer reading "Only
Almonium posts in this channel" in place of the input.

Publishing goes through the backend: `POST /ops/chat/announcements` with
`{"language": "DE", "text": "..."}`, admin-only, sent server-side as the app's
own Stream user.

Everything else on a broadcast channel is normal: reading, reactions, muting,
and leaving all work for members.

## Creating a DM

A DM belongs to a friendship, and its id is derived from the friendship id so
both sides land on the same channel without coordinating:

```ts
const channel = client.channel('private', `private_${friendshipId}`, {
  members: [currentUserId, recipientId],
  created_by_id: currentUserId,
});
await channel.create();
await channel.watch();
```

Do not invent a second id scheme (sorted user ids, a distinct channel, a
`messaging` type). The web client addresses the same channel as
`private:private_{friendshipId}` and rebuilds that cid from the friendship on
every deep link, so a divergent scheme means two users in two different rooms.

## Feature flags live in the Stream dashboard

Per-type toggles decide what the API will accept, so check them before building
UI for a feature:

- **Quotes** are the "Reply" action - inline quoted replies, on for `private`.
- **Threads** are off. There is no thread UI in the web client either; if
  mobile adds one, the type needs `Threads & Replies` plus the `CreateReply`
  permission, and the web client needs the matching panel.
- **Polls** are on for `broadcast` only, and nothing renders them yet.
- **Message counting** drives unread badges. It is on for `private`, off for
  `self` and `broadcast`, so those two never badge. That is deliberate.
- **Message reminders, pending messages, location sharing and delivery events**
  are off everywhere.

## Things that will bite

- **Never key behaviour on a channel's display name.** Type, always.
- **Never write a client-side "read only" check and call it enforcement.** The
  web client did, and for a while anyone could have posted into the language
  rooms through the API.
- **Do not create Stream users.** The backend owns that, and orphaned Stream
  accounts are a real problem it has to reconcile
  (`StreamUserReconciliationService`).
- **Coordinate DTO changes.** `streamChatToken` rides on the user payload both
  clients read; changing its shape breaks the other client silently, at
  connect time, in a way no test here will catch.
