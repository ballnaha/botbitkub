// DOM Elements
const quickConnectionStatus = document.getElementById('quick-connection-status');
const apiWarning = document.getElementById('api-warning');
const usernameDisplay = document.getElementById('username-display');

const balanceLoader = document.getElementById('balance-loader');
const balanceList = document.getElementById('balance-list');

const tickerLoader = document.getElementById('ticker-loader');
const tickerTableContainer = document.getElementById('ticker-table-container');
const tickerRows = document.getElementById('ticker-rows');

const consoleLogs = document.getElementById('console-logs');
const clearLogsBtn = document.getElementById('clear-logs-btn');

// Trading Form elements (Manual)
const tradeForm = document.getElementById('trade-form');
const symbolSelect = document.getElementById('symbol-select');
const amountInput = document.getElementById('amount-input');
const amountLabel = document.getElementById('amount-label');
const amountUnit = document.getElementById('amount-unit');
const tradeHelperText = document.getElementById('trade-helper-text');
const priceGroup = document.getElementById('price-group');
const priceInput = document.getElementById('price-input');
const submitTradeBtn = document.getElementById('submit-trade-btn');

// Bot UI Elements
const botToggle = document.getElementById('bot-toggle');
const botDryRunOn = document.getElementById('bot-dry-run-on');
const botDryRunOff = document.getElementById('bot-dry-run-off');
const botStakeInput = document.getElementById('bot-stake-input');
const botSlInput = document.getElementById('bot-sl-input');
const botTpInput = document.getElementById('bot-tp-input');
const saveBotConfigBtn = document.getElementById('save-bot-config-btn');

const positionsEmpty = document.getElementById('positions-empty');
const positionsTableContainer = document.getElementById('positions-table-container');
const positionRows = document.getElementById('position-rows');

const botLogs = document.getElementById('bot-logs');

const historyEmpty = document.getElementById('history-empty');
const historyTableContainer = document.getElementById('history-table-container');
const historyRows = document.getElementById('history-rows');
const logoutBtn = document.getElementById('logout-btn');

const quickThbBalance = document.getElementById('quick-thb-balance');
const quickBotStatus = document.getElementById('quick-bot-status');
const quickPositionsCount = document.getElementById('quick-positions-count');

// State Variables
let isConnected = false;

// ==========================================================================
// Custom UI Utilities: Toast Notifications & Promise-based Dialog Modals
// ==========================================================================

function showToast(message, type = 'success') {
    const container = document.getElementById('toast-container');
    if (!container) return;

    const toast = document.createElement('div');
    toast.className = `flex items-center gap-3 p-4 bg-slate-900/95 border rounded-xl shadow-2xl backdrop-blur-md pointer-events-auto transform translate-y-2 opacity-0 transition-all duration-300 ${
        type === 'success' ? 'border-emerald-500/30 text-emerald-400' :
        type === 'error' ? 'border-rose-500/30 text-rose-400' :
        'border-blue-500/30 text-blue-400'
    }`;
    
    let iconName = 'info';
    if (type === 'success') iconName = 'check-circle';
    else if (type === 'error') iconName = 'x-circle';

    toast.innerHTML = `
        <i data-lucide="${iconName}" class="w-5 h-5 shrink-0"></i>
        <div class="text-xs font-semibold text-slate-100 flex-1">${message}</div>
        <button class="text-slate-400 hover:text-slate-200 transition-colors ml-2 cursor-pointer focus:outline-none">
            <i data-lucide="x" class="w-4 h-4"></i>
        </button>
    `;

    container.appendChild(toast);
    if (window.lucide) {
        lucide.createIcons();
    }

    // Trigger transition
    setTimeout(() => {
        toast.classList.remove('translate-y-2', 'opacity-0');
    }, 10);

    const closeBtn = toast.querySelector('button');
    closeBtn.addEventListener('click', () => {
        dismissToast(toast);
    });

    // Auto-dismiss
    setTimeout(() => {
        dismissToast(toast);
    }, 4500);
}

function dismissToast(toast) {
    if (!toast) return;
    toast.classList.add('translate-y-2', 'opacity-0');
    setTimeout(() => {
        toast.remove();
    }, 300);
}

