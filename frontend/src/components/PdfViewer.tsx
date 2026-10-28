import { useEffect, useRef } from "react";
import { ExternalLink, X } from "lucide-react";
import { invoicePdfUrl } from "../api/client";
import { IconButton } from "./ui";

/** Shows an uploaded invoice PDF at the cited page, using the browser's built-in PDF viewer. */
export function PdfViewer({ batchId, file, page, onClose }: { batchId: string; file: string; page?: number | null; onClose: () => void }) {
  const url = invoicePdfUrl(batchId, file, page);
  const panel = useRef<HTMLDivElement>(null);

  // Escape closes only this viewer, not the case drawer underneath it.
  useEffect(() => {
    const previous = document.activeElement as HTMLElement | null;
    panel.current?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== "Escape") return;
      e.stopImmediatePropagation();
      onClose();
    };
    window.addEventListener("keydown", onKey, true);
    return () => {
      window.removeEventListener("keydown", onKey, true);
      previous?.focus?.();
    };
  }, [onClose]);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 p-4" onClick={onClose}>
      <div
        ref={panel}
        role="dialog"
        aria-modal="true"
        aria-label={`${file}${page ? `, page ${page}` : ""}`}
        tabIndex={-1}
        className="flex h-[90vh] w-full max-w-4xl flex-col overflow-hidden rounded-xl bg-white shadow-2xl outline-none"
        onClick={(e) => e.stopPropagation()}
      >
        <header className="flex items-center gap-3 border-b border-slate-200 px-4 py-2.5">
          <span className="mono font-medium text-slate-900">{file}</span>
          {page && <span className="text-[13px] text-slate-500">cited page {page}</span>}
          <a href={url} target="_blank" rel="noreferrer"
             className="ml-auto inline-flex items-center gap-1 rounded text-[13px] font-medium text-teal-800 hover:underline">
            Open in new tab <ExternalLink aria-hidden className="h-3.5 w-3.5" />
          </a>
          <IconButton label="Close (Esc)" onClick={onClose}><X aria-hidden className="h-5 w-5" /></IconButton>
        </header>
        <iframe src={url} title={`Invoice ${file}`} className="flex-1 bg-slate-100" />
      </div>
    </div>
  );
}
