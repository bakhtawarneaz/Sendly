import { useLoaderData, useFetcher, useSearchParams } from "react-router";
import { useState, useCallback, useEffect } from "react";
import { boundary } from "@shopify/shopify-app-react-router/server";
import { authenticate } from "../shopify.server";
import {
  loadAbandonedOverview,
  loadAbandonedCheckouts,
  loadAbandonedTemplates,
  sendManualReminder,
  retryReminder,
} from "../services/abandonedUI.server.js";
import {
  Page, Frame, Layout, Card, Box, Tabs, Button, Badge, Icon, Text,
  InlineStack, BlockStack, InlineGrid, TextField, Select, IndexTable,
  Modal, Banner, EmptyState, Toast, Divider, Pagination,
} from "@shopify/polaris";
import {
  SendIcon, CheckCircleIcon, AlertCircleIcon, CashDollarIcon,
  RefreshIcon, SearchIcon, ViewIcon,
} from "@shopify/polaris-icons";

export const loader = async ({ request }) => {
  const { session } = await authenticate.admin(request);
  const url = new URL(request.url);
  const from = url.searchParams.get("from") || "";
  const to = url.searchParams.get("to") || "";
  const status = url.searchParams.get("status") || "";
  const search = url.searchParams.get("q") || "";
  const page = url.searchParams.get("page") || "1";
  const logStatus = url.searchParams.get("logStatus") || "";
  const logPage = url.searchParams.get("logPage") || "1";

  const [overview, checkouts, templates] = await Promise.all([
    loadAbandonedOverview(session, { from, to, status: logStatus, page: logPage }),
    loadAbandonedCheckouts(session, { status, search, page }),
    loadAbandonedTemplates(session),
  ]);

  return { overview, checkouts, templates };
};

export const action = async ({ request }) => {
  const { session } = await authenticate.admin(request);
  const form = await request.formData();
  const intent = form.get("intent");

  if (intent === "manual_send") {
    return await sendManualReminder(session, {
      checkoutId: form.get("checkoutId"),
      templateId: form.get("templateId"),
    });
  }
  if (intent === "retry") {
    return await retryReminder(session, { reminderId: form.get("reminderId") });
  }
  return { success: false, error: "Unknown action" };
};

const STATUS_TONE = {
  pending: "attention",
  reminded: "info",
  recovered: "success",
  expired: "critical",
  scheduled: "attention",
  processing: "info",
  sent: "success",
  failed: "critical",
  cancelled: "warning",
};

function money(n, currency) {
  const num = Number(n || 0);
  return `${currency || ""} ${num.toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 2 })}`.trim();
}

function StatCard({ icon, tone, label, value }) {
  return (
    <Card>
      <InlineStack gap="300" blockAlign="center">
        <Box><Icon source={icon} tone={tone} /></Box>
        <BlockStack gap="0">
          <Text as="span" variant="bodySm" tone="subdued">{label}</Text>
          <Text as="span" variant="headingLg">{value}</Text>
        </BlockStack>
      </InlineStack>
    </Card>
  );
}

