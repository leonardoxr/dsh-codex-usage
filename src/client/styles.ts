export const STYLE_ID = 'dsh-codex-usage/client'

export const styles = `
.dcu-footer-action-anchor{box-sizing:border-box;width:28px;height:28px;visibility:hidden;position:fixed;z-index:900}
.dcu-usage-root{display:inline-flex;position:relative;flex:none}
.dcu-meter{width:28px;height:28px;color:var(--dsw-alias-label-secondary);cursor:pointer;background:transparent;border:0;border-radius:999px;padding:0;place-items:center;display:grid;position:relative;transition:background .15s ease}
.dcu-usage-root:hover .dcu-meter,.dcu-usage-root:focus-within .dcu-meter{background:var(--dsw-alias-interactive-bg-hover)}
.dcu-ring{position:absolute;inset:2px;transform:rotate(-90deg)}
.dcu-track{fill:none;stroke:var(--dsw-alias-border-l3);stroke-width:2}
.dcu-fill{fill:none;stroke:var(--dsw-alias-label-tertiary);stroke-width:2;stroke-linecap:round;transition:stroke-dashoffset .35s ease,stroke .2s ease}
.dcu-fill-warn{stroke:var(--dsw-static-orange-500,#f59e0b)}
.dcu-fill-critical{stroke:var(--dsw-static-red-500,#ef4444)}
.dcu-logo{width:12px;height:12px;color:var(--dsw-alias-label-secondary);z-index:1}
.dcu-status-dot{position:absolute;right:1px;bottom:1px;width:5px;height:5px;border:1.5px solid var(--dsw-specific-sidebar);border-radius:50%;background:var(--dsw-static-red-500,#ef4444)}
.dcu-panel{z-index:1100;box-sizing:border-box;width:320px;max-height:min(520px,calc(100vh - 32px));overflow:auto;border:1px solid var(--dsw-alias-border-inverted);background:var(--dsw-specific-menu);box-shadow:var(--dsw-shadow-lv3);color:var(--dsw-alias-label-secondary);cursor:default;border-radius:12px;padding:14px;position:absolute;bottom:calc(100% + 8px);right:0;text-align:left;font-size:12px;line-height:18px}
.dcu-panel-header{display:flex;align-items:flex-start;gap:10px;margin-bottom:12px}
.dcu-panel-title{color:var(--dsw-alias-label-primary);font-size:13px;font-weight:600;line-height:18px}
.dcu-panel-subtitle{color:var(--dsw-alias-label-tertiary);margin-top:1px}
.dcu-live{width:7px;height:7px;border-radius:50%;background:#22c55e;margin-top:5px;box-shadow:0 0 0 3px color-mix(in srgb,#22c55e 18%,transparent);flex:none}
.dcu-live-stale{background:var(--dsw-static-orange-500,#f59e0b);box-shadow:none}
.dcu-spinner{width:14px;height:14px;border:2px solid var(--dsw-alias-border-l3);border-top-color:var(--dsw-alias-label-secondary);border-radius:50%;animation:dcu-spin .8s linear infinite;margin:8px auto}
@keyframes dcu-spin{to{transform:rotate(360deg)}}
.dcu-error{padding:9px 10px;border-radius:8px;background:color-mix(in srgb,var(--dsw-static-red-500,#ef4444) 10%,transparent);color:var(--dsw-alias-label-secondary);margin-bottom:10px;overflow-wrap:anywhere}
.dcu-bucket{padding:10px 0;border-top:1px solid var(--dsw-alias-border-l3)}
.dcu-bucket:first-of-type{border-top:0;padding-top:0}
.dcu-bucket-title{display:flex;justify-content:space-between;gap:12px;color:var(--dsw-alias-label-primary);font-weight:500;margin-bottom:7px}
.dcu-window{margin-top:8px}
.dcu-window-head{display:flex;justify-content:space-between;gap:10px}
.dcu-percent{font-variant-numeric:tabular-nums;color:var(--dsw-alias-label-primary);font-weight:500}
.dcu-bar{height:4px;border-radius:999px;background:var(--dsw-alias-interactive-bg-hover);overflow:hidden;margin:5px 0 3px}
.dcu-bar-fill{height:100%;border-radius:999px;background:var(--dsw-static-blue-450,#5b8def)}
.dcu-bar-warn{background:var(--dsw-static-orange-500,#f59e0b)}
.dcu-bar-critical{background:var(--dsw-static-red-500,#ef4444)}
.dcu-reset{color:var(--dsw-alias-label-tertiary)}
.dcu-bucket-meta{display:grid;grid-template-columns:1fr auto;gap:3px 12px;margin:9px 0 0;padding-top:8px;border-top:1px solid var(--dsw-alias-border-l3)}
.dcu-bucket-meta dt{color:var(--dsw-alias-label-tertiary)}
.dcu-bucket-meta dd{margin:0;color:var(--dsw-alias-label-primary);font-variant-numeric:tabular-nums;text-align:right}
.dcu-meta{display:grid;grid-template-columns:1fr auto;gap:4px 12px;padding-top:10px;border-top:1px solid var(--dsw-alias-border-l3)}
.dcu-meta dt{color:var(--dsw-alias-label-tertiary)}
.dcu-meta dd{margin:0;color:var(--dsw-alias-label-primary);font-variant-numeric:tabular-nums;text-align:right}
.dcu-credit-list{margin-top:10px;padding-top:9px;border-top:1px solid var(--dsw-alias-border-l3)}
.dcu-credit-heading{color:var(--dsw-alias-label-primary);font-weight:500;margin-bottom:6px}
.dcu-credit{padding:7px 0}
.dcu-credit+.dcu-credit{border-top:1px solid var(--dsw-alias-border-l3)}
.dcu-credit>div{display:flex;justify-content:space-between;gap:8px;color:var(--dsw-alias-label-primary)}
.dcu-credit strong{font-weight:500}.dcu-credit p{margin:3px 0;color:var(--dsw-alias-label-secondary)}
.dcu-credit small{color:var(--dsw-alias-label-tertiary);font-size:11px}
.dcu-footer{color:var(--dsw-alias-label-tertiary);font-size:11px;margin-top:10px;padding-top:9px;border-top:1px solid var(--dsw-alias-border-l3);display:flex;justify-content:space-between;gap:8px}
.dcu-empty{padding:8px 0;color:var(--dsw-alias-label-tertiary)}
`
