"use client";

import { useEffect, useRef, useCallback, useMemo, useState } from "react";

interface TickerData {
  last: number;
  bid?: number;
  ask?: number;
  high: number;
  low: number;
  percentage: number;
  quoteVolume: number;
}

type TickerMap = Record<string, TickerData>;

interface BitkubTickerInfo {
  isFrozen?: number;
  last?: number;
  highestBid?: number;
  lowestAsk?: number;
  high24hr?: number;
  low24hr?: number;
  percentChange?: number;
  quoteVolume?: number;
}

const BITKUB_TICKER_API = "https://api.bitkub.com/api/market/ticker";
const BITKUB_WS_BASE = "wss://api.bitkub.com/websocket-api/";

const RECONNECT_DELAY_BASE = 2000;
const MAX_RECONNECT_DELAY = 30000;
const TICKER_FLUSH_INTERVAL = 1000;
const WEBSOCKET_SYMBOL_LIMIT = 50;

// Convert Bitkub symbol "THB_BTC" → standard "BTC/THB"
function bitkubToStandard(bitkubSymbol: string): string {
  const parts = bitkubSymbol.split("_");
  if (parts.length === 2) {
    return `${parts[1]}/${parts[0]}`;
  }
  return bitkubSymbol;
}

// Convert standard "BTC/THB" → Bitkub stream "market.ticker.thb_btc"
function standardToStream(symbol: string): string {
  const parts = symbol.split("/");
  if (parts.length === 2) {
    return `market.ticker.${parts[1]}_${parts[0]}`.toLowerCase();
  }
  return symbol;
}

// Reverse stream to standard symbol
function streamToStandard(stream: string): string | null {
  // "market.ticker.thb_btc" → "BTC/THB"
  const match = stream.match(/^market\.ticker\.(\w+)_(\w+)$/i);
  if (match) {
    return `${match[2].toUpperCase()}/${match[1].toUpperCase()}`;
  }
  return null;
}

