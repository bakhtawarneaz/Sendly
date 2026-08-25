import { useLoaderData, useSearchParams, useFetcher } from "react-router";
import { useState, useCallback, useEffect } from "react";
import { boundary } from "@shopify/shopify-app-react-router/server";
import { authenticate } from "../shopify.server";
import { loadMessageLogs, singleRetry, bulkRetry } from "../services/messageLogService.server.js";
import {
  Page, Card, IndexTable, Text, Badge, EmptyState, Filters, ChoiceList,
  BlockStack, InlineStack, Box, InlineGrid, Pagination, Tooltip, Popover,
  Button, DatePicker, Toast, Frame, useIndexResourceState,
} from "@shopify/polaris";

export const loader = async ({ request }) => {
  const { session } = await authenticate.admin(request);
  const url = new URL(request.url);
  return await loadMessageLogs(session, {
    page: parseInt(url.searchParams.get("page") || "1"),
    status: url.searchParams.get("status") || "all",
    service: url.searchParams.get("service") || "all",
    search: url.searchParams.get("q") || "",
    dateFrom: url.searchParams.get("from") || "",
    dateTo: url.searchParams.get("to") || "",
  });
};

export const action = async ({ request }) => {
  const { session } = await authenticate.admin(request);
  const formData = await request.formData();
  const actionType = formData.get("actionType");

  if (actionType === "retry") {
    return await singleRetry(session, formData.get("retryId"));
  }
  if (actionType === "bulk_retry") {
    const ids = JSON.parse(formData.get("ids") || "[]");
    return await bulkRetry(session, ids);
  }
  return { success: false };
};

const STATUS_TONE = { sent: "success", delivered: "info", read: "info", failed: "critical" };
const STATUS_LABEL = { sent: "Sent", delivered: "Delivered", read: "Read", failed: "Failed" };

