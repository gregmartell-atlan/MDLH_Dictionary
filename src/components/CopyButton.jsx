import React, { useState } from 'react';
import { Copy, Check } from 'lucide-react';

export function CopyButton({ text }) {
  const [copied, setCopied] = useState(false);

  const handleCopy = async (e) => {
    e.stopPropagation();
    await navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <button
      onClick={handleCopy}
      className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-full transition-all duration-200 ${
        copied
          ? 'bg-green-500 text-white'
          : 'bg-white border border-gray-200 text-gray-600 hover:border-[#3366FF] hover:text-[#3366FF]'
      }`}
      title="Copy to clipboard"
    >
      {copied ? (
        <>
          <Check size={12} />
          <span>Copied!</span>
        </>
      ) : (
        <>
          <Copy size={12} />
          <span>Copy</span>
        </>
      )}
    </button>
  );
}

export function CellCopyButton({ text }) {
  const [copied, setCopied] = useState(false);

  const handleCopy = async (e) => {
    e.stopPropagation();
    await navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };

  return (
    <button
      onClick={handleCopy}
      className={`ml-1.5 opacity-0 group-hover:opacity-100 inline-flex items-center justify-center w-5 h-5 rounded transition-all duration-150 ${
        copied
          ? 'bg-green-500 text-white'
          : 'bg-gray-200 hover:bg-[#3366FF] text-gray-500 hover:text-white'
      }`}
      title="Copy"
    >
      {copied ? <Check size={10} /> : <Copy size={10} />}
    </button>
  );
}
