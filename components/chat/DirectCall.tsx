'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import {
  Mic,
  MicOff,
  Phone,
  PhoneOff,
  Video,
  VideoOff,
} from 'lucide-react'
import Avatar from '@/components/ui/Avatar'
import { cn } from '@/lib/utils'
import {
  isFreshCallOffer,
  parseCallSignal,
  type CallMedia,
  type CallSignal,
  type CallSignalKind,
  type CallSignalPayload,
} from '@/lib/call-signaling'
import type { Profile } from '@/types'

const SUPABASE_CONFIGURED = (process.env.NEXT_PUBLIC_SUPABASE_URL ?? '').startsWith('http')

const RTC_CONFIGURATION: RTCConfiguration = {
  iceServers: [
    { urls: 'stun:stun.l.google.com:19302' },
    { urls: 'stun:stun1.l.google.com:19302' },
  ],
}

type CallPeer = Pick<Profile, 'id' | 'name' | 'avatar_url'>
type CallStatus = 'idle' | 'incoming' | 'calling' | 'connecting' | 'active'

type CallState = {
  status: CallStatus
  peer: CallPeer | null
  media: CallMedia
  muted: boolean
  cameraOff: boolean
  localStream: MediaStream | null
  remoteStream: MediaStream | null
}

const IDLE_CALL: CallState = {
  status: 'idle',
  peer: null,
  media: 'audio',
  muted: false,
  cameraOff: false,
  localStream: null,
  remoteStream: null,
}

type UseDirectCallOptions = {
  profile: Profile | null
  people: Profile[]
  onNotice: (message: string, tone?: 'success' | 'error') => void
}

async function postSignal(
  callId: string,
  receiverId: string,
  kind: CallSignalKind,
  payload: CallSignalPayload
) {
  const response = await fetch('/api/calls', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ call_id: callId, receiver_id: receiverId, kind, payload }),
  })
  if (!response.ok) {
    const body = (await response.json().catch(() => ({}))) as { error?: string }
    throw new Error(body.error ?? 'Could not send the call signal.')
  }
}

async function waitForIceGathering(peerConnection: RTCPeerConnection) {
  if (peerConnection.iceGatheringState === 'complete') return

  await new Promise<void>((resolve) => {
    const timeout = window.setTimeout(done, 5_000)
    function done() {
      window.clearTimeout(timeout)
      peerConnection.removeEventListener('icegatheringstatechange', handleChange)
      resolve()
    }
    function handleChange() {
      if (peerConnection.iceGatheringState === 'complete') done()
    }
    peerConnection.addEventListener('icegatheringstatechange', handleChange)
  })
}

async function requestMedia(media: CallMedia) {
  if (!navigator.mediaDevices?.getUserMedia) {
    throw new Error('This browser does not support audio or video calls.')
  }
  return navigator.mediaDevices.getUserMedia({
    audio: true,
    video: media === 'video' ? { facingMode: 'user' } : false,
  })
}

