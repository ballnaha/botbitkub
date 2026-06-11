import React, { useState } from "react";
import {
  Box,
  Button,
  Card,
  CardContent,
  CircularProgress,
  Dialog,
  DialogActions,
  DialogContent,
  DialogContentText,
  DialogTitle,
  Typography,
  Stack,
  Alert,
  Divider,
  TextField,
  Chip,
  Tabs,
  Tab,
  Paper,
  IconButton,
  InputAdornment,
  Grid,
  Autocomplete,
} from "@mui/material";
import {
  Sliders,
  AlertTriangle,
  ShieldCheck,
  Coins,
  Shield,
  Activity,
  Plus,
  Minus,
  Info,
  Brain,
  Key,
} from "lucide-react";
import type { BotConfig, StrategyInfo } from "./dashboardTypes";

interface SettingsViewProps {
  botConfig: BotConfig;
  updateBotConfigDraft: (patch: Partial<BotConfig>) => void;
  actionLoading?: boolean;
  allSymbols?: string[];
  autoSaveState?: "idle" | "saving" | "saved" | "error";
}

interface NumberStepperProps {
  value: number;
  step: number;
  min?: number;
  onChange: (value: number) => void;
  suffix?: string;
}

function NumberStepper({ value, step, min, onChange, suffix }: NumberStepperProps) {
  const updateValue = (nextValue: number) => {
    const clampedValue = min === undefined ? nextValue : Math.max(min, nextValue);
    const precision = step < 1 ? 2 : 0;
    onChange(Number(clampedValue.toFixed(precision)));
  };

  return (
    <Box
      sx={{
        display: "grid",
        gridTemplateColumns: "40px 1fr 40px",
        alignItems: "stretch",
        border: "1px solid rgba(255,255,255,0.06)",
        borderRadius: "12px",
        overflow: "hidden",
        backgroundColor: "rgba(2, 6, 23, 0.45)",
        height: "42px"
      }}
    >
      <IconButton
        type="button"
        size="small"
        onClick={() => updateValue(value - step)}
        sx={{ borderRadius: 0, color: "text.secondary", "&:hover": { backgroundColor: "rgba(255,255,255,0.03)" } }}
      >
        <Minus size={14} />
      </IconButton>
      <TextField
        type="number"
        value={value}
        onChange={(e) => updateValue(Number(e.target.value || 0))}
        variant="standard"
        slotProps={{
          input: {
            disableUnderline: true,
            endAdornment: suffix ? (
              <InputAdornment position="end" sx={{ mr: 1 }}>
                <Typography sx={{ fontSize: "0.82rem", fontWeight: 600, color: "text.secondary" }}>{suffix}</Typography>
              </InputAdornment>
            ) : undefined,
            inputProps: {
              step,
              min,
              style: { textAlign: "center", fontFamily: "Outfit, monospace", fontWeight: 600, padding: "9px 4px", fontSize: "0.95rem", color: "#ffffff" }
            }
          }
        }}
        sx={{
          justifyContent: "center",
          "& input::-webkit-outer-spin-button, & input::-webkit-inner-spin-button": { WebkitAppearance: "none", margin: 0 },
          "& input[type=number]": { MozAppearance: "textfield" }
        }}
      />
      <IconButton
        type="button"
        size="small"
        onClick={() => updateValue(value + step)}
        sx={{ borderRadius: 0, color: "text.secondary", "&:hover": { backgroundColor: "rgba(255,255,255,0.03)" } }}
      >
        <Plus size={14} />
      </IconButton>
    </Box>
  );
}

