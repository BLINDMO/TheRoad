import { BackBar, Panel } from '../ui';

export default function About() {
  return (
    <div className="felt grain min-h-full">
      <BackBar title="About" />
      <div className="space-y-4 px-4 pb-10">
        <Panel className="p-5 text-center">
          <h2 className="font-display text-3xl font-extrabold brass-text">Gilded Aces</h2>
          <p className="mt-2 text-sm text-cream-dim">A private high-roller poker &amp; slots lounge, built as a personal toy.</p>
        </Panel>

        <Panel className="p-5">
          <h3 className="font-display text-lg font-bold text-cream">Virtual chips only</h3>
          <p className="mt-2 text-sm leading-relaxed text-cream-dim">
            This app is a <b className="text-cream">closed virtual-currency simulation</b>. There is no real money
            anywhere in it: no payments, no in-app purchases, no real-money wagering, and no way to cash out.
            Chips have no monetary value. The daily bonus is a free virtual top-up so your balance never has to
            hit zero.
          </p>
        </Panel>

        <Panel className="p-5 text-sm text-cream-dim">
          <h3 className="font-display text-lg font-bold text-cream">Built with</h3>
          <ul className="mt-2 space-y-1 text-xs">
            <li>React + TypeScript + Vite · Tailwind (custom theme)</li>
            <li>Phaser 3 for the poker table &amp; slot reels</li>
            <li>pokersolver for hand evaluation</li>
            <li>Zustand state · IndexedDB persistence · PWA</li>
            <li>Card, chip &amp; symbol art hand-drawn to canvas</li>
          </ul>
          <p className="mt-3 text-[11px] text-cream-mute">See CREDITS.md in the project for asset licensing.</p>
        </Panel>
      </div>
    </div>
  );
}
