import { useEffect, useRef, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { PhaserMount } from '../poker/PhaserMount';
import { PokerScene } from '../../scenes-poker/PokerScene';
import { PokerController, type PokerSetup, type TableResult } from '../poker/PokerController';
import { pokerBus } from '../../lib/eventBus';
import type { LegalActions } from '../../engine-poker/types';
import { BrassButton, formatChips, MoneyPill, Panel } from '../ui';
import { useGameStore } from '../../store/useGameStore';
import { Trophy } from './PokerLobby';
import { play, haptic } from '../../audio/sound';

interface ActionReq {
  legal: LegalActions;
  toCall: number;
  pot: number;
  minRaiseTo: number;
  maxRaiseTo: number;
  stack: number;
}

export default function PokerGame() {
  const nav = useNavigate();
  const loc = useLocation();
  const setup = (loc.state as { setup?: PokerSetup })?.setup;
  const title = (loc.state as { title?: string })?.title ?? 'Poker';
  const bankroll = useGameStore((s) => s.bankroll);

  const controllerRef = useRef<PokerController | null>(null);
  const [req, setReq] = useState<ActionReq | null>(null);
  const [hud, setHud] = useState<ReturnType<PokerController['tournamentInfo']> | null>(null);
  const [result, setResult] = useState<TableResult | null>(null);
  const [pot, setPot] = useState(0);
  const [needRebuy, setNeedRebuy] = useState(false);

  useEffect(() => {
    if (!setup) {
      nav('/poker');
      return;
    }
    const ctrl = new PokerController(setup, (r) => setResult(r));
    controllerRef.current = ctrl;

    const offReq = pokerBus.on('request-action', (r) => {
      const noActions = !r.legal.canFold && !r.legal.canCheck && !r.legal.canCall && !r.legal.canBet && !r.legal.canRaise;
      if (noActions) {
        setNeedRebuy(true);
        setReq(null);
      } else {
        setReq(r);
        setNeedRebuy(false);
        haptic(14);
      }
    });
    const offState = pokerBus.on('state', (v) => {
      setPot(v.pot);
      if (setup.mode !== 'cash') setHud(ctrl.tournamentInfo());
    });
    const offReady = pokerBus.on('scene-ready', () => void ctrl.start());

    // Fallback: if scene was already ready, start anyway after a tick.
    const t = setTimeout(() => void ctrl.start(), 400);

    return () => {
      offReq(); offState(); offReady();
      clearTimeout(t);
      ctrl.destroy();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const act = (action: Parameters<typeof pokerBus.emit>[1] extends never ? never : any) => {
    setReq(null);
    pokerBus.emit('human-action', action);
  };

  if (!setup) return null;

  return (
    <div className="relative min-h-full overflow-hidden bg-walnut">
      {/* HUD top bar */}
      <div className="absolute inset-x-0 top-0 z-20 flex items-center justify-between px-3 pt-2"
        style={{ paddingTop: 'calc(var(--safe-top) + 6px)' }}>
        <button
          onClick={() => { play('button'); controllerRef.current?.leave(); }}
          className="tactile rounded-pill bg-walnut-light/80 px-3 py-1.5 text-xs font-semibold text-cream ring-1 ring-brass/30"
        >
          ← Leave
        </button>
        <div className="text-center">
          <div className="font-display text-sm font-bold brass-text">{title}</div>
          {hud && (
            <div className="text-[10px] text-cream-mute tnum">
              Lvl {hud.level} · {formatChips(hud.sb)}/{formatChips(hud.bb)}{hud.ante ? ` (a${formatChips(hud.ante)})` : ''}
            </div>
          )}
        </div>
        <MoneyPill value={bankroll} className="scale-90" />
      </div>

      {/* Tournament standings strip */}
      {hud && (
        <div className="absolute inset-x-0 z-20 flex justify-center gap-2 px-3"
          style={{ top: 'calc(var(--safe-top) + 48px)' }}>
          <HudChip k="Players" v={`${formatChips(hud.remaining)}/${formatChips(hud.fieldSize)}`} />
          {hud.field && <HudChip k="Avg" v={formatChips(hud.field.averageStack)} />}
          {hud.field && <HudChip k="Leader" v={formatChips(hud.field.chipLeader)} />}
          <HudChip k="ITM" v={`${hud.paid}`} />
        </div>
      )}

      {/* Phaser table */}
      <PhaserMount scene={PokerScene} className="absolute inset-0" />

      {/* Pot readout (mirrors scene, for clarity on small screens) */}
      <div className="pointer-events-none absolute inset-x-0 top-[42%] z-10 text-center">
        {pot > 0 && (
          <div className="inline-block rounded-pill bg-walnut/70 px-3 py-1 text-xs text-cream-dim ring-1 ring-brass/20">
            Pot <span className="tnum font-bold text-brass-light">{formatChips(pot)}</span>
          </div>
        )}
      </div>

      {/* Action bar */}
      {req && <ActionBar req={req} onAction={act} />}

      {needRebuy && (
        <Modal>
          <h3 className="font-display text-xl font-bold brass-text">You're out of chips</h3>
          <p className="mt-2 text-sm text-cream-dim">Rebuy for {formatChips(setup.startingStack)} or leave the table.</p>
          <div className="mt-4 flex gap-3">
            <BrassButton variant="ghost" className="flex-1 py-3" onClick={() => { setNeedRebuy(false); controllerRef.current?.resolveRebuy('leave'); }}>
              Leave
            </BrassButton>
            <BrassButton variant="amber" className="flex-1 py-3" disabled={bankroll < setup.startingStack}
              onClick={() => { setNeedRebuy(false); controllerRef.current?.resolveRebuy('rebuy'); }}>
              Rebuy
            </BrassButton>
          </div>
        </Modal>
      )}

      {result && <ResultModal result={result} setup={setup} onClose={() => nav('/poker')} />}
    </div>
  );
}

function HudChip({ k, v }: { k: string; v: string }) {
  return (
    <div className="rounded-pill bg-walnut/70 px-2.5 py-1 text-center ring-1 ring-brass/20">
      <span className="text-[9px] uppercase tracking-wider text-cream-mute">{k} </span>
      <span className="tnum text-[11px] font-bold text-brass-light">{v}</span>
    </div>
  );
}

function ActionBar({ req, onAction }: { req: ActionReq; onAction: (a: any) => void }) {
  const { legal } = req;
  const [raiseTo, setRaiseTo] = useState(Math.min(legal.maxRaiseTo, legal.minRaiseTo));
  useEffect(() => {
    setRaiseTo(Math.min(legal.maxRaiseTo, legal.minRaiseTo));
  }, [legal.minRaiseTo, legal.maxRaiseTo]);

  const canRaise = legal.canRaise || legal.canBet;
  const potNow = req.pot;
  const quick = (frac: number) => {
    const target = Math.round(req.toCall + (potNow + req.toCall) * frac);
    setRaiseTo(Math.max(legal.minRaiseTo, Math.min(legal.maxRaiseTo, target)));
  };

  return (
    <div className="absolute inset-x-0 bottom-0 z-30 animate-fade-up px-3"
      style={{ paddingBottom: 'calc(var(--safe-bottom) + 10px)' }}>
      <div className="walnut grain rounded-panel p-3 shadow-panel ring-1 ring-brass/30">
        {canRaise && (
          <div className="mb-3">
            <div className="flex items-center justify-between text-xs text-cream-dim">
              <span>Raise to</span>
              <span className="tnum text-base font-bold text-brass-light">{formatChips(raiseTo)}</span>
            </div>
            <input
              type="range" min={legal.minRaiseTo} max={legal.maxRaiseTo} step={Math.max(1, Math.round((legal.maxRaiseTo - legal.minRaiseTo) / 100))}
              value={raiseTo} onChange={(e) => setRaiseTo(Number(e.target.value))}
              className="mt-1.5 w-full accent-amber"
            />
            <div className="mt-1 grid grid-cols-4 gap-1.5">
              {[['½', 0.5], ['¾', 0.75], ['Pot', 1], ['Max', -1]].map(([lbl, f]) => (
                <button key={lbl as string}
                  onClick={() => { play('button'); (f as number) === -1 ? setRaiseTo(legal.maxRaiseTo) : quick(f as number); }}
                  className="tactile rounded-pill bg-walnut-light/70 py-1.5 text-xs font-semibold text-cream-dim ring-1 ring-brass/20">
                  {lbl}
                </button>
              ))}
            </div>
          </div>
        )}
        <div className="grid grid-cols-3 gap-2">
          <BrassButton variant="danger" sfx="fold" className="py-3.5"
            onClick={() => onAction({ type: 'fold' })}>
            Fold
          </BrassButton>
          {legal.canCheck ? (
            <BrassButton variant="felt" sfx="check" className="py-3.5" onClick={() => onAction({ type: 'check' })}>
              Check
            </BrassButton>
          ) : (
            <BrassButton variant="felt" sfx="chip" className="py-3.5"
              onClick={() => onAction({ type: 'call' })}>
              <div className="leading-tight">Call<div className="tnum text-[11px] opacity-90">{formatChips(legal.callAmount)}</div></div>
            </BrassButton>
          )}
          {canRaise ? (
            <BrassButton variant="amber" sfx="chipStack" className="py-3.5"
              onClick={() => onAction(raiseTo >= legal.maxRaiseTo ? { type: 'all-in' } : { type: legal.canBet ? 'bet' : 'raise', amount: raiseTo })}>
              <div className="leading-tight">{raiseTo >= legal.maxRaiseTo ? 'All In' : 'Raise'}
                {raiseTo < legal.maxRaiseTo && <div className="tnum text-[11px] opacity-90">{formatChips(raiseTo)}</div>}</div>
            </BrassButton>
          ) : (
            <BrassButton variant="amber" sfx="chip" className="py-3.5" onClick={() => onAction({ type: 'call' })}>
              Call
            </BrassButton>
          )}
        </div>
      </div>
    </div>
  );
}

function Modal({ children }: { children: React.ReactNode }) {
  return (
    <div className="absolute inset-0 z-40 grid place-items-center bg-black/70 px-6">
      <Panel className="w-full max-w-sm animate-fade-up p-6 text-center">{children}</Panel>
    </div>
  );
}

function ResultModal({ result, setup, onClose }: { result: TableResult; setup: PokerSetup; onClose: () => void }) {
  const won = result.place === 1;
  useEffect(() => {
    if (won) { play('jackpot'); haptic([20, 60, 20, 60, 20]); }
    else if (result.prize > 0) { play('winBig'); }
    else play('lose');
  }, [won, result.prize]);

  return (
    <Modal>
      {setup.mode === 'cash' ? (
        <>
          <h3 className="font-display text-2xl font-bold brass-text">You left the table</h3>
          <p className="mt-2 text-sm text-cream-dim">Cashed out</p>
          <div className="tnum mt-1 font-slab text-3xl font-bold text-amber-light">{formatChips(result.cashOut ?? 0)}</div>
        </>
      ) : (
        <>
          {won && <div className="mx-auto mb-2 w-fit"><Trophy size={64} /></div>}
          <h3 className="font-display text-2xl font-bold brass-text">
            {won ? 'Champion!' : result.prize > 0 ? 'In the Money' : 'Eliminated'}
          </h3>
          <p className="mt-2 text-sm text-cream-dim">
            Finished {ordinal(result.place ?? 0)} of {formatChips(result.fieldSize ?? setup.seatCount)}
          </p>
          {result.prize > 0 && (
            <div className="tnum mt-2 font-slab text-3xl font-bold text-amber-light">+{formatChips(result.prize)}</div>
          )}
        </>
      )}
      <BrassButton variant="gold" className="mt-5 w-full py-3" onClick={onClose}>Back to Lobby</BrassButton>
    </Modal>
  );
}

function ordinal(n: number): string {
  const s = ['th', 'st', 'nd', 'rd'];
  const v = n % 100;
  return n + (s[(v - 20) % 10] || s[v] || s[0]);
}