function showConfirmDialog({ title, message, confirmText = 'ยืนยัน', cancelText = 'ยกเลิก', type = 'info' }) {
    return new Promise((resolve) => {
        const modal = document.createElement('div');
        modal.className = "fixed inset-0 flex items-center justify-center bg-slate-950/80 backdrop-blur-sm z-[2000] p-4 animate-fade-in";
        
        let iconName = 'info';
        let titleColor = 'text-blue-400';
        let buttonBg = 'bg-blue-500 hover:bg-blue-600 hover:shadow-[0_0_15px_rgba(59,130,246,0.3)]';
        
        if (type === 'danger') {
            iconName = 'alert-triangle';
            titleColor = 'text-rose-400';
            buttonBg = 'bg-rose-500 hover:bg-rose-600 hover:shadow-[0_0_15px_rgba(244,63,94,0.3)]';
        } else if (type === 'success') {
            iconName = 'check-circle';
            titleColor = 'text-emerald-400';
            buttonBg = 'bg-emerald-500 hover:bg-emerald-600 hover:shadow-[0_0_15px_rgba(16,185,129,0.3)]';
        }
        
        modal.innerHTML = `
            <div class="bg-slate-900 border border-white/10 rounded-2xl p-6 max-w-sm w-full shadow-2xl space-y-6 transform scale-95 opacity-0 transition-all duration-300">
                <div class="space-y-2">
                    <h2 class="font-display font-bold text-lg ${titleColor} flex items-center gap-2 select-none">
                        <i data-lucide="${iconName}" class="w-5 h-5"></i> ${title}
                    </h2>
                    <p class="text-xs text-slate-300 leading-relaxed font-medium">${message}</p>
                </div>
                <div class="flex gap-3">
                    <button class="btn-cancel flex-1 py-3 bg-slate-800 text-slate-200 border border-slate-700 font-semibold text-xs rounded-xl hover:bg-slate-700 active:scale-[0.98] cursor-pointer transition-all">
                        ${cancelText}
                    </button>
                    <button class="btn-confirm flex-1 py-3 ${buttonBg} text-slate-950 font-bold text-xs rounded-xl active:scale-[0.98] cursor-pointer transition-all">
                        ${confirmText}
                    </button>
                </div>
            </div>
        `;
        
        document.body.appendChild(modal);
        if (window.lucide) {
            lucide.createIcons();
        }
        
        const card = modal.querySelector('div');
        setTimeout(() => {
            card.classList.remove('scale-95', 'opacity-0');
        }, 10);
        
        const close = (value) => {
            card.classList.add('scale-95', 'opacity-0');
            setTimeout(() => {
                modal.remove();
                resolve(value);
            }, 150);
        };
        
        modal.querySelector('.btn-cancel').addEventListener('click', () => close(false));
        modal.querySelector('.btn-confirm').addEventListener('click', () => close(true));
    });
}

// Add logs helper (Manual/System API logs)
function addLog(message, type = 'system') {
    const now = new Date();
    const timeStr = now.toTimeString().split(' ')[0];
    
    const logEntry = document.createElement('div');
    logEntry.className = `log-entry ${type}-log`;
    
    const timeSpan = document.createElement('span');
    timeSpan.className = 'log-time';
    timeSpan.textContent = `[${timeStr}]`;
    
    const msgText = document.createTextNode(typeof message === 'object' ? JSON.stringify(message) : message);
    
    logEntry.appendChild(timeSpan);
    logEntry.appendChild(msgText);
    
    consoleLogs.appendChild(logEntry);
    consoleLogs.scrollTop = consoleLogs.scrollHeight;
}

// Clear logs
clearLogsBtn.addEventListener('click', () => {
    consoleLogs.innerHTML = '';
    addLog('Logs cleared.', 'system');
});

// Logout action
if (logoutBtn) {
    logoutBtn.addEventListener('click', async () => {
        const confirmed = await showConfirmDialog({
            title: 'ออกจากระบบ (Logout)?',
            message: 'คุณต้องการออกจากระบบและยกเลิกเซสชันที่เชื่อมต่ออยู่นี้หรือไม่?',
            confirmText: 'ออกจากระบบ',
            type: 'danger'
        });
        if (confirmed) {
            addLog('กำลังออกจากระบบ...', 'info');
            showToast('กำลังออกจากระบบ...', 'info');
            try {
                const res = await fetch('/api/logout', { method: 'POST' });
                if (res.ok) {
                    window.location.href = '/login';
                } else {
                    showToast('ออกจากระบบล้มเหลว', 'error');
                }
            } catch (e) {
                showToast(`เกิดข้อผิดพลาด: ${e.message}`, 'error');
                window.location.href = '/login';
            }
        }
    });
}

