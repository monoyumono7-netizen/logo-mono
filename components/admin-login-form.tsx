'use client';

import { useState } from 'react';

export function AdminLoginForm(): JSX.Element {
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const onSubmit = async (event: React.FormEvent<HTMLFormElement>): Promise<void> => {
    event.preventDefault();
    if (!password.trim()) {
      setError('请输入密码');
      return;
    }

    setLoading(true);
    setError('');
    try {
      const response = await fetch('/api/admin/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ password })
      });
      const data = (await response.json()) as { readonly ok?: boolean; readonly message?: string };
      if (!response.ok || !data.ok) {
        setError(data.message ?? '登录失败');
        return;
      }
      window.location.href = '/admin';
    } catch {
      setError('网络异常，请稍后重试');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="mx-auto w-full max-w-md rounded-2xl border border-border bg-card p-6 shadow-card">
      <h1 className="font-display text-2xl font-bold tracking-tight text-text">管理后台登录</h1>
      <p className="mt-2 text-sm text-muted">请输入 ADMIN_PASSWORD 进入后台。</p>
      <form className="mt-5 space-y-3" onSubmit={onSubmit}>
        <label className="block text-sm text-muted">
          密码
          <input
            type="password"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            className="mt-1 w-full rounded-lg border border-border bg-bg px-3 py-2 text-sm text-text outline-none ring-accent transition focus:ring-2"
            placeholder="请输入管理密码"
          />
        </label>
        {error ? <p className="rounded-lg border border-red-300/60 bg-red-50 px-3 py-2 text-sm text-red-600">{error}</p> : null}
        <button
          type="submit"
          disabled={loading}
          className="w-full rounded-lg bg-accent px-4 py-2 text-sm font-medium text-white transition hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-60"
        >
          {loading ? '登录中...' : '登录'}
        </button>
      </form>
    </div>
  );
}
