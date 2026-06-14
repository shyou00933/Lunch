import { X, Check, AlertTriangle, Info, ShieldAlert } from "lucide-react";
import { ToastMessage } from "../types";
import { motion, AnimatePresence } from "motion/react";

interface ToastContainerProps {
  toasts: ToastMessage[];
  removeToast: (id: string) => void;
}

export default function ToastContainer({ toasts, removeToast }: ToastContainerProps) {
  return (
    <div id="toast-container" className="fixed bottom-5 right-5 z-50 flex flex-col gap-2 pointer-events-none max-w-sm w-full px-4 sm:px-0">
      <AnimatePresence>
        {toasts.map((toast) => {
          let icon = <Info className="w-4 h-4 text-indigo-500" />;
          let bgClass = "bg-indigo-50 border-indigo-100 text-indigo-800";
          if (toast.type === "success") {
            icon = <Check className="w-4 h-4 text-emerald-500" />;
            bgClass = "bg-emerald-55 border-emerald-100 text-emerald-850";
          } else if (toast.type === "warn") {
            icon = <AlertTriangle className="w-4 h-4 text-amber-500" />;
            bgClass = "bg-amber-50 border-amber-100 text-amber-800";
          } else if (toast.type === "error") {
            icon = <ShieldAlert className="w-4 h-4 text-rose-500" />;
            bgClass = "bg-rose-50 border-rose-100 text-rose-800";
          }

          return (
            <motion.div
              key={toast.id}
              initial={{ opacity: 0, y: 15 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 15 }}
              transition={{ type: "spring", stiffness: 350, damping: 25 }}
              className={`p-4 bg-white rounded-2xl shadow-xl border border-slate-100 flex items-center justify-between gap-3 pointer-events-auto select-none`}
            >
              <div className="flex items-center gap-2.5">
                <div className={`p-1.5 rounded-lg border ${bgClass} shrink-0`}>
                  {icon}
                </div>
                <div className="flex-1 min-w-0">
                  <span className="text-xs font-bold text-slate-700 block tracking-tight leading-normal">
                    {toast.message}
                  </span>
                </div>
              </div>
              <button
                className="text-slate-350 hover:text-slate-500 transition-colors cursor-pointer p-0.5"
                onClick={() => removeToast(toast.id)}
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </motion.div>
          );
        })}
      </AnimatePresence>
    </div>
  );
}