export function useDirectCall({ profile, people, onNotice }: UseDirectCallOptions) {
  const [state, setState] = useState<CallState>(IDLE_CALL)
  const stateRef = useRef<CallState>(IDLE_CALL)
  const callIdRef = useRef<string | null>(null)
  const incomingOfferRef = useRef<CallSignal | null>(null)
  const peerConnectionRef = useRef<RTCPeerConnection | null>(null)
  const localStreamRef = useRef<MediaStream | null>(null)
  const remoteStreamRef = useRef<MediaStream | null>(null)

  const updateState = useCallback((patch: Partial<CallState>) => {
    setState((previous) => {
      const next = { ...previous, ...patch }
      stateRef.current = next
      return next
    })
  }, [])

  const resetCall = useCallback((updateUi = true) => {
    peerConnectionRef.current?.close()
    peerConnectionRef.current = null
    localStreamRef.current?.getTracks().forEach((track) => track.stop())
    localStreamRef.current = null
    remoteStreamRef.current = null
    callIdRef.current = null
    incomingOfferRef.current = null
    stateRef.current = IDLE_CALL
    if (updateUi) setState(IDLE_CALL)
  }, [])

  const createPeerConnection = useCallback(() => {
    const peerConnection = new RTCPeerConnection(RTC_CONFIGURATION)
    const remoteStream = new MediaStream()
    remoteStreamRef.current = remoteStream
    peerConnectionRef.current = peerConnection

    peerConnection.ontrack = (event) => {
      for (const track of event.streams[0]?.getTracks() ?? [event.track]) {
        if (!remoteStream.getTracks().some((existing) => existing.id === track.id)) {
          remoteStream.addTrack(track)
        }
      }
      updateState({ remoteStream, status: 'active' })
    }

    peerConnection.onconnectionstatechange = () => {
      if (peerConnection.connectionState === 'connected') {
        updateState({ status: 'active' })
      } else if (peerConnection.connectionState === 'failed') {
        resetCall()
        onNotice('The call connection failed.', 'error')
      }
    }

    return peerConnection
  }, [onNotice, resetCall, updateState])

  const handleSignal = useCallback(
    async (signal: CallSignal) => {
      if (!profile || signal.receiver_id !== profile.id) return

      if (signal.kind === 'offer') {
        if (!isFreshCallOffer(signal.created_at)) return
        if (stateRef.current.status !== 'idle') {
          void postSignal(signal.call_id, signal.sender_id, 'reject', {
            media: signal.payload.media,
          }).catch(() => {})
          return
        }

        const knownPeer = people.find((person) => person.id === signal.sender_id)
        const peer = signal.sender ?? knownPeer ?? {
          id: signal.sender_id,
          name: 'Someone',
          avatar_url: null,
        }
        callIdRef.current = signal.call_id
        incomingOfferRef.current = signal
        updateState({
          status: 'incoming',
          peer,
          media: signal.payload.media,
          muted: false,
          cameraOff: false,
          localStream: null,
          remoteStream: null,
        })
        return
      }

      if (signal.call_id !== callIdRef.current) return

      if (signal.kind === 'answer') {
        const description = signal.payload.description
        const peerConnection = peerConnectionRef.current
        if (!description || !peerConnection || peerConnection.signalingState !== 'have-local-offer') return
        try {
          await peerConnection.setRemoteDescription(description)
          updateState({ status: 'connecting' })
        } catch {
          resetCall()
          onNotice('Could not connect the call.', 'error')
        }
        return
      }

      const wasDeclined = signal.kind === 'reject' && stateRef.current.status === 'calling'
      resetCall()
      onNotice(wasDeclined ? 'Call declined.' : 'Call ended.')
    },
    [onNotice, people, profile, resetCall, updateState]
  )

  useEffect(() => {
    if (!SUPABASE_CONFIGURED || !profile) return
    const profileId = profile.id
    let disposed = false
    let removeSubscription: (() => void) | undefined

    async function subscribe() {
      const { createClient } = await import('@/lib/supabase/client')
      if (disposed) return
      const supabase = createClient()
      const channel = supabase
        .channel(`calls:${profileId}`)
        .on(
          'postgres_changes',
          {
            event: 'INSERT',
            schema: 'public',
            table: 'call_signals',
            filter: `receiver_id=eq.${profileId}`,
          },
          (payload) => {
            const signal = parseCallSignal(payload.new)
            if (signal) void handleSignal(signal)
          }
        )
        .subscribe(async (status) => {
          if (status !== 'SUBSCRIBED') return
          try {
            const response = await fetch('/api/calls')
            if (!response.ok) return
            const signal = parseCallSignal(await response.json())
            if (signal) await handleSignal(signal)
          } catch {
            // The live subscription continues even if the pending-call check fails.
          }
        })

      removeSubscription = () => {
        void supabase.removeChannel(channel)
      }
    }

    void subscribe()
    return () => {
      disposed = true
      removeSubscription?.()
    }
  }, [handleSignal, profile])

  useEffect(() => () => resetCall(false), [resetCall])

  const startCall = useCallback(
    async (peer: CallPeer, media: CallMedia) => {
      if (stateRef.current.status !== 'idle') return
      if (!SUPABASE_CONFIGURED) {
        onNotice('Calls require Supabase to be configured.', 'error')
        return
      }

      const callId = crypto.randomUUID()
      callIdRef.current = callId
      updateState({
        status: 'calling',
        peer,
        media,
        muted: false,
        cameraOff: false,
        localStream: null,
        remoteStream: null,
      })

      try {
        const localStream = await requestMedia(media)
        if (callIdRef.current !== callId) {
          localStream.getTracks().forEach((track) => track.stop())
          return
        }
        localStreamRef.current = localStream
        updateState({ localStream })

        const peerConnection = createPeerConnection()
        localStream.getTracks().forEach((track) => peerConnection.addTrack(track, localStream))
        const offer = await peerConnection.createOffer()
        await peerConnection.setLocalDescription(offer)
        await waitForIceGathering(peerConnection)
        const description = peerConnection.localDescription
        if (!description?.sdp) throw new Error('Could not create a call offer.')

        await postSignal(callId, peer.id, 'offer', {
          media,
          description: { type: 'offer', sdp: description.sdp },
        })
      } catch (error) {
        resetCall()
        onNotice(error instanceof Error ? error.message : 'Could not start the call.', 'error')
      }
    },
    [createPeerConnection, onNotice, resetCall, updateState]
  )

  const acceptCall = useCallback(async () => {
    const offerSignal = incomingOfferRef.current
    const callId = callIdRef.current
    const peer = stateRef.current.peer
    const description = offerSignal?.payload.description
    if (!offerSignal || !callId || !peer || !description) return

    updateState({ status: 'connecting' })
    try {
      const localStream = await requestMedia(offerSignal.payload.media)
      if (callIdRef.current !== callId) {
        localStream.getTracks().forEach((track) => track.stop())
        return
      }
      localStreamRef.current = localStream
      updateState({ localStream })

      const peerConnection = createPeerConnection()
      localStream.getTracks().forEach((track) => peerConnection.addTrack(track, localStream))
      await peerConnection.setRemoteDescription(description)
      const answer = await peerConnection.createAnswer()
      await peerConnection.setLocalDescription(answer)
      await waitForIceGathering(peerConnection)
      const localDescription = peerConnection.localDescription
      if (!localDescription?.sdp) throw new Error('Could not answer the call.')

      await postSignal(callId, peer.id, 'answer', {
        media: offerSignal.payload.media,
        description: { type: 'answer', sdp: localDescription.sdp },
      })
      incomingOfferRef.current = null
    } catch (error) {
      void postSignal(callId, peer.id, 'end', { media: offerSignal.payload.media }).catch(() => {})
      resetCall()
      onNotice(error instanceof Error ? error.message : 'Could not answer the call.', 'error')
    }
  }, [createPeerConnection, onNotice, resetCall, updateState])

  const declineCall = useCallback(() => {
    const callId = callIdRef.current
    const { peer, media } = stateRef.current
    if (callId && peer) {
      void postSignal(callId, peer.id, 'reject', { media }).catch(() => {})
    }
    resetCall()
  }, [resetCall])

  const endCall = useCallback(() => {
    const callId = callIdRef.current
    const { peer, media } = stateRef.current
    if (callId && peer) {
      void postSignal(callId, peer.id, 'end', { media }).catch(() => {})
    }
    resetCall()
  }, [resetCall])

  useEffect(() => {
    if (state.status !== 'calling' && state.status !== 'incoming') return
    const timeout = window.setTimeout(() => {
      const wasCalling = stateRef.current.status === 'calling'
      endCall()
      if (wasCalling) onNotice('No answer.')
    }, 45_000)
    return () => window.clearTimeout(timeout)
  }, [endCall, onNotice, state.status])

  const toggleMute = useCallback(() => {
    const muted = !stateRef.current.muted
    localStreamRef.current?.getAudioTracks().forEach((track) => {
      track.enabled = !muted
    })
    updateState({ muted })
  }, [updateState])

  const toggleCamera = useCallback(() => {
    const cameraOff = !stateRef.current.cameraOff
    localStreamRef.current?.getVideoTracks().forEach((track) => {
      track.enabled = !cameraOff
    })
    updateState({ cameraOff })
  }, [updateState])

  return {
    state,
    busy: state.status !== 'idle',
    startCall,
    acceptCall,
    declineCall,
    endCall,
    toggleMute,
    toggleCamera,
  }
}

