'use client';

import { useCallback, useEffect, useRef, useState } from 'react';

import type {
  BatchPredictionParams,
  KlineBar,
  ModelInfo,
  PredictionParams,
  PredictionResult,
  SymbolInfo,
} from '@/lib/kronos';
import {
  fetchBatchPrediction,
  fetchModels,
  fetchPrediction,
  fetchSymbols,
  uploadCsvPredict,
} from '@/lib/kronos';

// ---------------------------------------------------------------------------
// Tab type
// ---------------------------------------------------------------------------
type TabKey = 'single' | 'batch' | 'csv';

// ---------------------------------------------------------------------------
// Canvas K-line chart
// ---------------------------------------------------------------------------
const COLORS = [
  { up: 'rgba(34,170,153,0.8)', down: 'rgba(200,80,80,0.8)', line: '#22aa99' },
  { up: 'rgba(68,210,200,0.8)', down: 'rgba(255,107,107,0.8)', line: '#44d2c8' },
  { up: 'rgba(100,140,255,0.8)', down: 'rgba(255,160,80,0.8)', line: '#648cff' },
  { up: 'rgba(180,120,255,0.8)', down: 'rgba(255,180,60,0.8)', line: '#b478ff' },
];

function drawKlineChart(
  canvas: HTMLCanvasElement,
  history: KlineBar[],
  prediction: KlineBar[],
): void {
  const ctx = canvas.getContext('2d');
  if (!ctx) return;

  const dpr = window.devicePixelRatio || 1;
  const rect = canvas.getBoundingClientRect();
  canvas.width = rect.width * dpr;
  canvas.height = rect.height * dpr;
  ctx.scale(dpr, dpr);

  const W = rect.width;
  const H = rect.height;
  const CHART_TOP = 20;
  const CHART_BOTTOM = H - 60;
  const VOL_TOP = H - 50;
  const VOL_BOTTOM = H - 8;
  const chartH = CHART_BOTTOM - CHART_TOP;
  const volH = VOL_BOTTOM - VOL_TOP;

  const all = [...history, ...prediction];
  if (all.length === 0) return;

  const priceMax = Math.max(...all.map((b) => b.high));
  const priceMin = Math.min(...all.map((b) => b.low));
  const pricePad = (priceMax - priceMin) * 0.05 || 1;
  const yMax = priceMax + pricePad;
  const yMin = priceMin - pricePad;
  const volMax = Math.max(...all.map((b) => b.volume)) || 1;

  const barW = W / all.length;
  const bodyW = Math.max(barW * 0.6, 1);

  const toY = (p: number) => CHART_TOP + chartH * (1 - (p - yMin) / (yMax - yMin));
  const toVolY = (v: number) => VOL_BOTTOM - volH * (v / volMax);

  ctx.clearRect(0, 0, W, H);

  // Grid
  ctx.strokeStyle = 'rgba(128,128,128,0.12)';
  ctx.lineWidth = 0.5;
  for (let i = 0; i <= 4; i++) {
    const y = CHART_TOP + (chartH / 4) * i;
    ctx.beginPath();
    ctx.moveTo(0, y);
    ctx.lineTo(W, y);
    ctx.stroke();
  }

  // Price labels
  ctx.fillStyle = 'rgba(128,128,128,0.5)';
  ctx.font = '10px monospace';
  ctx.textAlign = 'right';
  for (let i = 0; i <= 4; i++) {
    const price = yMin + ((yMax - yMin) / 4) * (4 - i);
    ctx.fillText(price.toFixed(2), W - 4, CHART_TOP + (chartH / 4) * i - 3);
  }

  // Prediction zone
  if (prediction.length > 0) {
    const px = history.length * barW;
    ctx.fillStyle = 'rgba(68,210,200,0.04)';
    ctx.fillRect(px, 0, prediction.length * barW, H);
    ctx.strokeStyle = 'rgba(68,210,200,0.4)';
    ctx.lineWidth = 1;
    ctx.setLineDash([4, 4]);
    ctx.beginPath();
    ctx.moveTo(px, 0);
    ctx.lineTo(px, H);
    ctx.stroke();
    ctx.setLineDash([]);
    ctx.fillStyle = 'rgba(68,210,200,0.7)';
    ctx.font = '11px sans-serif';
    ctx.textAlign = 'left';
    ctx.fillText('Prediction', px + 6, 14);
  }

  // Candlesticks
  all.forEach((bar, i) => {
    const x = i * barW + barW / 2;
    const isPred = i >= history.length;
    const isUp = bar.close >= bar.open;
    const c = isPred ? COLORS[1] : COLORS[0];
    const color = isUp ? c.up : c.down;

    ctx.strokeStyle = color;
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(x, toY(bar.high));
    ctx.lineTo(x, toY(bar.low));
    ctx.stroke();

    const bTop = toY(Math.max(bar.open, bar.close));
    const bBot = toY(Math.min(bar.open, bar.close));
    ctx.fillStyle = color;
    ctx.fillRect(x - bodyW / 2, bTop, bodyW, Math.max(bBot - bTop, 1));

    const vc = isPred
      ? isUp ? 'rgba(68,210,200,0.35)' : 'rgba(255,107,107,0.35)'
      : isUp ? 'rgba(34,170,153,0.25)' : 'rgba(200,80,80,0.25)';
    ctx.fillStyle = vc;
    const vt = toVolY(bar.volume);
    ctx.fillRect(x - bodyW / 2, vt, bodyW, VOL_BOTTOM - vt);
  });
}

