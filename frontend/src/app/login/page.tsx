"use client";

import React, { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { 
  Box, 
  Button, 
  TextField, 
  Typography, 
  Alert, 
  CircularProgress,
  InputAdornment,
  Card,
  CardContent,
  Container,
  Stack
} from "@mui/material";
import { Zap, User, Lock } from "lucide-react";

export default function LoginPage() {
  const router = useRouter();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  // Clean error on input change
  useEffect(() => {
    if (error) setError("");
  }, [username, password]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError("");

    try {
      const res = await fetch("/api/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username, password }),
      });

      const data = await res.json();

      if (res.ok && data.status === "success") {
        router.push("/");
      } else {
        setError(data.detail || data.message || "ชื่อผู้ใช้หรือรหัสผ่านไม่ถูกต้อง");
      }
    } catch (err) {
      setError("เกิดข้อผิดพลาดในการเชื่อมต่อเซิร์ฟเวอร์");
    } finally {
      setLoading(false);
    }
  };

  return (
    <Box 
      sx={{
        minHeight: "100vh",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        position: "relative",
        px: 2,
        overflow: "hidden",
        backgroundImage: "linear-gradient(rgba(255, 255, 255, 0.005) 1px, transparent 1px), linear-gradient(90deg, rgba(255, 255, 255, 0.005) 1px, transparent 1px)",
        backgroundSize: "32px 32px",
      }}
    >
      {/* Background glass blur effect */}
      <Box 
        sx={{
          position: "fixed",
          inset: 0,
          backdropFilter: "blur(100px)",
          zIndex: -1,
        }} 
      />
      
      {/* Glowing background bubbles */}
      <Box 
        sx={{
          position: "fixed",
          borderRadius: "50%",
          filter: "blur(120px)",
          zIndex: -2,
          opacity: 0.12,
          width: 500,
          height: 500,
          backgroundColor: "primary.main",
          bottom: "-10%",
          left: "-10%",
          animation: "pulse 8s infinite ease-in-out",
          "@keyframes pulse": {
            "0%, 100%": { transform: "scale(1)", opacity: 0.08 },
            "50%": { transform: "scale(1.15)", opacity: 0.16 }
          }
        }} 
      />
      
      <Box 
        sx={{
          position: "fixed",
          borderRadius: "50%",
          filter: "blur(120px)",
          zIndex: -2,
          opacity: 0.1,
          width: 400,
          height: 400,
          backgroundColor: "secondary.main",
          top: "-5%",
          right: "-5%",
          animation: "pulse-reverse 10s infinite ease-in-out",
          "@keyframes pulse-reverse": {
            "0%, 100%": { transform: "scale(1.1)", opacity: 0.1 },
            "50%": { transform: "scale(0.9)", opacity: 0.05 }
          }
        }} 
      />

      <Container maxWidth="xs" sx={{ zIndex: 1 }}>
        <Card 
          sx={{
            background: "rgba(13, 19, 33, 0.45)",
            backdropFilter: "blur(20px)",
            border: "1px solid rgba(255, 255, 255, 0.04)",
            borderRadius: "24px",
            boxShadow: "0 20px 50px rgba(0, 0, 0, 0.55)",
            overflow: "hidden",
            "&:hover": {
              borderColor: "rgba(16, 185, 129, 0.2)",
              boxShadow: "0 24px 60px rgba(16, 185, 129, 0.06)",
            }
          }}
        >
          <CardContent sx={{ p: { xs: 4, sm: 5 } }}>
            {/* Brand Header */}
            <Box sx={{ display: "flex", flexDirection: "column", alignItems: "center", mb: 4, textAlign: "center" }}>
              <Box 
                sx={{
                  mb: 2.5,
                  p: 1.5,
                  borderRadius: "16px",
                  background: "rgba(16, 185, 129, 0.08)",
                  border: "1px solid rgba(16, 185, 129, 0.15)",
                  color: "primary.main",
                  filter: "drop-shadow(0 0 12px rgba(16, 185, 129, 0.3))",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                }}
              >
                <Zap size={32} />
              </Box>
              <Typography 
                variant="h4" 
                component="h1"
                sx={{
                  fontWeight: 800,
                  letterSpacing: "-0.02em",
                  background: "linear-gradient(90deg, #ffffff 30%, #e2e8f0 60%, #10b981 100%)",
                  WebkitBackgroundClip: "text",
                  WebkitTextFillColor: "transparent",
                  fontFamily: "Outfit, sans-serif",
                }}
              >
                Bitkub API Hub
              </Typography>
              <Typography sx={{ color: "text.secondary", fontSize: "0.8rem", mt: 1 }}>
                กรุณาลงชื่อเข้าใช้งานแดชบอร์ด
              </Typography>
            </Box>

            {/* Error Message */}
            {error && (
              <Alert 
                severity="error" 
                variant="outlined"
                sx={{
                  mb: 3,
                  backgroundColor: "rgba(244, 63, 94, 0.05)",
                  borderColor: "rgba(244, 63, 94, 0.2)",
                  color: "#fb7185",
                  borderRadius: "12px",
                  fontSize: "0.75rem",
                  fontWeight: 600,
                  "& .MuiAlert-icon": { color: "#f43f5e" }
                }}
              >
                {error}
              </Alert>
            )}

            {/* Login Form */}
            <form onSubmit={handleSubmit}>
              <Stack spacing={3.5}>
                {/* Username Input */}
                <Box>
                  <Typography 
                    sx={{
                      fontSize: "0.75rem",
                      fontWeight: 700,
                      color: "text.secondary",
                      textTransform: "uppercase",
                      letterSpacing: "0.08em",
                      mb: 1,
                      pl: 0.5
                    }}
                  >
                    ชื่อผู้ใช้ (Username)
                  </Typography>
                  <TextField
                    fullWidth
                    variant="outlined"
                    placeholder="ระบุ Username"
                    required
                    value={username}
                    onChange={(e) => setUsername(e.target.value)}
                    autoComplete="username"
                    disabled={loading}
                    slotProps={{
                      input: {
                        startAdornment: (
                          <InputAdornment position="start">
                            <User size={18} style={{ color: "#94a3b8", marginRight: "4px" }} />
                          </InputAdornment>
                        ),
                      },
                    }}
                  />
                </Box>

                {/* Password Input */}
                <Box>
                  <Typography 
                    sx={{
                      fontSize: "0.75rem",
                      fontWeight: 700,
                      color: "text.secondary",
                      textTransform: "uppercase",
                      letterSpacing: "0.08em",
                      mb: 1,
                      pl: 0.5
                    }}
                  >
                    รหัสผ่าน (Password)
                  </Typography>
                  <TextField
                    fullWidth
                    variant="outlined"
                    type="password"
                    placeholder="ระบุ Password"
                    required
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    autoComplete="current-password"
                    disabled={loading}
                    slotProps={{
                      input: {
                        startAdornment: (
                          <InputAdornment position="start">
                            <Lock size={18} style={{ color: "#94a3b8", marginRight: "4px" }} />
                          </InputAdornment>
                        ),
                      },
                    }}
                  />
                </Box>

                {/* Submit Button */}
                <Button
                  fullWidth
                  type="submit"
                  variant="contained"
                  disabled={loading}
                  sx={{
                    py: 1.8,
                    fontSize: "0.875rem",
                    fontWeight: 800,
                    borderRadius: "12px",
                    background: "linear-gradient(90deg, #10b981 0%, #14b8a6 50%, #059669 100%)",
                    color: "#080b11",
                    boxShadow: "0 4px 20px rgba(16, 185, 129, 0.2)",
                    "&:hover": {
                      background: "linear-gradient(90deg, #34d399 0%, #2dd4bf 50%, #059669 100%)",
                      boxShadow: "0 6px 25px rgba(16, 185, 129, 0.35)",
                      transform: "scale(1.01)"
                    },
                    "&.Mui-disabled": {
                      background: "rgba(255, 255, 255, 0.05)",
                      color: "rgba(255, 255, 255, 0.3)",
                    }
                  }}
                >
                  {loading ? (
                    <CircularProgress size={20} color="inherit" />
                  ) : (
                    "ลงชื่อเข้าใช้งาน"
                  )}
                </Button>
              </Stack>
            </form>
          </CardContent>
        </Card>
      </Container>
    </Box>
  );
}
