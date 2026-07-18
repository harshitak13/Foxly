"use client";

import React, { createContext, useContext, useState, ReactNode, useCallback } from "react";

type DialogType = "alert" | "confirm";

interface DialogOptions {
  title?: string;
  message: string;
  confirmText?: string;
  cancelText?: string;
  isDanger?: boolean; // Changes the confirm button to red
}

interface DialogState extends DialogOptions {
  id: string;
  type: DialogType;
  resolve: (value: any) => void;
}

interface DialogContextValue {
  alert: (options: DialogOptions | string) => Promise<void>;
  confirm: (options: DialogOptions | string) => Promise<boolean>;
}

const DialogContext = createContext<DialogContextValue | null>(null);

export function useDialog() {
  const context = useContext(DialogContext);
  if (!context) {
    throw new Error("useDialog must be used within a DialogProvider");
  }
  return context;
}

export function DialogProvider({ children }: { children: ReactNode }) {
  const [dialogs, setDialogs] = useState<DialogState[]>([]);

  const alert = useCallback((options: DialogOptions | string): Promise<void> => {
    return new Promise((resolve) => {
      const opts = typeof options === "string" ? { message: options } : options;
      setDialogs((prev) => [
        ...prev,
        {
          ...opts,
          id: crypto.randomUUID(),
          type: "alert",
          resolve: () => resolve(),
        },
      ]);
    });
  }, []);

  const confirm = useCallback((options: DialogOptions | string): Promise<boolean> => {
    return new Promise((resolve) => {
      const opts = typeof options === "string" ? { message: options } : options;
      setDialogs((prev) => [
        ...prev,
        {
          ...opts,
          id: crypto.randomUUID(),
          type: "confirm",
          resolve,
        },
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
      {dialogs.map((dialog) => (
        <div
          key={dialog.id}
          className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-on-surface/20 backdrop-blur-sm animate-in fade-in duration-200"
        >
          <div
            className="bg-surface-container-lowest rounded-2xl shadow-xl border border-outline-variant p-6 w-full max-w-md flex flex-col gap-4 animate-in zoom-in-95 duration-200"
            role="dialog"
            aria-modal="true"
          >
            <div className="flex items-start gap-4">
              <div
                className={`w-10 h-10 rounded-full flex items-center justify-center shrink-0 ${
                  dialog.isDanger ? "bg-error-container text-error" : "bg-primary-container/20 text-primary"
                }`}
              >
                <span className="material-symbols-outlined">
                  {dialog.type === "confirm" ? "help" : dialog.isDanger ? "error" : "info"}
                </span>
              </div>
              <div className="flex-1 mt-1">
                <h3 className="font-headline-md text-on-surface text-lg font-bold">
                  {dialog.title || (dialog.type === "confirm" ? "Confirm" : "Alert")}
                </h3>
                <p className="font-body-md text-on-surface-variant mt-2 whitespace-pre-wrap">
                  {dialog.message}
                </p>
              </div>
            </div>
            
            <div className="flex justify-end gap-3 mt-2">
              {dialog.type === "confirm" && (
                <button
                  onClick={() => closeDialog(dialog.id, false)}
                  className="px-4 py-2 rounded-lg font-label-md text-on-surface-variant hover:bg-surface-container-low transition-colors"
                >
                  {dialog.cancelText || "Cancel"}
                </button>
              )}
              <button
                onClick={() => closeDialog(dialog.id, true)}
                className={`px-4 py-2 rounded-lg font-label-md transition-colors ${
                  dialog.isDanger
                    ? "bg-error text-white hover:bg-error/90"
                    : "bg-primary text-white hover:bg-primary/90"
                }`}
              >
                {dialog.confirmText || "OK"}
              </button>
            </div>
          </div>
        </div>
      ))}
    </DialogContext.Provider>
  );
}
