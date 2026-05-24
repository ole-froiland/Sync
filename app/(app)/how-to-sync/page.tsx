'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  Lightbulb,
  FolderKanban,
  Code2,
  Users,
  Sparkles,
  ChevronLeft,
  ChevronRight,
} from 'lucide-react'
import TopBar from '@/components/layout/TopBar'
import SyncWithOthersModal from '@/components/how-to-sync/SyncWithOthersModal'
import Button from '@/components/ui/Button'
import { useUser } from '@/context/UserContext'

const SLIDES = [
  {
    id: 'build',
    icon: Lightbulb,
    title: 'Want to build something?',
    description: 'Sync gives you one place for your projects, code, and people.',
    gradient: 'from-violet-500/25 via-fuchsia-500/10 to-transparent',
    color: '#a855f7',
    bg: 'from-violet-50 via-white to-transparent dark:from-violet-950/30 dark:via-gray-950 dark:to-transparent',
  },
  {
    id: 'create',
    icon: FolderKanban,
    title: 'Create a project',
    description: 'Give it a name, connect a repo, and keep everything organized.',
    gradient: 'from-blue-500/25 via-cyan-500/10 to-transparent',
    color: '#3b82f6',
    bg: 'from-blue-50 via-white to-transparent dark:from-blue-950/30 dark:via-gray-950 dark:to-transparent',
  },
  {
    id: 'code',
    icon: Code2,
    title: 'Open it where you build',
    description: 'Use GitHub, VS Code, Cursor, Codex, or your favorite AI coding tool.',
    gradient: 'from-emerald-500/25 via-teal-500/10 to-transparent',
    color: '#10b981',
    bg: 'from-emerald-50 via-white to-transparent dark:from-emerald-950/30 dark:via-gray-950 dark:to-transparent',
  },
  {
    id: 'sync',
    icon: Users,
    title: 'Sync with your team',
    description: 'Invite friends, share projects, and work together in one place.',
    gradient: 'from-amber-500/25 via-orange-500/10 to-transparent',
    color: '#f59e0b',
    bg: 'from-amber-50 via-white to-transparent dark:from-amber-950/30 dark:via-gray-950 dark:to-transparent',
  },
]

const VARIANTS = {
  enter: (dir: number) => ({
    x: dir > 0 ? 300 : -300,
    opacity: 0,
    scale: 0.92,
  }),
  center: {
    x: 0,
    opacity: 1,
    scale: 1,
  },
  exit: (dir: number) => ({
    x: dir < 0 ? 300 : -300,
    opacity: 0,
    scale: 0.92,
  }),
}

function Dot({ active, onClick }: { active: boolean; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={`Go to slide`}
      className="relative flex h-6 w-6 items-center justify-center"
    >
      <motion.span
        className="block rounded-full"
        animate={
          active
            ? {
                width: 20,
                height: 8,
                borderRadius: 4,
                backgroundColor: '#a855f7',
              }
            : {
                width: 6,
                height: 6,
                borderRadius: 3,
                backgroundColor: '#d4d4d8',
              }
        }
        transition={{ type: 'spring', stiffness: 300, damping: 25 }}
      />
      {active && (
        <motion.span
          className="pointer-events-none absolute inset-0 rounded-full bg-purple-400/25"
          initial={false}
          animate={{ scale: [1, 1.6, 1], opacity: [0.4, 0, 0.4] }}
          transition={{ duration: 2, repeat: Infinity, ease: 'easeInOut' }}
        />
      )}
    </button>
  )
}

function CtaSection({ onInvite }: { onInvite: () => void }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.6, ease: [0.16, 1, 0.3, 1], delay: 0.3 }}
      className="mx-auto mt-6 flex w-full max-w-md items-center justify-between gap-4 rounded-2xl border border-gray-200/70 bg-white/70 p-5 shadow-lg shadow-gray-200/40 backdrop-blur-sm dark:border-gray-800/60 dark:bg-gray-900/70 dark:shadow-black/20"
    >
      <div className="min-w-0">
        <h3 className="text-sm font-semibold text-gray-900 dark:text-gray-100">
          Ready to sync?
        </h3>
        <p className="mt-0.5 text-sm text-gray-500 dark:text-gray-400">
          Invite your team and start building together.
        </p>
      </div>
      <Button onClick={onInvite} className="shrink-0">
        <Users size={15} />
        Invite
      </Button>
    </motion.div>
  )
}

