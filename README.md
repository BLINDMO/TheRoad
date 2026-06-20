# Gilded Aces 🂡

A private, premium-feeling **casino simulation** for one person — Texas Hold'em
poker and slot machines, played with **virtual chips only**. No real money, no
payments, no in-app purchases, no real-money wagering. It's a beautifully made
personal toy, installable on an iPhone as a PWA.

## What's inside

- **Poker** (No-Limit Texas Hold'em) with three ways to play:
  - **Leisure cash table** — pick stakes, table size (HU–9 max), buy-in; sit,
    rebuy and leave whenever; AI opponents bust and rebuy too.
  - **Sit & Go** — single-table tournaments (HU / 6-max / 9-max) with an
    escalating blind schedule and a payout ladder.
  - **The Gilded Crown** — a 180-runner marquee championship with antes, a
    numerically honest background field (real busts / chip leader / average
    stack), final-table redraw and a full payout ladder. (Original event — not
    affiliated with any real-world brand.)
- **AI opponents** with real personalities — Monte-Carlo equity + pot odds,
  biased by five personas (Rock, TAG, LAG, Calling Station, Maniac), position,
  stack depth and a dash of randomness, plus thinking-time tells and reactions.
- **Slots** — one reusable weighted-reel engine, three distinct machines
  (**Orchard Gold** fruit, **Prism Riches** gems, **Sands of Anubis** Egyptian
  with a progressive jackpot). Each has free spins (with multiplier + retrigger)
  and a pick-a-prize bonus; escalating win celebrations (small flash → BIG WIN →
  MEGA → JACKPOT).
- **Shared systems** — one persisted virtual bankroll, daily bonus, profile &
  stats, lobby, settings (sound / haptics / reduced motion).

## Correctness is tested

- Poker hand evaluation, side-pot construction, a full multi-way **all-in with
  side pots**, min-raise sizing, and fold-outs — all unit-tested.
- The **full poker controller** (blinds, AI, eliminations, payouts) is driven to
  completion in headless integration tests.
- Each slot machine's **RTP** is verified by a millions-of-spins simulation
  (`npm run rtp`) that recurses into free spins and accounts for bonus EV and the
  jackpot — all three land within ±2pp of target (94–95%).

```
npm test       # 20 Vitest tests (engines + controller)
npm run rtp    # RTP simulation (default 2,000,000 spins/machine)
```

## Run it locally

```bash
npm install
npm run dev      # open the printed http://localhost:5173 URL
```

Production preview:

```bash
npm run build
npm run preview  # serves the built PWA (use --host for LAN access)
```

## Install on iPhone (no App Store / Apple Developer account needed)

1. Serve it on your network: `npm run build && npm run preview -- --host`, then
   open the printed `http://<your-computer-ip>:4173` URL in **Safari** on the
   iPhone (must be same Wi-Fi). For HTTPS / remote access, deploy the `dist/`
   folder to any static host (Netlify, Vercel, GitHub Pages, …).
2. Tap **Share → Add to Home Screen**.
3. Launch **Gilded Aces** from the home screen — it runs full-screen with no
   browser chrome, correct safe-area insets, and reloads your bankroll from
   IndexedDB on every launch.

## Tech

React + TypeScript + Vite · Tailwind (custom theme) · Phaser 3 game surfaces ·
Zustand · IndexedDB (idb) · vite-plugin-pwa · pokersolver. All card / chip /
symbol art is hand-drawn to canvas; all audio is synthesized with the Web Audio
API. See `CREDITS.md`.

## Project layout

```
src/
  app/            React shell: screens, lobby, nav, controllers, UI kit
  engine-poker/   pure TS: deck, evaluator, betting state machine, side pots,
                  AI (Monte-Carlo + personas), tournament structures
  engine-slots/   pure TS: reel/payline math, weighted RNG, paytables, features
  scenes-poker/   Phaser poker table scene + card textures
  scenes-slots/   Phaser reusable reel-rig scene
  assets/         canvas card / chip / symbol art
  store/          Zustand store (bankroll, stats, settings, jackpots)
  audio/          Web Audio synth + haptics
  persistence/    IndexedDB wrapper
tests/            Vitest: evaluation, side pots, hands, slots, controller e2e
scripts/          RTP simulation, icon generation
```
