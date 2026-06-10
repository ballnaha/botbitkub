"use client";

import React, { useState } from "react";
import { useServerInsertedHTML } from "next/navigation";
import createCache from "@emotion/cache";
import { CacheProvider } from "@emotion/react";
import { ThemeProvider, createTheme } from "@mui/material/styles";
import CssBaseline from "@mui/material/CssBaseline";
import { ToastProvider } from "./components/Toast";

// Create custom theme
const theme = createTheme({
  palette: {
    mode: "dark",
    primary: {
      main: "#10b981", // Emerald green
      light: "#34d399",
      dark: "#059669",
    },
    secondary: {
      main: "#3b82f6", // Blue
      light: "#60a5fa",
      dark: "#2563eb",
    },
    background: {
      default: "#080b11", // Dark navy
      paper: "#0d1321", // Slate paper
    },
    text: {
      primary: "#f8fafc",
      secondary: "#94a3b8",
    },
    divider: "rgba(255, 255, 255, 0.05)",
  },
  typography: {
    fontFamily: "var(--font-sarabun), 'Inter', sans-serif",
    h1: { fontFamily: "var(--font-sarabun), var(--font-outfit), sans-serif", fontWeight: 700 },
    h2: { fontFamily: "var(--font-sarabun), var(--font-outfit), sans-serif", fontWeight: 700 },
    h3: { fontFamily: "var(--font-sarabun), var(--font-outfit), sans-serif", fontWeight: 700 },
    h4: { fontFamily: "var(--font-sarabun), var(--font-outfit), sans-serif", fontWeight: 600 },
    h5: { fontFamily: "var(--font-sarabun), var(--font-outfit), sans-serif", fontWeight: 600 },
    h6: { fontFamily: "var(--font-sarabun), var(--font-outfit), sans-serif", fontWeight: 600 },
    button: {
      fontFamily: "var(--font-sarabun), var(--font-outfit), sans-serif",
      textTransform: "none",
      fontWeight: 700,
    },
  },
  components: {
    MuiButton: {
      styleOverrides: {
        root: {
          borderRadius: "12px",
          transition: "all 0.3s ease",
          fontWeight: 700,
        },
      },
    },
    MuiOutlinedInput: {
      styleOverrides: {
        root: {
          borderRadius: "12px",
          backgroundColor: "rgba(2, 6, 23, 0.45)",
          "& fieldset": {
            borderColor: "rgba(255, 255, 255, 0.05)",
          },
          "&:hover fieldset": {
            borderColor: "rgba(255, 255, 255, 0.15) !important",
          },
          "&.Mui-focused fieldset": {
            borderColor: "#10b981 !important",
            borderWidth: "1px",
          },
        },
      },
    },
    MuiSelect: {
      styleOverrides: {
        select: {
          backgroundColor: "rgba(2, 6, 23, 0.45)",
        },
      },
    },
    MuiCard: {
      styleOverrides: {
        root: {
          backgroundColor: "rgba(13, 19, 33, 0.45)",
          backdropFilter: "blur(20px)",
          border: "1px solid rgba(255, 255, 255, 0.04)",
          borderRadius: "20px",
          boxShadow: "0 8px 32px 0 rgba(0, 0, 0, 0.4)",
          transition: "all 0.3s cubic-bezier(0.4, 0, 0.2, 1)",
          "&:hover": {
            borderColor: "rgba(16, 185, 129, 0.12)",
            boxShadow: "0 12px 40px 0 rgba(16, 185, 129, 0.04)",
            transform: "translateY(-2px)",
          },
        },
      },
    },
    MuiDialog: {
      styleOverrides: {
        paper: {
          backgroundColor: "#0d1321",
          borderRadius: "20px",
          border: "1px solid rgba(255, 255, 255, 0.05)",
          boxShadow: "0 20px 50px rgba(0, 0, 0, 0.6)",
        },
      },
    },
    MuiTableHead: {
      styleOverrides: {
        root: {
          "& th": {
            borderBottom: "1px solid rgba(255, 255, 255, 0.05)",
            fontSize: "0.7rem",
            fontWeight: 800,
            letterSpacing: "0.05em",
            textTransform: "uppercase",
            color: "#64748b",
            padding: "10px 16px",
          },
        },
      },
    },
    MuiTableCell: {
      styleOverrides: {
        root: {
          borderBottom: "1px solid rgba(255, 255, 255, 0.03)",
          padding: "12px 16px",
        },
      },
    },
    MuiTableRow: {
      styleOverrides: {
        root: {
          transition: "background-color 0.2s ease",
          "&:hover": {
            backgroundColor: "rgba(255, 255, 255, 0.01) !important",
          },
        },
      },
    },
    MuiChip: {
      styleOverrides: {
        root: {
          fontWeight: 700,
          borderRadius: "8px",
        },
      },
    },
  },
});

export default function ThemeRegistry({ children }: { children: React.ReactNode }) {
  const [{ cache, flush }] = useState(() => {
    const cache = createCache({ key: "mui" });
    cache.compat = true;
    const prevInsert = cache.insert;
    let inserted: string[] = [];
    cache.insert = (...args) => {
      const serialized = args[1];
      if (cache.inserted[serialized.name] === undefined) {
        inserted.push(serialized.name);
      }
      return prevInsert(...args);
    };
    const flush = () => {
      const prevInserted = inserted;
      inserted = [];
      return prevInserted;
    };
    return { cache, flush };
  });

  useServerInsertedHTML(() => {
    const names = flush();
    if (names.length === 0) {
      return null;
    }
    let styles = "";
    for (const name of names) {
      styles += cache.inserted[name];
    }
    return (
      <style
        key={cache.key}
        data-emotion={`${cache.key} ${names.join(" ")}`}
        dangerouslySetInnerHTML={{
          __html: styles,
        }}
      />
    );
  });

  return (
    <CacheProvider value={cache}>
      <ThemeProvider theme={theme}>
        <CssBaseline />
        <ToastProvider>{children}</ToastProvider>
      </ThemeProvider>
    </CacheProvider>
  );
}
