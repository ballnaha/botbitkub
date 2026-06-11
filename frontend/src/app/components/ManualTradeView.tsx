import React, { useEffect, useState, useMemo } from "react";
import type { Dispatch, FormEvent, SetStateAction } from "react";
import { Autocomplete, Box, Button, Card, CardContent, Chip, CircularProgress, Divider, IconButton, InputAdornment, MenuItem, Paper, Select, Stack, Table, TableBody, TableCell, TableContainer, TableHead, TableRow, TextField, Tooltip, Typography } from "@mui/material";
import { ChevronLeft, ChevronRight, Send, TrendingUp, Wallet } from "lucide-react";
import type { BalanceItem, TickerData } from "./dashboardTypes";

const MARKET_ROWS_PER_PAGE = 50;

interface CustomInputProps {
  label: string;
  value: string;
  onChange: (val: string) => void;
  unit: string;
  isBuy: boolean;
  disabled?: boolean;
  placeholder?: string;
}

function CustomInput({ label, value, onChange, unit, isBuy, disabled = false, placeholder = "0.00" }: CustomInputProps) {
  return (
    <Box
      sx={{
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        border: "1px solid rgba(255, 255, 255, 0.08)",
        borderRadius: "9px",
        backgroundColor: "rgba(255, 255, 255, 0.02)",
        p: "11px 14px",
        opacity: disabled ? 0.7 : 1,
        transition: "border-color 0.15s ease-in-out",
        "&:focus-within": {
          borderColor: disabled ? "rgba(255, 255, 255, 0.08)" : (isBuy ? "#00c16a" : "#ef5b63"),
        },
        "& input[type=number]": {
          MozAppearance: "textfield",
        },
        "& input[type=number]::-webkit-outer-spin-button, & input[type=number]::-webkit-inner-spin-button": {
          WebkitAppearance: "none",
          margin: 0,
        },
      }}
    >
      <Typography sx={{ fontSize: "0.9rem", color: "text.secondary", whiteSpace: "nowrap", fontWeight: 500 }}>
        {label}
      </Typography>
      <Box sx={{ display: "flex", alignItems: "center", gap: 1, flexGrow: 1, justifyContent: "flex-end" }}>
        <input
          type="number"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
          disabled={disabled}
          required={!disabled}
          step="any"
          style={{
            background: "transparent",
            border: "none",
            outline: "none",
            color: disabled ? "rgba(255, 255, 255, 0.5)" : "#fff",
            textAlign: "right",
            fontFamily: "monospace",
            fontSize: "0.95rem",
            fontWeight: 500,
            width: "100%",
          }}
        />
        <Typography sx={{ fontSize: "0.9rem", color: "text.secondary", fontWeight: 500, minWidth: "35px", textAlign: "right" }}>
          {unit}
        </Typography>
      </Box>
    </Box>
  );
}

interface PercentageButtonsProps {
  onPercentClick: (pct: number) => void;
  isBuy: boolean;
}

function PercentageButtons({ onPercentClick, isBuy }: PercentageButtonsProps) {
  return (
    <Box sx={{ display: "flex", justifyContent: "flex-start", alignItems: "center", mt: 1 }}>
      <Stack direction="row" spacing={1}>
        {[25, 50, 75, 100].map((pct) => (
          <Button
            key={pct}
            onClick={() => onPercentClick(pct)}
            size="small"
            variant="text"
            sx={{
              minWidth: "49px",
              height: "26px",
              p: 0,
              border: "1px solid rgba(255, 255, 255, 0.12)",
              borderRadius: "6px",
              fontSize: "0.82rem",
              color: "text.primary",
              fontFamily: "monospace",
              fontWeight: 500,
              textTransform: "none",
              backgroundColor: "rgba(255, 255, 255, 0.02)",
              "&:hover": {
                borderColor: isBuy ? "#00c16a" : "#ef5b63",
                backgroundColor: isBuy ? "rgba(0, 193, 106, 0.05)" : "rgba(239, 91, 99, 0.05)",
              }
            }}
          >
            {pct}%
          </Button>
        ))}
      </Stack>
    </Box>
  );
}


interface ManualTradeViewProps {
  actionLoading: boolean;
  balances: BalanceItem[];
  calculatePercentage: (percent: number) => void;
  filterTradeSymbolOptions: (options: string[], state: { inputValue: string }) => string[];
  filteredMarketTickers: [string, TickerData][];
  handleOpenConfirmManual: (e: FormEvent) => void;
  marketPage: number;
  marketPageCount: number;
  marketSearch: string;
  setMarketPage: Dispatch<SetStateAction<number>>;
  setMarketSearch: Dispatch<SetStateAction<string>>;
  setTradeAmount: Dispatch<SetStateAction<string>>;
  setTradePrice: Dispatch<SetStateAction<string>>;
  setTradeSide: Dispatch<SetStateAction<"buy" | "sell">>;
  setTradeSymbol: Dispatch<SetStateAction<string>>;
  setTradeType: Dispatch<SetStateAction<"market" | "limit">>;
  sortedTickers: [string, TickerData][];
  tickers: Record<string, TickerData>;
  tradeAmount: string;
  tradePrice: string;
  tradeSide: "buy" | "sell";
  tradeSymbol: string;
  tradeSymbolOptions: string[];
  tradeType: "market" | "limit";
  visibleMarketTickers: [string, TickerData][];
  wsConnected: boolean;
}