export default function MessageLogs() {
  const {
    logs, stats, totalPages, currentPage, totalCount, services,
    dateFrom: initialDateFrom, dateTo: initialDateTo,
  } = useLoaderData();
  const [searchParams, setSearchParams] = useSearchParams();
  const fetcher = useFetcher();

  const [search, setSearch] = useState(searchParams.get("q") || "");
  const [statusFilter, setStatusFilter] = useState(
    searchParams.get("status") && searchParams.get("status") !== "all" ? [searchParams.get("status")] : []
  );
  const [serviceFilter, setServiceFilter] = useState(
    searchParams.get("service") && searchParams.get("service") !== "all" ? [searchParams.get("service")] : []
  );

  const [toastActive, setToastActive] = useState(false);
  const [toastMessage, setToastMessage] = useState("");
  const [toastError, setToastError] = useState(false);
  const [errorPopoverId, setErrorPopoverId] = useState(null);

  const showToast = (message, error = false) => {
    setToastMessage(message);
    setToastError(error);
    setToastActive(true);
  };

  useEffect(() => {
    if (fetcher.data?.success) {
      if (fetcher.data.type === "retried") showToast("Message resent successfully!");
      if (fetcher.data.type === "bulk_retried") showToast(`${fetcher.data.successCount} resent, ${fetcher.data.failCount} failed`);
    }
    if (fetcher.data?.error) showToast(fetcher.data.error, true);
  }, [fetcher.data]);

  const [datePickerActive, setDatePickerActive] = useState(false);
  const now = new Date();
  const [{ month: pickerMonth, year: pickerYear }, setPickerDate] = useState({ month: now.getMonth(), year: now.getFullYear() });
  const [selectedDates, setSelectedDates] = useState(
    initialDateFrom && initialDateTo ? { start: new Date(initialDateFrom), end: new Date(initialDateTo) } : { start: now, end: now }
  );
  const hasDateFilter = !!(initialDateFrom && initialDateTo);

  const retryableLogs = logs.filter((l) => l.canRetry);
  const { selectedResources, allResourcesSelected, handleSelectionChange, clearSelection } =
    useIndexResourceState(retryableLogs);

  const applyFilters = useCallback((newSearch, newStatus, newService, fromDate, toDate) => {
    const params = new URLSearchParams();
    if (newSearch) params.set("q", newSearch);
    if (newStatus.length > 0) params.set("status", newStatus[0]);
    if (newService.length > 0) params.set("service", newService[0]);
    if (fromDate) params.set("from", fromDate);
    if (toDate) params.set("to", toDate);
    params.set("page", "1");
    setSearchParams(params);
  }, [setSearchParams]);

  const handleSearchChange = useCallback((value) => setSearch(value), []);
  const handleSearchClear = useCallback(() => {
    setSearch("");
    applyFilters("", statusFilter, serviceFilter, initialDateFrom, initialDateTo);
  }, [statusFilter, serviceFilter, applyFilters, initialDateFrom, initialDateTo]);

  const handleStatusChange = useCallback((value) => {
    setStatusFilter(value);
    applyFilters(search, value, serviceFilter, initialDateFrom, initialDateTo);
  }, [search, serviceFilter, applyFilters, initialDateFrom, initialDateTo]);

  const handleServiceChange = useCallback((value) => {
    setServiceFilter(value);
    applyFilters(search, statusFilter, value, initialDateFrom, initialDateTo);
  }, [search, statusFilter, applyFilters, initialDateFrom, initialDateTo]);

  const handleFiltersClearAll = useCallback(() => {
    setSearch("");
    setStatusFilter([]);
    setServiceFilter([]);
    setSearchParams(new URLSearchParams());
  }, [setSearchParams]);

  const handleDateApply = useCallback(() => {
    const from = selectedDates.start.toISOString().split("T")[0];
    const to = selectedDates.end.toISOString().split("T")[0];
    applyFilters(search, statusFilter, serviceFilter, from, to);
    setDatePickerActive(false);
  }, [selectedDates, search, statusFilter, serviceFilter, applyFilters]);

  const handleDateClear = useCallback(() => {
    applyFilters(search, statusFilter, serviceFilter, "", "");
    setDatePickerActive(false);
  }, [search, statusFilter, serviceFilter, applyFilters]);

  const goToPage = useCallback((page) => {
    const params = new URLSearchParams(searchParams);
    params.set("page", page.toString());
    setSearchParams(params);
  }, [searchParams, setSearchParams]);

  const getDateLabel = () => {
    if (hasDateFilter) {
      const fmt = (d) => new Date(d).toLocaleDateString("en-US", { month: "short", day: "numeric" });
      return `${fmt(initialDateFrom)} — ${fmt(initialDateTo)}`;
    }
    return "Date Range";
  };

  const handleSingleRetry = (retryId) => {
    const form = new FormData();
    form.set("actionType", "retry");
    form.set("retryId", retryId);
    fetcher.submit(form, { method: "POST" });
  };

  const handleBulkRetry = () => {
    const retryIds = logs.filter((l) => selectedResources.includes(l.id) && l.retryId).map((l) => l.retryId);
    if (retryIds.length === 0) return;
    const form = new FormData();
    form.set("actionType", "bulk_retry");
    form.set("ids", JSON.stringify(retryIds));
    fetcher.submit(form, { method: "POST" });
    clearSelection();
  };

  const filters = [
    {
      key: "status", label: "Status",
      filter: (
        <ChoiceList title="Status" titleHidden
          choices={[
            { label: "Sent", value: "sent" },
            { label: "Delivered", value: "delivered" },
            { label: "Read", value: "read" },
            { label: "Failed", value: "failed" },
          ]}
          selected={statusFilter} onChange={handleStatusChange} />
      ),
      shortcut: true,
    },
    {
      key: "service", label: "Service",
      filter: (
        <ChoiceList title="Service" titleHidden
          choices={services.map((s) => ({ label: s.name, value: s.key }))}
          selected={serviceFilter} onChange={handleServiceChange} />
      ),
      shortcut: true,
    },
  ];

  const appliedFilters = [];
  if (statusFilter.length > 0) {
    appliedFilters.push({ key: "status", label: `Status: ${statusFilter.join(", ")}`, onRemove: () => handleStatusChange([]) });
  }
  if (serviceFilter.length > 0) {
    const serviceName = services.find((s) => s.key === serviceFilter[0])?.name || serviceFilter[0];
    appliedFilters.push({ key: "service", label: `Service: ${serviceName}`, onRemove: () => handleServiceChange([]) });
  }
  if (hasDateFilter) {
    appliedFilters.push({ key: "date", label: `Date: ${getDateLabel()}`, onRemove: handleDateClear });
  }

  const isRetrying = fetcher.state === "submitting";

  const rowMarkup = logs.map((log, index) => (
    <IndexTable.Row
      id={log.id}
      key={log.id}
      position={index}
      selected={selectedResources.includes(log.id)}
      disabled={!log.canRetry}
    >
      <IndexTable.Cell>
        <Text variant="bodySm" tone="subdued" as="span">{index + 1}</Text>
      </IndexTable.Cell>
      <IndexTable.Cell>
        <Text variant="bodyMd" fontWeight="semibold" as="span">{log.orderName}</Text>
      </IndexTable.Cell>
      <IndexTable.Cell>
        <BlockStack gap="050">
          <Text variant="bodyMd" as="span">{log.customerName}</Text>
          <Text variant="bodySm" tone="subdued" as="span">{log.customerPhone}</Text>
        </BlockStack>
      </IndexTable.Cell>
      <IndexTable.Cell>
        <Text variant="bodySm" as="span">{log.serviceName}</Text>
      </IndexTable.Cell>
      <IndexTable.Cell>
      {log.templateName ? <Badge tone="info">{log.templateName}</Badge> : <Text variant="bodySm" tone="subdued" as="span">—</Text>}
      </IndexTable.Cell>
      <IndexTable.Cell>
        {log.status === "failed" && log.errorInfo ? (
          <div onClick={(e) => e.stopPropagation()}>
            <Popover
              active={errorPopoverId === log.id}
              activator={
                <button
                  onClick={() => setErrorPopoverId(errorPopoverId === log.id ? null : log.id)}
                  style={{
                    display: "inline-flex", alignItems: "center", gap: "5px",
                    background: "#fef2f2", border: "1px solid #fecaca",
                    borderRadius: "16px", padding: "3px 10px", cursor: "pointer",
                    fontSize: "12px", fontWeight: 600, color: "#b91c1c",
                  }}
                >
                  Failed <span style={{ fontSize: "11px", opacity: 0.7 }}>ⓘ</span>
                </button>
              }
              onClose={() => setErrorPopoverId(null)}
              preferredAlignment="left"
            >
              <div style={{ padding: "14px", maxWidth: "280px" }}>
                <div style={{ display: "flex", gap: "8px", alignItems: "flex-start" }}>
                  <span style={{ fontSize: "16px", flexShrink: 0 }}>⚠️</span>
                  <div>
                    <div style={{ fontSize: "13px", fontWeight: 600, color: "#b91c1c", lineHeight: 1.4, marginBottom: "4px" }}>
                      {log.errorInfo.message}
                    </div>
                    <div style={{ fontSize: "12px", color: "#4b5563", lineHeight: 1.5 }}>
                      {log.errorInfo.action}
                    </div>
                  </div>
                </div>
              </div>
            </Popover>
          </div>
        ) : (
          <Tooltip
            content={log.wamid ? `WhatsApp Message ID: ${log.wamid}` : `Sent: ${log.sentAt}`}
            dismissOnMouseOut
          >
            <Badge tone={STATUS_TONE[log.status]}>{STATUS_LABEL[log.status] || log.status}</Badge>
          </Tooltip>
        )}
      </IndexTable.Cell>
      <IndexTable.Cell>
        <Text variant="bodySm" tone="subdued" as="span">{log.sentAt !== "—" ? log.sentAt : log.createdAt}</Text>
      </IndexTable.Cell>
      <IndexTable.Cell>
        {log.canRetry ? (
          <div onClick={(e) => e.stopPropagation()}>
            <Button size="slim" onClick={() => handleSingleRetry(log.retryId)} loading={isRetrying} disabled={isRetrying}>
              Resend
            </Button>
          </div>
        ) : (
          <Text variant="bodySm" tone="subdued" as="span">—</Text>
        )}
      </IndexTable.Cell>
    </IndexTable.Row>
  ));

  return (
    <Frame>
      <Page title="Message Logs" subtitle={`${totalCount} message${totalCount !== 1 ? "s" : ""} found`}>
        <Box paddingBlockEnd="400">
          <InlineGrid columns={{ xs: 3, sm: 6 }} gap="300">
            {[
              { label: "This Month", value: stats.monthSent },
              { label: "Today", value: stats.todaySent },
              { label: "Total Sent", value: stats.totalSent },
              { label: "Delivered", value: stats.totalDelivered },
              { label: "Read", value: stats.totalRead },
              { label: "Failed", value: stats.totalFailed },
            ].map((stat) => (
              <Card key={stat.label} padding="400">
                <BlockStack gap="100" inlineAlign="center">
                  <Text variant="headingLg" as="p" alignment="center" fontWeight="bold">{stat.value}</Text>
                  <Text variant="bodySm" as="p" alignment="center" tone="subdued">{stat.label}</Text>
                </BlockStack>
              </Card>
            ))}
          </InlineGrid>
        </Box>

        <Box paddingBlockEnd="300">
          <InlineStack gap="300" align="space-between" blockAlign="center">
            <Popover
              active={datePickerActive}
              activator={<Button onClick={() => setDatePickerActive(!datePickerActive)} disclosure>{getDateLabel()}</Button>}
              onClose={() => setDatePickerActive(false)}
              preferredAlignment="left"
            >
              <div style={{ padding: "16px", width: "340px" }}>
                <BlockStack gap="300">
                  <InlineStack gap="200" blockAlign="center">
                    <Text variant="bodySm" as="span" tone="subdued">{selectedDates.start.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}</Text>
                    <Text variant="bodySm" as="span" tone="subdued">→</Text>
                    <Text variant="bodySm" as="span" tone="subdued">{selectedDates.end.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}</Text>
                  </InlineStack>
                  <DatePicker month={pickerMonth} year={pickerYear} onChange={setSelectedDates} onMonthChange={(m, y) => setPickerDate({ month: m, year: y })} selected={selectedDates} allowRange />
                  <InlineStack align="end" gap="200">
                    {hasDateFilter && <Button onClick={handleDateClear}>Clear</Button>}
                    <Button onClick={() => setDatePickerActive(false)}>Cancel</Button>
                    <Button variant="primary" onClick={handleDateApply}>Apply</Button>
                  </InlineStack>
                </BlockStack>
              </div>
            </Popover>

            {selectedResources.length > 0 && (
              <Button variant="primary" onClick={handleBulkRetry} loading={isRetrying} disabled={isRetrying}>
                Resend selected ({selectedResources.length})
              </Button>
            )}
          </InlineStack>
        </Box>

        <Card padding="0">
          <div style={{ padding: "12px 12px 0" }}>
            <Filters
              queryValue={search}
              queryPlaceholder="Search order, customer, phone, template..."
              onQueryChange={handleSearchChange}
              onQueryClear={handleSearchClear}
              filters={filters}
              appliedFilters={appliedFilters}
              onClearAll={handleFiltersClearAll}
            />
          </div>

          {logs.length > 0 ? (
            <IndexTable
              resourceName={{ singular: "message", plural: "messages" }}
              itemCount={logs.length}
              selectedItemsCount={allResourcesSelected ? "All" : selectedResources.length}
              onSelectionChange={handleSelectionChange}
              headings={[
                { title: "#" }, { title: "Order" }, { title: "Customer" },
                { title: "Service" }, { title: "Template" }, { title: "Status" },
                { title: "Time" }, { title: "Action" },
              ]}
            >
              {rowMarkup}
            </IndexTable>
          ) : (
            <EmptyState heading="No messages yet" image="https://cdn.shopify.com/s/files/1/0262/4071/2726/files/emptystate-files.png">
              <p>Messages will appear here when your enabled services send WhatsApp notifications.</p>
            </EmptyState>
          )}
        </Card>

        {totalPages > 1 && (
          <Box paddingBlockStart="400" paddingBlockEnd="800">
            <InlineStack align="center">
              <Pagination
                hasPrevious={currentPage > 1}
                hasNext={currentPage < totalPages}
                onPrevious={() => goToPage(currentPage - 1)}
                onNext={() => goToPage(currentPage + 1)}
                label={`Page ${currentPage} of ${totalPages}`}
              />
            </InlineStack>
          </Box>
        )}

        {toastActive && (
          <Toast content={toastMessage} error={toastError} onDismiss={() => setToastActive(false)} duration={3000} />
        )}
        <Box paddingBlockEnd="800" />
      </Page>
    </Frame>
  );
}

export const headers = (headersArgs) => {
  return boundary.headers(headersArgs);
};