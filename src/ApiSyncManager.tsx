import React, { useState } from 'react';
import { 
  ChevronLeft, Save, Database, Server, Link2, Copy, Check, 
  RefreshCw, Info, AlertCircle, CheckCircle2, ShieldCheck, 
  Zap, KeyRound, Globe2
} from 'lucide-react';
import { WebsiteSettings } from './types';
import { cn } from './lib/utils';
import { cloudStore } from './lib/cloudStore';

interface ApiSyncManagerProps {
  settings: WebsiteSettings;
  setSettings: React.Dispatch<React.SetStateAction<WebsiteSettings>>;
  onClose: () => void;
}

export function ApiSyncManager({ settings, setSettings, onClose }: ApiSyncManagerProps) {
  const [enabled, setEnabled] = useState(settings.apiSync?.enabled ?? false);
  const [isMaster, setIsMaster] = useState(settings.apiSync?.isMaster ?? true);
  const [masterApiKey, setMasterApiKey] = useState(
    settings.apiSync?.masterApiKey || 
    Array.from({ length: 32 }, () => Math.floor(Math.random() * 36).toString(36)).join('')
  );
  const [connectedMasterUrl, setConnectedMasterUrl] = useState(settings.apiSync?.connectedMasterUrl || '');
  const [connectedMasterApiKey, setConnectedMasterApiKey] = useState(settings.apiSync?.connectedMasterApiKey || '');
  
  const [copied, setCopied] = useState(false);
  const [saved, setSaved] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  
  const [connectionStatus, setConnectionStatus] = useState<'idle' | 'testing' | 'success' | 'error'>('idle');
  const [isSyncing, setIsSyncing] = useState(false);
  const [syncMessage, setSyncMessage] = useState('');

  const themeColor = '#6366F1';

  const handleCopy = () => {
    navigator.clipboard.writeText(masterApiKey);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleRegenerateKey = () => {
    const newKey = Array.from({ length: 32 }, () => Math.floor(Math.random() * 36).toString(36)).join('');
    setMasterApiKey(newKey);
  };

  const handleConnect = async () => {
    const cleanUrl = connectedMasterUrl.trim().replace(/\/$/, "");
    const cleanApiKey = connectedMasterApiKey.trim();

    if (!cleanUrl || !cleanApiKey) {
      setConnectionStatus('error');
      setSyncMessage('Both Master Store URL and API Key are required.');
      return;
    }
    
    setConnectionStatus('testing');
    setSyncMessage('');
    
    try {
      const res = await fetch(`${cleanUrl}/api/sync_check`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${cleanApiKey}`
        },
        body: JSON.stringify({ retailUrl: window.location.origin })
      });
      
      if (!res.ok) {
        const errJson = await res.json().catch(() => ({}));
        throw new Error(errJson.error || `Verification failed (Status: ${res.status})`);
      }
      
      const updated = {
        ...settings,
        apiSync: {
          enabled: true,
          isMaster: false,
          masterApiKey,
          connectedMasterUrl: cleanUrl,
          connectedMasterApiKey: cleanApiKey
        }
      };
      setSettings(updated);
      setEnabled(true);
      setIsMaster(false);
      setConnectedMasterUrl(cleanUrl);
      setConnectedMasterApiKey(cleanApiKey);
      await cloudStore.saveSetting('websiteSettings', updated);

      setConnectionStatus('success');
      setSyncMessage('Successfully connected to Master Wholesale Store!');
    } catch (err: any) {
      setConnectionStatus('error');
      setSyncMessage(err.message || 'Failed to establish connection. Please verify the URL and API Key.');
    }
  };

  const handleForceSync = async () => {
    setIsSyncing(true);
    setSyncMessage('Syncing products, images, and inventory from master...');
    
    try {
      const dbUrl = connectedMasterUrl.trim().replace(/\/$/, "");
      const cleanApiKey = connectedMasterApiKey.trim();
      
      const res = await fetch(`${dbUrl}/api/sync_data`, {
        headers: {
          'Authorization': `Bearer ${cleanApiKey}`
        }
      });
      
      if (!res.ok) {
        const errJson = await res.json().catch(() => ({}));
        throw new Error(errJson.error || 'Failed to retrieve inventory data from Master');
      }
      
      const data = await res.json();
      const products = data.products || [];
      const categories = data.categories || [];
      
      const applyRes = await fetch('/api/sync_apply', {
        method: 'POST',
        credentials: 'include',
        headers: { 
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${cleanApiKey}`
        },
        body: JSON.stringify({ products, categories })
      });
      
      if (!applyRes.ok) {
        const errJson = await applyRes.json().catch(() => ({}));
        throw new Error(errJson.error || 'Failed to apply synced products locally');
      }
      
      setSyncMessage(`Sync completed successfully! ${products.length} products synced.`);
      setTimeout(() => {
        setSyncMessage('');
        window.location.reload();
      }, 1500);
      
    } catch (err: any) {
      setConnectionStatus('error');
      setSyncMessage(err.message || 'Sync failed. Please try again.');
    } finally {
      setIsSyncing(false);
    }
  };

  const handleSave = async () => {
    setIsSaving(true);
    try {
      const updated = {
        ...settings,
        apiSync: {
          enabled,
          isMaster,
          masterApiKey,
          connectedMasterUrl: connectedMasterUrl.trim(),
          connectedMasterApiKey: connectedMasterApiKey.trim()
        }
      };
      setSettings(updated);
      await cloudStore.saveSetting('websiteSettings', updated);
      setSaved(true);
      setTimeout(() => {
        setSaved(false);
        onClose();
      }, 600);
    } catch (e) {
      console.error(e);
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div 
      className="fixed inset-0 z-[100] bg-[var(--dash-bg)] text-[#e2e8f0] flex flex-col font-sans overflow-hidden md:left-[334px]"
      id="api_sync_manager_view"
    >
      {/* Top Header Bar */}
      <div 
        className="border-b border-[var(--dash-border)]/70 bg-[var(--dash-bg)]/95 backdrop-blur-md sticky top-0 z-20 shrink-0"
        id="api_sync_header"
      >
        <div className="max-w-4xl mx-auto w-full flex items-center justify-between px-2.5 py-3 md:px-8 md:py-4">
          <div className="flex items-center gap-3">
            <button 
              onClick={onClose} 
              className="w-10 h-10 rounded-xl bg-white/5 hover:bg-white/10 active:scale-95 border border-white/10 flex items-center justify-center text-slate-300 hover:text-white transition-all shrink-0 cursor-pointer"
              id="api_sync_back_btn"
              title="Go back"
            >
              <ChevronLeft size={20} />
            </button>
            <div className="flex items-center gap-2.5">
              <div className="w-10 h-10 rounded-xl bg-indigo-500/10 border border-indigo-500/20 flex items-center justify-center text-indigo-400 shrink-0 shadow-inner">
                <Database size={20} />
              </div>
              <div>
                <h1 className="text-base md:text-lg font-bold text-white tracking-tight flex items-center gap-2">
                  Multi-Store Sync Engine
                </h1>
                <p className="text-[11px] text-slate-400 font-medium hidden sm:block">
                  Master inventory distribution, real-time stock deduction, and catalog replication
                </p>
              </div>
            </div>
          </div>

          <button 
            onClick={handleSave}
            disabled={isSaving}
            className="px-5 py-2 rounded-xl font-bold text-xs md:text-sm text-white bg-indigo-600 hover:bg-indigo-500 active:scale-95 transition-all shadow-lg shadow-indigo-500/25 cursor-pointer shrink-0 disabled:opacity-50"
            id="api_sync_save_btn"
          >
            {saved ? 'Saved' : isSaving ? 'Saving...' : 'Save'}
          </button>
        </div>
      </div>

      {/* Main Content Body */}
      <div 
        className="flex-1 overflow-y-auto p-2.5 md:p-8 space-y-5 max-w-4xl mx-auto w-full pb-32 overscroll-y-contain custom-scrollbar"
        style={{ WebkitOverflowScrolling: 'touch' }}
        id="api_sync_content"
      >
        {/* Master Switch Card */}
        <div 
          className="bg-[var(--dash-card)] border border-[var(--dash-border)]/70 rounded-2xl p-4 md:p-6 shadow-xl space-y-4"
          id="api_sync_main_card"
        >
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3.5">
              <div className="w-11 h-11 rounded-2xl bg-indigo-500/10 border border-indigo-500/20 flex items-center justify-center text-indigo-400 shrink-0 shadow-inner">
                <Zap size={22} />
              </div>
              <div>
                <h2 className="text-sm md:text-base font-bold text-white">Enable Multi-Store Synchronization</h2>
                <p className="text-xs text-slate-400 mt-0.5">Live stock updates between wholesale parent and sub-branches</p>
              </div>
            </div>

            <button
              onClick={() => setEnabled(!enabled)}
              className={cn(
                "w-12 h-6.5 rounded-full relative transition-all duration-300 ease-in-out p-0.5 focus:outline-none shrink-0 cursor-pointer",
                enabled ? "bg-indigo-600 shadow-md shadow-indigo-500/25" : "bg-slate-700/60"
              )}
              id="api_sync_toggle"
            >
              <div
                className={cn(
                  "w-5.5 h-5.5 rounded-full bg-white transition-all duration-300 shadow-md",
                  enabled ? "translate-x-5.5" : "translate-x-0"
                )}
              />
            </button>
          </div>
        </div>

        {/* Collapsible Options when Enabled */}
        {enabled && (
          <div className="space-y-5 animate-in fade-in slide-in-from-top-2 duration-200">
            {/* Step 1: Role Selection */}
            <div className="bg-[var(--dash-card)] border border-[var(--dash-border)]/70 rounded-2xl p-4 md:p-6 shadow-xl space-y-4">
              <label className="text-xs font-bold uppercase tracking-wider text-slate-300 block">
                Store Sync Architecture
              </label>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                {/* Option 1: Master Store */}
                <button
                  type="button"
                  onClick={() => setIsMaster(true)}
                  className={cn(
                    "relative p-4 rounded-xl border text-left transition-all flex flex-col justify-between gap-3 cursor-pointer",
                    isMaster
                      ? "bg-indigo-500/10 border-indigo-500/60 shadow-lg shadow-indigo-500/10 ring-1 ring-indigo-500/40"
                      : "bg-[var(--dash-bg)] border-[var(--dash-border)] hover:border-slate-600 text-slate-300"
                  )}
                  id="role_master_btn"
                >
                  <div className="flex items-center justify-between w-full">
                    <div className={cn(
                      "w-9 h-9 rounded-xl flex items-center justify-center transition-colors",
                      isMaster ? "bg-indigo-600 text-white" : "bg-white/5 text-slate-400 border border-[var(--dash-border)]"
                    )}>
                      <Server size={18} />
                    </div>
                    <div className={cn(
                      "w-5 h-5 rounded-full border flex items-center justify-center transition-colors",
                      isMaster ? "border-indigo-400 bg-indigo-600 text-white" : "border-slate-600 bg-transparent"
                    )}>
                      {isMaster && <Check size={12} strokeWidth={3} />}
                    </div>
                  </div>

                  <div>
                    <h3 className="text-xs md:text-sm font-bold text-white">Act as Master (Wholesale Hub)</h3>
                    <p className="text-[11px] text-slate-400 mt-1 leading-relaxed">
                      Primary central inventory store. Connected branches will pull catalog and push order deductions.
                    </p>
                  </div>
                </button>

                {/* Option 2: Retail Store */}
                <button
                  type="button"
                  onClick={() => setIsMaster(false)}
                  className={cn(
                    "relative p-4 rounded-xl border text-left transition-all flex flex-col justify-between gap-3 cursor-pointer",
                    !isMaster
                      ? "bg-indigo-500/10 border-indigo-500/60 shadow-lg shadow-indigo-500/10 ring-1 ring-indigo-500/40"
                      : "bg-[var(--dash-bg)] border-[var(--dash-border)] hover:border-slate-600 text-slate-300"
                  )}
                  id="role_retail_btn"
                >
                  <div className="flex items-center justify-between w-full">
                    <div className={cn(
                      "w-9 h-9 rounded-xl flex items-center justify-center transition-colors",
                      !isMaster ? "bg-indigo-600 text-white" : "bg-white/5 text-slate-400 border border-[var(--dash-border)]"
                    )}>
                      <Link2 size={18} />
                    </div>
                    <div className={cn(
                      "w-5 h-5 rounded-full border flex items-center justify-center transition-colors",
                      !isMaster ? "border-indigo-400 bg-indigo-600 text-white" : "border-slate-600 bg-transparent"
                    )}>
                      {!isMaster && <Check size={12} strokeWidth={3} />}
                    </div>
                  </div>

                  <div>
                    <h3 className="text-xs md:text-sm font-bold text-white">Act as Retail (Connected Store)</h3>
                    <p className="text-[11px] text-slate-400 mt-1 leading-relaxed">
                      Syncs catalog and stock from Master Hub while letting you set custom retail margins.
                    </p>
                  </div>
                </button>
              </div>
            </div>

            {/* Step 2: Role Details */}
            <div className="space-y-4">
              {isMaster ? (
                /* Master Credentials */
                <div className="bg-[var(--dash-card)] border border-[var(--dash-border)]/70 rounded-2xl p-4 md:p-6 shadow-xl space-y-4">
                  <div className="flex items-center justify-between pb-3 border-b border-[var(--dash-border)]/40">
                    <h3 className="text-xs font-bold uppercase tracking-wider text-slate-300 flex items-center gap-2">
                      <KeyRound size={15} className="text-indigo-400" /> Master API Access Key
                    </h3>
                    <button
                      type="button"
                      onClick={handleRegenerateKey}
                      className="text-xs text-indigo-400 hover:text-indigo-300 font-semibold transition-colors cursor-pointer"
                    >
                      Regenerate
                    </button>
                  </div>

                  <div>
                    <label className="text-xs font-semibold text-slate-400 mb-1.5 block">
                      Provide this key to your retail sub-branches:
                    </label>
                    <div className="flex items-center gap-2">
                      <input
                        type="text"
                        readOnly
                        value={masterApiKey}
                        className="flex-1 bg-[var(--dash-bg)] border border-[var(--dash-border)] rounded-xl px-4 py-2.5 text-xs md:text-sm text-white font-mono select-all focus:outline-none"
                      />
                      <button
                        type="button"
                        onClick={handleCopy}
                        className="px-4 py-2.5 rounded-xl bg-indigo-500/10 border border-indigo-500/20 text-indigo-400 hover:bg-indigo-500/20 font-bold text-xs flex items-center gap-1.5 transition-colors cursor-pointer shrink-0"
                      >
                        {copied ? <Check size={14} className="stroke-[3]" /> : <Copy size={14} />}
                        <span>{copied ? 'Copied' : 'Copy'}</span>
                      </button>
                    </div>
                  </div>
                </div>
              ) : (
                /* Retail Configuration */
                <div className="bg-[var(--dash-card)] border border-[var(--dash-border)]/70 rounded-2xl p-4 md:p-6 shadow-xl space-y-4">
                  <div className="pb-3 border-b border-[var(--dash-border)]/40">
                    <h3 className="text-xs font-bold uppercase tracking-wider text-slate-300 flex items-center gap-2">
                      <Globe2 size={15} className="text-indigo-400" /> Connect to Master Wholesale Hub
                    </h3>
                  </div>

                  <div className="space-y-3">
                    <div>
                      <label className="text-xs font-semibold text-slate-400 mb-1.5 block">
                        Master Store URL
                      </label>
                      <input
                        type="text"
                        value={connectedMasterUrl}
                        onChange={e => setConnectedMasterUrl(e.target.value)}
                        placeholder="e.g. https://wholesale-hub.com"
                        className="w-full bg-[var(--dash-bg)] border border-[var(--dash-border)] rounded-xl px-4 py-2.5 text-xs md:text-sm text-white focus:outline-none focus:border-indigo-500 transition-colors"
                      />
                    </div>

                    <div>
                      <label className="text-xs font-semibold text-slate-400 mb-1.5 block">
                        Master Store API Key
                      </label>
                      <input
                        type="password"
                        value={connectedMasterApiKey}
                        onChange={e => setConnectedMasterApiKey(e.target.value)}
                        placeholder="Paste Master Key here"
                        className="w-full bg-[var(--dash-bg)] border border-[var(--dash-border)] rounded-xl px-4 py-2.5 text-xs md:text-sm text-white focus:outline-none focus:border-indigo-500 transition-colors font-mono"
                      />
                    </div>

                    <div className="pt-2 flex gap-3">
                      <button
                        type="button"
                        onClick={handleConnect}
                        disabled={connectionStatus === 'testing'}
                        className="flex-1 py-2.5 px-4 rounded-xl font-bold text-xs md:text-sm bg-indigo-600 hover:bg-indigo-500 text-white transition-all disabled:opacity-50 flex items-center justify-center gap-2 cursor-pointer shadow-lg shadow-indigo-500/25 active:scale-95"
                      >
                        {connectionStatus === 'testing' ? (
                          <RefreshCw size={15} className="animate-spin" />
                        ) : (
                          <CheckCircle2 size={15} />
                        )}
                        <span>Verify & Connect</span>
                      </button>
                    </div>

                    {syncMessage && (
                      <div className={cn(
                        "p-3 rounded-xl text-xs flex items-center gap-2 border",
                        connectionStatus === 'error'
                          ? "bg-rose-500/10 text-rose-300 border border-rose-500/20"
                          : connectionStatus === 'success'
                          ? "bg-emerald-500/10 text-emerald-300 border border-emerald-500/20"
                          : "bg-indigo-500/10 text-indigo-300 border border-indigo-500/20"
                      )}>
                        {connectionStatus === 'error' && <AlertCircle size={15} className="shrink-0 text-rose-400" />}
                        {connectionStatus === 'success' && <CheckCircle2 size={15} className="shrink-0 text-emerald-400" />}
                        {connectionStatus === 'idle' && <Info size={15} className="shrink-0 text-indigo-400" />}
                        <span>{syncMessage}</span>
                      </div>
                    )}

                    {connectionStatus === 'success' && (
                      <div className="pt-2 border-t border-[var(--dash-border)]/40 mt-1">
                        <button
                          type="button"
                          onClick={handleForceSync}
                          disabled={isSyncing}
                          className="w-full py-3 px-4 rounded-xl font-bold text-xs md:text-sm bg-emerald-600 hover:bg-emerald-700 text-white transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 cursor-pointer shadow-lg shadow-emerald-600/20 active:scale-95"
                        >
                          {isSyncing ? (
                            <>
                              <RefreshCw size={15} className="animate-spin" />
                              <span>Pulling Catalog & Inventory...</span>
                            </>
                          ) : (
                            <>
                              <Database size={16} />
                              <span>Force Sync Catalog Now</span>
                            </>
                          )}
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
export default ApiSyncManager;
