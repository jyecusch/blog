---
author: Jye Cusch
pubDatetime: 2026-03-25T10:00:00Z
modDatetime: 2026-03-25T10:00:00Z
title: 'Your sign-up form is a weapon'
description: How bots used our sign-up and forgot password pages to bomb real people's inboxes, and what we did to stop it. A practical guide to subscription bombing for founders and developers who think CAPTCHA is an "I'll do it later" task.
featured: true
draft: false
tags:
  - security
---

A couple of weeks ago, we noticed something odd on [Suga](https://suga.app). New users were signing up but not doing anything, they weren't creating an org, a project, or a deployment, they just left an account sitting there. Most new users interact with the product pretty quickly, and we report on activity stats to try and understand blockers, so even a small spike in completely inactive accounts stood out.

Then we looked at the names of the new users and they were entries like `PfVQXvYTXjwSbEeJBjXYy` and `xXzMafkbPLjOaGgDaOGZjLx`.

We checked [Resend](https://resend.com) (our email service) and could see welcome emails going out and being delivered to these accounts. They were real email addresses, with garbage names... something was off.

![resend dashboard](/images/blog/subscription-bombing/resend-dashboard.png)

## What is subscription bombing?

Subscription bombing is an attack where someone uses bots to sign up a victim's email address across hundreds or thousands of websites. The goal isn't to access those accounts on those website, it's to flood the victim's inbox with so much noise that they can't find the emails that actually matter.

While the victim is drowning in "Welcome to SaaS Product!" and "Verify your email for Newsletter You Never Asked For", the attacker is doing something else. They're resetting the victim's bank password, making purchases on their accounts, or signing up for credit cards in their name. The real security alerts and confirmation emails get buried by the noise.

The people running these attacks are stealing money and impersonating real people or businesses. Every sign-up form on the internet that lets you enter any email address without verification is a tool they can exploit.

## How we spotted it

It started on March 12 with a single unusual sign-up, then over the next two days we saw another 2-3 per day, which was low enough to be noise. Honestly, our first thought was that someone was pen testing our service. That's pretty common, something we've experience with other products and, when it comes with responsible disclosures, something we appreciate, so it didn't ring any alarm bells.

By March 14 we had 6 sign-ups matching the pattern, and we noticed something else in [PostHog](https://posthog.com). There was unusually high page views and interactions on the forgot password page. The combination of activities was enough to make us take a closer look.

## The pattern

Each bot would sign up with a real victim's email address and a garbage name. Then, within about 60 seconds, it would navigate to the forgot password page and request a reset. That meant each victim received three emails from us in under a minute:

1. Verify your email address
2. Welcome to Suga
3. Reset your password

Three emails they never asked for, from a product they may never have heard of. We were just one of potentially hundreds of sites being hit at the same time.

The bots were also hitting the forgot password page with random email addresses, presumably trying to trigger reset emails for victims who were already a user.

We reviewed one session in detail and the typing behaviour was interesting. The bot was entering values into form fields painfully slowly, one character at a time with up to a second between keystrokes. The gaps had randomness to them, but it was _too_ random. Humans type in bursts, most people type a few characters quickly, pause, then type again. This was a flat distribution of delays trying to look human and failing. The timing between page navigations had the same quality of being randomised, but uniformly so. Enough variation to dodge simple bot detection, not enough to actually pass for a real person.

## Designed to be invisible

This is what makes subscription bombing so different from the attacks most people think of. There was no spike, or flood of requests, or dramatic server load. It was just 1-2 sign-ups per hour and that's it.

The requests came from all over (India, Brazil, Romania, the US, Vietnam, Türkiye) which isn't unusual until you compare it to typical traffic. Our real users typically navigate from specific countries with a reasonable correlation to the daytime hours of that country. The bot traffic had zero correlation between country and time of day, and that mismatch is what stood out.

Rate limiting does nothing here, since you can't really rate-limit against one request per hour. The whole point of this attack is to stay below the threshold, that's one of the reasons I find this attack type so interesting.

## The damage isn't to you

Subscription bombing barely hurts the site owner, our email sender reputation wasn't affected (the volume was too low). If we hadn't been tracking user activation closely, we might not have noticed. Unfortunately, the damage is almost entirely to the people on the other end.

Picture waking up to 200+ emails from services you've never heard of, you start deleting them, but they keep coming. Somewhere in that pile of garbage is a notification that matters, like someone changing your banking email address, resetting your password or ordering a new credit card in your name.

The reason this attack works at all is that thousands of websites (newsletters, SaaS products, forums, e-commerce stores) let anyone enter any email address and immediately start sending emails to it.

If your sign-up form sends email to an unverified address, your form is part of this. And because the damage falls on the victim, not the site owner, I suspect most people treat it as low priority to fix, which is wrong. It pollutes your user data and it makes your service an accomplice in harassing real people.

## What we did

### Firewall rules

Our first move was tightening bot detection on our front-end hosting provider's firewall. This cut the volume roughly in half, but didn't eliminate it. It was also tricky to configure because we have legitimate non-browser traffic hitting our API (webhooks, service-to-service calls) that needed to keep working.

We let it run for about 6 hours. In that time, two more sign-ups slipped through (one at the 5-hour mark, another at 6). The bots were getting past the verification step so we needed something better.

### Cloudflare Turnstile

[Cloudflare Turnstile](https://www.cloudflare.com/products/turnstile/) was the fix, it's a CAPTCHA alternative that doesn't ask your users to solve puzzles. It analyses browser signals in the background and can be configured to only present a visible challenge when something looks off. You can set it up, so that for real users it's invisible.

We use [Better Auth](https://better-auth.com) for authentication, and it has a [built-in CAPTCHA plugin](https://better-auth.com/docs/plugins/captcha) with Turnstile support. That made the implementation dead simple, just add the plugin server-side, drop the Turnstile component onto the auth pages like sign-up, sign-in and forgot password with [`@marsidev/react-turnstile`](https://github.com/marsidev/react-turnstile), and pass the token through to the server via a header. The submit button stays disabled until Turnstile provides a valid token.

After deploying Turnstile, the bot sign-ups stopped, so I want to specifically call out both Better Auth and Cloudflare Turnstile here. The combination made this a same-day fix. If your auth solution doesn't support CAPTCHA out of the box, Turnstile's API is still easy to integrate directly, but having it baked in saved us time.

### Limiting email to verified users only

Even with Turnstile in place, we wanted to limit the damage if this happens again. We updated our email service code so that a user receives exactly one email from us (the verification email) until they click the link and prove they own the address. No welcome email, no product updates, nothing else until verification. We should have had it this was from the start, which is a mistake I regret.

If a bot creates an account with someone else's email, the victim gets one email, if they ignore it that's the end of it. The welcome email and everything after it only fires once the user verifies.

(For social auth sign-ups through Google or GitHub, we send the welcome email right away since those providers have already verified the email.)

## Wrapping up

We could have looked at 1-2 sign-ups per hour and shrugged, since the business impact to us was basically zero. But those were real people's email addresses, and our service was being used against them.

I'd like to apologise to the people whose addresses were used, but reaching out would just be one more unwanted email in an already overloaded inbox. The best we could do was make it stop and make sure we can't be used this way again.

We've also added better reporting to spot patterns like this sooner next time. Overall I think our response was reasonable and fairly rapid, but we should have had these mitigations in place from the start, lesson learned.