function SceneBuild({ color }: { color: string }) {
  return (
    <div className="relative flex h-full w-full items-center justify-center">
      <svg
        viewBox="0 0 280 240"
        className="h-56 w-56 sm:h-64 sm:w-64"
        fill="none"
      >
        <motion.circle
          cx="140"
          cy="120"
          r="90"
          fill={color}
          fillOpacity={0.08}
          initial={{ scale: 0, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ duration: 1, ease: [0.16, 1, 0.3, 1] }}
        />
        <motion.g
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3, duration: 0.7, ease: [0.16, 1, 0.3, 1] }}
        >
          <circle cx="140" cy="55" r="14" stroke={color} strokeWidth="2.5" fill="white" className="dark:fill-gray-900" />
          <circle cx="136" cy="52" r="2" fill={color} />
          <circle cx="144" cy="52" r="2" fill={color} />
          <path d="M136 62 Q140 66 144 62" stroke={color} strokeWidth="1.5" fill="none" />
          <line x1="140" y1="69" x2="140" y2="115" stroke={color} strokeWidth="2.5" />
          <line x1="140" y1="82" x2="118" y2="100" stroke={color} strokeWidth="2.5" />
          <line x1="140" y1="82" x2="162" y2="100" stroke={color} strokeWidth="2.5" />
          <line x1="140" y1="115" x2="126" y2="148" stroke={color} strokeWidth="2.5" />
          <line x1="140" y1="115" x2="154" y2="148" stroke={color} strokeWidth="2.5" />
        </motion.g>
        <motion.g
          initial={{ opacity: 0, scale: 0 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ delay: 0.6, duration: 0.5, ease: [0.34, 1.56, 0.64, 1] }}
          style={{ transformOrigin: '210px 50px' }}
        >
          <circle cx="210" cy="50" r="16" fill={color} fillOpacity={0.15} />
          <path
            d="M206 44 L210 36 L214 44"
            stroke={color}
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            fill="none"
          />
          <path
            d="M210 36 L210 54"
            stroke={color}
            strokeWidth="2"
            strokeLinecap="round"
          />
          <path
            d="M202 58 Q210 52 218 58"
            stroke={color}
            strokeWidth="1.5"
            strokeLinecap="round"
            fill="none"
            opacity={0.6}
          />
          <line x1="202" y1="48" x2="206" y2="48" stroke={color} strokeWidth="1.5" strokeLinecap="round" />
          <line x1="214" y1="48" x2="218" y2="48" stroke={color} strokeWidth="1.5" strokeLinecap="round" />
        </motion.g>
        <motion.g
          initial={{ opacity: 0, scale: 0 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ delay: 0.8, duration: 0.5, ease: [0.34, 1.56, 0.64, 1] }}
          style={{ transformOrigin: '70px 45px' }}
        >
          <circle cx="70" cy="45" r="14" fill={color} fillOpacity={0.12} />
          <path
            d="M66 39 L70 32 L74 39"
            stroke={color}
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            fill="none"
          />
          <path d="M70 32 L70 48" stroke={color} strokeWidth="2" strokeLinecap="round" />
          <circle cx="70" cy="54" r="2.5" fill={color} />
        </motion.g>
        <motion.g
          initial={{ opacity: 0 }}
          animate={{ opacity: [0, 1, 1, 0] }}
          transition={{ delay: 1.5, duration: 2.5, repeat: Infinity, ease: 'easeInOut' }}
        >
          <circle cx="140" cy="120" r="3" fill={color} />
          <circle cx="148" cy="112" r="2" fill={color} opacity={0.6} />
          <circle cx="132" cy="128" r="2" fill={color} opacity={0.6} />
        </motion.g>
      </svg>
    </div>
  )
}

