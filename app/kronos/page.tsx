import type { Metadata } from 'next';

import { KronosDemo } from '@/components/kronos-demo';

export const metadata: Metadata = {
  title: 'AI K 线预测',
  description: '基于 Kronos 基础模型的金融 K 线数据预测 — 自回归 Transformer + 分层量化',
};

export default function KronosPage(): JSX.Element {
  return <KronosDemo />;
}
