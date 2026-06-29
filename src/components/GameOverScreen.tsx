import { motion } from 'motion/react';
import { GameSettings, HighScore } from '../types';
import { playSound } from './AudioEngine';
import { Trophy, RefreshCw, Home, Award, ChevronRight } from 'lucide-react';
import { useState, FormEvent } from 'react';

interface GameOverScreenProps {
  score: number;
  level: number;
  settings: GameSettings;
  onRestart: () => void;
  onQuit: () => void;
  onSaveScore: (name: string, score: number) => void;
}

export default function GameOverScreen({
  score,
  level,
  settings,
  onRestart,
  onQuit,
  onSaveScore,
}: GameOverScreenProps) {
  const [name, setName] = useState('');
  const [submitted, setSubmitted] = useState(false);

  const handleHover = () => {
    playSound('click');
  };

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;
    
    playSound('select');
    onSaveScore(name.trim(), score);
    setSubmitted(true);
  };

  return (
    <div className="relative w-full h-full min-h-screen flex flex-col items-center justify-center bg-slate-950 text-white font-sans p-6 overflow-y-auto select-none">
      {/* Red Ambient Danger Flare Background */}
      <div className="absolute inset-x-0 top-0 h-96 bg-gradient-to-b from-rose-950/20 to-transparent pointer-events-none" />

      <motion.div
        initial={{ opacity: 0, scale: 0.9 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ type: 'spring', duration: 0.6 }}
        className="w-full max-w-md bg-slate-900/90 border border-slate-800 rounded-3xl p-6 md:p-8 backdrop-blur-md shadow-2xl z-10 text-center"
      >
        {/* Skull or Game Over Label */}
        <motion.div
          animate={{ scale: [1, 1.05, 1] }}
          transition={{ duration: 2, repeat: Infinity }}
          className="text-pink-500 font-black text-4xl md:text-5xl uppercase tracking-widest mb-2 filter drop-shadow-[0_4px_10px_rgba(244,63,94,0.4)]"
        >
          จบเกม !
          <span className="block text-xs font-semibold text-slate-400 font-mono tracking-wide mt-1">GAME OVER</span>
        </motion.div>

        {/* Level & Score plaques */}
        <div className="grid grid-cols-2 gap-4 my-6">
          <div className="bg-slate-950 border border-slate-850 p-4 rounded-2xl flex flex-col items-center">
            <Award className="w-5 h-5 text-yellow-400 mb-1" />
            <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wide">เลเวลสูงสุด (Level)</span>
            <span className="text-xl font-bold font-mono text-white">{level}</span>
          </div>
          <div className="bg-slate-950 border border-slate-850 p-4 rounded-2xl flex flex-col items-center">
            <Trophy className="w-5 h-5 text-cyan-400 mb-1" />
            <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wide">คะแนนสุทธิ (Score)</span>
            <span className="text-xl font-bold font-mono text-cyan-400">{score.toLocaleString()}</span>
          </div>
        </div>

        {/* Enter High Score Name */}
        {!submitted ? (
          <form onSubmit={handleSubmit} className="mb-6 text-left space-y-3 bg-slate-950 border border-slate-850 p-4 rounded-2xl">
            <div className="flex items-center gap-1.5 text-xs text-slate-300 font-semibold">
              <Trophy className="w-3.5 h-3.5 text-amber-400" />
              <span>บันทึกอันดับคะแนนสูงสุดของคุณ:</span>
            </div>
            <div className="flex gap-2">
              <input
                type="text"
                maxLength={15}
                required
                placeholder="พิมพ์ชื่อของคุณ..."
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="flex-1 px-3.5 py-2.5 bg-slate-900 border border-slate-800 text-white rounded-xl focus:outline-none focus:ring-1 focus:ring-cyan-500 font-medium text-sm transition"
              />
              <button
                type="submit"
                onMouseEnter={handleHover}
                className="px-5 bg-cyan-500 hover:bg-cyan-400 text-white font-bold rounded-xl transition cursor-pointer flex items-center justify-center text-sm"
              >
                <span>บันทึก</span>
                <ChevronRight className="w-4 h-4 ml-0.5" />
              </button>
            </div>
          </form>
        ) : (
          <div className="mb-6 py-3.5 px-4 bg-emerald-950/40 border border-emerald-800/60 rounded-2xl text-emerald-400 text-sm font-semibold flex items-center justify-center gap-2">
            <span>✓ บันทึกคะแนนของคุณสำเร็จเรียบร้อย!</span>
          </div>
        )}

        {/* Interactive action buttons */}
        <div className="space-y-3.5">
          <button
            onClick={() => { playSound('select'); onRestart(); }}
            onMouseEnter={handleHover}
            className="w-full py-4 bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-400 hover:to-blue-500 text-white font-black text-base rounded-2xl shadow-lg shadow-cyan-950/40 flex items-center justify-center gap-2.5 transition duration-150 hover:scale-[1.01] active:scale-99 cursor-pointer"
          >
            <RefreshCw className="w-5 h-5 text-white" />
            <span>เล่นอีกครั้ง (PLAY AGAIN)</span>
          </button>

          <button
            onClick={() => { playSound('select'); onQuit(); }}
            onMouseEnter={handleHover}
            className="w-full py-3.5 bg-slate-950 hover:bg-slate-850 text-slate-300 border border-slate-850 hover:border-slate-800 rounded-2xl text-sm font-bold flex items-center justify-center gap-2.5 transition duration-150 cursor-pointer"
          >
            <Home className="w-4 h-4 text-cyan-400" />
            <span>กลับสู่หน้าหลัก (BACK TO MENU)</span>
          </button>
        </div>
      </motion.div>
    </div>
  );
}