function SceneCreate({ color }: { color: string }) {
  return (
    <div className="relative flex h-full w-full items-center justify-center">
      <svg
        viewBox="0 0 280 240"
        className="h-56 w-56 sm:h-64 sm:w-64"
        fill="none"
      >
        <motion.circle
          cx="140"
          cy="120"
          r="90"
          fill={color}
          fillOpacity={0.08}
          initial={{ scale: 0, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ duration: 1, ease: [0.16, 1, 0.3, 1] }}
        />
        <motion.g
          initial={{ opacity: 0, x: -30 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ delay: 0.2, duration: 0.7, ease: [0.16, 1, 0.3, 1] }}
        >
          <rect
            x="95"
            y="70"
            width="90"
            height="100"
            rx="6"
            stroke={color}
            strokeWidth="2.5"
            fill="white"
            className="dark:fill-gray-900"
          />
          <rect
            x="95"
            y="70"
            width="90"
            height="20"
            rx="6"
            fill={color}
            fillOpacity={0.15}
          />
          <circle cx="102" cy="80" r="2.5" fill={color} />
          <line x1="110" y1="80" x2="140" y2="80" stroke={color} strokeWidth="1.5" strokeLinecap="round" opacity={0.5} />
          <line x1="110" y1="105" x2="170" y2="105" stroke={color} strokeWidth="2" strokeLinecap="round" />
          <line x1="110" y1="120" x2="160" y2="120" stroke={color} strokeWidth="2" strokeLinecap="round" />
          <line x1="110" y1="135" x2="155" y2="135" stroke={color} strokeWidth="2" strokeLinecap="round" />
          <line x1="110" y1="150" x2="165" y2="150" stroke={color} strokeWidth="2" strokeLinecap="round" />
        </motion.g>
        <motion.g
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.7, duration: 0.6, ease: [0.16, 1, 0.3, 1] }}
        >
          <motion.rect
            x="160"
            y="60"
            width="28"
            height="10"
            rx="3"
            fill={color}
            fillOpacity={0.2}
            animate={{ y: [0, -4, 0] }}
            transition={{ delay: 0.9, duration: 2, repeat: Infinity }}
          />
          <motion.rect
            x="165"
            y="48"
            width="10"
            height="16"
            rx="2"
            fill={color}
            fillOpacity={0.15}
            animate={{ y: [0, -3, 0] }}
            transition={{ delay: 0.6, duration: 2, repeat: Infinity }}
          />
        </motion.g>
        <motion.g
          initial={{ opacity: 0, scale: 0 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ delay: 0.6, duration: 0.4, ease: [0.34, 1.56, 0.64, 1] }}
        >
          <circle cx="73" cy="130" r="12" stroke={color} strokeWidth="2" fill="white" className="dark:fill-gray-900" />
          <circle cx="70" cy="127" r="1.5" fill={color} />
          <circle cx="76" cy="127" r="1.5" fill={color} />
          <path d="M70 134 Q73 137 76 134" stroke={color} strokeWidth="1.2" fill="none" />
          <line x1="73" y1="142" x2="73" y2="170" stroke={color} strokeWidth="2" />
          <line x1="73" y1="150" x2="58" y2="165" stroke={color} strokeWidth="2" />
          <line x1="73" y1="150" x2="88" y2="165" stroke={color} strokeWidth="2" />
          <line x1="73" y1="170" x2="63" y2="195" stroke={color} strokeWidth="2" />
          <line x1="73" y1="170" x2="83" y2="195" stroke={color} strokeWidth="2" />
        </motion.g>
      </svg>
    </div>
  )
}

