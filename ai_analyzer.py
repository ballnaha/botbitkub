import json
import os
import time
from typing import Any, Dict

import requests


DEFAULT_AI_RESULT = {
    "decision": "buy",
    "score": 70,
    "confidence": 0.5,
    "reason": "AI รีวิวขัดข้องชั่วคราว กำลังใช้สัญญาณเทคนิคัลหลักแทน",
    "replace_candidate": "",
}


class GeminiTradeAnalyzer:
    def __init__(self):
        self.session = requests.Session()
        self.session.trust_env = False
        self.request_timestamps = []

    def _wait_for_rate_limit(self):
        import time
        now = time.time()
        # Keep only timestamps in the last 60 seconds
        self.request_timestamps = [t for t in self.request_timestamps if now - t < 60]
        
        # Safe limit: max 12 requests per minute (below 15 RPM)
        limit = 12
        if len(self.request_timestamps) >= limit:
            oldest_t = self.request_timestamps[0]
            sleep_time = 60 - (now - oldest_t)
            if sleep_time > 0:
                time.sleep(sleep_time)
                now = time.time()
                self.request_timestamps = [t for t in self.request_timestamps if now - t < 60]
        
        self.request_timestamps.append(now)

    def is_configured(self, config: Dict[str, Any] = None) -> bool:
        provider = (config or {}).get("ai_provider", "gemini")
        if provider == "deepseek":
            return bool(os.getenv("DEEPSEEK_API_KEY"))
        return bool(os.getenv("GEMINI_API_KEY"))

    def _sanitize_floats(self, obj):
        import math
        if isinstance(obj, dict):
            return {k: self._sanitize_floats(v) for k, v in obj.items()}
        elif isinstance(obj, list):
            return [self._sanitize_floats(x) for x in obj]
        elif isinstance(obj, float):
            if math.isnan(obj) or math.isinf(obj):
                return None
            return obj
        return obj

    def analyze_buy_signal(
        self,
        symbol: str,
        market_snapshot: Dict[str, Any],
        positions_snapshot: Dict[str, Any],
        config: Dict[str, Any],
    ) -> Dict[str, Any]:
        market_snapshot = self._sanitize_floats(market_snapshot)
        positions_snapshot = self._sanitize_floats(positions_snapshot)
        
        provider = config.get("ai_provider", "gemini").lower()
        
        if provider == "deepseek":
            api_key = os.getenv("DEEPSEEK_API_KEY")
            if not api_key:
                return {
                    **DEFAULT_AI_RESULT,
                    "reason": "ยังไม่ได้ตั้งค่า DEEPSEEK_API_KEY ในไฟล์ .env | บอทจะใช้สัญญาณจากกลยุทธ์โดยไม่ผ่านการกรอง",
                }
        else:
            api_key = os.getenv("GEMINI_API_KEY")
            if not api_key:
                return {
                    **DEFAULT_AI_RESULT,
                    "reason": "ยังไม่ได้ตั้งค่า GEMINI_API_KEY ในไฟล์ .env | บอทจะใช้สัญญาณจากกลยุทธ์โดยไม่ผ่านการกรอง",
                }

        # Enforce rate limit (max 12 requests per 60 seconds)
        self._wait_for_rate_limit()

        timeout = float(config.get("ai_timeout_seconds", 8))

        if provider == "deepseek":
            model = config.get("ai_model") or "deepseek-reasoner"
            # Ensure model is appropriate for deepseek if it was set to gemini before
            if "gemini" in model:
                model = "deepseek-reasoner"
                
            url = "https://api.deepseek.com/chat/completions"
            prompt = self._build_prompt(symbol, market_snapshot, positions_snapshot, config, provider)
            payload = {
                "model": model,
                "messages": [
                    {"role": "user", "content": prompt}
                ]
            }
            if "reasoner" not in model:
                payload["temperature"] = 0.2

            response = self.session.post(
                url,
                headers={
                    "Authorization": f"Bearer {api_key}",
                    "Content-Type": "application/json"
                },
                json=payload,
                timeout=timeout,
            )
            response.raise_for_status()
            raw = response.json()
            text = raw["choices"][0]["message"]["content"]
            parsed = self._extract_json(text)
            return self._normalize_result(parsed)
        else:
            model = config.get("ai_model") or "gemini-3.5-flash"
            if "deepseek" in model:
                model = "gemini-3.5-flash"
                
            url = f"https://generativelanguage.googleapis.com/v1beta/models/{model}:generateContent"
            prompt = self._build_prompt(symbol, market_snapshot, positions_snapshot, config, provider)
            payload = {
                "contents": [{"parts": [{"text": prompt}]}],
                "generationConfig": {
                    "temperature": 0.2,
                    "responseMimeType": "application/json",
                    "responseSchema": {
                        "type": "OBJECT",
                        "properties": {
                            "decision": {
                                "type": "STRING",
                                "enum": ["buy", "watch", "skip"],
                                "description": "buy if the signal is strong enough, watch if promising but not enough, skip if weak or risky.",
                            },
                            "score": {
                                "type": "INTEGER",
                                "description": "Opportunity score from 0 to 100.",
                            },
                            "confidence": {
                                "type": "NUMBER",
                                "description": "Confidence from 0.0 to 1.0.",
                            },
                            "reason": {
                                "type": "STRING",
                                "description": "Short practical reason for the decision. MUST write this explanation in THAI language only.",
                            },
                            "replace_candidate": {
                                "type": "STRING",
                                "description": "Weakest current position symbol if a replacement should be considered, otherwise empty string.",
                            },
                        },
                        "required": ["decision", "score", "confidence", "reason", "replace_candidate"],
                    },
                },
            }

            response = self.session.post(
                url,
                headers={"x-goog-api-key": api_key, "Content-Type": "application/json"},
                json=payload,
                timeout=timeout,
            )
            response.raise_for_status()
            raw = response.json()
            text = self._extract_text(raw)
            parsed = json.loads(text)
            return self._normalize_result(parsed)

    def _build_prompt(
        self,
        symbol: str,
        market_snapshot: Dict[str, Any],
        positions_snapshot: Dict[str, Any],
        config: Dict[str, Any],
        provider: str = "gemini"
    ) -> str:
        max_open = int(config.get("max_open_trades", 3))
        used_slots = len(positions_snapshot)
        min_score = int(config.get("ai_min_score", 65))
        min_confidence = float(config.get("ai_min_confidence", 0.55))
        context = {
            "symbol": symbol,
            "market": market_snapshot,
            "active_positions": positions_snapshot,
            "risk_rules": {
                "max_open_trades": max_open,
                "used_slots": used_slots,
                "slots_available": max(0, max_open - used_slots),
                "stake_amount_thb": config.get("stake_amount_thb"),
                "max_budget_thb": config.get("max_budget_thb"),
                "take_profit_pct": config.get("take_profit_pct"),
                "stop_loss_pct": config.get("stop_loss_pct"),
                "min_ai_score": min_score,
                "min_ai_confidence": min_confidence,
            },
        }
        prompt = (
            "You are a conservative crypto spot-trading signal reviewer for a Bitkub THB bot. "
            "The strategy has already produced a BUY signal. Your job is only to score and filter it. "
            "Do not invent prices. Prefer watch/skip when score or confidence is weak. "
            "If slots are full, do not force a buy; use watch and optionally name a weak replace_candidate. "
            "CRITICAL: Write the 'reason' field in the JSON output in THAI language only.\n\n"
            f"Context:\n{json.dumps(context, ensure_ascii=False, default=str)}"
        )
        if provider == "deepseek":
            prompt += (
                "\n\nYou MUST reply in JSON format only matching this schema:\n"
                "{\n"
                '  "decision": "buy" | "watch" | "skip",\n'
                '  "score": integer (0-100),\n'
                '  "confidence": float (0.0-1.0),\n'
                '  "reason": "Short reason in THAI language explaining your decision",\n'
                '  "replace_candidate": "symbol or empty string"\n'
                "}\n"
                "Do not add any markup or introductory text other than the JSON block."
            )
        return prompt

    def _extract_text(self, raw: Dict[str, Any]) -> str:
        candidates = raw.get("candidates") or []
        if not candidates:
            raise ValueError("Gemini returned no candidates")
        parts = candidates[0].get("content", {}).get("parts", [])
        if not parts or "text" not in parts[0]:
            raise ValueError("Gemini returned no text")
        return parts[0]["text"]

    def _extract_json(self, text: str) -> Dict[str, Any]:
        import re
        # Strip thinking process
        text = re.sub(r'<think>.*?</think>', '', text, flags=re.DOTALL)
        
        # Find JSON block
        match = re.search(r'\{.*\}', text, flags=re.DOTALL)
        if match:
            return json.loads(match.group(0))
        raise ValueError(f"Could not extract JSON from text: {text}")

    def _normalize_result(self, parsed: Dict[str, Any]) -> Dict[str, Any]:
        decision = str(parsed.get("decision", "watch")).lower()
        if decision not in {"buy", "watch", "skip"}:
            decision = "watch"
        score = int(max(0, min(100, int(parsed.get("score", 0)))))
        confidence = float(parsed.get("confidence", 0.0))
        confidence = max(0.0, min(1.0, confidence))
        reason = str(parsed.get("reason", "")).strip()[:240]
        replace_candidate = str(parsed.get("replace_candidate", "")).strip().upper()
        return {
            "decision": decision,
            "score": score,
            "confidence": confidence,
            "reason": reason or "ไม่ได้รับคำชี้แจงเหตุผลจาก AI",
            "replace_candidate": replace_candidate,
            "analyzed_at": int(time.time()),
        }
