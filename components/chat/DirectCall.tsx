'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import {
  Mic,
  MicOff,
  Phone,
  PhoneOff,
  ScreenShare,
  ScreenShareOff,
  Video,
  VideoOff,
  Volume2,
} from 'lucide-react'
import Avatar from '@/components/ui/Avatar'
import { hasTurnServer, parseIceServers } from '@/lib/call-ice'
import { cn } from '@/lib/utils'
import {
  isFreshCallOffer,
  parseCallControlMessage,
  parseCallSignal,
  type CallControlMessage,
  type CallMedia,
  type CallSignal,
  type CallSignalKind,
  type CallSignalPayload,
} from '@/lib/call-signaling'
import type { Profile } from '@/types'

const SUPABASE_CONFIGURED = (process.env.NEXT_PUBLIC_SUPABASE_URL ?? '').startsWith('http')

type CallPeer = Pick<Profile, 'id' | 'name' | 'avatar_url'>
type CallStatus = 'idle' | 'incoming' | 'calling' | 'connecting' | 'active'

type CallState = {
  status: CallStatus
  peer: CallPeer | null
  media: CallMedia
  muted: boolean
  cameraOff: boolean
  screenSharing: boolean
  remoteScreenSharing: boolean
  localStream: MediaStream | null
  screenStream: MediaStream | null
  remoteStream: MediaStream | null
}

