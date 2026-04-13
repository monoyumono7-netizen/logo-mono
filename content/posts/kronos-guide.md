---
title: "Kronos AI K 线预测 — 完整使用指南"
excerpt: "基于 Kronos 基础模型的金融 K 线数据预测功能使用文档，涵盖单交易对预测、批量对比、CSV 上传、模型选择和采样调优等全部功能。"
date: "2026-04-13"
tags:
  - AI
  - 金融
  - Kronos
  - 使用指南
---

# Kronos AI K 线预测 — 完整使用指南

本博客集成了 [Kronos](https://github.com/shiyu-coder/Kronos) 的 K 线预测能力。Kronos 是首个面向金融蜡烛图数据的开源基础模型，已被 **AAAI 2026** 接收，在 45+ 全球交易所数据上预训练。

访问博客的 **[AI 预测](/kronos)** 页面即可体验以下全部功能。

---

## 1. 快速开始

### 1.1 启动 Python 推理服务

```bash
cd kronos-api
pip install -r requirements.txt
uvicorn main:app --host 0.0.0.0 --port 8000
```

服务启动后会尝试从 HuggingFace Hub 加载 Kronos 模型。如果本地没有 GPU 或未安装 PyTorch，服务会自动降级到**模拟数据模式**，所有功能仍然可用（数据为模拟生成）。

### 1.2 启动博客

```bash
NEXT_PUBLIC_KRONOS_API_URL=http://localhost:8000 npm run dev
```

打开 `http://localhost:3000/kronos` 即可使用。

### 1.3 环境变量

| 变量 | 默认值 | 说明 |
|------|--------|------|
| `NEXT_PUBLIC_KRONOS_API_URL` | `http://localhost:8000` | Python 推理服务地址 |

---

## 2. 功能一：单交易对预测

这是最基础的功能 — 选择一个交易对，预测未来的 K 线走势。

### 操作步骤

1. 在页面顶部 Tab 选择「**单交易对**」
2. 选择交易对（如 Bitcoin / USDT）
3. 调整参数（见下文参数说明）
4. 点击「**开始预测**」

### 结果展示

- **K 线蜡烛图**：历史数据（绿红色）和预测数据（青红色）通过虚线分隔
- **成交量柱状图**：图表底部展示对应的成交量
- **统计卡片**：起始价、预测终价、变化额、变化率、预测最高/最低价

---

## 3. 功能二：模型选择

Kronos 提供三种不同规模的开源模型，可以在控制面板的「模型」下拉框中切换：

| 模型 | 参数量 | 上下文长度 | 适用场景 |
|------|--------|-----------|---------|
| **Kronos-mini** | 4.1M | 2048 | 轻量快速，适合实时预览 |
| **Kronos-small** | 24.7M | 512 | 平衡精度与速度，推荐默认使用 |
| **Kronos-base** | 102.3M | 512 | 最高精度，需要更多计算资源 |

所有模型均从 HuggingFace Hub 自动下载。如果某个模型未能加载，页面底部会显示「模拟数据」模式提示。

---

## 4. 功能三：采样参数调优

Kronos 使用自回归方式逐步生成预测，三个关键采样参数直接影响预测质量：

### Temperature (温度)

- **范围**：0.1 - 2.0，默认 1.0
- **低值 (0.1-0.5)**：预测更保守、更平滑，偏向高概率走势
- **高值 (1.5-2.0)**：预测更激进、波动更大，探索性更强
- **建议**：一般使用 0.8-1.2

### Top-p (核采样)

- **范围**：0.1 - 1.0，默认 0.9
- **低值 (0.1-0.5)**：只考虑最高概率的少数候选 token
- **高值 (0.9-1.0)**：考虑更多候选，预测多样性更高
- **建议**：保持 0.85-0.95

### 采样路径 (sample_count)

- **范围**：1 - 10，默认 1
- **作用**：模型同时生成多条预测路径，最终取平均值
- **值为 1**：单次采样，速度最快但可能有随机偏差
- **值为 5-10**：多次采样取平均，预测更稳定可靠，但耗时更长
- **建议**：快速预览用 1，正式分析用 3-5

---

## 5. 功能四：多交易对批量对比

同时预测多个交易对，在同一图表上对比走势。

### 操作步骤

1. 切换到「**多交易对对比**」Tab
2. 勾选要对比的交易对（支持全选）
3. 调整共享参数
4. 点击「**开始预测**」

### 图表说明

- 批量模式使用**折线图**（而非蜡烛图），Y 轴为**百分比变化**，方便不同价位的交易对直接对比
- 每个交易对用不同颜色标记，图表左上角显示图例
- 虚线右侧为预测区域
- 图表下方展示每个交易对的详细统计数据

---

## 6. 功能五：CSV 自定义数据上传

上传自己的 K 线数据进行预测，不受内置交易对限制。

### CSV 格式要求

**必需列：**

| 列名 | 类型 | 说明 |
|------|------|------|
| `open` | float | 开盘价 |
| `high` | float | 最高价 |
| `low` | float | 最低价 |
| `close` | float | 收盘价 |

**可选列：**

| 列名 | 类型 | 说明 |
|------|------|------|
| `volume` | float | 成交量（不提供则填 0） |
| `amount` | float | 成交额（不提供则填 0） |
| `timestamps` | datetime | 时间戳（不提供则自动生成 5 分钟间隔） |

也支持列名为 `timestamp` 或 `date` 的时间列。

### 操作步骤

1. 切换到「**CSV 上传**」Tab
2. 将 CSV 文件拖放到上传区域，或点击选择文件
3. 上传后可以预览前几行数据，确认格式正确
4. 调整参数后点击「**开始预测**」

### 示例 CSV

```csv
timestamps,open,high,low,close,volume
2025-12-01 00:00:00,96000.00,96285.12,95820.50,96150.30,2.5
2025-12-01 00:05:00,96150.30,96400.00,96050.10,96320.80,3.1
2025-12-01 00:10:00,96320.80,96500.50,96200.00,96450.20,2.8
```

---

## 7. 功能六：无量价预测模式

取消勾选控制面板中的「**包含成交量**」复选框即可启用。

### 何时使用

- 数据源不提供成交量信息
- 只关心价格走势，不需要量价分析
- 减少输入维度，加快推理速度

启用后，模型仅使用 OHLC（开高低收）四列数据进行预测，输出也不包含成交量信息。

---

## 8. 技术架构

Kronos 采用两阶段框架：

```
原始 K 线 (OHLCV)
       │
       ▼
┌─────────────────┐
│ KronosTokenizer │  阶段 1：编码 + 量化
│ Encoder → BSQ   │  将连续浮点数据量化为二进制 token
│ → Decoder       │  分为 s1(粗粒度) + s2(细粒度)
└─────────────────┘
       │
       ▼
┌─────────────────┐
│ Kronos Model    │  阶段 2：自回归预测
│ HierarchicalEmb │  分层嵌入 + 时间嵌入
│ Transformer     │  Decoder-only + RoPE
│ DualHead        │  先预测 s1，再条件预测 s2
└─────────────────┘
       │
       ▼
  预测的 K 线数据
```

### 核心组件

- **Binary Spherical Quantization (BSQ)**：将连续向量映射为二进制码，带熵正则化确保码本利用率
- **Hierarchical Embedding**：s1 和 s2 两级 token 分别嵌入后融合
- **Temporal Embedding**：注入分钟/小时/星期/日/月时间特征
- **RoPE (旋转位置编码)**：增强序列位置感知
- **DependencyAwareLayer**：s2 的解码依赖 s1 的采样结果（条件生成）
- **DualHead**：双头输出，分别预测粗粒度和细粒度 token

---

## 9. API 参考

Python 推理服务提供以下 REST API 接口：

### GET /api/symbols

返回可用交易对列表。

**响应：**

```json
[
  { "symbol": "BTC_USDT", "name": "Bitcoin / USDT", "bars": 600 },
  { "symbol": "ETH_USDT", "name": "Ethereum / USDT", "bars": 600 }
]
```

### GET /api/models

返回可用模型列表及加载状态。

**响应：**

```json
[
  { "name": "mini", "params": "4.1M", "max_context": 2048, "loaded": false },
  { "name": "small", "params": "24.7M", "max_context": 512, "loaded": true },
  { "name": "base", "params": "102.3M", "max_context": 512, "loaded": false }
]
```

### POST /api/predict

单交易对预测。

**请求体：**

| 字段 | 类型 | 默认值 | 说明 |
|------|------|--------|------|
| `symbol` | string | "BTC_USDT" | 交易对 |
| `lookback` | int | 400 | 历史窗口 (50-600) |
| `pred_len` | int | 120 | 预测长度 (10-200) |
| `temperature` | float | 1.0 | 温度 (0.1-2.0) |
| `top_p` | float | 0.9 | 核采样 (0.1-1.0) |
| `model` | string | "small" | 模型: mini/small/base |
| `sample_count` | int | 1 | 采样路径数 (1-10) |
| `include_volume` | bool | true | 是否包含成交量 |

**响应：**

```json
{
  "symbol": "BTC_USDT",
  "interval": "5min",
  "model_name": "small",
  "model_loaded": true,
  "history": [{ "timestamp": "...", "open": 96000, "high": 96285, "low": 95820, "close": 96150, "volume": 2.5 }],
  "prediction": [{ "timestamp": "...", "open": 96150, "high": 96400, "low": 96050, "close": 96320, "volume": 3.1 }]
}
```

### POST /api/predict-batch

多交易对批量预测。

**请求体：**

与 `/api/predict` 相同，但 `symbol` 替换为 `symbols: string[]`（最多 10 个）。

**响应：**

```json
{
  "results": [
    { "symbol": "BTC_USDT", "interval": "5min", "model_name": "small", ... },
    { "symbol": "ETH_USDT", "interval": "5min", "model_name": "small", ... }
  ]
}
```

### POST /api/predict-csv

上传 CSV 文件预测（multipart/form-data）。

**表单字段：**

| 字段 | 类型 | 说明 |
|------|------|------|
| `file` | File | CSV 文件 |
| `pred_len` | int | 预测长度 |
| `lookback` | int | 历史窗口 |
| `temperature` | float | 温度 |
| `top_p` | float | 核采样 |
| `model` | string | 模型名 |
| `sample_count` | int | 采样路径数 |
| `include_volume` | bool | 是否包含成交量 |

**响应：** 与 `/api/predict` 格式相同。

### GET /health

服务健康检查。

```json
{
  "status": "ok",
  "model_loaded": true,
  "loaded_models": ["small"]
}
```

---

## 10. 注意事项

- Kronos 的预测结果仅供研究和学习参考，**不构成任何投资建议**
- 模拟数据模式下的预测结果为随机生成，不代表模型真实能力
- 实际部署建议使用 GPU 服务器以获得合理的推理速度
- 上传的 CSV 数据仅在服务端内存中临时处理，不会持久化存储
