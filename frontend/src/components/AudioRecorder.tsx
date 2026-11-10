'use client';
import { useRef, useState, useEffect } from "react";
import { Mic, Square } from "lucide-react";

export default function AudioRecorder({ onPartial, onFinal }: any) {
  const [recording, setRecording] = useState(false);
  const wsRef = useRef<WebSocket | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const processorRef = useRef<ScriptProcessorNode | null>(null);
  const audioCtxRef = useRef<AudioContext | null>(null);
  const reconnectAttempts = useRef(0);
  const maxReconnectAttempts = 3;

  const WS_URL = import.meta.env.VITE_WS_URL || "ws://localhost/ws/stt";

  useEffect(() => {
    return () => {
      // Cleanup on unmount
      if (wsRef.current?.readyState === WebSocket.OPEN) {
        wsRef.current.close();
      }
      streamRef.current?.getTracks().forEach((t) => t.stop());
      processorRef.current?.disconnect();
      audioCtxRef.current?.close();
    };
  }, []);

  async function start() {
    if (recording) return;

    try {
      console.log("🎙️ Starting audio recording...");

      // 1) Open WebSocket with proper error handling
      const ws = new WebSocket(WS_URL);
      
      ws.binaryType = "arraybuffer";
      wsRef.current = ws;

      // ws.onopen = () => {
      //   console.log("✅ WebSocket OPEN");
      //   reconnectAttempts.current = 0;
      //   // Send start event
      //   ws.send(JSON.stringify({ event: "start" }));
      // };

      // ws.onerror = (err) => {
      //   console.error("❌ WebSocket ERROR:", err);
      // };

      // ws.onclose = () => {
      //   console.log("🔌 WebSocket CLOSED");
      //   setRecording(false);
      // };

      // ✅ CRITICAL: Handle incoming WebSocket messages
      ws.onmessage = (ev) => {
        try {
          // console.log("📡 WS MESSAGE:", ev.data);
          const data = JSON.parse(ev.data);
          
          if (data.type === "partial" && data.text) {
            // console.log("🔄 Partial text:", data.text);
            onPartial?.(data.text);
          } else if (data.type === "final" && data.text) {
            // console.log("✅ Final text:", data.text);
            onFinal?.(data.text);
          } else if (data.type === "ready") {
            console.log("▶️ Server ready for audio");
          } else if (data.type === "pong") {
            console.log("🔄 Pong received");
          }
        } catch (err) {
          console.error("❌ Error parsing WS message:", err);
        }
      };

      // 2) Capture microphone
      const stream = await navigator.mediaDevices.getUserMedia({ 
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
          sampleRate: 16000,
        }
      });
      streamRef.current = stream;

      // 3) Create AudioContext with 16kHz
      const audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)({ 
        sampleRate: 16000 
      });
      audioCtxRef.current = audioCtx;

      const source = audioCtx.createMediaStreamSource(stream);
      const processor = audioCtx.createScriptProcessor(4096, 1, 1);
      processorRef.current = processor;

      // ✅ CRITICAL: Only send audio when WebSocket is ready
      processor.onaudioprocess = (e) => {
        if (ws.readyState !== WebSocket.OPEN) {
          console.warn("⚠️ WebSocket not ready, skipping audio chunk");
          return;
        }

        try {
          const input = e.inputBuffer.getChannelData(0);
          const pcm16 = new Int16Array(input.length);
          
          for (let i = 0; i < input.length; i++) {
            // Proper Int16 conversion
            const s = Math.max(-1, Math.min(1, input[i]));
            pcm16[i] = s < 0 ? s * 0x8000 : s * 0x7FFF;
          }

          // Send binary audio data
          ws.send(pcm16.buffer);
          console.log(`📤 Sent audio chunk: ${pcm16.buffer.byteLength} bytes`);
        } catch (err) {
          console.error("❌ Error processing audio:", err);
        }
      };

      source.connect(processor);
      processor.connect(audioCtx.destination);

      setRecording(true);
      console.log("✅ Recording started");

    } catch (error) {
      console.error("❌ Error starting recording:", error);
      setRecording(false);
    }
  }

  function stop() {
    console.log("⏹️ Stopping recording...");
    
    try {
      // Send stop event to server
      if (wsRef.current?.readyState === WebSocket.OPEN) {
        wsRef.current.send(JSON.stringify({ event: "stop" }));
        // Give server time to send final response
        setTimeout(() => {
          wsRef.current?.close();
        }, 500);
      }

      // Cleanup audio
      if (processorRef.current) {
        processorRef.current.disconnect();
      }
      if (audioCtxRef.current) {
        audioCtxRef.current.close();
      }
      if (streamRef.current) {
        streamRef.current.getTracks().forEach((t) => t.stop());
      }

      setRecording(false);
      console.log("✅ Recording stopped");
    } catch (error) {
      console.error("❌ Error stopping recording:", error);
      setRecording(false);
    }
  }

  return (
    <button
      type="button"
      onClick={recording ? stop : start}
      title={recording ? "Stop Recording" : "Start Recording"}
      className={`h-10 w-10 rounded-md flex items-center justify-center transition-all duration-200 
      border border-border/40 text-muted-foreground shadow-sm
      ${recording 
        ? "bg-red-400/30 hover:bg-red-400/50 text-red-400 animate-pulse" 
        : "bg-[#E37B53] hover:bg-white hover:text-[#E37B53] text-white/80"
      }`}
    >
      {recording ? (
        <Square className="h-5 w-5" />
      ) : (
        <Mic className="h-5 w-5" /> 
      )}
    </button>
  );
}

