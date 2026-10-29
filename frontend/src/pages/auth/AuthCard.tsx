import type { FormEvent, ReactNode } from "react";

interface AuthCardProps {
  title: string;
  subtitle: string;
  submitLabel: string;
  isSubmitting: boolean;
  error?: string;
  onSubmit: () => void;
  footer: ReactNode;
  children: ReactNode;
}

export function AuthCard({
  title,
  subtitle,
  submitLabel,
  isSubmitting,
  error,
  onSubmit,
  footer,
  children,
}: AuthCardProps) {
  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    onSubmit();
  };

  return (
    <div className="flex justify-center py-10">
      <form
        onSubmit={handleSubmit}
        noValidate
        className="w-full max-w-md rounded-2xl border border-white/10 bg-[#131a30] shadow-2xl"
      >
        <div className="border-b border-white/10 px-6 py-5">
          <h1 className="text-lg font-semibold text-white">{title}</h1>
          <p className="mt-1 text-sm text-slate-400">{subtitle}</p>
        </div>

        <div className="space-y-5 px-6 py-5">
          {children}
          {error && (
            <p className="rounded-lg border border-red-500/20 bg-red-500/10 px-4 py-3 text-sm text-red-400">
              {error}
            </p>
          )}
        </div>

        <div className="space-y-4 border-t border-white/10 px-6 py-5">
          <button
            type="submit"
            disabled={isSubmitting}
            className="w-full rounded-lg bg-blue-600 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-blue-500 disabled:opacity-60"
          >
            {isSubmitting ? "Подождите…" : submitLabel}
          </button>
          <p className="text-center text-sm text-slate-400">{footer}</p>
        </div>
      </form>
    </div>
  );
}
