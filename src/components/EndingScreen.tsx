import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { GameSettings } from '../types';
import { playSound } from './AudioEngine';
import { Trophy, Home, MessageSquare, Shield, Award, Sparkles, ChevronRight } from 'lucide-react';

interface EndingScreenProps {
  score: number;
  level: number;
  settings: GameSettings;
  onQuit: () => void;
}

interface DialogLine {
  speaker: 'player' | 'npc';
  name: string;
  text: string;
}

export default function EndingScreen({ score, level, settings, onQuit }: EndingScreenProps) {
  const [currentLineIdx, setCurrentLineIdx] = useState(-1);
  const [npcWalking, setNpcWalking] = useState(true);
  const [npcPosX, setNpcPosX] = useState(90); // start at right side (percentage)
  const [typedText, setTypedText] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const [showVictory, setShowVictory] = useState(false);

  // Animation frame indices
  const [playerFrame, setPlayerFrame] = useState(0);
  const [npcFrame, setNpcFrame] = useState(0);

  const dialogue: DialogLine[] = [
    {
      speaker: 'npc',
      name: 'ผู้ดูแลมิติ (NPC)',
      text: 'เฮ้อ... ในที่สุดประตุมิติก็นิ่งแล้ว! ขอบคุณสวรรค์ที่คุณมาช่วยปกป้องพวกเราไว้ได้ทันเวลา!'
    },
    {
      speaker: 'player',
      name: 'ผู้กล้า (Player)',
      text: 'เป็นหน้าที่ของผมอยู่แล้วครับ! แล้วเจ้าหัวหน้าราชาปีศาจสีแดงยักษ์นั่นมันมาจากไหนกันแน่?'
    },
    {
      speaker: 'npc',
      name: 'ผู้ดูแลมิติ (NPC)',
      text: 'มันคือราชาปีศาจแห่งความมืดที่แฝงตัวรอกลืนกินพลังงานมิตินี้มาแสนนาน แต่ฝีมือการต่อสู้ของคุณนี่มันยอดเยี่ยมเหนือคำบรรยายจริงๆ!'
    },
    {
      speaker: 'player',
      name: 'ผู้กล้า (Player)',
      text: 'ฮ่าๆ ผมต้องประเคนทั้งหมัดสายฟ้าและระเบิดพลังคลื่นวงแหวนเวทย์อัดร่างมันจนยอมจำนนเลยล่ะ'
    },
    {
      speaker: 'npc',
      name: 'ผู้ดูแลมิติ (NPC)',
      text: 'แถมตอนที่มันบินขึ้นฟ้ากระพริบตัวย่อขยายเพื่อร่ายเวทย์พายุกระสุนลูกไฟตกลงมา... ฉันนึกว่ามิตินี้จะพังทลายไปเสียแล้ว!'
    },
    {
      speaker: 'player',
      name: 'ผู้กล้า (Player)',
      text: 'จังหวะหลบตอนนั้นก็ระทึกสุดๆ เหมือนกันครับ โชคดีที่ผมคอยอ่านจังหวะย่อขยายบอกล่วงหน้า แล้วหลบวงกลมแดงแจ้งเตือนได้ทัน'
    },
    {
      speaker: 'npc',
      name: 'ผู้ดูแลมิติ (NPC)',
      text: 'สมกับเป็นผู้กล้าในตำนานอาร์เคดที่ยอดเยี่ยมที่สุด! ทุกคนในอาณาจักรต่างแซ่ซ้องชื่นชมในความกล้าหาญของคุณ!'
    },
    {
      speaker: 'player',
      name: 'ผู้กล้า (Player)',
      text: 'ยินดีที่ได้ช่วยเหลือครับ มิตินี้กลับมาสงบสุขแล้ว ผมพร้อมที่จะก้าวเข้าสู่การผจญภัยครั้งต่อไปแล้วล่ะ!'
    }
  ];

  // Spritesheet walk/idle cycle animations
  useEffect(() => {
    const timer = setInterval(() => {
      setPlayerFrame((f) => (f + 1) % 4);
      setNpcFrame((f) => (f + 1) % 4);
    }, 150);
    return () => clearInterval(timer);
  }, []);

  // NPC walking in sequence on start
  useEffect(() => {
    if (!npcWalking) return;

    const interval = setInterval(() => {
      setNpcPosX((prev) => {
        if (prev <= 60) {
          // Reached dialogue position
          setNpcWalking(false);
          setCurrentLineIdx(0); // Start dialogue
          playSound('levelup');
          return 60;
        }
        return prev - 1.5;
      });
    }, 30);

    return () => clearInterval(interval);
  }, [npcWalking]);

  // Typewriter effect for current dialogue line
  useEffect(() => {
    if (currentLineIdx < 0 || currentLineIdx >= dialogue.length) {
      setTypedText('');
      return;
    }

    const fullText = dialogue[currentLineIdx].text;
    setTypedText('');
    setIsTyping(true);
    let charIdx = 0;

    const interval = setInterval(() => {
      setTypedText((prev) => prev + fullText.charAt(charIdx));
      charIdx++;
      
      // Play soft typing beep sound
      if (charIdx % 3 === 0) {
        playSound('click');
      }

      if (charIdx >= fullText.length) {
        clearInterval(interval);
        setIsTyping(false);
      }
    }, 35);

    return () => clearInterval(interval);
  }, [currentLineIdx]);

  const handleNext = () => {
    if (npcWalking) return;

    if (isTyping) {
      // Complete text immediately
      const fullText = dialogue[currentLineIdx].text;
      setTypedText(fullText);
      setIsTyping(false);
      playSound('click');
      return;
    }

    playSound('select');
    if (currentLineIdx < dialogue.length - 1) {
      setCurrentLineIdx((prev) => prev + 1);
    } else {
      // Dialog finished! Show victory summary screen
      setShowVictory(true);
      playSound('levelup');
    }
  };

  // Keyboard controls to advance dialogue
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === ' ' || e.key === 'Enter') {
        e.preventDefault();
        handleNext();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [currentLineIdx, isTyping, npcWalking]);

  // Player and NPC spritesheets: use npc1_pdraha.png (2 rows: Row 1 stand (50%), Row 2 walk (0%))
  const playerYOffset = 50; // Row 1 (standing)
  const npcYOffset = npcWalking ? 0 : 50; // Row 2 for walk, Row 1 for stand/idle

  return (
    <div className="relative w-full h-full min-h-screen flex flex-col items-center justify-center bg-slate-950 text-white font-sans overflow-hidden p-4 select-none">
      {/* Visual background sky / dimensional vortex */}
      <div className="absolute inset-0 bg-gradient-to-b from-indigo-950/20 via-slate-950 to-slate-950 pointer-events-none" />
      
      {/* Diagonal scanlines */}
      <div className="absolute inset-0 bg-[linear-gradient(rgba(18,24,38,0)_95%,rgba(0,0,0,0.35)_95%)] bg-[length:100%_4px] pointer-events-none opacity-40" />

      {!showVictory ? (
        <div className="w-full max-w-4xl h-[420px] relative border border-slate-800 bg-slate-900/60 rounded-3xl backdrop-blur-md overflow-hidden flex flex-col justify-between shadow-2xl">
          {/* Top header strip */}
          <div className="bg-slate-900/90 border-b border-slate-800/80 px-6 py-3 flex items-center justify-between text-xs text-slate-400 font-mono tracking-wide z-10">
            <span className="flex items-center gap-2">
              <MessageSquare className="w-4 h-4 text-cyan-400 animate-pulse" />
              RPG CUTSCENE: ENDING DIALOGUE
            </span>
            <span>STAGE COMPLETE</span>
          </div>

          {/* Core Scene Stage */}
          <div className="flex-1 w-full relative bg-[radial-gradient(ellipse_at_bottom,_var(--tw-gradient-stops))] from-indigo-950/30 via-slate-900/20 to-transparent">
            {/* Ground line */}
            <div className="absolute bottom-12 left-0 right-0 h-1 bg-gradient-to-r from-transparent via-cyan-500/20 to-transparent" />

            {/* Left Actor: Player */}
            <div 
              className="absolute bottom-14 left-[15%] flex flex-col items-center"
              style={{ transform: 'translateX(-50%)' }}
            >
              <div 
                className="w-14 h-24 bg-no-repeat transition-transform duration-200"
                style={{
                  backgroundImage: `url('https://res.cloudinary.com/dsucg33fv/image/upload/v1782439980/npc1_pdraha.png')`,
                  backgroundSize: '400% 200%',
                  backgroundPosition: `${playerFrame * 25}% ${playerYOffset}%`,
                  imageRendering: 'pixelated',
                  filter: 'hue-rotate(130deg)', // Heroic blue/purple adventurer outfit
                }}
              />
              <span className="mt-2 text-xs font-mono font-bold text-cyan-400 bg-cyan-950/80 border border-cyan-800/60 px-2 py-0.5 rounded-md shadow-md uppercase tracking-wider">
                PLAYER
              </span>
            </div>

            {/* Right Actor: NPC */}
            <div 
              className="absolute bottom-14 flex flex-col items-center transition-all duration-300"
              style={{ 
                left: `${npcPosX}%`, 
                transform: 'translateX(-50%)' 
              }}
            >
              <div 
                className="w-14 h-24 bg-no-repeat transform -scale-x-100" // face left towards player
                style={{
                  backgroundImage: `url('https://res.cloudinary.com/dsucg33fv/image/upload/v1782439980/npc1_pdraha.png')`,
                  backgroundSize: '400% 200%',
                  backgroundPosition: `${npcFrame * 25}% ${npcYOffset}%`,
                  imageRendering: 'pixelated',
                }}
              />
              <span className="mt-2 text-xs font-mono font-bold text-emerald-400 bg-emerald-950/80 border border-emerald-800/60 px-2 py-0.5 rounded-md shadow-md uppercase tracking-wider">
                DIMENSION GUIDE
              </span>
            </div>

            {/* Introductory instructions when NPC is walking */}
            {npcWalking && (
              <div className="absolute top-1/3 left-1/2 -translate-x-1/2 -translate-y-1/2 text-center">
                <span className="text-sm font-mono text-cyan-400/80 animate-pulse tracking-widest uppercase">
                  .. ชัยชนะ! ผู้ดูแลมิติกำลังเดินเข้ามาหาคุณ ..
                </span>
              </div>
            )}
          </div>

          {/* RPG Dialogue Box at Bottom */}
          <div 
            onClick={handleNext}
            className="bg-slate-950/95 border-t border-slate-800/80 p-5 md:p-6 flex flex-col cursor-pointer hover:bg-slate-900/70 transition-colors duration-200 z-10"
          >
            {currentLineIdx >= 0 && (
              <>
                <div className="flex items-center justify-between mb-2">
                  <span className={`font-mono text-sm font-black uppercase tracking-widest ${
                    dialogue[currentLineIdx].speaker === 'player' ? 'text-cyan-400' : 'text-emerald-400'
                  }`}>
                    {dialogue[currentLineIdx].name}
                  </span>
                  <span className="text-[10px] text-slate-500 font-mono tracking-wider">
                    CLICK หรือ SPACE เพื่อข้าม
                  </span>
                </div>
                <div className="min-h-[56px] text-sm md:text-base text-slate-200 leading-relaxed font-sans">
                  {typedText}
                  {isTyping && <span className="inline-block w-1.5 h-4 bg-cyan-400 ml-1 animate-ping" />}
                </div>
                <div className="flex justify-end mt-1">
                  <ChevronRight className="w-5 h-5 text-slate-500 animate-bounce" />
                </div>
              </>
            )}
          </div>
        </div>
      ) : (
        /* Final Ending Victory screen block */
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ type: 'spring', duration: 0.8 }}
          className="w-full max-w-lg bg-slate-900/90 border border-slate-800 rounded-3xl p-8 backdrop-blur-md shadow-2xl z-10 text-center relative"
        >
          {/* Confetti or Gold sparkle particle effects */}
          <div className="absolute inset-0 pointer-events-none overflow-hidden rounded-3xl">
            <div className="absolute w-2 h-2 bg-yellow-400 rounded-full top-10 left-1/4 animate-ping" />
            <div className="absolute w-2 h-2 bg-cyan-400 rounded-full top-20 right-1/3 animate-ping duration-1000" />
            <div className="absolute w-3 h-3 bg-pink-500 rounded-full bottom-20 left-1/3 animate-pulse" />
          </div>

          {/* Victory Label badge */}
          <div className="mx-auto w-16 h-16 rounded-2xl bg-amber-500/10 border border-amber-500/30 flex items-center justify-center mb-6 shadow-lg shadow-amber-500/5">
            <Trophy className="w-9 h-9 text-amber-400" />
          </div>

          <h1 className="text-amber-400 font-black text-5xl tracking-widest uppercase mb-1 filter drop-shadow-[0_4px_12px_rgba(245,158,11,0.3)]">
            FINISH
            <span className="block text-xs font-semibold text-slate-400 font-mono tracking-widest mt-2 uppercase">
              VICTORY ENDING COMPLETE
            </span>
          </h1>

          <p className="text-slate-300 font-sans text-sm md:text-base leading-relaxed mt-4 max-w-md mx-auto">
            คุณสามารถโค่นล้มราชาปีศาจสีแดงลงได้สำเร็จและกอบกู้ความสงบสุขกลับคืนมาสู่ห้วงมิติอาร์เคด! คุณคือฮีโร่ตัวจริงที่ทุกคนต้องจดจำ!
          </p>

          {/* Scores summary box */}
          <div className="grid grid-cols-2 gap-4 bg-slate-950/80 border border-slate-800/80 rounded-2xl p-4 my-6 font-mono text-left">
            <div>
              <span className="block text-[10px] text-slate-500 uppercase tracking-wider">คะแนนรวมสูงสุด</span>
              <span className="text-xl font-bold text-cyan-400">{score.toLocaleString()} PTS</span>
            </div>
            <div>
              <span className="block text-[10px] text-slate-500 uppercase tracking-wider">เลเวลที่ทำได้</span>
              <span className="text-xl font-bold text-amber-400">LV.{level}</span>
            </div>
          </div>

          {/* Return button */}
          <button
            id="return-title-btn"
            onClick={onQuit}
            className="w-full py-4 px-6 bg-gradient-to-r from-cyan-500 to-indigo-500 text-white font-bold rounded-2xl shadow-xl hover:shadow-cyan-500/15 hover:from-cyan-400 hover:to-indigo-400 active:scale-[0.98] transition-all flex items-center justify-center gap-3 text-base uppercase tracking-wider"
          >
            <Home className="w-5 h-5" />
            กลับหน้าแรก (Back to Title)
          </button>
        </motion.div>
      )}
    </div>
  );
}
