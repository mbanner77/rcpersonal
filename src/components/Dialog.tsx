"use client";
import { useEffect, useRef, type ReactNode } from "react";

interface DialogProps {
  open: boolean;
  onClose: () => void;
  title: string;
  subtitle?: string;
  icon?: ReactNode;
  iconColor?: "indigo" | "emerald" | "amber" | "rose" | "purple" | "cyan" | "zinc";
  size?: "sm" | "md" | "lg" | "xl";
  children: ReactNode;
  footer?: ReactNode;
}

const sizeClasses = {
  sm: "max-w-sm",
  md: "max-w-md",
  lg: "max-w-lg",
  xl: "max-w-2xl",
};

const iconColorClasses = {
  indigo: "bg-indigo-100 text-indigo-600 dark:bg-indigo-900/50 dark:text-indigo-400",
  emerald: "bg-emerald-100 text-emerald-600 dark:bg-emerald-900/50 dark:text-emerald-400",
  amber: "bg-amber-100 text-amber-600 dark:bg-amber-900/50 dark:text-amber-400",
  rose: "bg-rose-100 text-rose-600 dark:bg-rose-900/50 dark:text-rose-400",
  purple: "bg-purple-100 text-purple-600 dark:bg-purple-900/50 dark:text-purple-400",
  cyan: "bg-cyan-100 text-cyan-600 dark:bg-cyan-900/50 dark:text-cyan-400",
  zinc: "bg-zinc-100 text-zinc-600 dark:bg-zinc-700 dark:text-zinc-400",
};