export function SettingsView({
  botConfig,
  updateBotConfigDraft,
  actionLoading = false,
  allSymbols = [],
  autoSaveState,
}: SettingsViewProps) {
  const [tabIndex, setTabIndex] = useState(0);
  const [confirmLiveOpen, setConfirmLiveOpen] = useState(false);
  const [selectedSymbolToAdd, setSelectedSymbolToAdd] = useState<string | null>(null);
  const [strategies, setStrategies] = useState<StrategyInfo[]>([]);
  const [strategiesLoading, setStrategiesLoading] = useState(false);

  // Credentials States
  const [dbUsername, setDbUsername] = useState("");
  const [dbPassword, setDbPassword] = useState("");
  const [apiKey, setApiKey] = useState("");
  const [apiSecret, setApiSecret] = useState("");
  const [maskedKey, setMaskedKey] = useState("");
  const [maskedSecret, setMaskedSecret] = useState("");
  const [credLoading, setCredLoading] = useState(false);
  const [credSaveLoading, setCredSaveLoading] = useState(false);
  const [credMsg, setCredMsg] = useState({ type: "", text: "" });

  const fetchCredentials = async () => {
    setCredLoading(true);
    try {
      const res = await fetch("/api/settings/credentials");
      if (res.ok) {
        const data = await res.json();
        if (data.status === "success") {
          setDbUsername(data.username || "");
          setMaskedKey(data.api_key_masked || "");
          setMaskedSecret(data.api_secret_masked || "");
        }
      }
    } catch (err) {
      console.error("Failed to fetch credentials", err);
    } finally {
      setCredLoading(false);
    }
  };

  React.useEffect(() => {
    if (tabIndex === 4) {
      fetchCredentials();
    }
  }, [tabIndex]);

  const handleUpdateCredentials = async (e: React.FormEvent) => {
    e.preventDefault();
    setCredSaveLoading(true);
    setCredMsg({ type: "", text: "" });
    try {
      const res = await fetch("/api/settings/credentials", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          username: dbUsername,
          password: dbPassword || undefined,
          api_key: apiKey || undefined,
          api_secret: apiSecret || undefined,
        }),
      });
      if (res.ok) {
        const data = await res.json();
        if (data.status === "success") {
          setCredMsg({ type: "success", text: "บันทึกข้อมูลและอัปเดต API การเชื่อมต่อเรียบร้อยแล้ว!" });
          setApiKey("");
          setApiSecret("");
          setDbPassword("");
          fetchCredentials();
        } else {
          setCredMsg({ type: "error", text: data.message || "เกิดข้อผิดพลาดในการบันทึกข้อมูล" });
        }
      } else {
        setCredMsg({ type: "error", text: "ไม่สามารถบันทึกข้อมูลไปยังเซิร์ฟเวอร์ได้" });
      }
    } catch (err) {
      setCredMsg({ type: "error", text: "การเชื่อมต่อเซิร์ฟเวอร์ขัดข้อง" });
    } finally {
      setCredSaveLoading(false);
    }
  };

  // Fetch available strategies from backend
  React.useEffect(() => {
    const fetchStrategies = async () => {
      setStrategiesLoading(true);
      try {
        const res = await fetch("/api/bot/strategies");
        if (res.ok) {
          const data = await res.json();
          if (data.status === "success") {
            setStrategies(data.strategies || []);
          }
        }
      } catch (err) {
        console.error("Failed to fetch strategies", err);
      } finally {
        setStrategiesLoading(false);
      }
    };
    fetchStrategies();
  }, []);

  const DEFAULT_SYMBOLS = [
    "BTC/THB", "ETH/THB", "SOL/THB", "NEAR/THB", "XRP/THB",
    "DOGE/THB", "ADA/THB", "SUI/THB", "OP/THB", "XLM/THB",
    "BNB/THB", "WLD/THB", "KUB/THB", "ONDO/THB", "GALA/THB",
    "CRV/THB", "HBAR/THB", "BCH/THB"
  ];

  const handleDeleteSymbol = (symbolToDelete: string) => {
    const updated = (botConfig.symbols || []).filter((s) => s !== symbolToDelete);
    updateBotConfigDraft({ symbols: updated });
  };

  const handleAddSymbol = () => {
    if (!selectedSymbolToAdd) return;
    if ((botConfig.symbols || []).includes(selectedSymbolToAdd)) return;
    const updated = [...(botConfig.symbols || []), selectedSymbolToAdd];
    updateBotConfigDraft({ symbols: updated });
    setSelectedSymbolToAdd(null);
  };

  const handleResetDefaultSymbols = () => {
    updateBotConfigDraft({ symbols: DEFAULT_SYMBOLS });
  };

  const availableSymbolsToAdd = (allSymbols || []).filter(
    (sym) => !(botConfig.symbols || []).includes(sym)
  );

  const suggestedCoins = ["BTC/THB", "ETH/THB", "SOL/THB", "KUB/THB", "NEAR/THB", "DOGE/THB", "XRP/THB", "ADA/THB"]
    .filter((coin) => !(botConfig.symbols || []).includes(coin) && (allSymbols || []).includes(coin));

  const handleModeChange = (isDry: boolean) => {
    if (!isDry) {
      setConfirmLiveOpen(true);
    } else {
      updateBotConfigDraft({ dry_run: true });
    }
  };

  const confirmLiveSwitch = () => {
    updateBotConfigDraft({ dry_run: false });
    setConfirmLiveOpen(false);
  };



  // Strategy Risk calculation logic
  const sl = Math.abs(botConfig.stop_loss_pct || 5);
  const tp = Math.abs(botConfig.take_profit_pct || 10);
  const maxTrades = botConfig.max_open_trades || 3;
  const riskScore = sl * 0.4 + tp * 0.3 + maxTrades * 1.5;

  let riskLabel = "เสี่ยงต่ำ (Low Risk)";
  let riskColor = "#00c16a"; // Emerald
  let riskBg = "rgba(0, 193, 106, 0.03)";
  let riskDescription = "กลยุทธ์จำกัดความเสียหายได้ดี เหมาะสำหรับการเทรดปลอดภัยในระยะยาว";

  if (riskScore > 12) {
    riskLabel = "เสี่ยงสูงมาก (High Speculative)";
    riskColor = "#ef5b63"; // Rose
    riskBg = "rgba(239, 91, 99, 0.03)";
    riskDescription = "คำเตือน: กลยุทธ์เก็งกำไรระดับสูงมาก มีโอกาสการเกิด Drawdown ลึกสูงกว่าปกติ";
  } else if (riskScore > 6) {
    riskLabel = "เสี่ยงปานกลาง (Balanced Risk)";
    riskColor = "#fbbf24"; // Amber
    riskBg = "rgba(251, 191, 36, 0.03)";
    riskDescription = "กลยุทธ์แบบสมดุล มุ่งเน้นการเติบโตของกำไรอย่างมั่นคงในสภาวะตลาดปกติ";
  }

  return (
    <Box sx={{ width: "100%", maxWidth: "none", mx: 0, py: 0 }}>
      <Card
        sx={{
          background: "rgba(8, 12, 20, 0.72)",
          backdropFilter: "blur(24px)",
          border: botConfig.dry_run 
            ? "1px solid rgba(148, 163, 184, 0.15)"
            : "1px solid rgba(0, 193, 106, 0.15)",
          borderRadius: "20px",
          boxShadow: botConfig.dry_run
            ? "0 9px 32px 0 rgba(0, 0, 0, 0.2)"
            : "0 9px 32px 0 rgba(0, 193, 106, 0.05)",
          transition: "all 0.3s ease",
        }}
      >
        <CardContent sx={{ p: { xs: 1.5, sm: 2 } }}>
          <Stack spacing={1}>
            {/* Header Title */}
            <Box sx={{ display: "flex", alignItems: "center", gap: 1, pb: 0.5 }}>
              <Box
                sx={{
                  p: 1.2,
                  backgroundColor: botConfig.dry_run ? "rgba(148, 163, 184, 0.08)" : "rgba(0, 193, 106, 0.08)",
                  color: botConfig.dry_run ? "#94a3b8" : "primary.main",
                  borderRadius: "12px",
                  display: "flex",
                  transition: "all 0.3s ease",
                }}
              >
                <Sliders size={20} />
              </Box>
              <Box>
                <Typography sx={{ fontWeight: 600, fontSize: "1.15rem", fontFamily: "Outfit, sans-serif" }}>
                  การตั้งค่าระบบบอทเทรด
                </Typography>
                <Typography sx={{ fontSize: "0.82rem", color: "text.secondary", mt: 0.3 }}>
                  ปรับปรุงและจูนพารามิเตอร์การทำงานหลักของระบบเทรดอัจฉริยะ Bitkub
                </Typography>
              </Box>
            </Box>

            {/* Premium Tab Bar Navigation */}
            <Tabs
              value={tabIndex}
              onChange={(_, newValue) => setTabIndex(newValue)}
              variant="fullWidth"
              sx={{
                backgroundColor: "rgba(13, 20, 35, 0.55)",
                borderRadius: "14px",
                p: 0.5,
                border: "1px solid rgba(255, 255, 255, 0.04)",
                "& .MuiTabs-indicator": {
                  backgroundColor: botConfig.dry_run ? "#94a3b8" : "primary.main",
                  borderRadius: "11px",
                  height: "100%",
                  opacity: 0.08,
                },
                "& .MuiTab-root": {
                  minHeight: "42px",
                  fontSize: "0.85rem",
                  fontWeight: 600,
                  borderRadius: "11px",
                  color: "text.secondary",
                  textTransform: "none",
                  transition: "all 0.25s ease",
                  gap: 1,
                  "&.Mui-selected": {
                    color: botConfig.dry_run ? "#94a3b8" : "primary.main",
                    backgroundColor: "rgba(255, 255, 255, 0.02)",
                  },
                  "&:hover": {
                    color: "text.primary",
                    backgroundColor: "rgba(255, 255, 255, 0.01)",
                  }
                }
              }}
            >
              <Tab icon={<Shield size={14} />} iconPosition="start" label="โหมดการทำงาน" />
              <Tab icon={<Brain size={14} />} iconPosition="start" label="กลยุทธ์การเทรด" />
              <Tab icon={<Coins size={14} />} iconPosition="start" label="สแกนคู่เหรียญ" />
              <Tab icon={<Activity size={14} />} iconPosition="start" label="พารามิเตอร์เทรด" />
              <Tab icon={<Key size={14} />} iconPosition="start" label="Bitkub API" />
            </Tabs>

            <Divider sx={{ borderColor: "rgba(255,255,255,0.05)" }} />

            {/* TAB PANEL 0: Trading Mode */}
            {tabIndex === 0 && (
              <Stack spacing={1.5}>
                <Box>
                  <Typography
                    sx={{
                      fontSize: "0.88rem",
                      fontWeight: 600,
                      color: "text.primary",
                      textTransform: "uppercase",
                      letterSpacing: "0.08em",
                      mb: 0.5,
                    }}
                  >
                    เลือกโหมดปฏิบัติการบอท (Operation Mode)
                  </Typography>
                  <Typography sx={{ fontSize: "0.82rem", color: "text.secondary" }}>
                    สลับระหว่างโหมดเทรดจำลองเพื่อความปลอดภัย หรือต่อตรงกระเป๋าเงินจริงเข้าตลาด
                  </Typography>
                </Box>

                <Box
                  sx={{
                    display: "grid",
                    gridTemplateColumns: { xs: "1fr", sm: "1fr 1fr" },
                    gap: 1,
                    p: 0.5,
                  }}
                >
                  {/* Dry Run Option Box */}
                  <Paper
                    onClick={() => handleModeChange(true)}
                    sx={{
                      p: 2.5,
                      borderRadius: "16px",
                      cursor: "pointer",
                      backgroundColor: botConfig.dry_run ? "rgba(148, 163, 184, 0.04)" : "rgba(13, 20, 35, 0.3)",
                      border: botConfig.dry_run ? "1.5px solid rgba(148, 163, 184, 0.4)" : "1.5px solid rgba(255, 255, 255, 0.03)",
                      boxShadow: botConfig.dry_run ? "0 0 15px rgba(148, 163, 184, 0.05)" : "none",
                      transition: "all 0.2s ease",
                      "&:hover": {
                        borderColor: botConfig.dry_run ? "rgba(148, 163, 184, 0.6)" : "rgba(255, 255, 255, 0.08)",
                        backgroundColor: botConfig.dry_run ? "rgba(148, 163, 184, 0.06)" : "rgba(255, 255, 255, 0.01)",
                      }
                    }}
                  >
                    <Stack spacing={1.5}>
                      <Box sx={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                        <Typography sx={{ fontWeight: 600, fontSize: "0.95rem", color: botConfig.dry_run ? "#94a3b8" : "text.secondary" }}>
                          🧪 Dry-Run Mode
                        </Typography>
                        {botConfig.dry_run && <Chip label="ACTIVE" size="small" sx={{ height: 16, fontSize: "9px", fontWeight: 600, backgroundColor: "rgba(148, 163, 184, 0.15)", color: "#94a3b8", border: "1px solid rgba(148, 163, 184, 0.3)" }} />}
                      </Box>
                      <Typography sx={{ fontSize: "0.82rem", color: "text.secondary", lineHeight: 1.5 }}>
                        โหมดจำลองการซื้อขายโดยใช้ยอดเงินและราคาจริงเพื่อทดสอบอัลกอริทึม ปลอดภัย 100% ไม่ส่งคำสั่งซื้อไปยัง Bitkub
                      </Typography>
                    </Stack>
                  </Paper>

                  {/* Live Mode Option Box */}
                  <Paper
                    onClick={() => handleModeChange(false)}
                    sx={{
                      p: 2.5,
                      borderRadius: "16px",
                      cursor: "pointer",
                      backgroundColor: !botConfig.dry_run ? "rgba(0, 193, 106, 0.03)" : "rgba(13, 20, 35, 0.3)",
                      border: !botConfig.dry_run ? "1.5px solid rgba(0, 193, 106, 0.4)" : "1.5px solid rgba(255, 255, 255, 0.03)",
                      boxShadow: !botConfig.dry_run ? "0 0 15px rgba(0, 193, 106, 0.05)" : "none",
                      transition: "all 0.2s ease",
                      "&:hover": {
                        borderColor: !botConfig.dry_run ? "rgba(0, 193, 106, 0.6)" : "rgba(255, 255, 255, 0.08)",
                        backgroundColor: !botConfig.dry_run ? "rgba(0, 193, 106, 0.05)" : "rgba(255, 255, 255, 0.01)",
                      }
                    }}
                  >
                    <Stack spacing={1.5}>
                      <Box sx={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                        <Typography sx={{ fontWeight: 600, fontSize: "0.95rem", color: !botConfig.dry_run ? "primary.main" : "text.secondary" }}>
                          ⚡ LIVE Trade Mode
                        </Typography>
                        {!botConfig.dry_run && <Chip label="ACTIVE" color="primary" size="small" sx={{ height: 16, fontSize: "9px", fontWeight: 500 }} />}
                      </Box>
                      <Typography sx={{ fontSize: "0.82rem", color: "text.secondary", lineHeight: 1.5 }}>
                        โหมดสั่งซื้อขายด้วยเงินจริงผ่าน API ของท่าน ออร์เดอร์ส่งลงกระดาน Bitkub ทันทีที่มีสัญญาณการซื้อขาย
                      </Typography>
                    </Stack>
                  </Paper>
                </Box>

                {/* Info Banners */}
                {botConfig.dry_run ? (
                  <Alert
                    severity="info"
                    icon={<ShieldCheck size={18} />}
                    sx={{
                      borderRadius: "14px",
                      backgroundColor: "rgba(255, 255, 255, 0.015)",
                      border: "1px solid rgba(255, 255, 255, 0.05)",
                      color: "text.secondary",
                      fontSize: "0.82rem",
                      "& .MuiAlert-icon": { color: "#94a3b8" },
                    }}
                  >
                    <strong>การป้องกันความปลอดภัย:</strong> ระบบแยกพอร์ตการซื้อขายและประวัติประมูลจำลองออกจากเงินจริงเด็ดขาดเพื่อไม่ให้เกิดความสับสน
                  </Alert>
                ) : (
                  <Alert
                    severity="success"
                    icon={<ShieldCheck size={18} />}
                    sx={{
                      borderRadius: "14px",
                      backgroundColor: "rgba(0, 193, 106, 0.02)",
                      border: "1px solid rgba(0, 193, 106, 0.1)",
                      color: "primary.light",
                      fontSize: "0.82rem",
                      "& .MuiAlert-icon": { color: "primary.main" },
                    }}
                  >
                    <strong>การใช้งานเงินจริง:</strong> ระบบกำลังพร้อมเชื่อมตรงบัญชี Bitkub ของท่าน ออร์เดอร์จะถูกซื้อขายด้วยเงินจริงทันทีตามเงื่อนไขที่กำหนด
                  </Alert>
                )}
              </Stack>
            )}

            {/* TAB PANEL 1: Strategy Selection */}
            {tabIndex === 1 && (
              <Stack spacing={1.5}>
                <Box>
                  <Typography
                    sx={{
                      fontSize: "0.88rem",
                      fontWeight: 600,
                      color: "text.primary",
                      textTransform: "uppercase",
                      letterSpacing: "0.08em",
                      mb: 0.5,
                    }}
                  >
                    เลือกกลยุทธ์การเทรด (Trading Strategy)
                  </Typography>
                  <Typography sx={{ fontSize: "0.82rem", color: "text.secondary" }}>
                    กลยุทธ์กำหนดเงื่อนไขการเข้าซื้อและขายของบอทตามอินดิเคเตอร์ทางเทคนิค สามารถสลับเปลี่ยนได้ตลอดเวลา
                  </Typography>
                </Box>

                {strategiesLoading ? (
                  <Box sx={{ display: "flex", justifyContent: "center", py: 4 }}>
                    <Typography sx={{ fontSize: "0.85rem", color: "text.secondary" }}>กำลังโหลดกลยุทธ์...</Typography>
                  </Box>
                ) : (
                  <Stack spacing={1}>
                    {strategies.map((strat) => {
                      const isActive = (botConfig.strategy || "multi_indicator") === strat.id;
                      const riskColors: Record<string, { color: string; label: string }> = {
                        low: { color: "#00c16a", label: "เสี่ยงต่ำ" },
                        medium: { color: "#fbbf24", label: "เสี่ยงปานกลาง" },
                        high: { color: "#ef5b63", label: "เสี่ยงสูง" },
                      };
                      const risk = riskColors[strat.risk_level] || riskColors.medium;

                      return (
                        <Paper
                          key={strat.id}
                          onClick={() => updateBotConfigDraft({ strategy: strat.id } as Partial<BotConfig>)}
                          sx={{
                            p: 2.5,
                            borderRadius: "16px",
                            cursor: "pointer",
                            backgroundColor: isActive ? "rgba(0, 193, 106, 0.03)" : "rgba(13, 20, 35, 0.3)",
                            border: isActive ? "1.5px solid rgba(0, 193, 106, 0.4)" : "1.5px solid rgba(255, 255, 255, 0.03)",
                            boxShadow: isActive ? "0 0 20px rgba(0, 193, 106, 0.05)" : "none",
                            transition: "all 0.25s ease",
                            "&:hover": {
                              borderColor: isActive ? "rgba(0, 193, 106, 0.6)" : "rgba(255, 255, 255, 0.1)",
                              backgroundColor: isActive ? "rgba(0, 193, 106, 0.05)" : "rgba(255, 255, 255, 0.015)",
                              transform: "translateY(-1px)",
                            },
                          }}
                        >
                          <Stack spacing={1.5}>
                            {/* Header */}
                            <Box sx={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 1 }}>
                              <Stack direction="row" spacing={1} sx={{ alignItems: "center" }}>
                                <Box
                                  sx={{
                                    width: 32,
                                    height: 32,
                                    borderRadius: "10px",
                                    display: "flex",
                                    alignItems: "center",
                                    justifyContent: "center",
                                    backgroundColor: isActive ? "rgba(0, 193, 106, 0.1)" : "rgba(255, 255, 255, 0.04)",
                                    transition: "all 0.2s ease",
                                  }}
                                >
                                  <Brain size={16} style={{ color: isActive ? "#00c16a" : "#94a3b8" }} />
                                </Box>
                                <Typography sx={{ fontWeight: 600, fontSize: "0.95rem", color: isActive ? "primary.main" : "text.primary" }}>
                                  {strat.name}
                                </Typography>
                              </Stack>
                              <Stack direction="row" spacing={0.5}>
                                <Chip
                                  label={risk.label}
                                  size="small"
                                  sx={{
                                    height: 18,
                                    fontSize: "9px",
                                    fontWeight: 600,
                                    backgroundColor: `${risk.color}10`,
                                    color: risk.color,
                                    border: `1px solid ${risk.color}30`,
                                  }}
                                />
                                {isActive && (
                                  <Chip
                                    label="ACTIVE"
                                    color="primary"
                                    size="small"
                                    sx={{ height: 18, fontSize: "9px", fontWeight: 600 }}
                                  />
                                )}
                              </Stack>
                            </Box>

                            {/* Description */}
                            <Typography sx={{ fontSize: "0.82rem", color: "text.secondary", lineHeight: 1.55 }}>
                              {strat.description}
                            </Typography>

                            {/* Indicators */}
                            <Box sx={{ display: "flex", flexWrap: "wrap", gap: 0.5 }}>
                              {strat.indicators.map((ind) => (
                                <Chip
                                  key={ind}
                                  label={ind}
                                  size="small"
                                  sx={{
                                    height: 20,
                                    fontSize: "0.7rem",
                                    fontWeight: 500,
                                    backgroundColor: "rgba(255, 255, 255, 0.02)",
                                    color: "text.secondary",
                                    border: "1px solid rgba(255, 255, 255, 0.05)",
                                    borderRadius: "6px",
                                  }}
                                />
                              ))}
                            </Box>

                            {/* Buy/Sell Logic — collapsible detail */}
                            <Box
                              sx={{
                                display: "grid",
                                gridTemplateColumns: { xs: "1fr", sm: "1fr 1fr" },
                                gap: 1,
                                mt: 0.5,
                              }}
                            >
                              <Box
                                sx={{
                                  p: 1.5,
                                  borderRadius: "10px",
                                  backgroundColor: "rgba(0, 193, 106, 0.02)",
                                  border: "1px solid rgba(0, 193, 106, 0.06)",
                                }}
                              >
                                <Typography sx={{ fontSize: "0.72rem", fontWeight: 600, color: "#00c16a", textTransform: "uppercase", letterSpacing: "0.05em", mb: 0.3 }}>
                                  🟢 เงื่อนไขซื้อ (Buy)
                                </Typography>
                                <Typography sx={{ fontSize: "0.75rem", color: "text.secondary", lineHeight: 1.4 }}>
                                  {strat.buy_logic}
                                </Typography>
                              </Box>
                              <Box
                                sx={{
                                  p: 1.5,
                                  borderRadius: "10px",
                                  backgroundColor: "rgba(239, 91, 99, 0.02)",
                                  border: "1px solid rgba(239, 91, 99, 0.06)",
                                }}
                              >
                                <Typography sx={{ fontSize: "0.72rem", fontWeight: 600, color: "#ef5b63", textTransform: "uppercase", letterSpacing: "0.05em", mb: 0.3 }}>
                                  🔴 เงื่อนไขขาย (Sell)
                                </Typography>
                                <Typography sx={{ fontSize: "0.75rem", color: "text.secondary", lineHeight: 1.4 }}>
                                  {strat.sell_logic}
                                </Typography>
                              </Box>
                            </Box>
                          </Stack>
                        </Paper>
                      );
                    })}
                  </Stack>
                )}

                <Alert
                  severity="info"
                  icon={<Info size={16} />}
                  sx={{
                    borderRadius: "14px",
                    backgroundColor: "rgba(255, 255, 255, 0.015)",
                    border: "1px solid rgba(255, 255, 255, 0.05)",
                    color: "text.secondary",
                    fontSize: "0.82rem",
                    "& .MuiAlert-icon": { color: "#94a3b8" },
                  }}
                >
                  การเปลี่ยนกลยุทธ์จะมีผลในรอบสแกนถัดไปของบอท ตำแหน่งถือครองที่เปิดค้างไว้จะยังคงใช้เกณฑ์ TP/SL ตามปกติ
                </Alert>
              </Stack>
            )}

            {/* TAB PANEL 2: Coin Scanner Setup */}
            {tabIndex === 2 && (
              <Stack spacing={1.5}>
                <Box sx={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 1 }}>
                  <Box>
                    <Typography
                      sx={{
                        fontSize: "0.88rem",
                        fontWeight: 600,
                        color: "text.primary",
                        textTransform: "uppercase",
                        letterSpacing: "0.08em",
                        mb: 0.5,
                      }}
                    >
                      ลิสต์เป้าหมายสแกน ({botConfig.symbols?.length || 0} เหรียญ)
                    </Typography>
                    <Typography sx={{ fontSize: "0.82rem", color: "text.secondary" }}>
                      บอทจะคำนวณสัญญาณทางเทคนิคและสแกนเฉพาะเหรียญที่กำหนดไว้ในรายการนี้เท่านั้น
                    </Typography>
                  </Box>
                  <Button
                    onClick={handleResetDefaultSymbols}
                    variant="outlined"
                    size="small"
                    sx={{
                      fontSize: "11px",
                      fontWeight: 500,
                      borderColor: "rgba(255,255,255,0.08)",
                      color: "text.primary",
                      textTransform: "none",
                      borderRadius: "9px",
                      px: 2,
                      py: 0.5,
                      "&:hover": { borderColor: "rgba(255,255,255,0.18)", backgroundColor: "rgba(255,255,255,0.02)" }
                    }}
                  >
                    ใช้ค่าเริ่มต้น (18 เหรียญ)
                  </Button>
                </Box>

                {/* Active Coins Section */}
                <Box 
                  sx={{ 
                    display: "flex", 
                    flexWrap: "wrap", 
                    gap: 1, 
                    p: 2, 
                    borderRadius: "16px", 
                    backgroundColor: "rgba(2, 6, 23, 0.45)", 
                    border: "1px solid rgba(255, 255, 255, 0.03)",
                    minHeight: "100px",
                    alignContent: "flex-start",
                  }}
                >
                  {(!botConfig.symbols || botConfig.symbols.length === 0) ? (
                    <Typography sx={{ fontSize: "0.82rem", color: "text.secondary", m: "auto" }}>
                      ไม่มีเหรียญเปิดสแกนขณะนี้ กรุณาพิมพ์เพิ่มอย่างน้อย 1 คู่เหรียญ
                    </Typography>
                  ) : (
                    botConfig.symbols.map((sym) => (
                      <Chip
                        key={sym}
                        label={sym}
                        onDelete={() => handleDeleteSymbol(sym)}
                        size="small"
                        sx={{
                          fontWeight: 500,
                          fontSize: "0.8rem",
                          border: "1px solid rgba(255,255,255,0.06)",
                          backgroundColor: "rgba(255,255,255,0.02)",
                          color: "text.primary",
                          borderRadius: "9px",
                          transition: "all 0.15s ease",
                          "&:hover": {
                            backgroundColor: "rgba(239, 91, 99, 0.05)",
                            borderColor: "rgba(239, 91, 99, 0.2)",
                          },
                          "& .MuiChip-deleteIcon": {
                            color: "rgba(255, 255, 255, 0.3)",
                            fontSize: "14px",
                            "&:hover": { color: "#ef5b63" }
                          }
                        }}
                      />
                    ))
                  )}
                </Box>

                {/* Coin Input Form */}
                <Box sx={{ display: "grid", gridTemplateColumns: "1fr auto", gap: 1, alignItems: "center" }}>
                  <Autocomplete
                    options={availableSymbolsToAdd}
                    value={selectedSymbolToAdd}
                    onChange={(_, newValue) => setSelectedSymbolToAdd(newValue)}
                    size="small"
                    autoHighlight
                    clearOnEscape
                    slotProps={{
                      paper: {
                        sx: {
                          backgroundColor: "#0d1321",
                          border: "1px solid rgba(255, 255, 255, 0.08)",
                          color: "text.primary",
                          "& .MuiAutocomplete-option": {
                            fontSize: "0.88rem",
                            color: "text.primary",
                            "&[aria-selected='true']": {
                              backgroundColor: "rgba(0, 193, 106, 0.15)",
                            },
                            "&.Mui-focused, &[data-focus='true']": {
                              backgroundColor: "rgba(255, 255, 255, 0.05)",
                            },
                            "&:hover": {
                              backgroundColor: "rgba(0, 193, 106, 0.08)",
                            }
                          }
                        }
                      }
                    }}
                    renderInput={(params) => (
                      <TextField 
                        {...params} 
                        label="ค้นหาคู่เหรียญเพื่อสแกนเพิ่ม (เช่น ADA/THB)" 
                        variant="outlined"
                        sx={{
                          "& label": { fontSize: "0.82rem", color: "text.secondary" },
                          "& input": { fontSize: "0.88rem", color: "text.primary" },
                          "& .MuiOutlinedInput-root": {
                            borderRadius: "12px",
                            "& fieldset": { borderColor: "rgba(255, 255, 255, 0.08)" },
                            "&:hover fieldset": { borderColor: "rgba(255, 255, 255, 0.15)" },
                          }
                        }}
                      />
                    )}
                    sx={{ width: "100%" }}
                  />
                  <Button
                    onClick={handleAddSymbol}
                    disabled={!selectedSymbolToAdd}
                    variant="contained"
                    sx={{
                      py: 1.1,
                      px: 3,
                      height: "40px",
                      fontSize: "0.85rem",
                      fontWeight: 600,
                      borderRadius: "12px",
                      backgroundColor: "primary.main",
                      color: "#17201a",
                      "&:hover": { backgroundColor: "primary.light" },
                      "&.Mui-disabled": {
                        backgroundColor: "rgba(255, 255, 255, 0.05)",
                        color: "text.disabled"
                      }
                    }}
                  >
                    เพิ่มคู่เหรียญ
                  </Button>
                </Box>

                {/* Suggested Section */}
                {suggestedCoins.length > 0 && (
                  <Stack spacing={1}>
                    <Typography sx={{ fontSize: "0.78rem", fontWeight: 500, color: "text.secondary", textTransform: "uppercase", letterSpacing: "0.05em" }}>
                      คู่เหรียญยอดนิยมแนะนำเพื่อสแกนเพิ่ม (Suggested Coins)
                    </Typography>
                    <Box sx={{ display: "flex", flexWrap: "wrap", gap: 1 }}>
                      {suggestedCoins.slice(0, 10).map((coin) => (
                        <Chip
                          key={coin}
                          label={`+ ${coin}`}
                          onClick={() => {
                            const updated = [...(botConfig.symbols || []), coin];
                            updateBotConfigDraft({ symbols: updated });
                          }}
                          size="small"
                          sx={{
                            fontSize: "0.75rem",
                            fontWeight: 500,
                            backgroundColor: "rgba(255,255,255,0.02)",
                            color: "text.secondary",
                            border: "1px solid rgba(255,255,255,0.04)",
                            borderRadius: "6px",
                            cursor: "pointer",
                            "&:hover": {
                              backgroundColor: "rgba(0, 193, 106, 0.08)",
                              borderColor: "rgba(0, 193, 106, 0.15)",
                              color: "primary.main"
                            }
                          }}
                        />
                      ))}
                    </Box>
                  </Stack>
                )}
              </Stack>
            )}

            {/* TAB PANEL 3: Strategy Parameters */}
            {tabIndex === 3 && (
              <Stack spacing={1.5}>
                <Box>
                  <Typography
                    sx={{
                      fontSize: "0.88rem",
                      fontWeight: 600,
                      color: "text.primary",
                      textTransform: "uppercase",
                      letterSpacing: "0.08em",
                      mb: 0.5,
                    }}
                  >
                    พารามิเตอร์เทรด & การคุมเสี่ยง (Strategy Parameters)
                  </Typography>
                  <Typography sx={{ fontSize: "0.82rem", color: "text.secondary" }}>
                    ปรับการคำนวณวงเงินต่อออร์เดอร์ ไม้ถือครองสูงสุด ขอบเขตการทำกำไรและควบคุมความสูญเสีย
                  </Typography>
                </Box>

                <Box
                  sx={{
                    display: "grid",
                    gridTemplateColumns: { xs: "1fr", sm: "1fr 1fr" },
                    gap: 1.5
                  }}
                >
                  <Stack spacing={1} sx={{ gridColumn: { sm: "span 2" } }}>
                    <Typography sx={{ fontSize: "0.82rem", fontWeight: 600, color: "text.secondary", textTransform: "uppercase", letterSpacing: "0.05em" }}>
                      งบลงทุนของบอทสูงสุด (Max Budget THB)
                    </Typography>
                    <NumberStepper
                      value={botConfig.max_budget_thb ?? 5000}
                      step={500}
                      min={100}
                      suffix="THB"
                      onChange={(value) => updateBotConfigDraft({ max_budget_thb: value })}
                    />
                    <Typography sx={{ fontSize: "0.75rem", color: "text.secondary" }}>
                      จำกัดงบประมาณรวมสูงสุดที่บอทใช้ซื้อเหรียญถือครองพร้อมกันทั้งหมด เพื่อความปลอดภัยป้องกันไม่ให้บอทเทรดจนเกินงบที่ต้องการ
                    </Typography>
                  </Stack>

                  <Stack spacing={1}>
                    <Typography sx={{ fontSize: "0.82rem", fontWeight: 600, color: "text.secondary", textTransform: "uppercase", letterSpacing: "0.05em" }}>
                      เงินทุนต่อไม้ (Stake Amount)
                    </Typography>
                    <NumberStepper
                      value={botConfig.stake_amount_thb ?? 100}
                      step={1}
                      min={10}
                      suffix="THB"
                      onChange={(value) => updateBotConfigDraft({ stake_amount_thb: value })}
                    />
                    <Typography sx={{ fontSize: "0.75rem", color: "text.secondary" }}>
                      จำกัดงบประมาณต่อออร์เดอร์ที่ใช้เปิดตำแหน่ง
                    </Typography>
                  </Stack>

                  <Stack spacing={1}>
                    <Typography sx={{ fontSize: "0.82rem", fontWeight: 600, color: "text.secondary", textTransform: "uppercase", letterSpacing: "0.05em" }}>
                      จำนวนไม้เทรดสูงสุด (Max Open Trades)
                    </Typography>
                    <NumberStepper
                      value={botConfig.max_open_trades ?? 3}
                      step={1}
                      min={1}
                      onChange={(value) => updateBotConfigDraft({ max_open_trades: Math.max(1, Math.round(value)) })}
                    />
                    <Typography sx={{ fontSize: "0.75rem", color: "text.secondary" }}>
                      จำกัดจำนวนเหรียญที่ถือครองพร้อมกันทั้งหมด
                    </Typography>
                  </Stack>

                  <Stack spacing={1}>
                    <Typography sx={{ fontSize: "0.82rem", fontWeight: 600, color: "text.secondary", textTransform: "uppercase", letterSpacing: "0.05em" }}>
                      เป้าหมายกำไร (Take Profit)
                    </Typography>
                    <NumberStepper
                      value={botConfig.take_profit_pct ?? 10}
                      step={1}
                      min={0.1}
                      suffix="%"
                      onChange={(value) => updateBotConfigDraft({ take_profit_pct: value })}
                    />
                    <Typography sx={{ fontSize: "0.75rem", color: "text.secondary" }}>
                      ระบบทำการขายเก็บกำไรเมื่อราคาสูงขึ้นถึงเกณฑ์เป้าหมายนี้
                    </Typography>
                  </Stack>

                  <Stack spacing={1}>
                    <Typography sx={{ fontSize: "0.82rem", fontWeight: 600, color: "text.secondary", textTransform: "uppercase", letterSpacing: "0.05em" }}>
                      ขีดจำกัดการขาดทุน (Stop Loss)
                    </Typography>
                    <NumberStepper
                      value={botConfig.stop_loss_pct ?? -5}
                      step={1}
                      suffix="%"
                      onChange={(value) => updateBotConfigDraft({ stop_loss_pct: value })}
                    />
                    <Typography sx={{ fontSize: "0.75rem", color: "text.secondary" }}>
                      ระบบตัดสินใจคัตขายขาดทุนเมื่อราคาดิ่งลงต่ำกว่าต้นทุน
                    </Typography>
                  </Stack>
                </Box>

                {/* Advanced Risk Evaluation Card */}
                <Paper
                  sx={{
                    p: 2.5,
                    borderRadius: "16px",
                    backgroundColor: riskBg,
                    border: `1px solid ${riskColor}20`,
                    display: "flex",
                    flexDirection: "column",
                    gap: 1,
                    transition: "all 0.25s ease",
                  }}
                >
                  <Box sx={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                    <Stack direction="row" spacing={1} sx={{ alignItems: "center" }}>
                      <Activity size={15} style={{ color: riskColor }} />
                      <Typography sx={{ fontSize: "0.78rem", fontWeight: 600, color: "text.secondary", textTransform: "uppercase", letterSpacing: "0.05em" }}>
                        ประเมินระดับความเสี่ยงตามตั้งค่าปัจจุบัน
                      </Typography>
                    </Stack>
                    <Chip
                      label={riskLabel}
                      size="small"
                      sx={{
                        backgroundColor: "rgba(255,255,255,0.02)",
                        color: riskColor,
                        border: `1px solid ${riskColor}30`,
                        fontSize: "10px",
                        fontWeight: 500,
                        height: "20px"
                      }}
                    />
                  </Box>
                  <Typography sx={{ fontSize: "0.85rem", color: "text.primary", fontWeight: 600 }}>
                    {riskDescription}
                  </Typography>
                  <Typography sx={{ fontSize: "0.78rem", color: "text.secondary", lineHeight: 1.45 }}>
                    บอทเปิดระบบปฏิบัติการบน Bitkub Spot ตลาดไม่มีกลไกเลเวอเรจขาลงและไม่มีความเสี่ยงด้านการล้างพอร์ต (Liquidation) ทิศทางการซื้อขายเป็น LONG ONLY (ซื้อตอนต่ำเพื่อขายตอนสูง) เท่านั้น การจำกัดไม้และกรอบ TP/SL ถือเป็นหัวใจการประคองมูลค่าพอร์ตหลัก
                  </Typography>
                </Paper>
              </Stack>
            )}

            {/* TAB PANEL 4: API & Password Credentials */}
            {tabIndex === 4 && (
              <Stack spacing={2}>
                <Box>
                  <Typography
                    sx={{
                      fontSize: "0.88rem",
                      fontWeight: 600,
                      color: "text.primary",
                      textTransform: "uppercase",
                      letterSpacing: "0.08em",
                      mb: 0.5,
                    }}
                  >
                    ตั้งค่าการเชื่อมต่อ Bitkub API & บัญชีผู้ใช้
                  </Typography>
                  <Typography sx={{ fontSize: "0.82rem", color: "text.secondary" }}>
                    ตั้งค่า API Key และรหัสความปลอดภัยสำหรับการทำงานแบบ LIVE และอัปเดตชื่อผู้ใช้/รหัสผ่านระบบแดชบอร์ด
                  </Typography>
                </Box>

                {credMsg.text && (
                  <Alert 
                    severity={credMsg.type as any} 
                    sx={{ 
                      borderRadius: "12px", 
                      fontSize: "0.82rem",
                      border: credMsg.type === "success" ? "1px solid rgba(0, 193, 106, 0.15)" : "1px solid rgba(239, 91, 99, 0.15)",
                      backgroundColor: credMsg.type === "success" ? "rgba(0, 193, 106, 0.02)" : "rgba(239, 91, 99, 0.02)"
                    }}
                  >
                    {credMsg.text}
                  </Alert>
                )}

                {credLoading ? (
                  <Box sx={{ display: "flex", justifyContent: "center", py: 4 }}>
                    <CircularProgress size={24} sx={{ color: "primary.main" }} />
                  </Box>
                ) : (
                  <form onSubmit={handleUpdateCredentials}>
                    <Stack spacing={2.5}>
                      <Box sx={{ display: "grid", gridTemplateColumns: { xs: "1fr", sm: "1fr 1fr" }, gap: 2 }}>
                        {/* API Key */}
                        <Stack spacing={1}>
                          <Typography sx={{ fontSize: "0.82rem", fontWeight: 600, color: "text.secondary", textTransform: "uppercase", letterSpacing: "0.05em" }}>
                            Bitkub API Key
                          </Typography>
                          <TextField
                            placeholder={maskedKey || "กรุณากรอก API Key"}
                            value={apiKey}
                            onChange={(e) => setApiKey(e.target.value)}
                            size="small"
                            variant="outlined"
                            sx={{
                              "& input": { fontSize: "0.85rem", color: "#ffffff", fontFamily: "monospace" },
                              "& .MuiOutlinedInput-root": {
                                borderRadius: "12px",
                                backgroundColor: "rgba(2, 6, 23, 0.45)",
                                "& fieldset": { borderColor: "rgba(255, 255, 255, 0.06)" },
                                "&:hover fieldset": { borderColor: "rgba(255, 255, 255, 0.15)" },
                              }
                            }}
                          />
                          <Typography sx={{ fontSize: "0.72rem", color: "text.secondary" }}>
                            คีย์สาธารณะเพื่อดึงข้อมูลบาลานซ์กระเป๋าและประวัติเทรด
                          </Typography>
                        </Stack>

                        {/* API Secret */}
                        <Stack spacing={1}>
                          <Typography sx={{ fontSize: "0.82rem", fontWeight: 600, color: "text.secondary", textTransform: "uppercase", letterSpacing: "0.05em" }}>
                            Bitkub API Secret
                          </Typography>
                          <TextField
                            type="password"
                            placeholder={maskedSecret || "กรุณากรอก API Secret"}
                            value={apiSecret}
                            onChange={(e) => setApiSecret(e.target.value)}
                            size="small"
                            variant="outlined"
                            sx={{
                              "& input": { fontSize: "0.85rem", color: "#ffffff" },
                              "& .MuiOutlinedInput-root": {
                                borderRadius: "12px",
                                backgroundColor: "rgba(2, 6, 23, 0.45)",
                                "& fieldset": { borderColor: "rgba(255, 255, 255, 0.06)" },
                                "&:hover fieldset": { borderColor: "rgba(255, 255, 255, 0.15)" },
                              }
                            }}
                          />
                          <Typography sx={{ fontSize: "0.72rem", color: "text.secondary" }}>
                            รหัสคู่กับ API Key สำหรับยืนยันตัวตนส่งคำสั่งเทรดจริง
                          </Typography>
                        </Stack>

                        {/* Dashboard Username */}
                        <Stack spacing={1}>
                          <Typography sx={{ fontSize: "0.82rem", fontWeight: 600, color: "text.secondary", textTransform: "uppercase", letterSpacing: "0.05em" }}>
                            ชื่อผู้ใช้แดชบอร์ด (Username)
                          </Typography>
                          <TextField
                            value={dbUsername}
                            onChange={(e) => setDbUsername(e.target.value)}
                            size="small"
                            variant="outlined"
                            sx={{
                              "& input": { fontSize: "0.85rem", color: "#ffffff" },
                              "& .MuiOutlinedInput-root": {
                                borderRadius: "12px",
                                backgroundColor: "rgba(2, 6, 23, 0.45)",
                                "& fieldset": { borderColor: "rgba(255, 255, 255, 0.06)" },
                                "&:hover fieldset": { borderColor: "rgba(255, 255, 255, 0.15)" },
                              }
                            }}
                          />
                        </Stack>

                        {/* Dashboard Password */}
                        <Stack spacing={1}>
                          <Typography sx={{ fontSize: "0.82rem", fontWeight: 600, color: "text.secondary", textTransform: "uppercase", letterSpacing: "0.05em" }}>
                            รหัสผ่านใหม่ (Password)
                          </Typography>
                          <TextField
                            type="password"
                            placeholder="เว้นว่างไว้เพื่อใช้รหัสผ่านเดิม"
                            value={dbPassword}
                            onChange={(e) => setDbPassword(e.target.value)}
                            size="small"
                            variant="outlined"
                            sx={{
                              "& input": { fontSize: "0.85rem", color: "#ffffff" },
                              "& .MuiOutlinedInput-root": {
                                borderRadius: "12px",
                                backgroundColor: "rgba(2, 6, 23, 0.45)",
                                "& fieldset": { borderColor: "rgba(255, 255, 255, 0.06)" },
                                "&:hover fieldset": { borderColor: "rgba(255, 255, 255, 0.15)" },
                              }
                            }}
                          />
                        </Stack>
                      </Box>

                      <Button
                        type="submit"
                        disabled={credSaveLoading}
                        variant="contained"
                        sx={{
                          py: 1.2,
                          fontWeight: 600,
                          fontSize: "0.88rem",
                          borderRadius: "12px",
                          backgroundColor: botConfig.dry_run ? "rgba(255, 255, 255, 0.08)" : "primary.main",
                          color: botConfig.dry_run ? "#ffffff" : "#17201a",
                          "&:hover": { 
                            backgroundColor: botConfig.dry_run ? "rgba(255, 255, 255, 0.12)" : "primary.light" 
                          },
                          "&.Mui-disabled": {
                            backgroundColor: "rgba(255, 255, 255, 0.05)",
                            color: "text.disabled"
                          }
                        }}
                      >
                        {credSaveLoading ? "กำลังบันทึกข้อมูล..." : "บันทึกการเชื่อมต่อ & รหัสผ่าน"}
                      </Button>
                    </Stack>
                  </form>
                )}

                <Paper
                  sx={{
                    p: 2.2,
                    borderRadius: "14px",
                    backgroundColor: "rgba(255, 255, 255, 0.015)",
                    border: "1px solid rgba(255, 255, 255, 0.05)",
                    display: "flex",
                    flexDirection: "column",
                    gap: 0.8
                  }}
                >
                  <Stack direction="row" spacing={1} sx={{ alignItems: "center" }}>
                    <Info size={15} style={{ color: "#fbbf24" }} />
                    <Typography sx={{ fontSize: "0.78rem", fontWeight: 600, color: "#fbbf24", textTransform: "uppercase", letterSpacing: "0.05em" }}>
                      วิธีสร้าง API Key จาก Bitkub
                    </Typography>
                  </Stack>
                  <Typography sx={{ fontSize: "0.78rem", color: "text.secondary", lineHeight: 1.5 }}>
                    1. ล็อกอินเข้าสู่เว็บ Bitkub.com &gt; ไปที่หน้า <strong>Settings (ตั้งค่า)</strong> &gt; <strong>API (การจัดการ API)</strong><br />
                    2. กดสร้าง API Key ใหม่ โดยให้สิทธิ์ (Permissions) เฉพาะ <strong>Read Wallet (อ่าน)</strong> และ <strong>Trade (เทรด Spot)</strong> เท่านั้น<br />
                    3. <span style={{ color: "#ef5b63", fontWeight: 600 }}>ห้ามสลับสิทธิ์การถอนเงิน (WITHDRAW) เด็ดขาด</span> เพื่อความปลอดภัยสูงสุดของกระเป๋าพอร์ตคุณเอง<br />
                    4. นำคู่รหัสที่ได้มากรอกลงในช่องด้านบนและกดปุ่มบันทึก เพื่อเริ่มใช้งานบอทเงินจริง
                  </Typography>
                </Paper>
              </Stack>
            )}

            <Divider sx={{ borderColor: "rgba(255,255,255,0.05)" }} />

            {/* Auto-save Status Indicator */}
            <Box
              sx={{
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                py: 1.5,
                gap: 1.2,
                borderRadius: "12px",
                backgroundColor: "rgba(255,255,255,0.012)",
                border: "1px solid rgba(255,255,255,0.03)",
              }}
            >
              {autoSaveState === "saving" && (
                <>
                  <CircularProgress size={14} sx={{ color: botConfig.dry_run ? "#94a3b8" : "primary.main" }} />
                  <Typography sx={{ fontSize: "0.82rem", color: "text.secondary", fontWeight: 500 }}>
                    กำลังบันทึกการตั้งค่าอัตโนมัติ...
                  </Typography>
                </>
              )}
              {autoSaveState === "saved" && (
                <Typography sx={{ fontSize: "0.82rem", color: "#00c16a", fontWeight: 600 }}>
                  ✓ บันทึกการตั้งค่าระบบเรียบร้อยแล้ว
                </Typography>
              )}
              {autoSaveState === "error" && (
                <Typography sx={{ fontSize: "0.82rem", color: "#ef5b63", fontWeight: 600 }}>
                  ✗ เกิดข้อผิดพลาดในการบันทึกข้อมูล
                </Typography>
              )}
              {(!autoSaveState || autoSaveState === "idle") && (
                <Typography sx={{ fontSize: "0.82rem", color: "text.secondary", fontWeight: 500 }}>
                  ระบบจะบันทึกการเปลี่ยนแปลงทั้งหมดโดยอัตโนมัติ
                </Typography>
              )}
            </Box>
          </Stack>
        </CardContent>
      </Card>

      {/* Safety Mode switch dialog */}
      <Dialog
        open={confirmLiveOpen}
        onClose={() => setConfirmLiveOpen(false)}
        sx={{
          "& .MuiDialog-paper": {
            background: "#0d1321",
            border: "1px solid rgba(0, 193, 106, 0.2)",
            borderRadius: "16px",
            p: 1,
          }
        }}
      >
        <DialogTitle sx={{ fontFamily: "Outfit, sans-serif", fontWeight: 600, fontSize: "1.1rem", color: "primary.main", display: "flex", alignItems: "center", gap: 1 }}>
          <ShieldCheck size={22} style={{ color: "#00c16a" }} /> ยืนยันการเปลี่ยนไปใช้ "เงินจริง" (LIVE)
        </DialogTitle>
        <DialogContent>
          <DialogContentText sx={{ color: "text.secondary", fontSize: "0.92rem", mt: 1, lineHeight: 1.6 }}>
            คุณกำลังปรับเปลี่ยนโหมดของบอทเทรดไปเป็น <strong>LIVE Trade (ใช้เงินจริง)</strong><br /><br />
            • บอทจะเข้าซื้อเหรียญโดยใช้ **เงินสด THB จริง** ในกระเป๋า Bitkub ของคุณตามพารามิเตอร์ Stake Amount<br />
            • คุณต้องรับผิดชอบความเสี่ยงจากการเทรดด้วยเงินจริงของคุณทั้งหมด<br />
            • โปรดตรวจสอบความถูกต้องของ API Keys ในไฟล์ `.env` ก่อนดำเนินงาน<br /><br />
            คุณแน่ใจหรือไม่ที่จะทำการเปิดโหมดเงินจริง?
          </DialogContentText>
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2, gap: 1 }}>
          <Button
            onClick={() => setConfirmLiveOpen(false)}
            variant="outlined"
            sx={{
              borderColor: "rgba(255,255,255,0.12)",
              color: "text.secondary",
              fontWeight: 500,
              fontSize: "0.85rem",
              borderRadius: "11px",
              "&:hover": { borderColor: "rgba(255,255,255,0.25)" }
            }}
          >
            ยกเลิก
          </Button>
          <Button
            onClick={confirmLiveSwitch}
            variant="contained"
            sx={{
              fontWeight: 600,
              fontSize: "0.85rem",
              borderRadius: "11px",
              backgroundColor: "#00c16a",
              color: "#17201a",
              "&:hover": { backgroundColor: "#00a85d" }
            }}
          >
            ฉันแน่ใจ, เปิดโหมดเงินจริง
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}
