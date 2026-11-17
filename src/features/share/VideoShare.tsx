// Ennakkovideo jakoikkunassa (19.11.2026): animaation esikatselu kankaalla, videon teko, jako ja tallennus.
// Esikatselu on kangas eikä <video>, koska sovelluksen sisältöturvakäytäntö ei salli blob-osoitteita mediassa.

import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { Button } from '../../ui/components';
import { useToast } from '../../ui/Toast';
import { HEIGHT, W } from './drawResult';
import { drawFrame, layerCollector, pickVideoFormat, recordScene, type VideoScene } from './previewVideo';
import type { RenderOptions } from './ShareSheet';

type VideoState = { k: 'idle' } | { k: 'recording'; p: number } | { k: 'ready'; file: File; seconds: number } | { k: 'error'; msg: string };

const reducedMotion = () => typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches;

export function useVideoShare({
  active,
  render,
  options,
  deps,
  fileName,
  alt,
}: {
  active: boolean;
  render?: (o: RenderOptions) => Promise<HTMLCanvasElement | undefined>;
  options: RenderOptions;
  /** Piirron riippuvuudet: muutos tekee uuden animaation ja hylkää valmiin videon. */
  deps: string;
  /** Kuvan tiedostonimi; pääte vaihdetaan videon muotoon. */
  fileName: string;
  alt: string;
}): { preview: ReactNode; actions: ReactNode } {
  const toast = useToast();
  const format = useMemo(pickVideoFormat, []);
  const [allowWebm, setAllowWebm] = useState(false);
  const [scene, setScene] = useState<VideoScene>();
  const [state, setState] = useState<VideoState>({ k: 'idle' });
  const [playing, setPlaying] = useState(false);
  const [replay, setReplay] = useState(0);
  const canvas = useRef<HTMLCanvasElement | null>(null);
  const raf = useRef(0);
  const abort = useRef<AbortController | null>(null);

  // Osat ja ajoitus uudelleen, kun tiedot tai valinnat muuttuvat.
  useEffect(() => {
    if (!active || !render) return;
    let cancelled = false;
    setScene(undefined);
    setState({ k: 'idle' });
    void (async () => {
      await document.fonts?.ready;
      const c = layerCollector();
      await render({ ...options, mark: c.mark });
      if (!cancelled) setScene(c.finish());
    })();
    return () => {
      cancelled = true;
      abort.current?.abort();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [active, deps, !!render]);

  // Esikatselu: animaatio kerran (vähennetty liike: valmis kuva), sen jälkeen "Toista".
  useEffect(() => {
    const el = canvas.current;
    if (!active || !scene || !el) return;
    const ctx = el.getContext('2d')!;
    if (reducedMotion() && replay === 0) {
      drawFrame(ctx, scene, scene.timeline.total);
      return;
    }
    const t0 = performance.now();
    setPlaying(true);
    const tick = () => {
      const t = (performance.now() - t0) / 1000;
      drawFrame(ctx, scene, t);
      if (t < scene.timeline.total) raf.current = requestAnimationFrame(tick);
      else setPlaying(false);
    };
    raf.current = requestAnimationFrame(tick);
    return () => {
      cancelAnimationFrame(raf.current);
      setPlaying(false);
    };
  }, [active, scene, replay]);

  useEffect(() => () => abort.current?.abort(), []);

  const videoName = (ext: string) => fileName.replace(/\.[a-z0-9]+$/i, '') + '.' + ext;

  async function make() {
    const el = canvas.current;
    if (!scene || !el || !format) return;
    cancelAnimationFrame(raf.current);
    setPlaying(false);
    const ctrl = new AbortController();
    abort.current = ctrl;
    setState({ k: 'recording', p: 0 });
    let shown = 0;
    try {
      const blob = await recordScene(
        el,
        scene,
        format,
        (p) => {
          // Edistyminen 2 %:n välein, ettei paneeli piirry joka kuvalla.
          if (p - shown >= 0.02 || p === 1) {
            shown = p;
            setState({ k: 'recording', p });
          }
        },
        ctrl.signal,
      );
      setState({ k: 'ready', file: new File([blob], videoName(format.ext), { type: blob.type }), seconds: Math.round(scene.timeline.total) });
    } catch (e) {
      if (ctrl.signal.aborted) {
        setState({ k: 'idle' });
        drawFrame(el.getContext('2d')!, scene, scene.timeline.total);
        return;
      }
      setState({ k: 'error', msg: e instanceof Error ? e.message : String(e) });
    } finally {
      if (abort.current === ctrl) abort.current = null;
    }
  }

  function save(file: File) {
    const url = URL.createObjectURL(file);
    const a = document.createElement('a');
    a.href = url;
    a.download = file.name;
    a.click();
    window.setTimeout(() => URL.revokeObjectURL(url), 4000);
    toast('Video tallennettu', undefined, 'success');
  }
  async function share(file: File) {
    if (!navigator.canShare?.({ files: [file] })) return save(file);
    try {
      await navigator.share({ files: [file] });
    } catch {
      /* peruttu */
    }
  }
  const canShare = typeof navigator !== 'undefined' && typeof navigator.canShare === 'function';

  const story = options.size === 'story';
  const recording = state.k === 'recording';
  const preview = (
    <div className="relative">
      <canvas
        ref={canvas}
        width={scene?.width ?? W}
        height={scene?.height ?? HEIGHT[options.size]}
        role="img"
        aria-label={`${alt} (video)`}
        className={`block h-auto w-auto max-w-full rounded-xl shadow-lg ${story ? 'max-h-[52dvh]' : 'max-h-[46dvh]'} ${scene ? '' : 'invisible'}`}
      />
      {!scene && <div className="absolute inset-0 animate-pulse rounded-xl bg-slate-200" />}
      {scene && !playing && !recording && (
        <button
          type="button"
          onClick={() => setReplay((n) => n + 1)}
          className="press absolute bottom-3 left-1/2 min-h-10 -translate-x-1/2 rounded-full bg-black/65 px-4 text-sm font-semibold text-white shadow"
        >
          ▶ Toista
        </button>
      )}
    </div>
  );

  let actions: ReactNode;
  if (!format) {
    actions = <p className="rounded-xl bg-amber-50 px-3 py-2 text-sm text-amber-900 ring-1 ring-amber-200">Tämä selain ei osaa tehdä videota. Jaa kuva tai kokeile toisella selaimella (esim. Chrome tai Safari).</p>;
  } else if (format.ext === 'webm' && !allowWebm) {
    actions = (
      <div className="space-y-2">
        <p className="rounded-xl bg-amber-50 px-3 py-2 text-sm text-amber-900 ring-1 ring-amber-200">
          Tämä selain tekee videon vain WebM-muodossa. iPhone ja WhatsApp eivät välttämättä näytä sitä; kuva toimii kaikkialla.
        </p>
        <Button variant="secondary" className="w-full" onClick={() => setAllowWebm(true)}>
          Tee silti WebM-video
        </Button>
      </div>
    );
  } else if (state.k === 'recording') {
    actions = (
      <div className="space-y-2" aria-live="polite">
        <div className="flex items-center justify-between text-sm text-slate-700">
          <span>Tehdään videota… pidä sovellus auki.</span>
          <span className="tabular-nums">{Math.round(state.p * 100)} %</span>
        </div>
        <div className="h-2 overflow-hidden rounded-full bg-[var(--surface-sunk)]">
          <div className="h-full rounded-full bg-[var(--accent)] transition-[width]" style={{ width: `${Math.round(state.p * 100)}%` }} />
        </div>
        <Button variant="secondary" className="w-full" onClick={() => abort.current?.abort()}>
          Peru
        </Button>
      </div>
    );
  } else if (state.k === 'ready') {
    const f = state.file;
    actions = (
      <div className="space-y-2">
        <p className="text-sm text-slate-600" aria-live="polite">
          Video valmis: {state.seconds} s, {(f.size / 1_000_000).toLocaleString('fi-FI', { maximumFractionDigits: 1 })} Mt ({format.ext.toUpperCase()}, ei ääntä).
        </p>
        <div className="flex gap-2">
          {canShare && (
            <Button className="flex-1" onClick={() => void share(f)}>
              Jaa video
            </Button>
          )}
          <Button variant="secondary" className={canShare ? '' : 'flex-1'} onClick={() => save(f)}>
            Tallenna video
          </Button>
        </div>
      </div>
    );
  } else {
    actions = (
      <div className="space-y-2">
        {state.k === 'error' && (
          <p className="rounded-xl bg-red-50 px-3 py-2 text-sm text-red-900 ring-1 ring-red-200" role="alert">
            Videon teko ei onnistunut ({state.msg}). Kokeile uudelleen tai jaa kuva.
          </p>
        )}
        <Button className="w-full" disabled={!scene} onClick={() => void make()}>
          Tee video
        </Button>
        <p className="text-xs text-slate-500">Video on noin {scene ? Math.round(scene.timeline.total) : 7} sekuntia ja ilman ääntä. Teko kestää yhtä kauan kuin video.</p>
      </div>
    );
  }
  return { preview, actions };
}
