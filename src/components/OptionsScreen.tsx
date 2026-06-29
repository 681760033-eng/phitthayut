import { motion } from 'motion/react';
import { GameSettings, KeyBindings, ControlPreset } from '../types';
import { playSound, setAudioSettings } from './AudioEngine';
import { ArrowLeft, Volume2, Keyboard, CheckCircle } from 'lucide-react';
import { useState, useEffect } from 'react';

interface OptionsScreenProps {
  settings: GameSettings;
  onSaveSettings: (settings: GameSettings) => void;
  onBackToMenu: () => void;
}

const PRESET_ARROWS: KeyBindings = {
  up: 'ArrowUp',
  down: 'ArrowDown',
  left: 'ArrowLeft',
  right: 'ArrowRight',
  punch: 'p',
  skill: 'o',
};

const PRESET_WASD: KeyBindings = {
  up: 'w',
  down: 's',
  left: 'a',
  right: 'd',
  punch: 'p',
  skill: 'o',
};

export default function OptionsScreen({
  settings,
  onSaveSettings,
  onBackToMenu,
}: OptionsScreenProps) {
  const [bindings, setBindings] = useState<KeyBindings>({ ...settings.bindings });
  const [preset, setPreset] = useState<ControlPreset>(settings.preset);
  const [soundEnabled, setSoundEnabled] = useState(settings.soundEnabled);
  const [soundVolume, setSoundVolume] = useState(settings.soundVolume);
  const [difficulty, setDifficulty] = useState<'easy' | 'normal' | 'hard'>(settings.difficulty);

  // Keep track of which action is actively waiting for a key press
  const [activeListeningAction, setActiveListeningAction] = useState<keyof KeyBindings | null>(null);

  // Listen to keys globally when listening mode is active
  useEffect(() => {
    if (!activeListeningAction) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      e.preventDefault();
      e.stopPropagation();

      const newKey = e.key;
      
      setBindings((prev) => ({
        ...prev,
        [activeListeningAction]: newKey,
      }));
      
      setPreset('custom');
      setActiveListeningAction(null);
      playSound('select');
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [activeListeningAction]);

  const handleHover = () => {
    playSound('click');
  };

  const handleApplyPreset = (type: 'arrows' | 'wasd') => {
    playSound('select');
    setPreset(type);
    if (type === 'arrows') {
      setBindings(PRESET_ARROWS);
    } else {
      setBindings(PRESET_WASD);
    }
  };

  const startListening = (action: keyof KeyBindings) => {
    playSound('click');
    setActiveListeningAction(action);
  };

  const handleToggleSound = () => {
    const nextEnabled = !soundEnabled;
    setSoundEnabled(nextEnabled);
    setAudioSettings(nextEnabled, soundVolume);
    playSound('select');
  };

  const handleVolumeChange = (vol: number) => {
    setSoundVolume(vol);
    setAudioSettings(soundEnabled, vol);
  };

  const handleSave = () => {
    playSound('select');
    onSaveSettings({
      bindings,
      preset,
      soundEnabled,
      soundVolume,
      difficulty,
    });
    onBackToMenu();
  };

  const getBindingDisplay = (action: keyof KeyBindings) => {
    if (activeListeningAction === action) {
      return 'กำลังรอปุ่ม... (Press Key)';
    }
    const val = bindings[action];
    if (val === ' ') return 'Spacebar';
    if (val.startsWith('Arrow')) {
      return val.replace('Arrow', 'ปุ่มลูกศร ');
    }
    return val.toUpperCase();
  };

  return (
    <div className="relative w-full h-full min-h-screen flex flex-col items-center justify-center bg-slate-950 text-white font-sans p-6 overflow-y-auto select-none">
      {/* Space Background */}
      <div className="absolute inset-0 z-0 opacity-10 pointer-events-none bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-blue-900 via-slate-950 to-slate-950" />

      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        className="w-full max-w-lg bg-slate-900/90 border border-slate-800 rounded-2xl p-6 md:p-8 backdrop-blur-md shadow-2xl z-10"
      >
        {/* Title */}
        <div className="flex items-center justify-between border-b border-slate-800 pb-4 mb-6">
          <div className="flex items-center gap-3">
            <Keyboard className="w-6 h-6 text-cyan-400" />
            <h1 className="text-xl md:text-2xl font-bold tracking-wide">
              ตั้งค่าการควบคุม <span className="text-sm font-normal text-slate-400 font-mono block">Control Options</span>
            </h1>
          </div>
          <button
            onClick={onBackToMenu}
            onMouseEnter={handleHover}
            className="p-2 hover:bg-slate-800 text-slate-400 hover:text-white rounded-lg transition cursor-pointer"
            title="Back to menu"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>
        </div>

        {/* Bindings Preset */}
        <div className="mb-6">
          <label className="text-sm font-semibold text-slate-300 block mb-3">รูปแบบปุ่มด่วน (Control Presets):</label>
          <div className="grid grid-cols-2 gap-3">
            <button
              onClick={() => handleApplyPreset('arrows')}
              onMouseEnter={handleHover}
              className={`py-3 px-4 rounded-xl border font-medium text-sm flex items-center justify-center gap-2 transition cursor-pointer ${
                preset === 'arrows'
                  ? 'bg-cyan-500/10 border-cyan-400 text-cyan-300'
                  : 'bg-slate-950 border-slate-800 text-slate-400 hover:border-slate-700'
              }`}
            >
              <Keyboard className="w-4 h-4" />
              <span>ปุ่มลูกศร (Arrow Keys)</span>
            </button>
            <button
              onClick={() => handleApplyPreset('wasd')}
              onMouseEnter={handleHover}
              className={`py-3 px-4 rounded-xl border font-medium text-sm flex items-center justify-center gap-2 transition cursor-pointer ${
                preset === 'wasd'
                  ? 'bg-cyan-500/10 border-cyan-400 text-cyan-300'
                  : 'bg-slate-950 border-slate-800 text-slate-400 hover:border-slate-700'
              }`}
            >
              <Keyboard className="w-4 h-4" />
              <span>WASD Keys</span>
            </button>
          </div>
        </div>

        {/* Custom Key Bindings Table */}
        <div className="space-y-3.5 mb-6">
          <div className="flex justify-between items-center">
            <label className="text-sm font-semibold text-slate-300">ปรับปุ่มรายตัว (Custom Bindings):</label>
            {preset === 'custom' && (
              <span className="text-[10px] text-cyan-400 font-mono border border-cyan-800/60 bg-cyan-950/40 px-2 py-0.5 rounded">
                ปุ่มกำหนดเอง (Custom Layout)
              </span>
            )}
          </div>

          <div className="bg-slate-950 border border-slate-850 rounded-xl divide-y divide-slate-900 overflow-hidden">
            {/* UP KEY */}
            <div className="flex items-center justify-between p-3">
              <span className="text-xs font-medium text-slate-400">เดินขึ้น (Move Up)</span>
              <button
                onClick={() => startListening('up')}
                className={`min-w-32 px-3 py-1.5 font-mono text-xs font-bold rounded-lg border text-center transition cursor-pointer ${
                  activeListeningAction === 'up'
                    ? 'bg-pink-950 border-pink-500 text-pink-300 animate-pulse'
                    : 'bg-slate-900 hover:bg-slate-850 border-slate-800 text-cyan-400 hover:text-cyan-300'
                }`}
              >
                {getBindingDisplay('up')}
              </button>
            </div>

            {/* DOWN KEY */}
            <div className="flex items-center justify-between p-3">
              <span className="text-xs font-medium text-slate-400">เดินลง (Move Down)</span>
              <button
                onClick={() => startListening('down')}
                className={`min-w-32 px-3 py-1.5 font-mono text-xs font-bold rounded-lg border text-center transition cursor-pointer ${
                  activeListeningAction === 'down'
                    ? 'bg-pink-950 border-pink-500 text-pink-300 animate-pulse'
                    : 'bg-slate-900 hover:bg-slate-850 border-slate-800 text-cyan-400 hover:text-cyan-300'
                }`}
              >
                {getBindingDisplay('down')}
              </button>
            </div>

            {/* LEFT KEY */}
            <div className="flex items-center justify-between p-3">
              <span className="text-xs font-medium text-slate-400">เดินซ้าย (Move Left)</span>
              <button
                onClick={() => startListening('left')}
                className={`min-w-32 px-3 py-1.5 font-mono text-xs font-bold rounded-lg border text-center transition cursor-pointer ${
                  activeListeningAction === 'left'
                    ? 'bg-pink-950 border-pink-500 text-pink-300 animate-pulse'
                    : 'bg-slate-900 hover:bg-slate-850 border-slate-800 text-cyan-400 hover:text-cyan-300'
                }`}
              >
                {getBindingDisplay('left')}
              </button>
            </div>

            {/* RIGHT KEY */}
            <div className="flex items-center justify-between p-3">
              <span className="text-xs font-medium text-slate-400">เดินขวา (Move Right)</span>
              <button
                onClick={() => startListening('right')}
                className={`min-w-32 px-3 py-1.5 font-mono text-xs font-bold rounded-lg border text-center transition cursor-pointer ${
                  activeListeningAction === 'right'
                    ? 'bg-pink-950 border-pink-500 text-pink-300 animate-pulse'
                    : 'bg-slate-900 hover:bg-slate-850 border-slate-800 text-cyan-400 hover:text-cyan-300'
                }`}
              >
                {getBindingDisplay('right')}
              </button>
            </div>

            {/* PUNCH KEY */}
            <div className="flex items-center justify-between p-3">
              <span className="text-xs font-medium text-slate-400">ปุ่มต่อยโจมตี (Punch Attack)</span>
              <button
                onClick={() => startListening('punch')}
                className={`min-w-32 px-3 py-1.5 font-mono text-xs font-bold rounded-lg border text-center transition cursor-pointer ${
                  activeListeningAction === 'punch'
                    ? 'bg-pink-950 border-pink-500 text-pink-300 animate-pulse'
                    : 'bg-slate-900 hover:bg-slate-850 border-slate-800 text-cyan-400 hover:text-cyan-300'
                }`}
              >
                {getBindingDisplay('punch')}
              </button>
            </div>

            {/* SKILL KEY */}
            <div className="flex items-center justify-between p-3">
              <span className="text-xs font-medium text-slate-400">ปุ่มวงแหวนระเบิดพลัง (Skill Ring)</span>
              <button
                onClick={() => startListening('skill')}
                className={`min-w-32 px-3 py-1.5 font-mono text-xs font-bold rounded-lg border text-center transition cursor-pointer ${
                  activeListeningAction === 'skill'
                    ? 'bg-pink-950 border-pink-500 text-pink-300 animate-pulse'
                    : 'bg-slate-900 hover:bg-slate-850 border-slate-800 text-cyan-400 hover:text-cyan-300'
                }`}
              >
                {getBindingDisplay('skill')}
              </button>
            </div>
          </div>
          {activeListeningAction && (
            <p className="text-[11px] text-pink-400 animate-pulse text-right">
              *กรุณากดปุ่มบนคีย์บอร์ดเพื่อบันทึกคีย์ที่ต้องการ...
            </p>
          )}
        </div>

        {/* Audio Slider & Difficulty settings */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 border-t border-slate-800 pt-5 mb-6">
          {/* Sound settings */}
          <div>
            <div className="flex justify-between items-center mb-2">
              <span className="text-xs font-semibold text-slate-300 flex items-center gap-1.5">
                <Volume2 className="w-4 h-4 text-cyan-400" /> เสียงเอฟเฟกต์ (Sound FX)
              </span>
              <button
                onClick={handleToggleSound}
                className={`text-[10px] font-bold px-1.5 py-0.5 rounded cursor-pointer ${
                  soundEnabled ? 'bg-cyan-950 text-cyan-400 border border-cyan-800/50' : 'bg-slate-950 text-slate-500'
                }`}
              >
                {soundEnabled ? 'เปิด (ON)' : 'ปิด (OFF)'}
              </button>
            </div>
            <input
              type="range"
              min="0"
              max="1"
              step="0.05"
              value={soundVolume}
              disabled={!soundEnabled}
              onChange={(e) => handleVolumeChange(parseFloat(e.target.value))}
              className="w-full accent-cyan-500 bg-slate-950 h-1.5 rounded-lg cursor-pointer disabled:opacity-30"
            />
          </div>

          {/* Difficulty */}
          <div>
            <label className="text-xs font-semibold text-slate-300 block mb-2">ระดับความโหด (Difficulty):</label>
            <div className="grid grid-cols-3 gap-1.5">
              {(['easy', 'normal', 'hard'] as const).map((diff) => (
                <button
                  key={diff}
                  onClick={() => { playSound('click'); setDifficulty(diff); }}
                  className={`py-1.5 text-xs font-semibold rounded-lg capitalize border transition cursor-pointer ${
                    difficulty === diff
                      ? diff === 'easy'
                        ? 'bg-emerald-950/40 border-emerald-500 text-emerald-400'
                        : diff === 'normal'
                        ? 'bg-cyan-950/40 border-cyan-500 text-cyan-400'
                        : 'bg-rose-950/40 border-rose-500 text-rose-400'
                      : 'bg-slate-950 border-slate-800 text-slate-500 hover:text-slate-300'
                  }`}
                >
                  {diff === 'easy' ? 'ง่าย' : diff === 'normal' ? 'ปกติ' : 'ยาก'}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Action Button */}
        <div className="flex gap-3">
          <button
            onClick={onBackToMenu}
            onMouseEnter={handleHover}
            className="flex-1 py-3 bg-slate-950 hover:bg-slate-800 text-slate-300 border border-slate-800 hover:border-slate-700 rounded-xl transition font-medium text-xs cursor-pointer"
          >
            ยกเลิก (Cancel)
          </button>
          <button
            onClick={handleSave}
            onMouseEnter={handleHover}
            className="flex-1 py-3 bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-400 hover:to-blue-500 text-white rounded-xl shadow-lg shadow-cyan-950/40 font-bold text-xs flex items-center justify-center gap-2 transition cursor-pointer"
          >
            <CheckCircle className="w-4 h-4" />
            <span>บันทึกค่า (Save)</span>
          </button>
        </div>
      </motion.div>
    </div>
  );
}