type DirectCallController = ReturnType<typeof useDirectCall>

export function DirectCallButtons({
  peer,
  enabled,
  call,
}: {
  peer: CallPeer
  enabled: boolean
  call: DirectCallController
}) {
  const disabled = !enabled || call.busy
  return (
    <div className="ml-auto flex items-center gap-1">
      <button
        type="button"
        onClick={() => void call.startCall(peer, 'audio')}
        disabled={disabled}
        className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-gray-200 bg-white text-gray-600 transition hover:bg-gray-50 hover:text-fuchsia-600 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-purple-500 disabled:pointer-events-none disabled:opacity-40 dark:border-gray-700 dark:bg-gray-900 dark:text-gray-300 dark:hover:bg-gray-800 dark:hover:text-fuchsia-300"
        aria-label={`Start audio call with ${peer.name}`}
        title="Audio call"
      >
        <Phone size={15} />
      </button>
      <button
        type="button"
        onClick={() => void call.startCall(peer, 'video')}
        disabled={disabled}
        className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-gray-200 bg-white text-gray-600 transition hover:bg-gray-50 hover:text-fuchsia-600 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-purple-500 disabled:pointer-events-none disabled:opacity-40 dark:border-gray-700 dark:bg-gray-900 dark:text-gray-300 dark:hover:bg-gray-800 dark:hover:text-fuchsia-300"
        aria-label={`Start video call with ${peer.name}`}
        title="Video call"
      >
        <Video size={16} />
      </button>
    </div>
  )
}

