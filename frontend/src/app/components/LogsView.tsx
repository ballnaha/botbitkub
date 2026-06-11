import type { RefObject } from "react";
import { Box, IconButton, Paper, Stack, Typography } from "@mui/material";
import { Terminal, Trash2 } from "lucide-react";

interface LogsViewProps {
  botLogs: string[];
  botLogsRef: RefObject<HTMLDivElement | null>;
  clearDevLogs: () => void;
  devLogs: string[];
  devLogsRef: RefObject<HTMLDivElement | null>;
}

export function LogsView({ botLogs, botLogsRef, clearDevLogs, devLogs, devLogsRef }: LogsViewProps) {
  return (
    <>
{/* Terminals Console Grid using Box Layout */}
        <Box 
          sx={{
            display: "grid",
            gridTemplateColumns: {
              xs: "1fr",
              md: "repeat(2, 1fr)"
            },
            gap: 1
          }}
        >
          {/* Developer Logs */}
          <Box>
            <Paper
              elevation={0}
              sx={{
                borderRadius: "16px",
                border: "1px solid rgba(255, 255, 255, 0.05)",
                overflow: "hidden",
                background: "rgba(8, 12, 20, 0.88)",
                display: "flex",
                flexDirection: "column",
                boxShadow: "inset 0 1px 0 0 rgba(255, 255, 255, 0.05), 0 11px 30px rgba(0, 0, 0, 0.5)"
              }}
            >
              <Box sx={{ px: 2.5, py: 1.5, background: "rgba(9, 15, 30, 0.9)", borderBottom: "1px solid rgba(255, 255, 255, 0.05)", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                <Stack direction="row" spacing={1} sx={{ userSelect: "none" }}>
                  <Box sx={{ w: 9, h: 9, borderRadius: "50%", background: "#ef5b63", width: "10px", height: "10px" }} />
                  <Box sx={{ w: 9, h: 9, borderRadius: "50%", background: "#eab308", width: "10px", height: "10px" }} />
                  <Box sx={{ w: 9, h: 9, borderRadius: "50%", background: "#00c16a", width: "10px", height: "10px" }} />
                </Stack>
                <Typography sx={{ fontSize: "11px", fontWeight: 600, color: "text.secondary", letterSpacing: "0.05em", fontFamily: "monospace" }}>
                  DEVELOPER SYSTEM LOGS
                </Typography>
                <IconButton 
                  onClick={clearDevLogs} 
                  size="small"
                  sx={{ color: "text.secondary", p: 0.5 }}
                >
                  <Trash2 size={15} />
                </IconButton>
              </Box>
              <Box 
                ref={devLogsRef}
                sx={{
                  height: 208,
                  overflowY: "auto",
                  p: 2,
                  fontFamily: "monospace",
                  fontSize: "12px",
                  lineHeight: 1.6,
                  color: "text.primary",
                  backgroundColor: "rgba(8, 12, 20, 0.95)",
                }}
                dangerouslySetInnerHTML={{ __html: devLogs.join("") }}
              />
            </Paper>
          </Box>

          {/* Bot Activity Logs */}
          <Box>
            <Paper
              elevation={0}
              sx={{
                borderRadius: "16px",
                border: "1px solid rgba(255, 255, 255, 0.05)",
                overflow: "hidden",
                background: "rgba(8, 12, 20, 0.88)",
                display: "flex",
                flexDirection: "column",
                boxShadow: "inset 0 1px 0 0 rgba(255, 255, 255, 0.05), 0 11px 30px rgba(0, 0, 0, 0.5)"
              }}
            >
              <Box sx={{ px: 2.5, py: 1.5, background: "rgba(9, 15, 30, 0.9)", borderBottom: "1px solid rgba(255, 255, 255, 0.05)", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                <Stack direction="row" spacing={1} sx={{ userSelect: "none" }}>
                  <Box sx={{ w: 9, h: 9, borderRadius: "50%", background: "#ef5b63", width: "10px", height: "10px" }} />
                  <Box sx={{ w: 9, h: 9, borderRadius: "50%", background: "#eab308", width: "10px", height: "10px" }} />
                  <Box sx={{ w: 9, h: 9, borderRadius: "50%", background: "#00c16a", width: "10px", height: "10px" }} />
                </Stack>
                <Typography sx={{ fontSize: "11px", fontWeight: 600, color: "text.secondary", letterSpacing: "0.05em", fontFamily: "monospace" }}>
                  BOT TRADING & ACTIVITY LOGS
                </Typography>
                <Terminal size={14} style={{ color: "#3b82f6" }} />
              </Box>
              <Box 
                ref={botLogsRef}
                sx={{
                  height: 208,
                  overflowY: "auto",
                  p: 2,
                  fontFamily: "monospace",
                  fontSize: "12px",
                  lineHeight: 1.6,
                  color: "text.primary",
                  backgroundColor: "rgba(8, 12, 20, 0.95)",
                }}
                dangerouslySetInnerHTML={{ __html: botLogs.join("") }}
              />
            </Paper>
          </Box>
        </Box>
    </>
  );
}
