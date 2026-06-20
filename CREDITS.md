# Credits & Licenses — Gilded Aces

## Art & audio: 100% original / procedural

No third-party art or audio packs are vendored in this project. Everything you
see and hear is generated in-app:

| Asset | How it's made | Source file |
| --- | --- | --- |
| Playing cards (52 faces + back) | Hand-drawn to `<canvas>`: real suit-pip path geometry, standard pip layouts for 2–10, ornamented court cards (crown/plume + emblem + monogram), gilded card back | `src/assets/cardArt.ts` |
| Casino chips | Drawn to `<canvas>`: radial body gradient, edge spots, inner ring, gloss; denomination colours | `src/assets/chipArt.ts` |
| Slot symbols (fruit / gems / Egypt) | Drawn to `<canvas>`: gradient bodies, single-light-source highlights & shadows, faceted gems, gold glyph silhouettes | `src/assets/symbolArt.ts` |
| Felt / walnut / brass textures | Procedural CSS gradients + SVG `feTurbulence` grain | `src/index.css`, `tailwind.config.js` |
| App icon / favicon | Original SVG, rasterized to PNG via `scripts/genicons.mjs` | `public/favicon.svg` |
| Sound effects (chips, cards, reels, win fanfares, jackpot) | Synthesized at runtime with the Web Audio API — no audio files | `src/audio/sound.ts` |

> The brief listed optional CC0/permissive asset packs (Vector-Playing-Cards,
> Kenney Casino Audio, itch.io slot packs). None were downloaded or vendored;
> the bar was met with original procedural art/audio instead, which keeps the
> whole look cohesive with one palette. If you later want photographic card art
> or recorded SFX, drop them in `src/assets` / wire Howler in `src/audio` and
> record their licenses here.

## Software libraries

| Library | License | Use |
| --- | --- | --- |
| [pokersolver](https://github.com/goldfire/pokersolver) | MIT | Poker hand evaluation (5–7 cards, winner resolution) |
| [Phaser 3](https://phaser.io) | MIT | WebGL game surfaces (poker table, slot reels) |
| [React](https://react.dev) | MIT | App shell / UI |
| [Vite](https://vitejs.dev) + [@vitejs/plugin-react] | MIT | Build tooling |
| [Tailwind CSS](https://tailwindcss.com) | MIT | Styling (custom theme) |
| [Zustand](https://github.com/pmndrs/zustand) | MIT | App state |
| [idb](https://github.com/jakearchibald/idb) | ISC | IndexedDB persistence |
| [Howler.js](https://howlerjs.com) | MIT | Audio (dependency present for future recorded SFX) |
| [vite-plugin-pwa](https://vite-pwa-org.netlify.app) | MIT | PWA manifest + service worker |
| [sharp](https://sharp.pixelplumbing.com) | Apache-2.0 | Dev-only icon rasterization |

## Fonts (Google Fonts, loaded via CDN)

- **Playfair Display** — SIL Open Font License 1.1 (display headlines, monograms)
- **Zilla Slab** — SIL Open Font License 1.1 (numerals / chip counts)
- **Inter** — SIL Open Font License 1.1 (UI / body)
- **JetBrains Mono** — SIL Open Font License 1.1 (stats / odds)

---

This is a closed virtual-currency simulation. No real money, payments, IAP, or
real-money wagering exist anywhere in the app.