// Segmented controls setup (Manual Trade Form)
function setupSegmentedControls() {
    const typeRadios = document.querySelectorAll('input[name="order-type"]');
    const sideRadios = document.querySelectorAll('input[name="order-side"]');

    typeRadios.forEach(radio => {
        radio.addEventListener('change', (e) => {
            const isLimit = e.target.value === 'limit';
            if (isLimit) {
                priceGroup.classList.remove('hidden');
                priceInput.required = true;
            } else {
                priceGroup.classList.add('hidden');
                priceInput.required = false;
                priceInput.value = '';
            }
            updateTradeHelper();
        });
    });

    sideRadios.forEach(radio => {
        radio.addEventListener('change', () => {
            updateTradeHelper();
        });
    });
}

function updateTradeHelper() {
    const side = document.querySelector('input[name="order-side"]:checked').value;
    const type = document.querySelector('input[name="order-type"]:checked').value;
    const symbol = symbolSelect.value;
    const cryptoToken = symbol.split('/')[0]; // e.g. BTC

    if (side === 'buy') {
        if (type === 'market') {
            amountLabel.textContent = 'จำนวนเงินที่ซื้อ (บาท THB)';
            amountUnit.textContent = 'THB';
            amountInput.placeholder = 'เช่น 50';
            tradeHelperText.textContent = `ระบุจำนวนเงิน THB ที่จะใช้ซื้อเหรียญ ${cryptoToken} ณ ราคาตลาดปัจจุบัน (ขั้นต่ำ 10 บาท)`;
        } else {
            amountLabel.textContent = `จำนวนเหรียญที่ต้องการซื้อ (${cryptoToken})`;
            amountUnit.textContent = cryptoToken;
            amountInput.placeholder = 'เช่น 0.001';
            tradeHelperText.textContent = `ระบุจำนวนเหรียญ ${cryptoToken} ที่จะส่งซื้อแบบกำหนดราคาเอง`;
        }
    } else { // sell
        amountLabel.textContent = `จำนวนเหรียญที่จะขาย (${cryptoToken})`;
        amountUnit.textContent = cryptoToken;
        amountInput.placeholder = 'เช่น 0.005';
        if (type === 'market') {
            tradeHelperText.textContent = `ระบุจำนวนเหรียญ ${cryptoToken} ที่จะขายออกทันที ณ ราคาตลาดปัจจุบัน`;
        } else {
            tradeHelperText.textContent = `ระบุจำนวนเหรียญ ${cryptoToken} ที่จะตั้งขายแบบกำหนดราคาเอง`;
        }
    }
}

let tvWidget = null;
function loadTradingViewChart(symbol) {
    const cleanSymbol = symbol.replace('/', '');
    const tvSymbol = `BITKUB:${cleanSymbol}`;
    
    if (window.TradingView) {
        tvWidget = new TradingView.widget({
            "autosize": true,
            "symbol": tvSymbol,
            "interval": "15",
            "timezone": "Asia/Bangkok",
            "theme": "dark",
            "style": "1",
            "locale": "th",
            "enable_publishing": false,
            "hide_legend": false,
            "save_image": false,
            "container_id": "tradingview_chart"
        });
    }
}

symbolSelect.addEventListener('change', () => {
    updateTradeHelper();
    loadTradingViewChart(symbolSelect.value);
});

// ==========================================================================
// API Connection Status Polling
// ==========================================================================
async function checkStatus() {
    try {
        const res = await fetch('/api/status');
        const data = await res.json();
        
        if (data.status === 'connected') {
            if (quickConnectionStatus) {
                quickConnectionStatus.innerHTML = `<span class="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-[11px] font-bold bg-emerald-500/10 border border-emerald-500/20 text-emerald-400"><span class="status-indicator connected"></span> Connected to Bitkub</span>`;
            }
            apiWarning.classList.add('hidden');
            if (!isConnected) {
                addLog('เชื่อมต่อกับ Bitkub API สำเร็จแล้ว!', 'success');
                showToast('เชื่อมต่อกับ Bitkub API สำเร็จแล้ว!', 'success');
                isConnected = true;
                fetchBalance(); // Fetch immediately when connected
            }
        } else {
            if (quickConnectionStatus) {
                quickConnectionStatus.innerHTML = `<span class="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-[11px] font-bold bg-rose-500/10 border border-rose-500/20 text-rose-400"><span class="status-indicator disconnected"></span> Disconnected</span>`;
            }
            apiWarning.classList.remove('hidden');
            if (isConnected) {
                addLog(`ยังไม่ได้เชื่อมต่อ: ${data.message}`, 'error');
                showToast('ขาดการเชื่อมต่อกับ Bitkub API', 'error');
                isConnected = false;
            } else if (isConnected === false) {
                isConnected = null; // Prevent repeated toast notifications on polling
                addLog(`ยังไม่ได้เชื่อมต่อ: ${data.message}`, 'error');
            }
            balanceLoader.classList.add('hidden');
            balanceList.classList.add('hidden');
        }
    } catch (e) {
        if (quickConnectionStatus) {
            quickConnectionStatus.innerHTML = `<span class="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-[11px] font-bold bg-rose-500/10 border border-rose-500/20 text-rose-400"><span class="status-indicator disconnected"></span> Connection Error</span>`;
        }
        addLog(`ตรวจสอบการเชื่อมต่อผิดพลาด: ${e.message}`, 'error');
        isConnected = false;
    }
}

