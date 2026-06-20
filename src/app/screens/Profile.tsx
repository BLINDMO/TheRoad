import { BackBar, Panel, formatChips } from '../ui';
import { useGameStore } from '../../store/useGameStore';
import { Avatar } from './Lobby';
import { useState } from 'react';
import { play } from '../../audio/sound';

export default function Profile() {
  const stats = useGameStore((s) => s.stats);
  const profile = useGameStore((s) => s.profile);
  const bankroll = useGameStore((s) => s.bankroll);
  const updateProfile = useGameStore((s) => s.updateProfile);
  const [editing, setEditing] = useState(false);
  const [name, setName] = useState(profile.name);

  const items: [string, string][] = [
    ['Hands Played', formatChips(stats.handsPlayed)],
    ['Biggest Pot', formatChips(stats.biggestPot)],
    ['Tournaments Cashed', formatChips(stats.tournamentsCashed)],
    ['Championships Won', formatChips(stats.tournamentsWon)],
    ['Slot Jackpots', formatChips(stats.slotJackpots)],
    ['Biggest Slot Win', formatChips(stats.biggestSlotWin)],
    ['Total Spins', formatChips(stats.totalSpins)],
    ['Current Bankroll', formatChips(bankroll)],
  ];

  return (
    <div className="felt grain min-h-full">
      <BackBar title="Profile" />
      <div className="space-y-4 px-4 pb-10">
        <Panel className="flex items-center gap-4 p-5">
          <Avatar id={profile.avatar} size={64} />
          <div className="flex-1">
            {editing ? (
              <input value={name} onChange={(e) => setName(e.target.value)} maxLength={18}
                className="w-full rounded-card bg-walnut px-3 py-2 text-cream ring-1 ring-brass/40" />
            ) : (
              <div className="font-display text-2xl font-bold text-cream">{profile.name}</div>
            )}
            <div className="mt-1 text-xs text-cream-mute">{stats.tournamentsWon > 0 ? '👑 Crown Champion' : 'Private member'}</div>
          </div>
          <button onClick={() => {
            play('button');
            if (editing) updateProfile({ name: name.trim() || 'High Roller', avatar: (name.trim() || 'H') });
            setEditing(!editing);
          }} className="tactile rounded-pill bg-brass-sheen px-3 py-1.5 text-xs font-bold text-walnut">
            {editing ? 'Save' : 'Edit'}
          </button>
        </Panel>

        <div className="grid grid-cols-2 gap-3">
          {items.map(([k, v]) => (
            <Panel key={k} className="p-4">
              <div className="text-[10px] uppercase tracking-widest text-cream-mute">{k}</div>
              <div className="tnum mt-1 font-slab text-xl font-bold text-brass-light">{v}</div>
            </Panel>
          ))}
        </div>
      </div>
    </div>
  );
}