function SceneCode({ color }: { color: string }) {
  return (
    <div className="relative flex h-full w-full items-center justify-center">
      <svg
        viewBox="0 0 280 240"
        className="h-56 w-56 sm:h-64 sm:w-64"
        fill="none"
      >
        <motion.circle
          cx="140"
          cy="120"
          r="90"
          fill={color}
          fillOpacity={0.08}
          initial={{ scale: 0, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ duration: 1, ease: [0.16, 1, 0.3, 1] }}
        />
        <motion.g
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2, duration: 0.7, ease: [0.16, 1, 0.3, 1] }}
        >
          <rect
            x="80"
            y="55"
            width="120"
            height="85"
            rx="8"
            stroke={color}
            strokeWidth="2.5"
            fill="white"
            className="dark:fill-gray-900"
          />
          <rect x="80" y="55" width="120" height="16" rx="8" fill={color} fillOpacity={0.12} />
          <circle cx="90" cy="63" r="2.5" fill={color} />
          <circle cx="98" cy="63" r="2.5" fill={color} opacity={0.5} />
          <circle cx="106" cy="63" r="2.5" fill={color} opacity={0.3} />
        </motion.g>
        <motion.g
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.6, duration: 0.4 }}
        >
          <motion.line
            x1="95"
            y1="90"
            x2="130"
            y2="90"
            stroke={color}
            strokeWidth="2.5"
            strokeLinecap="round"
            initial={{ pathLength: 0 }}
            animate={{ pathLength: 1 }}
            transition={{ delay: 0.8, duration: 0.5, ease: 'easeOut' }}
          />
          <motion.line
            x1="95"
            y1="102"
            x2="150"
            y2="102"
            stroke={color}
            strokeWidth="2.5"
            strokeLinecap="round"
            initial={{ pathLength: 0 }}
            animate={{ pathLength: 1 }}
            transition={{ delay: 1, duration: 0.5, ease: 'easeOut' }}
          />
          <motion.line
            x1="95"
            y1="114"
            x2="140"
            y2="114"
            stroke={color}
            strokeWidth="2.5"
            strokeLinecap="round"
            initial={{ pathLength: 0 }}
            animate={{ pathLength: 1 }}
            transition={{ delay: 1.2, duration: 0.5, ease: 'easeOut' }}
          />
          <motion.line
            x1="95"
            y1="126"
            x2="115"
            y2="126"
            stroke={color}
            strokeWidth="2.5"
            strokeLinecap="round"
            initial={{ pathLength: 0 }}
            animate={{ pathLength: 1 }}
            transition={{ delay: 1.4, duration: 0.5, ease: 'easeOut' }}
          />
        </motion.g>
        <motion.g
          initial={{ opacity: 0, scale: 0 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ delay: 0.5, duration: 0.5, ease: [0.34, 1.56, 0.64, 1] }}
          style={{ transformOrigin: '200px 115px' }}
        >
          <circle cx="200" cy="115" r="14" stroke={color} strokeWidth="2" fill="white" className="dark:fill-gray-900" />
          <path
            d="M196 120 L202 112"
            stroke={color}
            strokeWidth="2"
            strokeLinecap="round"
          />
          <path
            d="M200 120 Q204 116 206 118"
            stroke={color}
            strokeWidth="1.5"
            strokeLinecap="round"
            fill="none"
          />
        </motion.g>
        <motion.g
          initial={{ opacity: 0, scale: 0 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ delay: 0.8, duration: 0.4, ease: [0.34, 1.56, 0.64, 1] }}
          style={{ transformOrigin: '88px 160px' }}
        >
          <rect
            x="75"
            y="155"
            width="26"
            height="16"
            rx="3"
            stroke={color}
            strokeWidth="1.5"
            fill={color}
            fillOpacity={0.08}
          />
          <text x="79" y="167" fontSize="9" fill={color} fontWeight="600">
            {'</>'}
          </text>
        </motion.g>
      </svg>
    </div>
  )
}

