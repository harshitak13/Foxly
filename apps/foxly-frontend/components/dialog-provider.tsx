"use client";

import React, { createContext, useContext, useState, ReactNode, useCallback } from "react";

// ─── Types ────────────────────────────────────────────────────────────────────

export type DialogVariant = "error" | "warning" | "info" | "confirm";

interface DialogOptions {
  title?: string;
  message: string;
  confirmText?: string;
  cancelText?: string;
  /** Visual style. error=red, warning=amber, info=primary-tinted, confirm=neutral. */
  variant?: DialogVariant;
  /** @deprecated – kept for back-compat; maps to variant:"error" when true */
  isDanger?: boolean;
}

type DialogType = "alert" | "confirm";

interface DialogState extends DialogOptions {
  id: string;
  type: DialogType;
  resolve: (value: any) => void;
}

interface DialogContextValue {
  alert: (options: DialogOptions | string) => Promise<void>;
  confirm: (options: DialogOptions | string) => Promise<boolean>;
}

// ─── Context ──────────────────────────────────────────────────────────────────

const DialogContext = createContext<DialogContextValue | null>(null);

export function useDialog() {
  const ctx = useContext(DialogContext);
  if (!ctx) throw new Error("useDialog must be used within a DialogProvider");
  return ctx;
}

// ─── Visual config per variant ────────────────────────────────────────────────

type VariantConfig = {
  icon: string;
  /** Tailwind classes for the icon badge */
  badge: string;
  /** Tailwind classes for the left accent strip */
  strip: string;
  /** Default title */
  defaultTitle: string;
};

const VARIANTS: Record<DialogVariant, VariantConfig> = {
  error: {
    icon: "❌",
    badge: "bg-red-50 text-red-700 text-sm",
    strip: "bg-red-500",
    defaultTitle: "Error",
  },
  warning: {
    icon: "⚠️",
    badge: "bg-amber-50 text-amber-700 text-sm",
    strip: "bg-amber-500",
    defaultTitle: "Warning",
  },
  info: {
    icon: "ℹ️",
    badge: "bg-orange-50 text-[#a03b00] text-sm",
    strip: "bg-[#a03b00]",
    defaultTitle: "Info",
  },
  confirm: {
    icon: "❓",
    badge: "bg-orange-50 text-[#a03b00] text-sm",
    strip: "bg-[#a03b00]",
    defaultTitle: "Confirm",
  },
};

function resolveVariant(opts: DialogOptions, type: DialogType): DialogVariant {
  if (opts.variant) return opts.variant;
  if (opts.isDanger) return "error";
  return type === "confirm" ? "confirm" : "info";
}

// ─── Provider ─────────────────────────────────────────────────────────────────

export function DialogProvider({ children }: { children: ReactNode }) {
  const [dialogs, setDialogs] = useState<DialogState[]>([]);

  const alert = useCallback((options: DialogOptions | string): Promise<void> => {
    return new Promise((resolve) => {
      const opts = typeof options === "string" ? { message: options } : options;
      setDialogs((prev) => [
        ...prev,
        { ...opts, id: crypto.randomUUID(), type: "alert", resolve: () => resolve() },
      ]);
    });
  }, []);

  const confirm = useCallback((options: DialogOptions | string): Promise<boolean> => {
    return new Promise((resolve) => {
      const opts = typeof options === "string" ? { message: options } : options;
      setDialogs((prev) => [
        ...prev,
        { ...opts, id: crypto.randomUUID(), type: "confirm", resolve },
      ]);
    });
  }, []);

  const closeDialog = (id: string, result: boolean = false) => {
    setDialogs((prev) => {
      const dialog = prev.find((d) => d.id === id);
      if (dialog) dialog.resolve(result);
      return prev.filter((d) => d.id !== id);
    });
  };

  return (
    <DialogContext.Provider value={{ alert, confirm }}>
      {children}

      {dialogs.map((dialog) => {
        const variant = resolveVariant(dialog, dialog.type);
        const cfg = VARIANTS[variant];
        const title = dialog.title ?? cfg.defaultTitle;
        const isDestructive = variant === "error";

        return (
          /* Backdrop — solid dark scrim so the card is never transparent */
          <div
            key={dialog.id}
            className="fixed inset-0 z-[100] flex items-end sm:items-center justify-center sm:p-4 bg-black/50 backdrop-blur-[2px] animate-in fade-in duration-150"
            onClick={(e) => {
              // Allow closing info/alert by clicking outside; never for confirm
              if (dialog.type === "alert" && e.target === e.currentTarget)
                closeDialog(dialog.id, false);
            }}
          >
            {/* Card — always solid white, shadow provides depth */}
            <div
              className="
                relative overflow-hidden
                bg-white
                w-full sm:max-w-md
                rounded-t-2xl sm:rounded-2xl
                shadow-2xl
                border border-gray-200
                flex flex-col
                animate-in slide-in-from-bottom-4 sm:zoom-in-95 duration-200
              "
              role="dialog"
              aria-modal="true"
              aria-labelledby={`dialog-title-${dialog.id}`}
            >
              {/* Coloured left accent strip (visible on sm+) / top strip (mobile) */}
              <div className={`absolute left-0 top-0 h-full w-1 ${cfg.strip} hidden sm:block`} />
              <div className={`absolute top-0 left-0 w-full h-1 ${cfg.strip} sm:hidden`} />

              {/* Body */}
              <div className="flex items-start gap-4 p-6 sm:pl-8">
                {/* Icon badge */}
                <div
                  className={`w-10 h-10 rounded-full flex items-center justify-center shrink-0 border border-gray-100 shadow-sm ${cfg.badge}`}
                >
                  <span className="select-none text-base leading-none">{cfg.icon}</span>
                </div>

                {/* Text */}
                <div className="flex-1 min-w-0">
                  <h3
                    id={`dialog-title-${dialog.id}`}
                    className="text-base font-bold text-gray-900 font-display"
                  >
                    {title}
                  </h3>
                  <p className="mt-1.5 text-sm text-gray-600 whitespace-pre-wrap leading-relaxed">
                    {dialog.message}
                  </p>
                </div>
              </div>

              {/* Divider */}
              <div className="h-px bg-gray-100 mx-6" />

              {/* Actions */}
              <div className="flex justify-end items-center gap-3 px-6 py-4">
                {dialog.type === "confirm" && (
                  <button
                    onClick={() => closeDialog(dialog.id, false)}
                    className="px-4 py-2 rounded-lg text-sm font-semibold text-gray-600 hover:bg-gray-100 transition-colors active:scale-95"
                  >
                    {dialog.cancelText ?? "Cancel"}
                  </button>
                )}

                <button
                  onClick={() => closeDialog(dialog.id, true)}
                  className={`
                    px-5 py-2 rounded-lg text-sm font-semibold text-white transition-all active:scale-95
                    ${isDestructive
                      ? "bg-red-600 hover:bg-red-700 shadow-sm shadow-red-200"
                      : "bg-[#a03b00] hover:bg-[#8a3200] shadow-sm shadow-orange-200"
                    }
                  `}
                >
                  {dialog.confirmText ?? (dialog.type === "confirm" ? "Confirm" : "OK")}
                </button>
              </div>
            </div>
          </div>
        );
      })}
    </DialogContext.Provider>
  );
}
