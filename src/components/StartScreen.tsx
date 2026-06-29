import { motion } from 'motion/react';
import { GameSettings, HighScore } from '../types';
import { playSound } from './AudioEngine';
import { Play, Settings, Trophy, Volume2, VolumeX, HelpCircle, Swords, Zap } from 'lucide-react';
import { useState, useEffect } from 'react';

interface StartScreenProps {
  settings: GameSettings;
  highScores: HighScore[];
  onStartGame: () => void;
  onOpenOptions: () => void;
  onToggleSound: () => void;
}

export default function StartScreen({
  settings,
  highScores,
  onStartGame,
  onOpenOptions,
  onToggleSound,
}: StartScreenProps) {
  const [stars, setStars] = useState<{ x: number; y: number; size: number; duration: number }[]>([]);

  useEffect(() => {
    // Generate star field particles
    const generatedStars = Array.from({ length: 40 }).map(() => ({
      x: Math.random() * 100,
      y: Math.random() * 100,
      size: Math.random() * 2 + 1,
      duration: Math.random() * 3 + 2,
    }));
    setStars(generatedStars);
  }, []);

  const handleHover = () => {
    playSound('click');
  };

  const handleSelect = (callback: () => void) => {
    playSound('select');
    callback();
  };

  // Convert binding display names to readable text
  const getBindingLabel = (key: string) => {
    if (key === ' ') return 'Spacebar';
    if (key.toLowerCase() === 'p') return 'P';
    if (key.toLowerCase() === 'o') return 'O';
    if (key.startsWith('Arrow')) return key.replace('Arrow', 'ปุ่มลูกศร ');
    return key.toUpperCase();
  };

  return (
    <div className="relative w-full h-full min-h-screen flex flex-col items-center justify-between bg-slate-950 text-white overflow-hidden font-sans select-none">
      {/* Dynamic Animated Star Field Background */}
      <div className="absolute inset-0 z-0 pointer-events-none">
        {stars.map((star, i) => (
          <motion.div
            key={i}
            className="absolute bg-white rounded-full opacity-60"
            style={{
              left: `${star.x}%`,
              top: `${star.y}%`,
              width: `${star.size}px`,
              height: `${star.size}px`,
            }}
            animate={{
              opacity: [0.2, 0.9, 0.2],
              scale: [1, 1.3, 1],
            }}
            transition={{
              duration: star.duration,
              repeat: Infinity,
              ease: 'easeInOut',
            }}
          />
        ))}
        {/* Subtle Cyber Grid Bottom Overlay */}
        <div 
          className="absolute bottom-0 left-0 right-0 h-64 opacity-15"
          style={{
            backgroundImage: `linear-gradient(rgba(14, 116, 144, 0) 0%, rgba(14, 116, 144, 0.4) 100%), 
                              linear-gradient(90deg, #0e7490 1px, transparent 1px), 
                              linear-gradient(0deg, #0e7490 1px, transparent 1px)`,
            backgroundSize: '40px 40px',
            transform: 'perspective(500px) rotateX(60deg)',
            transformOrigin: 'bottom',
          }}
        />
      </div>

      {/* Floating Audio Status in Top Right Corner */}
      <div className="absolute top-6 right-6 z-10 flex items-center gap-3">
        <button
          onClick={onToggleSound}
          className="p-3 bg-slate-900/80 border border-slate-800 hover:border-cyan-500 rounded-xl transition duration-150 backdrop-blur-md cursor-pointer hover:scale-105 active:scale-95"
          title={settings.soundEnabled ? 'Mute' : 'Unmute'}
          onMouseEnter={handleHover}
        >
          {settings.soundEnabled ? (
            <Volume2 className="w-5 h-5 text-cyan-400" />
          ) : (
            <VolumeX className="w-5 h-5 text-slate-500" />
          )}
        </button>
      </div>

      {/* Main Container */}
      <div className="flex-1 w-full max-w-lg flex flex-col items-center justify-center px-6 py-12 z-10">
        {/* Game Title Logo Banner */}
        <motion.div
          initial={{ opacity: 0, y: -40 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8, type: 'spring', bounce: 0.35 }}
          className="w-full flex justify-center mb-8"
        >
          <div className="relative group">
            {/* Soft pink/cyan back glow */}
            <div className="absolute -inset-2 bg-gradient-to-r from-pink-500 to-cyan-500 rounded-2xl blur opacity-30 group-hover:opacity-50 transition duration-1000" />
            
            <img
              id="game-logo"
              src="https://res.cloudinary.com/dsucg33fv/image/upload/v1782709347/logo_i8827v.png"
              alt="Retro Game Logo"
              className="max-h-48 relative rounded-xl object-contain drop-shadow-[0_10px_10px_rgba(6,182,212,0.3)] select-none pointer-events-none"
              referrerPolicy="no-referrer"
            />
          </div>
        </motion.div>

        {/* Action Menu */}
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ delay: 0.2, duration: 0.5 }}
          className="w-full space-y-4 mb-8"
        >
          {/* PLAY BUTTON - เข้าเกม */}
          <button
            id="play-button"
            onClick={() => handleSelect(onStartGame)}
            onMouseEnter={handleHover}
            className="w-full py-4 px-6 bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-400 hover:to-blue-500 text-white font-bold text-xl rounded-xl border border-cyan-400 shadow-[0_0_20px_rgba(6,182,212,0.4)] hover:shadow-[0_0_30px_rgba(6,182,212,0.6)] flex items-center justify-center gap-3 transition-all duration-150 cursor-pointer hover:scale-[1.02] active:scale-98"
          >
            <Play className="w-6 h-6 fill-current text-white" />
            <span>เข้าเกม (START PLAY)</span>
          </button>

          {/* OPTIONS BUTTON - Options/ตั้งค่าการควบคุม */}
          <button
            id="options-button"
            onClick={() => handleSelect(onOpenOptions)}
            onMouseEnter={handleHover}
            className="w-full py-4 px-6 bg-slate-900 hover:bg-slate-800 text-slate-100 font-semibold text-lg rounded-xl border border-slate-800 hover:border-cyan-500/50 flex items-center justify-center gap-3 transition-all duration-150 cursor-pointer hover:scale-[1.02] active:scale-98"
          >
            <Settings className="w-5 h-5 text-cyan-400" />
            <span>ตั้งค่าปุ่มควบคุม (OPTIONS)</span>
          </button>
        </motion.div>

        {/* Quick Current Controls Summary Card */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.4 }}
          className="w-full p-4 bg-slate-900/60 border border-slate-800/80 rounded-xl mb-6 text-sm backdrop-blur-md"
        >
          <div className="flex items-center gap-2 mb-2 text-cyan-400 font-semibold">
            <HelpCircle className="w-4 h-4" />
            <span>ปุ่มบังคับปัจจุบัน (Current Mappings):</span>
          </div>
          <div className="grid grid-cols-2 gap-y-2 gap-x-4 text-xs text-slate-300">
            <div>ขึ้น (Up): <span className="text-white font-mono bg-slate-800 px-1.5 py-0.5 rounded">{getBindingLabel(settings.bindings.up)}</span></div>
            <div>ลง (Down): <span className="text-white font-mono bg-slate-800 px-1.5 py-0.5 rounded">{getBindingLabel(settings.bindings.down)}</span></div>
            <div>ซ้าย (Left): <span className="text-white font-mono bg-slate-800 px-1.5 py-0.5 rounded">{getBindingLabel(settings.bindings.left)}</span></div>
            <div>ขวา (Right): <span className="text-white font-mono bg-slate-800 px-1.5 py-0.5 rounded">{getBindingLabel(settings.bindings.right)}</span></div>
            
            <div className="col-span-2 pt-2 border-t border-slate-800/60 mt-1.5 flex justify-between items-center">
              <span className="flex items-center gap-1"><Swords className="w-3.5 h-3.5 text-pink-400" /> ต่อย/โจมตี (Punch):</span>
              <span className="text-pink-300 font-bold font-mono bg-pink-950/50 border border-pink-900/50 px-2.5 py-0.5 rounded">
                {getBindingLabel(settings.bindings.punch)}
              </span>
            </div>

            <div className="col-span-2 pt-1 flex justify-between items-center">
              <span className="flex items-center gap-1"><Zap className="w-3.5 h-3.5 text-amber-400" /> สกิลระเบิดพลัง (Skill):</span>
              <span className="text-amber-300 font-bold font-mono bg-amber-950/50 border border-amber-900/50 px-2.5 py-0.5 rounded">
                {getBindingLabel(settings.bindings.skill)}
              </span>
            </div>
          </div>
        </motion.div>

        {/* High Scores Leaderboard Panel */}
        {highScores.length > 0 && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.6 }}
            className="w-full bg-slate-900/40 border border-slate-900 rounded-xl p-4"
          >
            <div className="flex items-center gap-2 text-amber-400 font-semibold text-sm mb-3">
              <Trophy className="w-4 h-4 fill-current" />
              <span>อันดับคะแนนสูงสุด (High Scores):</span>
            </div>
            <div className="space-y-1.5 text-xs">
              {highScores.slice(0, 3).map((record, index) => (
                <div key={index} className="flex justify-between items-center text-slate-300">
                  <div className="flex items-center gap-2">
                    <span className="font-bold text-amber-500 font-mono w-4">{index + 1}.</span>
                    <span className="font-medium text-white max-w-28 truncate">{record.name}</span>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className="font-mono text-cyan-400 font-semibold">{record.score.toLocaleString()}</span>
                    <span className="text-[10px] text-slate-500">{record.date}</span>
                  </div>
                </div>
              ))}
            </div>
          </motion.div>
        )}
      </div>

      {/* Footer Credentials Info */}
      <div className="pb-6 text-center text-slate-500 text-xs z-10 w-full px-4 space-y-1">
        <div>ใช้ปุ่มทิศทางเพื่อบังคับเดิน 8 ทิศทาง กล้อง 3D หมุนตามตัวละคร</div>
        <div>กด <span className="text-pink-400 font-bold">P</span> ต่อยปล่อย Hit Box / กด <span className="text-amber-400 font-bold">O</span> ปล่อยคลื่นสกิลระเบิดพลัง!</div>
      </div>
    </div>
  );
}