let currentBalances = {};

// Fetch Account Balances
async function fetchBalance() {
    if (!isConnected) return;
    
    try {
        const res = await fetch('/api/balance');
        if (!res.ok) throw new Error(await res.text());
        
        const data = await res.json();
        
        balanceLoader.classList.add('hidden');
        balanceList.classList.remove('hidden');
        balanceList.innerHTML = '';
        
        if (data.status === 'success' && data.balances) {
            currentBalances = {}; // reset
            data.balances.forEach(b => {
                currentBalances[b.asset] = b;
                const isTHB = b.asset === 'THB';
                if (isTHB && quickThbBalance) {
                    quickThbBalance.textContent = b.free.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + ' THB';
                }
                const totalFormatted = b.total.toLocaleString(undefined, { minimumFractionDigits: isTHB ? 2 : 6, maximumFractionDigits: isTHB ? 2 : 4 });
                const freeFormatted = b.free.toLocaleString(undefined, { minimumFractionDigits: isTHB ? 2 : 6, maximumFractionDigits: isTHB ? 2 : 4 });
                const usedFormatted = b.used.toLocaleString(undefined, { minimumFractionDigits: isTHB ? 2 : 6, maximumFractionDigits: isTHB ? 2 : 4 });
                
                const item = document.createElement('div');
                item.className = `balance-item-new ${isTHB ? 'thb-active border-emerald-500/30' : ''}`;
                item.innerHTML = `
                    <div class="flex justify-between items-center mb-1.5 select-none">
                        <span class="text-xs font-bold text-slate-200">${b.asset}</span>
                        <span class="text-[9px] font-extrabold uppercase px-1.5 py-0.5 rounded bg-white/5 text-slate-400">${isTHB ? 'CASH' : 'CRYPTO'}</span>
                    </div>
                    <div class="text-sm font-display font-extrabold text-slate-100 tracking-tight mb-1 select-none">${totalFormatted}</div>
                    <div class="text-[9px] font-semibold text-slate-500 space-y-0.5">
                        <div class="flex justify-between"><span>พร้อมใช้:</span> <span class="text-slate-300 font-mono">${freeFormatted}</span></div>
                        <div class="flex justify-between"><span>ในออเดอร์:</span> <span class="text-slate-400 font-mono">${usedFormatted}</span></div>
                    </div>
                `;
                balanceList.appendChild(item);
            });
        }
    } catch (e) {
        balanceLoader.classList.add('hidden');
        addLog(`ดึงยอดเงินผิดพลาด: ${e.message}`, 'error');
    }
}

// Fetch Tickers
let previousPrices = {};
async function fetchTickers() {
    try {
        const res = await fetch('/api/tickers');
        if (!res.ok) throw new Error('Failed to fetch tickers');
        const data = await res.json();
        
        tickerLoader.classList.add('hidden');
        tickerTableContainer.classList.remove('hidden');
        
        if (data.status === 'success' && data.tickers) {
            tickerRows.innerHTML = '';
            
            Object.keys(data.tickers).forEach(symbol => {
                const t = data.tickers[symbol];
                const pct = t.percentage;
                
                let pctClass = 'percentage-neutral';
                let direction = '';
                if (pct > 0) {
                    pctClass = 'percentage-positive';
                    direction = '▲';
                } else if (pct < 0) {
                    pctClass = 'percentage-negative';
                    direction = '▼';
                }
                
                // Track price flash transition
                let flashClass = '';
                if (previousPrices[symbol]) {
                    if (t.last > previousPrices[symbol]) {
                        flashClass = 'flash-up';
                    } else if (t.last < previousPrices[symbol]) {
                        flashClass = 'flash-down';
                    }
                }
                previousPrices[symbol] = t.last;

                const row = document.createElement('tr');
                row.innerHTML = `
                    <td class="ticker-symbol">${symbol}</td>
                    <td class="ticker-price ${flashClass}">${t.last.toLocaleString()} THB</td>
                    <td>
                        <span class="percentage-badge ${pctClass}">
                            ${direction} ${pct > 0 ? '+' : ''}${pct.toFixed(2)}%
                        </span>
                    </td>
                    <td class="ticker-extremes">
                        H: ${t.high.toLocaleString()}<br>
                        L: ${t.low.toLocaleString()}
                    </td>
                `;
                tickerRows.appendChild(row);
            });
        }
    } catch (e) {
        tickerLoader.classList.add('hidden');
        addLog(`ดึงราคาตลาดผิดพลาด: ${e.message}`, 'error');
    }
}

