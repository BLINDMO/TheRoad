import { BackBar, Panel } from '../ui';
import { useGameStore } from '../../store/useGameStore';
import { play, haptic } from '../../audio/sound';

export default function Settings() {
  const settings = useGameStore((s) => s.settings);
  const update = useGameStore((s) => s.updateSettings);

  const Toggle = ({ label, desc, on, onToggle }: { label: string; desc: string; on: boolean; onToggle: () => void }) => (
    <button onClick={() => { play('button'); haptic(10); onToggle(); }}
      className="tactile flex w-full items-center justify-between rounded-card bg-walnut/40 px-4 py-3 text-left">
      <div>
        <div className="text-sm font-semibold text-cream">{label}</div>
        <div className="text-xs text-cream-mute">{desc}</div>
      </div>
      <div className={`relative h-7 w-12 rounded-full transition ${on ? 'bg-amber' : 'bg-walnut-light'}`}>
        <div className={`absolute top-0.5 h-6 w-6 rounded-full bg-cream shadow transition ${on ? 'left-[22px]' : 'left-0.5'}`} />
      </div>
    </button>
  );

  return (
    <div className="felt grain min-h-full">
      <BackBar title="Settings" />
      <div className="space-y-4 px-4 pb-10">
        <Panel className="space-y-2 p-3">
          <Toggle label="Sound" desc="Chips, cards and win fanfares" on={settings.sound} onToggle={() => update({ sound: !settings.sound })} />
          <Toggle label="Haptics" desc="Vibration on key actions (where supported)" on={settings.haptics} onToggle={() => update({ haptics: !settings.haptics })} />
          <Toggle label="Reduced Motion" desc="Shorten animations and celebrations" on={settings.reducedMotion} onToggle={() => update({ reducedMotion: !settings.reducedMotion })} />
        </Panel>

        <Panel className="p-4 text-sm text-cream-dim">
          <div className="font-display text-base font-bold text-cream">Install on iPhone</div>
          <ol className="mt-2 list-decimal space-y-1 pl-5 text-xs">
            <li>Open this page in Safari.</li>
            <li>Tap the Share button.</li>
            <li>Choose “Add to Home Screen”.</li>
            <li>Launch Gilded Aces from your home screen for full-screen play.</li>
          </ol>
        </Panel>
      </div>
    </div>
  );
}
