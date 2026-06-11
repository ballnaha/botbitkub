"use client";

import React, { createContext, useContext, useState, useCallback, useRef } from "react";
import { Box, Typography, IconButton } from "@mui/material";
import { X, CheckCircle2, AlertTriangle, Info, XCircle } from "lucide-react";

// ─── Types ──────────────────────────────────────────────
type ToastType = "success" | "error" | "warning" | "info";

interface Toast {
  id: string;
  type: ToastType;
  title: string;
  message?: string;
  duration?: number;
}

interface ToastContextType {
  toasts: Toast[];
  addToast: (toast: Omit<Toast, "id">) => void;
  removeToast: (id: string) => void;
}

// ─── Context ────────────────────────────────────────────
const ToastContext = createContext<ToastContextType | undefined>(undefined);

export function useToast() {
  const context = useContext(ToastContext);
  if (!context) {
    throw new Error("useToast must be used within a ToastProvider");
  }
  return context;
}

// ─── Config ─────────────────────────────────────────────
const toastConfig: Record<ToastType, {
  icon: React.ReactNode;
  accentColor: string;
  bgColor: string;
  borderColor: string;
  glowColor: string;
}> = {
  success: {
    icon: <CheckCircle2 size={18} />,
    accentColor: "#00c16a",
    bgColor: "rgba(0, 193, 106, 0.06)",
    borderColor: "rgba(0, 193, 106, 0.2)",
    glowColor: "rgba(0, 193, 106, 0.08)",
  },
  error: {
    icon: <XCircle size={18} />,
    accentColor: "#ef5b63",
    bgColor: "rgba(239, 91, 99, 0.06)",
    borderColor: "rgba(239, 91, 99, 0.2)",
    glowColor: "rgba(239, 91, 99, 0.08)",
  },
  warning: {
    icon: <AlertTriangle size={18} />,
    accentColor: "#f59e0b",
    bgColor: "rgba(245, 158, 11, 0.06)",
    borderColor: "rgba(245, 158, 11, 0.2)",
    glowColor: "rgba(245, 158, 11, 0.08)",
  },
  info: {
    icon: <Info size={18} />,
    accentColor: "#3b82f6",
    bgColor: "rgba(59, 130, 246, 0.06)",
    borderColor: "rgba(59, 130, 246, 0.2)",
    glowColor: "rgba(59, 130, 246, 0.08)",
  },
};