// ==========================================================================
// Bot Controls & Configuration
// ==========================================================================

// Fetch Bot Status and Config
async function fetchBotStatus() {
    try {
        const res = await fetch('/api/bot/status');
        const data = await res.json();
        
        if (data.status !== 'error') {
            botToggle.checked = data.is_running;
            
            if (quickBotStatus) {
                if (data.is_running) {
                    quickBotStatus.innerHTML = `<span class="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-[11px] font-bold bg-emerald-500/10 border border-emerald-500/20 text-emerald-400"><span class="status-indicator connected"></span> กำลังทำงาน</span>`;
                } else {
                    quickBotStatus.innerHTML = `<span class="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-[11px] font-bold bg-slate-900/60 border border-white/5 text-slate-400"><span class="status-indicator disconnected"></span> ปิดการทำงาน</span>`;
                }
            }
            
            if (data.dry_run) {
                botDryRunOn.checked = true;
            } else {
                botDryRunOff.checked = true;
            }
            
            botStakeInput.value = data.stake_amount_thb;
            botSlInput.value = data.stop_loss_pct;
            botTpInput.value = data.take_profit_pct;
        }
    } catch (e) {
        console.error('Error fetching bot status:', e);
    }
}

// Toggle Bot ON/OFF
botToggle.addEventListener('change', async () => {
    try {
        const res = await fetch('/api/bot/toggle', { method: 'POST' });
        const data = await res.json();
        
        if (data.status === 'success') {
            addLog(`บอทอัตโนมัติ: ${data.is_running ? '🟢 เริ่มทำงาน (STARTED)' : '🔴 หยุดทำงาน (STOPPED)'}`, data.is_running ? 'success' : 'system');
            showToast(data.is_running ? 'เริ่มทำงานบอทอัตโนมัติสำเร็จ!' : 'หยุดทำงานบอทอัตโนมัติแล้ว', data.is_running ? 'success' : 'info');
            botToggle.checked = data.is_running;
            
            if (quickBotStatus) {
                if (data.is_running) {
                    quickBotStatus.innerHTML = `<span class="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-[11px] font-bold bg-emerald-500/10 border border-emerald-500/20 text-emerald-400"><span class="status-indicator connected"></span> กำลังทำงาน</span>`;
                } else {
                    quickBotStatus.innerHTML = `<span class="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-[11px] font-bold bg-slate-900/60 border border-white/5 text-slate-400"><span class="status-indicator disconnected"></span> ปิดการทำงาน</span>`;
                }
            }
        }
    } catch (e) {
        addLog(`สลับโหมดบอทล้มเหลว: ${e.message}`, 'error');
        showToast(`สลับโหมดบอทล้มเหลว: ${e.message}`, 'error');
        botToggle.checked = !botToggle.checked; // Revert checkbox
        if (quickBotStatus) {
            const isChecked = botToggle.checked;
            if (isChecked) {
                quickBotStatus.innerHTML = `<span class="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-[11px] font-bold bg-emerald-500/10 border border-emerald-500/20 text-emerald-400"><span class="status-indicator connected"></span> กำลังทำงาน</span>`;
            } else {
                quickBotStatus.innerHTML = `<span class="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-[11px] font-bold bg-slate-900/60 border border-white/5 text-slate-400"><span class="status-indicator disconnected"></span> ปิดการทำงาน</span>`;
            }
        }
    }
});

// Save Bot Config
saveBotConfigBtn.addEventListener('click', async () => {
    const dryRun = botDryRunOn.checked;
    const stake = parseFloat(botStakeInput.value);
    const sl = parseFloat(botSlInput.value);
    const tp = parseFloat(botTpInput.value);

    const payload = {
        dry_run: dryRun,
        stake_amount_thb: stake,
        stop_loss_pct: sl,
        take_profit_pct: tp
    };

    try {
        const res = await fetch('/api/bot/config', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        });
        const data = await res.json();
        if (data.status === 'success') {
            addLog('บันทึกการตั้งค่าบอทอัตโนมัติสำเร็จแล้ว', 'success');
            showToast('บันทึกการตั้งค่าบอทสำเร็จแล้ว', 'success');
        }
    } catch (e) {
        addLog(`บันทึกค่าคอนฟิกบอทล้มเหลว: ${e.message}`, 'error');
    }
});

