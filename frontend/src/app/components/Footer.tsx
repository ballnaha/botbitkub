"use client";

import React from "react";
import { Box, Typography } from "@mui/material";
import { Zap } from "lucide-react";

interface FooterProps {
  wsConnected?: boolean;
  backendConnected?: boolean;
  activeView?: string;
  setActiveView?: (view: "bot" | "manual" | "logs" | "settings") => void;
}

export function Footer({
  wsConnected = false,
  backendConnected = false
}: FooterProps) {
  // Determine consolidated system status
  const isOnline = backendConnected && wsConnected;
  const isLimited = backendConnected && !wsConnected;
  
  let statusColor = "#ef5b63"; // Offline
  let statusText = "Offline";
  if (isOnline) {
    statusColor = "#00c16a"; // Online
    statusText = "System Active";
  } else if (isLimited) {
    statusColor = "#f59e0b"; // Connecting/Limited state
    statusText = "Connecting...";
  }

  return (
    <Box
      component="footer"
      sx={{
        mt: 6,
        mb: 2,
        px: 3,
        py: 2,
        borderRadius: "16px",
        background: "rgba(13, 20, 35, 0.25)",
        backdropFilter: "blur(16px)",
        border: "1px solid rgba(255, 255, 255, 0.03)",
        display: "flex",
        flexDirection: { xs: "column", sm: "row" },
        justifyContent: "space-between",
        alignItems: "center",
        gap: 2,
        position: "relative",
      }}
    >
      {/* Brand & Copyright */}
      <Box 
        sx={{ 
          display: "flex", 
          alignItems: "center", 
          gap: 1.5, 
          flexDirection: { xs: "column", sm: "row" }, 
          textAlign: { xs: "center", sm: "left" } 
        }}
      >
        <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
          <Zap size={14} style={{ color: "#00c16a" }} />
          <Typography
            sx={{
              fontWeight: 600,
              fontSize: "0.8rem",
              fontFamily: "Outfit, sans-serif",
              color: "#ffffff",
              letterSpacing: "0.02em"
            }}
          >
            Bitkub API Hub
          </Typography>
        </Box>
        <Box 
          sx={{ 
            display: { xs: "none", sm: "block" }, 
            width: "1px", 
            height: "12px", 
            backgroundColor: "rgba(255, 255, 255, 0.08)" 
          }} 
        />
        <Typography sx={{ fontSize: "0.75rem", color: "text.secondary" }}>
          © {new Date().getFullYear()} All rights reserved.
        </Typography>
      </Box>

      {/* System Status Indicators */}
      <Box 
        sx={{ 
          display: "flex", 
          alignItems: "center", 
          gap: 1.5, 
          justifyContent: "center" 
        }}
      >
        {/* Status dot */}
        <Box sx={{ display: "flex", alignItems: "center", gap: 0.75 }}>
          <Box
            sx={{
              width: 6,
              height: 6,
              borderRadius: "50%",
              backgroundColor: statusColor,
              boxShadow: `0 0 6px ${statusColor}`,
              transition: "background-color 0.3s ease, box-shadow 0.3s ease"
            }}
          />
          <Typography sx={{ fontSize: "0.72rem", color: "text.secondary", fontWeight: 500 }}>
            {statusText}
          </Typography>
        </Box>
      </Box>
    </Box>
  );
}
