const KRONOS_API_URL = process.env.NEXT_PUBLIC_KRONOS_API_URL ?? 'http://localhost:8000';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------
export interface KlineBar {
  timestamp: string;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
}

export interface PredictionResult {
  symbol: string;
  interval: string;
  model_name: string;
  model_loaded: boolean;
  history: KlineBar[];
  prediction: KlineBar[];
}

export interface PredictionParams {
  symbol: string;
  lookback: number;
  pred_len: number;
  temperature: number;
  top_p: number;
  model: string;
  sample_count: number;
  include_volume: boolean;
}

export interface BatchPredictionParams {
  symbols: string[];
  lookback: number;
  pred_len: number;
  temperature: number;
  top_p: number;
  model: string;
  sample_count: number;
  include_volume: boolean;
}

export interface BatchPredictionResult {
  results: PredictionResult[];
}

export interface SymbolInfo {
  symbol: string;
  name: string;
  bars: number;
}

export interface ModelInfo {
  name: string;
  params: string;
  max_context: number;
  loaded: boolean;
}

// ---------------------------------------------------------------------------
// API functions
// ---------------------------------------------------------------------------
export async function fetchSymbols(): Promise<SymbolInfo[]> {
  const res = await fetch(`${KRONOS_API_URL}/api/symbols`);
  if (!res.ok) throw new Error(`Failed to fetch symbols: ${res.status}`);
  return res.json();
}

export async function fetchModels(): Promise<ModelInfo[]> {
  const res = await fetch(`${KRONOS_API_URL}/api/models`);
  if (!res.ok) throw new Error(`Failed to fetch models: ${res.status}`);
  return res.json();
}

export async function fetchPrediction(params: PredictionParams): Promise<PredictionResult> {
  const res = await fetch(`${KRONOS_API_URL}/api/predict`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(params),
  });
  if (!res.ok) {
    const detail = await res.text().catch(() => 'Unknown error');
    throw new Error(`Prediction failed (${res.status}): ${detail}`);
  }
  return res.json();
}

export async function fetchBatchPrediction(params: BatchPredictionParams): Promise<BatchPredictionResult> {
  const res = await fetch(`${KRONOS_API_URL}/api/predict-batch`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(params),
  });
  if (!res.ok) {
    const detail = await res.text().catch(() => 'Unknown error');
    throw new Error(`Batch prediction failed (${res.status}): ${detail}`);
  }
  return res.json();
}

export async function uploadCsvPredict(
  file: File,
  params: {
    pred_len: number;
    lookback: number;
    temperature: number;
    top_p: number;
    model: string;
    sample_count: number;
    include_volume: boolean;
  },
): Promise<PredictionResult> {
  const form = new FormData();
  form.append('file', file);
  form.append('pred_len', String(params.pred_len));
  form.append('lookback', String(params.lookback));
  form.append('temperature', String(params.temperature));
  form.append('top_p', String(params.top_p));
  form.append('model', params.model);
  form.append('sample_count', String(params.sample_count));
  form.append('include_volume', String(params.include_volume));

  const res = await fetch(`${KRONOS_API_URL}/api/predict-csv`, {
    method: 'POST',
    body: form,
  });
  if (!res.ok) {
    const detail = await res.text().catch(() => 'Unknown error');
    throw new Error(`CSV prediction failed (${res.status}): ${detail}`);
  }
  return res.json();
}
