import React, { useEffect, useId, useState } from 'react';
import mermaid from 'mermaid';
import { ExternalLink, Code, Eye, Copy, Check, Download } from 'lucide-react';

mermaid.initialize({
  startOnLoad: false,
  theme: 'default',
  securityLevel: 'loose',
  flowchart: {
    htmlLabels: true,
    curve: 'basis',
  },
});

interface MermaidDiagramProps {
  chart: string;
  title?: string;
  drawioUrl?: string;
  badgeType?: 'asis' | 'tobe' | 'neutral';
}

export const MermaidDiagram: React.FC<MermaidDiagramProps> = ({
  chart,
  title,
  drawioUrl,
  badgeType = 'neutral',
}) => {
  const uniqueId = useId().replace(/:/g, '');
  const [svgContent, setSvgContent] = useState<string>('');
  const [renderError, setRenderError] = useState<string | null>(null);
  const [showSource, setShowSource] = useState(false);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    let isMounted = true;
    const renderDiagram = async () => {
      if (!chart.trim()) return;
      try {
        setRenderError(null);
        const { svg } = await mermaid.render(`mermaid-${uniqueId}-${Date.now()}`, chart.trim());
        if (isMounted) {
          setSvgContent(svg);
        }
      } catch (_err) {
        if (isMounted) {
          setRenderError('Diagram syntax preview unavailable — open in draw.io or inspect Mermaid source.');
        }
      }
    };
    renderDiagram();
    return () => {
      isMounted = false;
    };
  }, [chart, uniqueId]);

  const handleCopy = async () => {
    await navigator.clipboard.writeText(chart);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleDownloadSvg = () => {
    if (!svgContent) return;
    const blob = new Blob([svgContent], { type: 'image/svg+xml;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    const safeName = (title || badgeType || 'process-flow').toLowerCase().replace(/[^a-z0-9]+/g, '-');
    a.href = url;
    a.download = `${safeName}.svg`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleDownloadPng = () => {
    if (!svgContent) return;
    const svgBlob = new Blob([svgContent], { type: 'image/svg+xml;charset=utf-8' });
    const url = URL.createObjectURL(svgBlob);
    const img = new Image();
    img.onload = () => {
      const canvas = document.createElement('canvas');
      const scale = 2;
      canvas.width = (img.width || 1200) * scale;
      canvas.height = (img.height || 800) * scale;
      const ctx = canvas.getContext('2d');
      if (ctx) {
        ctx.fillStyle = '#ffffff';
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
        const pngUrl = canvas.toDataURL('image/png');
        const a = document.createElement('a');
        const safeName = (title || badgeType || 'process-flow').toLowerCase().replace(/[^a-z0-9]+/g, '-');
        a.href = pngUrl;
        a.download = `${safeName}.png`;
        a.click();
      }
      URL.revokeObjectURL(url);
    };
    img.src = url;
  };

  return (
    <div className="my-4 rounded-lg border border-slate-800 bg-slate-900 overflow-hidden">
      <div className="flex flex-wrap items-center justify-between gap-3 px-4 py-3 bg-slate-900 border-b border-slate-800">
        <div className="flex items-center gap-2 text-xs text-slate-300">
          {badgeType === 'asis' && (
            <span className="font-semibold text-red-400">
              AS-IS Process Flow (Bottlenecks in Red)
            </span>
          )}
          {badgeType === 'tobe' && (
            <span className="font-semibold text-emerald-400">
              TO-BE Process Flow Image (Improvements in Green)
            </span>
          )}
          {badgeType !== 'neutral' && title && <span aria-hidden="true">·</span>}
          {title && <span className="font-medium text-slate-300">{title}</span>}
        </div>

        <div className="flex flex-wrap items-center gap-2 no-print">
          <button
            type="button"
            onClick={() => setShowSource((prev) => !prev)}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium bg-slate-800 hover:bg-slate-700 text-slate-200 transition-colors whitespace-nowrap shrink-0 cursor-pointer"
          >
            {showSource ? <Eye className="w-3.5 h-3.5" /> : <Code className="w-3.5 h-3.5" />}
            {showSource ? 'Diagram Image' : 'Mermaid Source'}
          </button>

          <button
            type="button"
            onClick={handleCopy}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium bg-slate-800 hover:bg-slate-700 text-slate-200 transition-colors whitespace-nowrap shrink-0 cursor-pointer"
          >
            {copied ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
            {copied ? 'Copied' : 'Copy Code'}
          </button>

          {svgContent && (
            <>
              <button
                type="button"
                onClick={handleDownloadPng}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium bg-slate-800 hover:bg-slate-700 text-slate-200 transition-colors whitespace-nowrap shrink-0 cursor-pointer"
              >
                <Download className="w-3.5 h-3.5" />
                Save PNG Image
              </button>
              <button
                type="button"
                onClick={handleDownloadSvg}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium bg-slate-800 hover:bg-slate-700 text-slate-200 transition-colors whitespace-nowrap shrink-0 cursor-pointer"
              >
                <Download className="w-3.5 h-3.5" />
                Save SVG
              </button>
            </>
          )}

          {drawioUrl && (
            <a
              href={drawioUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-md text-xs font-semibold bg-sky-500 hover:bg-sky-400 text-slate-950 transition-colors no-underline whitespace-nowrap shrink-0"
            >
              <ExternalLink className="w-3.5 h-3.5" />
              Open in draw.io
            </a>
          )}
        </div>
      </div>

      {showSource || renderError ? (
        <div className="p-4 bg-slate-950 overflow-x-auto">
          {renderError && (
            <p className="text-xs text-amber-400 mb-2">{renderError}</p>
          )}
          <pre className="text-xs font-mono text-slate-300 leading-relaxed whitespace-pre">
            {chart}
          </pre>
        </div>
      ) : (
        <div
          className="p-6 bg-white overflow-x-auto flex justify-center min-h-[200px]"
          dangerouslySetInnerHTML={{ __html: svgContent }}
        />
      )}
    </div>
  );
};
