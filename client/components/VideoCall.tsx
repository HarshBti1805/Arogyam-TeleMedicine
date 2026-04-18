/**
 * WebRTC video call screen.
 * Uses react-native-webrtc for media, and the server WebSocket for signaling.
 *
 * Fallback sequence (per spec):
 *   1. WebRTC video call (primary)
 *   2. Audio-only (if video track fails)
 *   3. Chat (if audio also fails) — routes back with a flag
 */
import React, { useCallback, useEffect, useRef, useState } from "react";
import { Alert, Pressable, StyleSheet, Text, View } from "react-native";
import { WsClient } from "@/utils/wsClient";

// react-native-webrtc requires a custom dev build — not available in Expo Go.
// We lazy-require it so the app doesn't crash at startup when native module is absent.
let webRTCAvailable = false;
let mediaDevices: any;
let RTCPeerConnection: any;
let RTCView: any;
let RTCSessionDescription: any;
let RTCIceCandidate: any;

try {
  const webrtc = require("react-native-webrtc");
  mediaDevices = webrtc.mediaDevices;
  RTCPeerConnection = webrtc.RTCPeerConnection;
  RTCView = webrtc.RTCView;
  RTCSessionDescription = webrtc.RTCSessionDescription;
  RTCIceCandidate = webrtc.RTCIceCandidate;
  webRTCAvailable = true;
} catch {
  // Running in Expo Go — WebRTC native module unavailable.
  // VideoCall will show a dev-build required message.
}

const ICE_SERVERS = [{ urls: "stun:stun.l.google.com:19302" }];

interface VideoCallProps {
  appointmentId: string;
  userId: string;
  isCaller: boolean;
  onCallEnd: (audioTrackUri?: string) => void;
  onFallbackToChat: () => void;
}

type CallState = "connecting" | "connected" | "audio_only" | "error" | "ended";

/**
 * Safe public export — shows a "dev build required" screen in Expo Go
 * instead of crashing when the WebRTC native module is absent.
 */
export function VideoCall(props: VideoCallProps) {
  if (!webRTCAvailable) {
    return (
      <View style={styles.container}>
        <View style={styles.statusOverlay}>
          <Text style={[styles.statusText, { textAlign: "center", paddingHorizontal: 32, lineHeight: 28 }]}>
            {"📱 Video calls require a development build.\n\nRun: npx expo run:android"}
          </Text>
          <Pressable style={[styles.endBtn, { marginTop: 28 }]} onPress={props.onFallbackToChat}>
            <Text style={styles.endBtnText}>Use Chat Instead</Text>
          </Pressable>
        </View>
      </View>
    );
  }
  return <VideoCallInner {...props} />;
}