const IDLE_CALL: CallState = {
  status: 'idle',
  peer: null,
  media: 'audio',
  muted: false,
  cameraOff: false,
  screenSharing: false,
  remoteScreenSharing: false,
  localStream: null,
  screenStream: null,
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

async function requestRtcConfiguration(): Promise<RTCConfiguration> {
  let response: Response
  try {
    response = await fetch('/api/calls/ice', { cache: 'no-store' })
  } catch {
    throw new Error('Secure call relay is unavailable. Please try again shortly.')
  }
  if (!response.ok) {
    const body = (await response.json().catch(() => ({}))) as { error?: string }
    throw new Error(body.error ?? 'Secure call relay is unavailable. Please try again shortly.')
  }
  const body = (await response.json().catch(() => null)) as { iceServers?: unknown } | null
  const iceServers = parseIceServers(body?.iceServers)
  if (!iceServers || !hasTurnServer(iceServers)) {
    throw new Error('Secure call relay returned an invalid configuration.')
  }
  return { iceServers }
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
  const lastSignalIdRef = useRef(0)
  const incomingOfferRef = useRef<CallSignal | null>(null)
  const peerConnectionRef = useRef<RTCPeerConnection | null>(null)
  const localStreamRef = useRef<MediaStream | null>(null)
  const screenStreamRef = useRef<MediaStream | null>(null)
  const remoteStreamRef = useRef<MediaStream | null>(null)
  const controlChannelRef = useRef<RTCDataChannel | null>(null)

  const updateState = useCallback((patch: Partial<CallState>) => {
    setState((previous) => {
      const next = { ...previous, ...patch }
      stateRef.current = next
      return next
    })
  }, [])

  const resetCall = useCallback((updateUi = true) => {
    screenStreamRef.current?.getTracks().forEach((track) => {
      track.onended = null
      track.stop()
    })
    screenStreamRef.current = null
    controlChannelRef.current?.close()
    controlChannelRef.current = null
    peerConnectionRef.current?.close()
    peerConnectionRef.current = null
    localStreamRef.current?.getTracks().forEach((track) => track.stop())
    localStreamRef.current = null
    remoteStreamRef.current = null
    callIdRef.current = null
    lastSignalIdRef.current = 0
    incomingOfferRef.current = null
    stateRef.current = IDLE_CALL
    if (updateUi) setState(IDLE_CALL)
  }, [])

  const attachControlChannel = useCallback(
    (channel: RTCDataChannel) => {
      controlChannelRef.current = channel
      channel.onmessage = (event) => {
        const message = parseCallControlMessage(event.data)
        if (message) updateState({ remoteScreenSharing: message.active })
      }
      channel.onclose = () => updateState({ remoteScreenSharing: false })
    },
    [updateState]
  )

  const sendControlMessage = useCallback((message: CallControlMessage) => {
    const channel = controlChannelRef.current
    if (channel?.readyState !== 'open') return false
    channel.send(JSON.stringify(message))
    return true
  }, [])

  const createPeerConnection = useCallback((configuration: RTCConfiguration) => {
    const peerConnection = new RTCPeerConnection(configuration)
    const remoteStream = new MediaStream()
    remoteStreamRef.current = remoteStream
    peerConnectionRef.current = peerConnection
    peerConnection.ondatachannel = (event) => {
      if (event.channel.label === 'sync-call-control') attachControlChannel(event.channel)
    }

    peerConnection.ontrack = (event) => {
      for (const track of event.streams[0]?.getTracks() ?? [event.track]) {
        if (!remoteStream.getTracks().some((existing) => existing.id === track.id)) {
          remoteStream.addTrack(track)
        }
      }
      updateState({ remoteStream })
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
  }, [attachControlChannel, onNotice, resetCall, updateState])

  const handleSignal = useCallback(
    async (signal: CallSignal) => {
      if (!profile || signal.receiver_id !== profile.id) return
      if (signal.id <= lastSignalIdRef.current) return
      lastSignalIdRef.current = signal.id

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
          screenSharing: false,
          remoteScreenSharing: false,
          localStream: null,
          screenStream: null,
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

  useEffect(() => {
    if (state.status === 'idle' || !profile) return
    const callId = callIdRef.current
    if (!callId) return
    let cancelled = false
    let timeout: number | undefined

    async function pollSignals() {
      try {
        const response = await fetch(
          `/api/calls?call_id=${encodeURIComponent(callId!)}&after_id=${lastSignalIdRef.current}`
        )
        if (response.ok && !cancelled && callIdRef.current === callId) {
          const rows = (await response.json()) as unknown[]
          for (const row of Array.isArray(rows) ? rows : []) {
            const signal = parseCallSignal(row)
            if (signal) await handleSignal(signal)
          }
        }
      } catch {
        // Realtime remains the primary path; polling retries transient failures.
      }
      if (!cancelled && callIdRef.current === callId) {
        timeout = window.setTimeout(pollSignals, 1_500)
      }
    }

    void pollSignals()
    return () => {
      cancelled = true
      if (timeout) window.clearTimeout(timeout)
    }
  }, [handleSignal, profile, state.status])

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
      lastSignalIdRef.current = 0
      updateState({
        status: 'calling',
        peer,
        media,
        muted: false,
        cameraOff: false,
        screenSharing: false,
        remoteScreenSharing: false,
        localStream: null,
        screenStream: null,
        remoteStream: null,
      })

      try {
        const rtcConfiguration = await requestRtcConfiguration()
        const localStream = await requestMedia(media)
        if (callIdRef.current !== callId) {
          localStream.getTracks().forEach((track) => track.stop())
          return
        }
        localStreamRef.current = localStream
        updateState({ localStream })

        const peerConnection = createPeerConnection(rtcConfiguration)
        localStream.getTracks().forEach((track) => peerConnection.addTrack(track, localStream))
        attachControlChannel(peerConnection.createDataChannel('sync-call-control'))
        if (media === 'audio') {
          peerConnection.addTransceiver('video', { direction: 'sendrecv' })
        }
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
    [attachControlChannel, createPeerConnection, onNotice, resetCall, updateState]
  )

  const acceptCall = useCallback(async () => {
    const offerSignal = incomingOfferRef.current
    const callId = callIdRef.current
    const peer = stateRef.current.peer
    const description = offerSignal?.payload.description
    if (!offerSignal || !callId || !peer || !description) return

    updateState({ status: 'connecting' })
    try {
      const rtcConfiguration = await requestRtcConfiguration()
      const localStream = await requestMedia(offerSignal.payload.media)
      if (callIdRef.current !== callId) {
        localStream.getTracks().forEach((track) => track.stop())
        return
      }
      localStreamRef.current = localStream
      updateState({ localStream })

      const peerConnection = createPeerConnection(rtcConfiguration)
      localStream.getTracks().forEach((track) => peerConnection.addTrack(track, localStream))
      await peerConnection.setRemoteDescription(description)
      if (offerSignal.payload.media === 'audio') {
        const videoTransceiver = peerConnection
          .getTransceivers()
          .find((transceiver) => transceiver.receiver.track.kind === 'video')
        if (videoTransceiver) videoTransceiver.direction = 'sendrecv'
      }
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

  useEffect(() => {
    if (state.status !== 'connecting') return
    const timeout = window.setTimeout(() => {
      if (stateRef.current.status !== 'connecting') return
      endCall()
      onNotice('Could not establish the media connection. Try again or change network.', 'error')
    }, 20_000)
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
    if (stateRef.current.screenSharing) return
    const cameraOff = !stateRef.current.cameraOff
    localStreamRef.current?.getVideoTracks().forEach((track) => {
      track.enabled = !cameraOff
    })
    updateState({ cameraOff })
  }, [updateState])

  const stopScreenShare = useCallback(async () => {
    const screenStream = screenStreamRef.current
    const peerConnection = peerConnectionRef.current
    if (!screenStream || !peerConnection) return

    const videoSender = peerConnection
      .getTransceivers()
      .find((transceiver) => transceiver.receiver.track.kind === 'video')
      ?.sender
    const cameraTrack =
      stateRef.current.media === 'video'
        ? (localStreamRef.current?.getVideoTracks()[0] ?? null)
        : null

    if (videoSender) await videoSender.replaceTrack(cameraTrack).catch(() => {})
    sendControlMessage({ type: 'screen-share', active: false })
    screenStream.getTracks().forEach((track) => {
      track.onended = null
      track.stop()
    })
    screenStreamRef.current = null
    updateState({ screenSharing: false, screenStream: null })
  }, [sendControlMessage, updateState])

  const startScreenShare = useCallback(async () => {
    if (stateRef.current.status !== 'active' || stateRef.current.screenSharing) return
    const peerConnection = peerConnectionRef.current
    if (!peerConnection) return
    if (!navigator.mediaDevices?.getDisplayMedia) {
      onNotice('Screen sharing is not supported by this browser.', 'error')
      return
    }
    if (controlChannelRef.current?.readyState !== 'open') {
      onNotice('Wait until the call is fully connected before sharing.', 'error')
      return
    }

    let requestedStream: MediaStream | null = null
    try {
      requestedStream = await navigator.mediaDevices.getDisplayMedia({
        video: true,
        audio: false,
      })
      const screenStream = requestedStream
      const screenTrack = screenStream.getVideoTracks()[0]
      const videoSender = peerConnection
        .getTransceivers()
        .find((transceiver) => transceiver.receiver.track.kind === 'video')
        ?.sender
      if (!screenTrack || !videoSender) {
        screenStream.getTracks().forEach((track) => track.stop())
        throw new Error('Could not prepare screen sharing for this call.')
      }

      await videoSender.replaceTrack(screenTrack)
      if (!sendControlMessage({ type: 'screen-share', active: true })) {
        const cameraTrack =
          stateRef.current.media === 'video'
            ? (localStreamRef.current?.getVideoTracks()[0] ?? null)
            : null
        await videoSender.replaceTrack(cameraTrack).catch(() => {})
        throw new Error('The screen-sharing connection is not ready yet.')
      }
      screenStreamRef.current = screenStream
      screenTrack.onended = () => void stopScreenShare()
      updateState({ screenSharing: true, screenStream })
    } catch (error) {
      requestedStream?.getTracks().forEach((track) => track.stop())
      if (error instanceof DOMException && error.name === 'NotAllowedError') return
      onNotice(error instanceof Error ? error.message : 'Could not share the screen.', 'error')
    }
  }, [onNotice, sendControlMessage, stopScreenShare, updateState])

  return {
    state,
    busy: state.status !== 'idle',
    startCall,
    acceptCall,
    declineCall,
    endCall,
    toggleMute,
    toggleCamera,
    startScreenShare,
    stopScreenShare,
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

function StreamAudio({ stream }: { stream: MediaStream }) {
  const ref = useRef<HTMLAudioElement>(null)
  const [blocked, setBlocked] = useState(false)

  const play = useCallback(() => {
    const audio = ref.current
    if (!audio) return
    void audio.play().then(() => setBlocked(false)).catch(() => setBlocked(true))
  }, [])

  useEffect(() => {
    const audio = ref.current
    if (!audio) return
    audio.srcObject = stream
    play()
    return () => {
      audio.srcObject = null
    }
  }, [play, stream])

  return (
    <>
      <audio ref={ref} autoPlay />
      {blocked && (
        <button
          type="button"
          onClick={play}
          className="absolute right-5 top-5 z-20 inline-flex items-center gap-2 rounded-full bg-white px-3 py-2 text-xs font-medium text-gray-950 shadow-lg transition hover:bg-gray-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white"
        >
          <Volume2 size={15} />
          Play call audio
        </button>
      )}
    </>
  )
}

export function DirectCallOverlay({ call }: { call: DirectCallController }) {
  const { state } = call
  if (state.status === 'idle' || !state.peer) return null

  const isIncoming = state.status === 'incoming'
  const isVideo = state.media === 'video'
  const showRemoteVideo = Boolean(
    state.remoteStream && (isVideo || state.remoteScreenSharing)
  )
  const localPreviewStream = state.screenSharing ? state.screenStream : state.localStream
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
        {state.remoteStream && <StreamAudio stream={state.remoteStream} />}

        <div className="relative flex flex-1 items-center justify-center p-6 sm:p-10">
          {showRemoteVideo && state.remoteStream ? (
            <StreamVideo
              stream={state.remoteStream}
              muted
              className={cn(
                'absolute inset-0 h-full w-full bg-black',
                state.remoteScreenSharing ? 'object-contain' : 'object-cover'
              )}
            />
          ) : (
            <div className="flex flex-col items-center text-center">
              <Avatar name={state.peer.name} src={state.peer.avatar_url} size="lg" className="h-24 w-24 text-2xl ring-4 ring-white/10" />
              <h2 className="mt-5 text-xl font-semibold">{state.peer.name}</h2>
              <p className="mt-2 text-sm text-gray-300">{statusLabel}</p>
            </div>
          )}

          {(isVideo || state.screenSharing) && localPreviewStream && (!state.cameraOff || state.screenSharing) && (
            <StreamVideo
              stream={localPreviewStream}
              muted
              className={cn(
                'absolute bottom-5 right-5 h-32 w-24 rounded-2xl border border-white/20 bg-gray-900 shadow-xl sm:h-40 sm:w-28',
                state.screenSharing ? 'object-contain' : 'object-cover'
              )}
            />
          )}

          {showRemoteVideo && (
            <div className="absolute left-5 top-5 rounded-full bg-black/45 px-3 py-1.5 text-sm backdrop-blur-sm">
              {state.remoteScreenSharing ? `${state.peer.name} is sharing a screen` : state.peer.name}
            </div>
          )}
        </div>

        <div className="relative flex min-h-24 flex-wrap items-center justify-center gap-2 border-t border-white/10 bg-black/20 px-5 py-5 sm:gap-3">
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
                <CallActionButton label={state.cameraOff ? 'Camera on' : 'Camera off'} active={state.cameraOff} disabled={state.screenSharing} onClick={call.toggleCamera}>
                  {state.cameraOff ? <VideoOff size={20} /> : <Video size={20} />}
                </CallActionButton>
              )}
              <CallActionButton
                label={state.screenSharing ? 'Stop sharing' : 'Share screen'}
                active={state.screenSharing}
                disabled={state.status !== 'active'}
                onClick={() => void (state.screenSharing ? call.stopScreenShare() : call.startScreenShare())}
              >
                {state.screenSharing ? <ScreenShareOff size={20} /> : <ScreenShare size={20} />}
              </CallActionButton>
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
  disabled,
  onClick,
  children,
}: {
  label: string
  tone?: 'danger' | 'accept'
  active?: boolean
  disabled?: boolean
  onClick: () => void
  children: React.ReactNode
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      aria-pressed={active || undefined}
      className={cn(
        'inline-flex min-w-16 flex-col items-center gap-1.5 rounded-2xl px-3 py-3 text-xs font-medium transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white disabled:pointer-events-none disabled:opacity-40 sm:min-w-20 sm:px-4',
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