function drawBatchChart(
  canvas: HTMLCanvasElement,
  results: PredictionResult[],
): void {
  const ctx = canvas.getContext('2d');
  if (!ctx) return;

  const dpr = window.devicePixelRatio || 1;
  const rect = canvas.getBoundingClientRect();
  canvas.width = rect.width * dpr;
  canvas.height = rect.height * dpr;
  ctx.scale(dpr, dpr);

  const W = rect.width;
  const H = rect.height;
  const PAD = 30;

  // Normalize each series to percentage change from start for comparison
  const series = results.map((r, idx) => {
    const all = [...r.history, ...r.prediction];
    if (all.length === 0) return { label: r.symbol, points: [] as number[], predStart: 0, color: COLORS[idx % COLORS.length] };
    const base = all[0].close;
    return {
      label: r.symbol,
      points: all.map((b) => ((b.close - base) / base) * 100),
      predStart: r.history.length,
      color: COLORS[idx % COLORS.length],
    };
  });

  const allPts = series.flatMap((s) => s.points);
  if (allPts.length === 0) return;

  const maxPt = Math.max(...allPts);
  const minPt = Math.min(...allPts);
  const pad = (maxPt - minPt) * 0.1 || 1;
  const yMax = maxPt + pad;
  const yMin = minPt - pad;

  const maxLen = Math.max(...series.map((s) => s.points.length));
  const xStep = (W - PAD * 2) / (maxLen - 1 || 1);
  const toY = (v: number) => PAD + (H - PAD * 2) * (1 - (v - yMin) / (yMax - yMin));

  ctx.clearRect(0, 0, W, H);

  // Grid
  ctx.strokeStyle = 'rgba(128,128,128,0.12)';
  ctx.lineWidth = 0.5;
  for (let i = 0; i <= 4; i++) {
    const y = PAD + ((H - PAD * 2) / 4) * i;
    ctx.beginPath();
    ctx.moveTo(PAD, y);
    ctx.lineTo(W - PAD, y);
    ctx.stroke();
  }

  // Y labels
  ctx.fillStyle = 'rgba(128,128,128,0.5)';
  ctx.font = '10px monospace';
  ctx.textAlign = 'right';
  for (let i = 0; i <= 4; i++) {
    const v = yMin + ((yMax - yMin) / 4) * (4 - i);
    ctx.fillText(`${v.toFixed(1)}%`, PAD - 4, PAD + ((H - PAD * 2) / 4) * i + 3);
  }

  // Prediction zone (use first series predStart)
  if (series.length > 0 && series[0].predStart > 0) {
    const px = PAD + series[0].predStart * xStep;
    ctx.fillStyle = 'rgba(68,210,200,0.04)';
    ctx.fillRect(px, 0, W - px, H);
    ctx.strokeStyle = 'rgba(68,210,200,0.3)';
    ctx.setLineDash([4, 4]);
    ctx.beginPath();
    ctx.moveTo(px, 0);
    ctx.lineTo(px, H);
    ctx.stroke();
    ctx.setLineDash([]);
  }

  // Draw lines
  series.forEach((s) => {
    if (s.points.length < 2) return;
    ctx.strokeStyle = s.color.line;
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    s.points.forEach((p, i) => {
      const x = PAD + i * xStep;
      const y = toY(p);
      if (i === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    });
    ctx.stroke();
  });

  // Legend
  ctx.font = '12px sans-serif';
  ctx.textAlign = 'left';
  series.forEach((s, i) => {
    const lx = PAD + 8;
    const ly = PAD + 16 + i * 18;
    ctx.fillStyle = s.color.line;
    ctx.fillRect(lx, ly - 8, 12, 3);
    ctx.fillStyle = 'rgba(128,128,128,0.7)';
    ctx.fillText(s.label, lx + 18, ly - 2);
  });
}

// ---------------------------------------------------------------------------
// Stats helper
// ---------------------------------------------------------------------------
interface PredStats {
  startPrice: number;
  endPrice: number;
  change: number;
  changePct: number;
  high: number;
  low: number;
}

function computeStats(history: KlineBar[], prediction: KlineBar[]): PredStats | null {
  if (prediction.length === 0) return null;
  const start = history.length > 0 ? history[history.length - 1].close : prediction[0].open;
  const end = prediction[prediction.length - 1].close;
  return {
    startPrice: start,
    endPrice: end,
    change: end - start,
    changePct: ((end - start) / start) * 100,
    high: Math.max(...prediction.map((b) => b.high)),
    low: Math.min(...prediction.map((b) => b.low)),
  };
}

// ---------------------------------------------------------------------------
// Shared control panel
// ---------------------------------------------------------------------------
function ControlPanel({
  models,
  model, setModel,
  lookback, setLookback,
  predLen, setPredLen,
  temperature, setTemperature,
  topP, setTopP,
  sampleCount, setSampleCount,
  includeVolume, setIncludeVolume,
}: {
  models: ModelInfo[];
  model: string; setModel: (v: string) => void;
  lookback: number; setLookback: (v: number) => void;
  predLen: number; setPredLen: (v: number) => void;
  temperature: number; setTemperature: (v: number) => void;
  topP: number; setTopP: (v: number) => void;
  sampleCount: number; setSampleCount: (v: number) => void;
  includeVolume: boolean; setIncludeVolume: (v: boolean) => void;
}): JSX.Element {
  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
      {/* Model */}
      <div>
        <label className="mb-1 block text-xs font-medium text-muted" htmlFor="model">
          模型
        </label>
        <select
          id="model"
          value={model}
          onChange={(e) => setModel(e.target.value)}
          className="w-full rounded-lg border border-border bg-bg px-3 py-2 text-sm text-text focus:border-accent focus:outline-none"
        >
          {models.map((m) => (
            <option key={m.name} value={m.name}>
              Kronos-{m.name} ({m.params})
            </option>
          ))}
        </select>
      </div>

      {/* Lookback */}
      <div>
        <label className="mb-1 block text-xs font-medium text-muted">
          历史窗口: {lookback}
        </label>
        <input type="range" min={50} max={500} value={lookback} onChange={(e) => setLookback(Number(e.target.value))} className="w-full accent-accent" />
      </div>

      {/* Pred len */}
      <div>
        <label className="mb-1 block text-xs font-medium text-muted">
          预测长度: {predLen}
        </label>
        <input type="range" min={10} max={200} value={predLen} onChange={(e) => setPredLen(Number(e.target.value))} className="w-full accent-accent" />
      </div>

      {/* Temperature */}
      <div>
        <label className="mb-1 block text-xs font-medium text-muted">
          Temperature: {temperature.toFixed(1)}
        </label>
        <input type="range" min={0.1} max={2.0} step={0.1} value={temperature} onChange={(e) => setTemperature(Number(e.target.value))} className="w-full accent-accent" />
      </div>

      {/* Top-p */}
      <div>
        <label className="mb-1 block text-xs font-medium text-muted">
          Top-p: {topP.toFixed(2)}
        </label>
        <input type="range" min={0.1} max={1.0} step={0.05} value={topP} onChange={(e) => setTopP(Number(e.target.value))} className="w-full accent-accent" />
      </div>

      {/* Sample count */}
      <div>
        <label className="mb-1 block text-xs font-medium text-muted">
          采样路径: {sampleCount}
        </label>
        <input type="range" min={1} max={10} value={sampleCount} onChange={(e) => setSampleCount(Number(e.target.value))} className="w-full accent-accent" />
      </div>

      {/* Include volume */}
      <div className="flex items-end pb-1">
        <label className="flex cursor-pointer items-center gap-2 text-xs text-muted">
          <input
            type="checkbox"
            checked={includeVolume}
            onChange={(e) => setIncludeVolume(e.target.checked)}
            className="h-4 w-4 accent-accent"
          />
          包含成交量
        </label>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Stat card
// ---------------------------------------------------------------------------
function StatCard({ label, value, color }: { label: string; value: string; color?: string }): JSX.Element {
  return (
    <div className="rounded-xl border border-border bg-card p-3 shadow-card">
      <div className="text-xs text-muted">{label}</div>
      <div className={`mt-1 font-mono text-lg font-semibold ${color ?? 'text-text'}`}>{value}</div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Loading spinner
// ---------------------------------------------------------------------------
function Spinner({ text }: { text: string }): JSX.Element {
  return (
    <div className="flex items-center gap-2 text-sm text-muted">
      <span className="inline-block h-4 w-4 animate-spin rounded-full border-2 border-accent border-t-transparent" />
      {text}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Main component
// ---------------------------------------------------------------------------
export function KronosDemo(): JSX.Element {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  // Data
  const [symbols, setSymbols] = useState<SymbolInfo[]>([]);
  const [models, setModels] = useState<ModelInfo[]>([
    { name: 'mini', params: '4.1M', max_context: 2048, loaded: false },
    { name: 'small', params: '24.7M', max_context: 512, loaded: false },
    { name: 'base', params: '102.3M', max_context: 512, loaded: false },
  ]);
  const [result, setResult] = useState<PredictionResult | null>(null);
  const [batchResults, setBatchResults] = useState<PredictionResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Tab
  const [tab, setTab] = useState<TabKey>('single');

  // Params
  const [symbol, setSymbol] = useState('BTC_USDT');
  const [batchSymbols, setBatchSymbols] = useState<string[]>(['BTC_USDT', 'ETH_USDT']);
  const [model, setModel] = useState('small');
  const [lookback, setLookback] = useState(400);
  const [predLen, setPredLen] = useState(120);
  const [temperature, setTemperature] = useState(1.0);
  const [topP, setTopP] = useState(0.9);
  const [sampleCount, setSampleCount] = useState(1);
  const [includeVolume, setIncludeVolume] = useState(true);

  // CSV
  const [csvFile, setCsvFile] = useState<File | null>(null);
  const [csvPreview, setCsvPreview] = useState<string[]>([]);

  // Load symbols + models on mount
  useEffect(() => {
    fetchSymbols()
      .then(setSymbols)
      .catch(() => {
        setSymbols([
          { symbol: 'BTC_USDT', name: 'Bitcoin / USDT', bars: 600 },
          { symbol: 'ETH_USDT', name: 'Ethereum / USDT', bars: 600 },
        ]);
      });
    fetchModels().then(setModels).catch(() => {});
  }, []);

  // Redraw charts
  useEffect(() => {
    if (!canvasRef.current) return;
    if (tab === 'batch' && batchResults.length > 0) {
      drawBatchChart(canvasRef.current, batchResults);
    } else if (result) {
      drawKlineChart(canvasRef.current, result.history, result.prediction);
    }
  }, [result, batchResults, tab]);

  useEffect(() => {
    const handleResize = () => {
      if (!canvasRef.current) return;
      if (tab === 'batch' && batchResults.length > 0) {
        drawBatchChart(canvasRef.current, batchResults);
      } else if (result) {
        drawKlineChart(canvasRef.current, result.history, result.prediction);
      }
    };
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, [result, batchResults, tab]);

  // CSV file handler
  const handleCsvFile = useCallback((file: File | null) => {
    setCsvFile(file);
    if (!file) { setCsvPreview([]); return; }
    const reader = new FileReader();
    reader.onload = (e) => {
      const text = e.target?.result as string;
      setCsvPreview(text.split('\n').slice(0, 6));
    };
    reader.readAsText(file);
  }, []);

  // Predict handlers
  const handleSinglePredict = useCallback(async () => {
    setLoading(true); setError(null);
    try {
      const params: PredictionParams = {
        symbol, lookback, pred_len: predLen, temperature, top_p: topP,
        model, sample_count: sampleCount, include_volume: includeVolume,
      };
      const res = await fetchPrediction(params);
      setResult(res);
      setBatchResults([]);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Prediction failed');
    } finally {
      setLoading(false);
    }
  }, [symbol, lookback, predLen, temperature, topP, model, sampleCount, includeVolume]);

  const handleBatchPredict = useCallback(async () => {
    if (batchSymbols.length === 0) { setError('Please select at least one symbol'); return; }
    setLoading(true); setError(null);
    try {
      const params: BatchPredictionParams = {
        symbols: batchSymbols, lookback, pred_len: predLen, temperature, top_p: topP,
        model, sample_count: sampleCount, include_volume: includeVolume,
      };
      const res = await fetchBatchPrediction(params);
      setBatchResults(res.results);
      setResult(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Batch prediction failed');
    } finally {
      setLoading(false);
    }
  }, [batchSymbols, lookback, predLen, temperature, topP, model, sampleCount, includeVolume]);

  const handleCsvPredict = useCallback(async () => {
    if (!csvFile) { setError('Please upload a CSV file first'); return; }
    setLoading(true); setError(null);
    try {
      const res = await uploadCsvPredict(csvFile, {
        pred_len: predLen, lookback, temperature, top_p: topP,
        model, sample_count: sampleCount, include_volume: includeVolume,
      });
      setResult(res);
      setBatchResults([]);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'CSV prediction failed');
    } finally {
      setLoading(false);
    }
  }, [csvFile, lookback, predLen, temperature, topP, model, sampleCount, includeVolume]);

  const handlePredict = tab === 'single' ? handleSinglePredict : tab === 'batch' ? handleBatchPredict : handleCsvPredict;

  const stats = result ? computeStats(result.history, result.prediction) : null;
  const showChart = tab === 'batch' ? batchResults.length > 0 : result !== null;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="font-display text-3xl font-bold tracking-tight text-text">AI K 线预测</h1>
        <p className="mt-2 text-sm text-muted">
          基于 Kronos 基础模型的金融 K 线数据预测 · 自回归 Transformer + 分层量化
        </p>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 rounded-xl border border-border bg-card p-1">
        {([
          ['single', '单交易对'],
          ['batch', '多交易对对比'],
          ['csv', 'CSV 上传'],
        ] as [TabKey, string][]).map(([key, label]) => (
          <button
            key={key}
            type="button"
            onClick={() => setTab(key)}
            className={`flex-1 rounded-lg px-4 py-2 text-sm font-medium transition ${
              tab === key
                ? 'bg-accent text-white shadow-sm'
                : 'text-muted hover:bg-bg hover:text-text'
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      {/* Control Panel */}
      <div className="rounded-2xl border border-border bg-card p-5 shadow-card">
        {/* Symbol selectors per tab */}
        {tab === 'single' && (
          <div className="mb-4">
            <label className="mb-1 block text-xs font-medium text-muted">交易对</label>
            <select
              value={symbol}
              onChange={(e) => setSymbol(e.target.value)}
              className="w-full rounded-lg border border-border bg-bg px-3 py-2 text-sm text-text focus:border-accent focus:outline-none sm:w-auto"
            >
              {symbols.map((s) => (
                <option key={s.symbol} value={s.symbol}>{s.name}</option>
              ))}
            </select>
          </div>
        )}

        {tab === 'batch' && (
          <div className="mb-4">
            <label className="mb-1 block text-xs font-medium text-muted">选择交易对 (可多选)</label>
            <div className="flex flex-wrap gap-3">
              {symbols.map((s) => (
                <label key={s.symbol} className="flex cursor-pointer items-center gap-2 rounded-lg border border-border px-3 py-2 text-sm transition hover:border-accent">
                  <input
                    type="checkbox"
                    checked={batchSymbols.includes(s.symbol)}
                    onChange={(e) => {
                      if (e.target.checked) setBatchSymbols([...batchSymbols, s.symbol]);
                      else setBatchSymbols(batchSymbols.filter((x) => x !== s.symbol));
                    }}
                    className="h-4 w-4 accent-accent"
                  />
                  <span className="text-text">{s.name}</span>
                </label>
              ))}
            </div>
          </div>
        )}

        {tab === 'csv' && (
          <div className="mb-4">
            <label className="mb-1 block text-xs font-medium text-muted">上传 CSV 文件</label>
            <div
              className="flex min-h-[80px] cursor-pointer items-center justify-center rounded-xl border-2 border-dashed border-border bg-bg p-4 text-sm text-muted transition hover:border-accent"
              onDragOver={(e) => e.preventDefault()}
              onDrop={(e) => {
                e.preventDefault();
                const f = e.dataTransfer.files[0];
                if (f) handleCsvFile(f);
              }}
              onClick={() => {
                const input = document.createElement('input');
                input.type = 'file';
                input.accept = '.csv';
                input.onchange = () => {
                  if (input.files?.[0]) handleCsvFile(input.files[0]);
                };
                input.click();
              }}
            >
              {csvFile ? (
                <span className="text-text">{csvFile.name} ({(csvFile.size / 1024).toFixed(1)} KB)</span>
              ) : (
                <span>拖放 CSV 文件到此处，或点击选择<br /><span className="text-xs">需包含 open, high, low, close 列 (可选: volume, timestamps)</span></span>
              )}
            </div>
            {csvPreview.length > 0 && (
              <div className="mt-2 overflow-x-auto rounded-lg border border-border bg-bg p-2 font-mono text-xs text-muted">
                {csvPreview.map((line, i) => (
                  <div key={i} className={i === 0 ? 'font-semibold text-text' : ''}>{line}</div>
                ))}
                {csvPreview.length >= 6 && <div>...</div>}
              </div>
            )}
          </div>
        )}

        {/* Shared params */}
        <ControlPanel
          models={models}
          model={model} setModel={setModel}
          lookback={lookback} setLookback={setLookback}
          predLen={predLen} setPredLen={setPredLen}
          temperature={temperature} setTemperature={setTemperature}
          topP={topP} setTopP={setTopP}
          sampleCount={sampleCount} setSampleCount={setSampleCount}
          includeVolume={includeVolume} setIncludeVolume={setIncludeVolume}
        />

        <button
          type="button"
          onClick={handlePredict}
          disabled={loading}
          className="mt-4 w-full rounded-xl bg-accent px-6 py-2.5 text-sm font-semibold text-white transition hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50 sm:w-auto"
        >
          {loading ? '预测中...' : '开始预测'}
        </button>
      </div>

      {/* Error */}
      {error && (
        <div className="rounded-xl border border-red-300 bg-red-50 px-4 py-3 text-sm text-red-700 dark:border-red-800 dark:bg-red-900/20 dark:text-red-400">
          {error}
        </div>
      )}

      {/* Chart */}
      <div className="rounded-2xl border border-border bg-card p-4 shadow-card">
        {showChart ? (
          <canvas ref={canvasRef} className="h-[420px] w-full" style={{ display: 'block' }} />
        ) : (
          <div className="flex h-[420px] items-center justify-center text-sm text-muted">
            {loading ? <Spinner text="正在加载预测结果..." /> : '选择参数并点击「开始预测」查看 K 线预测结果'}
          </div>
        )}
      </div>

      {/* Stats - single mode */}
      {tab !== 'batch' && stats && result && (
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-6">
          <StatCard label="起始价" value={`$${stats.startPrice.toFixed(2)}`} />
          <StatCard label="预测终价" value={`$${stats.endPrice.toFixed(2)}`} />
          <StatCard
            label="变化"
            value={`${stats.change >= 0 ? '+' : ''}${stats.change.toFixed(2)}`}
            color={stats.change >= 0 ? 'text-green-500' : 'text-red-500'}
          />
          <StatCard
            label="变化率"
            value={`${stats.changePct >= 0 ? '+' : ''}${stats.changePct.toFixed(2)}%`}
            color={stats.changePct >= 0 ? 'text-green-500' : 'text-red-500'}
          />
          <StatCard label="预测最高" value={`$${stats.high.toFixed(2)}`} />
          <StatCard label="预测最低" value={`$${stats.low.toFixed(2)}`} />
        </div>
      )}

      {/* Stats - batch mode */}
      {tab === 'batch' && batchResults.length > 0 && (
        <div className="space-y-3">
          {batchResults.map((r) => {
            const s = computeStats(r.history, r.prediction);
            if (!s) return null;
            return (
              <div key={r.symbol} className="rounded-xl border border-border bg-card p-4 shadow-card">
                <div className="mb-2 text-sm font-semibold text-text">{r.symbol}</div>
                <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                  <div className="text-xs text-muted">起始: <span className="font-mono text-text">${s.startPrice.toFixed(2)}</span></div>
                  <div className="text-xs text-muted">终价: <span className="font-mono text-text">${s.endPrice.toFixed(2)}</span></div>
                  <div className="text-xs text-muted">
                    变化率: <span className={`font-mono ${s.changePct >= 0 ? 'text-green-500' : 'text-red-500'}`}>
                      {s.changePct >= 0 ? '+' : ''}{s.changePct.toFixed(2)}%
                    </span>
                  </div>
                  <div className="text-xs text-muted">区间: <span className="font-mono text-text">${s.low.toFixed(2)} - ${s.high.toFixed(2)}</span></div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Model info */}
      {(result || batchResults.length > 0) && (
        <div className="rounded-xl border border-border bg-card/60 px-4 py-3 text-xs text-muted">
          模型: Kronos-{result?.model_name ?? batchResults[0]?.model_name ?? model} ·
          Tokenizer: BSQ 分层量化 ·
          模式: {(result?.model_loaded ?? batchResults[0]?.model_loaded) ? '实时推理' : '模拟数据'} ·
          采样路径: {sampleCount} ·
          {includeVolume ? '含成交量' : '仅价格'}
        </div>
      )}
    </div>
  );
}