function VideoCallInner({
  appointmentId,
  userId,
  isCaller,
  onCallEnd,
  onFallbackToChat,
}: VideoCallProps) {
  const [state, setState] = useState<CallState>("connecting");
  const [localStream, setLocalStream] = useState<MediaStream | null>(null);
  const [remoteStream, setRemoteStream] = useState<MediaStream | null>(null);
  const [isMuted, setIsMuted] = useState(false);
  const [isVideoOff, setIsVideoOff] = useState(false);
  const [fallbackToast, setFallbackToast] = useState<string | null>(null);

  const pcRef = useRef<RTCPeerConnection | null>(null);
  const wsRef = useRef<WsClient | null>(null);
  const reconnectAttemptsRef = useRef(0);

  const roomId = `call_${appointmentId}`;

  const cleanup = useCallback(() => {
    localStream?.getTracks().forEach((t) => t.stop());
    pcRef.current?.close();
    wsRef.current?.destroy();
  }, [localStream]);

  const showFallback = (message: string) => {
    setFallbackToast(message);
    setTimeout(() => setFallbackToast(null), 4000);
  };

  const setupPeerConnection = useCallback(
    (stream: MediaStream, ws: WsClient) => {
      const pc = new RTCPeerConnection({ iceServers: ICE_SERVERS });
      pcRef.current = pc;

      stream.getTracks().forEach((track) => pc.addTrack(track, stream));

      pc.ontrack = (event) => {
        setRemoteStream(event.streams[0]);
        setState("connected");
      };

      pc.onicecandidate = (event) => {
        if (event.candidate) {
          ws.send({
            event: "webrtc.signal",
            roomId,
            payload: { type: "ice-candidate", candidate: event.candidate, from: userId },
          });
        }
      };

      pc.onconnectionstatechange = () => {
        if (pc.connectionState === "failed" || pc.connectionState === "disconnected") {
          handleConnectionFailed();
        }
      };

      ws.on("webrtc.signal", async (payload: any) => {
        if (payload.from === userId) return; // ignore own signals
        try {
          if (payload.type === "offer") {
            await pc.setRemoteDescription(new RTCSessionDescription(payload));
            const answer = await pc.createAnswer();
            await pc.setLocalDescription(answer);
            ws.send({
              event: "webrtc.signal",
              roomId,
              payload: { ...answer, from: userId },
            });
          } else if (payload.type === "answer") {
            await pc.setRemoteDescription(new RTCSessionDescription(payload));
          } else if (payload.type === "ice-candidate") {
            await pc.addIceCandidate(new RTCIceCandidate(payload.candidate));
          }
        } catch (e) {
          console.warn("[VideoCall] Signal handling error:", e);
        }
      });

      return pc;
    },
    [roomId, userId]
  );

  const handleConnectionFailed = useCallback(() => {
    reconnectAttemptsRef.current += 1;
    if (reconnectAttemptsRef.current === 1) {
      // Fallback to audio-only
      showFallback("Video failed — switching to audio only.");
      setState("audio_only");
      localStream?.getVideoTracks().forEach((t) => (t.enabled = false));
      setIsVideoOff(true);
    } else {
      // Total failure → chat
      showFallback("Audio failed — falling back to chat.");
      setState("error");
      setTimeout(() => {
        cleanup();
        onFallbackToChat();
      }, 2000);
    }
  }, [localStream, cleanup, onFallbackToChat]);

  useEffect(() => {
    let active = true;

    const initCall = async () => {
      try {
        // Try video first, fall back to audio-only if camera unavailable
        let stream: MediaStream;
        try {
          stream = await mediaDevices.getUserMedia({ video: true, audio: true });
        } catch {
          showFallback("Camera unavailable — using audio only.");
          stream = await mediaDevices.getUserMedia({ video: false, audio: true });
          setState("audio_only");
        }

        if (!active) return;
        setLocalStream(stream);

        const ws = new WsClient({
          roomId,
          onOpen: () => ws.joinRoom(roomId),
          onClose: () => {
            if (active && state !== "ended") handleConnectionFailed();
          },
        });
        wsRef.current = ws;

        const pc = setupPeerConnection(stream, ws);

        if (isCaller) {
          const offer = await pc.createOffer({});
          await pc.setLocalDescription(offer);
          ws.send({
            event: "webrtc.signal",
            roomId,
            payload: { ...offer, from: userId },
          });
        }
      } catch (e: any) {
        if (!active) return;
        setState("error");
        showFallback(`Call setup failed: ${e.message}`);
        setTimeout(onFallbackToChat, 2000);
      }
    };

    initCall();

    return () => {
      active = false;
    };
  }, []);

  const handleEndCall = () => {
    setState("ended");
    const uri = localStream
      ? undefined // In a real app, extract recorded audio URI here
      : undefined;
    cleanup();
    onCallEnd(uri);
  };

  const toggleMute = () => {
    localStream?.getAudioTracks().forEach((t) => (t.enabled = isMuted));
    setIsMuted((m) => !m);
  };

  const toggleVideo = () => {
    localStream?.getVideoTracks().forEach((t) => (t.enabled = isVideoOff));
    setIsVideoOff((v) => !v);
  };

  return (
    <View style={styles.container}>
      {/* Remote video */}
      {remoteStream && (
        <RTCView
          streamURL={remoteStream.toURL()}
          style={StyleSheet.absoluteFill}
          objectFit="cover"
        />
      )}

      {/* Local video (picture-in-picture) */}
      {localStream && !isVideoOff && (
        <RTCView
          streamURL={localStream.toURL()}
          style={styles.localVideo}
          objectFit="cover"
          zOrder={1}
        />
      )}

      {/* Status overlay when connecting */}
      {state === "connecting" && (
        <View style={styles.statusOverlay}>
          <Text style={styles.statusText}>Connecting…</Text>
        </View>
      )}

      {state === "audio_only" && (
        <View style={styles.statusOverlay}>
          <Text style={styles.statusText}>🎤 Audio Only</Text>
        </View>
      )}

      {/* Fallback toast */}
      {fallbackToast && (
        <View style={styles.toast}>
          <Text style={styles.toastText}>{fallbackToast}</Text>
        </View>
      )}

      {/* Controls */}
      <View style={styles.controls}>
        <ControlButton
          label={isMuted ? "Unmute" : "Mute"}
          onPress={toggleMute}
          active={isMuted}
        />
        <Pressable style={styles.endBtn} onPress={handleEndCall}>
          <Text style={styles.endBtnText}>End</Text>
        </Pressable>
        <ControlButton
          label={isVideoOff ? "Video On" : "Video Off"}
          onPress={toggleVideo}
          active={isVideoOff}
        />
      </View>
    </View>
  );
}

function ControlButton({
  label,
  onPress,
  active,
}: {
  label: string;
  onPress: () => void;
  active?: boolean;
}) {
  return (
    <Pressable
      style={[styles.ctrlBtn, active && styles.ctrlBtnActive]}
      onPress={onPress}
    >
      <Text style={styles.ctrlBtnText}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#111" },
  localVideo: {
    position: "absolute",
    top: 60,
    right: 16,
    width: 100,
    height: 140,
    borderRadius: 10,
    borderWidth: 2,
    borderColor: "#fff",
    zIndex: 10,
  },
  statusOverlay: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "rgba(0,0,0,0.5)",
  },
  statusText: { color: "#fff", fontSize: 18, fontWeight: "600" },
  toast: {
    position: "absolute",
    top: 60,
    left: 20,
    right: 20,
    backgroundColor: "rgba(0,0,0,0.75)",
    borderRadius: 10,
    padding: 12,
    zIndex: 20,
  },
  toastText: { color: "#fbbf24", fontSize: 14, textAlign: "center" },
  controls: {
    position: "absolute",
    bottom: 48,
    left: 0,
    right: 0,
    flexDirection: "row",
    justifyContent: "center",
    alignItems: "center",
    gap: 20,
  },
  ctrlBtn: {
    backgroundColor: "rgba(255,255,255,0.15)",
    borderRadius: 30,
    paddingVertical: 12,
    paddingHorizontal: 20,
  },
  ctrlBtnActive: { backgroundColor: "rgba(239,68,68,0.4)" },
  ctrlBtnText: { color: "#fff", fontSize: 13, fontWeight: "600" },
  endBtn: {
    backgroundColor: "#ef4444",
    borderRadius: 30,
    paddingVertical: 16,
    paddingHorizontal: 32,
  },
  endBtnText: { color: "#fff", fontSize: 16, fontWeight: "700" },
});