// Fetch Active Bot Positions
async function fetchBotPositions() {
    try {
        const res = await fetch('/api/bot/positions');
        const positions = await res.json();
        
        if (quickPositionsCount) {
            quickPositionsCount.textContent = positions ? `${positions.length} คู่เหรียญ` : '0 คู่เหรียญ';
            quickPositionsCount.className = (positions && positions.length > 0) ? "text-emerald-400 font-bold" : "text-slate-400 font-semibold";
        }
        
        if (positions && positions.length > 0) {
            positionsEmpty.classList.add('hidden');
            positionsTableContainer.classList.remove('hidden');
            positionRows.innerHTML = '';
            
            positions.forEach(pos => {
                const token = pos.symbol.split('/')[0];
                const pnl = pos.pnl_percent;
                
                let pnlClass = 'percentage-neutral';
                if (pnl > 0) pnlClass = 'percentage-positive';
                else if (pnl < 0) pnlClass = 'percentage-negative';

                const row = document.createElement('tr');
                row.innerHTML = `
                    <td class="ticker-symbol">${pos.symbol} <small style="display:block;color:var(--text-secondary)">${pos.amount.toFixed(5)} ${token}</small></td>
                    <td>${pos.buy_price.toLocaleString()} THB</td>
                    <td>${pos.current_price.toLocaleString()} THB</td>
                    <td>
                        <span class="percentage-badge ${pnlClass}">
                            ${pnl > 0 ? '+' : ''}${pnl.toFixed(2)}%
                        </span>
                        <small style="display:block;color:var(--text-secondary);margin-top:0.2rem">${pos.pnl_thb > 0 ? '+' : ''}${pos.pnl_thb.toFixed(2)} THB</small>
                    </td>
                    <td>
                        <button class="btn-panic" onclick="triggerPanicSell('${pos.symbol}')">Panic Sell</button>
                    </td>
                `;
                positionRows.appendChild(row);
            });
        } else {
            positionsEmpty.classList.remove('hidden');
            positionsTableContainer.classList.add('hidden');
        }
    } catch (e) {
        console.error('Error fetching bot positions:', e);
    }
}

// Global function to trigger panic sell modal
window.triggerPanicSell = async function(symbol) {
    const confirmed = await showConfirmDialog({
        title: 'ยืนยันการทำรายการขายฉุกเฉิน (Panic Sell)?',
        message: `คุณแน่ใจว่าต้องการสั่งบอทให้ขายเหรียญทั้งหมดของคู่เทรด <strong>${symbol}</strong> ทันที ณ ราคาตลาดปัจจุบันหรือไม่? (สถานะการถือครองจะถูกปิดลงในระบบไฟล์)`,
        confirmText: 'ขายฉุกเฉินทันที',
        type: 'danger'
    });
    
    if (confirmed) {
        addLog(`[Emergency] กำลังส่งคำสั่ง Panic Sell สำหรับ ${symbol}...`, 'info');
        showToast(`กำลังส่งคำสั่งขายฉุกเฉิน ${symbol}...`, 'info');
        
        try {
            const res = await fetch('/api/bot/panic-sell', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ symbol })
            });
            const data = await res.json();
            if (res.ok && data.status === 'success') {
                showToast(`ขายเหรียญ ${symbol} สำเร็จ`, 'success');
                addLog(`[Panic Sell Success] ขายเหรียญ ${symbol} สำเร็จ`, 'success');
                fetchBotPositions();
                fetchBotHistory();
                fetchBalance();
            } else {
                showToast(`ขายเหรียญไม่สำเร็จ: ${data.detail || JSON.stringify(data)}`, 'error');
                addLog(`[Panic Sell Failed] ขายเหรียญไม่สำเร็จ: ${data.detail || JSON.stringify(data)}`, 'error');
            }
        } catch (e) {
            showToast(`เกิดข้อผิดพลาด: ${e.message}`, 'error');
            addLog(`[Panic Sell Error] เกิดข้อผิดพลาด: ${e.message}`, 'error');
        }
    }
};

