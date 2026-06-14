"use client";

import React, { useState } from "react";
import { useRouter } from "next/navigation";
import {
  Alert,
  Box,
  Button,
  Card,
  CardContent,
  CircularProgress,
  Container,
  InputAdornment,
  Stack,
  TextField,
  Typography,
} from "@mui/material";
import { Lock, ShieldCheck, User } from "lucide-react";

export default function LoginPage() {
  const router = useRouter();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const updateUsername = (value: string) => {
    setUsername(value);
    if (error) setError("");
  };

  const updatePassword = (value: string) => {
    setPassword(value);
    if (error) setError("");
  };

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
        setError(data.detail || data.message || "Username or password is incorrect.");
      }
    } catch {
      setError("Unable to connect to the server. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <Box
      sx={{
        minHeight: "100vh",
        position: "relative",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        overflow: "hidden",
        px: { xs: 2, sm: 3 },
        py: 4,
        background: "linear-gradient(180deg, rgba(9, 12, 18, 0.98) 0%, rgba(5, 8, 13, 1) 100%)",
      }}
    >
      <Box
        sx={{
          position: "absolute",
          inset: 0,
          pointerEvents: "none",
          backgroundImage:
            "linear-gradient(rgba(255,255,255,0.025) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.018) 1px, transparent 1px)",
          backgroundSize: "28px 28px",
          maskImage: "linear-gradient(180deg, rgba(0,0,0,0.7), transparent 72%)",
        }}
      />

      <Container maxWidth="xs" sx={{ position: "relative", zIndex: 1 }}>
        <Box sx={{ mb: 2.5, textAlign: "center" }}>
          <Box
            sx={{
              mx: "auto",
              mb: 1.5,
              width: 44,
              height: 44,
              borderRadius: "12px",
              display: "grid",
              placeItems: "center",
              color: "#00c16a",
              backgroundColor: "rgba(0, 193, 106, 0.08)",
              border: "1px solid rgba(0, 193, 106, 0.18)",
            }}
          >
            <ShieldCheck size={22} />
          </Box>
          <Typography
            component="h1"
            sx={{
              color: "text.primary",
              fontFamily: "Outfit, sans-serif",
              fontSize: { xs: "1.35rem", sm: "1.5rem" },
              fontWeight: 800,
              letterSpacing: 0,
              lineHeight: 1.2,
            }}
          >
            Bitkub Trading Console
          </Typography>
          <Typography sx={{ mt: 0.7, color: "text.secondary", fontSize: "0.86rem" }}>
            Sign in to manage your automated trading workspace.
          </Typography>
        </Box>

        <Card
          sx={{
            background: "rgba(10, 15, 24, 0.86)",
            backdropFilter: "blur(18px)",
            border: "1px solid rgba(255, 255, 255, 0.075)",
            borderRadius: "14px",
            boxShadow: "0 24px 70px rgba(0, 0, 0, 0.42)",
            overflow: "hidden",
          }}
        >
          <CardContent sx={{ p: { xs: 2.5, sm: 3 } }}>
            <Box sx={{ mb: 2.5 }}>
              <Typography sx={{ color: "text.primary", fontSize: "1rem", fontWeight: 800, fontFamily: "Outfit, sans-serif" }}>
                Secure Login
              </Typography>
              <Typography sx={{ color: "text.secondary", fontSize: "0.78rem", mt: 0.35 }}>
                Use your dashboard credentials to continue.
              </Typography>
            </Box>

            {error && (
              <Alert
                severity="error"
                variant="outlined"
                sx={{
                  mb: 2.25,
                  backgroundColor: "rgba(239, 91, 99, 0.05)",
                  borderColor: "rgba(239, 91, 99, 0.2)",
                  color: "#ff7a82",
                  borderRadius: "8px",
                  fontSize: "0.76rem",
                  fontWeight: 600,
                  "& .MuiAlert-icon": { color: "#ef5b63" },
                }}
              >
                {error}
              </Alert>
            )}

            <form onSubmit={handleSubmit}>
              <Stack spacing={2}>
                <Box>
                  <Typography
                    sx={{
                      fontSize: "0.75rem",
                      fontWeight: 700,
                      color: "text.secondary",
                      textTransform: "uppercase",
                      letterSpacing: "0.06em",
                      mb: 0.75,
                    }}
                  >
                    Username
                  </Typography>
                  <TextField
                    fullWidth
                    required
                    variant="outlined"
                    placeholder="Enter username"
                    value={username}
                    onChange={(e) => updateUsername(e.target.value)}
                    autoComplete="username"
                    disabled={loading}
                    slotProps={{
                      input: {
                        startAdornment: (
                          <InputAdornment position="start">
                            <User size={18} style={{ color: "#87928a", marginRight: "4px" }} />
                          </InputAdornment>
                        ),
                      },
                    }}
                  />
                </Box>

                <Box>
                  <Typography
                    sx={{
                      fontSize: "0.75rem",
                      fontWeight: 700,
                      color: "text.secondary",
                      textTransform: "uppercase",
                      letterSpacing: "0.06em",
                      mb: 0.75,
                    }}
                  >
                    Password
                  </Typography>
                  <TextField
                    fullWidth
                    required
                    variant="outlined"
                    type="password"
                    placeholder="Enter password"
                    value={password}
                    onChange={(e) => updatePassword(e.target.value)}
                    autoComplete="current-password"
                    disabled={loading}
                    slotProps={{
                      input: {
                        startAdornment: (
                          <InputAdornment position="start">
                            <Lock size={18} style={{ color: "#87928a", marginRight: "4px" }} />
                          </InputAdornment>
                        ),
                      },
                    }}
                  />
                </Box>

                <Button
                  fullWidth
                  type="submit"
                  variant="contained"
                  disabled={loading}
                  sx={{
                    mt: 0.5,
                    py: 1.35,
                    fontSize: "0.875rem",
                    fontWeight: 800,
                    borderRadius: "9px",
                    backgroundColor: "#00c16a",
                    color: "#06120d",
                    boxShadow: "0 12px 28px rgba(0, 193, 106, 0.16)",
                    "&:hover": {
                      backgroundColor: "#14d87d",
                      boxShadow: "0 14px 34px rgba(0, 193, 106, 0.22)",
                    },
                    "&.Mui-disabled": {
                      backgroundColor: "rgba(255, 255, 255, 0.05)",
                      color: "rgba(255, 255, 255, 0.3)",
                    },
                  }}
                >
                  {loading ? <CircularProgress size={20} color="inherit" /> : "Sign In"}
                </Button>
              </Stack>
            </form>
          </CardContent>
        </Card>

        <Typography sx={{ mt: 2, textAlign: "center", color: "rgba(148, 163, 184, 0.72)", fontSize: "0.72rem" }}>
          Protected access for bot settings, wallet data, and trade operations.
        </Typography>
      </Container>
    </Box>
  );
}
