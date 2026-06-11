import React, { useEffect, useMemo, useState } from "react";
import type { Dispatch, SetStateAction } from "react";
import { Box, Card, CardContent, Checkbox, Chip, IconButton, Stack, Tab, Table, TableBody, TableCell, TableContainer, TableHead, TableRow, Tabs, TextField, Tooltip, Typography } from "@mui/material";
import { ChevronLeft, ChevronRight, Star, TrendingUp } from "lucide-react";
import type { TickerData } from "./dashboardTypes";

const MARKET_ROWS_PER_PAGE = 50;
const FAVORITES_STORAGE_KEY = "botbitkup.favoriteMarkets";

type MarketTab = "favorites" | "volume" | "top_gainers" | "top_losers";

interface LiveMarketTabsProps {
  filteredMarketTickers: [string, TickerData][];
  marketPage: number;
  marketSearch: string;
  setMarketPage: Dispatch<SetStateAction<number>>;
  setMarketSearch: Dispatch<SetStateAction<string>>;
  setTradeAmount: Dispatch<SetStateAction<string>>;
  setTradeSymbol: Dispatch<SetStateAction<string>>;
  sortedTickers: [string, TickerData][];
  tradeSymbol: string;
  wsConnected: boolean;
}

export function LiveMarketTabs({
  filteredMarketTickers,
  marketPage,
  marketSearch,
  setMarketPage,
  setMarketSearch,
  setTradeAmount,
  setTradeSymbol,
  sortedTickers,
  tradeSymbol,
  wsConnected,
}: LiveMarketTabsProps) {
  const [marketTab, setMarketTab] = useState<MarketTab>("volume");
  const [favoriteSymbols, setFavoriteSymbols] = useState<string[]>(() => {
    try {
      if (typeof window === "undefined") return [];
      const stored = window.localStorage.getItem(FAVORITES_STORAGE_KEY);
      const parsed = stored ? JSON.parse(stored) : [];
      const symbols = Array.isArray(parsed) ? parsed : parsed?.symbols;
      return Array.isArray(symbols) ? symbols.filter((item) => typeof item === "string") : [];
    } catch {
      return [];
    }
  });

  useEffect(() => {
    try {
      window.localStorage.setItem(FAVORITES_STORAGE_KEY, JSON.stringify({
        version: 1,
        symbols: favoriteSymbols,
      }));
    } catch {
      // Ignore storage failures; favorites still work for the current session.
    }
  }, [favoriteSymbols]);

  const visibleMarketTickers = useMemo(() => {
    const favorites = new Set(favoriteSymbols);
    const source = marketTab === "volume" ? filteredMarketTickers : sortedTickers;
    const query = marketSearch.trim().toUpperCase();
    const searched = query ? source.filter(([symbol]) => symbol.toUpperCase().includes(query)) : source;

    if (marketTab === "favorites") {
      return searched.filter(([symbol]) => favorites.has(symbol));
    }

    if (marketTab === "top_gainers") {
      return [...searched].sort((a, b) => b[1].percentage - a[1].percentage);
    }

    if (marketTab === "top_losers") {
      return [...searched].sort((a, b) => a[1].percentage - b[1].percentage);
    }

    return searched;
  }, [favoriteSymbols, filteredMarketTickers, marketSearch, marketTab, sortedTickers]);

  const pageCount = Math.max(1, Math.ceil(visibleMarketTickers.length / MARKET_ROWS_PER_PAGE));
  const page = Math.min(marketPage, pageCount - 1);
  const pagedTickers = visibleMarketTickers.slice(page * MARKET_ROWS_PER_PAGE, page * MARKET_ROWS_PER_PAGE + MARKET_ROWS_PER_PAGE);

  useEffect(() => {
    setMarketPage((current) => Math.min(current, pageCount - 1));
  }, [pageCount, setMarketPage]);

  const toggleFavorite = (symbol: string) => {
    setFavoriteSymbols((current) => (
      current.includes(symbol)
        ? current.filter((item) => item !== symbol)
        : [...current, symbol]
    ));
  };

  return (
    <Card>
      <CardContent sx={{ p: 2 }}>
        <Box sx={{ display: "flex", gap: 1.25, alignItems: { xs: "stretch", sm: "center" }, justifyContent: "space-between", borderBottom: "1px solid rgba(255,255,255,0.05)", pb: 1.25, mb: 1.25, flexDirection: { xs: "column", sm: "row" } }}>
          <Box sx={{ display: "flex", alignItems: "center", gap: 1, minWidth: 0 }}>
            <TrendingUp size={18} style={{ color: "#3b82f6", flexShrink: 0 }} />
            <Typography sx={{ fontWeight: 600, fontSize: "0.9rem", letterSpacing: "0.05em", textTransform: "uppercase", color: "text.primary", whiteSpace: "nowrap" }}>
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
              }}
            />
          </Box>
          <TextField
            size="small"
            value={marketSearch}
            onChange={(e) => {
              setMarketSearch(e.target.value);
              setMarketPage(0);
            }}
            placeholder="Search market"
            sx={{ width: { xs: "100%", sm: 170 }, flexShrink: 0, "& .MuiOutlinedInput-root": { height: 34 } }}
          />
        </Box>

        <Tabs
          value={marketTab}
          onChange={(_, value) => {
            setMarketTab(value);
            setMarketPage(0);
          }}
          variant="scrollable"
          scrollButtons="auto"
          sx={{
            minHeight: 34,
            mb: 1,
            "& .MuiTab-root": { minHeight: 34, px: 1.25, fontSize: "0.78rem", fontWeight: 600, textTransform: "none" },
            "& .MuiTabs-indicator": { backgroundColor: "primary.main" },
          }}
        >
          <Tab value="favorites" label={`รายการโปรด (${favoriteSymbols.length})`} />
          <Tab value="volume" label="ปริมาณ 24 ชม." />
          <Tab value="top_gainers" label="% เพิ่มสูงสุด" />
          <Tab value="top_losers" label="% ลดสูงสุด" />
        </Tabs>

        <TableContainer sx={{ maxHeight: 500, overflowY: "auto" }}>
          <Table size="small" stickyHeader sx={{ tableLayout: "fixed", "& .MuiTableCell-root": { py: 0.65, px: 0.75 }, "& .MuiTableCell-stickyHeader": { backgroundColor: "#0d1321", py: 0.8 } }}>
            <TableHead>
              <TableRow>
                <TableCell sx={{ pl: 0.75, width: 34 }} />
                <TableCell>คู่เหรียญ</TableCell>
                <TableCell align="right">ล่าสุด</TableCell>
                <TableCell align="right" sx={{ display: { xs: "none", sm: "table-cell" } }}>Vol 24h</TableCell>
                <TableCell align="right" sx={{ pr: 0.75 }}>เปลี่ยนแปลง</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {sortedTickers.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={5} align="center" sx={{ py: 3, color: "text.secondary", fontSize: "0.85rem" }}>
                    กำลังโหลดข้อมูลราคาคู่เหรียญ...
                  </TableCell>
                </TableRow>
              ) : pagedTickers.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={5} align="center" sx={{ py: 3, color: "text.secondary", fontSize: "0.85rem" }}>
                    {marketTab === "favorites" ? "ยังไม่มีรายการโปรด" : "No market pairs found"}
                  </TableCell>
                </TableRow>
              ) : (
                pagedTickers.map(([symbol, data]) => {
                  const isPos = data.percentage > 0;
                  const pctColor = isPos ? "primary.main" : (data.percentage < 0 ? "error.main" : "text.secondary");
                  const isSelected = tradeSymbol === symbol;
                  const isFavorite = favoriteSymbols.includes(symbol);

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
                        "&:hover": { backgroundColor: "rgba(255, 255, 255, 0.04)" },
                        backgroundColor: isSelected ? "rgba(0, 193, 106, 0.08)" : "transparent",
                        boxShadow: isSelected ? "inset 0 0 0 1px rgba(0, 193, 106, 0.18)" : "none",
                        "& td": { borderColor: isSelected ? "rgba(0, 193, 106, 0.14)" : "rgba(255, 255, 255, 0.06)" },
                        "& td:first-of-type": { borderLeft: isSelected ? "3px solid #00c16a" : "3px solid transparent" },
                      }}
                    >
                      <TableCell sx={{ pl: 0.75 }}>
                        <Tooltip title={isFavorite ? "นำออกจากรายการโปรด" : "เพิ่มในรายการโปรด"}>
                          <Checkbox
                            checked={isFavorite}
                            icon={<Star size={14} />}
                            checkedIcon={<Star size={14} fill="#fbbf24" />}
                            onClick={(e) => {
                              e.stopPropagation();
                              toggleFavorite(symbol);
                            }}
                            sx={{ p: 0, color: "rgba(255,255,255,0.25)", "&.Mui-checked": { color: "#fbbf24" } }}
                          />
                        </Tooltip>
                      </TableCell>
                      <TableCell sx={{ fontWeight: 500, fontSize: "0.85rem", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis", color: isSelected ? "primary.main" : "text.primary" }}>{symbol}</TableCell>
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
                      <TableCell align="right" sx={{ pr: 0.75, color: pctColor, fontWeight: 600, fontFamily: "monospace", fontSize: "0.85rem" }}>
                        {isPos ? "+" : ""}{data.percentage.toFixed(2)}%
                      </TableCell>
                    </TableRow>
                  );
                })
              )}
            </TableBody>
          </Table>
        </TableContainer>
        {visibleMarketTickers.length > MARKET_ROWS_PER_PAGE && (
          <Box sx={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 1, mt: 1.25 }}>
            <Typography sx={{ fontSize: "0.8rem", color: "text.secondary", fontFamily: "monospace" }}>
              {page * MARKET_ROWS_PER_PAGE + 1}-{Math.min((page + 1) * MARKET_ROWS_PER_PAGE, visibleMarketTickers.length)} / {visibleMarketTickers.length}
            </Typography>
            <Stack direction="row" spacing={1}>
              <Tooltip title="Previous page">
                <span>
                  <IconButton size="small" disabled={page === 0} onClick={() => setMarketPage((current) => Math.max(0, current - 1))}>
                    <ChevronLeft size={16} />
                  </IconButton>
                </span>
              </Tooltip>
              <Typography sx={{ minWidth: 52, textAlign: "center", alignSelf: "center", fontSize: "0.8rem", color: "text.secondary", fontFamily: "monospace" }}>
                {page + 1}/{pageCount}
              </Typography>
              <Tooltip title="Next page">
                <span>
                  <IconButton size="small" disabled={page >= pageCount - 1} onClick={() => setMarketPage((current) => Math.min(pageCount - 1, current + 1))}>
                    <ChevronRight size={16} />
                  </IconButton>
                </span>
              </Tooltip>
            </Stack>
          </Box>
        )}
      </CardContent>
    </Card>
  );
}
