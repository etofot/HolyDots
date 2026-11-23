import { useUserStore } from '../store/useUserStore';
import { useGameStore } from '../store/useGameStore';
import { Play, Settings, Trophy, Flame } from 'lucide-react';
import { EventBus } from '../game/EventBus';
import { playSfx, unlockAudio } from '../game/audio';

export function MainMenu() {
  const { setGameState } = useGameStore();
  const { bestWave, bestScore, heatPoints } = useUserStore();

  const handlePlay = () => {
    unlockAudio();
    playSfx('ui');
    useGameStore.getState().resetSession();
    setGameState('playing');
    EventBus.emit('heat-lock-restart');
  };

  return (
    <div className="absolute inset-0 flex flex-col items-center justify-between p-8 pointer-events-auto bg-gradient-to-b from-black/85 via-[#1a0608]/80 to-black/90 backdrop-blur-[3px] z-50 text-white">
      {/* Ambient orbs */}
      <div className="pointer-events-none absolute inset-0 overflow-hidden">
        <div className="absolute -top-20 left-1/2 -translate-x-1/2 w-72 h-72 rounded-full bg-[#FF4500]/10 blur-3xl" />
        <div className="absolute bottom-10 left-8 w-40 h-40 rounded-full bg-[#FFD700]/8 blur-2xl" />
      </div>

      <div className="w-full flex justify-between pt-4 px-4 text-[#FFD700] font-bold relative z-10">
        <div className="flex items-center gap-1.5 bg-black/40 px-2.5 py-1 rounded-full border border-[#FF8800]/25">
          <Flame size={16} color="#FF8800" className="fill-[#FF4500]" /> {heatPoints}
        </div>
        <div className="text-[10px] uppercase tracking-[0.25em] text-white/35 self-center">
          HEAT LOCK
        </div>
      </div>

      <div className="flex flex-col items-center justify-center flex-1 relative z-10">
        <div className="text-[10px] uppercase tracking-[0.45em] text-[#FF8800]/80 mb-2 font-bold">
          Portrait · Browser
        </div>
        <h1 className="text-6xl font-black italic tracking-tighter text-transparent bg-clip-text bg-gradient-to-b from-[#FFE066] via-[#FF8800] to-[#FF2200] drop-shadow-[0_0_28px_rgba(255,40,0,0.75)] mb-1">
          HEAT RUSH
        </h1>
        <div className="text-sm md:text-base text-[#FFD700] font-black mb-3 tracking-[0.28em] uppercase">
          Load · Lock · Detonate
        </div>
        <p className="text-white/55 text-center text-sm max-w-xs mb-5 leading-relaxed">
          Recolor until amber <span className="text-[#FFAA44] font-bold">HOT</span>, gold{' '}
          <span className="text-[#FFD700] font-bold">ARMED</span> — then SEND. Authored detonations chain into
          streaks. Overheat with heat left and you will feel it.
        </p>
        <div className="flex gap-2 mb-5 text-[10px] uppercase tracking-wider font-bold">
          <span className="bg-black/50 border border-[#FFAA44]/40 text-[#FFAA44] px-2.5 py-1 rounded-full">
            1. Load
          </span>
          <span className="bg-black/50 border border-[#FFD700]/40 text-[#FFD700] px-2.5 py-1 rounded-full">
            2. Lock
          </span>
          <span className="bg-black/50 border border-[#FF4500]/40 text-[#FF6644] px-2.5 py-1 rounded-full">
            3. Detonate
          </span>
        </div>

        {/* Color legend silhouettes */}
        <div className="flex gap-2 mb-7">
          {[
            { c: 'bg-[#FFD700]', s: '◆', t: 'Sun' },
            { c: 'bg-[#1E90FF]', s: '⬡', t: 'Crystal' },
            { c: 'bg-[#32CD32]', s: '●', t: 'Emerald' },
            { c: 'bg-[#F0F0F0]', s: '◈', t: 'Pearl' },
            { c: 'bg-[#FF4500]', s: '★', t: 'Wild' },
          ].map((item) => (
            <div
              key={item.t}
              className={`w-9 h-9 ${item.c} rounded-lg flex items-center justify-center text-black/80 text-sm font-bold shadow-md border border-white/20`}
              title={item.t}
            >
              {item.s}
            </div>
          ))}
        </div>

        <div className="bg-black/65 rounded-2xl p-4 border border-[#FF8800]/30 text-center mb-8 w-64 shadow-[0_0_28px_rgba(255,68,0,0.18)]">
          <div className="text-gray-400 text-[10px] mb-1 uppercase tracking-[0.2em]">Your Best</div>
          <div className="text-3xl font-black text-[#FFD700] tabular-nums">{bestScore}</div>
          <div className="text-sm text-[#FF8800] mt-1 font-semibold">Wave {bestWave}</div>
        </div>

        <button
          type="button"
          onClick={handlePlay}
          className="group relative w-64 h-20 bg-gradient-to-r from-[#FF8800] via-[#FF5500] to-[#FF1100] rounded-2xl flex items-center justify-center font-black text-3xl shadow-[0_0_36px_rgba(255,17,0,0.55)] hover:scale-105 transition-transform overflow-hidden border border-[#FFD700]/30"
        >
          <div className="absolute inset-0 bg-white/15 transform -skew-x-12 -translate-x-full group-hover:animate-[shimmer_1.5s_infinite]" />
          <Play size={32} className="mr-2 fill-current" /> PLAY
        </button>

        <div className="mt-6 text-[11px] text-white/40 text-center space-y-1 max-w-xs">
          <div className="font-semibold text-white/60">
            TAP recolor · Q/RMB reverse · H heat · SPACE send · ESC pause
          </div>
          <div>Chain ARMED locks for STREAK. Heat is scarce — clutch or regret.</div>
        </div>
      </div>

      <div className="w-full max-w-sm flex justify-center gap-8 px-4 pb-8 relative z-10">
        <MenuButton icon={<Trophy size={24} />} label="Rank" onClick={() => setGameState('leaderboard')} />
        <MenuButton icon={<Settings size={24} />} label="Settings" onClick={() => setGameState('settings')} />
      </div>
    </div>
  );
}

function MenuButton({
  icon,
  label,
  onClick,
}: {
  icon: React.ReactNode;
  label: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="flex flex-col items-center justify-center w-20 h-20 bg-gray-950/90 border border-gray-700/80 rounded-2xl hover:bg-gray-900 hover:border-[#FF8800] transition-colors group shadow-lg"
    >
      <div className="text-gray-400 group-hover:text-[#FFD700] transition-colors mb-1">{icon}</div>
      <div className="text-xs font-bold text-gray-500 group-hover:text-white uppercase">{label}</div>
    </button>
  );
}