// Fetch Completed Bot Trades History
async function fetchBotHistory() {
    try {
        const res = await fetch('/api/bot/history');
        const history = await res.json();
        
        if (history && history.length > 0) {
            historyEmpty.classList.add('hidden');
            historyTableContainer.classList.remove('hidden');
            historyRows.innerHTML = '';
            
            // Show latest trades first
            history.slice().reverse().forEach(trade => {
                const pnl = trade.pnl_percent;
                let pnlClass = 'percentage-neutral';
                if (pnl > 0) pnlClass = 'percentage-positive';
                else if (pnl < 0) pnlClass = 'percentage-negative';

                const row = document.createElement('tr');
                row.innerHTML = `
                    <td class="ticker-symbol">${trade.symbol}<br><small style="color:var(--text-secondary)">${trade.sell_time}</small></td>
                    <td>${trade.buy_price.toLocaleString()} THB</td>
                    <td>${trade.sell_price.toLocaleString()} THB</td>
                    <td>
                        <span class="percentage-badge ${pnlClass}">
                            ${pnl > 0 ? '+' : ''}${pnl.toFixed(2)}%
                        </span>
                        <small style="display:block;color:var(--text-secondary);margin-top:0.25rem">${trade.pnl_thb > 0 ? '+' : ''}${trade.pnl_thb.toFixed(2)} THB</small>
                    </td>
                    <td><span style="font-size:0.8rem">${trade.reason}</span> <small style="display:block;color:var(--text-secondary)">(${trade.mode})</small></td>
                `;
                historyRows.appendChild(row);
            });
        } else {
            historyEmpty.classList.remove('hidden');
            historyTableContainer.classList.add('hidden');
        }
    } catch (e) {
        console.error('Error fetching bot history:', e);
    }
}

// Fetch Bot Activity Scan Logs
async function fetchBotLogs() {
    try {
        const res = await fetch('/api/bot/logs');
        const logs = await res.json();
        
        if (logs && logs.length > 0) {
            botLogs.innerHTML = '';
            logs.forEach(log => {
                const entry = document.createElement('div');
                entry.className = 'log-entry';
                
                // Color codes
                if (log.includes('[BUY SIGNAL]')) {
                    entry.className = 'log-entry success-log';
                } else if (log.includes('[SELL SIGNAL]')) {
                    entry.className = 'log-entry error-log';
                } else if (log.includes('STARTED') || log.includes('STOPPED')) {
                    entry.className = 'log-entry info-log';
                }
                
                entry.textContent = log;
                botLogs.appendChild(entry);
            });
            botLogs.scrollTop = botLogs.scrollHeight;
        }
    } catch (e) {
        console.error('Error fetching bot logs:', e);
    }
}


// ==========================================================================
// Manual Trade Form Submission Handling
// ==========================================================================
tradeForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    if (!isConnected) {
        showToast('กรุณาเชื่อมต่อ API ให้สำเร็จก่อนส่งคำสั่งซื้อขาย', 'error');
        return;
    }

    const symbol = symbolSelect.value;
    const side = document.querySelector('input[name="order-side"]:checked').value;
    const type = document.querySelector('input[name="order-type"]:checked').value;
    const amount = parseFloat(amountInput.value);
    const price = priceInput.value ? parseFloat(priceInput.value) : null;

    const sideText = side === 'buy' ? 'ซื้อ (BUY)' : 'ขาย (SELL)';
    const typeText = type === 'market' ? 'Market Order (ราคาตลาด)' : `Limit Order ที่ราคา ${price.toLocaleString()} THB`;
    const amountUnitText = (side === 'buy' && type === 'market') ? 'THB' : symbol.split('/')[0];
    const typeTheme = side === 'buy' ? 'success' : 'danger';

    const confirmed = await showConfirmDialog({
        title: `ยืนยันการส่งคำสั่ง ${sideText}?`,
        message: `คุณกำลังจะส่งคำสั่งส่งคำสั่งเทรดจริงบนบัญชี Bitkub ของคุณ ดังนี้:<br><br>
                  • ธุรกรรม: <strong>${sideText}</strong><br>
                  • คู่เหรียญ: <strong>${symbol}</strong><br>
                  • ประเภท: <strong>${typeText}</strong><br>
                  • จำนวน: <strong>${amount} ${amountUnitText}</strong><br><br>
                  *กรุณาตรวจสอบคู่เหรียญและราคาให้ถูกต้องก่อนกดยืนยัน`,
        confirmText: 'ส่งคำสั่งซื้อขายจริง',
        type: typeTheme
    });

    if (confirmed) {
        addLog(`กำลังส่งคำสั่งเทรด: ${side.toUpperCase()} ${amount} ${symbol}...`, 'info');
        showToast(`กำลังส่งคำสั่งเทรด ${symbol}...`, 'info');
        
        const payload = { symbol, side, order_type: type, amount, price };
        
        try {
            const res = await fetch('/api/trade', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload)
            });

            const result = await res.json();
            
            if (res.ok && result.status === 'success') {
                showToast(`ทำรายการสำเร็จ! Order ID: ${result.order.id || 'N/A'}`, 'success');
                addLog(`ทำรายการสำเร็จ! Order ID: ${result.order.id || 'N/A'}`, 'success');
                addLog(result.order, 'success');
                fetchBalance(); // Refresh balance
            } else {
                showToast(`ทำรายการไม่สำเร็จ: ${result.detail || JSON.stringify(result)}`, 'error');
                addLog(`ทำรายการไม่สำเร็จ: ${result.detail || JSON.stringify(result)}`, 'error');
            }
        } catch (err) {
            showToast(`ส่งคำสั่งซื้อขายล้มเหลว: ${err.message}`, 'error');
            addLog(`ส่งคำสั่งซื้อขายล้มเหลว: ${err.message}`, 'error');
        }
    }
});