export function useBitkubWebSocket(
  onUpdate: (tickers: TickerMap) => void,
  extraSymbols: string[] = [],
  options: { enabled?: boolean; includeBaseSymbols?: boolean } = {},
) {
  const enabled = options.enabled ?? true;
  const includeBaseSymbols = options.includeBaseSymbols ?? true;
  const wsRef = useRef<WebSocket | null>(null);
  const connectWebSocketRef = useRef<(symbols: string[]) => void>(() => {});
  const tickersRef = useRef<TickerMap>({});
  const pendingTickersRef = useRef<TickerMap>({});
  const baseStreamSymbolsRef = useRef<string[]>([]);
  const symbolsRef = useRef<string[]>([]);
  const reconnectAttemptRef = useRef(0);
  const reconnectTimerRef = useRef<NodeJS.Timeout | null>(null);
  const flushTimerRef = useRef<NodeJS.Timeout | null>(null);
  const hasPendingTickerRef = useRef(false);
  const isUnmountedRef = useRef(false);
  const [isConnected, setIsConnected] = useState(false);
  const [streamSymbolCount, setStreamSymbolCount] = useState(0);
  const [totalSymbolCount, setTotalSymbolCount] = useState(0);
  const extraStreamSymbols = useMemo(() => {
    return Array.from(new Set(extraSymbols.filter(Boolean)));
  }, [extraSymbols]);

  const buildStreamSymbols = useCallback((baseSymbols: string[]) => {
    return Array.from(new Set([...baseSymbols, ...extraStreamSymbols]));
  }, [extraStreamSymbols]);

  const clearTimers = useCallback(() => {
    if (reconnectTimerRef.current) {
      clearTimeout(reconnectTimerRef.current);
      reconnectTimerRef.current = null;
    }
    if (flushTimerRef.current) {
      clearTimeout(flushTimerRef.current);
      flushTimerRef.current = null;
    }
  }, []);

  const flushTickerUpdates = useCallback(() => {
    flushTimerRef.current = null;
    if (isUnmountedRef.current || !hasPendingTickerRef.current) return;

    hasPendingTickerRef.current = false;
    const pendingTickers = pendingTickersRef.current;
    pendingTickersRef.current = {};
    onUpdate({ ...pendingTickers });
  }, [onUpdate]);

  const scheduleTickerFlush = useCallback(() => {
    hasPendingTickerRef.current = true;
    if (flushTimerRef.current) return;

    flushTimerRef.current = setTimeout(flushTickerUpdates, TICKER_FLUSH_INTERVAL);
  }, [flushTickerUpdates]);

  const connectWebSocket = useCallback((symbols: string[]) => {
    if (isUnmountedRef.current) return;

    // Close existing connection
    if (wsRef.current) {
      wsRef.current.onclose = null;
      wsRef.current.close();
      wsRef.current = null;
    }

    if (symbols.length === 0) {
      setIsConnected(false);
      return;
    }

    // Build stream URL from all symbols
    const streams = symbols.map(standardToStream).join(",");
    const wsUrl = `${BITKUB_WS_BASE}${streams}`;

    try {
      const ws = new WebSocket(wsUrl);
      wsRef.current = ws;

      ws.onopen = () => {
        if (isUnmountedRef.current || wsRef.current !== ws) return;
        setIsConnected(true);
        reconnectAttemptRef.current = 0;
      };

      ws.onmessage = (event) => {
        if (isUnmountedRef.current || wsRef.current !== ws) return;

        try {
          const data = JSON.parse(event.data);
          if (data.event === "pong" || !data.stream) return;

          const symbol = streamToStandard(data.stream);
          if (!symbol) return;

          const previous = tickersRef.current[symbol];
          const nextTicker = {
            last: data.last ?? previous?.last ?? 0,
            bid: data.highestBid ?? previous?.bid ?? 0,
            ask: data.lowestAsk ?? previous?.ask ?? 0,
            high: data.high24hr ?? previous?.high ?? 0,
            low: data.low24hr ?? previous?.low ?? 0,
            percentage: data.percentChange ?? previous?.percentage ?? 0,
            quoteVolume: data.quoteVolume ?? previous?.quoteVolume ?? 0,
          };

          if (
            previous &&
            previous.last === nextTicker.last &&
            previous.bid === nextTicker.bid &&
            previous.ask === nextTicker.ask &&
            previous.high === nextTicker.high &&
            previous.low === nextTicker.low &&
            previous.percentage === nextTicker.percentage &&
            previous.quoteVolume === nextTicker.quoteVolume
          ) {
            return;
          }

          tickersRef.current[symbol] = nextTicker;
          pendingTickersRef.current[symbol] = nextTicker;
          scheduleTickerFlush();
        } catch {
          // Ignore parse errors
        }
      };

      ws.onclose = () => {
        if (isUnmountedRef.current || wsRef.current !== ws) return;
        setIsConnected(false);
        clearTimers();
        wsRef.current = null;

        const delay = Math.min(
          RECONNECT_DELAY_BASE * Math.pow(2, reconnectAttemptRef.current),
          MAX_RECONNECT_DELAY
        );
        reconnectAttemptRef.current += 1;

        reconnectTimerRef.current = setTimeout(() => {
          connectWebSocketRef.current(symbolsRef.current);
        }, delay);
      };

      ws.onerror = () => {
        if (wsRef.current !== ws) return;
        if (ws.readyState === WebSocket.OPEN) {
          ws.close();
        }
      };
    } catch {
      const delay = Math.min(
        RECONNECT_DELAY_BASE * Math.pow(2, reconnectAttemptRef.current),
        MAX_RECONNECT_DELAY
      );
      reconnectAttemptRef.current += 1;
      reconnectTimerRef.current = setTimeout(() => connectWebSocketRef.current(symbolsRef.current), delay);
    }
  }, [clearTimers, scheduleTickerFlush]);

  useEffect(() => {
    connectWebSocketRef.current = connectWebSocket;
  }, [connectWebSocket]);

  // Fetch all available symbols, then connect WebSocket
  useEffect(() => {
    if (!enabled) {
      isUnmountedRef.current = true;
      setIsConnected(false);
      setStreamSymbolCount(0);
      setTotalSymbolCount(0);
      clearTimers();
      if (wsRef.current) {
        wsRef.current.close();
        wsRef.current = null;
      }
      return;
    }

    isUnmountedRef.current = false;

    const init = async () => {
      try {
        const res = await fetch(BITKUB_TICKER_API);
        const data = await res.json();

        // Get all active (not frozen) THB pairs
        const activeSymbols: string[] = [];
        const initialTickers: TickerMap = {};

        for (const [bitkubSym, info] of Object.entries(data as Record<string, BitkubTickerInfo>)) {
          const tickerInfo = info;
          if (tickerInfo.isFrozen === 1) continue; // Skip frozen pairs
          if (!bitkubSym.startsWith("THB_")) continue;

          const stdSymbol = bitkubToStandard(bitkubSym);
          activeSymbols.push(stdSymbol);

          initialTickers[stdSymbol] = {
            last: tickerInfo.last ?? 0,
            bid: tickerInfo.highestBid ?? 0,
            ask: tickerInfo.lowestAsk ?? 0,
            high: tickerInfo.high24hr ?? 0,
            low: tickerInfo.low24hr ?? 0,
            percentage: tickerInfo.percentChange ?? 0,
            quoteVolume: tickerInfo.quoteVolume ?? 0,
          };
        }

        // Sort by volume (descending) so top coins appear first
        activeSymbols.sort((a, b) => {
          return (initialTickers[b]?.quoteVolume ?? 0) - (initialTickers[a]?.quoteVolume ?? 0);
        });

        const baseWebsocketSymbols = includeBaseSymbols ? activeSymbols.slice(0, WEBSOCKET_SYMBOL_LIMIT) : [];
        const websocketSymbols = buildStreamSymbols(baseWebsocketSymbols);
        baseStreamSymbolsRef.current = baseWebsocketSymbols;
        symbolsRef.current = websocketSymbols;
        tickersRef.current = initialTickers;
        pendingTickersRef.current = {};
        setStreamSymbolCount(websocketSymbols.length);
        setTotalSymbolCount(activeSymbols.length);

        // Send initial data
        onUpdate({ ...initialTickers });

        // Keep REST data for all pairs, but stream only the visible top symbols.
        connectWebSocket(websocketSymbols);
      } catch {
        // Fallback: try again after delay
        reconnectTimerRef.current = setTimeout(() => {
          if (!isUnmountedRef.current) {
            init();
          }
        }, 3000);
      }
    };

    init();

    return () => {
      isUnmountedRef.current = true;
      clearTimers();
      if (wsRef.current) {
        wsRef.current.close();
        wsRef.current = null;
      }
    };
  }, [buildStreamSymbols, clearTimers, connectWebSocket, enabled, includeBaseSymbols, onUpdate]);

  useEffect(() => {
    if (!enabled || isUnmountedRef.current) return;

    const nextSymbols = buildStreamSymbols(baseStreamSymbolsRef.current);
    if (nextSymbols.join("|") === symbolsRef.current.join("|")) return;

    symbolsRef.current = nextSymbols;
    setStreamSymbolCount(nextSymbols.length);
    connectWebSocket(nextSymbols);
  }, [buildStreamSymbols, connectWebSocket, enabled]);

  return { isConnected, streamSymbolCount, totalSymbolCount };
}