export default function Dialog({
  open,
  onClose,
  title,
  subtitle,
  icon,
  iconColor = "indigo",
  size = "lg",
  children,
  footer,
}: DialogProps) {
  const dialogRef = useRef<HTMLDivElement>(null);

  // Close on Escape key
  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape" && open) {
        onClose();
      }
    }
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [open, onClose]);

  // Prevent body scroll when open
  useEffect(() => {
    if (open) {
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "";
    }
    return () => {
      document.body.style.overflow = "";
    };
  }, [open]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center px-4">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/60 backdrop-blur-sm transition-opacity duration-300"
        onClick={onClose}
      />

      {/* Dialog */}
      <div
        ref={dialogRef}
        className={`relative w-full ${sizeClasses[size]} animate-in fade-in zoom-in-95 duration-200`}
        role="dialog"
        aria-modal="true"
      >
        <div className="overflow-hidden rounded-2xl border border-zinc-200/80 bg-white shadow-2xl dark:border-zinc-700/80 dark:bg-zinc-800">
          {/* Header */}
          <div className="relative border-b border-zinc-200 bg-gradient-to-r from-zinc-50 to-white px-6 py-5 dark:border-zinc-700 dark:from-zinc-800 dark:to-zinc-800/80">
            <div className="flex items-start justify-between">
              <div className="flex items-center gap-4">
                {icon && (
                  <div className={`flex h-11 w-11 flex-shrink-0 items-center justify-center rounded-xl ${iconColorClasses[iconColor]}`}>
                    {icon}
                  </div>
                )}
                <div>
                  <h2 className="text-lg font-semibold text-zinc-900 dark:text-zinc-100">
                    {title}
                  </h2>
                  {subtitle && (
                    <p className="mt-0.5 text-sm text-zinc-500 dark:text-zinc-400">
                      {subtitle}
                    </p>
                  )}
                </div>
              </div>
              <button
                type="button"
                onClick={onClose}
                className="ml-4 flex-shrink-0 rounded-lg p-2 text-zinc-400 transition-colors hover:bg-zinc-100 hover:text-zinc-600 dark:hover:bg-zinc-700 dark:hover:text-zinc-200"
              >
                <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
          </div>

          {/* Content */}
          <div className="max-h-[calc(100vh-16rem)] overflow-y-auto px-6 py-5">
            {children}
          </div>

          {/* Footer */}
          {footer && (
            <div className="border-t border-zinc-200 bg-zinc-50/80 px-6 py-4 dark:border-zinc-700 dark:bg-zinc-800/80">
              {footer}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// Common footer pattern with cancel and save buttons
interface DialogFooterProps {
  onCancel: () => void;
  onSave: () => void;
  saving?: boolean;
  disabled?: boolean;
  cancelText?: string;
  saveText?: string;
  savingText?: string;
  saveVariant?: "primary" | "danger";
}

export function DialogFooter({
  onCancel,
  onSave,
  saving = false,
  disabled = false,
  cancelText = "Abbrechen",
  saveText = "Speichern",
  savingText = "Speichern…",
  saveVariant = "primary",
}: DialogFooterProps) {
  const saveButtonClass = saveVariant === "danger"
    ? "bg-red-600 text-white shadow-sm hover:bg-red-700 disabled:opacity-60"
    : "bg-black text-white shadow-sm hover:bg-zinc-800 disabled:opacity-60 dark:bg-white dark:text-black dark:hover:bg-zinc-200";

  return (
    <div className="flex items-center justify-end gap-3">
      <button
        type="button"
        onClick={onCancel}
        className="rounded-lg border border-zinc-300 bg-white px-4 py-2.5 text-sm font-medium text-zinc-700 transition hover:bg-zinc-50 dark:border-zinc-600 dark:bg-zinc-700 dark:text-zinc-200 dark:hover:bg-zinc-600"
      >
        {cancelText}
      </button>
      <button
        type="button"
        onClick={onSave}
        disabled={saving || disabled}
        className={`rounded-lg px-4 py-2.5 text-sm font-medium transition ${saveButtonClass}`}
      >
        {saving ? savingText : saveText}
      </button>
    </div>
  );
}

// Common form field patterns
interface FormFieldProps {
  label: string;
  hint?: string;
  required?: boolean;
  children: ReactNode;
  className?: string;
}

export function FormField({ label, hint, required, children, className = "" }: FormFieldProps) {
  return (
    <label className={`flex flex-col gap-1.5 ${className}`}>
      <span className="text-sm font-medium text-zinc-700 dark:text-zinc-300">
        {label}
        {required && <span className="ml-1 text-red-500">*</span>}
        {hint && <span className="ml-2 font-normal text-zinc-400">({hint})</span>}
      </span>
      {children}
    </label>
  );
}

// Common input styles
export const inputClassName = "w-full rounded-lg border border-zinc-300 bg-white px-3 py-2.5 text-sm transition placeholder:text-zinc-400 focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 dark:border-zinc-600 dark:bg-zinc-700 dark:text-white dark:placeholder:text-zinc-500 dark:focus:border-indigo-400 dark:focus:ring-indigo-400/20";

export const selectClassName = "w-full rounded-lg border border-zinc-300 bg-white px-3 py-2.5 text-sm transition focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 dark:border-zinc-600 dark:bg-zinc-700 dark:text-white dark:focus:border-indigo-400 dark:focus:ring-indigo-400/20";

export const textareaClassName = "w-full min-h-[100px] rounded-lg border border-zinc-300 bg-white px-3 py-2.5 text-sm transition placeholder:text-zinc-400 focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 dark:border-zinc-600 dark:bg-zinc-700 dark:text-white dark:placeholder:text-zinc-500 dark:focus:border-indigo-400 dark:focus:ring-indigo-400/20";

export const checkboxContainerClassName = "flex items-center gap-3 rounded-lg border border-zinc-200 bg-zinc-50/80 px-4 py-3.5 transition hover:bg-zinc-100/80 dark:border-zinc-700 dark:bg-zinc-800/50 dark:hover:bg-zinc-700/50";

export const checkboxClassName = "h-4 w-4 rounded border-zinc-300 text-indigo-600 focus:ring-indigo-500 dark:border-zinc-600 dark:bg-zinc-700";
