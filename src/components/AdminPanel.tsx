import { useState, useEffect } from 'react';
import { X, Check, Trash2, Plus, RefreshCw, Search, Edit3, ChevronUp, Shield, Ban, AlertTriangle } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { setCredits, addCredits } from '../lib/credits';
import type { Company, Driver, PurchaseRequest, FlagReport } from '../lib/supabase';

interface Props {
  onClose: () => void;
}

type Tab = 'requests' | 'companies' | 'drivers' | 'credits' | 'reports' | 'networks';

interface CompanyWithCredits extends Company {
  search_credits: number;
  user_id: string | null;
}

interface RequestWithCompany extends PurchaseRequest {
  company: Company | null;
}

interface IpEntry {
  company_id: string;
  company_name: string;
  ip_address: string;
  registered_at: string;
  is_banned: boolean;
  ban_id: string | null;
}

interface BannedIp {
  id: string;
  ip_address: string;
  reason: string;
  created_at: string;
}

export function AdminPanel({ onClose }: Props) {
  const [tab, setTab] = useState<Tab>('requests');

  const [companies, setCompanies] = useState<CompanyWithCredits[]>([]);
  const [drivers, setDrivers] = useState<Driver[]>([]);
  const [requests, setRequests] = useState<RequestWithCompany[]>([]);
  const [reports, setReports] = useState<FlagReport[]>([]);
  const [ipEntries, setIpEntries] = useState<IpEntry[]>([]);

  // Search queries per tab
  const [driverSearch, setDriverSearch] = useState('');
  const [companySearch, setCompanySearch] = useState('');
  const [reportSearch, setReportSearch] = useState('');
  const [networkSearch, setNetworkSearch] = useState('');

  // Credit form — now uses company id directly
  const [creditCompanyId, setCreditCompanyId] = useState('');
  const [creditAmount, setCreditAmount] = useState('');
  const [creditAction, setCreditAction] = useState<'set' | 'add'>('set');
  const [creditLoading, setCreditLoading] = useState(false);

  // Edit driver inline
  const [editingDriver, setEditingDriver] = useState<string | null>(null);
  const [editScore, setEditScore] = useState('');
  const [editFlag, setEditFlag] = useState<'green' | 'yellow' | 'red'>('green');

  // Ban modal
  const [banningIp, setBanningIp] = useState<string | null>(null);
  const [banReason, setBanReason] = useState('');
  const [banLoading, setBanLoading] = useState(false);

  const [status, setStatus] = useState('');
  const [statusOk, setStatusOk] = useState(true);

  const showStatus = (msg: string, ok = true) => {
    setStatus(msg);
    setStatusOk(ok);
    setTimeout(() => setStatus(''), 3000);
  };

  // ── Loaders ────────────────────────────────────────────────────────────────
  const loadCompanies = async () => {
    const { data: rows } = await supabase.from('companies').select('*').order('created_at', { ascending: false });
    if (!rows) return;

    const enriched: CompanyWithCredits[] = await Promise.all(
      rows.map(async (c) => {
        const { data: cu } = await supabase
          .from('company_users').select('user_id').eq('company_id', c.id).maybeSingle();
        const userId = cu?.user_id ?? null;
        let credits = 0;
        if (userId) {
          const { data: uc } = await supabase
            .from('user_credits').select('search_credits').eq('user_id', userId).maybeSingle();
          credits = uc?.search_credits ?? 0;
        }
        return { ...c, search_credits: credits, user_id: userId };
      })
    );
    setCompanies(enriched);
  };

  const loadDrivers = async () => {
    const { data } = await supabase
      .from('drivers').select('*, driver_comments(*)').order('created_at', { ascending: false });
    setDrivers((data as Driver[]) ?? []);
  };

  const loadRequests = async () => {
    const { data: reqs } = await supabase
      .from('purchase_requests').select('*').order('created_at', { ascending: false });
    if (!reqs) return;

    const enriched: RequestWithCompany[] = await Promise.all(
      reqs.map(async (r) => {
        const { data: company } = await supabase
          .from('companies').select('*').eq('id', r.company_id).maybeSingle();
        return { ...r, company: company ?? null };
      })
    );
    setRequests(enriched);
  };

  const loadReports = async () => {
    const { data } = await supabase
      .from('flag_reports').select('*').order('created_at', { ascending: false });
    setReports((data as FlagReport[]) ?? []);
  };

  const loadNetworks = async () => {
    const { data: ipRows } = await supabase
      .from('company_ip_log')
      .select('company_id, ip_address, created_at')
      .order('created_at', { ascending: false });

    const { data: bannedRows } = await supabase
      .from('banned_ips')
      .select('id, ip_address, reason, created_at');

    if (!ipRows) return;

    const bannedMap = new Map<string, BannedIp>();
    (bannedRows ?? []).forEach((b: BannedIp) => bannedMap.set(b.ip_address, b));

    // Get company names
    const companyIds = [...new Set(ipRows.map((r: { company_id: string }) => r.company_id))];
    const { data: compRows } = await supabase
      .from('companies').select('id, name').in('id', companyIds);
    const nameMap = new Map<string, string>();
    (compRows ?? []).forEach((c: { id: string; name: string }) => nameMap.set(c.id, c.name));

    const entries: IpEntry[] = ipRows.map((r: { company_id: string; ip_address: string; created_at: string }) => {
      const ban = bannedMap.get(r.ip_address);
      return {
        company_id: r.company_id,
        company_name: nameMap.get(r.company_id) ?? 'Unknown',
        ip_address: r.ip_address,
        registered_at: r.created_at,
        is_banned: !!ban,
        ban_id: ban?.id ?? null,
      };
    });

    setIpEntries(entries);
  };

  useEffect(() => {
    if (tab === 'companies') loadCompanies();
    else if (tab === 'drivers') loadDrivers();
    else if (tab === 'requests') loadRequests();
    else if (tab === 'credits') loadCompanies();
    else if (tab === 'reports') loadReports();
    else if (tab === 'networks') loadNetworks();
  }, [tab]);

  // ── Actions ────────────────────────────────────────────────────────────────
  const deleteCompany = async (id: string) => {
    if (!confirm('Delete this company and all associated data?')) return;
    const { error } = await supabase.from('companies').delete().eq('id', id);
    if (error) { showStatus('Delete failed: ' + error.message, false); return; }
    showStatus('Company deleted.');
    loadCompanies();
  };

  const deleteDriver = async (id: string) => {
    if (!confirm('Delete this driver record?')) return;
    const { error } = await supabase.from('drivers').delete().eq('id', id);
    if (error) { showStatus('Delete failed: ' + error.message, false); return; }
    showStatus('Driver deleted.');
    loadDrivers();
  };

  const saveDriverEdit = async (id: string) => {
    const { error } = await supabase.from('drivers').update({
      score: parseInt(editScore) || 0,
      flag: editFlag,
    }).eq('id', id);
    if (error) { showStatus('Update failed.', false); return; }
    showStatus('Driver updated.');
    setEditingDriver(null);
    loadDrivers();
  };

  const approveRequest = async (req: RequestWithCompany) => {
    if (!req.company) return;
    const { data, error } = await supabase.rpc('approve_purchase_request', {
      p_company_id: req.company_id,
      p_credit_amount: req.search_count,
    });
    if (error || !data?.success) {
      showStatus(data?.error ?? error?.message ?? 'Failed to approve request.', false);
      return;
    }
    await supabase.from('purchase_requests').delete().eq('id', req.id);
    showStatus(`Approved — ${req.search_count} credits added to ${req.company.name}.`);
    loadRequests();
    loadCompanies();
  };

  const deleteRequest = async (id: string) => {
    await supabase.from('purchase_requests').delete().eq('id', id);
    loadRequests();
  };

  const resolveReport = async (id: string) => {
    await supabase.from('flag_reports').update({ status: 'resolved' }).eq('id', id);
    loadReports();
  };

  const deleteReportedDriver = async (driverId: string | null, reportId: string) => {
    if (!driverId) return;
    if (!confirm('Delete this driver record permanently?')) return;
    await supabase.from('drivers').delete().eq('id', driverId);
    await supabase.from('flag_reports').update({ status: 'resolved' }).eq('id', reportId);
    showStatus('Driver deleted and report resolved.');
    loadReports();
    loadDrivers();
  };

  const deleteReportedComment = async (commentId: string | null, reportId: string) => {
    if (!commentId) return;
    if (!confirm('Delete this comment permanently?')) return;
    await supabase.from('driver_comments').delete().eq('id', commentId);
    await supabase.from('flag_reports').update({ status: 'resolved' }).eq('id', reportId);
    showStatus('Comment deleted and report resolved.');
    loadReports();
  };

  const dismissReport = async (id: string) => {
    await supabase.from('flag_reports').delete().eq('id', id);
    loadReports();
  };

  const banIp = async () => {
    if (!banningIp) return;
    setBanLoading(true);
    const { error } = await supabase.from('banned_ips').insert({
      ip_address: banningIp,
      reason: banReason.trim() || 'Manually banned by admin',
    });
    setBanLoading(false);
    if (error) { showStatus('Failed to ban IP: ' + error.message, false); return; }
    showStatus(`IP ${banningIp} has been banned.`);
    setBanningIp(null);
    setBanReason('');
    loadNetworks();
  };

  const unbanIp = async (banId: string, ip: string) => {
    const { error } = await supabase.from('banned_ips').delete().eq('id', banId);
    if (error) { showStatus('Failed to remove ban.', false); return; }
    showStatus(`Ban removed for ${ip}.`);
    loadNetworks();
  };

  const handleCreditSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const amt = parseInt(creditAmount);
    if (!creditCompanyId.trim() || isNaN(amt) || amt < 0) {
      showStatus('Select a company and enter a valid amount.', false);
      return;
    }

    // Get the user_id for the selected company
    const selectedCompany = companies.find(c => c.id === creditCompanyId);
    if (!selectedCompany?.user_id) {
      showStatus('This company has no linked user account.', false);
      return;
    }

    setCreditLoading(true);
    const ok = creditAction === 'set'
      ? await setCredits(selectedCompany.user_id, amt)
      : await addCredits(selectedCompany.user_id, amt);
    setCreditLoading(false);
    if (ok) {
      showStatus(`Credits ${creditAction === 'set' ? 'set to' : 'added:'} ${amt} for ${selectedCompany.name}.`);
      setCreditCompanyId('');
      setCreditAmount('');
      loadCompanies();
    } else {
      showStatus('Failed to update credits.', false);
    }
  };

  // ── Filtered lists ─────────────────────────────────────────────────────────
  const filteredDrivers = driverSearch.trim()
    ? drivers.filter(d => d.full_name.toLowerCase().includes(driverSearch.toLowerCase()))
    : drivers;

  const filteredCompanies = companySearch.trim()
    ? companies.filter(c =>
        c.name.toLowerCase().includes(companySearch.toLowerCase()) ||
        c.email.toLowerCase().includes(companySearch.toLowerCase()) ||
        c.mc_number.toLowerCase().includes(companySearch.toLowerCase())
      )
    : companies;

  const filteredReports = reportSearch.trim()
    ? reports.filter(r =>
        r.driver_name.toLowerCase().includes(reportSearch.toLowerCase()) ||
        r.reporter_company_name.toLowerCase().includes(reportSearch.toLowerCase()) ||
        r.reason.toLowerCase().includes(reportSearch.toLowerCase())
      )
    : reports;

  const filteredNetworks = networkSearch.trim()
    ? ipEntries.filter(e =>
        e.ip_address.includes(networkSearch) ||
        e.company_name.toLowerCase().includes(networkSearch.toLowerCase())
      )
    : ipEntries;

  const openReports = reports.filter(r => r.status === 'open').length;
  const pendingReqs = requests.filter(r => r.status === 'pending').length;
  const bannedCount = ipEntries.filter(e => e.is_banned).length;

  const tabs: { key: Tab; label: string; badge?: number }[] = [
    { key: 'requests', label: 'Requests', badge: pendingReqs },
    { key: 'companies', label: 'Companies' },
    { key: 'drivers', label: 'Drivers' },
    { key: 'credits', label: 'Credits' },
    { key: 'reports', label: 'Reports', badge: openReports },
    { key: 'networks', label: 'Networks', badge: bannedCount > 0 ? bannedCount : undefined },
  ];

  return (
    <div className="fixed inset-0 bg-black/50 flex items-start justify-center z-50 p-4 overflow-y-auto">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl my-4">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100 sticky top-0 bg-white rounded-t-2xl z-10">
          <div>
            <h2 className="text-base font-bold text-gray-900">Admin Panel</h2>
            <p className="text-xs text-gray-500 mt-0.5">Manage companies, drivers, credits, reports, and networks</p>
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-700 transition"><X size={18} /></button>
        </div>

        {/* Tabs */}
        <div className="flex border-b border-gray-100 px-2 overflow-x-auto">
          {tabs.map(t => (
            <button
              key={t.key}
              onClick={() => setTab(t.key)}
              className={`px-4 py-3 text-xs font-semibold border-b-2 transition whitespace-nowrap flex items-center gap-1.5 ${
                tab === t.key ? 'border-gray-900 text-gray-900' : 'border-transparent text-gray-400 hover:text-gray-700'
              }`}
            >
              {t.label}
              {t.badge != null && t.badge > 0 && (
                <span className="inline-flex items-center justify-center w-4 h-4 bg-red-500 text-white text-[10px] rounded-full">
                  {t.badge}
                </span>
              )}
            </button>
          ))}
        </div>

        {/* Status bar */}
        {status && (
          <div className={`mx-4 mt-3 px-3 py-2 rounded-lg text-xs font-medium ${statusOk ? 'bg-emerald-50 text-emerald-700 border border-emerald-200' : 'bg-red-50 text-red-700 border border-red-200'}`}>
            {status}
          </div>
        )}

        <div className="p-6">

          {/* ── PURCHASE REQUESTS ── */}
          {tab === 'requests' && (
            <div className="space-y-3">
              <p className="text-xs text-gray-500">{pendingReqs} pending request(s)</p>
              {requests.length === 0 && <p className="text-sm text-gray-400 text-center py-8">No purchase requests yet.</p>}
              {requests.map(req => (
                <div key={req.id} className={`border rounded-xl p-4 ${req.status === 'pending' ? 'border-amber-200 bg-amber-50/40' : 'border-gray-200 bg-gray-50/40'}`}>
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <p className="text-sm font-bold text-gray-900">{req.company?.name ?? '—'}</p>
                        <span className={`text-[11px] font-semibold px-2 py-0.5 rounded-full ${req.status === 'pending' ? 'bg-amber-100 text-amber-700' : 'bg-emerald-100 text-emerald-700'}`}>
                          {req.status.toUpperCase()}
                        </span>
                      </div>
                      <p className="text-xs text-gray-500 mt-0.5">{req.company?.email}</p>
                      <p className="text-xs text-gray-600 mt-2">
                        <span className="font-semibold text-gray-900">{req.search_count}</span> searches ·{' '}
                        <span className="font-semibold text-gray-900">${Number(req.total_cost).toFixed(2)}</span>
                      </p>
                      <p className="text-[11px] text-gray-400 mt-1">{new Date(req.created_at).toLocaleString()}</p>
                    </div>
                    <div className="flex gap-2 flex-shrink-0">
                      {req.status === 'pending' && (
                        <button onClick={() => approveRequest(req)} className="flex items-center gap-1 px-3 py-1.5 bg-gray-900 text-white text-xs font-semibold rounded-lg hover:bg-gray-700 transition">
                          <Check size={13} /> Approve
                        </button>
                      )}
                      <button onClick={() => deleteRequest(req.id)} className="p-1.5 text-gray-400 hover:text-red-500 transition">
                        <Trash2 size={15} />
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* ── COMPANIES ── */}
          {tab === 'companies' && (
            <div className="space-y-3">
              <div className="relative">
                <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
                <input
                  value={companySearch}
                  onChange={e => setCompanySearch(e.target.value)}
                  placeholder="Search companies…"
                  className="w-full pl-8 pr-3 py-2 border border-gray-200 rounded-lg text-xs focus:outline-none focus:ring-2 focus:ring-gray-900"
                />
              </div>
              <p className="text-xs text-gray-500">{filteredCompanies.length} of {companies.length} companies</p>
              {filteredCompanies.length === 0 && <p className="text-sm text-gray-400 text-center py-8">No companies found.</p>}
              <div className="space-y-2 max-h-[420px] overflow-y-auto pr-1">
                {filteredCompanies.map(c => (
                  <div key={c.id} className="border border-gray-200 rounded-xl p-4 flex items-center justify-between gap-4">
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-bold text-gray-900 truncate">{c.name}</p>
                      <p className="text-xs text-gray-500">MC: {c.mc_number} · {c.email}</p>
                      <div className="flex items-center gap-3 mt-1.5">
                        <span className="text-xs"><span className="text-gray-500">Credits:</span> <span className="font-bold text-gray-900">{c.search_credits}</span></span>
                        {c.user_id && <span className="text-[10px] text-gray-400 font-mono">uid: {c.user_id.slice(0, 8)}…</span>}
                      </div>
                    </div>
                    <button onClick={() => deleteCompany(c.id)} className="p-1.5 text-gray-400 hover:text-red-500 transition flex-shrink-0">
                      <Trash2 size={16} />
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* ── DRIVERS ── */}
          {tab === 'drivers' && (
            <div className="space-y-3">
              <div className="relative">
                <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
                <input
                  value={driverSearch}
                  onChange={e => setDriverSearch(e.target.value)}
                  placeholder="Search drivers by name…"
                  className="w-full pl-8 pr-3 py-2 border border-gray-200 rounded-lg text-xs focus:outline-none focus:ring-2 focus:ring-gray-900"
                />
              </div>
              <p className="text-xs text-gray-500">{filteredDrivers.length} of {drivers.length} driver records</p>
              {filteredDrivers.length === 0 && <p className="text-sm text-gray-400 text-center py-8">No drivers found.</p>}
              <div className="space-y-2 max-h-[420px] overflow-y-auto pr-1">
                {filteredDrivers.map(d => (
                  <div key={d.id} className="border border-gray-200 rounded-xl overflow-hidden">
                    <div className="px-4 py-3 flex items-center justify-between gap-4">
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-semibold text-gray-900 truncate">{d.full_name}</p>
                        <div className="flex items-center gap-3 text-xs text-gray-500 mt-0.5">
                          <span>Score: <span className="font-semibold text-gray-800">{d.score}</span></span>
                          <span className={`font-semibold ${d.flag === 'green' ? 'text-emerald-600' : d.flag === 'yellow' ? 'text-amber-600' : 'text-red-600'}`}>
                            {d.flag === 'green' ? 'Cleared' : d.flag === 'yellow' ? 'Check' : 'High Risk'}
                          </span>
                        </div>
                      </div>
                      <div className="flex gap-1.5 flex-shrink-0">
                        <button
                          onClick={() => {
                            if (editingDriver === d.id) { setEditingDriver(null); return; }
                            setEditingDriver(d.id);
                            setEditScore(String(d.score));
                            setEditFlag(d.flag);
                          }}
                          className="p-1.5 text-gray-400 hover:text-gray-900 transition"
                          title="Edit"
                        >
                          {editingDriver === d.id ? <ChevronUp size={15} /> : <Edit3 size={14} />}
                        </button>
                        <button onClick={() => deleteDriver(d.id)} className="p-1.5 text-gray-400 hover:text-red-500 transition">
                          <Trash2 size={15} />
                        </button>
                      </div>
                    </div>

                    {editingDriver === d.id && (
                      <div className="border-t border-gray-100 px-4 py-3 bg-gray-50 flex items-end gap-3 flex-wrap">
                        <div>
                          <label className="block text-[11px] font-medium text-gray-600 mb-1">Score</label>
                          <input
                            type="number" min={0} max={100} value={editScore}
                            onChange={e => setEditScore(e.target.value)}
                            className="w-16 px-2 py-1.5 border border-gray-300 rounded-lg text-xs text-center focus:outline-none focus:ring-1 focus:ring-gray-900"
                          />
                        </div>
                        <div>
                          <label className="block text-[11px] font-medium text-gray-600 mb-1">Flag</label>
                          <div className="flex gap-1.5">
                            {(['green', 'yellow', 'red'] as const).map(f => (
                              <button
                                key={f} type="button" onClick={() => setEditFlag(f)}
                                className={`px-2.5 py-1 text-[11px] font-semibold border rounded-lg transition ${
                                  editFlag === f
                                    ? f === 'green' ? 'bg-emerald-500 text-white border-emerald-500'
                                      : f === 'yellow' ? 'bg-amber-400 text-white border-amber-400'
                                      : 'bg-red-500 text-white border-red-500'
                                    : 'border-gray-200 text-gray-500 hover:bg-gray-100'
                                }`}
                              >
                                {f === 'green' ? 'Cleared' : f === 'yellow' ? 'Check' : 'High Risk'}
                              </button>
                            ))}
                          </div>
                        </div>
                        <button
                          onClick={() => saveDriverEdit(d.id)}
                          className="px-3 py-1.5 bg-gray-900 text-white text-xs font-semibold rounded-lg hover:bg-gray-700 transition"
                        >
                          Save
                        </button>
                        <button
                          onClick={() => setEditingDriver(null)}
                          className="px-3 py-1.5 border border-gray-300 text-gray-600 text-xs font-semibold rounded-lg hover:bg-gray-50 transition"
                        >
                          Cancel
                        </button>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* ── CREDITS ── */}
          {tab === 'credits' && (
            <div className="space-y-4">
              <p className="text-xs text-gray-500">Manually set or add credits for any registered company.</p>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Action</label>
                <div className="flex border border-gray-300 rounded-lg overflow-hidden">
                  {(['set', 'add'] as const).map(a => (
                    <button
                      key={a} type="button" onClick={() => setCreditAction(a)}
                      className={`flex-1 py-2 text-sm font-semibold flex items-center justify-center gap-1.5 transition ${
                        creditAction === a ? 'bg-gray-900 text-white' : 'bg-white text-gray-600 hover:bg-gray-50'
                      }`}
                    >
                      {a === 'set' ? <RefreshCw size={13} /> : <Plus size={13} />}
                      {a === 'set' ? 'Set Amount' : 'Add Amount'}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Company</label>
                {companies.length === 0 ? (
                  <p className="text-xs text-gray-400 py-2">Loading companies…</p>
                ) : (
                  <select
                    value={creditCompanyId}
                    onChange={e => setCreditCompanyId(e.target.value)}
                    className="w-full px-3 py-2.5 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-gray-900 bg-white"
                  >
                    <option value="">— Select a company —</option>
                    {companies.map(c => (
                      <option key={c.id} value={c.id} disabled={!c.user_id}>
                        {c.name} — {c.search_credits} credits{!c.user_id ? ' (no user)' : ''}
                      </option>
                    ))}
                  </select>
                )}
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  {creditAction === 'set' ? 'Set credits to' : 'Add credits'}
                </label>
                <input
                  type="number" min={0} value={creditAmount}
                  onChange={e => setCreditAmount(e.target.value)}
                  placeholder="e.g. 10"
                  className="w-full px-3 py-2.5 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-gray-900"
                />
              </div>

              <button
                onClick={handleCreditSubmit}
                disabled={creditLoading || !creditCompanyId || !creditAmount}
                className="w-full bg-gray-900 text-white py-2.5 rounded-lg text-sm font-semibold hover:bg-gray-800 transition disabled:opacity-50"
              >
                {creditLoading ? 'Updating…' : 'Update Credits'}
              </button>
            </div>
          )}

          {/* ── REPORTS ── */}
          {tab === 'reports' && (
            <div className="space-y-3">
              <div className="relative">
                <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
                <input
                  value={reportSearch}
                  onChange={e => setReportSearch(e.target.value)}
                  placeholder="Search reports…"
                  className="w-full pl-8 pr-3 py-2 border border-gray-200 rounded-lg text-xs focus:outline-none focus:ring-2 focus:ring-gray-900"
                />
              </div>
              <p className="text-xs text-gray-500">{filteredReports.length} report(s) · {openReports} open</p>
              {filteredReports.length === 0 && <p className="text-sm text-gray-400 text-center py-8">No reports found.</p>}
              <div className="space-y-3 max-h-[480px] overflow-y-auto pr-1">
                {filteredReports.map(r => (
                  <div key={r.id} className={`border rounded-xl p-4 ${r.status === 'open' ? 'border-amber-200 bg-amber-50/30' : 'border-gray-200 bg-gray-50/30'}`}>
                    <div className="flex items-start justify-between gap-3 mb-2">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full uppercase ${
                          r.report_type === 'driver' ? 'bg-blue-100 text-blue-700' : 'bg-orange-100 text-orange-700'
                        }`}>
                          {r.report_type === 'driver' ? 'Driver Record' : 'Comment'}
                        </span>
                        <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full uppercase ${
                          r.status === 'open' ? 'bg-amber-100 text-amber-700' : 'bg-gray-100 text-gray-500'
                        }`}>
                          {r.status}
                        </span>
                        <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full uppercase ${
                          r.action_requested === 'deletion' ? 'bg-red-100 text-red-700'
                            : r.action_requested === 'correction' ? 'bg-emerald-100 text-emerald-700'
                            : 'bg-gray-100 text-gray-600'
                        }`}>
                          {r.action_requested}
                        </span>
                      </div>
                      <p className="text-[11px] text-gray-400 flex-shrink-0">{new Date(r.created_at).toLocaleDateString()}</p>
                    </div>

                    <p className="text-sm font-semibold text-gray-900 mb-0.5">{r.driver_name}</p>
                    <p className="text-xs text-gray-500 mb-2">Reported by: {r.reporter_company_name}</p>
                    <p className="text-xs text-gray-700 bg-white border border-gray-100 rounded-lg px-3 py-2 leading-relaxed">{r.reason}</p>

                    {r.status === 'open' && (
                      <div className="flex gap-2 mt-3 flex-wrap">
                        {r.report_type === 'driver' && r.driver_id && (
                          <button
                            onClick={() => deleteReportedDriver(r.driver_id, r.id)}
                            className="flex items-center gap-1 px-3 py-1.5 bg-red-600 text-white text-xs font-semibold rounded-lg hover:bg-red-700 transition"
                          >
                            <Trash2 size={11} /> Delete Driver
                          </button>
                        )}
                        {r.report_type === 'comment' && r.comment_id && (
                          <button
                            onClick={() => deleteReportedComment(r.comment_id, r.id)}
                            className="flex items-center gap-1 px-3 py-1.5 bg-red-600 text-white text-xs font-semibold rounded-lg hover:bg-red-700 transition"
                          >
                            <Trash2 size={11} /> Delete Comment
                          </button>
                        )}
                        <button
                          onClick={() => resolveReport(r.id)}
                          className="flex items-center gap-1 px-3 py-1.5 bg-emerald-600 text-white text-xs font-semibold rounded-lg hover:bg-emerald-700 transition"
                        >
                          <Check size={11} /> Mark Resolved
                        </button>
                        <button
                          onClick={() => dismissReport(r.id)}
                          className="flex items-center gap-1 px-3 py-1.5 border border-gray-300 text-gray-600 text-xs font-semibold rounded-lg hover:bg-gray-50 transition"
                        >
                          <X size={11} /> Dismiss
                        </button>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* ── NETWORKS ── */}
          {tab === 'networks' && (
            <div className="space-y-3">
              <div className="flex items-start gap-3 bg-gray-50 border border-gray-200 rounded-xl px-4 py-3">
                <Shield size={14} className="text-gray-500 mt-0.5 flex-shrink-0" />
                <p className="text-xs text-gray-600 leading-relaxed">
                  IP addresses are logged when companies register. No automatic blocking occurs — use the Ban button to manually block a network from future registrations.
                </p>
              </div>

              <div className="relative">
                <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
                <input
                  value={networkSearch}
                  onChange={e => setNetworkSearch(e.target.value)}
                  placeholder="Search by IP or company name…"
                  className="w-full pl-8 pr-3 py-2 border border-gray-200 rounded-lg text-xs focus:outline-none focus:ring-2 focus:ring-gray-900"
                />
              </div>

              <p className="text-xs text-gray-500">
                {filteredNetworks.length} registration(s) · {ipEntries.filter(e => e.is_banned).length} banned
              </p>

              {filteredNetworks.length === 0 && (
                <p className="text-sm text-gray-400 text-center py-8">No IP records found.</p>
              )}

              <div className="space-y-2 max-h-[420px] overflow-y-auto pr-1">
                {filteredNetworks.map((entry, i) => (
                  <div
                    key={i}
                    className={`border rounded-xl p-4 flex items-center justify-between gap-4 ${
                      entry.is_banned ? 'border-red-200 bg-red-50/30' : 'border-gray-200'
                    }`}
                  >
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <p className="text-sm font-bold text-gray-900 font-mono">{entry.ip_address}</p>
                        {entry.is_banned && (
                          <span className="text-[10px] font-bold px-2 py-0.5 bg-red-100 text-red-700 rounded-full uppercase">Banned</span>
                        )}
                      </div>
                      <p className="text-xs text-gray-600 mt-0.5">{entry.company_name}</p>
                      <p className="text-[11px] text-gray-400 mt-0.5">
                        Registered {new Date(entry.registered_at).toLocaleString()}
                      </p>
                    </div>
                    <div className="flex-shrink-0">
                      {entry.is_banned ? (
                        <button
                          onClick={() => unbanIp(entry.ban_id!, entry.ip_address)}
                          className="flex items-center gap-1.5 px-3 py-1.5 border border-gray-300 text-gray-700 text-xs font-semibold rounded-lg hover:bg-gray-50 transition"
                        >
                          <Check size={12} /> Remove Ban
                        </button>
                      ) : (
                        <button
                          onClick={() => { setBanningIp(entry.ip_address); setBanReason(''); }}
                          className="flex items-center gap-1.5 px-3 py-1.5 bg-red-600 text-white text-xs font-semibold rounded-lg hover:bg-red-700 transition"
                        >
                          <Ban size={12} /> Ban IP
                        </button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Ban IP modal */}
      {banningIp && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-[60] p-4">
          <div className="bg-white rounded-2xl shadow-2xl max-w-sm w-full px-7 py-6">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 bg-red-100 rounded-full flex items-center justify-center flex-shrink-0">
                <AlertTriangle size={18} className="text-red-600" />
              </div>
              <div>
                <h3 className="text-sm font-bold text-gray-900">Ban IP Address</h3>
                <p className="text-xs text-gray-500 font-mono mt-0.5">{banningIp}</p>
              </div>
            </div>
            <p className="text-xs text-gray-600 mb-4 leading-relaxed">
              This IP will be flagged as banned. Currently this is informational — use it to track suspicious networks. Future enforcement can be added as needed.
            </p>
            <div className="mb-4">
              <label className="block text-xs font-medium text-gray-700 mb-1">Reason (optional)</label>
              <input
                type="text"
                value={banReason}
                onChange={e => setBanReason(e.target.value)}
                placeholder="e.g. Multiple registration attempts"
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-gray-900"
              />
            </div>
            <div className="flex gap-2">
              <button
                onClick={() => setBanningIp(null)}
                className="flex-1 border border-gray-300 text-gray-700 py-2 rounded-lg text-sm font-semibold hover:bg-gray-50 transition"
              >
                Cancel
              </button>
              <button
                onClick={banIp}
                disabled={banLoading}
                className="flex-1 bg-red-600 text-white py-2 rounded-lg text-sm font-semibold hover:bg-red-700 transition disabled:opacity-50"
              >
                {banLoading ? 'Banning…' : 'Confirm Ban'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