function StreamVideo({ stream, muted, className }: { stream: MediaStream; muted?: boolean; className?: string }) {
  const ref = useRef<HTMLVideoElement>(null)
  useEffect(() => {
    if (ref.current) ref.current.srcObject = stream
  }, [stream])
  return <video ref={ref} autoPlay playsInline muted={muted} className={className} />
}

export function DirectCallOverlay({ call }: { call: DirectCallController }) {
  const { state } = call
  if (state.status === 'idle' || !state.peer) return null

  const isIncoming = state.status === 'incoming'
  const isVideo = state.media === 'video'
  const statusLabel =
    state.status === 'calling'
      ? 'Ringing…'
      : state.status === 'connecting'
        ? 'Connecting…'
        : state.status === 'active'
          ? isVideo
            ? 'Video call'
            : 'Audio call'
          : `Incoming ${isVideo ? 'video' : 'audio'} call`

  return (
    <div className="fixed inset-0 z-[1100] flex items-center justify-center bg-gray-950/75 p-4 backdrop-blur-sm">
      <section
        role="dialog"
        aria-modal="true"
        aria-label={`${isIncoming ? 'Incoming' : 'Active'} call with ${state.peer.name}`}
        className="relative flex min-h-[28rem] w-full max-w-3xl flex-col overflow-hidden rounded-3xl border border-white/10 bg-gray-950 text-white shadow-2xl"
      >
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_top,_rgba(168,85,247,0.22),_transparent_48%)]" />

        <div className="relative flex flex-1 items-center justify-center p-6 sm:p-10">
          {isVideo && state.remoteStream ? (
            <StreamVideo stream={state.remoteStream} className="absolute inset-0 h-full w-full object-cover" />
          ) : (
            <div className="flex flex-col items-center text-center">
              <Avatar name={state.peer.name} src={state.peer.avatar_url} size="lg" className="h-24 w-24 text-2xl ring-4 ring-white/10" />
              <h2 className="mt-5 text-xl font-semibold">{state.peer.name}</h2>
              <p className="mt-2 text-sm text-gray-300">{statusLabel}</p>
            </div>
          )}

          {isVideo && state.localStream && !state.cameraOff && (
            <StreamVideo
              stream={state.localStream}
              muted
              className="absolute bottom-5 right-5 h-32 w-24 rounded-2xl border border-white/20 bg-gray-900 object-cover shadow-xl sm:h-40 sm:w-28"
            />
          )}

          {isVideo && state.remoteStream && (
            <div className="absolute left-5 top-5 rounded-full bg-black/45 px-3 py-1.5 text-sm backdrop-blur-sm">
              {state.peer.name}
            </div>
          )}
        </div>

        <div className="relative flex min-h-24 items-center justify-center gap-3 border-t border-white/10 bg-black/20 px-5 py-5">
          {isIncoming ? (
            <>
              <CallActionButton label="Decline" tone="danger" onClick={call.declineCall}>
                <PhoneOff size={20} />
              </CallActionButton>
              <CallActionButton label="Answer" tone="accept" onClick={() => void call.acceptCall()}>
                {isVideo ? <Video size={20} /> : <Phone size={20} />}
              </CallActionButton>
            </>
          ) : (
            <>
              <CallActionButton label={state.muted ? 'Unmute' : 'Mute'} active={state.muted} onClick={call.toggleMute}>
                {state.muted ? <MicOff size={20} /> : <Mic size={20} />}
              </CallActionButton>
              {isVideo && (
                <CallActionButton label={state.cameraOff ? 'Camera on' : 'Camera off'} active={state.cameraOff} onClick={call.toggleCamera}>
                  {state.cameraOff ? <VideoOff size={20} /> : <Video size={20} />}
                </CallActionButton>
              )}
              <CallActionButton label="End" tone="danger" onClick={call.endCall}>
                <PhoneOff size={20} />
              </CallActionButton>
            </>
          )}
        </div>
      </section>
    </div>
  )
}

function CallActionButton({
  label,
  tone,
  active,
  onClick,
  children,
}: {
  label: string
  tone?: 'danger' | 'accept'
  active?: boolean
  onClick: () => void
  children: React.ReactNode
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        'inline-flex min-w-20 flex-col items-center gap-1.5 rounded-2xl px-4 py-3 text-xs font-medium transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white',
        tone === 'danger'
          ? 'bg-red-600 text-white hover:bg-red-500'
          : tone === 'accept'
            ? 'bg-emerald-500 text-white hover:bg-emerald-400'
            : active
              ? 'bg-white text-gray-950 hover:bg-gray-100'
              : 'bg-white/10 text-white hover:bg-white/20'
      )}
    >
      {children}
      <span>{label}</span>
    </button>
  )
}