function SceneSync({ color }: { color: string }) {
  return (
    <div className="relative flex h-full w-full items-center justify-center">
      <svg
        viewBox="0 0 280 240"
        className="h-56 w-56 sm:h-64 sm:w-64"
        fill="none"
      >
        <motion.circle
          cx="140"
          cy="120"
          r="90"
          fill={color}
          fillOpacity={0.08}
          initial={{ scale: 0, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ duration: 1, ease: [0.16, 1, 0.3, 1] }}
        />
        <motion.g
          initial={{ opacity: 0, x: -30 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ delay: 0.2, duration: 0.6, ease: [0.16, 1, 0.3, 1] }}
        >
          <circle cx="95" cy="105" r="16" stroke={color} strokeWidth="2.5" fill="white" className="dark:fill-gray-900" />
          <circle cx="91" cy="101" r="2" fill={color} />
          <circle cx="99" cy="101" r="2" fill={color} />
          <path d="M91 111 Q95 115 99 111" stroke={color} strokeWidth="1.5" fill="none" />
          <line x1="95" y1="121" x2="95" y2="155" stroke={color} strokeWidth="2.5" />
          <line x1="95" y1="130" x2="76" y2="148" stroke={color} strokeWidth="2.5" />
          <line x1="95" y1="130" x2="114" y2="148" stroke={color} strokeWidth="2.5" />
          <line x1="95" y1="155" x2="82" y2="185" stroke={color} strokeWidth="2.5" />
          <line x1="95" y1="155" x2="108" y2="185" stroke={color} strokeWidth="2.5" />
        </motion.g>
        <motion.g
          initial={{ opacity: 0, x: 30 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ delay: 0.4, duration: 0.6, ease: [0.16, 1, 0.3, 1] }}
        >
          <circle cx="185" cy="105" r="16" stroke={color} strokeWidth="2.5" fill="white" className="dark:fill-gray-900" />
          <circle cx="181" cy="101" r="2" fill={color} />
          <circle cx="189" cy="101" r="2" fill={color} />
          <path d="M181 111 Q185 115 189 111" stroke={color} strokeWidth="1.5" fill="none" />
          <line x1="185" y1="121" x2="185" y2="155" stroke={color} strokeWidth="2.5" />
          <line x1="185" y1="130" x2="166" y2="148" stroke={color} strokeWidth="2.5" />
          <line x1="185" y1="130" x2="204" y2="148" stroke={color} strokeWidth="2.5" />
          <line x1="185" y1="155" x2="172" y2="185" stroke={color} strokeWidth="2.5" />
          <line x1="185" y1="155" x2="198" y2="185" stroke={color} strokeWidth="2.5" />
        </motion.g>
        <motion.g
          initial={{ scale: 0, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ delay: 0.8, duration: 0.6, ease: [0.34, 1.56, 0.64, 1], type: 'spring', stiffness: 200, damping: 15 }}
          style={{ transformOrigin: '140px 130px' }}
        >
          <rect
            x="124"
            y="118"
            width="32"
            height="24"
            rx="6"
            fill={color}
            fillOpacity={0.15}
            stroke={color}
            strokeWidth="1.5"
          />
          <line x1="134" y1="130" x2="146" y2="130" stroke={color} strokeWidth="2" strokeLinecap="round" />
          <line x1="140" y1="124" x2="140" y2="136" stroke={color} strokeWidth="2" strokeLinecap="round" />
        </motion.g>
        <motion.g
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 1.2, duration: 0.5 }}
        >
          <motion.circle
            cx="140"
            cy="200"
            r="3"
            fill={color}
            animate={{ opacity: [0.3, 1, 0.3] }}
            transition={{ duration: 2, repeat: Infinity }}
          />
          <motion.circle
            cx="130"
            cy="195"
            r="2"
            fill={color}
            animate={{ opacity: [0.2, 0.8, 0.2] }}
            transition={{ duration: 2, delay: 0.4, repeat: Infinity }}
          />
          <motion.circle
            cx="150"
            cy="195"
            r="2"
            fill={color}
            animate={{ opacity: [0.2, 0.8, 0.2] }}
            transition={{ duration: 2, delay: 0.8, repeat: Infinity }}
          />
        </motion.g>
      </svg>
    </div>
  )
}

function SlideScene({ id, color }: { id: string; color: string }) {
  switch (id) {
    case 'build':
      return <SceneBuild color={color} />
    case 'create':
      return <SceneCreate color={color} />
    case 'code':
      return <SceneCode color={color} />
    case 'sync':
      return <SceneSync color={color} />
    default:
      return null
  }
}