// ─── Single Toast Item ──────────────────────────────────
function ToastItem({
  toast,
  index,
  total,
  onRemove,
}: {
  toast: Toast;
  index: number;
  total: number;
  onRemove: (id: string) => void;
}) {
  const config = toastConfig[toast.type];
  const stackOffset = (total - 1 - index);
  const isTop = index === total - 1;

  return (
    <Box
      sx={{
        position: "absolute",
        bottom: stackOffset * 8,
        right: 0,
        width: "100%",
        transform: `scale(${1 - stackOffset * 0.03})`,
        opacity: isTop ? 1 : Math.max(0.4, 1 - stackOffset * 0.25),
        zIndex: index,
        transition: "all 0.4s cubic-bezier(0.16, 1, 0.3, 1)",
        pointerEvents: isTop ? "auto" : "none",
        animation: isTop ? "toast-slide-in 0.4s cubic-bezier(0.16, 1, 0.3, 1)" : undefined,
        "@keyframes toast-slide-in": {
          "0%": {
            transform: "translateX(120%) scale(0.95)",
            opacity: 0,
          },
          "100%": {
            transform: "translateX(0) scale(1)",
            opacity: 1,
          },
        },
      }}
    >
      <Box
        sx={{
          display: "flex",
          alignItems: "flex-start",
          gap: 1,
          p: 2,
          pr: 1.5,
          borderRadius: "14px",
          backgroundColor: "rgba(13, 20, 35, 0.96)",
          backdropFilter: "blur(24px) saturate(1.8)",
          border: `1px solid ${config.borderColor}`,
          boxShadow: `
            0 9px 32px rgba(0, 0, 0, 0.45),
            0 0 0 1px rgba(255, 255, 255, 0.02),
            inset 0 1px 0 rgba(255, 255, 255, 0.04),
            0 0 20px ${config.glowColor}
          `,
          position: "relative",
          overflow: "hidden",
          "&::before": {
            content: '""',
            position: "absolute",
            left: 0,
            top: 0,
            bottom: 0,
            width: "3px",
            background: `linear-gradient(180deg, ${config.accentColor}, transparent)`,
            borderRadius: "3px 0 0 3px",
          },
        }}
      >
        {/* Icon */}
        <Box
          sx={{
            mt: 0.2,
            color: config.accentColor,
            filter: `drop-shadow(0 0 6px ${config.glowColor})`,
            flexShrink: 0,
          }}
        >
          {config.icon}
        </Box>

        {/* Content */}
        <Box sx={{ flex: 1, minWidth: 0 }}>
          <Typography
            sx={{
              fontSize: "0.9rem",
              fontWeight: 500,
              color: "#f4f7f4",
              lineHeight: 1.3,
            }}
          >
            {toast.title}
          </Typography>
          {toast.message && (
            <Typography
              sx={{
                fontSize: "0.82rem",
                color: "rgba(184, 194, 186, 0.9)",
                mt: 0.3,
                lineHeight: 1.4,
              }}
            >
              {toast.message}
            </Typography>
          )}
        </Box>

        {/* Close Button */}
        <IconButton
          onClick={() => onRemove(toast.id)}
          size="small"
          sx={{
            color: "rgba(184, 194, 186, 0.55)",
            p: 0.5,
            mt: -0.3,
            mr: -0.3,
            "&:hover": {
              color: "#f4f7f4",
              backgroundColor: "rgba(255, 255, 255, 0.06)",
            },
          }}
        >
          <X size={14} />
        </IconButton>
      </Box>

      {/* Progress bar for auto-dismiss */}
      {isTop && (
        <Box
          sx={{
            position: "absolute",
            bottom: 0,
            left: 16,
            right: 16,
            height: "2px",
            borderRadius: "2px",
            overflow: "hidden",
            backgroundColor: "rgba(255, 255, 255, 0.03)",
          }}
        >
          <Box
            sx={{
              height: "100%",
              backgroundColor: config.accentColor,
              opacity: 0.5,
              borderRadius: "2px",
              animation: `toast-progress ${toast.duration || 4000}ms linear forwards`,
              "@keyframes toast-progress": {
                "0%": { width: "100%" },
                "100%": { width: "0%" },
              },
            }}
          />
        </Box>
      )}
    </Box>
  );
}

// ─── Toast Container ────────────────────────────────────
function ToastContainer({
  toasts,
  removeToast,
}: {
  toasts: Toast[];
  removeToast: (id: string) => void;
}) {
  // Show max 5 stacked toasts
  const visibleToasts = toasts.slice(-5);

  if (visibleToasts.length === 0) return null;

  return (
    <Box
      sx={{
        position: "fixed",
        bottom: 24,
        right: 24,
        zIndex: 9999,
        width: 380,
        maxWidth: "calc(100vw - 49px)",
      }}
    >
      <Box sx={{ position: "relative", height: visibleToasts.length > 1 ? 80 + (visibleToasts.length - 1) * 8 : "auto" }}>
        {visibleToasts.map((toast, index) => (
          <ToastItem
            key={toast.id}
            toast={toast}
            index={index}
            total={visibleToasts.length}
            onRemove={removeToast}
          />
        ))}
      </Box>
    </Box>
  );
}

// ─── Provider ───────────────────────────────────────────
export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);
  const timersRef = useRef<Map<string, NodeJS.Timeout>>(new Map());

  const removeToast = useCallback((id: string) => {
    const timer = timersRef.current.get(id);
    if (timer) {
      clearTimeout(timer);
      timersRef.current.delete(id);
    }
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const addToast = useCallback(
    (toast: Omit<Toast, "id">) => {
      const id = `toast-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
      const duration = toast.duration || 4000;
      const newToast: Toast = { ...toast, id, duration };

      setToasts((prev) => [...prev, newToast]);

      // Auto dismiss
      const timer = setTimeout(() => {
        removeToast(id);
      }, duration);
      timersRef.current.set(id, timer);
    },
    [removeToast]
  );

  return (
    <ToastContext.Provider value={{ toasts, addToast, removeToast }}>
      {children}
      <ToastContainer toasts={toasts} removeToast={removeToast} />
    </ToastContext.Provider>
  );
}
