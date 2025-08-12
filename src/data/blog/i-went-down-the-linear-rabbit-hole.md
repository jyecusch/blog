---
author: Jye Cusch
pubDatetime: 2025-08-04T14:55:00Z
modDatetime: 2025-08-04T14:55:00Z
title: 'Linear sent me down a local-first rabbit hole'
description: A deep dive into local-first architecture, triggered by wondering why Linear feels so fast. Looking at the technical implementation, exploring tools like Jazz and Electric SQL, and explaining why my next app might not need API endpoints.
featured: true
draft: false
tags:
  - tech
---

I started using Linear a couple of months ago and using it made me go down a technical rabbit hole that changed how I think about web applications.

For the uninitiated, [Linear](https://linear.app) is a project management tool that feels impossibly fast. Click an issue, it opens instantly. Update a status and watch in a second browser, it updates almost as fast as the source. No loading states, no page refreshes - just instant, interactions.

After building traditional web apps for years, this felt wrong. Where's the network latency? How are they handling conflicts? What happens when you go offline?

_If you're still unsure what local-first looks like, I think [LiveStore's](https://livestore.dev/) demo is the best._

## Down the Rabbit Hole

Armed with a rainy weekend and too much coffee I was determined to learn this wizardry. What I found was a goldmine of engineering deep-dives:

- [A reverse engineering of Linear's sync engine](https://github.com/backupManager/reverse-linear-sync-engine-dev) - endorsed by Linear's CTO
- [Another breakdown of their sync protocol](https://marknotfound.com/posts/reverse-engineering-linears-sync-magic/)
- [Linear CTO Tuomas Artman's talk on their architecture](https://www.youtube.com/live/WxK11RsLqp4?si=QrQf6cI8eBH0xw9Z&t=2176)
- [A follow up talk by Tuomas on scaling the sync-engine](https://www.youtube.com/live/Wo2m3jaJixU)
- [Figma's port about their multiplayer tech, that Tuomas referenced](https://www.figma.com/blog/how-figmas-multiplayer-technology-works/)

The short version: they built their own sync engine that treats your browser's IndexedDB as a real database. Every change happens locally first, then in the background uses GraphQL for mutations and Websockets for sync.

I also found the term "local-first" kept popping up, which depending on the content you read is either a UX strategy for apps that feel local (instant updates, etc.) or a philosophy about keeping your data local and syncing across devices.

In most instances the concept is beautifully simple: instead of your app being a fancy form that sends data to a server, it has it's own local database. Sometimes the server is just another client to sync with. It can be a fundamental inversion of how we typically build web applications.

In a traditional web app, the server is the only source of truth:

```text
Client → HTTP Request → Server → Database → Response → Client
```

In a local-first/sync approach, each client may have its own (nearly) complete database:

```text
Client → Local Database → UI Update
         ↓ (async)
    Sync Engine → Server → Other Clients
```

The key point for me was that by moving the database to the client, you eliminate network latency from the user interaction path. Updates happen instantly because they're just local database read/writes.

## The Challenge: This Is Not Trivial

After understanding Linear's approach, my first instinct was to build something similar. Then reality hit: even the basic version of their sync engine probably represents months of engineering effort.

The complexity comes from:

- Handling offline/online transitions gracefully
- Conflict resolution across distributed clients
- Partial synchronization (you don't want to download your entire database)
- Schema migrations across cached data
- Security and access control in a distributed system

Surely, someone has already built this magic into something I can reuse...

## The Local-First Ecosystem in 2025

Fortunately, the local-first community has been building solutions. Here's the current landscape:

### Production-Ready Options

- **[Electric SQL](https://electric-sql.com/)** - Postgres-backed sync engine
- **[PowerSync](https://www.powersync.com/)** - Enterprise-focused solution
- **[Jazz](https://jazz.tools/)** - The one that caught my eye (see below)
- **[Dexie Cloud](https://dexie.org/cloud/)** - If already using Dexie.js
- **[Replicache](https://replicache.dev/)** - The OG (RIP)
- **[Zero](https://zero.rocicorp.dev/)** - Replicache team's new approach
- **[Triplit](https://www.triplit.dev/)** - TripleStore-based sync
- **[Instant](https://www.instantdb.com/)** - Focused on developer experience
- **[LiveStore](https://livestore.dev/)** - Reactive layer for Electric and other providers

## Deep Dive: Jazz

I started with Jazz because it made an absurd promise: build local-first apps as easily as updating local state.

### The Mental Model

Jazz introduces "Collaborative Values" (CoValues) - data structures designed for distributed, real-time collaboration.

You start with a schema built with Jazz and Zod:

```typescript
// schema.ts
import { co, z } from "jazz-tools";

const ListOfComments = co.list(Comment);

export const Post = co.map({
  title: z.string(),
  content: z.string(),
  comments: ListOfComments,
});
```

What makes this powerful is that these aren't just type definitions - they're live, reactive objects that sync automatically.

Check this out:

```typescript
// Use a subscription hook to retrieve a value
const post = useCoState(Post, postId)

// Then just use it like a normal object
const setTitle = (title: string) => {
  post.title = title
  // That's it. It synced. I'm not joking.
}
```

No API routes. No request/response cycles. No DTOs. Just... objects that magically sync. It kind of feels like cheating.

### How Jazz Achieves This

Under the hood, Jazz uses several clever techniques:

**1. Built-in Uniqueness**  
Every piece of data is automatically assigned a unique ID. This avoids collisions and allows for efficient sync.

**2. Event Sourcing**  
Changes appear to be stored as events, with a materialize current state of the full object graph. This keeps sync operations fast, by only syncing changes.

**3. End-to-End Encryption**  
Data is encrypted on the client before syncing. The server sees only encrypted blobs. This is architecturally fascinating... but also challenging as I discuss later.

**4. Permission Model via Groups**  
Instead of traditional ACLs, Jazz uses groups:

```typescript
const group = Group.create()

group.addMember(alice, 'admin')
group.addMember(bob, 'writer')

Post.create(
  { title: "a new post"},
  { owner: group }
);
```

### The Trade-offs

This architecture is exceptionally productive, particularly for prototyping. Without the typical flow breaking distractions where you stop work on the UI to go write API operations or DTOs for every interaction.

That said, it creates some interesting constraints:

#### Your Server Is Blind

Everything is end-to-end encrypted. Your backend literally cannot read user data unless explicitly shared with the server's account via a Group. This is amazing for privacy, but less amazing when you don't think ahead about what data your server needs to be able to access. It's also a problem if you want to perform moderation or prevent malicious data storage.

#### Time Travel Is Mandatory

Jazz appears to use event sourcing. Every change is stored forever. That "delete" button? It just removes references. Great for undo/redo. Less great when thinking about things like GDPR compliance.

#### Storage Goes Brrr

Since nothing is deleted, your storage usage has one direction: up. For a small project? Who cares. For a SaaS with thousands of users? Your AWS bill might start looking like a phone number (or Jazz Cloud bill when they have a paid offering).

#### Local Dev Still Has Quirks

Passkeys is the first Auth method you'll see presented for use in Jazz apps. There is a lot to like about Passkeys, but they can be tricky for local development.

I built a small app on my laptop and wanted to test it on my phone using my LAN IP. Here's the summary of my journey:

1. Oh right, Passkeys need HTTPS when not on localhost
2. Enable HTTPS in Vite with mkcert
3. Oh right, it needs a trusted certificate
4. I'll just use Clerk instead, it's not ideal for my self-hosted app, but ok
5. Oh, how do I transfer my Jazz user's cryptographic account keys to Clerk?
5. Oh, Clerk also needs HTTPS when not on localhost, fair enough
6. Re-enable mkcert
7. Oh right, the Jazz Sync WebSocket now also need to be secure
8. Ok, I'll proxy everything
9. *too much time later* It works!

That said, I spotted Better Auth integration coming, which will solve the self-hosting auth story.

### But Honestly? Still Worth It

Despite these considerations, Jazz is super impressive and fun to use. The developer experience is unique and highly productive. It's also still early days for Jazz, I'm sure many of these items will have great solutions in time.

## Exploring: Electric SQL and Zero

The next on my list to explore are Electric SQL and Zero. While Jazz builds something new from scratch, Electric and Zero take a more incremental approach:

```sql
-- Just create Postgres tables as normal
CREATE TABLE posts (
    id SERIAL PRIMARY KEY,
    title VARCHAR(255) NOT NULL,
    content TEXT,
    author_id INTEGER NOT NULL,
);
```

In the case of Electric you can then use reactive queries to return subsets of your database (called Shapes). This example establishes a subscription that allows Electric to sync any future changes to the UI.

```typescript
import { useShape } from '@electric-sql/react'

// With reactive queries
function Component() {
  const { data } = useShape({
    url: `http://localhost:3000/v1/shape`,
    params: {
      table: `posts`
    }
  })

  return (
    <pre>{ JSON.stringify(data, null, 2) }</pre>
  )
}
```

Electric's approach is compelling given it works with existing Postgres databases. However, one gap remains to fill, how to handle mutations? To get similar productivity to Jazz adding something like [LiveStore](https://livestore.dev/) to Electric seems interesting, although it does have a specific schema requirement for the Postgres DB. [TanStack DB](https://tanstack.com/db/latest/docs/overview) is also a contender, I'll be trying that soon too.

Using Zero is another option, it has many similarities to Electric, while also directly supporting [mutations](https://zero.rocicorp.dev/docs/writing-data).

Whichever I choose is probably the candidate for my next post.

## When Does Local-First Make Sense?

After looking into local-first and experimenting with Jazz, I'm left with the following impression of when this paradigm is a good fit:

**Excellent fit:**

- Creative tools (design, writing, music)
- Collaborative applications or elements of a larger application
- Mobile apps needing offline support
- Developer tools
- Personal productivity apps

**Challenging fit:**

- Heavy server-side business logic
- Strict audit requirements
- Large-scale analytics
- Existing systems with deep integrations
- Systems where requests are regularly rejected by server-side logic (making optimistic updates hard)

## Looking Forward

Local-first represents a fundamental shift in how we build applications. The user experience benefits are undeniable - Linear has proven that. The question is whether the architectural trade-offs are worth it for your use case.

I'm building a personal application with Jazz to understand these trade-offs in practice. The development experience is refreshingly different, but I'm watching carefully for where the abstraction leaks.

The ecosystem is still young. Tools will mature, patterns will emerge, and sharp edges will be smoothed. But the core insight - that we can build dramatically better user experiences by keeping data local - isn't going away.

If you're building something new and can work within the constraints, I encourage you to try local-first. The worst case is you'll learn a new architecture pattern. The best case is you'll build something that feels impossibly fast to your users.

And in a world of 300ms response times, that's an advantage.

---

_If I've made any mistakes or misrepresentations in this text, let me know. If you've had different experiences with local-first, I'd love to hear them, get in touch._