export default function HowToSyncPage() {
  const profile = useUser()
  const [[slideIndex, direction], setSlideState] = useState([0, 1])
  const [modalOpen, setModalOpen] = useState(false)
  const [isPaused, setIsPaused] = useState(false)
  const intervalRef = useRef<ReturnType<typeof setInterval>>(undefined)

  const slide = SLIDES[slideIndex]

  const goTo = useCallback((index: number) => {
    setSlideState(([prev]) => [index, index > prev ? 1 : -1])
  }, [])

  const next = useCallback(() => {
    setSlideState(([prev]) => [(prev + 1) % SLIDES.length, 1])
  }, [])

  const prev = useCallback(() => {
    setSlideState(([prev]) => [(prev - 1 + SLIDES.length) % SLIDES.length, -1])
  }, [])

  useEffect(() => {
    if (isPaused) return
    intervalRef.current = setInterval(next, 5000)
    return () => clearInterval(intervalRef.current)
  }, [isPaused, next])

  return (
    <>
      <TopBar title="How to Sync" />
      <div
        className="flex-1 overflow-hidden"
        onMouseEnter={() => setIsPaused(true)}
        onMouseLeave={() => setIsPaused(false)}
      >
        <div className="relative flex h-full flex-col bg-gradient-to-b from-gray-50 via-white to-gray-50 dark:from-gray-950 dark:via-gray-950 dark:to-gray-950">
          <div className={`absolute inset-0 bg-gradient-to-b ${slide.bg} transition-colors duration-700`} />

          <div className="relative z-10 mx-auto flex w-full max-w-lg flex-1 flex-col items-center justify-center px-6 py-8">
            <motion.div
              key={slide.id + '-badge'}
              initial={{ opacity: 0, y: -8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5, ease: 'easeOut' }}
              className="inline-flex items-center gap-1.5 rounded-full border border-gray-200 bg-white/80 px-3.5 py-1 text-xs font-medium text-purple-600 backdrop-blur dark:border-gray-800 dark:bg-gray-900/80 dark:text-purple-400"
            >
              <Sparkles size={12} />
              Getting started
            </motion.div>

            <div className="relative mt-4 flex h-64 w-full items-center justify-center sm:h-72">
              <AnimatePresence mode="popLayout" custom={direction}>
                <motion.div
                  key={slide.id + '-scene'}
                  custom={direction}
                  variants={VARIANTS}
                  initial="enter"
                  animate="center"
                  exit="exit"
                  transition={{ duration: 0.45, ease: [0.16, 1, 0.3, 1] }}
                  className="absolute inset-0 flex items-center justify-center"
                >
                  <SlideScene id={slide.id} color={slide.color} />
                </motion.div>
              </AnimatePresence>
            </div>

            <div className="mt-2 h-28 sm:h-32">
              <AnimatePresence mode="wait">
                <motion.div
                  key={slide.id + '-text'}
                  initial={{ opacity: 0, y: 16 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -16 }}
                  transition={{ duration: 0.4, ease: [0.16, 1, 0.3, 1] }}
                  className="text-center"
                >
                  <h2 className="text-xl font-bold tracking-tight text-gray-900 dark:text-gray-100 sm:text-2xl">
                    {slide.title}
                  </h2>
                  <p className="mt-2 text-sm leading-relaxed text-gray-500 dark:text-gray-400 sm:text-base">
                    {slide.description}
                  </p>
                </motion.div>
              </AnimatePresence>
            </div>

            <div className="mt-4 flex items-center gap-2">
              <button
                type="button"
                onClick={prev}
                className="flex h-8 w-8 items-center justify-center rounded-full text-gray-400 transition-colors hover:bg-gray-100 hover:text-gray-600 dark:hover:bg-gray-800 dark:hover:text-gray-300"
              >
                <ChevronLeft size={18} />
              </button>
              <div className="flex items-center gap-1">
                {SLIDES.map((s, i) => (
                  <Dot key={s.id} active={i === slideIndex} onClick={() => goTo(i)} />
                ))}
              </div>
              <button
                type="button"
                onClick={next}
                className="flex h-8 w-8 items-center justify-center rounded-full text-gray-400 transition-colors hover:bg-gray-100 hover:text-gray-600 dark:hover:bg-gray-800 dark:hover:text-gray-300"
              >
                <ChevronRight size={18} />
              </button>
            </div>

            <AnimatePresence>
              {slideIndex === SLIDES.length - 1 && <CtaSection onInvite={() => setModalOpen(true)} />}
            </AnimatePresence>
          </div>
        </div>
      </div>

      <SyncWithOthersModal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        userId={profile?.id ?? ''}
      />
    </>
  )
}
