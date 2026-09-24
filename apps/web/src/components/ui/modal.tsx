"use client";

import type { ReactNode } from "react";

import { X } from "lucide-react";

interface ModalProps {
  open: boolean;

  title: string;

  description?: string;

  children: ReactNode;

  onClose: () => void;
}

export function Modal({
  open,
  title,
  description,
  children,
  onClose,
}: ModalProps) {
  if (!open) {
    return null;
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <button
        type="button"
        aria-label="Close dialog"
        className="absolute inset-0 bg-slate-950/40 backdrop-blur-[1px]"
        onClick={onClose}
      />

      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="modal-title"
        className="relative z-10 w-full max-w-lg rounded-xl border border-slate-200 bg-white shadow-xl"
      >
        <div className="flex items-start justify-between border-b border-slate-100 p-5">
          <div>
            <h2 id="modal-title" className="font-semibold text-slate-950">
              {title}
            </h2>

            {description && (
              <p className="mt-1 text-sm text-slate-500">{description}</p>
            )}
          </div>

          <button
            type="button"
            onClick={onClose}
            className="rounded-md p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-700"
          >
            <X size={18} />
          </button>
        </div>

        <div className="p-5">{children}</div>
      </div>
    </div>
  );
}
