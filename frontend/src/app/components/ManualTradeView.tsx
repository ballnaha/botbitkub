import type { Dispatch, FormEvent, SetStateAction } from "react";
import { Autocomplete, Box, Button, Card, CardContent, Chip, CircularProgress, IconButton, InputAdornment, MenuItem, Paper, Select, Stack, Table, TableBody, TableCell, TableContainer, TableHead, TableRow, TextField, Tooltip, Typography } from "@mui/material";
import { ChevronLeft, ChevronRight, Send, TrendingUp, Wallet } from "lucide-react";
import type { BalanceItem, TickerData } from "./dashboardTypes";

const MARKET_ROWS_PER_PAGE = 50;

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
  return (
    <Box sx={{ display: "grid", gridTemplateColumns: { xs: "1fr", lg: "7fr 5fr" }, gap: 3, alignItems: "start" }}>
      <Box>
        <Stack spacing={3}>
{/* Manual Trading Form */}
              <Card>
                <CardContent sx={{ p: 3 }}>
                  <Box sx={{ display: "flex", alignItems: "center", gap: 1.5, mb: 3, borderBottom: "1px solid rgba(255,255,255,0.05)", pb: 2 }}>
                    <Send size={18} style={{ color: "#10b981" }} />
                    <Typography sx={{ fontWeight: 800, fontSize: "0.8rem", letterSpacing: "0.05em", textTransform: "uppercase", color: "text.primary" }}>
                      ส่งคำสั่งเทรดเอง (Manual Trade)
                    </Typography>
                  </Box>

                  <form onSubmit={handleOpenConfirmManual}>
                    <Stack spacing={2.5}>
                      <Box>
                        <Typography sx={{ fontSize: "0.75rem", fontWeight: 700, color: "text.secondary", textTransform: "uppercase", letterSpacing: "0.08em", mb: 1 }}>
                          เลือกคู่เหรียญ
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
                          noOptionsText="Type to search"
                          onChange={(_, value) => {
                            setTradeSymbol(value ?? "");
                            setTradeAmount("");
                          }}
                          renderInput={(params) => (
                            <TextField {...params} placeholder="Search symbol" />
                          )}
                          renderOption={(props, sym) => {
                            const data = tickers[sym];
                            const { key, ...optionProps } = props;

                            return (
                              <Box key={sym} component="li" {...optionProps} sx={{ display: "flex", justifyContent: "space-between", width: "100%", alignItems: "center" }}>
                                <Typography sx={{ fontWeight: 700, fontSize: "0.8rem" }}>{sym}</Typography>
                                <Typography sx={{ fontSize: "0.7rem", color: (data?.percentage ?? 0) >= 0 ? "primary.main" : "error.main", fontFamily: "monospace", ml: 2 }}>
                                  {data && data.last > 0 ? data.last.toLocaleString(undefined, { minimumFractionDigits: 2 }) : "-"}
                                </Typography>
                              </Box>
                            );
                          }}
                          slotProps={{ paper: { sx: { maxHeight: 300 } } }}
                        />
                      </Box>

                      <Box 
                        sx={{
                          display: "grid",
                          gridTemplateColumns: "repeat(2, 1fr)",
                          gap: 2
                        }}
                      >
                        <Box>
                          <Typography sx={{ fontSize: "0.75rem", fontWeight: 700, color: "text.secondary", textTransform: "uppercase", letterSpacing: "0.08em", mb: 1 }}>
                            ประเภทคำสั่ง
                          </Typography>
                          <Select
                            fullWidth
                            value={tradeType}
                            onChange={(e) => {
                              setTradeType(e.target.value as "market" | "limit");
                              setTradeAmount("");
                            }}
                            size="small"
                          >
                            <MenuItem value="market">Market</MenuItem>
                            <MenuItem value="limit">Limit</MenuItem>
                          </Select>
                        </Box>

                        <Box>
                          <Typography sx={{ fontSize: "0.75rem", fontWeight: 700, color: "text.secondary", textTransform: "uppercase", letterSpacing: "0.08em", mb: 1 }}>
                            ธุรกรรม (ธุรกรรม)
                          </Typography>
                          <Select
                            fullWidth
                            value={tradeSide}
                            onChange={(e) => {
                              setTradeSide(e.target.value as "buy" | "sell");
                              setTradeAmount("");
                            }}
                            size="small"
                            sx={{
                              color: tradeSide === "buy" ? "primary.main" : "error.main",
                              fontWeight: 700
                            }}
                          >
                            <MenuItem value="buy" sx={{ color: "primary.main", fontWeight: 700 }}>ซื้อ (Buy)</MenuItem>
                            <MenuItem value="sell" sx={{ color: "error.main", fontWeight: 700 }}>ขาย (Sell)</MenuItem>
                          </Select>
                        </Box>
                      </Box>

                      <Box sx={{ width: "100%" }}>
                        <Typography sx={{ fontSize: "0.75rem", fontWeight: 700, color: "text.secondary", textTransform: "uppercase", letterSpacing: "0.08em", mb: 1 }}>
                          {tradeSide === "buy" && tradeType === "market"
                            ? "จำนวนเงินที่ซื้อ (บาท THB)"
                            : `จำนวนเหรียญที่ต้องการ${tradeSide === "buy" ? "ซื้อ" : "ขาย"}`}
                        </Typography>
                        
                        <TextField
                          fullWidth
                          placeholder={tradeSide === "buy" && tradeType === "market" ? "เช่น 50" : "เช่น 0.001"}
                          value={tradeAmount}
                          onChange={(e) => setTradeAmount(e.target.value)}
                          required
                          size="small"
                          slotProps={{
                            input: {
                              style: { fontFamily: "monospace", fontWeight: 600 },
                              endAdornment: (
                                <InputAdornment position="end">
                                  <Typography variant="caption" sx={{ fontWeight: 800, color: "text.secondary" }}>
                                    {tradeSide === "buy" && tradeType === "market" ? "THB" : (tradeSymbol ? tradeSymbol.split("/")[0] : "COIN")}
                                  </Typography>
                                </InputAdornment>
                              )
                            }
                          }}
                        />

                        {/* Percentage shortcuts — Segmented Control */}
                        <Box
                          sx={{
                            mt: 2,
                            p: 0.5,
                            borderRadius: "10px",
                            backgroundColor: "rgba(255, 255, 255, 0.02)",
                            border: "1px solid rgba(255, 255, 255, 0.04)",
                            display: "grid",
                            gridTemplateColumns: "repeat(4, 1fr)",
                            gap: "4px",
                          }}
                        >
                          {[25, 50, 75, 100].map((pct) => (
                            <Button
                              key={pct}
                              onClick={() => calculatePercentage(pct)}
                              size="small"
                              variant="text"
                              sx={{
                                py: 1,
                                fontSize: "0.72rem",
                                fontWeight: 800,
                                fontFamily: "monospace",
                                color: "text.secondary",
                                borderRadius: "8px",
                                minWidth: 0,
                                position: "relative",
                                overflow: "hidden",
                                "&::before": {
                                  content: '""',
                                  position: "absolute",
                                  inset: 0,
                                  borderRadius: "inherit",
                                  opacity: 0,
                                  background: "linear-gradient(135deg, rgba(16, 185, 129, 0.15), rgba(20, 184, 166, 0.08))",
                                },
                                "&:active": {
                                  transform: "scale(0.95)",
                                  color: "#fff",
                                  "&::before": {
                                    opacity: 1,
                                    background: "linear-gradient(135deg, rgba(16, 185, 129, 0.3), rgba(20, 184, 166, 0.15))",
                                  },
                                },
                              }}
                            >
                              {pct}%
                            </Button>
                          ))}
                        </Box>

                        <Typography sx={{ fontSize: "10px", color: "text.secondary", mt: 1.5, lineHeight: 1.5 }}>
                          {tradeSide === "buy" && tradeType === "market"
                            ? "* สำหรับการซื้อแบบ Market จะระบุเป็นจำนวนเงินบาท (THB)"
                            : `* การ${tradeSide === "buy" ? "ซื้อ" : "ขาย"}แบบ ${tradeType.toUpperCase()} จะระบุจำนวนเป็นปริมาณเหรียญ`}
                        </Typography>
                      </Box>

                      {/* Conditional Limit Price Field */}
                      {tradeType === "limit" && (
                        <Box sx={{ width: "100%" }}>
                          <Typography sx={{ fontSize: "0.75rem", fontWeight: 700, color: "text.secondary", textTransform: "uppercase", letterSpacing: "0.08em", mb: 1 }}>
                            ราคารับซื้อ/ขาย (ต่อ 1 เหรียญ)
                          </Typography>
                          <TextField
                            fullWidth
                            placeholder="ระบุราคาต่อ 1 เหรียญ"
                            value={tradePrice}
                            onChange={(e) => setTradePrice(e.target.value)}
                            required
                            size="small"
                            slotProps={{
                              input: {
                                style: { fontFamily: "monospace", fontWeight: 600 }
                              }
                            }}
                          />
                        </Box>
                      )}

                      {/* Submit Trade Button */}
                      <Button
                        fullWidth
                        type="submit"
                        disabled={actionLoading}
                        variant="contained"
                        sx={{
                          py: 1.6,
                          fontSize: "0.75rem",
                          fontWeight: 800,
                          background: "linear-gradient(90deg, #10b981 0%, #14b8a6 50%, #059669 100%)",
                          color: "#080b11",
                          boxShadow: "0 4px 15px rgba(16, 185, 129, 0.15)",
                          "&.Mui-disabled": {
                            background: "rgba(255, 255, 255, 0.05)",
                            color: "rgba(255, 255, 255, 0.3)",
                          }
                        }}
                      >
                        {actionLoading ? <CircularProgress size={20} color="inherit" /> : "ส่งคำสั่งเทรดทันที"}
                      </Button>
                    </Stack>
                  </form>
                </CardContent>
              </Card>
        </Stack>
      </Box>
{/* Right Column (Balances & Tickers) */}
          <Box>
            <Stack spacing={3}>
              
              {/* Balances Card */}
              <Card>
                <CardContent sx={{ p: 3 }}>
                  <Box sx={{ display: "flex", justifyContent: "space-between", alignItems: "center", borderBottom: "1px solid rgba(255,255,255,0.05)", pb: 2, mb: 2.5 }}>
                    <Typography sx={{ fontWeight: 800, fontSize: "0.8rem", letterSpacing: "0.05em", textTransform: "uppercase", color: "text.primary" }}>
                      ยอดเงินคงเหลือ (Balances)
                    </Typography>
                    <Wallet size={18} style={{ color: "#10b981" }} />
                  </Box>

                  <Box 
                    sx={{ 
                      display: "grid", 
                      gridTemplateColumns: "repeat(auto-fill, minmax(130px, 1fr))", 
                      gap: 1.5 
                    }}
                  >
                    {balances.length === 0 ? (
                      <Typography sx={{ color: "text.secondary", fontSize: "0.75rem", py: 2, gridColumn: "1 / -1", textAlign: "center" }}>
                        กำลังดึงข้อมูลยอดเงินคงเหลือ...
                      </Typography>
                    ) : (
                      balances.map((item) => {
                        const isThb = item.asset === "THB";
                        return (
                          <Paper 
                            key={item.asset} 
                            elevation={0}
                            sx={{
                              p: 1.8,
                              borderRadius: "12px",
                              backgroundColor: isThb ? "rgba(16, 185, 129, 0.03)" : "rgba(255, 255, 255, 0.01)",
                              border: isThb ? "1px solid rgba(16, 185, 129, 0.15)" : "1px solid rgba(255, 255, 255, 0.04)"
                            }}
                          >
                            <Typography sx={{ fontSize: "10px", fontWeight: 800, color: isThb ? "primary.main" : "text.secondary", letterSpacing: "0.05em" }}>
                              {item.asset}
                            </Typography>
                            <Typography sx={{ fontSize: "13px", fontWeight: 800, color: "text.primary", fontFamily: "monospace", mt: 0.5 }}>
                              {isThb 
                                ? item.free.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 }) 
                                : item.free.toLocaleString(undefined, { maximumFractionDigits: 6 })}
                            </Typography>
                            
                            <Stack spacing={0.2} sx={{ mt: 1.5, pt: 1, borderTop: "1px solid rgba(255,255,255,0.03)" }}>
                              <Box sx={{ display: "flex", justifyContent: "space-between", fontSize: "8px", fontWeight: 700, color: "text.secondary" }}>
                                <span>LOCKED</span>
                                <span>{item.used.toLocaleString(undefined, { maximumFractionDigits: 4 })}</span>
                              </Box>
                              <Box sx={{ display: "flex", justifyContent: "space-between", fontSize: "8px", fontWeight: 700, color: "text.secondary" }}>
                                <span>TOTAL</span>
                                <span>{item.total.toLocaleString(undefined, { maximumFractionDigits: 4 })}</span>
                              </Box>
                            </Stack>
                          </Paper>
                        );
                      })
                    )}
                  </Box>
                </CardContent>
              </Card>

              {/* Live Tickers Card */}
              <Card>
                <CardContent sx={{ p: 3 }}>
                  <Box sx={{ display: "flex", justifyContent: "space-between", alignItems: "center", borderBottom: "1px solid rgba(255,255,255,0.05)", pb: 2, mb: 2 }}>
                    <Box sx={{ display: "flex", alignItems: "center", gap: 1.5 }}>
                      <Typography sx={{ fontWeight: 800, fontSize: "0.8rem", letterSpacing: "0.05em", textTransform: "uppercase", color: "text.primary" }}>
                        ราคาตลาดเรียลไทม์
                      </Typography>
                      <Chip
                        size="small"
                        label={wsConnected ? "LIVE" : "OFFLINE"}
                        sx={{
                          height: 20,
                          fontSize: "9px",
                          fontWeight: 800,
                          letterSpacing: "0.08em",
                          backgroundColor: wsConnected ? "rgba(16, 185, 129, 0.1)" : "rgba(244, 63, 94, 0.1)",
                          color: wsConnected ? "#10b981" : "#f43f5e",
                          border: wsConnected ? "1px solid rgba(16, 185, 129, 0.2)" : "1px solid rgba(244, 63, 94, 0.2)",
                          animation: wsConnected ? "live-pulse 2s ease-in-out infinite" : "none",
                          "@keyframes live-pulse": {
                            "0%, 100%": { boxShadow: "0 0 0 0 rgba(16, 185, 129, 0)" },
                            "50%": { boxShadow: "0 0 8px 0 rgba(16, 185, 129, 0.2)" },
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

                  <TableContainer sx={{ maxHeight: 420, overflowY: "auto" }}>
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
                            <TableCell colSpan={4} align="center" sx={{ py: 3, color: "text.secondary", fontSize: "0.75rem" }}>
                              กำลังโหลดข้อมูลราคาคู่เหรียญ...
                            </TableCell>
                          </TableRow>
                        ) : visibleMarketTickers.length === 0 ? (
                          <TableRow>
                            <TableCell colSpan={4} align="center" sx={{ py: 3, color: "text.secondary", fontSize: "0.75rem" }}>
                              No market pairs found
                            </TableCell>
                          </TableRow>
                        ) : (
                          visibleMarketTickers.map(([symbol, data]) => {
                              const isPos = data.percentage > 0;
                              const pctColor = isPos ? "primary.main" : (data.percentage < 0 ? "error.main" : "text.secondary");
                              
                              return (
                                <TableRow key={symbol}>
                                  <TableCell sx={{ pl: 0, fontWeight: 700, fontSize: "0.75rem" }}>{symbol}</TableCell>
                                  <TableCell align="right" sx={{ color: "primary.main", fontWeight: 800, fontFamily: "monospace", fontSize: "0.75rem" }}>
                                    {data.last.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                                  </TableCell>
                                  <TableCell align="right" sx={{ color: "text.secondary", fontFamily: "monospace", fontSize: "0.7rem", display: { xs: "none", sm: "table-cell" } }}>
                                    {data.quoteVolume > 1000000
                                      ? `${(data.quoteVolume / 1000000).toFixed(1)}M`
                                      : data.quoteVolume > 1000
                                        ? `${(data.quoteVolume / 1000).toFixed(1)}K`
                                        : data.quoteVolume.toFixed(0)}
                                  </TableCell>
                                  <TableCell align="right" sx={{ pr: 0, color: pctColor, fontWeight: 800, fontFamily: "monospace", fontSize: "0.75rem" }}>
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
                    <Box sx={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 1.5, mt: 2 }}>
                      <Typography sx={{ fontSize: "0.7rem", color: "text.secondary", fontFamily: "monospace" }}>
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
                        <Typography sx={{ minWidth: 52, textAlign: "center", alignSelf: "center", fontSize: "0.7rem", color: "text.secondary", fontFamily: "monospace" }}>
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