// Percentage buttons handler
document.querySelectorAll('.percentage-btn').forEach(btn => {
    btn.addEventListener('click', () => {
        const percent = parseFloat(btn.getAttribute('data-percent'));
        const side = document.querySelector('input[name="order-side"]:checked').value;
        const type = document.querySelector('input[name="order-type"]:checked').value;
        const symbol = symbolSelect.value;
        const baseAsset = symbol.split('/')[0]; // e.g., BTC
        
        let targetAmount = 0;
        
        if (side === 'buy') {
            // Buying
            if (type === 'market') {
                // Market buy specifies amount in THB cash
                const thbBalance = currentBalances['THB'] ? currentBalances['THB'].free : 0;
                targetAmount = thbBalance * (percent / 100);
                // round to 2 decimal places
                targetAmount = Math.floor(targetAmount * 100) / 100;
            } else {
                // Limit buy: specifies amount in crypto asset.
                // We want to spend (percent)% of our THB balance.
                // So crypto amount = (THB balance * percent%) / price
                const thbBalance = currentBalances['THB'] ? currentBalances['THB'].free : 0;
                const price = parseFloat(priceInput.value);
                if (!price || price <= 0) {
                    showToast('กรุณาระบุราคารับซื้อเพื่อคำนวณจำนวนเหรียญ', 'error');
                    return;
                }
                const thbToSpend = thbBalance * (percent / 100);
                targetAmount = thbToSpend / price;
                // round to 6 decimal places
                targetAmount = Math.floor(targetAmount * 1000000) / 1000000;
            }
        } else {
            // Selling: specifies amount in crypto asset
            const assetBalance = currentBalances[baseAsset] ? currentBalances[baseAsset].free : 0;
            targetAmount = assetBalance * (percent / 100);
            // round to 6 decimal places
            targetAmount = Math.floor(targetAmount * 1000000) / 1000000;
        }
        
        if (targetAmount > 0) {
            amountInput.value = targetAmount;
        } else {
            amountInput.value = '';
            showToast('ยอดบาลานซ์ที่พร้อมใช้งานไม่เพียงพอ', 'error');
        }
    });
});

async function fetchUser() {
    try {
        const res = await fetch('/api/user');
        if (res.ok) {
            const data = await res.json();
            if (usernameDisplay) {
                usernameDisplay.textContent = `User: ${data.username}`;
            }
        }
    } catch (e) {
        console.error('Error fetching user:', e);
    }
}

// ==========================================================================
// App Initialization & Polling
// ==========================================================================
setupSegmentedControls();
updateTradeHelper();

// Init TradingView chart
if (window.TradingView) {
    loadTradingViewChart(symbolSelect.value);
}

// Fetch initial data
fetchUser();
checkStatus();
fetchTickers();
fetchBotStatus();
fetchBotPositions();
fetchBotHistory();
fetchBotLogs();

// Intervals
setInterval(checkStatus, 10000);        // Check API connection status every 10s
setInterval(fetchBalance, 15000);       // Check balance every 15s
setInterval(fetchTickers, 6000);        // Update tickers prices every 6s

setInterval(fetchBotPositions, 5000);   // Update bot held positions PnL every 5s
setInterval(fetchBotLogs, 4000);        // Update bot activity logs scan console every 4s
setInterval(fetchBotHistory, 10000);    // Update completed trades history every 10s

addLog('Dashboard Initialized. Waiting for connection check...', 'system');
