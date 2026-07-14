import { useLoaderData, useNavigate, useSearchParams } from "react-router";
import { useState, useCallback } from "react";
import { boundary } from "@shopify/shopify-app-react-router/server";
import { authenticate } from "../shopify.server";
import { loadAnalytics } from "../services/analyticsService.server.js";
import "../styles/dashboard.css";
import {
  Page, Frame, Box, Button, Popover, DatePicker, TextField,
  InlineStack, BlockStack, Text,
} from "@shopify/polaris";
import {
  LineChart, Line, BarChart, Bar, XAxis, YAxis, CartesianGrid,
  Tooltip as RTooltip, Legend, ResponsiveContainer,
} from "recharts";

export const loader = async ({ request }) => {
  const { session } = await authenticate.admin(request);
  const url = new URL(request.url);
  return await loadAnalytics(session, {
    dateFrom: url.searchParams.get("from") || "",
    dateTo: url.searchParams.get("to") || "",
    search: url.searchParams.get("q") || "",
  });
};

const SERVICE_ICONS = {
  order_confirmation_whatsapp: "✓",
  order_fulfillment: "📦",
  order_paid: "💰",
  order_cancelled: "❌",
  order_delivered: "✅",
  abandoned_checkout: "🛒",
};

const STATUS_COLORS = {
  sent: { bg: "#e4f5e9", color: "#1a8245" },
  delivered: { bg: "#e0f2fe", color: "#0369a1" },
  read: { bg: "#ede9fe", color: "#6d28d9" },
  failed: { bg: "#fff0f0", color: "#e51c00" },
  pending: { bg: "#fff8e6", color: "#8b6914" },
};

