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

.coin-grid-wrapper{max-height:560px;overflow-y:auto;overflow-x:auto;-webkit-overflow-scrolling:touch;border:1px solid #30363d;border-radius:8px;background:#0d1117;padding:6px;width:100%}
.coin-grid{display:flex;flex-direction:column;gap:5px;width:100%;min-width:1150px}
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

/* Mode Switcher & Batch Selection */
.mode-switch-bar{display:flex;align-items:center;background:#0d1117;border:1px solid #30363d;border-radius:6px;padding:2px;gap:2px}
.mode-switch-btn{padding:4px 10px;font-size:12px;color:#8b949e;border:none;background:transparent;border-radius:4px;cursor:pointer;font-weight:500;transition:all 0.15s ease}
.mode-switch-btn.active{background:#1f6feb;color:#fff;font-weight:600}
.batch-checkbox-wrap{display:flex;align-items:center;gap:6px;font-size:12px;color:#c9d1d9}
.coin-select-checkbox{width:16px;height:16px;cursor:pointer;accent-color:#1f6feb}

/* Smart Coins Panel & Table - Compact, Clean & Space-Saving */
.smart-panel-box{background:#161b22;border:1px solid #1f6feb;border-radius:6px;padding:10px 14px;margin-bottom:12px;box-shadow:0 4px 16px rgba(0,0,0,0.25)}
.smart-form-grid{display:flex;flex-wrap:wrap;align-items:flex-end;gap:6px 10px;margin-top:4px;margin-bottom:8px}
.smart-form-item{display:flex;flex-direction:column;gap:2px}
.smart-form-item label{font-size:11px;color:#8b949e;font-weight:500;white-space:nowrap;line-height:1.2}
.smart-form-item input,.smart-form-item select{height:25px;padding:2px 6px;border:1px solid #30363d;border-radius:4px;background:#0d1117;color:#c9d1d9;font-size:11px}
.smart-form-item input:focus,.smart-form-item select:focus{outline:none;border-color:#58a6ff}
.smart-table-wrap{max-height:340px;overflow-y:auto;border:1px solid #30363d;border-radius:6px;background:#0d1117}
.smart-table{width:100%;min-width:680px;border-collapse:collapse;font-size:12px}
.smart-table th{background:#161b22;padding:8px 10px;text-align:left;color:#8b949e;position:sticky;top:0;z-index:2;border-bottom:1px solid #30363d}
.smart-table td{padding:8px 10px;border-bottom:1px solid #21262d}
.smart-table tr:hover td{background:rgba(56,189,248,0.06)}

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
/* App Toast & Confirm Modal */
#appToastContainer{position:fixed;top:20px;right:20px;z-index:999999;display:flex;flex-direction:column;gap:10px;pointer-events:none}
.app-toast{padding:10px 16px;border-radius:8px;font-size:13px;font-weight:500;box-shadow:0 8px 24px rgba(0,0,0,0.6);display:flex;align-items:center;gap:8px;pointer-events:auto;animation:toastSlideIn .25s cubic-bezier(0.16,1,0.3,1) forwards;max-width:420px;line-height:1.45}
.app-toast.success{background:#1f6feb;color:#fff;border:1px solid #388bfd}
.app-toast.error{background:#b91c1c;color:#fff;border:1px solid #ef4444}
.app-toast.info{background:#161b22;color:#c9d1d9;border:1px solid #30363d}
@keyframes toastSlideIn{from{opacity:0;transform:translateY(-12px) scale(0.96)}to{opacity:1;transform:translateY(0) scale(1)}}

.coin-card{display:flex;align-items:center;justify-content:flex-start;gap:7px;padding:4px 10px;border:1px solid #21262d;border-radius:6px;background:#161b22;cursor:pointer;transition:all .15s ease;width:100%;min-height:38px;box-sizing:border-box;white-space:nowrap;text-align:left}
.coin-card:hover{border-color:#388bfd;background:rgba(56,139,253,0.04)}
.coin-card.selected{border-color:#58a6ff!important;box-shadow:0 0 0 2px rgba(88,166,255,0.25);background:rgba(56,139,253,0.08)!important}
.coin-card.enabled{border-color:#30363d}
.coin-card.paused{border-color:#6e40c9}
.coin-card-left{display:flex;align-items:center;gap:6px;flex-shrink:0;width:142px}
.coin-card-actions{display:flex;align-items:center;gap:5px;flex-shrink:0}
.coin-card .coin-name{font-weight:600;font-size:13px;color:#f0f6fc;display:inline-flex;align-items:center;min-width:65px}
.coin-card .coin-dir{font-size:11px;padding:2px 6px;border-radius:4px;font-weight:600;text-align:center;min-width:32px}
.coin-card .coin-dir.long{color:#3fb950;background:rgba(63,185,80,.12);border:1px solid rgba(63,185,80,.25)}
.coin-card .coin-dir.short{color:#f85149;background:rgba(248,81,73,.12);border:1px solid rgba(248,81,73,.25)}
.coin-card .coin-dir.none{color:#8b949e;background:rgba(139,148,158,.1);border:1px solid rgba(139,148,158,.2)}
.coin-ctrl-item{display:inline-flex;align-items:center;gap:4px;flex-shrink:0}
.coin-ctrl-amt{width:88px;flex-shrink:0}
.coin-ctrl-status{width:82px;flex-shrink:0;text-align:center}
.coin-ctrl-period{width:86px;flex-shrink:0}
.coin-ctrl-smart{width:130px;flex-shrink:0}
.coin-ctrl-addpos{width:90px;flex-shrink:0}
.coin-status-tag{display:inline-block;text-align:center;width:100%;font-size:10px;font-weight:600;padding:2px 4px;border-radius:4px;box-sizing:border-box}
.coin-card-vdiv{width:1px;height:14px;background:rgba(255,255,255,0.08);display:inline-block;margin:0 1px;flex-shrink:0}
.card-amt-input{width:46px;padding:2px 3px;font-size:11px;background:#0d1117;border:1px solid #30363d;border-radius:4px;color:#58a6ff;font-weight:600;text-align:center}
.card-amt-input:focus{border-color:#58a6ff;outline:none;background:#161b22}
.card-period-select{padding:2px 4px;font-size:11px;background:#0d1117;border:1px solid #30363d;border-radius:4px;color:#58a6ff;font-weight:600;cursor:pointer}
.card-period-select:hover{border-color:#58a6ff}
.card-addpos-input{width:38px;padding:2px 3px;font-size:11px;background:#0d1117;border:1px solid #30363d;border-radius:4px;color:#38bdf8;text-align:center}
.card-addpos-input:focus{border-color:#38bdf8;outline:none}
.btn-smart-toggle{padding:2px 6px;font-size:11px;border-radius:4px;font-weight:600;cursor:pointer;transition:all 0.15s ease}
.btn-smart-toggle.active{background:#2563eb;color:#fff;border:1px solid #3b82f6}
.btn-smart-toggle.inactive{background:#21262d;color:#8b949e;border:1px solid #30363d}
.btn-smart-toggle:hover{filter:brightness(1.15)}
.btn-coin-params{padding:2px 7px;font-size:11px;background:#1f6feb;border:1px solid #388bfd;color:#fff;border-radius:4px;cursor:pointer;font-weight:500;transition:all .15s ease}
.btn-coin-params:hover{background:#388bfd}
.modal-grid-2{display:grid;grid-template-columns:1fr 1fr;gap:12px}
.modal-form-group{margin-bottom:12px}
.modal-form-group label{display:block;font-size:12px;color:#8b949e;margin-bottom:5px}
.modal-form-group input,.modal-form-group select{width:100%;padding:6px 10px;background:#0d1117;border:1px solid #30363d;border-radius:6px;color:#f0f6fc;font-size:13px;box-sizing:border-box}
.modal-form-group input:focus,.modal-form-group select:focus{border-color:#58a6ff;outline:none}
</style>
</head>
<body>
<div class="header">
  <h1>OKX 合约自动交易系统</h1>
  <div class="header-actions">
    <span style="font-size:12px;color:#3fb950;background:rgba(63,185,80,0.1);padding:4px 10px;border-radius:12px;border:1px solid rgba(63,185,80,0.2)">🔒 密码保护启用</span>
    <button class="btn btn-save" style="font-size:12px;padding:5px 12px;background:#1f6feb;border:1px solid #388bfd;font-weight:600" onclick="manualRefreshAll(this)" title="手动刷新全局数据（配置、持仓、行情、日志等）">🔄 刷新全局数据</button>
    <button class="btn btn-outline" style="font-size:12px;padding:5px 12px" onclick="openChangePasswordModal()">修改密码</button>
    <button class="btn btn-danger" style="font-size:12px;padding:5px 12px;background:#b91c1c;border:1px solid #dc2626" onclick="openResetSystemModal()" title="彻底清空 D1 数据库中的持仓、交易记录、币种列表与日志数据">⚠️ 重置系统</button>
    <button class="btn btn-reset" style="font-size:12px;padding:5px 12px" onclick="logout()">退出登录</button>
  </div>
</div>

<div class="container">
  <div class="panel">
    <div class="top-ctrl-bar">
      <div class="top-ctrl-left">
        <div class="mode-switch-bar">
          <button class="mode-switch-btn active" id="btnModeSingle" onclick="switchParamMode('single')">当前单币设置</button>
          <button class="mode-switch-btn" id="btnModeBatch" onclick="switchParamMode('batch')">批量设置(已选币种)</button>
        </div>
        <button class="btn btn-save" id="btnSaveParams" onclick="handleSaveParamsClick()">保存参数</button>
        <div id="selectedCoinNotice"></div>
      </div>
      <div class="top-ctrl-center">
        <div class="status-dot stopped" id="selectedCoinStatusDot"></div>
        <span id="selectedCoinStatusText" style="font-size:13px;font-weight:600;color:#f0f6fc">代币状态</span>
        <button class="btn btn-start" id="btnToggleSelectedCoin" onclick="toggleSelectedCoinTrading()" style="padding:5px 14px;font-size:12px" disabled>开始交易</button>
        <button class="btn btn-smart-vol" id="btnToggleSmartVolSelected" onclick="toggleSelectedCoinSmartVol()" style="padding:5px 12px;font-size:12px;background:#2563eb;color:#fff;border:1px solid #3b82f6;display:none" title="开启/关闭当前选中代币的智能下单波动过滤">⚡ 智能下单: 开</button>
        <div style="width:1px;height:16px;background:#30363d;margin:0 4px"></div>
        <button class="btn btn-outline" id="btnStartAllCoins" style="font-size:11px;padding:4px 8px" onclick="startAllCoins(this)" title="一键启动所有代币交易">全部启动</button>
        <button class="btn btn-outline" id="btnStopAllCoins" style="font-size:11px;padding:4px 8px" onclick="stopAllCoins(this)" title="一键停止所有代币交易">全部停止</button>
        <button class="btn" style="font-size:11px;padding:4px 8px;background:#1f6feb;color:#fff" onclick="triggerImmediateLoop(this)" title="立即执行一轮完整巡检与开单">⚡ 立即运行</button>
      </div>
      <div class="top-ctrl-right">
        <button class="btn btn-save" onclick="saveApiConfig()">保存 API 配置</button>
      </div>
    </div>
    
    <!-- 批量模式控制提示条 (仅针对选中的币种) -->
    <div id="batchParamNoticeBar" style="display:none;background:rgba(31,111,235,0.12);border:1px solid rgba(56,189,248,0.3);border-radius:6px;padding:8px 12px;margin-bottom:12px;font-size:12px;color:#c9d1d9;align-items:center;justify-content:space-between;flex-wrap:wrap;gap:8px">
      <div style="display:flex;align-items:center;gap:14px;flex-wrap:wrap">
        <span style="color:#58a6ff;font-weight:600">批量设置生效范围:</span>
        <label style="display:flex;align-items:center;gap:4px;cursor:pointer">
          <input type="radio" name="batchScope" value="selected" checked onchange="updateBatchScopeUi()"> 仅选中的币种 (<span id="batchSelectedCount" style="color:#58a6ff;font-weight:600">0</span> 个)
        </label>
        <label style="display:flex;align-items:center;gap:4px;cursor:pointer">
          <input type="radio" name="batchScope" value="all" onchange="updateBatchScopeUi()"> 全部币种 (<span id="batchAllCount">0</span> 个)
        </label>
        <label style="display:flex;align-items:center;gap:4px;cursor:pointer;color:#38bdf8" title="保存参数时同时将这些参数设为全局默认模板，未来新加入代币将自动沿用此默认模板">
          <input type="checkbox" id="chkSaveAsGlobalDefault"> 设为全局默认模板
        </label>
      </div>
      <div style="display:flex;gap:6px">
        <button class="btn btn-outline" style="font-size:11px;padding:3px 8px" onclick="loadGlobalParamsToInputs()" title="载入系统全局默认参数模板到当前输入框">载入全局默认模板</button>
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
        <datalist id="dlFundingSlices">
          <option value="1"><option value="2"><option value="3"><option value="5">
          <option value="8"><option value="10"><option value="15"><option value="20"><option value="30">
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
          <label title="单币分配的初始交易本金(USDT)">初始资金 (USDT)</label>
          <input type="text" inputmode="decimal" id="cfgFundingAmount" placeholder="例: 100" oninput="markDirty(this.id)" onchange="markDirty(this.id)">
        </div>
        <div class="param-item">
          <label title="用于趋势判定的K线周期">K线判定周期</label>
          <select id="cfgPeriod" onchange="markDirty(this.id)">
            <option value="">保持原值/请选择</option>
            <option value="5m">5分钟</option>
            <option value="15m">15分钟</option>
            <option value="30m">30分钟</option>
            <option value="1h">1小时</option>
            <option value="2h">2小时</option>
            <option value="4h">4小时</option>
            <option value="6h">6小时</option>
            <option value="12h">12小时</option>
            <option value="1d">1日</option>
            <option value="2d">2日</option>
          </select>
        </div>
        <div class="param-item">
          <label>杠杆倍率</label>
          <input type="text" inputmode="decimal" id="cfgLeverage" list="dlLeverage" placeholder="请设置" oninput="markDirty(this.id)" onchange="markDirty(this.id)">
        </div>
        <div class="param-item">
          <label title="严格按全部仓位收益率(ROI%)触发止盈，例如10代表全仓收益率达+10%市价全平">止盈收益率 %</label>
          <input type="text" inputmode="decimal" id="cfgTpRatio" list="dlTpSl" placeholder="例: 10" oninput="markDirty(this.id)" onchange="markDirty(this.id)">
        </div>
        <div class="param-item">
          <label title="严格按全部仓位收益率(ROI%)触发止损，例如5代表全仓收益率达-5%市价全平">止损收益率 %</label>
          <input type="text" inputmode="decimal" id="cfgSlRatio" list="dlSl" placeholder="例: 5" oninput="markDirty(this.id)" onchange="markDirty(this.id)">
        </div>
        <div class="param-item">
          <label title="资金等分数：将单币初始金额划分的等份数，单笔开仓保证金 = 初始金额 / 等分数">资金等分数 (份)</label>
          <input type="text" inputmode="numeric" id="cfgFundingSlices" list="dlFundingSlices" placeholder="默认 10 份" oninput="markDirty(this.id)" onchange="markDirty(this.id)">
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
          <label title="开启智能下单后，上两根完整K线最高最低波动幅度低于设定阈值%时自动暂停下单，高于此值恢复下单">智能下单 (波动过滤)</label>
          <select id="cfgSmartVolatility" onchange="markDirty(this.id)">
            <option value="0">关闭 (常规下单)</option>
            <option value="1">开启 (低波动暂停)</option>
          </select>
        </div>
        <div class="param-item">
          <label title="开启智能下单时，若上两根完整K线最高最低波动幅度低于此阈值%则自动暂停下单，高于此值恢复下单">波动阈值 % (智能)</label>
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
            <span style="background:rgba(110,118,129,0.15);padding:2px 8px;border-radius:4px;border:1px solid #30363d">总数: <strong id="coinCountTotal" style="color:#58a6ff">0</strong></span>
            <span style="background:rgba(63,185,80,0.1);padding:2px 8px;border-radius:4px;border:1px solid rgba(63,185,80,0.2)">运行中: <strong id="coinCountRunning" style="color:#3fb950">0</strong></span>
            <span style="background:rgba(248,81,73,0.1);padding:2px 8px;border-radius:4px;border:1px solid rgba(248,81,73,0.2)">已停止: <strong id="coinCountStopped" style="color:#f85149">0</strong></span>
            <span style="background:rgba(139,92,246,0.1);padding:2px 8px;border-radius:4px;border:1px solid rgba(139,92,246,0.2)">暂停下单: <strong id="coinCountPaused" style="color:#a371f7">0</strong></span>
          </div>
          <div class="batch-checkbox-wrap" style="margin-left:6px;display:flex;align-items:center;gap:6px;padding:3px 8px;background:#0d1117;border:1px solid #30363d;border-radius:6px;flex-wrap:wrap">
            <label style="display:flex;align-items:center;gap:4px;cursor:pointer;font-size:11px;user-select:none">
              <input type="checkbox" id="chkSelectAllCoins" class="coin-select-checkbox" onchange="toggleSelectAllCoins(this.checked)" title="全选 / 取消全选所有币种进行批量参数配置与批量删除"> 全选
            </label>
            <span id="lblBatchSelected" style="font-size:11px;color:#58a6ff;font-weight:600">已选 0</span>
            <button class="btn btn-save" id="btnBatchApplyParams" style="padding:2px 8px;font-size:11px;background:#1f6feb;border:1px solid #388bfd;font-weight:500" onclick="applyParamsToBatchSelected()" title="将上方填写的交易参数批量应用并保存到当前已勾选的代币">批量应用参数(<span class="batch-sel-num">0</span>)</button>
            <button class="btn btn-danger" id="btnBatchDeleteCoins" style="padding:2px 8px;font-size:11px;background:#da3633;border:1px solid #f85149;font-weight:500" onclick="batchDeleteSelectedCoins()" title="批量删除当前已勾选的所有代币">批量删除(<span class="batch-sel-num">0</span>)</button>
            <button class="btn btn-outline" id="btnClearBatchSel" style="padding:2px 6px;font-size:11px;display:none;color:#8b949e" onclick="clearAllBatchSelection()" title="清空所有已勾选的币种">清空</button>
          </div>
        </div>
      </div>
      <div class="coin-header-actions">
        <input type="text" id="newCoinInput" placeholder="输入代币如 BTC (支持直接回车添加)" onkeydown="if(event.key==='Enter')addCoin()">
        <div class="coin-btn-group">
          <button class="btn btn-deselect-main" id="btnDeselectCoin" onclick="deselectCoin()" title="取消币种选择，恢复全局视图显示所有币种" style="display:none">取消选择</button>
          <button class="btn btn-save" style="background:#238636;border:1px solid #2ea043" onclick="addCoin()">添加币种</button>
          <button class="btn btn-save" id="btnRefreshCoins" style="background:#1f6feb;border:1px solid #388bfd;font-weight:600" onclick="manualRefreshCoins(this)" title="立即刷新币种列表与最新行情价格">刷新行情</button>
          <button class="btn btn-save" style="background:#6e40c9;border:1px solid #8957e5;font-weight:600" onclick="syncOkxCoins(this)" title="从 OKX 交易所同步当前实际持仓的合约币种到列表中，方便重新部署后快速恢复">同步币种</button>
          <button class="btn btn-save" id="btnToggleSmartPanel" style="background:#0969da;border:1px solid #218bff;font-weight:600" onclick="toggleSmartCoinsPanel()" title="根据账户总资金百分比与10倍杠杆等分数，在线极速筛选OKX优质币种并一键导入">优选币种参数</button>
        </div>
      </div>
    </div>

    <!-- 优选币种在线筛选与自定义定时自动导入面板 -->
    <div id="smartCoinsPanel" class="smart-panel-box" style="display:none">
      <div style="display:flex;align-items:center;justify-content:space-between;border-bottom:1px solid #30363d;padding-bottom:6px;margin-bottom:8px;flex-wrap:wrap;gap:6px">
        <div style="display:flex;align-items:center;gap:6px">
          <span style="font-size:13px;font-weight:600;color:#58a6ff">⭐ 优选币种策略与定时自动导入</span>
          <span style="font-size:10px;color:#8b949e;background:rgba(110,118,129,0.15);padding:1px 6px;border-radius:6px;border:1px solid #30363d">按杠杆测算 · 可开张数 ≥ 等分数 · 无人值守自动建仓</span>
        </div>
        <button class="btn btn-outline" style="font-size:11px;padding:2px 8px;height:24px" onclick="toggleSmartCoinsPanel()">✕ 收起面板</button>
      </div>

      <!-- 第一部分：优选币种交易运行参数（导入时代币继承） -->
      <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:2px">
        <span style="font-size:11px;font-weight:600;color:#7ee787">📊 1. 优选币种交易策略与仓位参数 (导入继承)</span>
      </div>
      <div class="smart-form-grid">
        <div class="smart-form-item">
          <label title="根据当前交易账户总资金的百分比(%)计算导入币种的初始金额">资金占比 %</label>
          <input type="number" id="smartBalancePercent" min="0.1" max="100" step="0.5" value="10" oninput="updateSmartCalcPreview()" placeholder="10" style="width:60px">
        </div>
        <div class="smart-form-item">
          <label title="导入币种必须满足可开合约张数大于或等于该等分数">等分数(份)</label>
          <input type="number" id="smartFundingSlices" min="1" max="100" step="1" value="10" oninput="updateSmartCalcPreview()" placeholder="10" style="width:56px">
        </div>
        <div class="smart-form-item">
          <label title="参考总资金（实盘未配置或需模拟测算，可直接手动修改）">参考总资金 (USDT)</label>
          <div style="display:flex;gap:3px;align-items:center">
            <input type="number" id="smartManualBalance" min="1" step="1" value="100" oninput="updateSmartCalcPreview()" placeholder="100" style="width:68px">
            <button type="button" class="btn btn-outline" style="font-size:10px;padding:1px 5px;height:25px;white-space:nowrap;background:#21262d;border:1px solid #30363d;color:#58a6ff" onclick="syncLiveBalanceToSmartInput(this)" title="一键同步 OKX 实盘交易账户净资产">🔄 同步实盘</button>
          </div>
        </div>
        <div class="smart-form-item">
          <label title="导入时代币应用的杠杆倍率">杠杆倍率</label>
          <input type="number" id="smartLeverage" min="1" max="125" value="10" oninput="updateSmartCalcPreview()" placeholder="10" style="width:52px">
        </div>
        <div class="smart-form-item">
          <label title="开仓保证金模式：逐仓或全仓">开仓模式</label>
          <select id="smartMarginMode" style="width:68px">
            <option value="isolated" selected>逐仓</option>
            <option value="cross">全仓</option>
          </select>
        </div>
        <div class="smart-form-item">
          <label title="判定多空方向的K线周期">判定周期</label>
          <select id="smartPeriod" style="width:62px">
            <option value="5m">5分</option>
            <option value="15m">15分</option>
            <option value="30m">30分</option>
            <option value="1h" selected>1小时</option>
            <option value="2h">2小时</option>
            <option value="4h">4小时</option>
            <option value="1d">1日</option>
            <option value="1w">1周</option>
          </select>
        </div>
        <div class="smart-form-item">
          <label>下单间隔</label>
          <div style="display:flex;gap:2px">
            <input type="number" id="smartIntervalValue" value="1" min="1" style="width:34px">
            <select id="smartIntervalUnit" style="width:46px">
              <option value="minute">分</option>
              <option value="hour" selected>时</option>
              <option value="day">日</option>
            </select>
          </div>
        </div>
        <div class="smart-form-item">
          <label title="全仓止盈收益率(%)">止盈收益率%</label>
          <input type="number" id="smartTpRatio" value="10" step="0.5" placeholder="10" style="width:48px">
        </div>
        <div class="smart-form-item">
          <label title="全仓止损收益率(%)">止损收益率%</label>
          <input type="number" id="smartSlRatio" value="5" step="0.5" placeholder="5" style="width:48px">
        </div>
        <div class="smart-form-item">
          <label title="智能下单(波动过滤)：当K线波动率低于阈值时暂缓开仓">波动过滤</label>
          <select id="smartSmartVolatility" style="width:72px">
            <option value="1">⚡ 开启</option>
            <option value="0" selected>关闭</option>
          </select>
        </div>
        <div class="smart-form-item">
          <label title="波动过滤阈值百分比">波动阈值 %</label>
          <input type="number" id="smartMinVolatility" value="1.0" step="0.1" min="0.1" placeholder="1.0" style="width:52px">
        </div>
        <div class="smart-form-item">
          <label title="亏损加仓幅度 %，0为不限">补仓幅度 %</label>
          <input type="number" id="smartAddPosRatio" value="0" step="0.5" min="0" placeholder="0" style="width:54px">
        </div>
        <div class="smart-form-item">
          <label title="止盈平仓后自动划转利润比例 %">利润划转 %</label>
          <input type="number" id="smartProfitTransferRatio" value="0" step="5" min="0" max="100" placeholder="0" style="width:54px">
        </div>
      </div>

      <!-- 测算结果指示栏 (简洁条) -->
      <div style="display:flex;align-items:center;justify-content:space-between;background:#0d1117;border:1px solid #30363d;border-radius:4px;padding:4px 10px;margin-bottom:8px;flex-wrap:wrap;gap:6px">
        <div style="font-size:11px;color:#c9d1d9" id="smartCalcSummary">
          单币初始: <strong id="smartPreviewInitAmt" style="color:#3fb950">10.00 USDT</strong>
          <span style="color:#8b949e;margin:0 4px">|</span>
          名义本金: <strong id="smartPreviewNominal" style="color:#58a6ff">100.00 USDT</strong>
          <span style="color:#8b949e;margin:0 4px">|</span>
          要求张数: <strong id="smartPreviewReqSlices" style="color:#f59e0b">≥ 10 张</strong>
        </div>
        <button class="btn btn-save" id="btnRunSmartFilter" style="background:#1f6feb;border:1px solid #388bfd;padding:2px 12px;font-size:11px;height:25px" onclick="runSmartCoinsFilter(this)">🔍 在线筛选优选币种</button>
      </div>

      <!-- 第二部分：自定义定时自动导入调度 (扁平紧凑) -->
      <div style="background:#0d1117;border:1px solid rgba(35,134,54,0.4);border-radius:4px;padding:6px 10px;margin-bottom:8px">
        <div style="display:flex;align-items:center;justify-content:space-between;flex-wrap:wrap;gap:8px">
          <div style="display:flex;align-items:center;gap:8px;flex-wrap:wrap">
            <span style="font-size:11px;font-weight:600;color:#3fb950">⏰ 2. 定时自动导入调度</span>
            <span id="smartScheduleStatusBadge" style="font-size:10px;padding:1px 6px;border-radius:6px;background:rgba(255,255,255,0.06);color:#8b949e">⚪ 定时未开启</span>
            <label style="display:flex;align-items:center;gap:4px;font-size:11px;color:#c9d1d9;cursor:pointer;font-weight:600">
              <input type="checkbox" id="smartAutoImportEnabled" style="width:14px;height:14px;cursor:pointer">
              开启定时
            </label>
            <div style="display:flex;align-items:center;gap:3px">
              <span style="font-size:11px;color:#8b949e">周期:</span>
              <input type="number" id="smartAutoImportIntervalVal" min="1" step="1" value="4" style="width:42px;height:24px;padding:1px 4px;border:1px solid #30363d;background:#161b22;color:#c9d1d9;border-radius:4px;font-size:11px">
              <select id="smartAutoImportIntervalUnit" style="height:24px;padding:1px 4px;border:1px solid #30363d;background:#161b22;color:#c9d1d9;border-radius:4px;font-size:11px">
                <option value="hour">时</option>
                <option value="day">日</option>
                <option value="week">周</option>
                <option value="month">月</option>
              </select>
            </div>
            <div style="display:flex;align-items:center;gap:3px">
              <span style="font-size:11px;color:#8b949e">资金源:</span>
              <select id="smartAutoImportBalanceMode" style="height:24px;padding:1px 6px;border:1px solid #30363d;background:#161b22;color:#c9d1d9;border-radius:4px;font-size:11px">
                <option value="live" selected>实时实盘净资产</option>
                <option value="manual">参考资金基数</option>
              </select>
            </div>
            <label style="display:flex;align-items:center;gap:4px;font-size:11px;color:#3fb950;cursor:pointer" title="导入后立即自动启动交易，无需人工参与">
              <input type="checkbox" id="smartAutoStart" checked style="width:14px;height:14px;cursor:pointer">
              ⚡ 自动启动交易
            </label>
          </div>
          <div style="display:flex;align-items:center;gap:6px">
            <button class="btn btn-save" style="background:#238636;border:1px solid #2ea043;font-size:11px;padding:2px 10px;height:25px" onclick="saveSmartConfig(this)">💾 保存配置</button>
            <button class="btn btn-outline" style="font-size:11px;padding:2px 8px;border-color:#58a6ff;color:#58a6ff;height:25px" onclick="runSmartAutoImportNow(this)" title="立即在后台按当前规则执行一次优选筛选与导入">⚡ 立即执行</button>
          </div>
        </div>
        <div style="display:flex;align-items:center;justify-content:space-between;font-size:10px;color:#8b949e;margin-top:4px;padding-top:4px;border-top:1px solid rgba(48,54,61,0.3)">
          <span>上次自动导入: <strong id="smartLastRunText" style="color:#c9d1d9">未执行</strong> | 下次预计执行: <strong id="smartNextRunText" style="color:#58a6ff">未计划</strong></span>
          <span style="color:#7ee787">符合规则的新币种将自动纳入调度并执行建仓</span>
        </div>
      </div>

      <!-- 筛选结果展示区 -->
      <div id="smartFilterResultsBox" style="display:none">
        <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:8px;font-size:12px;flex-wrap:wrap;gap:8px">
          <div>
            符合优选条件的币种: <strong id="smartEligibleCount" style="color:#3fb950">0</strong> 个
            <span style="color:#8b949e;margin-left:8px">(已勾选 <strong id="smartCheckedCount" style="color:#58a6ff">0</strong> 个)</span>
          </div>
          <div style="display:flex;gap:8px">
            <button class="btn btn-outline" style="font-size:11px;padding:2px 8px" onclick="toggleSmartResultSelectAll(true)">全选全部</button>
            <button class="btn btn-outline" style="font-size:11px;padding:2px 8px" onclick="toggleSmartResultSelectAll(false)">取消全选</button>
            <button class="btn btn-save" id="btnImportSelectedSmart" style="background:#238636;border:1px solid #2ea043;font-size:12px;padding:4px 14px;font-weight:600" onclick="importSelectedSmartCoins(this)">📥 确认一键导入所选币种</button>
          </div>
        </div>
        <div class="smart-table-wrap">
          <table class="smart-table">
            <thead>
              <tr>
                <th style="width:36px;text-align:center"><input type="checkbox" id="chkSmartHeader" onchange="toggleSmartResultSelectAll(this.checked)"></th>
                <th>代币合约</th>
                <th>最新价 (USDT)</th>
                <th>合约面值 (ctVal)</th>
                <th id="thSmartNominalTitle">名义本金 (USDT)</th>
                <th>可开张数 / 等分数</th>
                <th>当前状态</th>
              </tr>
            </thead>
            <tbody id="smartTableBody"></tbody>
          </table>
        </div>
      </div>
    </div>
    <div class="coin-list-toolbar" style="display:flex;align-items:center;justify-content:space-between;margin:10px 0 8px 0;font-size:12px;color:#8b949e;flex-wrap:wrap;gap:8px">
      <div style="display:flex;align-items:center;gap:8px">
        <input type="text" id="coinSearchInput" placeholder="🔍 快速搜索币种..." oninput="onCoinSearchInput(this.value)" style="padding:4px 8px;border:1px solid #30363d;border-radius:4px;background:#0d1117;color:#c9d1d9;font-size:12px;width:150px">
        <span id="coinFilterInfo" style="color:#58a6ff;font-size:11px"></span>
      </div>
      <div style="display:flex;align-items:center;gap:10px;flex-wrap:wrap">
        <span id="coinPaginationInfo" style="color:#8b949e">显示 0 / 共 0 条</span>
        <label style="display:inline-flex;align-items:center;gap:4px">
          <span>每页:</span>
          <select id="selCoinPageSize" onchange="changeCoinPageSize(this.value)" style="padding:2px 6px;font-size:11px;background:#0d1117;border:1px solid #30363d;border-radius:4px;color:#c9d1d9">
            <option value="20">20 条</option>
            <option value="50" selected>50 条 (默认)</option>
            <option value="100">100 条</option>
            <option value="all">显示全部</option>
          </select>
        </label>
        <div class="pagination-btns" style="display:inline-flex;align-items:center;gap:4px">
          <button class="btn btn-outline" id="btnCoinPrevPage" style="padding:2px 8px;font-size:11px" onclick="changeCoinPage(-1)">‹ 上一页</button>
          <span id="coinPageNumber" style="color:#c9d1d9;font-weight:600;padding:0 4px">1 / 1</span>
          <button class="btn btn-outline" id="btnCoinNextPage" style="padding:2px 8px;font-size:11px" onclick="changeCoinPage(1)">下一页 ›</button>
        </div>
      </div>
    </div>
    <div class="coin-grid-wrapper" id="coinGridWrapper">
      <div class="coin-grid" id="coinGrid"></div>
    </div>
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
        <button class="btn btn-save" style="font-size:12px;padding:4px 10px;background:#1f6feb;border:1px solid #388bfd" onclick="manualRefreshLogs(this)" title="手动拉取最新系统日志">🔄 刷新日志</button>
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

<!-- App Universal Confirm Modal (Safe in sandboxes & iframes) -->
<div id="appConfirmModal" style="display:none;position:fixed;top:0;left:0;right:0;bottom:0;background:rgba(0,0,0,0.75);z-index:999999;align-items:center;justify-content:center;padding:16px;backdrop-filter:blur(2px)">
  <div style="background:#161b22;border:1px solid #30363d;border-radius:10px;max-width:540px;width:100%;max-height:85vh;display:flex;flex-direction:column;padding:20px 24px;box-shadow:0 16px 48px rgba(0,0,0,0.8);box-sizing:border-box">
    <div id="appConfirmTitle" style="font-size:16px;font-weight:600;color:#f0f6fc;margin-bottom:12px;display:flex;align-items:center;gap:8px;flex-shrink:0">确认操作</div>
    <div id="appConfirmMessage" style="font-size:13px;color:#c9d1d9;line-height:1.6;margin-bottom:16px;overflow-y:auto;flex:1;max-height:60vh;padding-right:4px"></div>
    <div style="display:flex;justify-content:flex-end;gap:10px;flex-shrink:0;padding-top:12px;border-top:1px solid #21262d">
      <button class="btn btn-outline" id="appConfirmBtnCancel" onclick="closeAppConfirm(false)">取消</button>
      <button class="btn btn-save" id="appConfirmBtnOk" onclick="closeAppConfirm(true)">确定</button>
    </div>
  </div>
</div>

<!-- 币种自定义参数设置弹窗 -->
<div id="coinParamsModal" class="modal-overlay" style="display:none">
  <div class="modal-box" style="max-width:540px;width:100%;max-height:90vh;overflow-y:auto">
    <div class="modal-title">
      <span id="modalParamTitle">币种参数设置</span>
    </div>
    <div class="modal-subtitle" id="modalParamSubtitle">自定义此代币专属的独立交易与风控参数</div>

    <input type="hidden" id="modalParamSymbol" value="">

    <div class="modal-grid-2">
      <div class="modal-form-group">
        <label>初始资金 (USDT)</label>
        <input type="number" step="any" id="mCfgFundingAmount" placeholder="例: 100">
      </div>
      <div class="modal-form-group">
        <label>K线周期</label>
        <select id="mCfgPeriod">
          <option value="5m">5m</option>
          <option value="15m">15m</option>
          <option value="30m">30m</option>
          <option value="1h">1h</option>
          <option value="2h">2h</option>
          <option value="4h">4h</option>
          <option value="6h">6h</option>
          <option value="12h">12h</option>
          <option value="1d">1d</option>
          <option value="2d">2d</option>
        </select>
      </div>
      <div class="modal-form-group">
        <label>杠杆倍数 (x)</label>
        <input type="number" id="mCfgLeverage" placeholder="例: 10">
      </div>
      <div class="modal-form-group">
        <label>仓位模式</label>
        <select id="mCfgMarginMode">
          <option value="isolated">逐仓</option>
          <option value="cross">全仓</option>
        </select>
      </div>
      <div class="modal-form-group">
        <label>止盈比例 (%)</label>
        <input type="number" step="any" id="mCfgTpRatio" placeholder="例: 5">
      </div>
      <div class="modal-form-group">
        <label>止损比例 (%)</label>
        <input type="number" step="any" id="mCfgSlRatio" placeholder="例: 5">
      </div>
      <div class="modal-form-group">
        <label>等分份数</label>
        <input type="number" id="mCfgFundingSlices" placeholder="默认 10 份">
      </div>
      <div class="modal-form-group">
        <label>加仓亏损幅度 (%)</label>
        <input type="number" step="any" id="mCfgAddPosRatio" placeholder="0为不限">
      </div>
      <div class="modal-form-group">
        <label>开单间隔数值</label>
        <input type="number" id="mCfgIntervalValue" placeholder="例: 1">
      </div>
      <div class="modal-form-group">
        <label>开单间隔单位</label>
        <select id="mCfgIntervalUnit">
          <option value="hour">小时</option>
          <option value="minute">分钟</option>
          <option value="second">秒</option>
          <option value="day">天</option>
        </select>
      </div>
      <div class="modal-form-group">
        <label>智能波动过滤</label>
        <select id="mCfgSmartVolatility">
          <option value="0">关闭</option>
          <option value="1">开启</option>
        </select>
      </div>
      <div class="modal-form-group">
        <label>最低波动率阈值 (%)</label>
        <input type="number" step="any" id="mCfgMinVolatility" placeholder="例: 1.0">
      </div>
      <div class="modal-form-group" style="grid-column: span 2">
        <label>盈利划转资金账户比例 (%)</label>
        <input type="number" step="any" id="mCfgTransferRatio" placeholder="0为不划转">
      </div>
    </div>

    <div class="modal-actions" style="margin-top:20px;display:flex;justify-content:flex-end;gap:10px">
      <button class="btn btn-outline" onclick="closeCoinSettingsModal()">取消</button>
      <button class="btn btn-save" id="btnSaveModalParams" onclick="submitModalCoinParams()">保存参数</button>
    </div>
  </div>
</div>

<!-- App Floating Toast Container -->
<div id="appToastContainer"></div>

<script>
// --- UI Toast & Custom Modal Components (Sandbox / iframe safe) ---
let currentConfirmResolve = null;

function showAppConfirm(title, message, isDanger = false, okText = '确定', isHtml = false) {
  return new Promise((resolve) => {
    currentConfirmResolve = resolve;
    const modal = document.getElementById('appConfirmModal');
    const titleEl = document.getElementById('appConfirmTitle');
    const msgEl = document.getElementById('appConfirmMessage');
    const okBtn = document.getElementById('appConfirmBtnOk');
    if (titleEl) titleEl.innerHTML = title;
    if (msgEl) {
      if (isHtml || (typeof message === 'string' && (message.trim().startsWith('<') || message.includes('<div') || message.includes('<span')))) {
        msgEl.innerHTML = message;
        msgEl.style.whiteSpace = 'normal';
      } else {
        msgEl.textContent = message;
        msgEl.style.whiteSpace = 'pre-wrap';
      }
    }
    if (okBtn) {
      okBtn.textContent = okText;
      okBtn.className = isDanger ? 'btn btn-danger' : 'btn btn-save';
      okBtn.style.background = isDanger ? '#da3633' : '#1f6feb';
      okBtn.style.border = isDanger ? '1px solid #f85149' : '1px solid #388bfd';
    }
    if (modal) modal.style.display = 'flex';
  });
}

function closeAppConfirm(result) {
  const modal = document.getElementById('appConfirmModal');
  if (modal) modal.style.display = 'none';
  if (currentConfirmResolve) {
    currentConfirmResolve(Boolean(result));
    currentConfirmResolve = null;
  }
}

function showAppToast(message, type = 'info', duration = 3500) {
  const container = document.getElementById('appToastContainer');
  if (!container) return;
  const toast = document.createElement('div');
  toast.className = 'app-toast ' + (type || 'info');
  const icon = type === 'success' ? '✅ ' : (type === 'error' ? '❌ ' : 'ℹ️ ');
  toast.textContent = icon + message;
  container.appendChild(toast);
  setTimeout(() => {
    toast.style.opacity = '0';
    toast.style.transform = 'translateY(-12px) scale(0.96)';
    toast.style.transition = 'all 0.25s cubic-bezier(0.16, 1, 0.3, 1)';
    setTimeout(() => {
      if (toast.parentNode) toast.parentNode.removeChild(toast);
    }, 280);
  }, duration);
}

// 统一安全拦截全局原生 alert，防止 iframe 沙箱静默阻断
window.alert = function(msg) {
  showAppToast(String(msg), 'info');
};

// 前端轮询更新机制已彻底移除，采用操作执行时即时更新与手动按需刷新（0 后台轮询请求，最大化保护 Cloudflare D1 读配额）
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

// 币种列表分页与搜索状态（优化默认显示50条并支持上下滑动预览）
let coinPageSize = 50;
let coinCurrentPage = 1;
let coinSearchQuery = '';

function onCoinSearchInput(val) {
  coinSearchQuery = (val || '').trim().toLowerCase();
  coinCurrentPage = 1;
  renderCoins(allCoinsData);
}

function changeCoinPageSize(size) {
  coinPageSize = size === 'all' ? 'all' : (parseInt(size, 10) || 50);
  coinCurrentPage = 1;
  renderCoins(allCoinsData);
}

function changeCoinPage(delta) {
  coinCurrentPage += delta;
  renderCoins(allCoinsData);
}

// 全局/批量参数管理与优选币种状态
let currentParamMode = 'single'; // 'single' | 'batch'
const batchSelectedSymbols = new Set(); // 批量勾选的币种集合
let cachedGlobalParams = null; // 缓存的全局默认参数模板
let smartFilterResults = []; // 优选币种筛选缓存

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
  if (coin && coin.funding_slices && coin.funding_slices > 0) {
    return Math.floor(coin.funding_slices);
  }
  return 10;
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

async function handleCardPeriodChange(symbol, newPeriod) {
  const shortName = symbol.replace('-USDT-SWAP', '');
  trackCoinPeriodChange(symbol, newPeriod);
  try {
    showAppToast('正在更新【' + shortName + '】周期为 ' + newPeriod + ' 并研判方向...', 'info');
    const res = await api('/api/coins', { method: 'POST', body: JSON.stringify({ symbol, period: newPeriod }) });
    if (!res || !res.success) {
      showAppToast('更新周期失败: ' + (res && res.error ? res.error : '未知错误'), 'error');
      return;
    }
    clearCoinPeriodDirty(symbol);
    showAppToast('【' + shortName + '】判定周期已更新为 ' + newPeriod + '，方向已研判', 'success');
    await loadAll();
  } catch (err) {
    showAppToast('更新周期网络异常: ' + String(err), 'error');
  }
}

async function triggerCoinDirection(symbol) {
  const shortName = symbol.replace('-USDT-SWAP', '');
  const selEl = document.getElementById('sel-' + symbol);
  const coin = (allCoinsData || []).find(c => c.symbol === symbol);
  const period = selEl ? selEl.value : (coin ? (coin.period || '1h') : '1h');
  try {
    showAppToast('正在重新研判【' + shortName + '】(' + period + ')方向...', 'info');
    const res = await api('/api/coins', { method: 'POST', body: JSON.stringify({ symbol, period }) });
    if (!res || !res.success) {
      showAppToast('研判方向失败: ' + (res && res.error ? res.error : '未知错误'), 'error');
      return;
    }
    await loadAll();
    const updated = (allCoinsData || []).find(c => c.symbol === symbol);
    const dirText = updated && updated.direction === 'long' ? '做多' : updated && updated.direction === 'short' ? '做空' : '待判定';
    showAppToast('【' + shortName + '】' + period + ' 方向研判结果: ' + dirText, 'success');
  } catch (err) {
    showAppToast('研判方向网络异常: ' + String(err), 'error');
  }
}

async function saveCoinAddPos(symbol, rawVal) {
  const shortName = symbol.replace('-USDT-SWAP', '');
  const coin = (allCoinsData || []).find(c => c.symbol === symbol);
  const currentVal = coin ? (coin.add_pos_ratio || 0) : 0;
  const val = (rawVal === '' || rawVal === null || rawVal === undefined) ? 0 : parseFloat(rawVal);
  if (isNaN(val) || val < 0) {
    showAppToast('加仓幅度请输入大于等于0的有效数值', 'error');
    return;
  }
  if (coin && Math.abs(currentVal - val) < 0.0001 && (!coinInputs[symbol] || !coinInputs[symbol].addPosDirty)) {
    return;
  }
  try {
    const res = await api('/api/coins', { method: 'POST', body: JSON.stringify({ symbol, add_pos_ratio: val }) });
    if (!res || !res.success) {
      showAppToast('保存加仓幅度失败: ' + (res && res.error ? res.error : '未知错误'), 'error');
      return;
    }
    clearCoinAddPosDirty(symbol);
    showAppToast('【' + shortName + '】加仓幅度已自动保存: ' + (val > 0 ? ('-' + val + '%') : '0 (不限)'), 'success');
    await loadAll();
  } catch (err) {
    showAppToast('保存加仓幅度网络异常: ' + String(err), 'error');
  }
}

async function saveCoinInitialAmount(symbol, rawVal) {
  const shortName = symbol.replace('-USDT-SWAP', '');
  const coin = (allCoinsData || []).find(c => c.symbol === symbol);
  const currentVal = coin ? (coin.funding_amount || 0) : 0;
  const val = (rawVal === '' || rawVal === null || rawVal === undefined) ? 0 : parseFloat(rawVal);
  if (isNaN(val) || val < 0) {
    showAppToast('初始金额请输入大于等于0的有效数值', 'error');
    return;
  }
  if (coin && Math.abs(currentVal - val) < 0.0001 && (!coinInputs[symbol] || !coinInputs[symbol].amountDirty)) {
    return;
  }
  try {
    const res = await api('/api/coins', { method: 'POST', body: JSON.stringify({ symbol, funding_amount: val }) });
    if (!res || !res.success) {
      showAppToast('保存初始金额失败: ' + (res && res.error ? res.error : '未知错误'), 'error');
      return;
    }
    clearCoinAmountDirty(symbol);
    showAppToast('【' + shortName + '】初始金额已自动保存: ' + (val > 0 ? (val + ' USDT') : '未设定'), 'success');
    await loadAll();
  } catch (err) {
    showAppToast('保存初始金额网络异常: ' + String(err), 'error');
  }
}

function clearAllParamDirty() {
  const ids = [
    'cfgFundingAmount', 'cfgPeriod',
    'cfgLeverage', 'cfgTpRatio', 'cfgSlRatio',
    'cfgFundingSlices', 'cfgMarginMode',
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
    // 点击币种卡片时自动切换到当前单币设置模式，确保即刻载入该币种全部独立参数并准备好保存单币
    if (currentParamMode !== 'single') {
      switchParamMode('single');
    }
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

function switchParamMode(mode) {
  currentParamMode = mode;
  const btnSingle = document.getElementById('btnModeSingle');
  const btnBatch = document.getElementById('btnModeBatch');
  const noticeBar = document.getElementById('batchParamNoticeBar');
  const btnSave = document.getElementById('btnSaveParams');

  if (mode === 'batch') {
    if (btnSingle) btnSingle.className = 'mode-switch-btn';
    if (btnBatch) btnBatch.className = 'mode-switch-btn active';
    if (noticeBar) noticeBar.style.display = 'flex';
    if (btnSave) {
      btnSave.textContent = '⚡ 批量应用参数';
      btnSave.style.background = '#1f6feb';
      btnSave.style.border = '1px solid #388bfd';
    }
    const amtEl = document.getElementById('cfgFundingAmount');
    if (amtEl) amtEl.placeholder = "选填 (留空保持各币原资金)";
    const periodEl = document.getElementById('cfgPeriod');
    if (periodEl && periodEl.options.length > 0) periodEl.options[0].text = "选填 (留空保持各币原周期)";
    updateBatchScopeUi();
    // 启用所有参数输入框
    document.querySelectorAll('.param-item input, .param-item select').forEach(el => {
      if (el.id !== 'cfgApiKey' && el.id !== 'cfgSecretKey' && el.id !== 'cfgPassphrase') {
        el.disabled = false;
        el.style.opacity = '1';
      }
    });
    // 若当前输入框为空，尝试从服务端拉取全局默认模板
    if (!cachedGlobalParams) {
      loadGlobalParamsToInputs();
    }
  } else {
    if (btnSingle) btnSingle.className = 'mode-switch-btn active';
    if (btnBatch) btnBatch.className = 'mode-switch-btn';
    if (noticeBar) noticeBar.style.display = 'none';
    const amtEl = document.getElementById('cfgFundingAmount');
    if (amtEl) amtEl.placeholder = "例: 100";
    const periodEl = document.getElementById('cfgPeriod');
    if (periodEl && periodEl.options.length > 0) periodEl.options[0].text = "保持原值/请选择";
    fillParamsForSelected(true);
  }
}

function updateBatchScopeUi() {
  const allCountEl = document.getElementById('batchAllCount');
  const selCountEl = document.getElementById('batchSelectedCount');
  const lblBatchSel = document.getElementById('lblBatchSelected');
  const chkAll = document.getElementById('chkSelectAllCoins');
  const clearBtn = document.getElementById('btnClearBatchSel');

  const total = allCoinsData ? allCoinsData.length : 0;
  const selectedCount = batchSelectedSymbols.size;

  if (allCountEl) allCountEl.textContent = String(total);
  if (selCountEl) selCountEl.textContent = String(selectedCount);
  if (lblBatchSel) lblBatchSel.textContent = '已勾选 ' + selectedCount;
  
  document.querySelectorAll('.batch-sel-num').forEach(el => {
    el.textContent = String(selectedCount);
  });

  if (chkAll) {
    chkAll.checked = (total > 0 && selectedCount === total);
    chkAll.indeterminate = (selectedCount > 0 && selectedCount < total);
  }

  if (clearBtn) {
    clearBtn.style.display = selectedCount > 0 ? 'inline-block' : 'none';
  }

  // 自动将批量生效范围切换为“仅勾选的币种”
  if (selectedCount > 0) {
    const selScopeRadio = document.querySelector('input[name="batchScope"][value="selected"]');
    if (selScopeRadio) selScopeRadio.checked = true;
  }

  // 同步联动顶部主保存按钮状态
  const btnSave = document.getElementById('btnSaveParams');
  const noticeEl = document.getElementById('selectedCoinNotice');
  if (btnSave) {
    if (selectedCount > 0) {
      btnSave.textContent = '⚡ 批量应用参数到已勾选 (' + selectedCount + '个)';
      btnSave.style.background = '#1f6feb';
      btnSave.style.borderColor = '#388bfd';
      btnSave.disabled = false;
      // 启用输入框供用户配置待应用的参数
      document.querySelectorAll('.param-item input, .param-item select').forEach(el => {
        if (el.id !== 'cfgApiKey' && el.id !== 'cfgSecretKey' && el.id !== 'cfgPassphrase') {
          el.disabled = false;
          el.style.opacity = '1';
        }
      });
      if (noticeEl && (!selectedSymbol || currentParamMode === 'batch')) {
        noticeEl.innerHTML = '<span style="color:#58a6ff;font-size:12px;background:rgba(88,166,255,0.15);padding:3px 8px;border-radius:6px;">已勾选 ' + selectedCount + ' 个代币，设置参数后点击“保存参数”或列表栏“批量应用”即可生效</span>';
      }
    } else if (currentParamMode === 'single') {
      if (selectedSymbol) {
        const coin = (allCoinsData || []).find(c => c.symbol === selectedSymbol);
        const shortName = (coin ? coin.symbol : selectedSymbol).replace('-USDT-SWAP', '');
        btnSave.textContent = '💾 保存【' + shortName + '】单币参数';
        btnSave.style.background = '#238636';
        btnSave.style.borderColor = '#2ea043';
        btnSave.disabled = false;
      } else {
        btnSave.textContent = '保存单币参数 (请先选择币种)';
        btnSave.style.background = '#30363d';
        btnSave.style.borderColor = '#484f58';
        if (noticeEl) {
          noticeEl.innerHTML = '';
        }
      }
    } else if (currentParamMode === 'batch') {
      btnSave.textContent = '⚡ 批量应用参数(全部代币)';
      btnSave.style.background = '#1f6feb';
      btnSave.style.borderColor = '#388bfd';
      btnSave.disabled = false;
    }
  }
}

function clearAllBatchSelection() {
  batchSelectedSymbols.clear();
  document.querySelectorAll('.batch-coin-chk').forEach(chk => {
    chk.checked = false;
  });
  updateBatchScopeUi();
}

function toggleSelectAllCoins(checked) {
  if (!allCoinsData) return;
  if (checked) {
    allCoinsData.forEach(c => batchSelectedSymbols.add(c.symbol));
  } else {
    batchSelectedSymbols.clear();
  }
  document.querySelectorAll('.batch-coin-chk').forEach(chk => {
    chk.checked = checked;
  });
  updateBatchScopeUi();
}

function toggleCoinBatchCheck(symbol, checked, event) {
  if (event) event.stopPropagation();
  if (checked) {
    batchSelectedSymbols.add(symbol);
  } else {
    batchSelectedSymbols.delete(symbol);
  }
  updateBatchScopeUi();
}

async function loadGlobalParamsToInputs() {
  try {
    const res = await api('/api/coins/global-params');
    if (res && res.success && res.data) {
      cachedGlobalParams = res.data;
      const d = res.data;
      setSafeInputValue('cfgLeverage', d.leverage || 10, true);
      setSafeInputValue('cfgTpRatio', d.tp_ratio || 5, true);
      setSafeInputValue('cfgSlRatio', d.sl_ratio || 5, true);
      setSafeInputValue('cfgFundingSlices', d.funding_slices || 10, true);
      setSafeInputValue('cfgMarginMode', d.margin_mode || 'isolated', true);
      setSafeInputValue('cfgTransferRatio', d.profit_transfer_ratio || 0, true);
      setSafeInputValue('cfgIntervalValue', d.open_interval_value || 1, true);
      setSafeInputValue('cfgIntervalUnit', d.open_interval_unit || 'hour', true);
      setSafeInputValue('cfgSmartVolatility', d.smart_volatility_enabled ? '1' : '0', true);
      setSafeInputValue('cfgMinVolatility', d.min_volatility_threshold || 1.0, true);
      setSafeInputValue('cfgAddPosRatio', d.add_pos_ratio || 0, true);
    }
  } catch (e) {
    console.error('loadGlobalParamsToInputs err:', e);
  }
}

function fillParamsForSelected(force = false) {
  if (currentParamMode === 'batch') {
    // 处于批量模式下，不覆盖用户正在输入的批量参数
    return;
  }

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
      noticeEl.innerHTML = '';
    }

    if (dotEl) {
      dotEl.className = 'status-dot ' + (coin.enabled ? 'running' : 'stopped');
    }
    if (statusTextEl) {
      statusTextEl.innerHTML = '【' + coinShortName + '】<span style="color:' + (coin.enabled ? '#3fb950' : '#f85149') + '">' + (coin.enabled ? '🟢 运行中' : '🔴 已停止') + '</span>';
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
    const slicesVal = (coin.funding_slices !== undefined && coin.funding_slices !== null && coin.funding_slices > 0) ? coin.funding_slices : 10;
    const marginMode = coin.margin_mode || '';
    const transRatio = (coin.profit_transfer_ratio !== undefined && coin.profit_transfer_ratio !== null) ? coin.profit_transfer_ratio : '';
    const addPosRatio = (coin.add_pos_ratio !== undefined && coin.add_pos_ratio !== null) ? coin.add_pos_ratio : '';
    const tracker = coinInputs[coin.symbol] || {};
    const amtVal = (tracker.amountDirty && tracker.amount !== undefined) ? tracker.amount : ((coin.funding_amount !== undefined && coin.funding_amount !== null && coin.funding_amount > 0) ? coin.funding_amount : '');
    const periodVal = (tracker.periodDirty && tracker.period) ? tracker.period : (coin.period || '1h');

    if (force) {
      clearDirty('cfgFundingAmount');
      clearDirty('cfgPeriod');
      clearDirty('cfgLeverage');
      clearDirty('cfgIntervalValue');
      clearDirty('cfgIntervalUnit');
      clearDirty('cfgTpRatio');
      clearDirty('cfgSlRatio');
      clearDirty('cfgFundingSlices');
      clearDirty('cfgMarginMode');
      clearDirty('cfgTransferRatio');
      clearDirty('cfgSmartVolatility');
      clearDirty('cfgMinVolatility');
      clearDirty('cfgAddPosRatio');
    }
    
    setSafeInputValue('cfgFundingAmount', amtVal, force);
    setSafeInputValue('cfgPeriod', periodVal, force);
    setSafeInputValue('cfgLeverage', lev, force);
    setSafeInputValue('cfgIntervalValue', intVal, force);
    setSafeInputValue('cfgIntervalUnit', intUnit, force);
    setSafeInputValue('cfgTpRatio', tpRatio, force);
    setSafeInputValue('cfgSlRatio', slRatio, force);
    setSafeInputValue('cfgFundingSlices', slicesVal, force);
    setSafeInputValue('cfgMarginMode', marginMode, force);
    setSafeInputValue('cfgTransferRatio', transRatio, force);
    setSafeInputValue('cfgSmartVolatility', isSmartVol ? '1' : '0', force);
    setSafeInputValue('cfgMinVolatility', minVol, force);
    setSafeInputValue('cfgAddPosRatio', addPosRatio, force);

    const btnSave = document.getElementById('btnSaveParams');
    if (btnSave && currentParamMode === 'single') {
      btnSave.textContent = '💾 保存【' + coinShortName + '】单币参数';
      btnSave.style.background = '#238636';
      btnSave.style.border = '1px solid #2ea043';
      btnSave.disabled = false;
    }

    document.getElementById('cfgFundingAmount').placeholder = "例: 100";
    document.getElementById('cfgLeverage').placeholder = "例: 10";
    document.getElementById('cfgIntervalValue').placeholder = "例: 1";
    document.getElementById('cfgFundingSlices').placeholder = "默认 10 份";
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
      noticeEl.innerHTML = '';
    }
    if (dotEl) dotEl.className = 'status-dot stopped';
    if (statusTextEl) statusTextEl.textContent = '未选择币种';
    if (btnToggleEl) {
      btnToggleEl.disabled = true;
      btnToggleEl.className = 'btn btn-start';
      btnToggleEl.textContent = '开始交易';
    }

    const btnSave = document.getElementById('btnSaveParams');
    if (btnSave && currentParamMode === 'single') {
      btnSave.textContent = '保存单币参数 (请先选择币种)';
      btnSave.style.background = '#30363d';
      btnSave.style.border = '1px solid #484f58';
    }
    
    if (force) {
      clearDirty('cfgFundingAmount');
      clearDirty('cfgPeriod');
      clearDirty('cfgLeverage');
      clearDirty('cfgIntervalValue');
      clearDirty('cfgIntervalUnit');
      clearDirty('cfgTpRatio');
      clearDirty('cfgSlRatio');
      clearDirty('cfgFundingSlices');
      clearDirty('cfgMarginMode');
      clearDirty('cfgTransferRatio');
      clearDirty('cfgSmartVolatility');
      clearDirty('cfgMinVolatility');
      clearDirty('cfgAddPosRatio');
    }

    setSafeInputValue('cfgFundingAmount', '', force);
    setSafeInputValue('cfgPeriod', '', force);
    setSafeInputValue('cfgLeverage', '', force);
    setSafeInputValue('cfgIntervalValue', '', force);
    setSafeInputValue('cfgIntervalUnit', '', force);
    setSafeInputValue('cfgTpRatio', '', force);
    setSafeInputValue('cfgSlRatio', '', force);
    setSafeInputValue('cfgFundingSlices', '', force);
    setSafeInputValue('cfgMarginMode', '', force);
    setSafeInputValue('cfgTransferRatio', '', force);
    setSafeInputValue('cfgSmartVolatility', '0', force);
    setSafeInputValue('cfgMinVolatility', '', force);
    setSafeInputValue('cfgAddPosRatio', '', force);
    
    document.getElementById('cfgFundingAmount').placeholder = "-";
    document.getElementById('cfgLeverage').placeholder = "-";
    document.getElementById('cfgIntervalValue').placeholder = "-";
    document.getElementById('cfgFundingSlices').placeholder = "-";
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
  // 前端轮询机制已彻底移除：初始化时加载一次，后续在执行各项交易/操作时自动增量更新，亦可随时手动点击刷新按钮
}

async function manualRefreshAll(btn = null) {
  if (btn) {
    btn.disabled = true;
    btn.textContent = '⏳ 刷新中...';
  }
  try {
    await Promise.all([loadConfig(), loadAll()]);
    showAppToast('全局数据已刷新', 'success');
  } catch (err) {
    showAppToast('刷新异常: ' + String(err), 'error');
  } finally {
    if (btn) {
      btn.disabled = false;
      btn.textContent = '🔄 刷新全局数据';
    }
  }
}

async function manualRefreshLogs(btn = null) {
  if (btn) {
    btn.disabled = true;
    btn.textContent = '⏳ 刷新中...';
  }
  try {
    await loadLogs();
  } finally {
    if (btn) {
      btn.disabled = false;
      btn.textContent = '🔄 刷新日志';
    }
  }
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
  await Promise.all([loadCoinsAndStatus(), loadPositions(), loadLogs(), loadTrades(false), loadSmartConfig()]);
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

async function changeCoinPeriod(symbol, period) {
  if (!period) return;
  const shortName = symbol.replace('-USDT-SWAP', '');
  showAppToast('正在切换【' + shortName + '】周期为 ' + period + ' 并重新计算方向...', 'info');
  try {
    const res = await api('/api/coins', { method: 'POST', body: JSON.stringify({ symbol, period }) });
    if (!res || !res.success) {
      showAppToast('切换周期失败: ' + (res && res.error ? res.error : '未知错误'), 'error');
      return;
    }
    showAppToast('【' + shortName + '】周期已切换为 ' + period + '，方向已重新计算', 'success');
    await loadAll();
  } catch (err) {
    showAppToast('切换周期网络异常: ' + String(err), 'error');
  }
}

async function changeCoinAddPosRatio(symbol, val) {
  const num = parseFloat(val);
  const ratio = (!isNaN(num) && num >= 0) ? num : 0;
  const shortName = symbol.replace('-USDT-SWAP', '');
  try {
    const res = await api('/api/coins', { method: 'POST', body: JSON.stringify({ symbol, add_pos_ratio: ratio }) });
    if (!res || !res.success) {
      showAppToast('设置加仓幅度失败: ' + (res && res.error ? res.error : '未知错误'), 'error');
      return;
    }
    showAppToast('【' + shortName + '】加仓幅度已更新为: -' + ratio + '%', 'success');
    await loadAll();
  } catch (err) {
    showAppToast('设置加仓幅度网络异常: ' + String(err), 'error');
  }
}

async function saveCoinAddPosRatio(symbol, val) {
  return changeCoinAddPosRatio(symbol, val);
}

function getCoinNextOpenStatus(c) {
  if (!c.enabled) {
    return { text: '已停止', color: '#f85149', bg: 'rgba(248,81,73,0.15)', border: 'rgba(248,81,73,0.3)' };
  }
  if (c.pause_open) {
    return { text: '已暂停下单', color: '#8b5cf6', bg: 'rgba(139,92,246,0.15)', border: 'rgba(139,92,246,0.3)' };
  }
  if (c.smart_volatility_enabled && (c.volatility_status === 'paused' || (c.current_volatility !== undefined && c.current_volatility < (c.min_volatility_threshold || 1.0)))) {
    return { text: '低波暂停', color: '#fbbf24', bg: 'rgba(217,119,6,0.2)', border: 'rgba(217,119,6,0.4)' };
  }
  if (!c.direction) {
    return { text: '待判定方向', color: '#58a6ff', bg: 'rgba(88,166,255,0.15)', border: 'rgba(88,166,255,0.3)' };
  }
  if (!c.open_interval_value || !c.open_interval_unit) {
    return { text: '需配置间隔', color: '#f59e0b', bg: 'rgba(245,158,11,0.15)', border: 'rgba(245,158,11,0.3)' };
  }

  const lastOpen = c.last_open_time || 0;
  if (lastOpen === 0) {
    return { text: '就绪(下轮开单)', color: '#3fb950', bg: 'rgba(63,185,80,0.2)', border: 'rgba(63,185,80,0.4)' };
  }

  let unitSec = 3600;
  if (c.open_interval_unit === 'second') unitSec = 1;
  else if (c.open_interval_unit === 'minute') unitSec = 60;
  else if (c.open_interval_unit === 'day') unitSec = 86400;
  const intervalMs = (c.open_interval_value || 1) * unitSec * 1000;

  const targetNext = lastOpen + intervalMs + (c.next_jitter_ms || 0);
  const diffSec = Math.ceil((targetNext - Date.now()) / 1000);

  if (diffSec <= 0) {
    return { text: '就绪(下轮开单)', color: '#3fb950', bg: 'rgba(63,185,80,0.2)', border: 'rgba(63,185,80,0.4)' };
  }
  if (diffSec < 60) {
    return { text: diffSec + 's后开单', color: '#58a6ff', bg: 'rgba(88,166,255,0.15)', border: 'rgba(88,166,255,0.3)' };
  }
  const m = Math.floor(diffSec / 60);
  const s = diffSec % 60;
  return { text: m + 'm' + (s > 0 ? (s + 's') : '') + '后开单', color: '#58a6ff', bg: 'rgba(88,166,255,0.15)', border: 'rgba(88,166,255,0.3)' };
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

  // 搜索过滤与分页处理（默认每页50条）
  let list = coins || [];
  if (coinSearchQuery) {
    list = list.filter(c => {
      const s = c.symbol.toLowerCase();
      const sn = s.replace('-usdt-swap', '');
      return s.includes(coinSearchQuery) || sn.includes(coinSearchQuery);
    });
  }

  const totalFiltered = list.length;
  const pageSize = (coinPageSize === 'all') ? (totalFiltered || 1) : Number(coinPageSize);
  const totalPages = Math.max(1, Math.ceil(totalFiltered / pageSize));

  if (coinCurrentPage > totalPages) coinCurrentPage = totalPages;
  if (coinCurrentPage < 1) coinCurrentPage = 1;

  const startIdx = (coinPageSize === 'all') ? 0 : (coinCurrentPage - 1) * pageSize;
  const endIdx = (coinPageSize === 'all') ? totalFiltered : Math.min(startIdx + pageSize, totalFiltered);
  const displayedCoins = list.slice(startIdx, endIdx);

  // 更新工具栏分页及数量提示
  const elPagiInfo = document.getElementById('coinPaginationInfo');
  if (elPagiInfo) {
    if (totalFiltered === 0) {
      elPagiInfo.textContent = '未找到匹配币种';
    } else {
      elPagiInfo.textContent = '显示 ' + (startIdx + 1) + '-' + endIdx + ' 条 (共 ' + totalFiltered + ' 条' + (totalFiltered !== coins.length ? (' / 全部' + coins.length + '条') : '') + ')';
    }
  }
  const elPageNum = document.getElementById('coinPageNumber');
  if (elPageNum) {
    elPageNum.textContent = coinCurrentPage + ' / ' + totalPages;
  }
  const btnPrev = document.getElementById('btnCoinPrevPage');
  if (btnPrev) btnPrev.disabled = (coinCurrentPage <= 1);
  const btnNext = document.getElementById('btnCoinNextPage');
  if (btnNext) btnNext.disabled = (coinCurrentPage >= totalPages);

  const activeEl = document.activeElement;
  const activeId = activeEl ? activeEl.id : null;

  const existingMap = new Map();
  Array.from(grid.children).forEach(child => {
    if (child.dataset && child.dataset.symbol) {
      existingMap.set(child.dataset.symbol, child);
    }
  });

  const currentSymbols = new Set(displayedCoins.map(c => c.symbol));

  existingMap.forEach((cardEl, symbol) => {
    if (!currentSymbols.has(symbol)) {
      grid.removeChild(cardEl);
    }
  });

  displayedCoins.forEach(c => {
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

    const hasParams = Boolean(c.leverage && c.tp_ratio !== null && c.tp_ratio !== undefined && c.sl_ratio !== null && c.sl_ratio !== undefined && c.open_interval_value);
    const slices = getCoinSlices(c);

    let paramSummary = '';
    if (hasParams) {
      const amtStr = (c.funding_amount && c.funding_amount > 0) ? (c.funding_amount + 'U') : '未定资金';
      const perSliceStr = (c.funding_amount && c.funding_amount > 0) ? ('(每份' + (c.funding_amount / slices).toFixed(1) + 'U)') : '';
      const lev = c.leverage + 'x ';
      const modeStr = c.margin_mode === 'cross' ? '全仓' : '逐仓';
      const tpStr = c.tp_ratio !== undefined && c.tp_ratio !== null ? c.tp_ratio : '';
      const slStr = c.sl_ratio !== undefined && c.sl_ratio !== null ? c.sl_ratio : '';
      const intVal = c.open_interval_value || '';
      const intUnit = c.open_interval_unit === 'second' ? 's' : c.open_interval_unit === 'minute' ? 'm' : c.open_interval_unit === 'day' ? 'd' : 'h';
      paramSummary = amtStr + perSliceStr + ' | ' + (c.period || '1h') + ' | ' + lev + modeStr + ' | 盈' + tpStr + '% 损' + slStr + '% | 等分' + slices + '份/隔' + intVal + intUnit;
      if (c.add_pos_ratio && c.add_pos_ratio > 0) {
        paramSummary += ' | 加仓亏损-' + c.add_pos_ratio + '%';
      }
    } else {
      paramSummary = '未配置交易参数（点击选中上方配置）';
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
    const isSmartVol = Boolean(c.smart_volatility_enabled);
    const isVolPaused = isSmartVol && (c.volatility_status === 'paused' || (c.current_volatility !== undefined && c.current_volatility < (c.min_volatility_threshold || 1.0)));
    const volValStr = (c.current_volatility !== undefined && c.current_volatility !== null) ? (c.current_volatility + '%') : '-';
    const volThreshStr = (c.min_volatility_threshold !== undefined && c.min_volatility_threshold !== null) ? (c.min_volatility_threshold + '%') : '1.0%';

    const periodOptions = ['5m', '15m', '30m', '1h', '2h', '4h', '6h', '12h', '1d', '2d'];
    const periodSelectHtml = periodOptions.map(p => '<option value="' + p + '" ' + (p === displayPeriod ? 'selected' : '') + '>' + p + '</option>').join('');

    const shortName = symbol.replace('-USDT-SWAP','');
    const dirText = (c.direction === 'long' ? '做多' : c.direction === 'short' ? '做空' : '待判定');

    if (!cardEl.querySelector('.coin-ctrl-amt')) {
      cardEl.innerHTML = 
        '<div class="coin-card-left">' +
          '<label style="display:inline-flex;align-items:center;cursor:pointer" onclick="event.stopPropagation()">' +
            '<input type="checkbox" class="coin-select-checkbox batch-coin-chk" data-symbol="' + symbol + '" ' + (batchSelectedSymbols.has(symbol) ? 'checked' : '') + ' onchange="toggleCoinBatchCheck(&apos;' + symbol + '&apos;, this.checked, event)" title="勾选加入批量配置或批量删除">' +
          '</label>' +
          '<span class="coin-name" style="cursor:pointer" title="' + symbol + '">' +
            shortName +
            '<span class="sel-badge" style="display:' + (isSelected ? 'inline-block' : 'none') + ';font-size:10px;margin-left:3px;color:#58a6ff;background:rgba(88,166,255,0.2);padding:0 4px;border-radius:3px;font-weight:normal">已选</span>' +
          '</span>' +
          '<span class="coin-dir ' + (c.direction || 'none') + '">' + dirText + '</span>' +
        '</div>' +
        '<span class="coin-card-vdiv"></span>' +
        '<div class="coin-ctrl-item coin-ctrl-amt" onclick="event.stopPropagation()" title="自定义初始资金(USDT)，回车或移开自动保存">' +
          '<span style="color:#8b949e;font-size:11px">资金:</span>' +
          '<input type="text" inputmode="decimal" class="card-amt-input" id="amt-' + symbol + '" value="' + displayAmt + '" placeholder="未定" oninput="trackCoinAmountInput(&apos;' + symbol + '&apos;, this.value)" onchange="saveCoinInitialAmount(&apos;' + symbol + '&apos;, this.value)" onblur="saveCoinInitialAmount(&apos;' + symbol + '&apos;, this.value)" onkeydown="if(event.key===&apos;Enter&apos;){this.blur();saveCoinInitialAmount(&apos;' + symbol + '&apos;, this.value);}" title="自定义初始资金(USDT)，回车或移开自动保存">' +
          '<span style="color:#8b949e;font-size:11px">U</span>' +
        '</div>' +
        '<span class="coin-card-vdiv"></span>' +
        '<div class="coin-ctrl-item coin-ctrl-status" title="当前代币运行与下单调度状态">' +
          '<span class="coin-status-tag" style="background:' + nextStatus.bg + ';color:' + nextStatus.color + ';border:1px solid ' + nextStatus.border + '" title="当前代币运行与下单调度状态">' + nextStatus.text + '</span>' +
          '<span class="pause-tag" style="display:' + (c.enabled && c.pause_open ? 'inline-block' : 'none') + ';font-size:10px;padding:2px 4px;border-radius:3px;background:#8b5cf6;color:#fff;font-weight:600" title="已手动暂停自动下单">已暂停</span>' +
        '</div>' +
        '<div class="coin-ctrl-item param-tag-box" style="margin:0 2px" title="' + paramSummary + '">' +
          '<span class="param-summary-text" style="color:#8b949e;font-size:11px;white-space:nowrap">' + paramSummary + '</span>' +
        '</div>' +
        '<span class="coin-card-vdiv"></span>' +
        '<div class="coin-ctrl-item coin-ctrl-period" onclick="event.stopPropagation()" title="自定义K线周期，切换自动保存并重新研判方向">' +
          '<span style="color:#8b949e;font-size:11px">周期:</span>' +
          '<select class="card-period-select" id="sel-' + symbol + '" onchange="handleCardPeriodChange(&apos;' + symbol + '&apos;, this.value)" title="自定义K线周期，切换自动保存并重新研判方向">' +
            periodSelectHtml +
          '</select>' +
        '</div>' +
        '<span class="coin-card-vdiv"></span>' +
        '<div class="coin-ctrl-item coin-ctrl-smart" onclick="event.stopPropagation()" title="智能波动率过滤">' +
          '<button class="btn btn-smart-toggle ' + (isSmartVol ? 'active' : 'inactive') + '" onclick="toggleSmartVolatility(&apos;' + symbol + '&apos;, ' + (!isSmartVol) + ')" title="开启/关闭当前币种智能下单(低波动自动暂停下单)">智能: ' + (isSmartVol ? '开' : '关') + '</button>' +
          '<span class="smart-vol-badge" style="font-size:10px;padding:2px 5px;border-radius:4px;display:' + (isSmartVol ? 'inline-block' : 'none') + ';background:' + (isVolPaused ? 'rgba(217,119,6,0.2)' : 'rgba(59,130,246,0.15)') + ';color:' + (isVolPaused ? '#fbbf24' : '#60a5fa') + ';border:1px solid ' + (isVolPaused ? 'rgba(217,119,6,0.4)' : 'rgba(59,130,246,0.3)') + '" title="智能波动过滤状态: 上两根完整K线波动 ' + volValStr + ' (阈值 ' + volThreshStr + ')">' + (isVolPaused ? ('低波:' + volValStr) : ('波动:' + volValStr)) + '</span>' +
        '</div>' +
        '<span class="coin-card-vdiv"></span>' +
        '<div class="coin-ctrl-item coin-ctrl-addpos" onclick="event.stopPropagation()" title="自定义加仓幅度(%)：浮亏达到此设定比例后才允许加仓，回车或移开自动保存">' +
          '<span style="color:#8b949e;font-size:11px">加仓:-</span>' +
          '<input type="text" inputmode="decimal" class="card-addpos-input" id="addpos-' + symbol + '" value="' + displayAddPos + '" placeholder="0不限" oninput="trackCoinAddPosInput(&apos;' + symbol + '&apos;, this.value)" onchange="saveCoinAddPos(&apos;' + symbol + '&apos;, this.value)" onblur="saveCoinAddPos(&apos;' + symbol + '&apos;, this.value)" onkeydown="if(event.key===&apos;Enter&apos;){this.blur();saveCoinAddPos(&apos;' + symbol + '&apos;, this.value);}" title="浮亏达到此设定比例后才允许加仓，填0不限，回车或移开自动保存">' +
          '<span style="color:#8b949e;font-size:11px">%</span>' +
        '</div>' +
        '<span class="coin-card-vdiv"></span>' +
        '<div class="coin-card-actions" onclick="event.stopPropagation()">' +
          '<button class="btn btn-coin-toggle" style="padding:2px 8px;font-size:11px;font-weight:500;background:' + (c.enabled ? '#da3633' : '#238636') + ';color:#fff" onclick="toggleCoin(&apos;' + symbol + '&apos;, ' + (!c.enabled) + ')" title="' + (c.enabled ? '停止当前币种自动交易' : '启动当前币种自动交易') + '">' + (c.enabled ? '停止交易' : '开始交易') + '</button>' +
          '<button class="btn btn-pause-toggle" style="padding:2px 7px;font-size:11px;background:' + (c.pause_open ? '#238636' : '#8b5cf6') + ';color:#fff" onclick="togglePauseOpen(&apos;' + symbol + '&apos;, ' + (!c.pause_open) + ')" title="' + (c.pause_open ? '点击恢复自动下单' : '点击暂停自动下单') + '">' + (c.pause_open ? '恢复下单' : '暂停下单') + '</button>' +
          '<button class="btn btn-coin-params" onclick="openCoinSettingsModal(&apos;' + symbol + '&apos;, event)" title="自定义当前币种独立交易参数(杠杆、止盈止损、等分数、周期、智能过滤等)">⚙️ 参数设置</button>' +
          '<button class="btn btn-danger" style="padding:2px 7px;font-size:11px;background:#da3633;border:1px solid #f85149" onclick="removeCoin(&apos;' + symbol + '&apos;)" title="彻底删除该币种">删除</button>' +
        '</div>';
    } else {
      const batchChk = cardEl.querySelector('.batch-coin-chk');
      if (batchChk) batchChk.checked = batchSelectedSymbols.has(symbol);

      const selBadge = cardEl.querySelector('.sel-badge');
      if (selBadge) selBadge.style.display = isSelected ? 'inline-block' : 'none';

      const dirEl = cardEl.querySelector('.coin-dir');
      if (dirEl) {
        dirEl.className = 'coin-dir ' + (c.direction || 'none');
        dirEl.textContent = dirText;
      }

      const amtEl = cardEl.querySelector('#amt-' + symbol);
      if (amtEl && activeId !== 'amt-' + symbol) {
        amtEl.value = displayAmt;
      }

      const statusTag = cardEl.querySelector('.coin-status-tag');
      if (statusTag) {
        statusTag.style.background = nextStatus.bg;
        statusTag.style.color = nextStatus.color;
        statusTag.style.border = '1px solid ' + nextStatus.border;
        statusTag.textContent = nextStatus.text;
      }

      const pauseTag = cardEl.querySelector('.pause-tag');
      if (pauseTag) pauseTag.style.display = (c.enabled && c.pause_open) ? 'inline-block' : 'none';

      const paramBox = cardEl.querySelector('.param-tag-box');
      if (paramBox) {
        paramBox.title = paramSummary;
        paramBox.innerHTML = '<span class="param-summary-text" style="color:#8b949e;font-size:11px;white-space:nowrap">' + paramSummary + '</span>';
      }

      const selEl = cardEl.querySelector('#sel-' + symbol);
      if (selEl && activeId !== 'sel-' + symbol) {
        selEl.value = displayPeriod;
      }

      const smartBtn = cardEl.querySelector('.btn-smart-toggle');
      if (smartBtn) {
        smartBtn.className = 'btn btn-smart-toggle ' + (isSmartVol ? 'active' : 'inactive');
        smartBtn.textContent = '智能: ' + (isSmartVol ? '开' : '关');
        smartBtn.onclick = (e) => { e.stopPropagation(); toggleSmartVolatility(symbol, !isSmartVol); };
      }

      const smartBadge = cardEl.querySelector('.smart-vol-badge');
      if (smartBadge) {
        smartBadge.style.display = isSmartVol ? 'inline-block' : 'none';
        smartBadge.style.background = isVolPaused ? 'rgba(217,119,6,0.2)' : 'rgba(59,130,246,0.15)';
        smartBadge.style.color = isVolPaused ? '#fbbf24' : '#60a5fa';
        smartBadge.style.border = '1px solid ' + (isVolPaused ? 'rgba(217,119,6,0.4)' : 'rgba(59,130,246,0.3)');
        smartBadge.textContent = isVolPaused ? ('低波:' + volValStr) : ('波动:' + volValStr);
        smartBadge.title = '智能波动过滤状态: 上两根完整K线波动 ' + volValStr + ' (阈值 ' + volThreshStr + ')';
      }

      const addposEl = cardEl.querySelector('#addpos-' + symbol);
      if (addposEl && activeId !== 'addpos-' + symbol) {
        addposEl.value = displayAddPos;
      }

      const coinToggleBtn = cardEl.querySelector('.btn-coin-toggle');
      if (coinToggleBtn) {
        coinToggleBtn.style.background = c.enabled ? '#da3633' : '#238636';
        coinToggleBtn.textContent = c.enabled ? '停止交易' : '开始交易';
        coinToggleBtn.onclick = (e) => { e.stopPropagation(); toggleCoin(symbol, !c.enabled); };
        coinToggleBtn.title = c.enabled ? '停止当前币种自动交易' : '启动当前币种自动交易';
      }

      const pauseBtn = cardEl.querySelector('.btn-pause-toggle');
      if (pauseBtn) {
        pauseBtn.style.background = c.pause_open ? '#238636' : '#8b5cf6';
        pauseBtn.textContent = c.pause_open ? '恢复下单' : '暂停下单';
        pauseBtn.onclick = (e) => { e.stopPropagation(); togglePauseOpen(symbol, !c.pause_open); };
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

async function handleSaveParamsClick() {
  if (currentParamMode === 'single' && selectedSymbol) {
    await saveTradeParams();
  } else if (currentParamMode === 'batch' || batchSelectedSymbols.size > 0) {
    await saveBatchTradeParams();
  } else {
    await saveGlobalDefaultParams();
  }
}

async function applyParamsToBatchSelected() {
  if (batchSelectedSymbols.size === 0) {
    showAppToast('请先在币种列表勾选需要批量应用参数的代币！', 'info');
    return;
  }
  const selScopeRadio = document.querySelector('input[name="batchScope"][value="selected"]');
  if (selScopeRadio) selScopeRadio.checked = true;
  await saveBatchTradeParams(Array.from(batchSelectedSymbols));
}

async function saveTradeParams() {
  if (!selectedSymbol) {
    showAppToast('请先点击列表中的代币选中它，再保存其交易参数！', 'info');
    return;
  }
  
  const val = (id) => document.getElementById(id) ? document.getElementById(id).value : '';
  
  const payload = {
    symbol: selectedSymbol,
    leverage: val('cfgLeverage') !== '' ? Number(val('cfgLeverage')) : 10,
    tp_ratio: val('cfgTpRatio') !== '' ? Number(val('cfgTpRatio')) : 5,
    sl_ratio: val('cfgSlRatio') !== '' ? Number(val('cfgSlRatio')) : 5,
    funding_slices: val('cfgFundingSlices') !== '' ? Number(val('cfgFundingSlices')) : 10,
    margin_mode: val('cfgMarginMode') || 'isolated',
    profit_transfer_ratio: val('cfgTransferRatio') !== '' ? Number(val('cfgTransferRatio')) : 0,
    open_interval_value: val('cfgIntervalValue') !== '' ? Number(val('cfgIntervalValue')) : 1,
    open_interval_unit: val('cfgIntervalUnit') || 'hour',
    smart_volatility_enabled: val('cfgSmartVolatility') === '1' ? 1 : 0,
    min_volatility_threshold: val('cfgMinVolatility') !== '' ? Number(val('cfgMinVolatility')) : 1.0,
    add_pos_ratio: val('cfgAddPosRatio') !== '' ? Number(val('cfgAddPosRatio')) : 0,
  };

  const amtVal = val('cfgFundingAmount');
  if (amtVal !== '') {
    const numAmt = parseFloat(amtVal);
    if (!isNaN(numAmt) && numAmt >= 0) {
      payload.funding_amount = numAmt;
    }
  }

  const periodVal = val('cfgPeriod');
  if (periodVal) {
    payload.period = periodVal;
  }

  const btn = document.getElementById('btnSaveParams');
  const oldText = btn ? btn.textContent : '';
  if (btn) {
    btn.disabled = true;
    btn.textContent = '保存中...';
  }

  try {
    const res = await api('/api/coins', { method: 'POST', body: JSON.stringify(payload) });
    if (res && res.success) {
      clearAllParamDirty();
      await loadAll();
      fillParamsForSelected(true);
      const shortSym = selectedSymbol.replace('-USDT-SWAP', '');
      showAppToast('代币【' + shortSym + '】全部交易参数保存成功！已持久化并即刻生效', 'success');
    } else {
      showAppToast('保存失败: ' + (res?.error || '未知错误'), 'error');
    }
  } catch (err) {
    showAppToast('保存异常: ' + String(err), 'error');
  } finally {
    if (btn) {
      btn.disabled = false;
      btn.textContent = oldText || '保存参数';
    }
  }
}

async function saveBatchTradeParams(explicitSymbols) {
  const val = (id) => document.getElementById(id) ? document.getElementById(id).value : '';
  let targetSymbols = [];
  if (explicitSymbols && Array.isArray(explicitSymbols) && explicitSymbols.length > 0) {
    targetSymbols = explicitSymbols;
  } else {
    const scopeEl = document.querySelector('input[name="batchScope"]:checked');
    const scope = scopeEl ? scopeEl.value : (batchSelectedSymbols.size > 0 ? 'selected' : 'all');
    if (scope === 'selected' || (batchSelectedSymbols.size > 0 && scope !== 'all')) {
      targetSymbols = Array.from(batchSelectedSymbols);
    } else {
      targetSymbols = (allCoinsData || []).map(c => c.symbol);
    }
  }

  if (!targetSymbols.length) {
    showAppToast('当前没有可应用的币种！请在币种列表勾选代币或选择“全部币种”。', 'info');
    return;
  }

  const isSaveGlobal = Boolean(document.getElementById('chkSaveAsGlobalDefault')?.checked);

  const params = {
    leverage: val('cfgLeverage') !== '' ? Number(val('cfgLeverage')) : 10,
    tp_ratio: val('cfgTpRatio') !== '' ? Number(val('cfgTpRatio')) : 5,
    sl_ratio: val('cfgSlRatio') !== '' ? Number(val('cfgSlRatio')) : 5,
    funding_slices: val('cfgFundingSlices') !== '' ? Number(val('cfgFundingSlices')) : 10,
    margin_mode: val('cfgMarginMode') || 'isolated',
    profit_transfer_ratio: val('cfgTransferRatio') !== '' ? Number(val('cfgTransferRatio')) : 0,
    open_interval_value: val('cfgIntervalValue') !== '' ? Number(val('cfgIntervalValue')) : 1,
    open_interval_unit: val('cfgIntervalUnit') || 'hour',
    smart_volatility_enabled: val('cfgSmartVolatility') === '1' ? 1 : 0,
    min_volatility_threshold: val('cfgMinVolatility') !== '' ? Number(val('cfgMinVolatility')) : 1.0,
    add_pos_ratio: val('cfgAddPosRatio') !== '' ? Number(val('cfgAddPosRatio')) : 0,
  };

  const amtVal = val('cfgFundingAmount');
  if (amtVal !== '') {
    const numAmt = parseFloat(amtVal);
    if (!isNaN(numAmt) && numAmt >= 0) {
      params.funding_amount = numAmt;
    }
  }

  const periodVal = val('cfgPeriod');
  if (periodVal) {
    params.period = periodVal;
  }

  const unitMap = { hour: '小时', minute: '分钟', second: '秒', day: '天' };
  const intervalUnitStr = unitMap[params.open_interval_unit] || '小时';
  const marginModeStr = params.margin_mode === 'cross' ? '全仓' : '逐仓';

  const confirmHtml = 
    '<div style="display:flex;flex-direction:column;gap:12px">' +
      '<div style="background:#0d1117;border:1px solid #30363d;border-radius:6px;padding:10px 12px;display:flex;align-items:center;justify-content:space-between">' +
        '<div style="display:flex;align-items:center;gap:8px">' +
          '<span style="font-size:16px">🎯</span>' +
          '<div>' +
            '<div style="font-size:13px;font-weight:600;color:#f0f6fc">批量应用交易参数</div>' +
            '<div style="font-size:12px;color:#8b949e">目标范围: <span style="color:#58a6ff;font-weight:600">' + targetSymbols.length + '</span> 个币种' + (isSaveGlobal ? ' <span style="color:#3fb950">(同时更新全局默认模板)</span>' : '') + '</div>' +
          '</div>' +
        '</div>' +
        '<span style="padding:2px 8px;border-radius:12px;font-size:11px;font-weight:600;background:rgba(31,111,235,0.15);color:#58a6ff;border:1px solid rgba(56,139,253,0.3)">' + targetSymbols.length + ' 个已选</span>' +
      '</div>' +
      '<div style="background:#161b22;border:1px solid #30363d;border-radius:6px;padding:10px 12px">' +
        '<div style="font-size:11px;font-weight:600;color:#8b949e;letter-spacing:0.5px;margin-bottom:8px">本次批量生效的核心参数:</div>' +
        '<div style="display:grid;grid-template-columns:1fr 1fr;gap:6px 14px;font-size:12px">' +
          '<div style="color:#c9d1d9">初始资金: <strong style="color:#f0f6fc">' + (params.funding_amount !== undefined ? (params.funding_amount + ' USDT') : '保持原样') + '</strong></div>' +
          '<div style="color:#c9d1d9">K线周期: <strong style="color:#58a6ff">' + (params.period || '默认') + '</strong></div>' +
          '<div style="color:#c9d1d9">杠杆与模式: <strong style="color:#e3b341">' + params.leverage + 'x · ' + marginModeStr + '</strong></div>' +
          '<div style="color:#c9d1d9">止盈 / 止损: <strong style="color:#3fb950">+' + params.tp_ratio + '%</strong> / <strong style="color:#f85149">-' + params.sl_ratio + '%</strong></div>' +
          '<div style="color:#c9d1d9">资金等分数: <strong style="color:#f0f6fc">' + params.funding_slices + ' 份</strong></div>' +
          '<div style="color:#c9d1d9">加仓亏损幅度: <strong style="color:#f0f6fc">' + (params.add_pos_ratio > 0 ? ('-' + params.add_pos_ratio + '%') : '不限制') + '</strong></div>' +
          '<div style="color:#c9d1d9">开单间隔: <strong style="color:#f0f6fc">' + params.open_interval_value + ' ' + intervalUnitStr + '</strong></div>' +
          '<div style="color:#c9d1d9">智能波动过滤: <strong style="color:' + (params.smart_volatility_enabled ? '#3fb950' : '#8b949e') + '">' + (params.smart_volatility_enabled ? ('开启 (' + params.min_volatility_threshold + '%)') : '关闭') + '</strong></div>' +
        '</div>' +
      '</div>' +
      '<div>' +
        '<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:6px">' +
          '<span style="font-size:12px;color:#8b949e">代币清单预览 (' + targetSymbols.length + '个):</span>' +
          '<span style="font-size:11px;color:#8b949e">可在框内上下滚动浏览</span>' +
        '</div>' +
        '<div style="max-height:85px;overflow-y:auto;background:#0d1117;border:1px solid #30363d;border-radius:6px;padding:6px;display:flex;flex-wrap:wrap;gap:4px">' +
          targetSymbols.map(s => '<span style="display:inline-block;padding:1px 6px;background:#21262d;border:1px solid #30363d;border-radius:4px;font-size:11px;color:#c9d1d9;font-family:ui-monospace,SFMono-Regular,Menlo,monospace">' + s.replace('-USDT-SWAP', '') + '</span>').join('') +
        '</div>' +
      '</div>' +
    '</div>';
  
  const confirmed = await showAppConfirm('⚡ 批量应用交易参数', confirmHtml, false, '立即批量应用', true);
  if (!confirmed) return;

  const btn = document.getElementById('btnSaveParams');
  const listBtn = document.getElementById('btnBatchApplyParams');
  const oldText = btn ? btn.textContent : '';
  const oldListText = listBtn ? listBtn.textContent : '';
  if (btn) {
    btn.disabled = true;
    btn.textContent = '应用中...';
  }
  if (listBtn) {
    listBtn.disabled = true;
    listBtn.textContent = '应用中...';
  }

  try {
    // 1. 如果勾选了保存为全局模板
    if (isSaveGlobal) {
      await api('/api/coins/global-params', {
        method: 'POST',
        body: JSON.stringify(params),
      });
      cachedGlobalParams = { ...params };
    }

    // 2. 批量更新币种参数
    const res = await api('/api/coins/batch-update', {
      method: 'POST',
      body: JSON.stringify({
        symbols: targetSymbols,
        params,
      }),
    });

    if (res && res.success) {
      showAppToast('批量参数应用成功！已更新 ' + targetSymbols.length + ' 个币种', 'success');
      clearAllParamDirty();
      await loadAll();
      updateBatchScopeUi();
    } else {
      showAppToast('批量应用失败: ' + (res?.error || '未知错误'), 'error');
    }
  } catch (err) {
    showAppToast('请求异常: ' + String(err), 'error');
  } finally {
    if (btn) {
      btn.disabled = false;
      btn.textContent = oldText || '保存参数';
    }
    if (listBtn) {
      listBtn.disabled = false;
      listBtn.textContent = oldListText || ('⚡ 批量应用参数(' + batchSelectedSymbols.size + ')');
    }
  }
}

async function saveGlobalDefaultParams() {
  const val = (id) => document.getElementById(id) ? document.getElementById(id).value : '';
  const params = {
    leverage: val('cfgLeverage') !== '' ? Number(val('cfgLeverage')) : 10,
    tp_ratio: val('cfgTpRatio') !== '' ? Number(val('cfgTpRatio')) : 5,
    sl_ratio: val('cfgSlRatio') !== '' ? Number(val('cfgSlRatio')) : 5,
    funding_slices: val('cfgFundingSlices') !== '' ? Number(val('cfgFundingSlices')) : 10,
    margin_mode: val('cfgMarginMode') || 'isolated',
    profit_transfer_ratio: val('cfgTransferRatio') !== '' ? Number(val('cfgTransferRatio')) : 0,
    open_interval_value: val('cfgIntervalValue') !== '' ? Number(val('cfgIntervalValue')) : 1,
    open_interval_unit: val('cfgIntervalUnit') || 'hour',
    smart_volatility_enabled: val('cfgSmartVolatility') === '1' ? 1 : 0,
    min_volatility_threshold: val('cfgMinVolatility') !== '' ? Number(val('cfgMinVolatility')) : 1.0,
    add_pos_ratio: val('cfgAddPosRatio') !== '' ? Number(val('cfgAddPosRatio')) : 0,
  };
  const amtVal = val('cfgFundingAmount');
  if (amtVal !== '') {
    const numAmt = parseFloat(amtVal);
    if (!isNaN(numAmt) && numAmt >= 0) params.funding_amount = numAmt;
  }
  const periodVal = val('cfgPeriod');
  if (periodVal) params.period = periodVal;

  const res = await api('/api/coins/global-params', {
    method: 'POST',
    body: JSON.stringify(params),
  });
  if (res && res.success) {
    cachedGlobalParams = { ...params };
    showAppToast('已成功保存为全局默认交易参数模板！', 'success');
  } else {
    showAppToast('保存全局默认模板失败: ' + (res?.error || '未知错误'), 'error');
  }
}

// ---------------- 智能优选币种与定时自动导入 (OKX 合约自动化选币调度) ----------------

async function toggleSmartCoinsPanel() {
  const panel = document.getElementById('smartCoinsPanel');
  if (!panel) return;
  const isHidden = (panel.style.display === 'none' || !panel.style.display);
  if (isHidden) {
    panel.style.display = 'block';
    await loadSmartConfig();
  } else {
    panel.style.display = 'none';
  }
}

function formatDateTime(ts) {
  if (!ts || ts <= 0) return '未执行/未计划';
  const d = new Date(ts);
  const pad = (n) => String(n).padStart(2, '0');
  return \`\${d.getFullYear()}-\${pad(d.getMonth() + 1)}-\${pad(d.getDate())} \${pad(d.getHours())}:\${pad(d.getMinutes())}:\${pad(d.getSeconds())}\`;
}

async function loadSmartConfig() {
  try {
    const curBalance = (currentConfigData && currentConfigData.total_balance && currentConfigData.total_balance > 0)
      ? currentConfigData.total_balance
      : 100;
    const manualBalInput = document.getElementById('smartManualBalance');
    if (manualBalInput && (!manualBalInput.value || parseFloat(manualBalInput.value) <= 0)) {
      manualBalInput.value = curBalance.toFixed(2);
    }

    const res = await api('/api/coins/smart-config');
    if (res && res.success && res.data) {
      const cfg = res.data;
      if (document.getElementById('smartAutoImportEnabled')) document.getElementById('smartAutoImportEnabled').checked = Boolean(cfg.enabled);
      if (document.getElementById('smartAutoImportIntervalVal')) {
        document.getElementById('smartAutoImportIntervalVal').value = cfg.interval_val || cfg.interval_hours || 4;
      }
      if (document.getElementById('smartAutoImportIntervalUnit')) {
        document.getElementById('smartAutoImportIntervalUnit').value = cfg.interval_unit || 'hour';
      }
      if (document.getElementById('smartBalancePercent')) document.getElementById('smartBalancePercent').value = cfg.fund_pct || 10;
      if (document.getElementById('smartFundingSlices')) document.getElementById('smartFundingSlices').value = cfg.slices || 10;
      if (document.getElementById('smartAutoStart')) document.getElementById('smartAutoStart').checked = (cfg.auto_start !== undefined ? Boolean(cfg.auto_start) : true);
      if (document.getElementById('smartPeriod')) document.getElementById('smartPeriod').value = cfg.period || '1h';
      if (document.getElementById('smartMarginMode')) document.getElementById('smartMarginMode').value = cfg.margin_mode || 'isolated';
      if (document.getElementById('smartSmartVolatility')) document.getElementById('smartSmartVolatility').value = cfg.smart_volatility_enabled ? '1' : '0';
      if (document.getElementById('smartMinVolatility')) document.getElementById('smartMinVolatility').value = (cfg.min_volatility_threshold !== undefined ? cfg.min_volatility_threshold : 1.0);
      if (document.getElementById('smartAddPosRatio')) document.getElementById('smartAddPosRatio').value = (cfg.add_pos_ratio !== undefined ? cfg.add_pos_ratio : 0);
      if (document.getElementById('smartProfitTransferRatio')) document.getElementById('smartProfitTransferRatio').value = (cfg.profit_transfer_ratio !== undefined ? cfg.profit_transfer_ratio : 0);
      if (document.getElementById('smartLeverage')) document.getElementById('smartLeverage').value = cfg.leverage || 10;
      if (document.getElementById('smartTpRatio')) document.getElementById('smartTpRatio').value = (cfg.tp_ratio !== undefined ? cfg.tp_ratio : 5);
      if (document.getElementById('smartSlRatio')) document.getElementById('smartSlRatio').value = (cfg.sl_ratio !== undefined ? cfg.sl_ratio : 5);
      if (document.getElementById('smartIntervalValue')) document.getElementById('smartIntervalValue').value = cfg.open_interval_value || 1;
      if (document.getElementById('smartIntervalUnit')) document.getElementById('smartIntervalUnit').value = cfg.open_interval_unit || 'hour';
      if (document.getElementById('smartAutoImportBalanceMode')) document.getElementById('smartAutoImportBalanceMode').value = cfg.balance_mode || 'live';
      if (document.getElementById('smartManualBalance') && cfg.manual_balance) {
        document.getElementById('smartManualBalance').value = cfg.manual_balance;
      }

      const unitTextMap = { hour: '小时', day: '天', week: '周', month: '月' };
      const curUnitText = unitTextMap[cfg.interval_unit || 'hour'] || '小时';
      const curVal = cfg.interval_val || cfg.interval_hours || 4;

      const badge = document.getElementById('smartScheduleStatusBadge');
      if (badge) {
        if (cfg.enabled) {
          badge.textContent = '🟢 运行中 (每 ' + curVal + ' ' + curUnitText + ')';
          badge.style.background = 'rgba(63,185,80,0.15)';
          badge.style.color = '#3fb950';
          badge.style.border = '1px solid rgba(63,185,80,0.3)';
        } else {
          badge.textContent = '⚪ 定时未开启';
          badge.style.background = 'rgba(255,255,255,0.06)';
          badge.style.color = '#8b949e';
          badge.style.border = 'none';
        }
      }

      const lastRunEl = document.getElementById('smartLastRunText');
      if (lastRunEl) lastRunEl.textContent = formatDateTime(cfg.last_run);

      const nextRunEl = document.getElementById('smartNextRunText');
      if (nextRunEl) {
        if (cfg.enabled && cfg.next_run > 0) {
          nextRunEl.textContent = formatDateTime(cfg.next_run);
        } else {
          nextRunEl.textContent = '未开启定时导入';
        }
      }
    }
  } catch (err) {
    console.warn('[loadSmartConfig] 加载失败:', err);
  } finally {
    updateSmartCalcPreview();
  }
}

function updateSmartCalcPreview() {
  const totalBal = parseFloat(document.getElementById('smartManualBalance')?.value) || 100;
  const pct = parseFloat(document.getElementById('smartBalancePercent')?.value) || 10;
  const slices = parseFloat(document.getElementById('smartFundingSlices')?.value) || 10;
  const leverage = parseInt(document.getElementById('smartLeverage')?.value, 10) || 10;

  const initAmt = (totalBal * (pct / 100));
  const nominalVal = initAmt * leverage;

  const initAmtEl = document.getElementById('smartPreviewInitAmt');
  const nominalValEl = document.getElementById('smartPreviewNominal');
  const reqSlicesEl = document.getElementById('smartPreviewReqSlices');

  if (initAmtEl) initAmtEl.textContent = initAmt.toFixed(2) + ' USDT';
  if (nominalValEl) nominalValEl.textContent = nominalVal.toFixed(2) + ' USDT (' + leverage + 'X)';
  if (reqSlicesEl) reqSlicesEl.textContent = '≥ ' + String(Math.floor(slices)) + ' 份';
}

async function syncLiveBalanceToSmartInput(btn) {
  const origText = btn ? btn.textContent : '';
  if (btn) {
    btn.disabled = true;
    btn.textContent = '读取中...';
  }
  try {
    const res = await api('/api/overview');
    if (res && res.success && res.data) {
      const bal = parseFloat(res.data.balance || res.data.total_equity || res.data.total_balance || res.data.trade_account || 0);
      if (bal > 0) {
        const inp = document.getElementById('smartManualBalance');
        if (inp) {
          inp.value = bal.toFixed(2);
          updateSmartCalcPreview();
        }
        alert('✅ 已成功读取并填入当前 OKX 实盘交易账户资金: ' + bal.toFixed(2) + ' USDT');
        return;
      }
    }
    const errMsg = (res && res.error) ? ('原因: ' + res.error) : '未读取到大于0的实盘账户资金，请检查API Key配置及OKX账户资产。';
    alert(errMsg);
  } catch (e) {
    alert('读取实盘资金失败: ' + String(e));
  } finally {
    if (btn) {
      btn.disabled = false;
      btn.textContent = origText || '🔄 同步实盘';
    }
  }
}

async function saveSmartConfig(btn) {
  const oldText = btn ? btn.textContent : '';
  if (btn) {
    btn.disabled = true;
    btn.textContent = '保存中...';
  }

  const enabled = Boolean(document.getElementById('smartAutoImportEnabled')?.checked);
  const autoImportVal = parseInt(document.getElementById('smartAutoImportIntervalVal')?.value, 10) || 4;
  const autoImportUnit = document.getElementById('smartAutoImportIntervalUnit')?.value || 'hour';
  let mult = 1;
  if (autoImportUnit === 'day') mult = 24;
  else if (autoImportUnit === 'week') mult = 168;
  else if (autoImportUnit === 'month') mult = 720;
  const intervalHours = autoImportVal * mult;

  const fundPct = parseFloat(document.getElementById('smartBalancePercent')?.value) || 10;
  const slices = parseInt(document.getElementById('smartFundingSlices')?.value, 10) || 10;
  const manualBal = parseFloat(document.getElementById('smartManualBalance')?.value) || 100;
  const balanceMode = document.getElementById('smartAutoImportBalanceMode')?.value || 'live';
  const autoStart = Boolean(document.getElementById('smartAutoStart')?.checked);
  const leverage = parseInt(document.getElementById('smartLeverage')?.value, 10) || 10;
  const marginMode = document.getElementById('smartMarginMode')?.value || 'isolated';
  const period = document.getElementById('smartPeriod')?.value || '1h';
  const intervalVal = parseInt(document.getElementById('smartIntervalValue')?.value, 10) || 1;
  const intervalUnit = document.getElementById('smartIntervalUnit')?.value || 'hour';
  const tpRatio = parseFloat(document.getElementById('smartTpRatio')?.value) || 5;
  const slRatio = parseFloat(document.getElementById('smartSlRatio')?.value) || 5;
  const smartVol = document.getElementById('smartSmartVolatility')?.value === '1';
  const volThreshold = parseFloat(document.getElementById('smartMinVolatility')?.value) || 1.0;
  const addPosRatio = parseFloat(document.getElementById('smartAddPosRatio')?.value) || 0;
  const profitTransfer = parseFloat(document.getElementById('smartProfitTransferRatio')?.value) || 0;

  try {
    const res = await api('/api/coins/smart-config', {
      method: 'POST',
      body: JSON.stringify({
        enabled,
        interval_val: autoImportVal,
        interval_unit: autoImportUnit,
        interval_hours: intervalHours,
        fund_pct: fundPct,
        slices,
        manual_balance: manualBal,
        balance_mode: balanceMode,
        auto_start: autoStart,
        leverage,
        margin_mode: marginMode,
        period,
        open_interval_value: intervalVal,
        open_interval_unit: intervalUnit,
        tp_ratio: tpRatio,
        sl_ratio: slRatio,
        smart_volatility_enabled: smartVol,
        min_volatility_threshold: volThreshold,
        add_pos_ratio: addPosRatio,
        profit_transfer_ratio: profitTransfer,
      }),
    });

    const unitTextMap = { hour: '小时', day: '天', week: '周', month: '月' };
    const unitDesc = autoImportVal + (unitTextMap[autoImportUnit] || '小时');

    if (res && res.success) {
      alert(\`✅ 定时自动优选与导入设置已成功保存！\\n状态: \${enabled ? '已开启 (每 ' + unitDesc + ' 自动检查导入)' : '已关闭'}\\n自动启动交易: \${autoStart ? '是 (无需人工参与)' : '否 (手动开启)'}\`);
      await loadSmartConfig();
    } else {
      alert('保存失败: ' + (res?.error || '未知错误'));
    }
  } catch (err) {
    alert('请求异常: ' + String(err));
  } finally {
    if (btn) {
      btn.disabled = false;
      btn.textContent = oldText;
    }
  }
}

async function runSmartAutoImportNow(btn) {
  if (!confirm('确定立即在后台触发一次优选筛选与自动导入吗？\\n如果符合条件且设置了自动启动，系统将直接为新币种建档并启动交易。')) {
    return;
  }

  const oldText = btn ? btn.textContent : '';
  if (btn) {
    btn.disabled = true;
    btn.textContent = '⏳ 执行中...';
  }

  try {
    const res = await api('/api/coins/smart-run-now', { method: 'POST' });
    if (res && res.success) {
      alert(\`🎉 立即执行完成！\\n\${res.data?.message || '处理成功'}\\n导入代币数量: \${res.data?.importedCount || 0}\`);
      await loadAll();
      await loadSmartConfig();
    } else {
      alert('执行失败: ' + (res?.error || '未知错误'));
    }
  } catch (err) {
    alert('请求异常: ' + String(err));
  } finally {
    if (btn) {
      btn.disabled = false;
      btn.textContent = oldText;
    }
  }
}

async function runSmartCoinsFilter(btn) {
  const balanceMode = document.getElementById('smartAutoImportBalanceMode')?.value || 'manual';
  const totalBal = parseFloat(document.getElementById('smartManualBalance')?.value) || 0;
  const pct = parseFloat(document.getElementById('smartBalancePercent')?.value) || 0;
  const slices = parseFloat(document.getElementById('smartFundingSlices')?.value) || 10;
  const leverage = parseInt(document.getElementById('smartLeverage')?.value, 10) || 10;

  if (balanceMode === 'manual' && totalBal <= 0) {
    alert('请输入有效的参考资金基数！');
    return;
  }
  if (pct <= 0 || pct > 100) {
    alert('请输入有效的单币资金百分比 (0-100%)！');
    return;
  }
  if (slices <= 0) {
    alert('请输入有效的资金等分数 (需大于0)！');
    return;
  }

  const oldText = btn ? btn.textContent : '';
  if (btn) {
    btn.disabled = true;
    btn.textContent = '⚡ 筛选中...';
  }

  const resultsBox = document.getElementById('smartFilterResultsBox');
  const tbody = document.getElementById('smartTableBody');
  const countEl = document.getElementById('smartEligibleCount');
  if (resultsBox) resultsBox.style.display = 'block';
  if (tbody) {
    tbody.innerHTML = '<tr><td colspan="7" style="text-align:center;padding:24px;color:#58a6ff"><span class="status-dot running" style="margin-right:6px"></span>正在轻量拉取 OKX 永续合约公共行情并计算可开张数，请稍候...</td></tr>';
  }

  try {
    const res = await api('/api/coins/smart-preview', {
      method: 'POST',
      body: JSON.stringify({
        manualBalance: totalBal,
        total_balance: totalBal,
        accountBalancePercent: pct,
        fund_percent: pct,
        funding_slices: slices,
        leverage: leverage,
        balance_mode: balanceMode,
      }),
    });

    if (res && res.success && res.data) {
      smartFilterResults = res.data.eligibleCoins || res.data.coins || [];
      if (countEl) countEl.textContent = String(smartFilterResults.length);

      const initAmtDisplay = (res.data.initialAmount ?? (totalBal * (pct / 100))).toFixed(2);
      const nominalDisplay = (res.data.nominalValue ?? (totalBal * (pct / 100) * leverage)).toFixed(2);

      const initAmtEl = document.getElementById('smartPreviewInitAmt');
      const nominalValEl = document.getElementById('smartPreviewNominal');
      const reqSlicesEl = document.getElementById('smartPreviewReqSlices');
      if (initAmtEl) initAmtEl.textContent = initAmtDisplay + ' USDT';
      if (nominalValEl) nominalValEl.textContent = nominalDisplay + ' USDT (' + (res.data.leverage || leverage) + 'X)';
      if (reqSlicesEl) reqSlicesEl.textContent = '≥ ' + String(Math.floor(slices)) + ' 份';

      if (!smartFilterResults.length) {
        if (tbody) {
          tbody.innerHTML = '<tr><td colspan="7" style="text-align:center;padding:20px;color:#8b949e">在当前初始金额 ' + initAmtDisplay + ' USDT (' + (res.data.leverage || leverage) + 'X杠杆名义本金 ' + nominalDisplay + ' USDT) 下，未筛选到满足单笔最小下单量或等分数的合约。可尝试提高参考总资金、资金百分比或杠杆倍数。</td></tr>';
        }
        return;
      }

      const existingSet = new Set((allCoinsData || []).map(c => c.symbol));

      if (tbody) {
        tbody.innerHTML = smartFilterResults.map(item => {
          const isExists = existingSet.has(item.symbol);
          const cleanSym = item.symbol.replace('-USDT-SWAP', '');
          const statusBadge = isExists
            ? '<span style="color:#8b949e;background:rgba(110,118,129,0.2);padding:1px 6px;border-radius:3px;font-size:11px">已在列表</span>'
            : '<span style="color:#3fb950;background:rgba(63,185,80,0.15);padding:1px 6px;border-radius:3px;font-size:11px">全新优选</span>';

          const chkDisabled = isExists ? 'disabled' : '';
          const chkChecked = isExists ? '' : 'checked';
          const nominalValStr = item.nominalValue ? item.nominalValue.toFixed(2) : (item.initialAmount * (item.leverage || leverage)).toFixed(2);
          const contractsCount = item.actualContracts ?? item.maxContracts ?? 0;
          const perSliceText = item.perSliceContracts !== undefined
            ? item.perSliceContracts + ' 张/笔'
            : (contractsCount / (item.fundingSlices || slices)).toFixed(1) + ' 张/笔';

          return \`
            <tr style="border-bottom:1px solid #21262d;transition:background 0.15s" onmouseover="this.style.background='rgba(56,139,253,0.06)'" onmouseout="this.style.background='transparent'">
              <td style="padding:8px 10px;text-align:center">
                <input type="checkbox" class="smart-item-chk" value="\${item.symbol}" \${chkChecked} \${chkDisabled} onchange="updateSmartSelectCount()">
              </td>
              <td style="padding:8px 10px;font-weight:600;color:#c9d1d9">\${cleanSym}</td>
              <td style="padding:8px 10px;color:#58a6ff">\${item.currentPrice}</td>
              <td style="padding:8px 10px;color:#8b949e">\${item.ctVal} \${item.ctValCcy || ''}</td>
              <td style="padding:8px 10px;color:#c9d1d9">\${nominalValStr} USDT</td>
              <td style="padding:8px 10px">
                <span style="color:#3fb950;font-weight:600">\${contractsCount} 张</span>
                <span style="font-size:11px;color:#8b949e;margin-left:4px">(\${perSliceText} | 最小\${item.minSz}张)</span>
              </td>
              <td style="padding:8px 10px">\${statusBadge}</td>
            </tr>
          \`;
        }).join('');
      }
      updateSmartSelectCount();
    } else {
      alert('优选筛选失败: ' + (res?.error || '未知错误'));
      if (tbody) tbody.innerHTML = '<tr><td colspan="7" style="text-align:center;padding:16px;color:#f85149">请求出错: ' + (res?.error || '未知异常') + '</td></tr>';
    }
  } catch (e) {
    alert('筛选异常: ' + String(e));
    if (tbody) tbody.innerHTML = '<tr><td colspan="7" style="text-align:center;padding:16px;color:#f85149">网络异常: ' + String(e) + '</td></tr>';
  } finally {
    if (btn) {
      btn.disabled = false;
      btn.textContent = oldText;
    }
  }
}

function updateSmartSelectCount() {
  const chks = document.querySelectorAll('.smart-item-chk:checked:not(:disabled)');
  const countEl = document.getElementById('smartCheckedCount');
  if (countEl) countEl.textContent = String(chks.length);

  const btn = document.getElementById('btnImportSelectedSmart');
  if (btn) {
    btn.textContent = \`📥 确认导入选中的 \${chks.length} 个优选币种\`;
    btn.disabled = (chks.length === 0);
  }
}

function toggleSmartResultSelectAll(checked) {
  document.querySelectorAll('.smart-item-chk:not(:disabled)').forEach(chk => {
    chk.checked = checked;
  });
  const headerChk = document.getElementById('chkSmartHeader');
  if (headerChk) headerChk.checked = checked;
  updateSmartSelectCount();
}

async function importSelectedSmartCoins(btn) {
  const chks = document.querySelectorAll('.smart-item-chk:checked:not(:disabled)');
  const symbols = Array.from(chks).map(c => c.value);

  if (!symbols.length) {
    alert('请先勾选需要导入的优选代币！');
    return;
  }

  const totalBal = parseFloat(document.getElementById('smartManualBalance')?.value) || 0;
  const pct = parseFloat(document.getElementById('smartBalancePercent')?.value) || 0;
  const slices = parseFloat(document.getElementById('smartFundingSlices')?.value) || 10;
  const autoStart = Boolean(document.getElementById('smartAutoStart')?.checked);
  const leverage = parseInt(document.getElementById('smartLeverage')?.value, 10) || 10;
  const marginMode = document.getElementById('smartMarginMode')?.value || 'isolated';
  const period = document.getElementById('smartPeriod')?.value || '1h';
  const intervalVal = parseInt(document.getElementById('smartIntervalValue')?.value, 10) || 1;
  const intervalUnit = document.getElementById('smartIntervalUnit')?.value || 'hour';
  const tpRatio = parseFloat(document.getElementById('smartTpRatio')?.value) || 5;
  const slRatio = parseFloat(document.getElementById('smartSlRatio')?.value) || 5;
  const smartVol = document.getElementById('smartSmartVolatility')?.value === '1';
  const volThreshold = parseFloat(document.getElementById('smartMinVolatility')?.value) || 1.0;
  const addPosRatio = parseFloat(document.getElementById('smartAddPosRatio')?.value) || 0;
  const profitTransfer = parseFloat(document.getElementById('smartProfitTransferRatio')?.value) || 0;

  const initialAmount = Number((totalBal * (pct / 100)).toFixed(2));

  const defaultParams = {
    funding_amount: initialAmount,
    funding_slices: slices,
    leverage,
    margin_mode: marginMode,
    period,
    open_interval_value: intervalVal,
    open_interval_unit: intervalUnit,
    tp_ratio: tpRatio,
    sl_ratio: slRatio,
    smart_volatility_enabled: smartVol ? 1 : 0,
    min_volatility_threshold: volThreshold,
    add_pos_ratio: addPosRatio,
    profit_transfer_ratio: profitTransfer,
    autoStart,
  };

  const oldText = btn ? btn.textContent : '';
  if (btn) {
    btn.disabled = true;
    btn.textContent = '导入中...';
  }

  try {
    const res = await api('/api/coins/smart-import', {
      method: 'POST',
      body: JSON.stringify({
        coins: symbols.map(s => ({ symbol: s, period })),
        params: defaultParams,
      }),
    });

    if (res && res.success) {
      alert(\`🎉 成功导入 \${symbols.length} 个优选币种！\\n单币资金: \${initialAmount} USDT | 等分数: \${slices}份 | 周期: \${period} | 模式: \${marginMode === 'cross' ? '全仓' : '逐仓'}\\n智能波动: \${smartVol ? '开(' + volThreshold + '%)' : '关'} | 加仓幅度: -\${addPosRatio}%\\n\${autoStart ? '【已立即自动启动交易无需人工参与】' : '【已导入列表，等待手动启动】'}\`);
      const panel = document.getElementById('smartCoinsPanel');
      if (panel) panel.style.display = 'none';
      await loadAll();
    } else {
      alert('导入失败: ' + (res?.error || '未知错误'));
    }
  } catch (err) {
    alert('导入异常: ' + String(err));
  } finally {
    if (btn) {
      btn.disabled = false;
      btn.textContent = oldText;
    }
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

async function startAllCoins(btn) {
  if (!allCoinsData || allCoinsData.length === 0) {
    alert('当前币种列表为空，请先添加币种！');
    return;
  }
  if (!confirm('确认批量启动全部 ' + (allCoinsData ? allCoinsData.length : 0) + ' 个代币的自动交易？')) return;

  const elBtn = btn || document.getElementById('btnStartAllCoins');
  const originalText = elBtn ? elBtn.textContent : '全部启动';
  if (elBtn) {
    elBtn.disabled = true;
    elBtn.textContent = '启动中...';
  }

  try {
    // 轻量化单次 API 请求：后台单次拉取全局参数并执行批量并发研判与批量重试
    const res = await api('/api/coins/start-all', { method: 'POST' });
    if (res && res.success) {
      // 执行成功后才更新前端状态，严禁状态前置
      await loadAll();
    } else {
      alert('全部启动失败: ' + (res?.error || '未知错误'));
    }
  } catch (err) {
    alert('请求异常: ' + String(err));
  } finally {
    if (elBtn) {
      elBtn.disabled = false;
      elBtn.textContent = originalText;
    }
  }
}

async function stopAllCoins(btn) {
  if (!allCoinsData || allCoinsData.length === 0) return;
  if (!confirm('确认批量停止全部 ' + (allCoinsData ? allCoinsData.length : 0) + ' 个代币的自动交易？')) return;

  const elBtn = btn || document.getElementById('btnStopAllCoins');
  const originalText = elBtn ? elBtn.textContent : '全部停止';
  if (elBtn) {
    elBtn.disabled = true;
    elBtn.textContent = '停止中...';
  }

  try {
    // 轻量化单次 API 请求：后台单次拉取全局参数并批量停止与批量重试
    const res = await api('/api/coins/stop-all', { method: 'POST' });
    if (res && res.success) {
      // 执行成功后才更新前端状态，严禁状态前置
      await loadAll();
    } else {
      alert('全部停止失败: ' + (res?.error || '未知错误'));
    }
  } catch (err) {
    alert('请求异常: ' + String(err));
  } finally {
    if (elBtn) {
      elBtn.disabled = false;
      elBtn.textContent = originalText;
    }
  }
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
      if (!coin.leverage || coin.tp_ratio === null || coin.tp_ratio === undefined || coin.sl_ratio === null || coin.sl_ratio === undefined || !coin.open_interval_value) {
        alert('【' + symbol.replace('-USDT-SWAP','') + '】尚未配置完整的交易参数(杠杆/止盈/止损/下单间隔)，请先在上方配置并保存交易参数后再启动交易！');
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

async function toggleSmartVolatility(symbol, smart_volatility_enabled) {
  const shortName = symbol.replace('-USDT-SWAP', '');
  try {
    const res = await api('/api/coins', { method: 'POST', body: JSON.stringify({ symbol, smart_volatility_enabled }) });
    if (!res || !res.success) { 
      showAppToast('切换智能下单失败: ' + (res && res.error ? res.error : '未知错误'), 'error'); 
      return; 
    }
    showAppToast('【' + shortName + '】智能下单已' + (smart_volatility_enabled ? '开启' : '关闭'), 'success');
    await loadAll();
  } catch (err) {
    showAppToast('切换智能下单网络异常: ' + String(err), 'error');
  }
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
  const shortSym = symbol.replace('-USDT-SWAP', '');
  const confirmed = await showAppConfirm(
    '确认删除代币',
    '确定彻底删除代币【' + shortSym + '】？\\n删除后将从监控列表中移除，不再执行自动开单。',
    true,
    '彻底删除'
  );
  if (!confirmed) return;

  try {
    let res = await api('/api/coins?symbol=' + encodeURIComponent(symbol), {
      method: 'DELETE',
      body: JSON.stringify({ symbol })
    });
    if (!res || !res.success) {
      res = await api('/api/coins/delete', {
        method: 'POST',
        body: JSON.stringify({ symbol })
      });
    }

    if (res && res.success) {
      batchSelectedSymbols.delete(symbol);
      if (selectedSymbol === symbol) {
        selectedSymbol = null;
      }
      delete coinInputs[symbol];
      await loadAll();
      updateBatchScopeUi();
      showAppToast('代币【' + shortSym + '】已成功删除！', 'success');
    } else {
      showAppToast('删除失败: ' + (res?.error || '网络或服务端未知错误'), 'error');
    }
  } catch (err) {
    showAppToast('删除请求发生异常: ' + String(err), 'error');
  }
}

async function batchDeleteSelectedCoins() {
  const symbols = Array.from(batchSelectedSymbols);
  if (!symbols || symbols.length === 0) {
    showAppToast('请先在币种列表勾选需要批量删除的代币！', 'info');
    return;
  }

  const confirmHtml =
    '<div style="display:flex;flex-direction:column;gap:12px">' +
      '<div style="background:rgba(248,81,73,0.1);border:1px solid rgba(248,81,73,0.3);border-radius:6px;padding:10px 12px;display:flex;align-items:flex-start;gap:10px">' +
        '<span style="font-size:18px;color:#f85149;line-height:1">⚠️</span>' +
        '<div style="font-size:12px;color:#c9d1d9;line-height:1.5">' +
          '<strong style="color:#f85149">确认批量删除当前已勾选的 ' + symbols.length + ' 个代币？</strong><br>' +
          '删除后将从监控列表中彻底移除，停止自动下单，且操作不可撤销。' +
        '</div>' +
      '</div>' +
      '<div>' +
        '<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:6px">' +
          '<span style="font-size:12px;color:#8b949e">待删除代币清单 (' + symbols.length + '个):</span>' +
          '<span style="font-size:11px;color:#8b949e">可在框内上下滚动浏览</span>' +
        '</div>' +
        '<div style="max-height:85px;overflow-y:auto;background:#0d1117;border:1px solid #30363d;border-radius:6px;padding:6px;display:flex;flex-wrap:wrap;gap:4px">' +
          symbols.map(s => '<span style="display:inline-block;padding:1px 6px;background:rgba(248,81,73,0.12);border:1px solid rgba(248,81,73,0.25);border-radius:4px;font-size:11px;color:#f85149;font-family:ui-monospace,SFMono-Regular,Menlo,monospace">' + s.replace('-USDT-SWAP', '') + '</span>').join('') +
        '</div>' +
      '</div>' +
    '</div>';

  const confirmed = await showAppConfirm('⚠️ 批量删除代币', confirmHtml, true, '立即批量删除', true);
  if (!confirmed) return;

  const btn = document.getElementById('btnBatchDeleteCoins');
  const oldText = btn ? btn.textContent : '';
  if (btn) {
    btn.disabled = true;
    btn.textContent = '删除中...';
  }

  try {
    let res = await api('/api/coins/batch-delete', {
      method: 'POST',
      body: JSON.stringify({ symbols })
    });
    if (!res || !res.success) {
      res = await api('/api/coins', {
        method: 'DELETE',
        body: JSON.stringify({ symbols })
      });
    }

    if (res && res.success) {
      symbols.forEach(s => {
        batchSelectedSymbols.delete(s);
        if (selectedSymbol === s) selectedSymbol = null;
        delete coinInputs[s];
      });
      await loadAll();
      updateBatchScopeUi();
      showAppToast('批量删除成功！已彻底移除 ' + symbols.length + ' 个代币', 'success');
    } else {
      showAppToast('批量删除失败: ' + (res?.error || '未知错误'), 'error');
    }
  } catch (err) {
    showAppToast('批量删除请求异常: ' + String(err), 'error');
  } finally {
    if (btn) {
      btn.disabled = false;
      btn.textContent = oldText || ('🗑️ 批量删除(' + batchSelectedSymbols.size + ')');
    }
  }
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

// ---------------- 代币自定义参数模态框 (独立弹窗配置) ----------------

function openCoinSettingsModal(symbol, event) {
  if (event) event.stopPropagation();
  const coin = (allCoinsData || []).find(c => c.symbol === symbol);
  if (!coin) return;

  const shortName = symbol.replace('-USDT-SWAP', '');
  const modal = document.getElementById('coinParamsModal');
  const titleEl = document.getElementById('modalParamTitle');
  const subtitleEl = document.getElementById('modalParamSubtitle');
  const symEl = document.getElementById('modalParamSymbol');

  if (titleEl) titleEl.textContent = '⚙️ 【' + shortName + '】独立交易参数设置';
  if (subtitleEl) subtitleEl.textContent = '单独自定义【' + shortName + '】的仓位、杠杆、止盈止损与调度风控，保存后立即生效并持久化';
  if (symEl) symEl.value = symbol;

  const tracker = coinInputs[symbol] || {};
  const amtVal = (tracker.amountDirty && tracker.amount !== undefined)
    ? tracker.amount
    : ((coin.funding_amount !== undefined && coin.funding_amount !== null && coin.funding_amount > 0) ? coin.funding_amount : '');
  const periodVal = (tracker.periodDirty && tracker.period)
    ? tracker.period
    : (coin.period || '1h');
  const addPosVal = (tracker.addPosDirty && tracker.addPosRatio !== undefined)
    ? tracker.addPosRatio
    : ((coin.add_pos_ratio !== undefined && coin.add_pos_ratio !== null) ? coin.add_pos_ratio : '');

  const setVal = (id, val) => {
    const el = document.getElementById(id);
    if (el) el.value = (val !== undefined && val !== null) ? String(val) : '';
  };

  setVal('mCfgFundingAmount', amtVal);
  setVal('mCfgPeriod', periodVal);
  setVal('mCfgLeverage', (coin.leverage !== undefined && coin.leverage !== null) ? coin.leverage : 10);
  setVal('mCfgMarginMode', coin.margin_mode || 'isolated');
  setVal('mCfgTpRatio', (coin.tp_ratio !== undefined && coin.tp_ratio !== null) ? coin.tp_ratio : 5);
  setVal('mCfgSlRatio', (coin.sl_ratio !== undefined && coin.sl_ratio !== null) ? coin.sl_ratio : 5);
  setVal('mCfgFundingSlices', (coin.funding_slices !== undefined && coin.funding_slices !== null && coin.funding_slices > 0) ? coin.funding_slices : 10);
  setVal('mCfgAddPosRatio', addPosVal);
  setVal('mCfgIntervalValue', (coin.open_interval_value !== undefined && coin.open_interval_value !== null) ? coin.open_interval_value : 1);
  setVal('mCfgIntervalUnit', coin.open_interval_unit || 'hour');
  setVal('mCfgSmartVolatility', coin.smart_volatility_enabled ? '1' : '0');
  setVal('mCfgMinVolatility', (coin.min_volatility_threshold !== undefined && coin.min_volatility_threshold !== null) ? coin.min_volatility_threshold : 1.0);
  setVal('mCfgTransferRatio', (coin.profit_transfer_ratio !== undefined && coin.profit_transfer_ratio !== null) ? coin.profit_transfer_ratio : 0);

  if (modal) modal.style.display = 'flex';
}

function closeCoinSettingsModal() {
  const modal = document.getElementById('coinParamsModal');
  if (modal) modal.style.display = 'none';
}

async function submitModalCoinParams() {
  const symEl = document.getElementById('modalParamSymbol');
  const symbol = symEl ? symEl.value : '';
  if (!symbol) {
    showAppToast('代币标识为空，无法保存', 'error');
    return;
  }

  const shortName = symbol.replace('-USDT-SWAP', '');
  const val = (id) => document.getElementById(id) ? document.getElementById(id).value.trim() : '';

  const payload = {
    symbol: symbol,
    leverage: val('mCfgLeverage') !== '' ? Number(val('mCfgLeverage')) : 10,
    tp_ratio: val('mCfgTpRatio') !== '' ? Number(val('mCfgTpRatio')) : 5,
    sl_ratio: val('mCfgSlRatio') !== '' ? Number(val('mCfgSlRatio')) : 5,
    funding_slices: val('mCfgFundingSlices') !== '' ? Number(val('mCfgFundingSlices')) : 10,
    margin_mode: val('mCfgMarginMode') || 'isolated',
    profit_transfer_ratio: val('mCfgTransferRatio') !== '' ? Number(val('mCfgTransferRatio')) : 0,
    open_interval_value: val('mCfgIntervalValue') !== '' ? Number(val('mCfgIntervalValue')) : 1,
    open_interval_unit: val('mCfgIntervalUnit') || 'hour',
    smart_volatility_enabled: val('mCfgSmartVolatility') === '1' ? 1 : 0,
    min_volatility_threshold: val('mCfgMinVolatility') !== '' ? Number(val('mCfgMinVolatility')) : 1.0,
    add_pos_ratio: val('mCfgAddPosRatio') !== '' ? Number(val('mCfgAddPosRatio')) : 0,
  };

  const amtVal = val('mCfgFundingAmount');
  if (amtVal !== '') {
    const numAmt = parseFloat(amtVal);
    if (!isNaN(numAmt) && numAmt >= 0) {
      payload.funding_amount = numAmt;
    }
  }

  const periodVal = val('mCfgPeriod');
  if (periodVal) {
    payload.period = periodVal;
  }

  const btn = document.getElementById('btnSaveModalParams');
  const oldText = btn ? btn.textContent : '';
  if (btn) {
    btn.disabled = true;
    btn.textContent = '保存中...';
  }

  try {
    const res = await api('/api/coins', {
      method: 'POST',
      body: JSON.stringify(payload)
    });

    if (res && res.success) {
      clearCoinAmountDirty(symbol);
      clearCoinPeriodDirty(symbol);
      closeCoinSettingsModal();
      await loadAll();
      if (selectedSymbol === symbol) {
        fillParamsForSelected(true);
      }
      showAppToast('代币【' + shortName + '】独立参数保存成功！已持久化到数据库并即刻生效', 'success');
    } else {
      showAppToast('保存失败: ' + (res?.error || '未知错误'), 'error');
    }
  } catch (err) {
    showAppToast('保存异常: ' + String(err), 'error');
  } finally {
    if (btn) {
      btn.disabled = false;
      btn.textContent = oldText || '保存参数';
    }
  }
}

// 检查授权并启动
checkAuth();
</script>
</body>
</html>
`;

export default DASHBOARD_HTML;
