import React, { useState, useCallback } from 'react';
import { Copy, Check } from 'lucide-react';

// Consistent timeout for copy feedback across all copy buttons
const COPY_FEEDBACK_TIMEOUT = 2000;

// Custom hook for copy-to-clipboard functionality
function useCopyToClipboard() {
  const [copied, setCopied] = useState(false);

  const handleCopy = useCallback(async (text, e) => {
    if (e) e.stopPropagation();
    await navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), COPY_FEEDBACK_TIMEOUT);
  }, []);

  return { copied, handleCopy };
}

// Full copy button with label (used in query cards)
export function CopyButton({ text }) {
  const { copied, handleCopy } = useCopyToClipboard();

  return (
    <button
      onClick={(e) => handleCopy(text, e)}
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

// Compact copy button (used in table cells)
export function CellCopyButton({ text }) {
  const { copied, handleCopy } = useCopyToClipboard();

  return (
    <button
      onClick={(e) => handleCopy(text, e)}
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
