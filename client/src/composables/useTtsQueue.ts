import { ref } from "vue";
import { fetchTtsBuffer } from "../api/tts";
import { splitSentences } from "../utils/splitSentences";

interface TtsSegment {
  text: string;
  status: "pending" | "fetching" | "ready" | "error";
  buffer: AudioBuffer | null;
  controller: AbortController;
}

const MAX_CONCURRENT = 3;

export function useTtsQueue() {
  const playingIndex = ref<number | null>(null);
  const ttsLoadingIndex = ref<number | null>(null);

  let audioCtx: AudioContext | null = null;
  let segments: TtsSegment[] = [];
  let currentSegmentIdx = 0;
  let nextStartTime = 0;
  let activeNodes: AudioBufferSourceNode[] = [];
  let generation = 0; // invalidates stale callbacks

  // Streaming auto-play state
  let streamBuffer = "";
  let streamingMode = false;

  function getAudioContext(): AudioContext {
    if (!audioCtx) {
      audioCtx = new AudioContext({ sampleRate: 24000 });
    }
    if (audioCtx.state === "suspended") {
      audioCtx.resume();
    }
    return audioCtx;
  }

  function stop() {
    generation++;
    // Abort all in-flight fetches
    for (const seg of segments) {
      if (seg.status === "fetching") {
        seg.controller.abort();
      }
    }
    // Stop all playing audio nodes
    for (const node of activeNodes) {
      try {
        node.stop();
        node.disconnect();
      } catch {
        // already stopped
      }
    }
    activeNodes = [];
    segments = [];
    currentSegmentIdx = 0;
    nextStartTime = 0;
    playingIndex.value = null;
    ttsLoadingIndex.value = null;
    // Reset streaming state
    streamBuffer = "";
    streamingMode = false;
  }

  async function fetchSegment(
    seg: TtsSegment,
    gen: number
  ): Promise<void> {
    if (seg.status !== "pending") return;
    seg.status = "fetching";
    try {
      const arrayBuf = await fetchTtsBuffer(seg.text, seg.controller.signal);
      if (gen !== generation) return; // stale
      const ctx = getAudioContext();
      seg.buffer = await ctx.decodeAudioData(arrayBuf);
      seg.status = "ready";
    } catch (e: any) {
      if (e?.name === "AbortError" || gen !== generation) return;
      console.error("[tts] segment fetch error:", e);
      seg.status = "error";
    }
  }

  function scheduleNext(gen: number, msgIndex: number) {
    if (gen !== generation) return;
    const ctx = getAudioContext();

    // Schedule all ready segments from currentSegmentIdx onward
    while (currentSegmentIdx < segments.length) {
      const seg = segments[currentSegmentIdx];

      if (seg.status === "ready" && seg.buffer) {
        const source = ctx.createBufferSource();
        source.buffer = seg.buffer;
        source.connect(ctx.destination);

        // Schedule precisely after previous segment
        const startAt = Math.max(nextStartTime, ctx.currentTime);
        source.start(startAt);
        nextStartTime = startAt + seg.buffer.duration;
        activeNodes.push(source);

        const isLast = currentSegmentIdx === segments.length - 1 && !streamingMode;
        source.onended = () => {
          activeNodes = activeNodes.filter((n) => n !== source);
          source.disconnect();
          if (gen !== generation) return;
          if (isLast) {
            playingIndex.value = null;
          }
        };

        currentSegmentIdx++;
      } else if (seg.status === "error") {
        // Skip errored segment
        currentSegmentIdx++;
      } else {
        // Not ready yet — wait for it
        break;
      }
    }

    // Kick off more fetches (up to MAX_CONCURRENT)
    const fetching = segments.filter((s) => s.status === "fetching").length;
    const toFetch = segments.filter((s) => s.status === "pending");
    const canStart = Math.max(0, MAX_CONCURRENT - fetching);
    for (let i = 0; i < Math.min(canStart, toFetch.length); i++) {
      fetchSegment(toFetch[i], gen).then(() => scheduleNext(gen, msgIndex));
    }
  }

  function play(text: string, index: number) {
    // Toggle: if already playing this message, stop
    if (playingIndex.value === index) {
      stop();
      return;
    }

    stop();
    const gen = generation;
    const sentences = splitSentences(text);
    if (sentences.length === 0) return;

    ttsLoadingIndex.value = index;

    segments = sentences.map((s) => ({
      text: s,
      status: "pending" as const,
      buffer: null,
      controller: new AbortController(),
    }));
    currentSegmentIdx = 0;
    nextStartTime = 0;

    // Fetch first sentence immediately — when ready, start playback
    fetchSegment(segments[0], gen).then(() => {
      if (gen !== generation) return;
      if (segments[0]?.status === "ready") {
        ttsLoadingIndex.value = null;
        playingIndex.value = index;
        scheduleNext(gen, index);
      } else {
        // First segment failed
        ttsLoadingIndex.value = null;
      }
    });

    // Pre-fetch next segments
    const prefetch = segments.slice(1, MAX_CONCURRENT);
    for (const seg of prefetch) {
      fetchSegment(seg, gen).then(() => scheduleNext(gen, index));
    }
  }

  // ── Auto-play during streaming ──────────────────────────────────

  function startAutoPlay(index: number) {
    stop();
    streamingMode = true;
    streamBuffer = "";
    ttsLoadingIndex.value = index;
    playingIndex.value = null;
  }

  function feedDelta(chunk: string) {
    if (!streamingMode) return;
    streamBuffer += chunk;

    // Try to extract complete sentences from the buffer
    const sentences = splitSentences(streamBuffer);
    if (sentences.length < 2) return; // need at least 2 — last one may be incomplete

    // All but last are complete sentences
    const complete = sentences.slice(0, -1);
    // Keep the incomplete tail in the buffer
    streamBuffer = sentences[sentences.length - 1];

    const gen = generation;
    const msgIndex = ttsLoadingIndex.value ?? playingIndex.value ?? 0;

    for (const text of complete) {
      const seg: TtsSegment = {
        text,
        status: "pending",
        buffer: null,
        controller: new AbortController(),
      };
      segments.push(seg);
      fetchSegment(seg, gen).then(() => {
        if (gen !== generation) return;
        // First buffer ready — switch from loading to playing
        if (playingIndex.value === null && segments.some((s) => s.status === "ready")) {
          ttsLoadingIndex.value = null;
          playingIndex.value = msgIndex;
        }
        scheduleNext(gen, msgIndex);
      });
    }
  }

  function flushAutoPlay() {
    if (!streamingMode) return;
    streamingMode = false;

    const gen = generation;
    const msgIndex = ttsLoadingIndex.value ?? playingIndex.value ?? 0;

    // Send remaining buffer as the last segment
    const remaining = streamBuffer.trim();
    streamBuffer = "";

    if (remaining) {
      const seg: TtsSegment = {
        text: remaining,
        status: "pending",
        buffer: null,
        controller: new AbortController(),
      };
      segments.push(seg);
      fetchSegment(seg, gen).then(() => {
        if (gen !== generation) return;
        if (playingIndex.value === null && segments.some((s) => s.status === "ready")) {
          ttsLoadingIndex.value = null;
          playingIndex.value = msgIndex;
        }
        scheduleNext(gen, msgIndex);
      });
    }

    // If no segments were ever created (empty response), clean up
    if (segments.length === 0) {
      ttsLoadingIndex.value = null;
    }
  }

  return {
    play,
    stop,
    playingIndex,
    ttsLoadingIndex,
    feedDelta,
    startAutoPlay,
    flushAutoPlay,
  };
}
