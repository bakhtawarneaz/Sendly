import { useLoaderData, useNavigate, useSearchParams } from "react-router";
import { useState, useCallback } from "react";
import { boundary } from "@shopify/shopify-app-react-router/server";
import { authenticate } from "../shopify.server";
import { loadAnalytics } from "../services/analyticsService.server.js";
import {
  Page, Frame, Layout, Card, Box, Button, Popover, DatePicker, TextField,
  InlineStack, BlockStack, InlineGrid, Text, Badge, Icon, Divider, EmptyState,
} from "@shopify/polaris";
import {
  ChatIcon, CheckCircleIcon, AlertCircleIcon, ExportIcon, SearchIcon,
  OrderIcon, PackageIcon, CashDollarIcon, CartIcon, DeliveryIcon,
  SettingsIcon, NoteIcon, ListBulletedIcon, MegaphoneIcon,
} from "@shopify/polaris-icons";
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

// Chart palette aligned to Polaris semantic colors
const CHART = {
  total: "#5c6ac4",   // indigo (neutral series)
  sent: "#008060",    // Polaris success green
  error: "#d72c0d",   // Polaris critical red
  bar: "#2c6ecb",     // Polaris interactive blue
  grid: "#e3e3e3",
  axis: "#8c9196",
};

const SERVICE_ICONS = {
  order_confirmation_whatsapp: OrderIcon,
  order_fulfillment: PackageIcon,
  order_paid: CashDollarIcon,
  order_cancelled: AlertCircleIcon,
  order_delivered: DeliveryIcon,
  abandoned_checkout: CartIcon,
};

const STATUS_TONE = {
  sent: "success",
  delivered: "info",
  read: "magic",
  failed: "critical",
  pending: "attention",
};

// Colored icon tile — subtle background using Polaris tokens (review-safe)
function IconTile({ source, bg, fg, size = 40 }) {
  const inner = Math.round(size / 2);
  return (
    <div
      style={{
        width: `${size}px`,
        height: `${size}px`,
        borderRadius: "10px",
        background: bg || "var(--p-color-bg-surface-secondary)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        flexShrink: 0,
      }}
    >
      <span style={{ width: `${inner}px`, height: `${inner}px`, color: fg || "var(--p-color-icon)" }}>
        <Icon source={source} />
      </span>
    </div>
  );
}

