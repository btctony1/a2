const DASHBOARD_HTML: string = `<!DOCTYPE html>
<html lang="zh-CN">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no, viewport-fit=cover">
<meta name="theme-color" content="#161b22">
<meta name="mobile-web-app-capable" content="yes">
<meta name="apple-mobile-web-app-capable" content="yes">
<meta name="apple-mobile-web-app-status-bar-style" content="black-translucent">
<title>OKX 合约自动交易系统</title>
<style>
*{margin:0;padding:0;box-sizing:border-box}
body{font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;background:#0d1117;color:#c9d1d9;min-height:100vh;width:100%;overflow-x:hidden}

/* Sleek custom scrollbars */
::-webkit-scrollbar{width:6px;height:6px}
::-webkit-scrollbar-track{background:#0d1117}
::-webkit-scrollbar-thumb{background:#30363d;border-radius:3px}
::-webkit-scrollbar-thumb:hover{background:#58a6ff}

.header{background:#161b22;border-bottom:1px solid #30363d;padding:12px 24px;display:flex;align-items:center;justify-content:space-between;gap:12px;flex-wrap:wrap}
.header h1{font-size:18px;font-weight:600;color:#f0f6fc;display:flex;align-items:center;gap:8px}
.header-actions{display:flex;align-items:center;gap:10px;flex-wrap:wrap}
.container{width:100%;max-width:1800px;margin:0 auto;padding:16px 24px;transition:all .2s ease}
.control-bar{display:flex;align-items:center;gap:12px;padding:16px 20px;background:#161b22;border:1px solid #30363d;border-radius:8px;margin-bottom:16px}
.status-dot{width:8px;height:8px;border-radius:50%;flex-shrink:0}
.status-dot.running{background:#3fb950;box-shadow:0 0 6px #3fb950}
.status-dot.stopped{background:#f85149}
.btn{padding:8px 18px;border-radius:6px;border:none;cursor:pointer;font-size:13px;font-weight:500;transition:all .2s;white-space:nowrap;display:inline-flex;align-items:center;justify-content:center;-webkit-tap-highlight-color:transparent}
.btn:active{transform:scale(0.98)}
.btn-start{background:#238636;color:#fff}
.btn-start:hover{background:#2ea043}
.btn-stop{background:#da3633;color:#fff}
.btn-stop:hover{background:#f85149}
.btn-save{background:#1f6feb;color:#fff}
.btn-save:hover{background:#388bfd}
.btn-reset{background:#6e7681;color:#fff}
.btn-reset:hover{background:#848d97}
.btn-danger{background:#da3633;color:#fff;font-size:12px;padding:4px 10px}
.btn-danger:hover{background:#f85149}
.btn-outline{background:transparent;border:1px solid #30363d;color:#c9d1d9}
.btn-outline:hover{background:#21262d;border-color:#8b949e;color:#f0f6fc}
.panel{background:#161b22;border:1px solid #30363d;border-radius:8px;padding:16px 20px;margin-bottom:16px;width:100%}
.panel h2{font-size:15px;font-weight:600;color:#f0f6fc;margin-bottom:14px;padding-bottom:8px;border-bottom:1px solid #21262d}

/* Adaptive Top Control Bar */
.top-ctrl-bar{display:flex;align-items:center;justify-content:space-between;gap:12px;margin-bottom:14px;flex-wrap:wrap}
.top-ctrl-left{display:flex;align-items:center;gap:10px;flex-wrap:wrap}
.top-ctrl-center{display:flex;align-items:center;gap:8px;background:#0d1117;padding:6px 14px;border-radius:8px;border:1px solid #30363d;flex-wrap:wrap;justify-content:center}
.top-ctrl-right{display:flex;align-items:center;gap:8px;flex-wrap:wrap}

/* Adaptive Parameters & API Config Layout */
.param-config-row{display:grid;grid-template-columns:1fr auto;gap:20px;align-items:start;width:100%}
.param-grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(105px,1fr));gap:10px;width:100%}
.param-item label{display:block;font-size:11px;color:#8b949e;margin-bottom:3px;white-space:nowrap}
.param-item input,.param-item select{width:100%;padding:5px 6px;border:1px solid #30363d;border-radius:4px;background:#0d1117;color:#c9d1d9;font-size:12px}
.param-item input:focus,.param-item select:focus{outline:none;border-color:#58a6ff}
.param-item input:disabled,.param-item select:disabled{background:#21262d;color:#8b949e;cursor:not-allowed}

.api-config-grid{display:flex;gap:10px;flex-wrap:wrap;justify-content:flex-end}
.api-item{width:90px}

.coin-grid{display:flex;flex-direction:column;gap:10px;width:100%}
.coin-card{display:flex;flex-direction:column;align-items:stretch;gap:8px;padding:10px 14px;border:1px solid #21262d;border-radius:8px;background:#0d1117;cursor:pointer;transition:all .2s;width:100%}
.coin-card.enabled{border-color:#30363d}
.coin-card.selected{border-color:#58a6ff!important;box-shadow:0 0 10px rgba(88,166,255,0.35);background:#161b22!important}
.coin-card-top{display:flex;align-items:center;gap:8px;flex-wrap:wrap;width:100%}
.coin-card-bottom{display:flex;align-items:center;gap:6px;flex-wrap:wrap;width:100%;padding-top:6px;border-top:1px solid rgba(48,54,61,0.4)}
.coin-card .coin-name{font-weight:600;font-size:14px;min-width:70px;color:#f0f6fc}
.coin-card .coin-dir{font-size:12px;padding:2px 8px;border-radius:4px;font-weight:600}
.coin-card .coin-dir.long{color:#3fb950;background:rgba(63,185,80,.1)}
.coin-card .coin-dir.short{color:#f85149;background:rgba(248,81,73,.1)}
.coin-card .coin-dir.none{color:#8b949e}
.coin-card .coin-funding{font-size:11px;color:#f0f6fc;background:rgba(31,111,235,.15);padding:2px 8px;border-radius:4px;min-width:60px;text-align:right}
.coin-card select{padding:4px 8px;border:1px solid #30363d;border-radius:4px;background:#0d1117;color:#c9d1d9;font-size:12px}
.btn-smart-vol{font-weight:600!important;letter-spacing:0.2px}

/* Tables and Containers */
table{width:100%;min-width:860px;border-collapse:collapse;font-size:13px}
th{text-align:left;padding:10px 12px;font-weight:500;color:#8b949e;border-bottom:1px solid #21262d;font-size:12px;white-space:nowrap}
td{padding:10px 12px;border-bottom:1px solid #21262d;white-space:nowrap}
tr:hover td{background:rgba(255,255,255,.02)}
.pnl-positive{color:#3fb950}
.pnl-negative{color:#f85149}
.balance-summary{display:flex;gap:16px;margin-bottom:12px;flex-wrap:wrap}
.balance-item{flex:1;min-width:120px;padding:12px;background:#0d1117;border:1px solid #21262d;border-radius:8px;text-align:center}
.balance-item .label{font-size:12px;color:#8b949e}
.balance-item .value{font-size:18px;font-weight:600;color:#f0f6fc}
.empty-state{text-align:center;padding:40px;color:#484f58;font-size:14px}
.log-container{max-height:340px;overflow-y:auto;font-size:12px;font-family:monospace;width:100%}
#positionsContent{max-height:550px;overflow-y:auto;overflow-x:auto;-webkit-overflow-scrolling:touch;width:100%}
#tradesContent{max-height:550px;overflow-y:auto;overflow-x:auto;-webkit-overflow-scrolling:touch;width:100%}
.pagination-bar{display:flex;align-items:center;justify-content:space-between;gap:8px;padding:10px 4px 4px 4px;font-size:12px;color:#8b949e;flex-wrap:wrap;border-top:1px solid #21262d;margin-top:8px}
.pagination-controls{display:flex;align-items:center;gap:6px}
.pagination-btn{padding:3px 8px;font-size:11px;background:#21262d;border:1px solid #30363d;border-radius:4px;color:#c9d1d9;cursor:pointer}
.pagination-btn:hover:not(:disabled){background:#30363d;color:#fff}
.pagination-btn:disabled{opacity:0.4;cursor:not-allowed}
.pagination-select{padding:2px 6px;font-size:11px;background:#0d1117;border:1px solid #30363d;border-radius:4px;color:#c9d1d9}
.log-entry{padding:4px 0;border-bottom:1px solid #0d1117;color:#8b949e;word-break:break-all}
.log-entry.direction{color:#58a6ff}
.log-entry.open{color:#3fb950}
.log-entry.close{color:#d2a8ff}
.log-entry.error{color:#f85149}
.cron-info{font-size:12px;color:#8b949e;white-space:nowrap}
.loading{opacity:.5;pointer-events:none}

/* Modal and Auth Overlays */
.modal-overlay{position:fixed;top:0;left:0;right:0;bottom:0;background:rgba(13,17,23,0.92);backdrop-filter:blur(8px);display:flex;align-items:center;justify-content:center;z-index:9999;padding:16px}
.modal-box{background:#161b22;border:1px solid #30363d;border-radius:12px;padding:24px;width:100%;max-width:400px;box-shadow:0 16px 32px rgba(0,0,0,0.5)}
.modal-title{font-size:16px;font-weight:600;color:#f0f6fc;margin-bottom:8px;display:flex;align-items:center;gap:8px}
.modal-subtitle{font-size:13px;color:#8b949e;margin-bottom:20px;line-height:1.4}
.form-group{margin-bottom:16px}
.form-group label{display:block;font-size:12px;color:#c9d1d9;margin-bottom:6px}
.form-group input{width:100%;padding:10px 12px;border:1px solid #30363d;border-radius:6px;background:#0d1117;color:#c9d1d9;font-size:14px}
.form-group input:focus{outline:none;border-color:#58a6ff;box-shadow:0 0 0 3px rgba(88,166,255,0.15)}
.auth-error{color:#f85149;font-size:12px;margin-top:8px;min-height:18px}
.modal-actions{display:flex;gap:12px;justify-content:flex-end;margin-top:20px}

/* Coin Selection Header Layout */
.coin-header-bar{display:flex;align-items:center;justify-content:space-between;gap:12px;margin-bottom:14px;width:100%;flex-wrap:wrap}
.coin-header-top{display:flex;align-items:center;gap:10px;flex-wrap:wrap}
.coin-header-top h2{margin:0;padding:0;border:none;font-size:15px;font-weight:600;color:#f0f6fc}
.btn-deselect-main{background:rgba(248,81,73,0.15)!important;border:1px solid #f85149!important;color:#f85149!important;font-size:12px!important;padding:5px 14px!important;font-weight:600;border-radius:6px;cursor:pointer}
.btn-deselect-main:hover{background:rgba(248,81,73,0.25)!important}
.btn-deselect-main:active{transform:scale(0.96)}
.coin-header-actions{display:flex;gap:8px;align-items:center;flex-wrap:wrap}
.coin-header-actions input{min-width:180px;padding:7px 12px;border:1px solid #30363d;border-radius:6px;background:#0d1117;color:#c9d1d9;font-size:13px}
.coin-header-actions input:focus{outline:none;border-color:#58a6ff}
.coin-btn-group{display:flex;align-items:center;gap:8px}

/* Mobile Sticky Selection Bar */
.mobile-selection-bar{position:fixed;bottom:16px;left:14px;right:14px;background:#161b22;border:1px solid #58a6ff;box-shadow:0 10px 30px rgba(0,0,0,0.7);border-radius:10px;padding:10px 16px;display:flex;align-items:center;justify-content:space-between;z-index:9000;color:#f0f6fc}
@media (min-width:1024px){
  .mobile-selection-bar{display:none!important}
}

/* Responsive Media Queries */
@media (max-width:1120px){
  .param-config-row{grid-template-columns:1fr;gap:16px}
  .api-config-grid{justify-content:flex-start}
  .top-ctrl-bar{flex-direction:column;align-items:stretch;gap:10px}
  .top-ctrl-left,.top-ctrl-center,.top-ctrl-right{justify-content:space-between;width:100%}
}
@media (max-width:768px){
  .header{padding:10px 14px;flex-direction:column;align-items:stretch;gap:10px}
  .header-actions{justify-content:space-between;width:100%}
  .container{padding:8px 8px}
  .panel{padding:12px 10px;margin-bottom:10px;border-radius:6px}
  .coin-header-bar{flex-direction:column;align-items:stretch;gap:10px}
  .coin-header-top{width:100%;justify-content:space-between}
  .coin-header-actions{width:100%;flex-direction:column;align-items:stretch;gap:8px}
  .coin-header-actions input{width:100%;min-width:unset;padding:8px 12px;font-size:13px}
  .coin-btn-group{width:100%;display:flex;gap:8px}
  .coin-btn-group .btn{flex:1;min-height:38px;font-size:13px;padding:8px 10px;text-align:center;justify-content:center}
  .param-grid{grid-template-columns:repeat(auto-fit,minmax(85px,1fr));gap:6px}
  .param-item label{font-size:10px}
  .param-item input,.param-item select{font-size:11px;padding:4px}
  .api-item{flex:1 1 calc(33.33% - 8px);min-width:75px}
  .top-ctrl-center{padding:6px 8px;gap:6px}
  .top-ctrl-center button{font-size:10px!important;padding:3px 6px!important}
  .btn{font-size:12px;padding:6px 12px}
  .modal-box{padding:20px 16px;width:95%}
}
@media (max-width:480px){
  .header h1{font-size:16px}
  .top-ctrl-center{display:flex;flex-wrap:wrap;justify-content:center}
  .coin-card{padding:8px 10px;gap:8px}
  .coin-name{font-size:13px}
  .coin-btn-group{flex-direction:row;flex-wrap:nowrap}
}
@media (min-width:1800px){
  .container{max-width:96vw;padding:20px 32px}
  .param-grid{grid-template-columns:repeat(8,1fr)}
  .log-container{max-height:420px}
  #positionsContent,#tradesContent{max-height:650px}
}
</style>
</head>
<body>
<div class="header">
  <h1>OKX 合约自动交易系统</h1>
  <div class="header-actions">
    <span style="font-size:12px;color:#3fb950;background:rgba(63,185,80,0.1);padding:4px 10px;border-radius:12px;border:1px solid rgba(63,185,80,0.2)">🔒 密码保护启用</span>
    <button class="btn btn-outline" style="font-size:12px;padding:5px 12px" onclick="openChangePasswordModal()">修改密码</button>
    <button class="btn btn-danger" style="font-size:12px;padding:5px 12px;background:#b91c1c;border:1px solid #dc2626" onclick="openResetSystemModal()" title="彻底清空 D1 数据库中的持仓、交易记录、币种列表与日志数据">⚠️ 重置系统</button>
    <button class="btn btn-reset" style="font-size:12px;padding:5px 12px" onclick="logout()">退出登录</button>
  </div>
</div>

<div class="container">
  <div class="panel">
    <div class="top-ctrl-bar">
      <div class="top-ctrl-left">
        <button class="btn btn-save" onclick="saveTradeParams()">保存币种参数</button>
        <div id="selectedCoinNotice"></div>
      </div>
      <div class="top-ctrl-center">
        <div class="status-dot stopped" id="selectedCoinStatusDot"></div>
        <span id="selectedCoinStatusText" style="font-size:13px;font-weight:600;color:#f0f6fc">请选择代币</span>
        <button class="btn btn-start" id="btnToggleSelectedCoin" onclick="toggleSelectedCoinTrading()" style="padding:5px 14px;font-size:12px" disabled>开始交易</button>
        <button class="btn btn-smart-vol" id="btnToggleSmartVolSelected" onclick="toggleSelectedCoinSmartVol()" style="padding:5px 12px;font-size:12px;background:#2563eb;color:#fff;border:1px solid #3b82f6;display:none" title="开启/关闭当前选中代币的智能下单波动过滤">⚡ 智能下单: 开</button>
        <div style="width:1px;height:16px;background:#30363d;margin:0 4px"></div>
        <button class="btn btn-outline" style="font-size:11px;padding:4px 8px" onclick="startAllCoins()" title="一键启动所有代币交易">全部启动</button>
        <button class="btn btn-outline" style="font-size:11px;padding:4px 8px" onclick="stopAllCoins()" title="一键停止所有代币交易">全部停止</button>
        <button class="btn" style="font-size:11px;padding:4px 8px;background:#1f6feb;color:#fff" onclick="triggerImmediateLoop(this)" title="立即执行一轮完整巡检与开单">⚡ 立即运行</button>
      </div>
      <div class="top-ctrl-right">
        <button class="btn btn-save" onclick="saveApiConfig()">保存 API 配置</button>
      </div>
    </div>
    <div class="param-config-row">
      <div>
      <div class="param-grid">
        <datalist id="dlLeverage">
          <option value="1"><option value="2"><option value="3"><option value="5">
          <option value="10"><option value="20"><option value="30"><option value="50">
          <option value="75"><option value="100"><option value="125">
        </datalist>
        <datalist id="dlTpSl">
          <option value="3"><option value="5"><option value="8"><option value="10">
          <option value="12"><option value="15"><option value="20"><option value="25"><option value="30">
        </datalist>
        <datalist id="dlSl">
          <option value="5"><option value="10"><option value="15"><option value="20">
          <option value="25"><option value="30"><option value="35"><option value="40"><option value="50">
        </datalist>
        <datalist id="dlTimeout">
          <option value="1"><option value="2"><option value="5"><option value="10">
          <option value="15"><option value="30"><option value="60"><option value="120">
        </datalist>
        <datalist id="dlRatio">
          <option value="0.5"><option value="1"><option value="2"><option value="3">
          <option value="5"><option value="10"><option value="15"><option value="20"><option value="25">
        </datalist>
        <datalist id="dlTransfer">
          <option value="5"><option value="10"><option value="15"><option value="20">
          <option value="25"><option value="30"><option value="40"><option value="50">
        </datalist>
        <datalist id="dlInterval">
          <option value="1"><option value="5"><option value="10"><option value="15">
          <option value="30"><option value="60"><option value="120"><option value="240">
        </datalist>
        <div class="param-item">
          <label>杠杆倍率</label>
          <input type="text" inputmode="decimal" id="cfgLeverage" list="dlLeverage" placeholder="请设置" oninput="markDirty(this.id)" onchange="markDirty(this.id)">
        </div>
        <div class="param-item">
          <label>止盈比例 %</label>
          <input type="text" inputmode="decimal" id="cfgTpRatio" list="dlTpSl" placeholder="请设置" oninput="markDirty(this.id)" onchange="markDirty(this.id)">
        </div>
        <div class="param-item">
          <label>止损比例 %</label>
          <input type="text" inputmode="decimal" id="cfgSlRatio" list="dlSl" placeholder="请设置" oninput="markDirty(this.id)" onchange="markDirty(this.id)">
        </div>
        <div class="param-item">
          <label>持仓时间
            <select id="cfgTimeoutUnit" style="width:auto;padding:2px 4px;border:1px solid #30363d;border-radius:4px;background:#0d1117;color:#c9d1d9;font-size:11px" onchange="markDirty(this.id)">
              <option value="">选择</option>
              <option value="second">秒</option>
              <option value="minute">分</option>
              <option value="hour">时</option>
              <option value="day">日</option>
            </select>
          </label>
          <input type="text" inputmode="decimal" id="cfgTimeoutValue" list="dlTimeout" placeholder="请设置" oninput="markDirty(this.id)" onchange="markDirty(this.id)">
        </div>
        <div class="param-item">
          <label>开仓模式</label>
          <select id="cfgMarginMode" onchange="markDirty(this.id)">
            <option value="">请选择</option>
            <option value="isolated">逐仓</option>
            <option value="cross">全仓</option>
          </select>
        </div>
        <div class="param-item">
          <label>盈利划转比例 %</label>
          <input type="text" inputmode="decimal" id="cfgTransferRatio" list="dlTransfer" placeholder="请设置" oninput="markDirty(this.id)" onchange="markDirty(this.id)">
        </div>
        <div class="param-item">
          <label>下单时间间隔
            <select id="cfgIntervalUnit" style="width:auto;padding:2px 4px;border:1px solid #30363d;border-radius:4px;background:#0d1117;color:#c9d1d9;font-size:11px" onchange="markDirty(this.id)">
              <option value="">选择</option>
              <option value="second">秒</option>
              <option value="minute">分</option>
              <option value="hour">时</option>
              <option value="day">日</option>
            </select>
          </label>
          <input type="text" inputmode="decimal" id="cfgIntervalValue" list="dlInterval" placeholder="请设置" oninput="markDirty(this.id)" onchange="markDirty(this.id)">
        </div>
        <div class="param-item">
          <label title="开启智能下单后，临近2根K线最高最低波动幅度低于设定阈值%时自动暂停下单，高于此值恢复下单">智能下单 (波动过滤)</label>
          <select id="cfgSmartVolatility" onchange="markDirty(this.id)">
            <option value="0">关闭 (常规下单)</option>
            <option value="1">开启 (低波动暂停)</option>
          </select>
        </div>
        <div class="param-item">
          <label title="开启智能下单时，若临近2根K线最高最低波动幅度低于此阈值%则自动暂停下单，高于此值恢复下单">波动阈值 % (智能)</label>
          <input type="text" inputmode="decimal" id="cfgMinVolatility" placeholder="例: 1.0" oninput="markDirty(this.id)" onchange="markDirty(this.id)">
        </div>
        <div class="param-item">
          <label title="加仓幅度(%)：到达下单间隔时针对持仓盈亏判断。若盈利直接加仓；若亏损需达到该设定浮亏幅度(%)后才允许补仓加仓，未达到则跳过。填0或不填则不限">加仓幅度 % (亏损加仓)</label>
          <input type="text" inputmode="decimal" id="cfgAddPosRatio" list="dlRatio" placeholder="例: 2.0 (0为不限)" oninput="markDirty(this.id)" onchange="markDirty(this.id)">
        </div>
      </div>
      </div>
      <div>
      <div class="api-config-grid">
        <div class="param-item api-item">
          <label style="text-align:center;display:block">API Key</label>
          <input type="text" id="cfgApiKey" placeholder="Key" autocomplete="off" style="text-align:right;font-size:11px" oninput="markDirty(this.id)">
        </div>
        <div class="param-item api-item">
          <label style="text-align:center;display:block">Secret</label>
          <input type="password" id="cfgSecretKey" placeholder="Secret" autocomplete="off" style="text-align:right;font-size:11px" oninput="markDirty(this.id)">
        </div>
        <div class="param-item api-item">
          <label style="text-align:center;display:block">Pass</label>
          <input type="password" id="cfgPassphrase" placeholder="Pass" autocomplete="off" style="text-align:right;font-size:11px" oninput="markDirty(this.id)">
        </div>
      </div>
      </div>
    </div>
  </div>

  <div class="panel">
    <div class="coin-header-bar">
      <div class="coin-header-top">
        <div style="display:flex;align-items:center;gap:10px;flex-wrap:wrap">
          <h2 style="margin:0;padding:0;border:none">币种选择</h2>
          <div id="coinsDashboardHeader" style="display:flex;align-items:center;gap:6px;font-size:12px;color:#8b949e;flex-wrap:wrap">
            <span style="background:rgba(110,118,129,0.15);padding:2px 8px;border-radius:4px;border:1px solid #30363d">总币种: <strong id="coinCountTotal" style="color:#58a6ff">0</strong></span>
            <span style="background:rgba(63,185,80,0.1);padding:2px 8px;border-radius:4px;border:1px solid rgba(63,185,80,0.2)">运行中: <strong id="coinCountRunning" style="color:#3fb950">0</strong></span>
            <span style="background:rgba(248,81,73,0.1);padding:2px 8px;border-radius:4px;border:1px solid rgba(248,81,73,0.2)">已停止: <strong id="coinCountStopped" style="color:#f85149">0</strong></span>
            <span style="background:rgba(139,92,246,0.1);padding:2px 8px;border-radius:4px;border:1px solid rgba(139,92,246,0.2)">暂停下单: <strong id="coinCountPaused" style="color:#a371f7">0</strong></span>
          </div>
        </div>
      </div>
      <div class="coin-header-actions">
        <input type="text" id="newCoinInput" placeholder="输入代币如 BTC (支持直接回车添加)" onkeydown="if(event.key==='Enter')addCoin()">
        <div class="coin-btn-group">
          <button class="btn btn-deselect-main" id="btnDeselectCoin" onclick="deselectCoin()" title="取消币种选择，恢复全局视图显示所有币种" style="display:none">✕ 取消选择</button>
          <button class="btn btn-save" style="background:#238636;border:1px solid #2ea043" onclick="addCoin()">➕ 添加币种</button>
          <button class="btn btn-save" id="btnRefreshCoins" style="background:#1f6feb;border:1px solid #388bfd;font-weight:600" onclick="manualRefreshCoins(this)" title="立即刷新币种列表与最新行情价格">🔄 刷新行情</button>
          <button class="btn btn-save" style="background:#6e40c9;border:1px solid #8957e5;font-weight:600" onclick="syncOkxCoins(this)" title="从 OKX 交易所同步当前实际持仓的合约币种到列表中，方便重新部署后快速恢复">📥 同步币种</button>
        </div>
      </div>
    </div>
    <div class="coin-grid" id="coinGrid"></div>
  </div>

  <div class="panel">
    <div style="display:flex;align-items:center;gap:12px;margin-bottom:16px;flex-wrap:wrap">
      <h2 style="margin:0;padding:0;border:none" id="positionsTitle">活跃持仓 (<span id="positionsCount">0</span>)</h2>
      <input type="text" placeholder="搜索币种..." oninput="renderPositions(currentPositions)" style="padding:4px 8px;border:1px solid #30363d;border-radius:4px;background:#0d1117;color:#c9d1d9;font-size:12px;width:140px" id="positionsSearch">
      <button class="btn btn-save" id="btnRefreshPositions" style="font-size:12px;padding:4px 10px;background:#1f6feb;border:1px solid #388bfd;font-weight:600" onclick="manualRefreshPositions(this)" title="立即拉取持仓与即时浮盈">🔄 刷新持仓</button>
      <button class="btn btn-save" style="font-size:12px;padding:4px 10px;background:#238636" onclick="syncPositions(this)" title="立即拉取 OKX 交易所最新持仓并对账一致性">🔄 对账同步OKX</button>
      <button class="btn btn-danger" id="btnCloseAll" onclick="closeAllPositions(this)">一键平仓</button>
    </div>
    <div id="positionsContent"></div>
  </div>

  <div class="panel">
    <div style="display:flex;align-items:center;gap:12px;margin-bottom:16px;flex-wrap:wrap">
      <h2 style="margin:0;padding:0;border:none" id="tradesTitle">交易记录</h2>
      <input type="text" placeholder="搜索币种..." oninput="renderTrades(currentTrades)" style="padding:4px 8px;border:1px solid #30363d;border-radius:4px;background:#0d1117;color:#c9d1d9;font-size:12px;width:140px" id="tradesSearch">
      <button class="btn btn-save" id="btnRefreshTrades" style="font-size:12px;padding:4px 10px;background:#1f6feb;border:1px solid #388bfd" onclick="loadTrades(true, this)" title="手动拉取最新平仓历史记录">🔄 刷新记录</button>
      <button class="btn btn-reset" style="font-size:12px;padding:4px 10px" onclick="clearTrades()">清空</button>
    </div>
    <div id="tradesContent"></div>
  </div>

  <div class="panel">
    <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:12px;flex-wrap:wrap;gap:10px">
      <div style="display:flex;align-items:center;gap:10px;flex-wrap:wrap">
        <h2 style="margin:0;padding:0;border:none" id="logsTitle">系统日志</h2>
        <div style="display:inline-flex;border:1px solid #30363d;border-radius:6px;overflow:hidden;background:#0d1117">
          <button id="btnLogFilterAll" class="btn" style="border:none;border-radius:0;padding:3px 8px;font-size:11px;background:#21262d;color:#58a6ff;font-weight:600" onclick="setLogTypeFilter('all')">全部</button>
          <button id="btnLogFilterError" class="btn" style="border:none;border-radius:0;padding:3px 8px;font-size:11px;background:transparent;color:#8b949e" onclick="setLogTypeFilter('error')" title="仅查看最近一周内的报错与告警记录">⚠️ 报错记录(7天)</button>
        </div>
        <button id="btnAutoScroll" class="btn" style="font-size:11px;padding:3px 10px;border-radius:14px;background:#238636;color:#fff;border:1px solid #2ea043;cursor:pointer" onclick="toggleAutoScroll()" title="点击切换是否在日志更新时自动滚动到底部">⬇️ 自动滚动: 开启</button>
        <button id="btnScrollBottom" class="btn btn-outline" style="font-size:11px;padding:3px 10px;border-radius:14px;display:none;background:#21262d;color:#58a6ff;cursor:pointer" onclick="scrollToBottomLogs()" title="点击快速回到最新日志">⬇️ 回到底部</button>
      </div>
      <div style="display:flex;align-items:center;gap:8px;flex-wrap:wrap">
        <input type="text" id="logsSearch" placeholder="过滤日志..." oninput="renderLogs(currentLogsData)" style="padding:4px 8px;border:1px solid #30363d;border-radius:4px;background:#0d1117;color:#c9d1d9;font-size:12px;width:140px">
        <button class="btn btn-reset" style="font-size:12px;padding:4px 10px" onclick="clearLogs()">清空日志</button>
      </div>
    </div>
    <div class="log-container" id="logContainer" onscroll="handleLogScroll()"></div>
  </div>
</div>

<!-- Mobile Sticky Selection Floating Bar -->
<div id="mobileSelectionBar" class="mobile-selection-bar" style="display:none">
  <div style="display:flex;align-items:center;gap:6px;flex-wrap:wrap">
    <span style="font-size:12px;color:#8b949e">选中:</span>
    <strong id="mobileSelectedSymbolName" style="color:#58a6ff;font-size:14px">BTC</strong>
    <span id="mobileSmartVolStatus" style="font-size:11px;padding:2px 6px;border-radius:4px;background:rgba(59,130,246,0.2);color:#60a5fa;border:1px solid rgba(59,130,246,0.3);font-weight:600">⚡ 智能:关</span>
  </div>
  <div style="display:flex;align-items:center;gap:6px">
    <button id="btnMobileSmartVol" class="btn btn-smart-vol" style="padding:5px 10px;font-size:11px;background:#2563eb;color:#fff;font-weight:600" onclick="toggleSelectedCoinSmartVol()">⚡ 智能下单</button>
    <button class="btn btn-danger" style="padding:5px 10px;font-size:11px;font-weight:600" onclick="deselectCoin()">✕ 取消</button>
  </div>
</div>

<!-- Auth / Login Modal Overlay -->
<div class="modal-overlay" id="authOverlay" style="display:none">
  <!-- Password Login Box -->
  <div class="modal-box" id="authLoginBox" style="display:none">
    <div class="modal-title">🔐 安全登录</div>
    <div class="modal-subtitle">系统受密码保护，请输入访问密码以继续</div>
    <div class="form-group">
      <label for="authPassword">控制台访问密码</label>
      <input type="password" id="authPassword" placeholder="请输入访问密码" onkeydown="if(event.key==='Enter')submitLogin()">
    </div>
    <div class="auth-error" id="authLoginError"></div>
    <div class="modal-actions" style="margin-top:20px;display:flex;flex-direction:column;gap:10px">
      <button class="btn btn-save" style="width:100%;padding:10px;font-size:14px" onclick="submitLogin()">安全登录</button>
      <div style="text-align:center">
        <a href="javascript:void(0)" onclick="showAuthSetupMode()" style="color:#58a6ff;font-size:12px;text-decoration:none">首次使用 / 未设密码？前往初始化设置 ➔</a>
      </div>
    </div>
  </div>

  <!-- Initial Setup Box -->
  <div class="modal-box" id="authSetupBox" style="display:none">
    <div class="modal-title">⚙️ 设置控制台访问密码</div>
    <div class="modal-subtitle">系统首次启动或重置时，请先设定面板控制密码以保护交易：</div>
    <div class="form-group">
      <label for="authNewPassword">新密码</label>
      <input type="password" id="authNewPassword" placeholder="请输入新密码">
    </div>
    <div class="form-group">
      <label for="authConfirmPassword">确认新密码</label>
      <input type="password" id="authConfirmPassword" placeholder="请再次输入新密码" onkeydown="if(event.key==='Enter')submitSetup()">
    </div>
    <div class="auth-error" id="authSetupError"></div>
    <div class="modal-actions" style="margin-top:20px;display:flex;flex-direction:column;gap:10px">
      <button class="btn btn-save" style="width:100%;padding:10px;font-size:14px" onclick="submitSetup()">保存密码并登录</button>
      <div style="text-align:center">
        <a href="javascript:void(0)" onclick="showAuthLoginMode()" style="color:#58a6ff;font-size:12px;text-decoration:none">已有密码？切换到直接登录 ➔</a>
      </div>
    </div>
  </div>
</div>

<!-- Change Password Modal -->
<div class="modal-overlay" id="changePasswordModal" style="display:none">
  <div class="modal-box">
    <div class="modal-title">🔑 修改控制台密码</div>
    <div class="modal-subtitle">修改密码后将重新颁发身份令牌</div>
    <div class="form-group">
      <label for="pwdOld">当前密码</label>
      <input type="password" id="pwdOld" placeholder="请输入当前密码">
    </div>
    <div class="form-group">
      <label for="pwdNew">新密码</label>
      <input type="password" id="pwdNew" placeholder="请输入新密码">
    </div>
    <div class="form-group">
      <label for="pwdNewConfirm">确认新密码</label>
      <input type="password" id="pwdNewConfirm" placeholder="请再次输入新密码" onkeydown="if(event.key==='Enter')submitChangePassword()">
    </div>
    <div class="auth-error" id="changePwdError"></div>
    <div class="modal-actions">
      <button class="btn btn-outline" onclick="closeChangePasswordModal()">取消</button>
      <button class="btn btn-save" onclick="submitChangePassword()">确认修改</button>
    </div>
  </div>
</div>

<!-- Reset System Modal -->
<div class="modal-overlay" id="resetSystemModal" style="display:none">
  <div class="modal-box" style="border:1px solid #f85149;max-width:480px">
    <div class="modal-title" style="color:#f85149">⚠️ 危险操作：彻底重置 D1 数据库</div>
    <div class="modal-subtitle" style="color:#c9d1d9;line-height:1.5">
      此操作将对 Cloudflare D1 数据库执行 <strong style="color:#f85149">DROP 物理表完全销毁与重建</strong>：<br>
      • <span style="color:#f85149">彻底销毁清空</span>：所有活跃持仓、自增 ID 序列、历史成交流水、币种配置、系统日志与旧 API Key。<br>
      • <span style="color:#3fb950">全新初始化</span>：完全等同于重新创建部署了一个崭新的 D1 数据库。
    </div>
    <div class="form-group" style="margin-top:14px">
      <label style="display:flex;align-items:center;gap:8px;cursor:pointer;color:#e6edf3;font-size:13px">
        <input type="checkbox" id="resetKeepPwd" checked style="width:16px;height:16px;cursor:pointer">
        <span>保留当前登录密码 <span style="color:#8b949e;font-size:12px">（重置后无需重新初始化密码，直接进入全新面板）</span></span>
      </label>
    </div>
    <div class="form-group" style="margin-top:14px">
      <label for="resetPwdConfirm" style="color:#f85149;font-weight:600">请输入当前登录密码以授权重置：</label>
      <input type="password" id="resetPwdConfirm" placeholder="请输入当前登录密码" onkeydown="if(event.key==='Enter')submitResetSystem()">
    </div>
    <div class="auth-error" id="resetSystemError"></div>
    <div class="modal-actions" style="margin-top:18px">
      <button class="btn btn-outline" onclick="closeResetSystemModal()">取消</button>
      <button class="btn btn-danger" id="btnConfirmReset" style="background:#b91c1c;border:1px solid #dc2626;font-weight:600" onclick="submitResetSystem()">确认彻底销毁并重置</button>
    </div>
  </div>
</div>

<script>
let coinsTimer = null;
let positionsTimer = null;
let logsTimer = null;
let tradesRefreshTimer = null;
let currentPositions = [];
let currentTrades = [];
let currentLogsData = [];
let autoScrollLogs = localStorage.getItem('okx_auto_scroll_logs') !== 'false';
let selectedSymbol = null;
let allCoinsData = [];
let currentConfigData = null;
let authToken = localStorage.getItem('okx_auth_token') || '';

// 前端分页与按需渲染状态（持仓与历史记录）
let posCurrentPage = 1;
let posPageSize = 30;
let tradesCurrentPage = 1;
let tradesPageSize = 30;
let logFilterType = 'all'; // 'all' | 'error'

// 脏数据保护集合与币种输入状态注册表
const dirtyInputs = new Set();
const coinInputs = {};

function markDirty(id) {
  dirtyInputs.add(id);
  const el = document.getElementById(id);
  if (el) el.dataset.dirty = "true";
}

function clearDirty(id) {
  dirtyInputs.delete(id);
  const el = document.getElementById(id);
  if (el) delete el.dataset.dirty;
}

function intervalToMsJs(value, unit) {
  const v = parseFloat(value) || 0;
  switch (unit) {
    case 'day': return v * 86400000;
    case 'hour': return v * 3600000;
    case 'minute': return v * 60000;
    case 'second': return v * 1000;
    default: return v * 60000;
  }
}

function getCoinSlices(coin) {
  if (!coin || !coin.timeout_value || !coin.timeout_unit || !coin.open_interval_value || !coin.open_interval_unit) {
    return 1;
  }
  const timeoutMs = intervalToMsJs(coin.timeout_value, coin.timeout_unit);
  const intervalMs = intervalToMsJs(coin.open_interval_value, coin.open_interval_unit);
  if (intervalMs <= 0) return 1;
  return Math.max(1, Math.floor(timeoutMs / intervalMs));
}

function normalizePeriodForUi(p) {
  if (p === undefined || p === null) return '1h';
  const raw = String(p).trim().toLowerCase();
  if (!raw) return '1h';
  if (raw === '5m' || raw === '5' || raw === '5min' || raw === '5分') return '5m';
  if (raw === '15m' || raw === '15' || raw === '15min' || raw === '15分') return '15m';
  if (raw === '30m' || raw === '30' || raw === '30min' || raw === '30分') return '30m';
  if (raw === '1h' || raw === '1' || raw === '1hr' || raw === '1hour' || raw === '1时' || raw === '60m') return '1h';
  if (raw === '2h' || raw === '2' || raw === '2hr' || raw === '2hour' || raw === '2时') return '2h';
  if (raw === '4h' || raw === '4' || raw === '4hr' || raw === '4hour' || raw === '4时') return '4h';
  if (raw === '6h' || raw === '6' || raw === '6hr' || raw === '6hour' || raw === '6时') return '6h';
  if (raw === '12h' || raw === '12' || raw === '12hr' || raw === '12hour' || raw === '12时') return '12h';
  if (raw === '1d' || raw === '24' || raw === '24h' || raw === '1day' || raw === '1天' || raw === '1日') return '1d';
  if (raw === '2d' || raw === '48' || raw === '48h' || raw === '2day' || raw === '2天' || raw === '2日') return '2d';
  return raw;
}

function trackCoinAmountInput(symbol, val) {
  if (!coinInputs[symbol]) coinInputs[symbol] = {};
  coinInputs[symbol].amount = val;
  coinInputs[symbol].amountDirty = true;
  updateAmountPreview(symbol);
}

function trackCoinPeriodChange(symbol, val) {
  if (!coinInputs[symbol]) coinInputs[symbol] = {};
  coinInputs[symbol].period = val;
  coinInputs[symbol].periodDirty = true;
}

function trackCoinAddPosInput(symbol, val) {
  if (!coinInputs[symbol]) coinInputs[symbol] = {};
  coinInputs[symbol].addPosRatio = val;
  coinInputs[symbol].addPosDirty = true;
}

function clearCoinAmountDirty(symbol) {
  if (coinInputs[symbol]) {
    coinInputs[symbol].amountDirty = false;
  }
}

function clearCoinPeriodDirty(symbol) {
  if (coinInputs[symbol]) {
    coinInputs[symbol].periodDirty = false;
  }
}

function clearCoinAddPosDirty(symbol) {
  if (coinInputs[symbol]) {
    coinInputs[symbol].addPosDirty = false;
  }
}

function clearAllParamDirty() {
  const ids = [
    'cfgLeverage', 'cfgTpRatio', 'cfgSlRatio',
    'cfgTimeoutValue', 'cfgTimeoutUnit', 'cfgMarginMode',
    'cfgTransferRatio', 'cfgIntervalValue', 'cfgIntervalUnit',
    'cfgSmartVolatility', 'cfgMinVolatility', 'cfgAddPosRatio'
  ];
  ids.forEach(id => clearDirty(id));
}

function selectCoin(symbol, event) {
  if (event) event.stopPropagation();
  if (selectedSymbol === symbol) {
    selectedSymbol = null;
  } else {
    selectedSymbol = symbol;
  }
  clearAllParamDirty();
  renderCoins(allCoinsData);
  fillParamsForSelected(true);
  renderPositions(currentPositions);
  renderTrades(currentTrades);
  renderLogs(currentLogsData);
}

function deselectCoin() {
  selectedSymbol = null;
  clearAllParamDirty();
  renderCoins(allCoinsData);
  fillParamsForSelected(true);
  renderPositions(currentPositions);
  renderTrades(currentTrades);
  renderLogs(currentLogsData);
}

function setSafeInputValue(id, val, force = false) {
  const el = document.getElementById(id);
  if (!el) return;
  if (!force) {
    if (document.activeElement === el || el.dataset.dirty === "true" || dirtyInputs.has(id)) return;
  } else {
    clearDirty(id);
  }
  if (val !== undefined && val !== null) {
    el.value = String(val);
  }
}

function updateAmountPreview(symbol) {
  const input = document.getElementById('amt-' + symbol);
  const calcEl = document.getElementById('calc-' + symbol);
  if (!input || !calcEl) return;
  const totalAmt = parseFloat(input.value);
  const coin = (allCoinsData || []).find(c => c.symbol === symbol);
  if (!isNaN(totalAmt) && totalAmt > 0) {
    const slices = getCoinSlices(coin);
    const perOrder = totalAmt / slices;
    if (slices > 1) {
      calcEl.innerHTML = '<span style="color:#8b949e">等分' + slices + '份 | 单笔:</span> <strong style="color:#2f81f7">' + perOrder.toFixed(2) + ' USDT</strong>';
    } else {
      calcEl.innerHTML = '<span style="color:#8b949e">单笔开仓:</span> <strong style="color:#2f81f7">' + totalAmt.toFixed(2) + ' USDT</strong>';
    }
  } else {
    calcEl.innerHTML = '<span style="color:#f85149">未设定初始金额，将跳过该币种</span>';
  }
}

function fillParamsForSelected(force = false) {
  const noticeEl = document.getElementById('selectedCoinNotice');
  const dotEl = document.getElementById('selectedCoinStatusDot');
  const statusTextEl = document.getElementById('selectedCoinStatusText');
  const btnToggleEl = document.getElementById('btnToggleSelectedCoin');
  const btnSmartVolSelected = document.getElementById('btnToggleSmartVolSelected');
  const deselectMainBtn = document.getElementById('btnDeselectCoin');
  const mobileBar = document.getElementById('mobileSelectionBar');
  const mobileSymbolName = document.getElementById('mobileSelectedSymbolName');
  const mobileSmartStatus = document.getElementById('mobileSmartVolStatus');
  const mobileSmartBtn = document.getElementById('btnMobileSmartVol');
  const coin = allCoinsData.find(c => c.symbol === selectedSymbol);
  
  if (selectedSymbol && coin) {
    const coinShortName = coin.symbol.replace('-USDT-SWAP','');
    const isSmartVol = Boolean(coin.smart_volatility_enabled);
    const minVol = (coin.min_volatility_threshold !== undefined && coin.min_volatility_threshold !== null) ? coin.min_volatility_threshold : '1.0';

    if (deselectMainBtn) deselectMainBtn.style.display = 'inline-flex';
    if (mobileBar) {
      mobileBar.style.display = 'flex';
      if (mobileSymbolName) mobileSymbolName.textContent = coinShortName;
      if (mobileSmartStatus) {
        mobileSmartStatus.textContent = isSmartVol ? ('⚡ 智能:开 (' + minVol + '%)') : '⚡ 智能:关';
        mobileSmartStatus.style.background = isSmartVol ? 'rgba(59,130,246,0.2)' : 'rgba(110,118,129,0.2)';
        mobileSmartStatus.style.color = isSmartVol ? '#60a5fa' : '#8b949e';
        mobileSmartStatus.style.border = isSmartVol ? '1px solid rgba(59,130,246,0.4)' : '1px solid #30363d';
      }
      if (mobileSmartBtn) {
        mobileSmartBtn.textContent = isSmartVol ? '⚡ 智能下单:开' : '⚡ 智能下单:关';
        mobileSmartBtn.style.background = isSmartVol ? '#2563eb' : '#374151';
        mobileSmartBtn.style.border = isSmartVol ? '1px solid #3b82f6' : '1px solid #4b5563';
      }
    }
    if (noticeEl) {
      noticeEl.innerHTML = '<span style="color:#58a6ff;background:rgba(88,166,255,0.12);padding:3px 8px;border-radius:6px;border:1px solid rgba(88,166,255,0.3);font-size:12px;display:inline-flex;align-items:center;gap:6px">当前配置币种: <strong>' + coinShortName + '</strong> (独立运行参数)</span>';
    }

    if (dotEl) {
      dotEl.className = 'status-dot ' + (coin.enabled ? 'running' : 'stopped');
    }
    if (statusTextEl) {
      statusTextEl.innerHTML = '【' + coinShortName + '】状态: <span style="color:' + (coin.enabled ? '#3fb950' : '#f85149') + '">' + (coin.enabled ? '🟢 运行中' : '🔴 已停止') + '</span>';
    }
    if (btnToggleEl) {
      btnToggleEl.disabled = false;
      if (coin.enabled) {
        btnToggleEl.className = 'btn btn-stop';
        btnToggleEl.textContent = '停止【' + coinShortName + '】交易';
      } else {
        btnToggleEl.className = 'btn btn-start';
        btnToggleEl.textContent = '启动【' + coinShortName + '】交易';
      }
    }
    if (btnSmartVolSelected) {
      btnSmartVolSelected.style.display = 'inline-flex';
      btnSmartVolSelected.textContent = isSmartVol ? '⚡ 智能下单: 开' : '⚡ 智能下单: 关';
      btnSmartVolSelected.style.background = isSmartVol ? '#2563eb' : '#374151';
      btnSmartVolSelected.style.borderColor = isSmartVol ? '#3b82f6' : '#4b5563';
      btnSmartVolSelected.title = isSmartVol ? '点击关闭当前选中币种的智能波动过滤' : '点击开启当前选中币种的智能波动过滤(低波动自动暂停下单)';
    }
    
    const lev = (coin.leverage !== undefined && coin.leverage !== null) ? coin.leverage : '';
    const intVal = (coin.open_interval_value !== undefined && coin.open_interval_value !== null) ? coin.open_interval_value : '';
    const intUnit = coin.open_interval_unit || '';
    const tpRatio = (coin.tp_ratio !== undefined && coin.tp_ratio !== null) ? coin.tp_ratio : '';
    const slRatio = (coin.sl_ratio !== undefined && coin.sl_ratio !== null) ? coin.sl_ratio : '';
    const timeVal = (coin.timeout_value !== undefined && coin.timeout_value !== null) ? coin.timeout_value : '';
    const timeUnit = coin.timeout_unit || '';
    const marginMode = coin.margin_mode || '';
    const transRatio = (coin.profit_transfer_ratio !== undefined && coin.profit_transfer_ratio !== null) ? coin.profit_transfer_ratio : '';
    const addPosRatio = (coin.add_pos_ratio !== undefined && coin.add_pos_ratio !== null) ? coin.add_pos_ratio : '';

    if (force) {
      clearDirty('cfgLeverage');
      clearDirty('cfgIntervalValue');
      clearDirty('cfgIntervalUnit');
      clearDirty('cfgTpRatio');
      clearDirty('cfgSlRatio');
      clearDirty('cfgTimeoutValue');
      clearDirty('cfgTimeoutUnit');
      clearDirty('cfgMarginMode');
      clearDirty('cfgTransferRatio');
      clearDirty('cfgSmartVolatility');
      clearDirty('cfgMinVolatility');
      clearDirty('cfgAddPosRatio');
    }
    
    setSafeInputValue('cfgLeverage', lev, force);
    setSafeInputValue('cfgIntervalValue', intVal, force);
    setSafeInputValue('cfgIntervalUnit', intUnit, force);
    setSafeInputValue('cfgTpRatio', tpRatio, force);
    setSafeInputValue('cfgSlRatio', slRatio, force);
    setSafeInputValue('cfgTimeoutValue', timeVal, force);
    setSafeInputValue('cfgTimeoutUnit', timeUnit, force);
    setSafeInputValue('cfgMarginMode', marginMode, force);
    setSafeInputValue('cfgTransferRatio', transRatio, force);
    setSafeInputValue('cfgSmartVolatility', isSmartVol ? '1' : '0', force);
    setSafeInputValue('cfgMinVolatility', minVol, force);
    setSafeInputValue('cfgAddPosRatio', addPosRatio, force);

    document.getElementById('cfgLeverage').placeholder = "例: 10";
    document.getElementById('cfgIntervalValue').placeholder = "例: 1";
    document.getElementById('cfgMinVolatility').placeholder = "例: 1.0";
    document.getElementById('cfgAddPosRatio').placeholder = "例: 2.0 (0为不限)";

    document.querySelectorAll('.param-item input, .param-item select').forEach(el => {
      if (el.id !== 'cfgApiKey' && el.id !== 'cfgSecretKey' && el.id !== 'cfgPassphrase') {
        el.disabled = false;
        el.style.opacity = '1';
      }
    });
  } else {
    if (deselectMainBtn) deselectMainBtn.style.display = 'none';
    if (mobileBar) mobileBar.style.display = 'none';
    if (btnSmartVolSelected) btnSmartVolSelected.style.display = 'none';
    if (noticeEl) {
      noticeEl.innerHTML = '<span style="color:#ff7b72;font-size:12px;background:rgba(255,123,114,0.1);padding:3px 8px;border-radius:6px;">请点击下方币种卡片以独立配置其交易参数</span>';
    }
    if (dotEl) dotEl.className = 'status-dot stopped';
    if (statusTextEl) statusTextEl.textContent = '未选择币种';
    if (btnToggleEl) {
      btnToggleEl.disabled = true;
      btnToggleEl.className = 'btn btn-start';
      btnToggleEl.textContent = '开始交易';
    }
    
    if (force) {
      clearDirty('cfgLeverage');
      clearDirty('cfgIntervalValue');
      clearDirty('cfgIntervalUnit');
      clearDirty('cfgTpRatio');
      clearDirty('cfgSlRatio');
      clearDirty('cfgTimeoutValue');
      clearDirty('cfgTimeoutUnit');
      clearDirty('cfgMarginMode');
      clearDirty('cfgTransferRatio');
      clearDirty('cfgSmartVolatility');
      clearDirty('cfgMinVolatility');
      clearDirty('cfgAddPosRatio');
    }

    setSafeInputValue('cfgLeverage', '', force);
    setSafeInputValue('cfgIntervalValue', '', force);
    setSafeInputValue('cfgIntervalUnit', '', force);
    setSafeInputValue('cfgTpRatio', '', force);
    setSafeInputValue('cfgSlRatio', '', force);
    setSafeInputValue('cfgTimeoutValue', '', force);
    setSafeInputValue('cfgTimeoutUnit', '', force);
    setSafeInputValue('cfgMarginMode', '', force);
    setSafeInputValue('cfgTransferRatio', '', force);
    setSafeInputValue('cfgSmartVolatility', '0', force);
    setSafeInputValue('cfgMinVolatility', '', force);
    setSafeInputValue('cfgAddPosRatio', '', force);
    
    document.getElementById('cfgLeverage').placeholder = "-";
    document.getElementById('cfgIntervalValue').placeholder = "-";
    document.getElementById('cfgMinVolatility').placeholder = "-";
    document.getElementById('cfgAddPosRatio').placeholder = "-";

    document.querySelectorAll('.param-item input, .param-item select').forEach(el => {
      if (el.id !== 'cfgApiKey' && el.id !== 'cfgSecretKey' && el.id !== 'cfgPassphrase') {
        el.disabled = true;
        el.style.opacity = '0.4';
      }
    });
  }
}

async function api(path, opts = {}) {
  const headers = { 'Content-Type': 'application/json', ...(opts.headers || {}) };
  if (authToken) {
    headers['X-Auth-Token'] = authToken;
  }
  const res = await fetch(path, { ...opts, headers });
  if (res.status === 401) {
    handleUnauthorized();
    return { success: false, error: '未登录或登录已失效', code: 401 };
  }
  const data = await res.json().catch(() => ({ success: false, error: '解析响应异常' }));
  if (data && data.code === 401) {
    handleUnauthorized();
  }
  return data;
}

function stopAllTimers() {
  if (coinsTimer) { clearInterval(coinsTimer); coinsTimer = null; }
  if (positionsTimer) { clearInterval(positionsTimer); positionsTimer = null; }
  if (logsTimer) { clearInterval(logsTimer); logsTimer = null; }
  if (tradesRefreshTimer) { clearInterval(tradesRefreshTimer); tradesRefreshTimer = null; }
}

function handleUnauthorized() {
  authToken = '';
  localStorage.removeItem('okx_auth_token');
  stopAllTimers();
  checkAuth();
}

async function checkAuth() {
  try {
    const res = await api('/api/auth/check');
    if (res && res.success) {
      if (res.hasPassword === false) {
        showAuthSetupMode();
      } else if (res.authenticated) {
        document.getElementById('authOverlay').style.display = 'none';
        startDashboard();
      } else {
        showAuthLoginMode();
      }
    } else {
      console.warn('Check auth returned not successful:', res);
      showAuthLoginMode();
      if (res && res.error) {
        const errEl = document.getElementById('authLoginError');
        if (errEl) errEl.textContent = res.error;
      }
    }
  } catch (err) {
    console.error('Check auth error:', err);
    showAuthLoginMode();
  }
}

function showAuthSetupMode() {
  document.getElementById('authLoginBox').style.display = 'none';
  document.getElementById('authSetupBox').style.display = 'block';
  document.getElementById('authOverlay').style.display = 'flex';
  const errEl = document.getElementById('authSetupError');
  if (errEl) errEl.textContent = '';
  setTimeout(() => {
    const el = document.getElementById('authNewPassword');
    if (el) el.focus();
  }, 100);
}

function showAuthLoginMode() {
  document.getElementById('authSetupBox').style.display = 'none';
  document.getElementById('authLoginBox').style.display = 'block';
  document.getElementById('authOverlay').style.display = 'flex';
  const errEl = document.getElementById('authLoginError');
  if (errEl && !errEl.textContent) errEl.textContent = '';
  setTimeout(() => {
    const el = document.getElementById('authPassword');
    if (el) el.focus();
  }, 100);
}

async function submitLogin() {
  const passwordInput = document.getElementById('authPassword');
  const password = passwordInput.value;
  const errEl = document.getElementById('authLoginError');
  errEl.textContent = '';
  if (!password) {
    errEl.textContent = '请输入访问密码';
    return;
  }
  const res = await fetch('/api/auth/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ password })
  }).then(r => r.json()).catch(() => ({ success: false, error: '网络请求异常' }));

  if (res.success && res.token) {
    authToken = res.token;
    localStorage.setItem('okx_auth_token', authToken);
    passwordInput.value = '';
    document.getElementById('authOverlay').style.display = 'none';
    startDashboard();
  } else if (res.needSetup || res.hasPassword === false) {
    showAuthSetupMode();
    const setupErr = document.getElementById('authSetupError');
    if (setupErr) setupErr.textContent = res.error || '系统尚未设置密码，请先初始化设置密码';
  } else {
    errEl.textContent = res.error || '登录失败，请检查密码';
  }
}

async function submitSetup() {
  const newPwd = document.getElementById('authNewPassword').value;
  const confirmPwd = document.getElementById('authConfirmPassword').value;
  const errEl = document.getElementById('authSetupError');
  errEl.textContent = '';

  if (!newPwd) {
    errEl.textContent = '请输入新密码';
    return;
  }
  if (newPwd !== confirmPwd) {
    errEl.textContent = '两次输入的密码不一致';
    return;
  }
  const res = await fetch('/api/auth/setup', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ newPassword: newPwd })
  }).then(r => r.json()).catch(() => ({ success: false, error: '网络请求异常' }));

  if (res.success && res.token) {
    authToken = res.token;
    localStorage.setItem('okx_auth_token', authToken);
    document.getElementById('authNewPassword').value = '';
    document.getElementById('authConfirmPassword').value = '';
    document.getElementById('authOverlay').style.display = 'none';
    startDashboard();
  } else if (res.hasPassword === true || (res.error && (res.error.includes('已存在') || res.error.includes('已设置')))) {
    showAuthLoginMode();
    const loginErr = document.getElementById('authLoginError');
    if (loginErr) loginErr.textContent = '系统已存在访问密码，请直接输入密码登录';
  } else {
    errEl.textContent = res.error || '设置密码失败';
  }
}

function openChangePasswordModal() {
  document.getElementById('pwdOld').value = '';
  document.getElementById('pwdNew').value = '';
  document.getElementById('pwdNewConfirm').value = '';
  document.getElementById('changePwdError').textContent = '';
  document.getElementById('changePasswordModal').style.display = 'flex';
  setTimeout(() => {
    const el = document.getElementById('pwdOld');
    if (el) el.focus();
  }, 100);
}

function closeChangePasswordModal() {
  document.getElementById('changePasswordModal').style.display = 'none';
}

async function submitChangePassword() {
  const oldPassword = document.getElementById('pwdOld').value;
  const newPassword = document.getElementById('pwdNew').value;
  const confirmPassword = document.getElementById('pwdNewConfirm').value;
  const errEl = document.getElementById('changePwdError');
  errEl.textContent = '';

  if (!oldPassword) {
    errEl.textContent = '请输入当前原密码';
    return;
  }
  if (!newPassword) {
    errEl.textContent = '请输入新密码';
    return;
  }
  if (newPassword !== confirmPassword) {
    errEl.textContent = '新密码与确认密码不一致';
    return;
  }

  const res = await api('/api/auth/change-password', {
    method: 'POST',
    body: JSON.stringify({ oldPassword, newPassword })
  });

  if (res.success && res.token) {
    authToken = res.token;
    localStorage.setItem('okx_auth_token', authToken);
    alert('密码修改成功，已重新生成身份令牌！');
    closeChangePasswordModal();
  } else {
    errEl.textContent = res.error || '修改密码失败';
  }
}

async function logout() {
  if (!confirm('确认退出系统登录？')) return;
  await api('/api/auth/logout', { method: 'POST' });
  authToken = '';
  localStorage.removeItem('okx_auth_token');
  stopAllTimers();
  checkAuth();
}

function openResetSystemModal() {
  document.getElementById('resetPwdConfirm').value = '';
  document.getElementById('resetSystemError').textContent = '';
  document.getElementById('resetSystemModal').style.display = 'flex';
  setTimeout(() => {
    const el = document.getElementById('resetPwdConfirm');
    if (el) el.focus();
  }, 100);
}

function closeResetSystemModal() {
  document.getElementById('resetSystemModal').style.display = 'none';
}

async function submitResetSystem() {
  const pwd = document.getElementById('resetPwdConfirm').value;
  const keepPwd = document.getElementById('resetKeepPwd')?.checked ?? true;
  const errEl = document.getElementById('resetSystemError');
  const btn = document.getElementById('btnConfirmReset');
  errEl.textContent = '';

  if (!pwd) {
    errEl.textContent = '请输入当前登录密码进行授权确认';
    return;
  }

  const promptMsg = keepPwd
    ? '【二次确认】确定要彻底销毁并重建 D1 数据库吗？\\n所有持仓、自增序列、历史流水与币种配置将彻底清空（保留登录密码）。此操作不可撤销！'
    : '【高危二次确认】确定要彻底销毁并重建 D1 数据库且【抹除登录密码】吗？\\n系统将完全回到首次部署的全新初始化状态。此操作不可撤销！';

  if (!confirm(promptMsg)) {
    return;
  }

  if (btn) {
    btn.disabled = true;
    btn.textContent = '⏳ 彻底销毁与重建中...';
  }

  try {
    const res = await api('/api/system/reset', {
      method: 'POST',
      body: JSON.stringify({ password: pwd, keepPassword: keepPwd })
    });

    if (res.success) {
      alert('✅ D1 数据库已彻底销毁并重新初始化！恢复为全新部署状态。');
      closeResetSystemModal();
      selectedSymbol = null;
      currentPositions = [];
      currentTrades = [];
      currentLogsData = [];
      allCoinsData = [];
      clearAllParamDirty();

      if (!keepPwd) {
        document.cookie = 'auth_token=; path=/; max-age=0';
        authToken = '';
        checkAuth();
      } else {
        await loadAll();
      }
    } else {
      errEl.textContent = res.error || '重置系统失败';
    }
  } catch (err) {
    errEl.textContent = '重置请求异常: ' + String(err);
  } finally {
    if (btn) {
      btn.disabled = false;
      btn.textContent = '确认彻底销毁并重置';
    }
  }
}

function startDashboard() {
  updateAutoScrollBtnUI();
  loadConfig();
  loadAll();
  stopAllTimers();

  // 1. 币种列表与行情：静止状态（仅启动加载/修改参数/或手动点击「🔄 刷新行情」时拉取）
  // 2. 当前持仓与即时 PnL (自动每 5 秒批量轮询更新最新行情价格与未实现盈亏，支持随时手动点击「🔄 刷新持仓」)
  positionsTimer = setInterval(loadPositions, 5000);
  // 3. 运行日志 (每 2 秒拉取 50 行)
  logsTimer = setInterval(loadLogs, 2000);
  // 4. 历史交易记录 (每 5 分钟拉取，支持随时手动刷新)
  tradesRefreshTimer = setInterval(() => loadTrades(false), 300000);
}

async function manualRefreshCoins(btn = null) {
  if (btn) {
    btn.disabled = true;
    btn.textContent = '⏳ 刷新中...';
  }
  try {
    await loadCoinsAndStatus();
  } finally {
    if (btn) {
      btn.disabled = false;
      btn.textContent = '🔄 刷新行情';
    }
  }
}

async function manualRefreshPositions(btn = null) {
  if (btn) {
    btn.disabled = true;
    btn.textContent = '⏳ 刷新中...';
  }
  try {
    await loadPositions();
  } finally {
    if (btn) {
      btn.disabled = false;
      btn.textContent = '🔄 刷新持仓';
    }
  }
}

async function loadCoinsAndStatus() {
  try {
    const [status, coins] = await Promise.all([
      api('/api/status'),
      api('/api/coins')
    ]);

    if (status && status.success) {
      currentConfigData = status.data;
    }

    if (coins && coins.success && coins.data) {
      allCoinsData = coins.data;
      if (selectedSymbol && !allCoinsData.some(c => c.symbol === selectedSymbol)) {
        selectedSymbol = null;
      }
      renderCoins(allCoinsData);
      // 币种最新价格刷新时，立即联动重新计算持仓的即时浮盈 (PnL)
      if (currentPositions && currentPositions.length > 0) {
        renderPositions(currentPositions);
      }
    }

    const activeEl = document.activeElement;
    const isEditingParams = dirtyInputs.size > 0 || (activeEl && activeEl.id && activeEl.id.startsWith('cfg'));
    if (!isEditingParams) {
      fillParamsForSelected();
    }
  } catch (err) {
    console.error('Coins/Status load failed:', err);
  }
}

async function loadPositions() {
  try {
    const positions = await api('/api/positions');
    if (positions && positions.success && positions.data) {
      currentPositions = positions.data;
      if (allCoinsData && allCoinsData.length > 0 && currentPositions.length > 0) {
        for (const p of currentPositions) {
          if (p.last_price && p.last_price > 0) {
            const cleanSym = (p.symbol || '').replace('-USDT-SWAP', '').replace(/[\/\-_]/g, '').replace(/USDT$/, '');
            const c = allCoinsData.find(item => item.symbol === p.symbol || (item.symbol && item.symbol.replace('-USDT-SWAP', '').replace(/[\/\-_]/g, '').replace(/USDT$/, '') === cleanSym));
            if (c) {
              c.last_price = p.last_price;
            }
          }
        }
      }
      renderPositions(currentPositions);
    }
  } catch (err) {
    console.error('Positions load failed:', err);
  }
}

async function loadLogs() {
  try {
    const logs = await api('/api/logs?limit=50');
    if (logs && logs.success && logs.data) {
      renderLogs(logs.data);
    }
  } catch (err) {
    console.error('Logs load failed:', err);
  }
}

async function loadTrades(manual = false, btn = null) {
  if (btn) {
    btn.disabled = true;
    btn.textContent = '⏳ 刷新中...';
  }
  try {
    const trades = await api('/api/trades?limit=50');
    if (trades && trades.success && trades.data) {
      currentTrades = trades.data;
      renderTrades(currentTrades);
    }
  } catch (err) {
    console.error('Trades load failed:', err);
  } finally {
    if (btn) {
      btn.disabled = false;
      btn.textContent = '🔄 刷新记录';
    }
  }
}

async function loadAll() {
  await Promise.all([loadCoinsAndStatus(), loadPositions(), loadLogs(), loadTrades(false)]);
}

async function loadConfig() {
  try {
    const cfg = await api('/api/config');
    if (cfg.success && cfg.data) {
      currentConfigData = cfg.data;
      fillParamsForSelected();
      const c = cfg.data;
      if (c.okx_api_key) setSafeInputValue('cfgApiKey', c.okx_api_key);
      if (c.okx_secret_key) setSafeInputValue('cfgSecretKey', c.okx_secret_key);
      if (c.okx_passphrase) setSafeInputValue('cfgPassphrase', c.okx_passphrase);
    }
  } catch (err) {
    console.error('Config load failed:', err);
  }
}

async function saveCoinConfig(symbol) {
  const amtInput = document.getElementById('amt-' + symbol);
  const selInput = document.getElementById('sel-' + symbol);
  const addposInput = document.getElementById('addpos-' + symbol);
  const payload = { symbol };

  if (amtInput) {
    const val = parseFloat(amtInput.value);
    if (!isNaN(val) && val >= 0) {
      payload.funding_amount = val;
    }
  }
  if (selInput) {
    payload.period = selInput.value;
  }
  if (addposInput) {
    const val = parseFloat(addposInput.value);
    if (!isNaN(val)) {
      payload.add_pos_ratio = val;
    }
  }

  const res = await api('/api/coins', { method: 'POST', body: JSON.stringify(payload) });
  if (!res.success) {
    alert('保存配置失败: ' + (res.error || '未知错误'));
    return;
  }

  clearCoinAmountDirty(symbol);
  clearCoinPeriodDirty(symbol);
  clearCoinAddPosDirty(symbol);
  await loadAll();
}

async function saveCoinAddPosRatio(symbol, val) {
  const num = parseFloat(val);
  const res = await api('/api/coins', { method: 'POST', body: JSON.stringify({ symbol, add_pos_ratio: !isNaN(num) ? num : 0 }) });
  if (!res.success) { alert(res.error); return; }
  clearCoinAddPosDirty(symbol);
  await loadAll();
}

function getCoinNextOpenStatus(c) {
  if (!c.enabled) {
    return { text: '🔴 已停止', color: '#f85149', bg: 'rgba(248,81,73,0.15)', border: 'rgba(248,81,73,0.3)' };
  }
  if (c.pause_open) {
    return { text: '⏸️ 已暂停下单', color: '#8b5cf6', bg: 'rgba(139,92,246,0.15)', border: 'rgba(139,92,246,0.3)' };
  }
  if (c.smart_volatility_enabled && (c.volatility_status === 'paused' || (c.current_volatility !== undefined && c.current_volatility < (c.min_volatility_threshold || 1.0)))) {
    return { text: '⏸️ 波动过小暂停', color: '#fbbf24', bg: 'rgba(217,119,6,0.2)', border: 'rgba(217,119,6,0.4)' };
  }
  if (!c.direction) {
    return { text: '⏳ 待判定方向', color: '#58a6ff', bg: 'rgba(88,166,255,0.15)', border: 'rgba(88,166,255,0.3)' };
  }
  if (!c.open_interval_value || !c.open_interval_unit) {
    return { text: '⚠️ 需配置间隔', color: '#f59e0b', bg: 'rgba(245,158,11,0.15)', border: 'rgba(245,158,11,0.3)' };
  }

  const lastOpen = c.last_open_time || 0;
  if (lastOpen === 0) {
    return { text: '⚡ 就绪(下轮即开单)', color: '#3fb950', bg: 'rgba(63,185,80,0.2)', border: 'rgba(63,185,80,0.4)' };
  }

  let unitSec = 3600;
  if (c.open_interval_unit === 'second') unitSec = 1;
  else if (c.open_interval_unit === 'minute') unitSec = 60;
  else if (c.open_interval_unit === 'day') unitSec = 86400;
  const intervalMs = (c.open_interval_value || 1) * unitSec * 1000;

  const targetNext = lastOpen + intervalMs + (c.next_jitter_ms || 0);
  const diffSec = Math.ceil((targetNext - Date.now()) / 1000);

  if (diffSec <= 0) {
    return { text: '⚡ 就绪(下轮即开单)', color: '#3fb950', bg: 'rgba(63,185,80,0.2)', border: 'rgba(63,185,80,0.4)' };
  }
  if (diffSec < 60) {
    return { text: '⏳ ' + diffSec + 's后开单', color: '#58a6ff', bg: 'rgba(88,166,255,0.15)', border: 'rgba(88,166,255,0.3)' };
  }
  const m = Math.floor(diffSec / 60);
  const s = diffSec % 60;
  return { text: '⏳ ' + m + 'm' + (s > 0 ? (s + 's') : '') + '后开单', color: '#58a6ff', bg: 'rgba(88,166,255,0.15)', border: 'rgba(88,166,255,0.3)' };
}

function renderCoins(coins) {
  const grid = document.getElementById('coinGrid');
  if (!grid) return;

  const totalCount = coins.length;
  const runningCount = coins.filter(c => c.enabled && !c.pause_open).length;
  const stoppedCount = coins.filter(c => !c.enabled).length;
  const pausedCount = coins.filter(c => c.enabled && c.pause_open).length;

  const elTotal = document.getElementById('coinCountTotal');
  const elRunning = document.getElementById('coinCountRunning');
  const elStopped = document.getElementById('coinCountStopped');
  const elPaused = document.getElementById('coinCountPaused');
  if (elTotal) elTotal.textContent = String(totalCount);
  if (elRunning) elRunning.textContent = String(runningCount);
  if (elStopped) elStopped.textContent = String(stoppedCount);
  if (elPaused) elPaused.textContent = String(pausedCount);

  const activeEl = document.activeElement;
  const activeId = activeEl ? activeEl.id : null;

  const existingMap = new Map();
  Array.from(grid.children).forEach(child => {
    if (child.dataset && child.dataset.symbol) {
      existingMap.set(child.dataset.symbol, child);
    }
  });

  const currentSymbols = new Set(coins.map(c => c.symbol));

  existingMap.forEach((cardEl, symbol) => {
    if (!currentSymbols.has(symbol)) {
      grid.removeChild(cardEl);
    }
  });

  coins.forEach(c => {
    const symbol = c.symbol;
    const tracker = coinInputs[symbol] || {};

    let displayAmt = '';
    if (tracker.amountDirty && tracker.amount !== undefined) {
      displayAmt = tracker.amount;
    } else if (activeId === 'amt-' + symbol && activeEl) {
      displayAmt = activeEl.value;
    } else {
      displayAmt = c.funding_amount > 0 ? String(c.funding_amount) : '';
    }

    let displayPeriod = '';
    if (tracker.periodDirty && tracker.period !== undefined) {
      displayPeriod = normalizePeriodForUi(tracker.period);
    } else if (activeId === 'sel-' + symbol && activeEl) {
      displayPeriod = normalizePeriodForUi(activeEl.value);
    } else {
      displayPeriod = normalizePeriodForUi(c.period || '1h');
    }

    let displayAddPos = '';
    if (tracker.addPosDirty && tracker.addPosRatio !== undefined) {
      displayAddPos = tracker.addPosRatio;
    } else if (activeId === 'addpos-' + symbol && activeEl) {
      displayAddPos = activeEl.value;
    } else {
      displayAddPos = (c.add_pos_ratio !== undefined && c.add_pos_ratio !== null && c.add_pos_ratio > 0) ? String(c.add_pos_ratio) : '';
    }

    const hasParams = (c.leverage && c.tp_ratio !== null && c.tp_ratio !== undefined && c.sl_ratio !== null && c.sl_ratio !== undefined && c.timeout_value && c.open_interval_value);
    const slices = getCoinSlices(c);
    const numAmt = parseFloat(displayAmt);
    let calcHtml = '';
    if (!isNaN(numAmt) && numAmt > 0) {
      if (hasParams) {
        const perOrder = numAmt / slices;
        if (slices > 1) {
          calcHtml = '<span style="color:#8b949e">等分' + slices + '份 | 单笔:</span> <strong style="color:#2f81f7">' + perOrder.toFixed(2) + ' USDT</strong>';
        } else {
          calcHtml = '<span style="color:#8b949e">单笔:</span> <strong style="color:#2f81f7">' + numAmt.toFixed(2) + ' USDT</strong>';
        }
      } else {
        calcHtml = '<span style="color:#f59e0b">请配置交易参数</span>';
      }
    } else {
      calcHtml = '<span style="color:#8b949e">未设定初始金额</span>';
    }

    let paramSummary = '';
    if (hasParams) {
      const lev = c.leverage + 'x ';
      const modeStr = c.margin_mode === 'cross' ? '全仓' : '逐仓';
      const tpStr = c.tp_ratio !== undefined && c.tp_ratio !== null ? c.tp_ratio : '';
      const slStr = c.sl_ratio !== undefined && c.sl_ratio !== null ? c.sl_ratio : '';
      const toVal = c.timeout_value || '';
      const toUnit = c.timeout_unit === 'second' ? 's' : c.timeout_unit === 'minute' ? 'm' : c.timeout_unit === 'day' ? 'd' : 'h';
      const intVal = c.open_interval_value || '';
      const intUnit = c.open_interval_unit === 'second' ? 's' : c.open_interval_unit === 'minute' ? 'm' : c.open_interval_unit === 'day' ? 'd' : 'h';
      paramSummary = lev + modeStr + ' | 盈' + tpStr + '% 损' + slStr + '% | 仓' + toVal + toUnit + '/隔' + intVal + intUnit;
      if (c.add_pos_ratio && c.add_pos_ratio > 0) {
        paramSummary += ' | 加仓亏损-' + c.add_pos_ratio + '%';
      }
    } else {
      paramSummary = '⚠️ 未配置交易参数';
    }

    let cardEl = existingMap.get(symbol);
    const isSelected = (symbol === selectedSymbol);

    if (!cardEl) {
      cardEl = document.createElement('div');
      cardEl.dataset.symbol = symbol;
      cardEl.onclick = (e) => selectCoin(symbol, e);
      grid.appendChild(cardEl);
    }

    cardEl.className = 'coin-card ' + (isSelected ? 'selected' : '') + ' ' + (c.enabled ? (c.pause_open ? 'paused' : 'enabled') : '');

    const nextStatus = getCoinNextOpenStatus(c);

    if (!cardEl.querySelector('.coin-name')) {
      const isSmartVol = Boolean(c.smart_volatility_enabled);
      const isVolPaused = isSmartVol && (c.volatility_status === 'paused' || (c.current_volatility !== undefined && c.current_volatility < (c.min_volatility_threshold || 1.0)));
      const volValStr = (c.current_volatility !== undefined && c.current_volatility !== null) ? (c.current_volatility + '%') : '-';
      const volThreshStr = (c.min_volatility_threshold !== undefined && c.min_volatility_threshold !== null) ? (c.min_volatility_threshold + '%') : '1.0%';
      const hasAddPos = Boolean(c.add_pos_ratio && c.add_pos_ratio > 0);

      cardEl.innerHTML = 
        '<div class="coin-card-top">' +
          '<span class="coin-status-tag" style="font-size:11px;font-weight:600;padding:2px 6px;border-radius:4px;background:' + nextStatus.bg + ';color:' + nextStatus.color + ';border:1px solid ' + nextStatus.border + '" title="当前代币运行与下单调度状态">' + nextStatus.text + '</span>' +
          '<button class="btn btn-coin-toggle" style="padding:3px 10px;font-size:11px;font-weight:500;background:' + (c.enabled ? '#da3633' : '#238636') + ';color:#fff" onclick="event.stopPropagation();toggleCoin(&apos;' + symbol + '&apos;, ' + (!c.enabled) + ')" title="' + (c.enabled ? '停止当前币种自动交易' : '启动当前币种自动交易') + '">' + (c.enabled ? '停止交易' : '开始交易') + '</button>' +
          '<span class="coin-name" title="' + symbol + '">' +
            symbol.replace('-USDT-SWAP','') +
            '<span class="sel-badge" style="display:' + (isSelected ? 'inline-block' : 'none') + ';font-size:10px;margin-left:4px;color:#58a6ff;background:rgba(88,166,255,0.2);padding:1px 5px;border-radius:3px;font-weight:normal">已选中</span>' +
          '</span>' +
          '<span class="coin-dir ' + (c.direction || 'none') + '">' + (c.direction === 'long' ? '做多' : c.direction === 'short' ? '做空' : '待判定') + '</span>' +
          '<span class="smart-vol-tag" style="display:' + (isSmartVol ? 'inline-block' : 'none') + ';font-size:11px;padding:2px 7px;border-radius:4px;background:' + (isVolPaused ? 'rgba(217,119,6,0.2)' : 'rgba(59,130,246,0.2)') + ';color:' + (isVolPaused ? '#fbbf24' : '#60a5fa') + ';border:1px solid ' + (isVolPaused ? 'rgba(217,119,6,0.4)' : 'rgba(59,130,246,0.4)') + ';font-weight:600" title="智能波动过滤: 临近2根K线波动 ' + volValStr + ' (阈值 ' + volThreshStr + ')">' + (isVolPaused ? ('⏸️ 智能暂停(' + volValStr + ')') : ('⚡ 智能下单(' + volValStr + ')')) + '</span>' +
          '<span class="add-pos-tag" style="display:' + (hasAddPos ? 'inline-block' : 'none') + ';font-size:11px;padding:2px 7px;border-radius:4px;background:rgba(56,189,248,0.15);color:#38bdf8;border:1px solid rgba(56,189,248,0.3);font-weight:600" title="加仓幅度：盈利自动加仓，亏损需达 -' + (c.add_pos_ratio || 0) + '% 后才允许加仓">📉 加仓: -' + (c.add_pos_ratio || 0) + '%</span>' +
          '<span class="pause-tag" style="display:' + (c.enabled && c.pause_open ? 'inline-block' : 'none') + ';font-size:10px;padding:2px 5px;border-radius:4px;background:#8b5cf6;color:#fff;font-weight:600" title="已手动暂停自动下单">已暂停下单</span>' +
          '<span class="timeout-tag" style="display:' + (c.disable_timeout ? 'inline-block' : 'none') + ';font-size:10px;padding:2px 5px;border-radius:4px;background:#f59e0b;color:#fff;font-weight:600;margin-left:4px" title="已免超时平仓">免超时</span>' +
          '<span class="param-tag" style="font-size:10px;padding:2px 6px;border-radius:4px;background:rgba(110,118,129,0.15);border:1px solid #30363d;color:#8b949e" title="当前币种独立交易参数">' + paramSummary + '</span>' +
        '</div>' +
        '<div class="coin-card-bottom">' +
          '<div style="display:flex;align-items:center;gap:3px" onclick="event.stopPropagation()">' +
            '<span style="font-size:11px;color:#8b949e">初始金额:</span>' +
            '<input type="number" id="amt-' + symbol + '" value="' + displayAmt + '" placeholder="USDT" style="width:70px;padding:3px 5px;border:1px solid #30363d;border-radius:4px;background:#0d1117;color:#c9d1d9;font-size:11px" oninput="trackCoinAmountInput(&apos;' + symbol + '&apos;, this.value)" onchange="trackCoinAmountInput(&apos;' + symbol + '&apos;, this.value)" title="自定义初始资金总额(USDT)">' +
          '</div>' +
          '<div id="calc-' + symbol + '" style="font-size:11px;white-space:nowrap;margin:2px 0">' +
            calcHtml +
          '</div>' +
          '<select id="sel-' + symbol + '" onclick="event.stopPropagation()" onchange="trackCoinPeriodChange(&apos;' + symbol + '&apos;, this.value)">' +
            [{v:'5m',t:'5分'},{v:'15m',t:'15分'},{v:'30m',t:'30分'},{v:'1h',t:'1时'},{v:'2h',t:'2时'},{v:'4h',t:'4时'},{v:'6h',t:'6时'},{v:'12h',t:'12时'},{v:'1d',t:'1日'},{v:'2d',t:'2日'}].map(o => {
              const isSel = (o.v === displayPeriod);
              return '<option value="' + o.v + '" ' + (isSel ? 'selected' : '') + '>' + o.t + '</option>';
            }).join('') +
          '</select>' +
          '<button class="btn btn-save" style="padding:3px 8px;font-size:11px" onclick="event.stopPropagation();saveCoinConfig(&apos;' + symbol + '&apos;)" title="保存初始金额、周期并立即刷新方向">保存配置</button>' +
          '<button class="btn btn-smart-vol" style="padding:3px 8px;font-size:11px;background:' + (isSmartVol ? '#2563eb' : '#374151') + ';color:#fff;border:1px solid ' + (isSmartVol ? '#3b82f6' : '#4b5563') + '" onclick="event.stopPropagation();toggleSmartVolatility(&apos;' + symbol + '&apos;, ' + (!isSmartVol) + ')" title="' + (isSmartVol ? '点击关闭智能下单波动过滤' : '点击开启智能下单波动过滤(临近2K线波动低于设定阈值自动暂停下单，高于恢复)') + '">' + (isSmartVol ? '⚡ 智能下单:开' : '⚡ 智能下单:关') + '</button>' +
          '<div style="display:inline-flex;align-items:center;gap:3px;background:rgba(56,189,248,0.08);padding:1px 6px;border-radius:4px;border:1px solid rgba(56,189,248,0.25)" onclick="event.stopPropagation()" title="加仓幅度(%)：到达下单间隔时，盈利自动加仓；亏损时需达到该浮亏幅度(%)后才允许加仓，设为0或空则不限">' +
            '<span style="font-size:11px;color:#38bdf8;font-weight:500;white-space:nowrap">加仓:</span>' +
            '<input type="number" step="0.1" min="0" id="addpos-' + symbol + '" value="' + displayAddPos + '" placeholder="0%" style="width:48px;padding:2px 4px;border:1px solid #30363d;border-radius:3px;background:#0d1117;color:#38bdf8;font-size:11px;text-align:center" oninput="trackCoinAddPosInput(&apos;' + symbol + '&apos;, this.value)" onchange="saveCoinAddPosRatio(&apos;' + symbol + '&apos;, this.value)">' +
          '</div>' +
          '<button class="btn btn-pause-toggle" style="padding:3px 8px;font-size:11px;background:' + (c.pause_open ? '#238636' : '#8b5cf6') + ';color:#fff" onclick="event.stopPropagation();togglePauseOpen(&apos;' + symbol + '&apos;, ' + (!c.pause_open) + ')" title="' + (c.pause_open ? '点击恢复自动下单' : '点击暂停自动下单') + '">' + (c.pause_open ? '恢复下单' : '暂停下单') + '</button>' +
          '<button class="btn btn-timeout-toggle" style="padding:3px 8px;font-size:11px;background:' + (c.disable_timeout ? '#b45309' : '#f59e0b') + ';color:#fff;margin-left:2px" onclick="event.stopPropagation();toggleDisableTimeout(&apos;' + symbol + '&apos;, ' + (!c.disable_timeout) + ')" title="' + (c.disable_timeout ? '点击恢复超时平仓' : '点击免超时平仓(自动功能继续)') + '">' + (c.disable_timeout ? '恢超时' : '免超时') + '</button>' +
          '<button class="btn" style="padding:3px 8px;font-size:11px;background:#d97706;color:#fff" onclick="event.stopPropagation();retryCoin(&apos;' + symbol + '&apos;)" title="重置配置：重新配置交易参数，下一笔订单直接下单">重置</button>' +
          '<button class="btn btn-danger" style="padding:3px 8px;font-size:11px" onclick="event.stopPropagation();removeCoin(&apos;' + symbol + '&apos;)">X</button>' +
        '</div>';
    } else {
      const statusTag = cardEl.querySelector('.coin-status-tag');
      if (statusTag) {
        statusTag.style.background = nextStatus.bg;
        statusTag.style.color = nextStatus.color;
        statusTag.style.border = '1px solid ' + nextStatus.border;
        statusTag.textContent = nextStatus.text;
      }

      const coinToggleBtn = cardEl.querySelector('.btn-coin-toggle');
      if (coinToggleBtn) {
        coinToggleBtn.style.background = c.enabled ? '#da3633' : '#238636';
        coinToggleBtn.textContent = c.enabled ? '停止交易' : '开始交易';
        coinToggleBtn.onclick = (e) => { e.stopPropagation(); toggleCoin(symbol, !c.enabled); };
        coinToggleBtn.title = c.enabled ? '停止当前币种自动交易' : '启动当前币种自动交易';
      }

      const selBadge = cardEl.querySelector('.sel-badge');
      if (selBadge) selBadge.style.display = isSelected ? 'inline-block' : 'none';

      const dirEl = cardEl.querySelector('.coin-dir');
      if (dirEl) {
        dirEl.className = 'coin-dir ' + (c.direction || 'none');
        dirEl.textContent = c.direction === 'long' ? '做多' : c.direction === 'short' ? '做空' : '待判定';
      }

      const paramTag = cardEl.querySelector('.param-tag');
      if (paramTag) {
        paramTag.textContent = paramSummary;
      }

      const pauseTag = cardEl.querySelector('.pause-tag');
      if (pauseTag) {
        pauseTag.style.display = (c.enabled && c.pause_open) ? 'inline-block' : 'none';
      }

      const isSmartVol = Boolean(c.smart_volatility_enabled);
      const isVolPaused = isSmartVol && (c.volatility_status === 'paused' || (c.current_volatility !== undefined && c.current_volatility < (c.min_volatility_threshold || 1.0)));
      const volValStr = (c.current_volatility !== undefined && c.current_volatility !== null) ? (c.current_volatility + '%') : '-';
      const volThreshStr = (c.min_volatility_threshold !== undefined && c.min_volatility_threshold !== null) ? (c.min_volatility_threshold + '%') : '1.0%';
      const hasAddPos = Boolean(c.add_pos_ratio && c.add_pos_ratio > 0);

      const smartVolTag = cardEl.querySelector('.smart-vol-tag');
      if (smartVolTag) {
        smartVolTag.style.display = isSmartVol ? 'inline-block' : 'none';
        smartVolTag.style.background = isVolPaused ? 'rgba(217,119,6,0.2)' : 'rgba(59,130,246,0.2)';
        smartVolTag.style.color = isVolPaused ? '#fbbf24' : '#60a5fa';
        smartVolTag.style.border = isVolPaused ? '1px solid rgba(217,119,6,0.4)' : '1px solid rgba(59,130,246,0.4)';
        smartVolTag.textContent = isVolPaused ? ('⏸️ 智能暂停(' + volValStr + ')') : ('⚡ 智能下单(' + volValStr + ')');
        smartVolTag.title = '智能波动过滤: 临近2根K线波动 ' + volValStr + ' (阈值 ' + volThreshStr + ')';
      }

      const addPosTag = cardEl.querySelector('.add-pos-tag');
      if (addPosTag) {
        addPosTag.style.display = hasAddPos ? 'inline-block' : 'none';
        addPosTag.textContent = '📉 加仓: -' + (c.add_pos_ratio || 0) + '%';
        addPosTag.title = '加仓幅度：盈利自动加仓，亏损需达 -' + (c.add_pos_ratio || 0) + '% 后才允许加仓';
      }

      const timeoutTag = cardEl.querySelector('.timeout-tag');
      if (timeoutTag) {
        timeoutTag.style.display = c.disable_timeout ? 'inline-block' : 'none';
      }

      const amtInput = cardEl.querySelector('#amt-' + symbol);
      if (amtInput && activeEl !== amtInput && !tracker.amountDirty) {
        amtInput.value = displayAmt;
      }

      const calcDiv = cardEl.querySelector('#calc-' + symbol);
      if (calcDiv) calcDiv.innerHTML = calcHtml;

      const selInput = cardEl.querySelector('#sel-' + symbol);
      if (selInput && activeEl !== selInput && !tracker.periodDirty) {
        selInput.value = displayPeriod;
      }

      const addposInput = cardEl.querySelector('#addpos-' + symbol);
      if (addposInput && activeEl !== addposInput && !tracker.addPosDirty) {
        addposInput.value = displayAddPos;
      }

      const smartVolBtn = cardEl.querySelector('.btn-smart-vol');
      if (smartVolBtn) {
        smartVolBtn.style.background = isSmartVol ? '#2563eb' : '#374151';
        smartVolBtn.style.borderColor = isSmartVol ? '#3b82f6' : '#4b5563';
        smartVolBtn.textContent = isSmartVol ? '⚡ 智能下单:开' : '⚡ 智能下单:关';
        smartVolBtn.onclick = (e) => { e.stopPropagation(); toggleSmartVolatility(symbol, !isSmartVol); };
        smartVolBtn.title = isSmartVol ? '点击关闭智能下单波动过滤' : '点击开启智能下单波动过滤(临近2K线波动低于设定阈值自动暂停下单，高于恢复)';
      }

      const pauseBtn = cardEl.querySelector('.btn-pause-toggle');
      if (pauseBtn) {
        pauseBtn.style.background = c.pause_open ? '#238636' : '#8b5cf6';
        pauseBtn.textContent = c.pause_open ? '恢复下单' : '暂停下单';
        pauseBtn.onclick = (e) => { e.stopPropagation(); togglePauseOpen(symbol, !c.pause_open); };
      }

      const timeoutBtn = cardEl.querySelector('.btn-timeout-toggle');
      if (timeoutBtn) {
        timeoutBtn.style.background = c.disable_timeout ? '#b45309' : '#f59e0b';
        timeoutBtn.textContent = c.disable_timeout ? '恢超时' : '免超时';
        timeoutBtn.onclick = (e) => { e.stopPropagation(); toggleDisableTimeout(symbol, !c.disable_timeout); };
      }
    }
  });
}

function changePosPage(delta) {
  posCurrentPage += delta;
  renderPositions(currentPositions);
}

function gotoPosPage(page) {
  posCurrentPage = page;
  renderPositions(currentPositions);
}

function changePosPageSize(size) {
  posPageSize = parseInt(size, 10) || 30;
  posCurrentPage = 1;
  renderPositions(currentPositions);
}

function changeTradesPage(delta) {
  tradesCurrentPage += delta;
  renderTrades(currentTrades);
}

function gotoTradesPage(page) {
  tradesCurrentPage = page;
  renderTrades(currentTrades);
}

function changeTradesPageSize(size) {
  tradesPageSize = parseInt(size, 10) || 30;
  tradesCurrentPage = 1;
  renderTrades(currentTrades);
}

function renderPositions(positions) {
  const search = (document.getElementById('positionsSearch')?.value || '').toLowerCase();
  let rawPositions = positions || [];

  if (selectedSymbol) {
    const targetClean = selectedSymbol.replace('-USDT-SWAP', '').toLowerCase();
    rawPositions = rawPositions.filter(p => {
      const pClean = (p.symbol || '').replace('-USDT-SWAP', '').toLowerCase();
      return p.symbol === selectedSymbol || pClean === targetClean;
    });
  }

  if (search) {
    rawPositions = rawPositions.filter(p => p.symbol.toLowerCase().includes(search));
  }

  // 按 (symbol:direction) 进行 OKX 平台级聚合
  const aggMap = new Map();
  rawPositions.forEach(p => {
    const key = p.symbol + ':' + p.direction;
    if (!aggMap.has(key)) {
      aggMap.set(key, {
        symbol: p.symbol,
        direction: p.direction,
        leverage: p.leverage || 10,
        totalQuantity: 0,
        totalMargin: 0,
        weightedEntrySum: 0,
        unrealizedPnl: 0,
        lastPrice: p.last_price || 0,
        tpPrice: p.tp_price || 0,
        slPrice: p.sl_price || 0,
        firstOpenTime: p.open_time,
        lastOpenTime: p.open_time,
        orderCount: 0,
        positionIds: [],
      });
    }
    const agg = aggMap.get(key);
    const cleanSym = (p.symbol || '').replace('-USDT-SWAP', '').replace(/[\/\-_]/g, '').replace(/USDT$/, '');
    const coin = (allCoinsData || []).find(c => c.symbol === p.symbol || (c.symbol && (c.symbol.replace('-USDT-SWAP', '').replace(/[\/\-_]/g, '').replace(/USDT$/, '') === cleanSym)));
    const livePrice = (p.last_price && p.last_price > 0)
      ? p.last_price
      : ((coin && coin.last_price > 0) ? coin.last_price : (p.entry_price || 0));
    const effectiveLeverage = p.leverage || 10;
    const effectiveMargin = (p.margin && p.margin > 0)
      ? p.margin
      : ((p.quantity && p.entry_price && p.entry_price > 0) ? ((p.quantity * p.entry_price) / effectiveLeverage) : 0);

    let pnl = (p.unrealized_pnl !== undefined && p.unrealized_pnl !== null) ? p.unrealized_pnl : 0;
    if (livePrice > 0 && p.entry_price > 0 && effectiveMargin > 0) {
      const priceDiffRate = p.direction === 'long' ? (livePrice - p.entry_price) / p.entry_price : (p.entry_price - livePrice) / p.entry_price;
      pnl = effectiveMargin * priceDiffRate * effectiveLeverage;
    }
    agg.totalQuantity += (p.quantity || 0);
    agg.totalMargin += effectiveMargin;
    agg.weightedEntrySum += (p.entry_price || 0) * (p.quantity || 0);
    agg.unrealizedPnl += (pnl || 0);
    if (livePrice > 0) agg.lastPrice = livePrice;
    if (p.tp_price) agg.tpPrice = p.tp_price;
    if (p.sl_price) agg.slPrice = p.sl_price;
    if (p.open_time < agg.firstOpenTime) agg.firstOpenTime = p.open_time;
    if (p.open_time > agg.lastOpenTime) agg.lastOpenTime = p.open_time;
    agg.orderCount += 1;
    agg.positionIds.push(p.id);
  });

  const aggregatedList = Array.from(aggMap.values()).map(agg => {
    const avgEntryPrice = agg.totalQuantity > 0 ? (agg.weightedEntrySum / agg.totalQuantity) : 0;
    return {
      ...agg,
      avgEntryPrice: parseFloat(avgEntryPrice.toFixed(6)),
    };
  });

  const el = document.getElementById('positionsContent');
  const countEl = document.getElementById('positionsCount');
  const closeAllBtn = document.getElementById('btnCloseAll');
  
  const totalPnl = aggregatedList.reduce((sum, p) => sum + (p.unrealizedPnl || 0), 0);
  const totalPnlStr = \`\${totalPnl >= 0 ? '+' : ''}\${totalPnl.toFixed(2)} USDT\`;
  const totalPnlColor = totalPnl >= 0 ? '#3fb950' : '#f85149';
  
  const shortSym = selectedSymbol ? selectedSymbol.replace('-USDT-SWAP', '') : '';
  if (countEl) {
    if (selectedSymbol) {
      countEl.innerHTML = \`\${aggregatedList.length} 聚合仓位 (\${rawPositions.length}笔单) / 全部 \${positions.length}笔 <span style="font-size:11px;color:#58a6ff;background:rgba(88,166,255,0.15);padding:1px 6px;border-radius:4px;margin-left:4px">已按 \${shortSym} 筛选</span> <span style="font-weight:500;margin-left:8px;font-size:12px;color:\${totalPnlColor}">【\${shortSym}】未实现盈亏: \${totalPnlStr}</span>\`;
    } else {
      countEl.innerHTML = \`\${aggregatedList.length} 聚合仓位 (共\${rawPositions.length}笔订单) <span style="font-weight:500;margin-left:10px;font-size:12px;color:\${totalPnlColor}">全币种未实现总盈亏: \${totalPnlStr}</span>\`;
    }
  }

  if (closeAllBtn) {
    if (selectedSymbol) {
      closeAllBtn.textContent = \`一键平仓【\${shortSym}】\`;
      closeAllBtn.title = \`一键市价平掉当前选中的 \${shortSym} 全部活跃持仓\`;
    } else {
      closeAllBtn.textContent = '一键平仓';
      closeAllBtn.title = '一键市价平掉全部代币的所有活跃持仓';
    }
  }

  if (!aggregatedList.length) {
    el.innerHTML = \`<div class="empty-state">\${selectedSymbol ? \`暂无【\${shortSym}】活跃持仓\` : '暂无活跃持仓'}</div>\`;
    return;
  }

  const totalItems = aggregatedList.length;
  const pageSize = posPageSize === -1 ? totalItems : posPageSize;
  const totalPages = Math.max(1, Math.ceil(totalItems / pageSize));
  if (posCurrentPage > totalPages) posCurrentPage = totalPages;
  if (posCurrentPage < 1) posCurrentPage = 1;

  const startIdx = (posCurrentPage - 1) * pageSize;
  const endIdx = posPageSize === -1 ? totalItems : Math.min(startIdx + pageSize, totalItems);
  const pagedList = aggregatedList.slice(startIdx, endIdx);

  const paginationHtml = \`
    <div class="pagination-bar">
      <div class="pagination-info">
        显示 <strong>\${startIdx + 1} - \${endIdx}</strong> / 共 <strong>\${totalItems}</strong> 个聚合持仓 (\${rawPositions.length}笔订单)
      </div>
      <div class="pagination-controls">
        <button class="pagination-btn" onclick="gotoPosPage(1)" \${posCurrentPage === 1 ? 'disabled' : ''}>« 首页</button>
        <button class="pagination-btn" onclick="changePosPage(-1)" \${posCurrentPage === 1 ? 'disabled' : ''}>‹ 上一页</button>
        <span style="padding:0 6px;color:#c9d1d9;font-weight:500">第 \${posCurrentPage} / \${totalPages} 页</span>
        <button class="pagination-btn" onclick="changePosPage(1)" \${posCurrentPage >= totalPages ? 'disabled' : ''}>下一页 ›</button>
        <button class="pagination-btn" onclick="gotoPosPage(\${totalPages})" \${posCurrentPage >= totalPages ? 'disabled' : ''}>末页 »</button>
        <label style="margin-left:8px;font-size:11px;color:#8b949e">每页:
          <select class="pagination-select" onchange="changePosPageSize(this.value)">
            <option value="15" \${posPageSize === 15 ? 'selected' : ''}>15 条</option>
            <option value="30" \${posPageSize === 30 ? 'selected' : ''}>30 条</option>
            <option value="50" \${posPageSize === 50 ? 'selected' : ''}>50 条</option>
            <option value="100" \${posPageSize === 100 ? 'selected' : ''}>100 条</option>
            <option value="-1" \${posPageSize === -1 ? 'selected' : ''}>全部</option>
          </select>
        </label>
      </div>
    </div>
  \`;

  el.innerHTML = \`<table>
    <thead><tr><th>币种</th><th>方向</th><th>持仓总量(张)</th><th>开仓均价</th><th>最新价</th><th>杠杆</th><th>总保证金</th><th>聚合止盈</th><th>聚合止损</th><th>未实现盈亏 (收益率)</th><th>订单数</th><th>持仓时长</th><th>操作</th></tr></thead>
    <tbody>\${pagedList.map(p => {
      const elapsed = formatDuration(Date.now() - p.firstOpenTime);
      const pnlVal = p.unrealizedPnl || 0;
      const pnlClass = pnlVal >= 0 ? 'pnl-positive' : 'pnl-negative';
      const pnlPct = p.totalMargin > 0 ? (pnlVal / p.totalMargin * 100).toFixed(2) : '0.00';
      const notionalVal = (p.totalMargin * p.leverage).toFixed(2);
      const cleanCoin = p.symbol.replace('-USDT-SWAP', '');
      return \`<tr>
        <td><strong>\${cleanCoin}</strong></td>
        <td class="\${p.direction === 'long' ? 'pnl-positive' : 'pnl-negative'}">\${p.direction === 'long' ? '做多' : '做空'}</td>
        <td><strong>\${p.totalQuantity}</strong> <span style="font-size:11px;color:#8b949e">张</span></td>
        <td>\${p.avgEntryPrice}</td>
        <td>\${p.lastPrice || '-'}</td>
        <td>\${p.leverage}x</td>
        <td title="保证金: \${p.totalMargin.toFixed(2)} USDT | 名义价值: \${notionalVal} USDT">\${p.totalMargin > 0 ? \`\${p.totalMargin.toFixed(2)} <span style="font-size:11px;color:#8b949e">(\${notionalVal})</span>\` : '-'}</td>
        <td class="pnl-positive">\${p.tpPrice > 0 ? p.tpPrice : '-'}</td>
        <td class="pnl-negative">\${p.slPrice > 0 ? p.slPrice : '-'}</td>
        <td class="\${pnlClass}" style="font-weight:600">\${pnlVal >= 0 ? '+' : ''}\${pnlVal.toFixed(2)} (\${pnlVal >= 0 ? '+' : ''}\${pnlPct}%)</td>
        <td><span style="font-size:11px;background:rgba(110,118,129,0.2);padding:2px 6px;border-radius:4px">\${p.orderCount} 笔</span></td>
        <td>\${elapsed}</td>
        <td><button class="btn btn-danger" style="padding:3px 8px;font-size:11px" onclick="closeAggregatedPosition('\${p.symbol}', '\${p.direction}', this)">平仓</button></td>
      </tr>\`;
    }).join('')}</tbody></table>\${paginationHtml}\`;
}

function renderTrades(trades) {
  const search = (document.getElementById('tradesSearch')?.value || '').toLowerCase();
  let filtered = trades || [];

  if (selectedSymbol) {
    const targetClean = selectedSymbol.replace('-USDT-SWAP', '').toLowerCase();
    filtered = filtered.filter(t => {
      const tClean = (t.symbol || '').replace('-USDT-SWAP', '').toLowerCase();
      return t.symbol === selectedSymbol || tClean === targetClean;
    });
  }

  if (search) {
    filtered = filtered.filter(t => t.symbol.toLowerCase().includes(search));
  }

  const titleEl = document.getElementById('tradesTitle');
  const shortSym = selectedSymbol ? selectedSymbol.replace('-USDT-SWAP', '') : '';
  if (titleEl) {
    if (selectedSymbol) {
      titleEl.innerHTML = \`交易记录 <span style="font-size:11px;color:#58a6ff;background:rgba(88,166,255,0.15);padding:1px 6px;border-radius:4px;margin-left:4px;font-weight:normal">已按 \${shortSym} 筛选 (\${filtered.length}条)</span>\`;
    } else {
      titleEl.innerHTML = \`交易记录 <span style="font-size:11px;color:#8b949e;font-weight:normal">(\${filtered.length}条)</span>\`;
    }
  }

  const el = document.getElementById('tradesContent');
  if (!filtered.length) {
    el.innerHTML = \`<div class="empty-state">\${selectedSymbol ? \`暂无【\${shortSym}】历史交易记录\` : '暂无交易记录'}</div>\`;
    return;
  }

  const totalItems = filtered.length;
  const pageSize = tradesPageSize === -1 ? totalItems : tradesPageSize;
  const totalPages = Math.max(1, Math.ceil(totalItems / pageSize));
  if (tradesCurrentPage > totalPages) tradesCurrentPage = totalPages;
  if (tradesCurrentPage < 1) tradesCurrentPage = 1;

  const startIdx = (tradesCurrentPage - 1) * pageSize;
  const endIdx = tradesPageSize === -1 ? totalItems : Math.min(startIdx + pageSize, totalItems);
  const pagedList = filtered.slice(startIdx, endIdx);

  const paginationHtml = \`
    <div class="pagination-bar">
      <div class="pagination-info">
        显示 <strong>\${startIdx + 1} - \${endIdx}</strong> / 共 <strong>\${totalItems}</strong> 条历史记录
      </div>
      <div class="pagination-controls">
        <button class="pagination-btn" onclick="gotoTradesPage(1)" \${tradesCurrentPage === 1 ? 'disabled' : ''}>« 首页</button>
        <button class="pagination-btn" onclick="changeTradesPage(-1)" \${tradesCurrentPage === 1 ? 'disabled' : ''}>‹ 上一页</button>
        <span style="padding:0 6px;color:#c9d1d9;font-weight:500">第 \${tradesCurrentPage} / \${totalPages} 页</span>
        <button class="pagination-btn" onclick="changeTradesPage(1)" \${tradesCurrentPage >= totalPages ? 'disabled' : ''}>下一页 ›</button>
        <button class="pagination-btn" onclick="gotoTradesPage(\${totalPages})" \${tradesCurrentPage >= totalPages ? 'disabled' : ''}>末页 »</button>
        <label style="margin-left:8px;font-size:11px;color:#8b949e">每页:
          <select class="pagination-select" onchange="changeTradesPageSize(this.value)">
            <option value="15" \${tradesPageSize === 15 ? 'selected' : ''}>15 条</option>
            <option value="30" \${tradesPageSize === 30 ? 'selected' : ''}>30 条</option>
            <option value="50" \${tradesPageSize === 50 ? 'selected' : ''}>50 条</option>
            <option value="100" \${tradesPageSize === 100 ? 'selected' : ''}>100 条</option>
            <option value="-1" \${tradesPageSize === -1 ? 'selected' : ''}>全部</option>
          </select>
        </label>
      </div>
    </div>
  \`;

  el.innerHTML = \`<table>
    <thead><tr><th>时间</th><th>币种</th><th>方向</th><th>入场</th><th>出场</th><th>盈亏 (收益率)</th><th>平仓原因</th><th>划转</th></tr></thead>
    <tbody>\${pagedList.map(t => {
      const d = new Date(t.close_time);
      const timeStr = d.toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' });
      const pnlClass = t.pnl >= 0 ? 'pnl-positive' : 'pnl-negative';
      const reasonHtml = t.close_reason === 'tp' ? '<span class="pnl-positive" style="font-weight:600">止盈</span>' : t.close_reason === 'sl' ? '<span class="pnl-negative" style="font-weight:600">止损</span>' : t.close_reason === 'timeout' ? '超时' : '手动';
      return \`<tr>
        <td>\${timeStr}</td><td>\${t.symbol.replace('-USDT-SWAP', '')}</td>
        <td class="\${t.direction === 'long' ? 'pnl-positive' : 'pnl-negative'}">\${t.direction === 'long' ? '做多' : '做空'}</td>
        <td>\${t.entry_price}</td><td>\${t.exit_price}</td>
        <td class="\${pnlClass}" style="font-weight:600">\${t.pnl >= 0 ? '+' : ''}\${t.pnl.toFixed(2)} (\${t.pnl >= 0 ? '+' : ''}\${t.pnl_percent.toFixed(2)}%)</td>
        <td>\${reasonHtml}</td>
        <td>\${t.profit_transferred > 0 ? t.profit_transferred.toFixed(2) : '-'}</td>
      </tr>\`;
    }).join('')}</tbody></table>\${paginationHtml}\`;
}

function updateAutoScrollBtnUI() {
  const btn = document.getElementById('btnAutoScroll');
  if (!btn) return;
  if (autoScrollLogs) {
    btn.style.background = '#238636';
    btn.style.borderColor = '#2ea043';
    btn.style.color = '#ffffff';
    btn.textContent = '⬇️ 自动滚动: 开启';
    btn.title = '当前已开启自动滚动（新日志到达时自动滚至底部），点击暂停自动滚动以翻看历史';
  } else {
    btn.style.background = '#30363d';
    btn.style.borderColor = '#484f58';
    btn.style.color = '#e3b341';
    btn.textContent = '⏸️ 自动滚动: 已暂停';
    btn.title = '当前已暂停自动滚动（方便向上翻看历史日志），点击恢复自动滚动';
  }
}

function toggleAutoScroll() {
  autoScrollLogs = !autoScrollLogs;
  localStorage.setItem('okx_auto_scroll_logs', autoScrollLogs ? 'true' : 'false');
  updateAutoScrollBtnUI();
  if (autoScrollLogs) {
    scrollToBottomLogs();
  }
}

function scrollToBottomLogs() {
  const el = document.getElementById('logContainer');
  if (el) {
    el.scrollTop = el.scrollHeight;
  }
  const bottomBtn = document.getElementById('btnScrollBottom');
  if (bottomBtn) bottomBtn.style.display = 'none';
}

function handleLogScroll() {
  const el = document.getElementById('logContainer');
  const bottomBtn = document.getElementById('btnScrollBottom');
  if (!el || !bottomBtn) return;
  const isNearBottom = (el.scrollHeight - el.scrollTop - el.clientHeight) <= 35;
  if (isNearBottom) {
    bottomBtn.style.display = 'none';
  } else {
    bottomBtn.style.display = 'inline-block';
  }
}

function setLogTypeFilter(type) {
  logFilterType = type;
  const btnAll = document.getElementById('btnLogFilterAll');
  const btnErr = document.getElementById('btnLogFilterError');
  if (btnAll && btnErr) {
    if (type === 'error') {
      btnErr.style.background = 'rgba(248,81,73,0.2)';
      btnErr.style.color = '#f85149';
      btnErr.style.fontWeight = '600';
      btnAll.style.background = 'transparent';
      btnAll.style.color = '#8b949e';
      btnAll.style.fontWeight = 'normal';
    } else {
      btnAll.style.background = '#21262d';
      btnAll.style.color = '#58a6ff';
      btnAll.style.fontWeight = '600';
      btnErr.style.background = 'transparent';
      btnErr.style.color = '#8b949e';
      btnErr.style.fontWeight = 'normal';
    }
  }
  renderLogs(currentLogsData);
}

function renderLogs(logs) {
  if (Array.isArray(logs)) {
    currentLogsData = logs;
  }
  const el = document.getElementById('logContainer');
  if (!el) return;

  const search = (document.getElementById('logsSearch')?.value || '').toLowerCase();
  let filtered = currentLogsData || [];

  if (logFilterType === 'error') {
    filtered = filtered.filter(l => l.type === 'error' || l.type === 'warn' || (l.message || '').includes('失败') || (l.message || '').includes('异常') || (l.message || '').includes('Error'));
  }

  const shortSym = selectedSymbol ? selectedSymbol.replace('-USDT-SWAP', '') : '';
  if (selectedSymbol) {
    const targetFull = selectedSymbol.toLowerCase();
    const targetClean = shortSym.toLowerCase();
    filtered = filtered.filter(l => {
      const msg = (l.message || '').toLowerCase();
      // 包含当前币种，或者是全局关键心跳/异常/启动停止/巡检日志
      return msg.includes(targetFull) || msg.includes(targetClean) || msg.includes('[' + targetClean + ']') || msg.includes('【' + targetClean + '】') || l.type === 'error' || l.type === 'warn' || msg.includes('心跳') || msg.includes('巡检') || msg.includes('启动') || msg.includes('停止') || msg.includes('okx');
    });
  }

  if (search) {
    filtered = filtered.filter(l => (l.message || '').toLowerCase().includes(search) || (l.type || '').toLowerCase().includes(search));
  }

  const titleEl = document.getElementById('logsTitle');
  if (titleEl) {
    const typeLabel = logFilterType === 'error' ? '<span style="color:#f85149;font-weight:600">[最近7天报错]</span> ' : '';
    if (selectedSymbol) {
      titleEl.innerHTML = \`系统日志 \${typeLabel}<span style="font-size:11px;color:#58a6ff;background:rgba(88,166,255,0.15);padding:1px 6px;border-radius:4px;margin-left:4px;font-weight:normal">已按 \${shortSym} 筛选 (\${filtered.length}条)</span>\`;
    } else {
      titleEl.innerHTML = \`系统日志 \${typeLabel}<span style="font-size:11px;color:#8b949e;font-weight:normal">(\${filtered.length}条)</span>\`;
    }
  }

  const prevScrollTop = el.scrollTop;

  if (!filtered.length) {
    el.innerHTML = \`<div class="empty-state" style="padding:20px 0">\${logFilterType === 'error' ? (selectedSymbol ? \`最近一周暂无【\${shortSym}】相关的报错记录\` : '最近一周暂无任何报错记录（系统运行稳定）') : (selectedSymbol ? \`暂无【\${shortSym}】相关日志\` : '暂无系统日志')}</div>\`;
    return;
  }

  el.innerHTML = filtered.map(l => {
    const d = new Date(l.created_at);
    const dateStr = d.toLocaleDateString('zh-CN', { month: '2-digit', day: '2-digit' });
    const timeStr = d.toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
    return \`<div class="log-entry \${l.type}">[\${dateStr} \${timeStr}] \${l.message}</div>\`;
  }).join('');

  if (autoScrollLogs) {
    el.scrollTop = el.scrollHeight;
    const bottomBtn = document.getElementById('btnScrollBottom');
    if (bottomBtn) bottomBtn.style.display = 'none';
  } else {
    // 暂停滚动状态：严格保持用户当前视口滚动位置，翻看历史日志绝不被刷新冲掉！
    el.scrollTop = prevScrollTop;
    handleLogScroll();
  }
}

function formatDuration(ms) {
  const h = Math.floor(ms / 3600000);
  const m = Math.floor((ms % 3600000) / 60000);
  if (h > 0) return \`\${h}h\${m}m\`;
  return \`\${m}m\`;
}

async function saveTradeParams() {
  if (!selectedSymbol) {
    alert('请先选择一个代币，再保存其交易参数！');
    return;
  }
  
  const val = (id) => document.getElementById(id).value;
  
  const payload = {
    symbol: selectedSymbol,
    leverage: val('cfgLeverage') !== '' ? Number(val('cfgLeverage')) : undefined,
    tp_ratio: val('cfgTpRatio') !== '' ? Number(val('cfgTpRatio')) : undefined,
    sl_ratio: val('cfgSlRatio') !== '' ? Number(val('cfgSlRatio')) : undefined,
    timeout_value: val('cfgTimeoutValue') !== '' ? Number(val('cfgTimeoutValue')) : undefined,
    timeout_unit: val('cfgTimeoutUnit') || undefined,
    margin_mode: val('cfgMarginMode') || undefined,
    profit_transfer_ratio: val('cfgTransferRatio') !== '' ? Number(val('cfgTransferRatio')) : 0,
    open_interval_value: val('cfgIntervalValue') !== '' ? Number(val('cfgIntervalValue')) : undefined,
    open_interval_unit: val('cfgIntervalUnit') || undefined,
    smart_volatility_enabled: val('cfgSmartVolatility') === '1' ? 1 : 0,
    min_volatility_threshold: val('cfgMinVolatility') !== '' ? Number(val('cfgMinVolatility')) : 1.0,
    add_pos_ratio: val('cfgAddPosRatio') !== '' ? Number(val('cfgAddPosRatio')) : 0,
  };

  const res = await api('/api/coins', { method: 'POST', body: JSON.stringify(payload) });
  if (res.success) {
    clearDirty('cfgLeverage');
    clearDirty('cfgTpRatio');
    clearDirty('cfgSlRatio');
    clearDirty('cfgTimeoutValue');
    clearDirty('cfgTimeoutUnit');
    clearDirty('cfgMarginMode');
    clearDirty('cfgTransferRatio');
    clearDirty('cfgIntervalValue');
    clearDirty('cfgIntervalUnit');
    clearDirty('cfgSmartVolatility');
    clearDirty('cfgMinVolatility');
    clearDirty('cfgAddPosRatio');
    await loadAll();
  }
}

async function saveApiConfig() {
  const cfg = {
    okx_api_key: document.getElementById('cfgApiKey').value,
    okx_secret_key: document.getElementById('cfgSecretKey').value,
    okx_passphrase: document.getElementById('cfgPassphrase').value,
  };
  await api('/api/config', { method: 'POST', body: JSON.stringify(cfg) });
  clearDirty('cfgApiKey');
  clearDirty('cfgSecretKey');
  clearDirty('cfgPassphrase');
  await loadAll();
}

async function toggleSelectedCoinTrading() {
  if (!selectedSymbol) {
    alert('请先选择一个代币！');
    return;
  }
  const coin = allCoinsData.find(c => c.symbol === selectedSymbol);
  const nextEnabled = coin ? !coin.enabled : true;
  await toggleCoin(selectedSymbol, nextEnabled);
}

async function startAllCoins() {
  if (!allCoinsData || allCoinsData.length === 0) return;
  if (!confirm('确认启动所有代币的自动交易？')) return;
  for (const c of allCoinsData) {
    await api('/api/coins', { method: 'POST', body: JSON.stringify({ symbol: c.symbol, enabled: true }) });
  }
  await api('/api/start', { method: 'POST' });
  await loadAll();
}

async function stopAllCoins() {
  if (!allCoinsData || allCoinsData.length === 0) return;
  if (!confirm('确认停止所有代币的自动交易？')) return;
  for (const c of allCoinsData) {
    await api('/api/coins', { method: 'POST', body: JSON.stringify({ symbol: c.symbol, enabled: false }) });
  }
  await api('/api/stop', { method: 'POST' });
  await loadAll();
}

async function toggleGlobalTrading() {
  if (currentConfigData && currentConfigData.enabled) {
    await api('/api/stop', { method: 'POST' });
  } else {
    await api('/api/start', { method: 'POST' });
  }
  await loadAll();
}

async function startTrading() {
  await api('/api/start', { method: 'POST' });
  await loadAll();
}

async function stopTrading() {
  await api('/api/stop', { method: 'POST' });
  await loadAll();
}

async function toggleCoin(symbol, enabled) {
  if (enabled) {
    const coin = (allCoinsData || []).find(c => c.symbol === symbol);
    if (coin) {
      if (!coin.funding_amount || coin.funding_amount <= 0) {
        alert('【' + symbol.replace('-USDT-SWAP','') + '】尚未设置初始金额，请先输入初始金额并保存配置后再启动交易！');
        return;
      }
      if (!coin.leverage || coin.tp_ratio === null || coin.tp_ratio === undefined || coin.sl_ratio === null || coin.sl_ratio === undefined || !coin.timeout_value || !coin.open_interval_value) {
        alert('【' + symbol.replace('-USDT-SWAP','') + '】尚未配置完整的交易参数(杠杆/止盈/止损/持仓时间/下单间隔)，请先在上方配置并保存交易参数后再启动交易！');
        return;
      }
    }
  }
  const res = await api('/api/coins', { method: 'POST', body: JSON.stringify({ symbol, enabled }) });
  if (!res.success) {
    alert('操作失败: ' + (res.error || '未知错误'));
  }
  await loadAll();
}

async function togglePauseOpen(symbol, pause_open) {
  const res = await api('/api/coins', { method: 'POST', body: JSON.stringify({ symbol, pause_open }) });
  if (!res.success) { alert(res.error); return; }
  await loadAll();
}

async function toggleDisableTimeout(symbol, disable_timeout) {
  const res = await api('/api/coins', { method: 'POST', body: JSON.stringify({ symbol, disable_timeout }) });
  if (!res.success) { alert(res.error); return; }
  await loadAll();
}

async function toggleSmartVolatility(symbol, smart_volatility_enabled) {
  const res = await api('/api/coins', { method: 'POST', body: JSON.stringify({ symbol, smart_volatility_enabled }) });
  if (!res.success) { alert(res.error); return; }
  await loadAll();
}

async function toggleSelectedCoinSmartVol() {
  if (!selectedSymbol) return;
  const coin = (allCoinsData || []).find(c => c.symbol === selectedSymbol);
  if (!coin) return;
  const nextVal = !Boolean(coin.smart_volatility_enabled);
  await toggleSmartVolatility(selectedSymbol, nextVal);
}

async function triggerImmediateLoop(btn) {
  if (btn) {
    btn.disabled = true;
    btn.textContent = '巡检中...';
  }
  try {
    const res = await api('/api/trigger-loop', { method: 'POST' });
    if (res.success) {
      await loadAll();
    } else {
      alert('执行失败: ' + (res.error || '未知异常'));
    }
  } catch (e) {
    alert('请求异常: ' + String(e));
  } finally {
    if (btn) {
      btn.disabled = false;
      btn.textContent = '⚡ 立即运行';
    }
  }
}

async function saveCoinAmount(symbol) {
  return saveCoinConfig(symbol);
}

async function retryCoin(symbol) {
  const input = document.getElementById('amt-' + symbol);
  const val = input ? parseFloat(input.value) : undefined;
  const res = await api('/api/coins/retry', {
    method: 'POST',
    body: JSON.stringify({ symbol, funding_amount: !isNaN(val) && val > 0 ? val : undefined })
  });
  if (!res.success) { alert(res.error); return; }
  clearCoinAmountDirty(symbol);
  clearCoinPeriodDirty(symbol);
  await loadAll();
}

async function saveCoinPeriod(symbol) {
  return saveCoinConfig(symbol);
}

async function refreshCoinDir(symbol) {
  return saveCoinConfig(symbol);
}

async function addCoin() {
  const input = document.getElementById('newCoinInput');
  let symbol = input.value.trim().toUpperCase();
  if (!symbol) return;
  if (!symbol.includes('-')) {
    symbol = symbol + '-USDT-SWAP';
  }
  const res = await api('/api/coins', { method: 'PATCH', body: JSON.stringify({ symbol }) });
  if (!res.success) { alert(res.error); return; }
  input.value = '';
  selectedSymbol = symbol;
  await loadAll();
  fillParamsForSelected(true);
}

async function removeCoin(symbol) {
  if (!confirm(\`删除币种 \${symbol}？\`)) return;
  await api('/api/coins', { method: 'DELETE', body: JSON.stringify({ symbol }) });
  await loadAll();
}

async function syncOkxCoins(btn) {
  if (btn) {
    btn.disabled = true;
    btn.textContent = '同步中...';
  }
  try {
    const res = await api('/api/coins/sync-okx', { method: 'POST' });
    if (res.success) {
      const data = res.data || {};
      const added = data.added || [];
      const existing = data.existing || [];
      const total = data.total || 0;

      if (total === 0) {
        alert(res.message || 'OKX 交易所当前无活跃持仓合约');
      } else if (added.length > 0) {
        const addedNames = added.map(s => s.replace('-USDT-SWAP', '')).join(', ');
        const existNames = existing.length > 0 ? (\`\\n另外 \${existing.length} 个币种已在列表中: \` + existing.map(s => s.replace('-USDT-SWAP', '')).join(', ')) : '';
        alert(\`✅ 同步完成！\\n成功从 OKX 持仓导入 \${added.length} 个新币种: \${addedNames}\${existNames}\`);
        if (!selectedSymbol && added.length > 0) {
          selectedSymbol = added[0];
        }
      } else {
        const existNames = existing.map(s => s.replace('-USDT-SWAP', '')).join(', ');
        alert(\`ℹ️ OKX 当前持仓的 \${existing.length} 个币种均已存在于列表中:\\n\${existNames}\`);
      }
      await loadAll();
      if (selectedSymbol) {
        fillParamsForSelected(true);
      }
    } else {
      alert('同步OKX持仓币种失败: ' + (res.error || '未知错误'));
    }
  } catch (err) {
    alert('同步OKX持仓币种异常: ' + String(err));
  } finally {
    if (btn) {
      btn.disabled = false;
      btn.textContent = '🔄 同步币种';
    }
  }
}

async function syncPositions(btn) {
  if (btn) {
    btn.disabled = true;
    btn.textContent = '同步中...';
  }
  try {
    const res = await api('/api/positions/sync', { method: 'POST' });
    if (res.success) {
      currentPositions = res.data || [];
      renderPositions(currentPositions);
      await loadAll();
    } else {
      alert('对账同步失败: ' + (res.error || '未知错误'));
    }
  } catch (err) {
    alert('对账同步请求异常: ' + String(err));
  } finally {
    if (btn) {
      btn.disabled = false;
      btn.textContent = '🔄 对账同步OKX';
    }
  }
}

async function closeAggregatedPosition(symbol, direction, btn) {
  const cleanCoin = symbol.replace('-USDT-SWAP', '');
  const dirStr = direction === 'long' ? '做多' : '做空';
  if (!confirm(\`确认平掉【\${cleanCoin}】全部 \${dirStr} 持仓？\`)) return;
  if (btn) {
    btn.disabled = true;
    btn.textContent = '平仓中...';
  }
  try {
    const res = await api('/api/close-all', { method: 'POST', body: JSON.stringify({ symbols: [symbol] }) });
    if (!res.success) {
      alert('平仓失败: ' + (res.error || '未知错误'));
    }
  } catch (err) {
    alert('平仓请求异常: ' + String(err));
  }
  await loadAll();
}

async function closePosition(id, btn) {
  if (!confirm('确认手动平仓？')) return;
  if (btn) {
    btn.disabled = true;
    btn.textContent = '平仓中...';
  }
  try {
    const res = await api('/api/close-position', { method: 'POST', body: JSON.stringify({ position_id: id }) });
    if (!res.success) {
      alert('平仓失败: ' + (res.error || '未知错误'));
    }
  } catch (err) {
    alert('平仓请求异常: ' + String(err));
  }
  await loadAll();
}

async function closeAllPositions(btn) {
  const shortSym = selectedSymbol ? selectedSymbol.replace('-USDT-SWAP', '') : '';
  const countEl = document.getElementById('positionsCount');
  const count = parseInt(countEl?.textContent || '0', 10);
  
  const confirmMsg = selectedSymbol 
    ? \`确认一键平仓【\${shortSym}】的全部活跃持仓？\`
    : \`确认一键平仓全部 \${count > 0 ? count + ' 个' : ''}活跃持仓？\`;
  if (!confirm(confirmMsg)) return;
  
  const targetBtn = btn || (event && event.target);
  if (targetBtn && targetBtn.tagName === 'BUTTON') {
    targetBtn.disabled = true;
    targetBtn.textContent = '平仓中...';
  }
  try {
    const payload = selectedSymbol ? { symbols: [selectedSymbol] } : {};
    const res = await api('/api/close-all', { method: 'POST', body: JSON.stringify(payload) });
    if (!res.success) {
      alert('一键平仓失败: ' + (res.error || '未知错误'));
    }
  } catch (err) {
    alert('一键平仓异常: ' + String(err));
  }
  await loadAll();
}

async function clearTrades() {
  if (!confirm('确认清空全部交易记录？')) return;
  const res = await api('/api/trades', { method: 'DELETE' });
  if (res.success) {
    currentTrades = [];
    renderTrades(currentTrades);
    await loadTrades(false);
  } else {
    alert('清空交易记录失败: ' + (res.error || '未知异常'));
  }
}

async function clearLogs() {
  if (!confirm('确认清空系统日志？')) return;
  const res = await api('/api/logs', { method: 'DELETE' });
  if (res.success) {
    currentLogsData = [];
    renderLogs(currentLogsData);
    await loadLogs();
  } else {
    alert('清空系统日志失败: ' + (res.error || '未知异常'));
  }
}

// 检查授权并启动
checkAuth();
</script>
</body>
</html>
`;

export default DASHBOARD_HTML;