export default function Abandoned() {
  const { overview, checkouts, templates } = useLoaderData();
  const fetcher = useFetcher();
  const [searchParams, setSearchParams] = useSearchParams();

  const [selectedTab, setSelectedTab] = useState(0);
  const [search, setSearch] = useState(searchParams.get("q") || "");
  const [statusFilter, setStatusFilter] = useState(searchParams.get("status") || "");

  const [sendModal, setSendModal] = useState(null); // checkout row
  const [templateId, setTemplateId] = useState("");
  const [viewLog, setViewLog] = useState(null); // reminder log row

  const [toast, setToast] = useState("");

  useEffect(() => {
    if (fetcher.data?.success) {
      setToast(fetcher.data.message || "Done");
      setSendModal(null);
      setTemplateId("");
    } else if (fetcher.data?.error) {
      setToast(fetcher.data.error);
    }
  }, [fetcher.data]);

  const applyFilters = useCallback((next = {}) => {
    const params = new URLSearchParams(searchParams);
    Object.entries(next).forEach(([k, v]) => {
      if (v) params.set(k, v);
      else params.delete(k);
    });
    setSearchParams(params);
  }, [searchParams, setSearchParams]);

  const handleManualSend = () => {
    if (!sendModal || !templateId) return;
    fetcher.submit(
      { intent: "manual_send", checkoutId: sendModal.id, templateId },
      { method: "POST" }
    );
  };

  const handleRetry = (reminderId) => {
    fetcher.submit({ intent: "retry", reminderId }, { method: "POST" });
  };

  const tabs = [
    { id: "overview", content: "Overview" },
    { id: "checkouts", content: "Checkouts" },
  ];

  const s = overview.stats || {};
  const cs = checkouts.stats || {};

  // ---------- OVERVIEW TAB ----------
  const logStatusOptions = [
    { label: "All statuses", value: "" },
    { label: "Scheduled", value: "scheduled" },
    { label: "Sent", value: "sent" },
    { label: "Failed", value: "failed" },
    { label: "Cancelled", value: "cancelled" },
  ];
  const logPage = overview.pagination?.page || 1;
  const logTotalPages = overview.pagination?.totalPages || 1;

  const fmtScheduled = (d) =>
    d ? new Date(d).toLocaleString(undefined, { month: "short", day: "numeric", hour: "numeric", minute: "2-digit", hour12: true }) : "—";

  const overviewTab = (
    <BlockStack gap="400">
      <InlineGrid columns={{ xs: 1, sm: 2, md: 4 }} gap="400">
        <StatCard icon={SendIcon} tone="info" label="Reminders sent" value={s.remindersSent ?? 0} />
        <StatCard icon={AlertCircleIcon} tone="critical" label="Failed" value={s.remindersFailed ?? 0} />
        <StatCard icon={CashDollarIcon} tone="success" label="Recovered (via reminder)" value={money(s.recoveredAmount, overview.currency)} />
        <StatCard icon={CheckCircleIcon} tone="base" label="Self recovered" value={money(s.selfRecoveredAmount, overview.currency)} />
      </InlineGrid>

      <Card>
        <Box maxWidth="240px">
          <Select
            label="Status"
            labelHidden
            options={logStatusOptions}
            value={searchParams.get("logStatus") || ""}
            onChange={(v) => applyFilters({ logStatus: v, logPage: "" })}
          />
        </Box>
      </Card>

      <Card padding="0">
        <Box padding="400" borderBlockEndWidth="025" borderColor="border">
          <InlineStack align="space-between" blockAlign="center">
            <Text as="h3" variant="headingMd">Reminder log</Text>
            <Text as="span" variant="bodySm" tone="subdued">{overview.pagination?.total || 0} total</Text>
          </InlineStack>
        </Box>
        {(!overview.log || overview.log.length === 0) ? (
          <Box padding="800">
            <Text as="p" variant="bodyMd" tone="subdued" alignment="center">No reminders yet.</Text>
          </Box>
        ) : (
          <>
            <IndexTable
              resourceName={{ singular: "reminder", plural: "reminders" }}
              itemCount={overview.log.length}
              selectable={false}
              headings={[
                { title: "Customer" }, { title: "Reminder" }, { title: "Template" },
                { title: "Status" }, { title: "Scheduled" }, { title: "Cart total" }, { title: "Checkout" }, { title: "" },
              ]}
            >
              {overview.log.map((r, i) => (
                <IndexTable.Row id={r.id} key={r.id} position={i}>
                  <IndexTable.Cell>
                    <BlockStack gap="0">
                      <Text as="span" variant="bodyMd" fontWeight="medium">{r.customerName || "Guest"}</Text>
                      <Text as="span" variant="bodySm" tone="subdued">{r.customerPhone}</Text>
                    </BlockStack>
                  </IndexTable.Cell>
                  <IndexTable.Cell>
                    {r.reminderNumber >= 90
                      ? <Badge tone="info">Manual</Badge>
                      : <Text as="span" variant="bodyMd">#{r.reminderNumber}</Text>}
                  </IndexTable.Cell>
                  <IndexTable.Cell><Text as="span" variant="bodyMd">{r.templateName || "—"}</Text></IndexTable.Cell>
                  <IndexTable.Cell><Badge tone={STATUS_TONE[r.status] || "attention"}>{r.status}</Badge></IndexTable.Cell>
                  <IndexTable.Cell><Text as="span" variant="bodySm" tone="subdued">{fmtScheduled(r.scheduledAt)}</Text></IndexTable.Cell>
                  <IndexTable.Cell><Text as="span" variant="bodyMd">{money(r.cartTotal, r.currency)}</Text></IndexTable.Cell>
                  <IndexTable.Cell>{r.checkoutStatus ? <Badge tone={STATUS_TONE[r.checkoutStatus] || "attention"}>{r.checkoutStatus}</Badge> : "—"}</IndexTable.Cell>
                  <IndexTable.Cell>
                    <InlineStack gap="200">
                      <Button size="slim" icon={ViewIcon} onClick={() => setViewLog(r)} accessibilityLabel="View" />
                      {r.status === "failed" && (
                        <Button size="slim" onClick={() => handleRetry(r.id)} loading={fetcher.state !== "idle"}>Retry</Button>
                      )}
                    </InlineStack>
                  </IndexTable.Cell>
                </IndexTable.Row>
              ))}
            </IndexTable>
            {logTotalPages > 1 && (
              <Box padding="400" borderBlockStartWidth="025" borderColor="border">
                <InlineStack align="center">
                  <Pagination
                    hasPrevious={logPage > 1}
                    onPrevious={() => applyFilters({ logPage: String(logPage - 1) })}
                    hasNext={logPage < logTotalPages}
                    onNext={() => applyFilters({ logPage: String(logPage + 1) })}
                    label={`Page ${logPage} of ${logTotalPages}`}
                  />
                </InlineStack>
              </Box>
            )}
          </>
        )}
      </Card>
    </BlockStack>
  );

  // ---------- CHECKOUTS TAB ----------
  const statusOptions = [
    { label: "All statuses", value: "" },
    { label: "Pending", value: "pending" },
    { label: "Reminded", value: "reminded" },
    { label: "Recovered", value: "recovered" },
    { label: "Expired", value: "expired" },
  ];

  const checkoutsTab = (
    <BlockStack gap="400">
      <InlineGrid columns={{ xs: 2, sm: 4 }} gap="400">
        <StatCard icon={CheckCircleIcon} tone="base" label="Total" value={cs.total ?? 0} />
        <StatCard icon={AlertCircleIcon} tone="attention" label="Pending" value={cs.pending ?? 0} />
        <StatCard icon={CashDollarIcon} tone="success" label="Recovered" value={cs.recovered ?? 0} />
        <StatCard icon={RefreshIcon} tone="info" label="Recovery rate" value={`${cs.recoveryRate ?? "0.0"}%`} />
      </InlineGrid>

      <Card>
        <InlineStack gap="300" blockAlign="center" wrap>
          <Box minWidth="200px">
            <Select label="Status" labelHidden options={statusOptions} value={statusFilter}
              onChange={(v) => { setStatusFilter(v); applyFilters({ status: v, page: "" }); }} />
          </Box>
          <Box minWidth="240px">
            <TextField label="Search" labelHidden value={search} onChange={setSearch}
              placeholder="Search name, phone, email…" prefix={<Icon source={SearchIcon} />} autoComplete="off"
              connectedRight={<Button onClick={() => applyFilters({ q: search, page: "" })}>Search</Button>} />
          </Box>
        </InlineStack>
      </Card>

      <Card padding="0">
        {(!checkouts.data || checkouts.data.length === 0) ? (
          <Box padding="1000">
            <EmptyState heading="No abandoned checkouts" image="">
              <p>Checkouts will appear here as customers abandon their carts.</p>
            </EmptyState>
          </Box>
        ) : (
          <IndexTable
            resourceName={{ singular: "checkout", plural: "checkouts" }}
            itemCount={checkouts.data.length}
            selectable={false}
            headings={[
              { title: "Customer" }, { title: "Cart total" }, { title: "Reminders" },
              { title: "Status" }, { title: "Source" }, { title: "" },
            ]}
          >
            {checkouts.data.map((c, i) => (
              <IndexTable.Row id={c.id} key={c.id} position={i}>
                <IndexTable.Cell>
                  <BlockStack gap="0">
                    <Text as="span" variant="bodyMd" fontWeight="medium">{c.customerName || "Guest"}</Text>
                    <Text as="span" variant="bodySm" tone="subdued">{c.customerPhone}</Text>
                  </BlockStack>
                </IndexTable.Cell>
                <IndexTable.Cell><Text as="span" variant="bodyMd">{money(c.cartTotal, c.currency)}</Text></IndexTable.Cell>
                <IndexTable.Cell><Text as="span" variant="bodyMd">{c.remindersSent}</Text></IndexTable.Cell>
                <IndexTable.Cell><Badge tone={STATUS_TONE[c.status] || "attention"}>{c.status}</Badge></IndexTable.Cell>
                <IndexTable.Cell><Text as="span" variant="bodySm" tone="subdued">{c.source}</Text></IndexTable.Cell>
                <IndexTable.Cell>
                  {c.status !== "recovered" && c.status !== "expired" && (
                    <Button size="slim" icon={SendIcon} onClick={() => { setSendModal(c); setTemplateId(""); }}>Send reminder</Button>
                  )}
                </IndexTable.Cell>
              </IndexTable.Row>
            ))}
          </IndexTable>
        )}
        {(checkouts.pagination?.totalPages || 1) > 1 && (
          <Box padding="400" borderBlockStartWidth="025" borderColor="border">
            <InlineStack align="center">
              <Pagination
                hasPrevious={(checkouts.pagination?.page || 1) > 1}
                onPrevious={() => applyFilters({ page: String((checkouts.pagination?.page || 1) - 1) })}
                hasNext={(checkouts.pagination?.page || 1) < (checkouts.pagination?.totalPages || 1)}
                onNext={() => applyFilters({ page: String((checkouts.pagination?.page || 1) + 1) })}
                label={`Page ${checkouts.pagination?.page || 1} of ${checkouts.pagination?.totalPages || 1}`}
              />
            </InlineStack>
          </Box>
        )}
      </Card>
    </BlockStack>
  );

  return (
    <Frame>
      <Page title="Abandoned checkouts" subtitle="Track and recover abandoned carts.">
        <Layout>
          <Layout.Section>
            <Card padding="0">
              <Tabs tabs={tabs} selected={selectedTab} onSelect={setSelectedTab}>
                <Box padding="400">
                  {selectedTab === 0 ? overviewTab : checkoutsTab}
                </Box>
              </Tabs>
            </Card>
          </Layout.Section>
          <Layout.Section><Box paddingBlockEnd="800" /></Layout.Section>
        </Layout>

        {/* Manual send modal */}
        {sendModal && (
          <Modal
            open
            onClose={() => setSendModal(null)}
            title="Send reminder"
            primaryAction={{ content: "Send", onAction: handleManualSend, loading: fetcher.state !== "idle", disabled: !templateId }}
            secondaryActions={[{ content: "Cancel", onAction: () => setSendModal(null) }]}
          >
            <Modal.Section>
              <BlockStack gap="400">
                <Box background="bg-surface-secondary" padding="300" borderRadius="200">
                  <BlockStack gap="200">
                    <InlineStack align="space-between"><Text as="span" tone="subdued">Customer</Text><Text as="span" fontWeight="medium">{sendModal.customerName || "Guest"}</Text></InlineStack>
                    <InlineStack align="space-between"><Text as="span" tone="subdued">Phone</Text><Text as="span">{sendModal.customerPhone}</Text></InlineStack>
                    <InlineStack align="space-between"><Text as="span" tone="subdued">Cart total</Text><Text as="span" fontWeight="medium">{money(sendModal.cartTotal, sendModal.currency)}</Text></InlineStack>
                  </BlockStack>
                </Box>
                <Select
                  label="Template"
                  options={[{ label: "Select a template…", value: "" }, ...templates.map((t) => ({ label: t.label, value: t.id }))]}
                  value={templateId}
                  onChange={setTemplateId}
                />
              </BlockStack>
            </Modal.Section>
          </Modal>
        )}

        {/* View reminder log modal */}
        {viewLog && (
          <Modal open onClose={() => setViewLog(null)} title={`Reminder #${viewLog.reminderNumber} · ${viewLog.customerName || "Guest"}`}>
            <Modal.Section>
              <BlockStack gap="400">
                <InlineStack gap="200" blockAlign="center">
                  <Badge tone={STATUS_TONE[viewLog.status] || "attention"}>{viewLog.status}</Badge>
                  <Text as="span" tone="subdued">{viewLog.customerPhone}</Text>
                </InlineStack>
                <Divider />
                <BlockStack gap="100">
                  <Text as="span" variant="headingSm">Message body</Text>
                  <Box background="bg-surface-secondary" padding="300" borderRadius="200">
                    <Text as="p" variant="bodyMd" breakWord>{viewLog.messageBody || "—"}</Text>
                  </Box>
                </BlockStack>
                <BlockStack gap="100">
                  <Text as="span" variant="headingSm">WhatsApp message ID</Text>
                  <Box background="bg-surface-secondary" padding="300" borderRadius="200">
                    <Text as="p" variant="bodyMd" tone="subdued" breakWord>{viewLog.whatsappMessageId || "Not available"}</Text>
                  </Box>
                </BlockStack>
                {viewLog.errorMessage && (
                  <Banner tone="critical" title="Error">{viewLog.errorMessage}</Banner>
                )}
              </BlockStack>
            </Modal.Section>
          </Modal>
        )}

        {toast && <Toast content={toast} onDismiss={() => setToast("")} duration={4000} />}
      </Page>
    </Frame>
  );
}

export const headers = (headersArgs) => boundary.headers(headersArgs);