export function ManualTradeView({ actionLoading, balances, calculatePercentage, filterTradeSymbolOptions, filteredMarketTickers, handleOpenConfirmManual, marketPage, marketPageCount, marketSearch, setMarketPage, setMarketSearch, setTradeAmount, setTradePrice, setTradeSide, setTradeSymbol, setTradeType, sortedTickers, tickers, tradeAmount, tradePrice, tradeSide, tradeSymbol, tradeSymbolOptions, tradeType, visibleMarketTickers, wsConnected }: ManualTradeViewProps) {
  
  // Local States for Buy and Sell forms to prevent overlap
  const [buyAmount, setBuyAmount] = useState("");
  const [buyPrice, setBuyPrice] = useState("");
  const [sellAmount, setSellAmount] = useState("");
  const [sellPrice, setSellPrice] = useState("");

  // Set default trade symbol only once when options load initially
  useEffect(() => {
    if (!tradeSymbol && tradeSymbolOptions.length > 0) {
      const defaultSym = tradeSymbolOptions.includes("BTC/THB") ? "BTC/THB" : tradeSymbolOptions[0];
      setTradeSymbol(defaultSym);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tradeSymbolOptions]);

  // Sync initial price from ticker when tradeSymbol changes
  useEffect(() => {
    if (tradeSymbol && tickers[tradeSymbol]) {
      const p = tickers[tradeSymbol].last.toString();
      setBuyPrice(p);
      setSellPrice(p);
    } else {
      setBuyPrice("");
      setSellPrice("");
    }
    setBuyAmount("");
    setSellAmount("");
  }, [tradeSymbol]);

  // Extract base asset (e.g. KUB) and quote asset (e.g. THB)
  const baseAsset = useMemo(() => {
    if (!tradeSymbol) return "COIN";
    return tradeSymbol.split("/")[0];
  }, [tradeSymbol]);

  const quoteAsset = useMemo(() => {
    if (!tradeSymbol) return "THB";
    return tradeSymbol.split("/")[1] || "THB";
  }, [tradeSymbol]);

  // Extract relevant balances
  const thbBalance = useMemo(() => {
    const b = balances.find((x) => x.asset === "THB");
    return b ? b.free : 0;
  }, [balances]);

  const baseAssetBalance = useMemo(() => {
    const b = balances.find((x) => x.asset === baseAsset);
    return b ? b.free : 0;
  }, [balances, baseAsset]);

  const visibleBalances = useMemo(() => {
    return [...balances]
      .filter((item) => item.asset === "THB" || item.asset === baseAsset || item.total > 0 || item.free > 0 || item.used > 0)
      .sort((a, b) => {
        const priority = (asset: string) => {
          if (asset === "THB") return 0;
          if (asset === baseAsset) return 1;
          return 2;
        };

        const priorityDiff = priority(a.asset) - priority(b.asset);
        if (priorityDiff !== 0) return priorityDiff;
        return a.asset.localeCompare(b.asset);
      });
  }, [balances, baseAsset]);

  // Percentage Handlers
  const handleBuyPercent = (pct: number) => {
    const toSpend = thbBalance * (pct / 100);
    const formatted = (Math.floor(toSpend * 100) / 100).toString();
    setBuyAmount(formatted);
  };

  const handleSellPercent = (pct: number) => {
    const toSell = baseAssetBalance * (pct / 100);
    const formatted = (Math.floor(toSell * 100000000) / 100000000).toString();
    setSellAmount(formatted);
  };

  // Live Conversion calculations
  const buyReceiveQty = useMemo(() => {
    const amount = parseFloat(buyAmount);
    if (!amount || amount <= 0) return "0.00000000";

    if (tradeType === "limit") {
      const price = parseFloat(buyPrice);
      if (!price || price <= 0) return "0.00000000";
      return (amount / price).toFixed(8);
    } else {
      const price = tickers[tradeSymbol]?.last || 0;
      if (price <= 0) return "0.00000000";
      return (amount / price).toFixed(8);
    }
  }, [buyAmount, buyPrice, tradeType, tickers, tradeSymbol]);

  const sellReceiveThb = useMemo(() => {
    const amount = parseFloat(sellAmount);
    if (!amount || amount <= 0) return "0.00";

    if (tradeType === "limit") {
      const price = parseFloat(sellPrice);
      if (!price || price <= 0) return "0.00";
      return (amount * price).toFixed(2);
    } else {
      const price = tickers[tradeSymbol]?.last || 0;
      if (price <= 0) return "0.00";
      return (amount * price).toFixed(2);
    }
  }, [sellAmount, sellPrice, tradeType, tickers, tradeSymbol]);

  // Submission handlers that update parent state and trigger confirmation dialog
  const submitBuy = (e: React.FormEvent) => {
    e.preventDefault();
    if (!tradeSymbol) return;

    const amountThb = parseFloat(buyAmount);
    if (!buyAmount || amountThb <= 0) return;

    if (tradeType === "limit") {
      const price = parseFloat(buyPrice);
      if (!buyPrice || price <= 0) return;
    }

    setTradeSide("buy");
    setTradeAmount(buyAmount);
    setTradePrice(tradeType === "limit" ? buyPrice : "");

    setTimeout(() => {
      handleOpenConfirmManual(e);
    }, 50);
  };

  const submitSell = (e: React.FormEvent) => {
    e.preventDefault();
    if (!tradeSymbol) return;

    const amountCoin = parseFloat(sellAmount);
    if (!sellAmount || amountCoin <= 0) return;

    if (tradeType === "limit") {
      const price = parseFloat(sellPrice);
      if (!sellPrice || price <= 0) return;
    }

    setTradeSide("sell");
    setTradeAmount(sellAmount);
    setTradePrice(tradeType === "limit" ? sellPrice : "");

    setTimeout(() => {
      handleOpenConfirmManual(e);
    }, 50);
  };


  const getTradingViewSymbol = (sym: string) => {
    if (!sym) return "BITKUB:BTCTHB";
    const parts = sym.toUpperCase().split("/");
    if (parts.length === 2) {
      return `BITKUB:${parts[0]}${parts[1]}`;
    }
    return `BITKUB:${sym.replace("/", "")}`;
  };

  const tvSymbol = getTradingViewSymbol(tradeSymbol);
  const iframeSrc = `https://s.tradingview.com/widgetembed/?symbol=${encodeURIComponent(tvSymbol)}&interval=15&theme=dark&style=1&timezone=Asia%2FBangkok&locale=th`;

  return (
    <Box sx={{ display: "grid", gridTemplateColumns: { xs: "1fr", lg: "7.2fr 4.8fr" }, gap: 1, alignItems: "start" }}>
      <Box>
        <Stack spacing={1.5}>
          {/* TradingView Live Chart Card */}
          <Card
            sx={{
              background: "rgba(8, 12, 20, 0.72)",
              backdropFilter: "blur(24px)",
              border: "1px solid rgba(255, 255, 255, 0.04)",
              borderRadius: "20px",
              boxShadow: "0 9px 32px 0 rgba(0, 0, 0, 0.38)",
              overflow: "hidden"
            }}
          >
            <Box sx={{ p: 2, display: "flex", justifyContent: "space-between", alignItems: "center", borderBottom: "1px solid rgba(255,255,255,0.05)" }}>
              <Typography sx={{ fontWeight: 600, fontSize: "0.92rem", letterSpacing: "0.05em", color: "text.primary", fontFamily: "Outfit, sans-serif" }}>
                📈 กราฟราคาเทคนิคอลเรียลไทม์ (Live Chart): {tradeSymbol || "BTC/THB"}
              </Typography>
              <Chip
                size="small"
                label="TradingView"
                sx={{
                  height: 18,
                  fontSize: "9px",
                  fontWeight: 500,
                  backgroundColor: "rgba(255, 255, 255, 0.03)",
                  border: "1px solid rgba(255, 255, 255, 0.08)",
                  color: "text.secondary",
                  borderRadius: "5px"
                }}
              />
            </Box>
            <CardContent sx={{ p: 0, height: "480px", position: "relative" }}>
              <iframe
                src={iframeSrc}
                width="100%"
                height="100%"
                style={{ border: "none" }}
                allowFullScreen
                title="TradingView Chart"
              />
            </CardContent>
          </Card>
              {/* Manual Trading Form */}
              <Card
                sx={{
                  background: "rgba(8, 12, 20, 0.72)",
                  backdropFilter: "blur(24px)",
                  border: "1px solid rgba(255, 255, 255, 0.04)",
                  borderRadius: "20px",
                  boxShadow: "0 9px 32px 0 rgba(0, 0, 0, 0.38)"
                }}
              >
                <CardContent sx={{ p: 3 }}>
                  {/* Trade Controls */}
                  <Stack spacing={1.5} sx={{ mb: 3 }}>
                    <Box sx={{ display: "grid", gridTemplateColumns: { xs: "1fr", lg: "minmax(0, 1fr) 190px" }, gap: 1.25, alignItems: "stretch" }}>
                      <Box>
                        <Typography sx={{ fontSize: "0.85rem", fontWeight: 500, color: "text.secondary", textTransform: "uppercase", letterSpacing: "0.08em", mb: 1 }}>
                          เลือกคู่เหรียญเทรด
                        </Typography>
                        <Autocomplete
                          fullWidth
                          size="small"
                          value={tradeSymbol || null}
                          options={tradeSymbolOptions}
                          getOptionKey={(option) => option}
                          isOptionEqualToValue={(option, value) => option === value}
                          filterOptions={filterTradeSymbolOptions}
                          openOnFocus={false}
                          forcePopupIcon={false}
                          autoHighlight
                          clearOnEscape
                          noOptionsText="ค้นหาไม่พบ"
                          onChange={(_, value) => {
                            setTradeSymbol(value ?? "");
                          }}
                          renderInput={(params) => (
                            <TextField
                              {...params}
                              placeholder="ค้นหาคู่เหรียญ เช่น BTC/THB"
                              sx={{
                                "& .MuiOutlinedInput-root": {
                                  borderRadius: "12px",
                                  backgroundColor: "rgba(255, 255, 255, 0.01)"
                                }
                              }}
                            />
                          )}
                          renderOption={(props, sym) => {
                            const data = tickers[sym];
                            const { key, ...optionProps } = props;

                            return (
                              <Box key={sym} component="li" {...optionProps} sx={{ display: "flex", justifyContent: "space-between", width: "100%", alignItems: "center" }}>
                                <Typography sx={{ fontWeight: 500, fontSize: "0.9rem" }}>{sym}</Typography>
                                <Typography sx={{ fontSize: "0.8rem", color: (data?.percentage ?? 0) >= 0 ? "#00c16a" : "#ef5b63", fontFamily: "monospace", ml: 2 }}>
                                  {data && data.last > 0 ? data.last.toLocaleString(undefined, { minimumFractionDigits: 2 }) : "-"}
                                </Typography>
                              </Box>
                            );
                          }}
                          slotProps={{ paper: { sx: { maxHeight: 300, borderRadius: "11px" } } }}
                        />
                      </Box>

                      <Box sx={{ p: 1.4, borderRadius: "12px", backgroundColor: "rgba(255, 255, 255, 0.018)", border: "1px solid rgba(255, 255, 255, 0.05)", display: "flex", flexDirection: "column", justifyContent: "center", minHeight: 72 }}>
                        <Typography sx={{ fontSize: "0.76rem", color: "text.secondary", fontWeight: 500 }}>
                          ราคาล่าสุด
                        </Typography>
                        <Typography sx={{ fontSize: "1rem", color: "text.primary", fontFamily: "monospace", fontWeight: 600, mt: 0.3 }}>
                          {(tickers[tradeSymbol]?.last || 0) > 0 ? tickers[tradeSymbol].last.toLocaleString(undefined, { minimumFractionDigits: 2 }) : "-"}
                        </Typography>
                      </Box>
                    </Box>

                    <Divider sx={{ borderColor: "rgba(255,255,255,0.06)" }} />

                    <Box>
                      <Typography sx={{ fontSize: "0.85rem", fontWeight: 500, color: "text.secondary", textTransform: "uppercase", letterSpacing: "0.08em", mb: 1 }}>
                        ประเภทคำสั่ง
                      </Typography>
                      <Box sx={{ display: "inline-flex", alignItems: "center", gap: 2, borderBottom: "1px solid rgba(255, 255, 255, 0.06)" }}>
                        {[
                          { id: "limit", label: "ลิมิต" },
                          { id: "market", label: "มาร์เก็ต" }
                        ].map((tab) => {
                          const isActive = tradeType === tab.id;
                          return (
                            <Button
                              key={tab.id}
                              onClick={() => setTradeType(tab.id as "limit" | "market")}
                              sx={{
                                minWidth: 0,
                                minHeight: 30,
                                px: 0,
                                pb: 0.85,
                                borderRadius: 0,
                                position: "relative",
                                textTransform: "none",
                                color: isActive ? "primary.main" : "text.secondary",
                                backgroundColor: "transparent",
                                border: "none",
                                fontWeight: 600,
                                "&::after": {
                                  content: '""',
                                  position: "absolute",
                                  left: 0,
                                  right: 0,
                                  bottom: -1,
                                  height: "2px",
                                  borderRadius: "2px",
                                  backgroundColor: isActive ? "primary.main" : "transparent",
                                },
                                "&:hover": {
                                  backgroundColor: "transparent",
                                  color: isActive ? "primary.main" : "text.primary",
                                }
                              }}
                            >
                              <Typography sx={{ fontSize: "0.86rem", fontWeight: 600, lineHeight: 1.1 }}>
                                {tab.label}
                              </Typography>
                            </Button>
                          );
                        })}
                      </Box>
                    </Box>
                  </Stack>

                  {/* Side-by-Side Panels */}
                  <Box sx={{ display: "grid", gridTemplateColumns: { xs: "1fr", md: "1fr 1fr" }, gap: 4 }}>
                    
                    {/* Buy Form (ซื้อ) */}
                    <form onSubmit={submitBuy}>
                      <Stack spacing={1.25}>
                        <Stack spacing={0.8} sx={{ mb: 0.5 }}>
                          <Box 
                            onClick={() => handleBuyPercent(100)}
                            sx={{ 
                              display: "flex", 
                              justifyContent: "space-between", 
                              alignItems: "center",
                              cursor: "pointer",
                              "&:hover": { opacity: 0.8 }
                            }}
                          >
                            <Typography sx={{ fontSize: "0.85rem", color: "text.secondary", fontWeight: 500 }}>คงเหลือ</Typography>
                            <Typography sx={{ fontSize: "0.85rem", color: "#00c16a", fontWeight: 500, textDecoration: "underline" }}>
                              {thbBalance.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })} THB
                            </Typography>
                          </Box>
                        </Stack>

                        <CustomInput
                          label="จำนวนที่ต้องจ่าย"
                          value={buyAmount}
                          onChange={setBuyAmount}
                          unit="THB"
                          isBuy={true}
                          placeholder="0.00"
                        />

                        <PercentageButtons onPercentClick={handleBuyPercent} isBuy={true} />

                        {tradeType === "limit" ? (
                          <CustomInput
                            label={`ราคาต่อ ${baseAsset}`}
                            value={buyPrice}
                            onChange={setBuyPrice}
                            unit="THB"
                            isBuy={true}
                            placeholder="0.00"
                          />
                        ) : (
                          <Box
                            sx={{
                              display: "flex",
                              alignItems: "center",
                              justifyContent: "space-between",
                              border: "1px solid rgba(255, 255, 255, 0.04)",
                              borderRadius: "9px",
                              backgroundColor: "rgba(255, 255, 255, 0.01)",
                              p: "11px 14px",
                              opacity: 0.6
                            }}
                          >
                            <Typography sx={{ fontSize: "0.9rem", color: "text.secondary", fontWeight: 500 }}>
                              ราคาต่อ {baseAsset}
                            </Typography>
                            <Typography sx={{ fontSize: "0.95rem", fontWeight: 500, color: "text.secondary", pr: "35px" }}>
                              ราคาตลาด (Market)
                            </Typography>
                          </Box>
                        )}

                        <CustomInput
                          label={`${baseAsset} จำนวนที่จะได้รับ`}
                          value={buyReceiveQty}
                          onChange={() => {}}
                          unit={baseAsset}
                          isBuy={true}
                          disabled={true}
                          placeholder="0.00000000"
                        />

                        <Button
                          fullWidth
                          type="submit"
                          disabled={actionLoading}
                          variant="contained"
                          sx={{
                            py: 1.5,
                            fontSize: "1rem",
                            fontWeight: 600,
                            backgroundColor: "#00c16a",
                            color: "#ffffff",
                            borderRadius: "9px",
                            textTransform: "none",
                            "&:hover": {
                              backgroundColor: "#00a85d",
                            },
                            "&.Mui-disabled": {
                              backgroundColor: "rgba(255, 255, 255, 0.05)",
                              color: "rgba(255, 255, 255, 0.3)",
                            }
                          }}
                        >
                          {actionLoading ? <CircularProgress size={20} color="inherit" /> : "ซื้อ"}
                        </Button>
                      </Stack>
                    </form>

                    {/* Sell Form (ขาย) */}
                    <form onSubmit={submitSell}>
                      <Stack spacing={1.25}>
                        <Stack spacing={0.8} sx={{ mb: 0.5 }}>
                          <Box 
                            onClick={() => handleSellPercent(100)}
                            sx={{ 
                              display: "flex", 
                              justifyContent: "space-between", 
                              alignItems: "center",
                              cursor: "pointer",
                              "&:hover": { opacity: 0.8 }
                            }}
                          >
                            <Typography sx={{ fontSize: "0.85rem", color: "text.secondary", fontWeight: 500 }}>คงเหลือ</Typography>
                            <Typography sx={{ fontSize: "0.85rem", color: "#00c16a", fontWeight: 500, textDecoration: "underline" }}>
                              {baseAssetBalance.toLocaleString(undefined, { minimumFractionDigits: 8, maximumFractionDigits: 8 })} {baseAsset}
                            </Typography>
                          </Box>
                        </Stack>

                        <CustomInput
                          label="จำนวนที่ต้องขาย"
                          value={sellAmount}
                          onChange={setSellAmount}
                          unit={baseAsset}
                          isBuy={false}
                          placeholder="0.00000000"
                        />

                        <PercentageButtons onPercentClick={handleSellPercent} isBuy={false} />

                        {tradeType === "limit" ? (
                          <CustomInput
                            label={`ราคาต่อ ${baseAsset}`}
                            value={sellPrice}
                            onChange={setSellPrice}
                            unit="THB"
                            isBuy={false}
                            placeholder="0.00"
                          />
                        ) : (
                          <Box
                            sx={{
                              display: "flex",
                              alignItems: "center",
                              justifyContent: "space-between",
                              border: "1px solid rgba(255, 255, 255, 0.04)",
                              borderRadius: "9px",
                              backgroundColor: "rgba(255, 255, 255, 0.01)",
                              p: "11px 14px",
                              opacity: 0.6
                            }}
                          >
                            <Typography sx={{ fontSize: "0.9rem", color: "text.secondary", fontWeight: 500 }}>
                              ราคาต่อ {baseAsset}
                            </Typography>
                            <Typography sx={{ fontSize: "0.95rem", fontWeight: 500, color: "text.secondary", pr: "35px" }}>
                              ราคาตลาด (Market)
                            </Typography>
                          </Box>
                        )}

                        <CustomInput
                          label="THB จำนวนที่จะได้รับ"
                          value={sellReceiveThb}
                          onChange={() => {}}
                          unit="THB"
                          isBuy={false}
                          disabled={true}
                          placeholder="0.00"
                        />

                        <Button
                          fullWidth
                          type="submit"
                          disabled={actionLoading}
                          variant="contained"
                          sx={{
                            py: 1.5,
                            fontSize: "1rem",
                            fontWeight: 600,
                            backgroundColor: "#ef5b63",
                            color: "#ffffff",
                            borderRadius: "9px",
                            textTransform: "none",
                            "&:hover": {
                              backgroundColor: "#dc4854",
                            },
                            "&.Mui-disabled": {
                              backgroundColor: "rgba(255, 255, 255, 0.05)",
                              color: "rgba(255, 255, 255, 0.3)",
                            }
                          }}
                        >
                          {actionLoading ? <CircularProgress size={20} color="inherit" /> : "ขาย"}
                        </Button>
                      </Stack>
                    </form>

                  </Box>
                </CardContent>
              </Card>
        </Stack>
      </Box>
{/* Right Column (Balances & Tickers) */}
          <Box>
            <Stack spacing={1.5}>
              
              {/* Balances Card */}
              <Card>
                <CardContent sx={{ p: 3 }}>
                  <Box sx={{ display: "flex", justifyContent: "space-between", alignItems: "center", borderBottom: "1px solid rgba(255,255,255,0.05)", pb: 2, mb: 2.5 }}>
                    <Typography sx={{ fontWeight: 600, fontSize: "0.9rem", letterSpacing: "0.05em", textTransform: "uppercase", color: "text.primary" }}>
                      ยอดเงินคงเหลือ (Balances)
                    </Typography>
                    <Wallet size={18} style={{ color: "#00c16a" }} />
                  </Box>

                  {balances.length === 0 ? (
                    <Typography sx={{ color: "text.secondary", fontSize: "0.85rem", py: 2, textAlign: "center" }}>
                        กำลังดึงข้อมูลยอดเงินคงเหลือ...
                    </Typography>
                  ) : (
                    <Stack spacing={1.5}>
                      <Box sx={{ display: "grid", gridTemplateColumns: { xs: "1fr", sm: "1fr 1fr" }, gap: 1 }}>
                        <Paper elevation={0} sx={{ p: 1.6, borderRadius: "12px", backgroundColor: "rgba(0, 193, 106, 0.035)", border: "1px solid rgba(0, 193, 106, 0.16)" }}>
                          <Typography sx={{ fontSize: "0.76rem", color: "primary.main", fontWeight: 600, letterSpacing: "0.05em" }}>
                            THB พร้อมใช้
                          </Typography>
                          <Typography sx={{ fontSize: "1.08rem", fontWeight: 600, color: "text.primary", fontFamily: "monospace", mt: 0.45 }}>
                            {thbBalance.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                          </Typography>
                        </Paper>

                        <Paper elevation={0} sx={{ p: 1.6, borderRadius: "12px", backgroundColor: "rgba(255, 255, 255, 0.015)", border: "1px solid rgba(255, 255, 255, 0.05)" }}>
                          <Typography sx={{ fontSize: "0.76rem", color: "text.secondary", fontWeight: 600, letterSpacing: "0.05em" }}>
                            {baseAsset} พร้อมใช้
                          </Typography>
                          <Typography sx={{ fontSize: "1.08rem", fontWeight: 600, color: "text.primary", fontFamily: "monospace", mt: 0.45 }}>
                            {baseAssetBalance.toLocaleString(undefined, { maximumFractionDigits: 8 })}
                          </Typography>
                        </Paper>
                      </Box>

                      <Box sx={{ display: "grid", gap: 0.65, maxHeight: 260, overflowY: "auto", pr: 0.5 }}>
                        {visibleBalances.map((item) => {
                          const isPrimary = item.asset === "THB" || item.asset === baseAsset;
                          const decimals = item.asset === "THB" ? 2 : 8;

                          return (
                            <Box
                              key={item.asset}
                              sx={{
                                display: "grid",
                                gridTemplateColumns: "64px minmax(0, 1fr) minmax(72px, auto)",
                                gap: 1,
                                alignItems: "center",
                                px: 1.2,
                                py: 0.9,
                                borderRadius: "10px",
                                backgroundColor: isPrimary ? "rgba(255, 255, 255, 0.025)" : "rgba(255, 255, 255, 0.012)",
                                border: "1px solid rgba(255, 255, 255, 0.045)",
                              }}
                            >
                              <Typography sx={{ fontSize: "0.82rem", fontWeight: 600, color: isPrimary ? "text.primary" : "text.secondary" }}>
                                {item.asset}
                              </Typography>
                              <Box sx={{ minWidth: 0 }}>
                                <Typography sx={{ fontSize: "0.88rem", fontWeight: 600, color: "text.primary", fontFamily: "monospace", overflow: "hidden", textOverflow: "ellipsis" }}>
                                  {item.free.toLocaleString(undefined, { maximumFractionDigits: decimals })}
                                </Typography>
                                {item.used > 0 && (
                                  <Typography sx={{ fontSize: "0.7rem", color: "text.secondary", mt: 0.2 }}>
                                    Locked {item.used.toLocaleString(undefined, { maximumFractionDigits: 6 })}
                                  </Typography>
                                )}
                              </Box>
                              <Typography sx={{ fontSize: "0.74rem", color: "text.secondary", textAlign: "right", fontFamily: "monospace" }}>
                                Total {item.total.toLocaleString(undefined, { maximumFractionDigits: item.asset === "THB" ? 2 : 6 })}
                              </Typography>
                            </Box>
                          );
                        })}
                      </Box>
                    </Stack>
                  )}
                </CardContent>
              </Card>

              {/* Live Tickers Card */}
              <Card>
                <CardContent sx={{ p: 3 }}>
                  <Box sx={{ display: "flex", justifyContent: "space-between", alignItems: "center", borderBottom: "1px solid rgba(255,255,255,0.05)", pb: 2, mb: 2 }}>
                    <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
                      <Typography sx={{ fontWeight: 600, fontSize: "0.9rem", letterSpacing: "0.05em", textTransform: "uppercase", color: "text.primary" }}>
                        ราคาตลาดเรียลไทม์
                      </Typography>
                      <Chip
                        size="small"
                        label={wsConnected ? "LIVE" : "OFFLINE"}
                        sx={{
                          height: 20,
                          fontSize: "10px",
                          fontWeight: 600,
                          letterSpacing: "0.08em",
                          backgroundColor: wsConnected ? "rgba(0, 193, 106, 0.1)" : "rgba(239, 91, 99, 0.1)",
                          color: wsConnected ? "#00c16a" : "#ef5b63",
                          border: wsConnected ? "1px solid rgba(0, 193, 106, 0.2)" : "1px solid rgba(239, 91, 99, 0.2)",
                          animation: wsConnected ? "live-pulse 2s ease-in-out infinite" : "none",
                          "@keyframes live-pulse": {
                            "0%, 100%": { boxShadow: "0 0 0 0 rgba(0, 193, 106, 0)" },
                            "50%": { boxShadow: "0 0 9px 0 rgba(0, 193, 106, 0.2)" },
                          },
                        }}
                      />
                    </Box>
                    <TrendingUp size={18} style={{ color: "#3b82f6" }} />
                  </Box>

                  <TextField
                    fullWidth
                    size="small"
                    value={marketSearch}
                    onChange={(e) => {
                      setMarketSearch(e.target.value);
                      setMarketPage(0);
                    }}
                    placeholder="Search market"
                    sx={{ mb: 2 }}
                  />

                  <TableContainer sx={{ maxHeight: 600, overflowY: "auto" }}>
                    <Table size="small" stickyHeader sx={{ "& .MuiTableCell-stickyHeader": { backgroundColor: "#0d1321" } }}>
                      <TableHead>
                        <TableRow>
                          <TableCell sx={{ pl: 0 }}>คู่เหรียญ</TableCell>
                          <TableCell align="right">ล่าสุด</TableCell>
                          <TableCell align="right" sx={{ display: { xs: "none", sm: "table-cell" } }}>Vol 24h</TableCell>
                          <TableCell align="right" sx={{ pr: 0 }}>เปลี่ยนแปลง</TableCell>
                        </TableRow>
                      </TableHead>
                      <TableBody>
                        {sortedTickers.length === 0 ? (
                          <TableRow>
                            <TableCell colSpan={4} align="center" sx={{ py: 3, color: "text.secondary", fontSize: "0.85rem" }}>
                              กำลังโหลดข้อมูลราคาคู่เหรียญ...
                            </TableCell>
                          </TableRow>
                        ) : visibleMarketTickers.length === 0 ? (
                          <TableRow>
                            <TableCell colSpan={4} align="center" sx={{ py: 3, color: "text.secondary", fontSize: "0.85rem" }}>
                              No market pairs found
                            </TableCell>
                          </TableRow>
                        ) : (
                          visibleMarketTickers.map(([symbol, data]) => {
                              const isPos = data.percentage > 0;
                              const pctColor = isPos ? "primary.main" : (data.percentage < 0 ? "error.main" : "text.secondary");
                              const isSelected = tradeSymbol === symbol;
                              
                              return (
                                <TableRow 
                                  key={symbol}
                                  onClick={() => {
                                    setTradeSymbol(symbol);
                                    setTradeAmount("");
                                  }}
                                  sx={{
                                    cursor: "pointer",
                                    transition: "all 0.15s ease",
                                    "&:hover": {
                                      backgroundColor: "rgba(255, 255, 255, 0.04)"
                                    },
                                    backgroundColor: isSelected ? "rgba(0, 193, 106, 0.04)" : "transparent",
                                    "& td": {
                                      borderLeft: isSelected ? "3px solid #00c16a" : "3px solid transparent",
                                      transition: "border-left 0.15s ease",
                                    }
                                  }}
                                >
                                  <TableCell sx={{ pl: 1, fontWeight: 500, fontSize: "0.85rem" }}>{symbol}</TableCell>
                                  <TableCell align="right" sx={{ color: "primary.main", fontWeight: 600, fontFamily: "monospace", fontSize: "0.85rem" }}>
                                    {data.last.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                                  </TableCell>
                                  <TableCell align="right" sx={{ color: "text.secondary", fontFamily: "monospace", fontSize: "0.8rem", display: { xs: "none", sm: "table-cell" } }}>
                                    {data.quoteVolume > 1000000
                                      ? `${(data.quoteVolume / 1000000).toFixed(1)}M`
                                      : data.quoteVolume > 1000
                                        ? `${(data.quoteVolume / 1000).toFixed(1)}K`
                                        : data.quoteVolume.toFixed(0)}
                                  </TableCell>
                                  <TableCell align="right" sx={{ pr: 0, color: pctColor, fontWeight: 600, fontFamily: "monospace", fontSize: "0.85rem" }}>
                                    {isPos ? "+" : ""}{data.percentage.toFixed(2)}%
                                  </TableCell>
                                </TableRow>
                              );
                            })
                        )}
                      </TableBody>
                    </Table>
                  </TableContainer>
                  {filteredMarketTickers.length > MARKET_ROWS_PER_PAGE && (
                    <Box sx={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 1, mt: 2 }}>
                      <Typography sx={{ fontSize: "0.8rem", color: "text.secondary", fontFamily: "monospace" }}>
                        {marketPage * MARKET_ROWS_PER_PAGE + 1}-{Math.min((marketPage + 1) * MARKET_ROWS_PER_PAGE, filteredMarketTickers.length)} / {filteredMarketTickers.length}
                      </Typography>
                      <Stack direction="row" spacing={1}>
                        <Tooltip title="Previous page">
                          <span>
                            <IconButton
                              size="small"
                              disabled={marketPage === 0}
                              onClick={() => setMarketPage((page) => Math.max(0, page - 1))}
                            >
                              <ChevronLeft size={16} />
                            </IconButton>
                          </span>
                        </Tooltip>
                        <Typography sx={{ minWidth: 52, textAlign: "center", alignSelf: "center", fontSize: "0.8rem", color: "text.secondary", fontFamily: "monospace" }}>
                          {marketPage + 1}/{marketPageCount}
                        </Typography>
                        <Tooltip title="Next page">
                          <span>
                            <IconButton
                              size="small"
                              disabled={marketPage >= marketPageCount - 1}
                              onClick={() => setMarketPage((page) => Math.min(marketPageCount - 1, page + 1))}
                            >
                              <ChevronRight size={16} />
                            </IconButton>
                          </span>
                        </Tooltip>
                      </Stack>
                    </Box>
                  )}
                </CardContent>
              </Card>
            </Stack>
          </Box>
    </Box>
  );
}