export default function Analytics() {
  const { summary, serviceStats, dailyStats, messagesByType, recentMessages, quickStats, dateFrom, dateTo } = useLoaderData();
  const navigate = useNavigate();
  const [, setSearchParams] = useSearchParams();

  const [search, setSearch] = useState("");
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
      const f = (d) => new Date(d).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
      return `${f(dateFrom)} — ${f(dateTo)}`;
    }
    return "Last 7 days";
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
    { label: "Manage services", sub: `${quickStats.activeServices} active`, path: "/app/services", ic: SettingsIcon, bg: "var(--p-color-bg-surface-info)", fg: "var(--p-color-icon-info)" },
    { label: "Templates", sub: `${quickStats.approvedTemplates} approved`, path: "/app/templates", ic: NoteIcon, bg: "var(--p-color-bg-surface-success)", fg: "var(--p-color-icon-success)" },
    { label: "Message logs", sub: `${quickStats.allTimeMessages} total`, path: "/app/message-logs", ic: ListBulletedIcon, bg: "var(--p-color-bg-surface-magic)", fg: "var(--p-color-icon-magic)" },
    { label: "Campaigns", sub: `${quickStats.activeCampaigns} active`, path: "/app/campaigns", ic: MegaphoneIcon, bg: "var(--p-color-bg-surface-warning)", fg: "var(--p-color-icon-warning)" },
    { label: "Settings", sub: quickStats.whatsappConnected ? "Connected" : "Not connected", path: "/app/settings", ic: SettingsIcon, bg: "var(--p-color-bg-surface-caution)", fg: "var(--p-color-icon)" },
  ];

  const fmt = (n) => {
    const num = Number(n) || 0;
    if (num >= 1_000_000) return (num / 1_000_000).toFixed(num % 1_000_000 === 0 ? 0 : 1) + "M";
    if (num >= 1_000) return (num / 1_000).toFixed(num % 1_000 === 0 ? 0 : 1) + "K";
    return String(num);
  };

  const summaryCards = [
    { icon: ChatIcon, bg: "var(--p-color-bg-surface-info)", fg: "var(--p-color-icon-info)", label: "Total messages", value: summary.totalMessages, sub: null },
    { icon: CheckCircleIcon, bg: "var(--p-color-bg-surface-success)", fg: "var(--p-color-icon-success)", label: "Successful", value: summary.successCount, sub: `${summary.successRate}%` },
    { icon: AlertCircleIcon, bg: "var(--p-color-bg-surface-critical)", fg: "var(--p-color-icon-critical)", label: "Failed", value: summary.failedCount, sub: `${summary.failedRate}%` },
  ];

  return (
    <Frame>
      <Page
        title="Analytics"
        subtitle="Track message performance across all your notification services."
        primaryAction={{ content: "Export", icon: ExportIcon, onAction: handleExport }}
      >
        <Layout>
          {/* ---------- FILTERS ---------- */}
          <Layout.Section>
            <InlineStack gap="300" blockAlign="center" wrap>
              <Popover
                active={datePickerActive}
                activator={<Button onClick={() => setDatePickerActive(!datePickerActive)} disclosure>{getDateLabel()}</Button>}
                onClose={() => setDatePickerActive(false)}
                preferredAlignment="left"
              >
                <Box padding="400" minWidth="340px">
                  <BlockStack gap="300">
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
                </Box>
              </Popover>

              <Box minWidth="240px">
                <TextField
                  label="Search" labelHidden
                  value={search} onChange={setSearch}
                  placeholder="Search order, customer, phone…"
                  prefix={<Icon source={SearchIcon} />}
                  autoComplete="off"
                  connectedRight={<Button onClick={handleSearch}>Search</Button>}
                />
              </Box>
            </InlineStack>
          </Layout.Section>

          {/* ---------- SUMMARY CARDS ---------- */}
          <Layout.Section>
            <InlineGrid columns={{ xs: 1, sm: 3 }} gap="400">
              {summaryCards.map((c) => (
                <Card key={c.label}>
                  <InlineStack gap="300" blockAlign="center">
                    <IconTile source={c.icon} bg={c.bg} fg={c.fg} />
                    <BlockStack gap="0">
                      <Text as="span" variant="bodySm" tone="subdued">{c.label}</Text>
                      <InlineStack gap="100" blockAlign="baseline">
                        <Text as="span" variant="headingXl">{fmt(c.value)}</Text>
                        {c.sub && <Text as="span" variant="bodySm" tone="subdued">({c.sub})</Text>}
                      </InlineStack>
                    </BlockStack>
                  </InlineStack>
                </Card>
              ))}
            </InlineGrid>
          </Layout.Section>

          {/* ---------- PER-SERVICE STATS ---------- */}
          <Layout.Section>
            <InlineGrid columns={{ xs: 1, sm: 2, md: 3 }} gap="400">
              {serviceStats.map((s) => {
                const cells = [
                  { value: s.total, label: "Total" },
                  { value: s.sent, label: "Sent" },
                  { value: s.error, label: "Error" },
                  ...(s.key === "order_confirmation_whatsapp" ? [
                    { value: s.confirmed ?? 0, label: "Confirmed" },
                    { value: s.cancelled ?? 0, label: "Cancelled" },
                    { value: s.noResponse ?? 0, label: "No resp." },
                  ] : []),
                ];
                return (
                  <Card key={s.key} padding="0">
                    <Box padding="300" borderBlockEndWidth="025" borderColor="border">
                      <Text as="h3" variant="headingSm">{s.label}</Text>
                    </Box>
                    <Box padding="300">
                      <InlineGrid columns={cells.length > 3 ? 3 : cells.length} gap="200">
                        {cells.map((item, idx) => (
                          <BlockStack key={idx} gap="0" inlineAlign="center">
                            <Text as="span" variant="headingMd">{fmt(item.value)}</Text>
                            <Text as="span" variant="bodySm" tone="subdued">{item.label}</Text>
                          </BlockStack>
                        ))}
                      </InlineGrid>
                    </Box>
                  </Card>
                );
              })}
            </InlineGrid>
          </Layout.Section>

          {/* ---------- OVERVIEW CHART ---------- */}
          <Layout.Section>
            <Card>
              <BlockStack gap="400">
                <Text as="h3" variant="headingMd">Overview</Text>
                <ResponsiveContainer width="100%" height={280}>
                  <LineChart data={dailyStats}>
                    <CartesianGrid strokeDasharray="3 3" stroke={CHART.grid} vertical={false} />
                    <XAxis dataKey="date" tick={{ fontSize: 11, fill: CHART.axis }} axisLine={false} tickLine={false} />
                    <YAxis tick={{ fontSize: 11, fill: CHART.axis }} axisLine={false} tickLine={false} allowDecimals={false} />
                    <RTooltip contentStyle={{ borderRadius: "8px", border: `1px solid ${CHART.grid}`, fontSize: "12px" }} />
                    <Legend iconType="circle" wrapperStyle={{ fontSize: "12px" }} />
                    <Line type="monotone" dataKey="Total" stroke={CHART.total} strokeWidth={2} dot={{ r: 3 }} />
                    <Line type="monotone" dataKey="Sent" stroke={CHART.sent} strokeWidth={2} dot={{ r: 3 }} />
                    <Line type="monotone" dataKey="Error" stroke={CHART.error} strokeWidth={2} dot={{ r: 3 }} />
                  </LineChart>
                </ResponsiveContainer>
              </BlockStack>
            </Card>
          </Layout.Section>

          {/* ---------- MESSAGES TYPE CHART ---------- */}
          <Layout.Section>
            <Card>
              <BlockStack gap="400">
                <Text as="h3" variant="headingMd">Messages by type</Text>
                {messagesByType.length === 0 ? (
                  <Box padding="800">
                    <Text as="p" variant="bodyMd" tone="subdued" alignment="center">
                      No messages in this period
                    </Text>
                  </Box>
                ) : (
                  <ResponsiveContainer width="100%" height={280}>
                    <BarChart data={messagesByType}>
                      <CartesianGrid strokeDasharray="3 3" stroke={CHART.grid} vertical={false} />
                      <XAxis dataKey="name" tick={{ fontSize: 11, fill: CHART.axis }} axisLine={false} tickLine={false} />
                      <YAxis tick={{ fontSize: 11, fill: CHART.axis }} axisLine={false} tickLine={false} allowDecimals={false} />
                      <RTooltip contentStyle={{ borderRadius: "8px", border: `1px solid ${CHART.grid}`, fontSize: "12px" }} cursor={{ fill: "#fafafa" }} />
                      <Bar dataKey="value" name="Messages" fill={CHART.bar} radius={[6, 6, 0, 0]} maxBarSize={60} />
                    </BarChart>
                  </ResponsiveContainer>
                )}
              </BlockStack>
            </Card>
          </Layout.Section>

          {/* ---------- QUICK ACTIONS + RECENT ACTIVITY ---------- */}
          <Layout.Section>
            <InlineGrid columns={{ xs: 1, md: ["oneThird", "twoThirds"] }} gap="400">
              {/* Quick actions */}
              <Card>
                <BlockStack gap="300">
                  <Text as="h3" variant="headingMd">Quick actions</Text>
                  <BlockStack gap="200">
                    {quickActions.map((a) => (
                      <div
                        key={a.label}
                        onClick={() => navigate(a.path)}
                        role="button"
                        tabIndex={0}
                        onKeyDown={(e) => (e.key === "Enter" || e.key === " ") && navigate(a.path)}
                        style={{
                          border: "1px solid var(--p-color-border)",
                          borderRadius: "10px",
                          padding: "10px 12px",
                          cursor: "pointer",
                          transition: "background 0.1s ease",
                        }}
                        onMouseEnter={(e) => (e.currentTarget.style.background = "var(--p-color-bg-surface-hover)")}
                        onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")}
                      >
                        <InlineStack gap="300" blockAlign="center" wrap={false}>
                          <IconTile source={a.ic} bg={a.bg} fg={a.fg} size={36} />
                          <BlockStack gap="0">
                            <Text as="span" variant="bodyMd" fontWeight="medium">{a.label}</Text>
                            <Text as="span" variant="bodySm" tone="subdued">{a.sub}</Text>
                          </BlockStack>
                        </InlineStack>
                      </div>
                    ))}
                  </BlockStack>
                </BlockStack>
              </Card>

              {/* Recent activity */}
              <Card>
                <BlockStack gap="300">
                  <InlineStack align="space-between" blockAlign="center">
                    <Text as="h3" variant="headingMd">Recent activity</Text>
                    {recentMessages.length > 0 && (
                      <Button variant="plain" onClick={() => navigate("/app/message-logs")}>
                        View all
                      </Button>
                    )}
                  </InlineStack>

                  {recentMessages.length === 0 ? (
                    <Box padding="600">
                      <Text as="p" variant="bodyMd" tone="subdued" alignment="center">
                        No messages sent yet. Enable a service to start.
                      </Text>
                    </Box>
                  ) : (
                    <BlockStack gap="0">
                      {recentMessages.map((m, i) => (
                        <Box key={m.id}>
                          <Box paddingBlock="300">
                            <InlineStack gap="300" blockAlign="center" wrap={false}>
                              <IconTile
                                source={SERVICE_ICONS[m.serviceKey] || NoteIcon}
                                bg="var(--p-color-bg-surface-secondary)"
                                fg="var(--p-color-icon)"
                                size={34}
                              />
                              <Box width="100%">
                                <BlockStack gap="0">
                                  <InlineStack gap="150" blockAlign="center">
                                    <Text as="span" variant="bodyMd" fontWeight="medium">{m.orderName}</Text>
                                    <Text as="span" variant="bodySm" tone="subdued">· {m.customerName}</Text>
                                  </InlineStack>
                                  <Text as="span" variant="bodySm" tone="subdued">{m.serviceName}</Text>
                                </BlockStack>
                              </Box>
                              <BlockStack gap="100" inlineAlign="end">
                                <Badge tone={STATUS_TONE[m.status] || "attention"}>
                                  {m.status.charAt(0).toUpperCase() + m.status.slice(1)}
                                </Badge>
                                <Text as="span" variant="bodySm" tone="subdued">{m.createdAt}</Text>
                              </BlockStack>
                            </InlineStack>
                          </Box>
                          {i < recentMessages.length - 1 && <Divider />}
                        </Box>
                      ))}
                    </BlockStack>
                  )}
                </BlockStack>
              </Card>
            </InlineGrid>
          </Layout.Section>

          <Layout.Section>
            <Box paddingBlockEnd="800" />
          </Layout.Section>
        </Layout>
      </Page>
    </Frame>
  );
}

export const headers = (headersArgs) => {
  return boundary.headers(headersArgs);
};