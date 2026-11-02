import { useEffect, useRef, useState } from "react";
import { getToken } from "../auth/session";

// Watches the live service from the church's video server over WebRTC (WHEP):
// about a second behind, so the team can check picture and sound.
export function LivePreview({ whepUrl }: { whepUrl: string }) {
  const video = useRef<HTMLVideoElement>(null);
  const [state, setState] = useState<"connecting" | "playing" | "failed">("connecting");
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    let closed = false;
    const pc = new RTCPeerConnection();
    pc.addTransceiver("video", { direction: "recvonly" });
    pc.addTransceiver("audio", { direction: "recvonly" });
    pc.ontrack = (event) => {
      if (video.current && event.streams[0]) {
        video.current.srcObject = event.streams[0];
        setState("playing");
      }
    };
    pc.onconnectionstatechange = () => {
      if (pc.connectionState === "failed" && !closed) setState("failed");
    };
    (async () => {
      try {
        const offer = await pc.createOffer();
        await pc.setLocalDescription(offer);
        // Wait briefly for network candidates so one request is enough.
        await new Promise<void>((resolve) => {
          if (pc.iceGatheringState === "complete") return resolve();
          const done = () => pc.iceGatheringState === "complete" && resolve();
          pc.addEventListener("icegatheringstatechange", done);
          setTimeout(resolve, 1500);
        });
        const res = await fetch(whepUrl, {
          method: "POST",
          headers: { "Content-Type": "application/sdp", Authorization: `Bearer ${getToken() || ""}` },
          body: pc.localDescription?.sdp || "",
        });
        if (!res.ok) throw new Error(String(res.status));
        await pc.setRemoteDescription({ type: "answer", sdp: await res.text() });
      } catch {
        if (!closed) setState("failed");
      }
    })();
    return () => {
      closed = true;
      pc.close();
    };
  }, [whepUrl, attempt]);

  return (
    <div className="live-preview" style={{ maxWidth: 720 }}>
      <video ref={video} autoPlay playsInline muted style={{ width: "100%", aspectRatio: "16 / 9", background: "#000", borderRadius: 14 }} />
      {state !== "playing" ? (
        <p className="small-muted">
          {state === "connecting" ? "Connecting to the live picture…" : "The preview could not connect. "}
          {state === "failed" ? (
            <button type="button" className="secondary compact" onClick={() => { setState("connecting"); setAttempt((n) => n + 1); }}>
              Try again
            </button>
          ) : null}
        </p>
      ) : (
        <p className="small-muted">Picture preview, about a second behind. Browsers can't play the sound most cameras and OBS send this way; check the sound in the app.</p>
      )}
    </div>
  );
}