export default function Analytics() {
  const { summary, serviceStats, dailyStats, messagesByType, recentMessages, quickStats, dateFrom, dateTo } = useLoaderData();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();

  const [search, setSearch] = useState(searchParams.get("q") || "");
  const [datePickerActive, setDatePickerActive] = useState(false);

  const now = new Date();
  const [{ month: pickerMonth, year: pickerYear }, setPickerDate] = useState({ month: now.getMonth(), year: now.getFullYear() });
  const [selectedDates, setSelectedDates] = useState(
    dateFrom && dateTo ? { start: new Date(dateFrom), end: new Date(dateTo) } : { start: now, end: now }
  );
  const hasDateFilter = !!(dateFrom && dateTo);

  const applyFilters = useCallback((from, to, q) => {
    const params = new URLSearchParams();
    if (from) params.set("from", from);
    if (to) params.set("to", to);
    if (q) params.set("q", q);
    setSearchParams(params);
  }, [setSearchParams]);

  const handleDateApply = () => {
    const from = selectedDates.start.toISOString().split("T")[0];
    const to = selectedDates.end.toISOString().split("T")[0];
    applyFilters(from, to, search);
    setDatePickerActive(false);
  };

  const handleSearch = () => applyFilters(dateFrom, dateTo, search);

  const handleClear = () => {
    setSearch("");
    setSearchParams(new URLSearchParams());
    setDatePickerActive(false);
  };

  const getDateLabel = () => {
    if (hasDateFilter) {
      const fmt = (d) => new Date(d).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
      return `${fmt(dateFrom)} — ${fmt(dateTo)}`;
    }
    return "Last 7 Days";
  };

  const handleExport = () => {
    const rows = [
      ["Service", "Total", "Sent", "Error"],
      ...serviceStats.map((s) => [s.label, s.total, s.sent, s.error]),
    ];
    const csv = rows.map((r) => r.join(",")).join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `sendly-analytics-${new Date().toISOString().split("T")[0]}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const quickActions = [
    { icon: "⚡", label: "Manage Services", sub: `${quickStats.activeServices} active`, path: "/app/services" },
    { icon: "📝", label: "Templates", sub: `${quickStats.approvedTemplates} approved`, path: "/app/templates" },
    { icon: "📊", label: "Message Logs", sub: `${quickStats.allTimeMessages} total`, path: "/app/message-logs" },
    { icon: "📢", label: "Campaigns", sub: `${quickStats.activeCampaigns} active`, path: "/app/campaigns" },
    { icon: "⚙️", label: "Settings", sub: quickStats.whatsappConnected ? "Connected" : "Not connected", path: "/app/settings" },
  ];

  const fmt = (n) => {
    const num = Number(n) || 0;
    if (num >= 1_000_000) return (num / 1_000_000).toFixed(num % 1_000_000 === 0 ? 0 : 1) + "M";
    if (num >= 1_000) return (num / 1_000).toFixed(num % 1_000 === 0 ? 0 : 1) + "K";
    return String(num);
  };

  return (
    <Frame>
      <Page title="Analytics" subtitle="Track message performance across all your notification services.">

        {/* ==================== FILTERS ==================== */}
        <Box paddingBlockEnd="400">
          <InlineStack gap="300" align="space-between" blockAlign="center" wrap>
            <InlineStack gap="300" blockAlign="center">
              <Popover
                active={datePickerActive}
                activator={<Button onClick={() => setDatePickerActive(!datePickerActive)} disclosure>{getDateLabel()}</Button>}
                onClose={() => setDatePickerActive(false)}
                preferredAlignment="left"
              >
                <div style={{ padding: "16px", width: "340px" }}>
                  <BlockStack gap="300">
                    <InlineStack gap="200" blockAlign="center">
                      <Text variant="bodySm" tone="subdued" as="span">
                        {selectedDates.start.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}
                      </Text>
                      <Text variant="bodySm" tone="subdued" as="span">→</Text>
                      <Text variant="bodySm" tone="subdued" as="span">
                        {selectedDates.end.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}
                      </Text>
                    </InlineStack>
                    <DatePicker
                      month={pickerMonth} year={pickerYear}
                      onChange={setSelectedDates}
                      onMonthChange={(m, y) => setPickerDate({ month: m, year: y })}
                      selected={selectedDates} allowRange
                    />
                    <InlineStack align="end" gap="200">
                      {hasDateFilter && <Button onClick={handleClear}>Clear</Button>}
                      <Button onClick={() => setDatePickerActive(false)}>Cancel</Button>
                      <Button variant="primary" onClick={handleDateApply}>Apply</Button>
                    </InlineStack>
                  </BlockStack>
                </div>
              </Popover>

              <div style={{ minWidth: "220px" }}>
                <TextField
                  label="Search" labelHidden
                  value={search} onChange={setSearch}
                  placeholder="Search order, customer, phone..."
                  autoComplete="off"
                />
              </div>
              <Button onClick={handleSearch}>Search</Button>
            </InlineStack>

            <Button onClick={handleExport}>⬇ Export</Button>
          </InlineStack>
        </Box>

        {/* ==================== SUMMARY CARDS ==================== */}
        <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: "16px", marginBottom: "20px" }}>
          {[
            { icon: "💬", label: "Total Messages", value: summary.totalMessages, sub: null, bg: "#f5f3ff", color: "#7c3aed" },
            { icon: "✓", label: "Successful", value: summary.successCount, sub: `${summary.successRate}%`, bg: "#f0fdf4", color: "#16a34a" },
            { icon: "!", label: "Failed", value: summary.failedCount, sub: `${summary.failedRate}%`, bg: "#fef2f2", color: "#dc2626" },
          ].map((c, i) => (
            <div key={i} className="dash-card" style={{ display: "flex", alignItems: "center", gap: "16px" }}>
              <div style={{ width: "44px", height: "44px", borderRadius: "12px", background: c.bg, color: c.color, display: "flex", alignItems: "center", justifyContent: "center", fontSize: "20px", fontWeight: 700, flexShrink: 0 }}>
                {c.icon}
              </div>
              <div>
                <div style={{ fontSize: "12px", color: "#8c9196", fontWeight: 500 }}>{c.label}</div>
                <div style={{ display: "flex", alignItems: "baseline", gap: "6px" }}>
                  <span style={{ fontSize: "26px", fontWeight: 800, color: c.color }}>{fmt(c.value)}</span>
                  {c.sub && <span style={{ fontSize: "13px", color: c.color, opacity: 0.7 }}>({c.sub})</span>}
                </div>
              </div>
            </div>
          ))}
        </div>

        {/* ==================== PER-SERVICE STATS ==================== */}
        <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: "16px", marginBottom: "20px" }}>
          {serviceStats.map((s) => (
            <div key={s.key} className="dash-card" style={{ padding: 0, overflow: "hidden" }}>
              <div style={{ padding: "14px 18px", borderBottom: "1px solid #f1f1f1", display: "flex", alignItems: "center", gap: "8px" }}>
                <span style={{ width: "8px", height: "8px", borderRadius: "50%", background: s.color, display: "inline-block" }}></span>
                <span style={{ fontSize: "14px", fontWeight: 700, color: "#1a1a1a" }}>{s.label}</span>
              </div>
              <div style={{ display: "flex", padding: "16px 8px", flexWrap: "wrap", gap: "8px 0" }}>
                {[
                  { value: s.total, label: "Total", color: "#1a1a1a" },
                  { value: s.sent, label: "Sent", color: "#16a34a" },
                  { value: s.error, label: "Error", color: "#dc2626" },
                  ...(s.key === "order_confirmation_whatsapp" ? [
                    { value: s.confirmed ?? 0, label: "Confirmed", color: "#0891b2" },
                    { value: s.cancelled ?? 0, label: "Cancelled", color: "#ea580c" },
                    { value: s.noResponse ?? 0, label: "No Resp.", color: "#8c9196" },
                  ] : []),
                ].map((item, idx, arr) => (
                  <div key={idx} title={String(item.value)} style={{ flex: "1 0 auto", minWidth: 0, textAlign: "center", padding: "0 4px", borderRight: idx < arr.length - 1 ? "1px solid #f1f1f1" : "none" }}>
                    <div style={{ fontSize: "19px", fontWeight: 800, color: item.color }}>{fmt(item.value)}</div>
                    <div style={{ fontSize: "10px", color: "#8c9196", marginTop: "2px", whiteSpace: "nowrap" }}>{item.label}</div>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>

        {/* ==================== OVERVIEW CHART ==================== */}
        <div className="dash-card" style={{ marginBottom: "20px" }}>
          <div style={{ fontSize: "15px", fontWeight: 700, color: "#1a1a1a", marginBottom: "20px" }}>Overview</div>
          <ResponsiveContainer width="100%" height={280}>
            <LineChart data={dailyStats}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f1f1f1" vertical={false} />
              <XAxis dataKey="date" tick={{ fontSize: 11, fill: "#8c9196" }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fontSize: 11, fill: "#8c9196" }} axisLine={false} tickLine={false} allowDecimals={false} />
              <RTooltip contentStyle={{ borderRadius: "8px", border: "1px solid #e3e3e3", fontSize: "12px" }} />
              <Legend iconType="circle" wrapperStyle={{ fontSize: "12px" }} />
              <Line type="monotone" dataKey="Total" stroke="#7c3aed" strokeWidth={2} dot={{ r: 3 }} />
              <Line type="monotone" dataKey="Sent" stroke="#16a34a" strokeWidth={2} dot={{ r: 3 }} />
              <Line type="monotone" dataKey="Error" stroke="#dc2626" strokeWidth={2} dot={{ r: 3 }} />
            </LineChart>
          </ResponsiveContainer>
        </div>

        {/* ==================== MESSAGES TYPE CHART ==================== */}
        <div className="dash-card" style={{ marginBottom: "20px" }}>
          <div style={{ fontSize: "15px", fontWeight: 700, color: "#1a1a1a", marginBottom: "20px" }}>Messages Type</div>
          {messagesByType.length === 0 ? (
            <div style={{ textAlign: "center", padding: "50px 0", color: "#8c9196", fontSize: "13px" }}>
              No messages in this period
            </div>
          ) : (
            <ResponsiveContainer width="100%" height={280}>
              <BarChart data={messagesByType}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f1f1f1" vertical={false} />
                <XAxis dataKey="name" tick={{ fontSize: 11, fill: "#8c9196" }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fontSize: 11, fill: "#8c9196" }} axisLine={false} tickLine={false} allowDecimals={false} />
                <RTooltip contentStyle={{ borderRadius: "8px", border: "1px solid #e3e3e3", fontSize: "12px" }} cursor={{ fill: "#fafafa" }} />
                <Bar dataKey="value" name="Messages" fill="#005bd3" radius={[6, 6, 0, 0]} maxBarSize={60} />
              </BarChart>
            </ResponsiveContainer>
          )}
        </div>

        {/* ==================== QUICK ACTIONS + RECENT ACTIVITY ==================== */}
        <div style={{ display: "grid", gridTemplateColumns: "300px 1fr", gap: "16px", marginBottom: "20px" }}>
          <div className="dash-card">
            <div style={{ fontSize: "15px", fontWeight: 700, color: "#1a1a1a", marginBottom: "14px" }}>Quick Actions</div>
            <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
              {quickActions.map((a, i) => (
                <button
                  key={i}
                  onClick={() => navigate(a.path)}
                  style={{
                    display: "flex", alignItems: "center", gap: "12px",
                    padding: "12px 14px", borderRadius: "10px",
                    border: "1px solid #e3e3e3", background: "#ffffff",
                    cursor: "pointer", textAlign: "left", width: "100%",
                  }}
                >
                  <span style={{ fontSize: "18px" }}>{a.icon}</span>
                  <div>
                    <div style={{ fontSize: "13px", fontWeight: 600, color: "#1a1a1a" }}>{a.label}</div>
                    <div style={{ fontSize: "11px", color: "#8c9196" }}>{a.sub}</div>
                  </div>
                </button>
              ))}
            </div>
          </div>

          <div className="dash-card">
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "14px" }}>
              <div style={{ fontSize: "15px", fontWeight: 700, color: "#1a1a1a" }}>Recent Activity</div>
              {recentMessages.length > 0 && (
                <button onClick={() => navigate("/app/message-logs")} style={{ fontSize: "12px", color: "#005bd3", background: "none", border: "none", cursor: "pointer", fontWeight: 600 }}>
                  View all →
                </button>
              )}
            </div>
            {recentMessages.length === 0 ? (
              <div style={{ textAlign: "center", padding: "40px 0", color: "#8c9196", fontSize: "13px" }}>
                <div style={{ fontSize: "28px", marginBottom: "8px" }}>📭</div>
                No messages sent yet. Enable a service to start.
              </div>
            ) : (
              <div>
                {recentMessages.map((m, i) => {
                  const sc = STATUS_COLORS[m.status] || STATUS_COLORS.pending;
                  return (
                    <div key={m.id} style={{ display: "flex", alignItems: "center", gap: "12px", padding: "10px 0", borderBottom: i < recentMessages.length - 1 ? "1px solid #f1f1f1" : "none" }}>
                      <div style={{ width: "34px", height: "34px", borderRadius: "10px", background: "#f6f6f7", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "16px", flexShrink: 0 }}>
                        {SERVICE_ICONS[m.serviceKey] || "📌"}
                      </div>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                          <span style={{ fontSize: "13px", fontWeight: 600, color: "#1a1a1a" }}>{m.orderName}</span>
                          <span style={{ fontSize: "12px", color: "#8c9196" }}>· {m.customerName}</span>
                        </div>
                        <div style={{ fontSize: "11px", color: "#8c9196" }}>{m.serviceName}</div>
                      </div>
                      <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", gap: "2px" }}>
                        <span style={{ padding: "2px 8px", borderRadius: "12px", fontSize: "10px", fontWeight: 700, background: sc.bg, color: sc.color }}>
                          {m.status.charAt(0).toUpperCase() + m.status.slice(1)}
                        </span>
                        <span style={{ fontSize: "10px", color: "#b5b5b5" }}>{m.createdAt}</span>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>

        <Box paddingBlockEnd="800" />
      </Page>
    </Frame>
  );
}

export const headers = (headersArgs) => {
  return boundary.headers(headersArgs);
};