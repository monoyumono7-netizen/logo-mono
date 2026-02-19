'use client';

import codeSyntaxHighlight from '@toast-ui/editor-plugin-code-syntax-highlight';
import dynamic from 'next/dynamic';
import Prism from 'prismjs';
import { useEffect, useRef } from 'react';

import type { Editor as ToastReactEditor } from '@toast-ui/react-editor';

const ToastEditor = dynamic(() => import('@toast-ui/react-editor').then((module) => module.Editor), { ssr: false });

interface AdminMarkdownEditorProps {
  readonly value: string;
  readonly onChange: (value: string) => void;
}

interface MarkdownEditorInstance {
  getMarkdown: () => string;
  setMarkdown: (value: string) => void;
}

function isMarkdownEditorInstance(value: unknown): value is MarkdownEditorInstance {
  if (typeof value !== 'object' || value === null) {
    return false;
  }

  if (!('getMarkdown' in value) || !('setMarkdown' in value)) {
    return false;
  }

  const maybeGet = value.getMarkdown;
  const maybeSet = value.setMarkdown;
  return typeof maybeGet === 'function' && typeof maybeSet === 'function';
}

function getMarkdown(editorRef: React.MutableRefObject<ToastReactEditor | null>): string {
  const instance = editorRef.current?.getInstance();
  if (!isMarkdownEditorInstance(instance)) {
    return '';
  }
  return instance?.getMarkdown() ?? '';
}

function setMarkdown(editorRef: React.MutableRefObject<ToastReactEditor | null>, value: string): void {
  const instance = editorRef.current?.getInstance();
  if (!isMarkdownEditorInstance(instance)) {
    return;
  }
  if (instance.getMarkdown() === value) {
    return;
  }
  instance.setMarkdown(value);
}

export function AdminMarkdownEditor({ value, onChange }: AdminMarkdownEditorProps): JSX.Element {
  const editorRef = useRef<ToastReactEditor | null>(null);

  useEffect(() => {
    setMarkdown(editorRef, value);
  }, [value]);

  return (
    <div className="overflow-hidden rounded-xl border border-border bg-card">
      <ToastEditor
        ref={editorRef}
        initialValue={value}
        height="620px"
        initialEditType="markdown"
        previewStyle="vertical"
        useCommandShortcut
        plugins={[[codeSyntaxHighlight, { highlighter: Prism }]]}
        toolbarItems={[
          ['heading', 'bold', 'italic', 'strike'],
          ['hr', 'quote'],
          ['ul', 'ol', 'task', 'indent', 'outdent'],
          ['table', 'image', 'link'],
          ['code', 'codeblock'],
          ['scrollSync']
        ]}
        hooks={{
          addImageBlobHook(_blob: Blob | File, callback: (url: string, text: string) => void) {
            callback('https://placehold.co/1200x630?text=Upload+Image', '临时图片占位');
            return false;
          }
        }}
        onChange={() => {
          onChange(getMarkdown(editorRef));
        }}
      />
    </div>
  );
}
