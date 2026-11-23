import { useEffect } from 'react';
import { useGameStore } from '../store/useGameStore';
import { useUserStore } from '../store/useUserStore';
import { supabase } from '../lib/supabase';
import { Flame, Send, Zap, Pause, Play } from 'lucide-react';
import { EventBus } from '../game/EventBus';
import { playSfx, unlockAudio } from '../game/audio';

export function GameUI() {
  const {
    gameState,
    setGameState,
    score,
    wave,
    combo,
    heat,
    heatMax,
    fuseRatio,
    phase,
    prompt,
    heatAtDeath,
    fuseArmed,
    armedRun,
    fuseHot,
    heatCanArm,
    sessionDetonations,
    sessionMaxCascade,
    sessionBestClear,
    lastVerdict,
    deathCause,
    armedStreak,
    bestArmedStreak,
  } = useGameStore();
  const { id, bestScore, bestWave } = useUserStore();

  useEffect(() => {
    const handleGameOver = () => {
      setGameState('gameover');
      if (id) {
        const storeScore = useGameStore.getState().score;
        const storeWave = useGameStore.getState().wave;

        void supabase
          .from('leaderboards')
          .insert({
            user_id: id,
            score: storeScore,
            wave: storeWave,
          })
          .then(({ error }) => {
            if (error) console.warn('leaderboard insert failed', error.message);
          });

        const uState = useUserStore.getState();
        void supabase
          .from('profiles')
          .update({
            best_score: Math.max(uState.bestScore, storeScore),
            best_wave: Math.max(uState.bestWave, storeWave),
            heat_points: uState.heatPoints,
          })
          .eq('id', id)
          .then(({ error }) => {
            if (error) console.warn('profile update failed', error.message);
          });
      }
    };

    EventBus.on('game-over', handleGameOver);
    return () => {
      EventBus.off('game-over', handleGameOver);
    };
  }, [id, setGameState]);

  // PC: Space/Enter on OVERHEAT → ONE MORE LOCK
  useEffect(() => {
    if (gameState !== 'gameover') return;
    const onKey = (e: KeyboardEvent) => {
      if (e.code !== 'Space' && e.code !== 'Enter') return;
      e.preventDefault();
      unlockAudio();
      playSfx('ui');
      setGameState('playing');
      EventBus.emit('heat-lock-restart');
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [gameState, setGameState]);

  if (gameState === 'paused') {
    return (
      <div className="absolute inset-0 bg-black/80 flex flex-col items-center justify-center text-white pointer-events-auto z-40 p-6">
        <div className="text-[10px] uppercase tracking-[0.4em] text-white/40 mb-2">Take a breath</div>
        <h2 className="text-4xl font-black text-[#FFD700] mb-6">PAUSED</h2>
        <p className="text-white/50 text-sm mb-8 text-center max-w-xs">
          Fuse timer is frozen. ESC or Resume to continue the lock.
        </p>
        <div className="flex flex-col gap-3 w-full max-w-xs">
          <button
            type="button"
            onClick={() => {
              unlockAudio();
              playSfx('ui');
              setGameState('playing');
              useGameStore.getState().setPrompt('');
            }}
            className="bg-gradient-to-r from-[#FF8800] to-[#FF1100] py-4 rounded-2xl font-black text-xl flex items-center justify-center gap-2"
          >
            <Play size={22} className="fill-current" /> RESUME
          </button>
          <button
            type="button"
            onClick={() => {
              useGameStore.getState().resetSession();
              setGameState('menu');
              EventBus.emit('heat-lock-restart');
            }}
            className="bg-gray-900 border border-white/10 py-3 rounded-xl font-bold"
          >
            MAIN MENU
          </button>
        </div>
      </div>
    );
  }

  if (gameState === 'playing') {
    const fusePct = Math.round(fuseRatio * 100);
    const fuseUrgent = fuseRatio <= 0.45;
    const fuseColor = fuseUrgent
      ? 'from-[#FF4500] to-[#FF1100]'
      : fuseArmed
        ? 'from-[#FFE066] to-[#FF8800]'
        : fuseHot
          ? 'from-[#FFAA44] to-[#FF6600]'
          : 'from-[#FFD700] to-[#FF8800]';
    const phaseLabel =
      phase === 'loading'
        ? fuseArmed
          ? 'ARMED'
          : fuseHot
            ? 'HOT'
            : 'LOAD THE FUSE'
        : phase === 'rising'
          ? 'RISING…'
          : phase === 'resolving'
            ? 'DETONATE'
            : phase;

    return (
      <div className="absolute inset-0 pointer-events-none flex flex-col justify-between text-white">
        {/* Top HUD plate */}
        <div className="p-3 flex justify-between items-start">
          <div className="bg-black/50 backdrop-blur-[2px] rounded-2xl px-3 py-2 border border-white/10 shadow-lg">
            <div className="text-[10px] font-bold uppercase tracking-[0.2em] text-[#FFD700]/80">
              Wave {wave}
            </div>
            <div className="text-3xl font-black tabular-nums drop-shadow-lg leading-none mt-0.5">
              {score}
            </div>
            <div
              className={`text-[10px] uppercase tracking-widest font-black mt-1 ${
                phase === 'resolving'
                  ? 'text-[#FF4500] animate-pulse'
                  : phase === 'rising'
                    ? 'text-[#FFD700]'
                    : fuseArmed
                      ? 'text-[#FFE066] animate-pulse'
                      : fuseHot
                        ? 'text-[#FFAA44] animate-pulse'
                        : 'text-white/45'
              }`}
            >
              {phaseLabel}
              {fuseArmed && armedRun >= 3 ? ` · ${armedRun}` : ''}
            </div>
          </div>

          <div className="flex flex-col items-end gap-2">
            <button
              type="button"
              onClick={() => {
                unlockAudio();
                playSfx('ui');
                setGameState('paused');
              }}
              className="pointer-events-auto w-9 h-9 rounded-full bg-black/55 border border-white/15 flex items-center justify-center hover:border-[#FFD700]/50"
              aria-label="Pause"
            >
              <Pause size={16} />
            </button>
            {armedStreak >= 2 && (
              <div className="text-sm font-black text-[#FFE066] animate-pulse drop-shadow bg-black/55 px-3 py-1 rounded-full border border-[#FFD700]/50 shadow-[0_0_14px_rgba(255,200,0,0.35)]">
                STREAK ×{armedStreak}
              </div>
            )}
            {combo > 1 && (
              <div className="text-lg font-black text-[#FF8800] animate-pulse drop-shadow bg-black/50 px-3 py-1 rounded-full border border-[#FF8800]/40">
                {combo}x COMBO
              </div>
            )}
            <div className="flex items-center gap-1 bg-black/60 rounded-full px-2.5 py-1.5 border border-[#FF4500]/45 shadow-[0_0_16px_rgba(255,69,0,0.3)]">
              {Array.from({ length: heatMax }).map((_, i) => (
                <Flame
                  key={i}
                  size={18}
                  className={
                    i < heat
                      ? 'text-[#FF4500] fill-[#FF8800] drop-shadow-[0_0_6px_rgba(255,69,0,0.8)]'
                      : 'text-white/20'
                  }
                />
              ))}
            </div>
          </div>
        </div>

        {prompt && (
          <div className="absolute top-28 left-0 right-0 flex justify-center px-4">
            <div
              className={`text-xs font-bold uppercase tracking-wide px-4 py-2 rounded-full max-w-[92%] text-center shadow-lg border ${
                fuseArmed
                  ? 'bg-[#FF4500]/85 border-[#FFD700] text-white shadow-[0_0_20px_rgba(255,69,0,0.5)]'
                  : fuseHot
                    ? 'bg-[#FF8800]/80 border-[#FFD700]/60 text-white'
                    : 'bg-black/75 border-[#FFD700]/45 text-[#FFD700]'
              }`}
            >
              {prompt}
            </div>
          </div>
        )}

        <div className="p-3 pointer-events-auto space-y-2">
          {phase === 'loading' && (
            <div className="w-full h-3.5 rounded-full bg-black/70 overflow-hidden border border-white/20 shadow-inner relative">
              <div
                className={`h-full bg-gradient-to-r ${fuseColor} transition-[width] duration-100 ease-linear ${
                  fuseUrgent || fuseArmed ? 'animate-pulse' : ''
                }`}
                style={{ width: `${fusePct}%` }}
              />
              {(fuseArmed || fuseHot) && (
                <div className="absolute inset-0 flex items-center justify-center text-[9px] font-black tracking-widest text-black/80">
                  {fuseArmed ? 'ARMED' : 'HOT'}
                </div>
              )}
            </div>
          )}
          {phase === 'rising' && (
            <div
              className={`w-full text-center text-[10px] uppercase tracking-[0.22em] font-bold pb-1 ${
                fuseArmed ? 'text-[#FFD700] animate-pulse' : 'text-white/40'
              }`}
            >
              {fuseArmed
                ? `ARMED TRAIL${armedRun >= 3 ? ` ×${armedRun}` : ''} — locks at ceiling`
                : 'COLD TRAIL — no input · dig next fuse'}
            </div>
          )}
          {phase === 'resolving' && (
            <div className="w-full text-center text-[11px] uppercase tracking-[0.3em] text-[#FF4500] font-black pb-1 animate-pulse">
              DETONATION
            </div>
          )}

          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => {
                unlockAudio();
                EventBus.emit('heat-lock-heat');
              }}
              disabled={phase !== 'loading' || heat <= 0}
              className={`flex-1 h-14 rounded-2xl font-bold text-sm flex items-center justify-center gap-2
                disabled:opacity-35 disabled:grayscale active:scale-95 transition-transform
                ${
                  heatCanArm && phase === 'loading' && heat > 0 && !fuseArmed
                    ? 'bg-gradient-to-b from-[#FF7744] to-[#AA0000] border-2 border-[#FFD700] shadow-[0_0_28px_rgba(255,69,0,0.75)] animate-pulse scale-[1.03]'
                    : 'bg-gradient-to-b from-[#FF5522] to-[#880000] border border-[#FFD700]/35 shadow-[0_4px_16px_rgba(255,40,0,0.35)]'
                }`}
            >
              <Zap size={18} className="fill-current" />{' '}
              {heatCanArm && !fuseArmed ? 'CLUTCH' : 'HEAT'}{' '}
              <span className="text-[10px] opacity-70 font-semibold">(H)</span>
            </button>
            <button
              type="button"
              onClick={() => {
                unlockAudio();
                EventBus.emit('heat-lock-send');
              }}
              disabled={phase !== 'loading'}
              className={`flex-[1.45] h-14 rounded-2xl font-black text-base flex items-center justify-center gap-2
                disabled:opacity-35 active:scale-95 transition-all
                ${
                  fuseArmed
                    ? 'bg-gradient-to-b from-[#FFE066] via-[#FF8800] to-[#FF3300] text-black shadow-[0_0_28px_rgba(255,100,0,0.75)] scale-[1.02] animate-pulse'
                    : fuseHot
                      ? 'bg-gradient-to-b from-[#FFCC66] to-[#FF6600] text-black shadow-[0_0_18px_rgba(255,120,0,0.45)]'
                      : 'bg-gradient-to-b from-[#FFD700] to-[#FF8800] text-black shadow-[0_0_20px_rgba(255,136,0,0.45)]'
                }`}
            >
              <Send size={18} /> {fuseArmed ? 'DETONATE' : 'SEND'}{' '}
              <span className="text-[10px] opacity-70 font-semibold">SPACE</span>
            </button>
          </div>
        </div>
      </div>
    );
  }

  if (gameState === 'gameover') {
    return (
      <div className="absolute inset-0 bg-gradient-to-b from-black/92 via-[#1a0505]/94 to-black/96 flex flex-col items-center justify-center text-white pointer-events-auto p-6 z-40">
        <div className="text-[10px] uppercase tracking-[0.4em] text-white/40 mb-2">Fuse invaded</div>
        <h2 className="text-5xl font-black mb-1 text-transparent bg-clip-text bg-gradient-to-b from-[#FF6644] to-[#FF1100] drop-shadow-[0_0_24px_rgba(255,30,0,0.6)]">
          OVERHEAT
        </h2>

        <div className="text-center mb-6 space-y-2 mt-4">
          <div className="text-5xl font-black text-[#FFD700] tabular-nums drop-shadow-lg">{score}</div>
          <div className="text-[#FF8800] font-bold tracking-wide">Wave {wave}</div>

          {deathCause && (
            <p className="mt-3 text-sm text-white/75 max-w-sm mx-auto leading-snug border border-[#FF4500]/25 bg-black/50 rounded-xl px-4 py-3">
              {deathCause}
            </p>
          )}
          {lastVerdict && (
            <div className="text-[10px] uppercase tracking-[0.25em] text-[#FFD700]/70 font-bold">
              Last lock · {lastVerdict}
            </div>
          )}

          <div className="flex justify-center gap-2 mt-4 text-[11px] font-bold uppercase tracking-wide flex-wrap">
            <div className="bg-black/45 border border-white/10 rounded-xl px-3 py-2">
              <div className="text-white/35 text-[9px]">Detonations</div>
              <div className="text-[#FFD700] text-lg tabular-nums">{sessionDetonations}</div>
            </div>
            <div className="bg-black/45 border border-white/10 rounded-xl px-3 py-2">
              <div className="text-white/35 text-[9px]">Max chain</div>
              <div className="text-[#FF8800] text-lg tabular-nums">×{sessionMaxCascade}</div>
            </div>
            <div className="bg-black/45 border border-white/10 rounded-xl px-3 py-2">
              <div className="text-white/35 text-[9px]">Best clear</div>
              <div className="text-white text-lg tabular-nums">{sessionBestClear}</div>
            </div>
            <div className="bg-black/45 border border-[#FFD700]/25 rounded-xl px-3 py-2">
              <div className="text-white/35 text-[9px]">Best streak</div>
              <div className="text-[#FFE066] text-lg tabular-nums">×{bestArmedStreak}</div>
            </div>
          </div>

          {heatAtDeath > 0 ? (
            <div className="mt-4 text-sm text-[#FF6644] font-bold flex items-center justify-center gap-1.5 max-w-xs mx-auto bg-black/40 px-4 py-2 rounded-xl border border-[#FF4500]/30">
              <Flame size={16} className="fill-current shrink-0" />
              {heatAtDeath} heat left unused — rewrite that fuse
            </div>
          ) : (
            <div className="mt-4 text-sm text-white/40">You spent every ember. Respect.</div>
          )}
          <div className="text-gray-500 text-xs mt-3">
            Best {bestScore} · Wave {bestWave}
          </div>
        </div>

        <div className="flex flex-col gap-3 w-full max-w-xs">
          <button
            type="button"
            onClick={() => {
              unlockAudio();
              playSfx('ui');
              setGameState('playing');
              EventBus.emit('heat-lock-restart');
            }}
            className="bg-gradient-to-r from-[#FF8800] to-[#FF1100] text-white py-4 rounded-2xl font-black text-xl hover:scale-[1.02] transition-transform shadow-[0_0_32px_rgba(255,17,0,0.45)]"
          >
            ONE MORE LOCK
          </button>
          <div className="text-[10px] text-center text-white/35 uppercase tracking-widest">
            Space / Enter to retry
          </div>
          <button
            type="button"
            onClick={() => {
              useGameStore.getState().resetSession();
              setGameState('menu');
              EventBus.emit('heat-lock-restart');
            }}
            className="bg-gray-900/90 border border-white/10 text-white py-3 rounded-xl font-bold hover:bg-gray-800 transition-colors"
          >
            MAIN MENU
          </button>
        </div>
      </div>
    );
  }

  return null;
}
