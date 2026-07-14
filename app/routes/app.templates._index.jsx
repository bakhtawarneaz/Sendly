import { useLoaderData, useNavigate, useFetcher, useSearchParams } from "react-router";
import { useState, useEffect, useCallback } from "react";
import { boundary } from "@shopify/shopify-app-react-router/server";
import { authenticate } from "../shopify.server";
import { loadTemplates, deleteTemplate, syncTemplates, duplicateTemplate } from "../services/templateService.server.js";
import {
  Page, Card, IndexTable, Text, Badge, EmptyState, Banner, Toast, Frame,
  Filters, ChoiceList, InlineStack, BlockStack, Box, Popover, ActionList,
  Button, InlineGrid, Pagination,
} from "@shopify/polaris";

export const loader = async ({ request }) => {
  const { session } = await authenticate.admin(request);
  const url = new URL(request.url);
  const page = parseInt(url.searchParams.get("page") || "1");
  return await loadTemplates(session, page);
};

export const action = async ({ request }) => {
  const { session } = await authenticate.admin(request);
  const formData = await request.formData();
  const actionType = formData.get("actionType");
  const templateId = formData.get("templateId");

  if (actionType === "delete") return await deleteTemplate(session, templateId);
  if (actionType === "sync_templates") return await syncTemplates(session);
  if (actionType === "duplicate") return await duplicateTemplate(session, templateId);
  return { success: false };
};

const LANG_LABELS = {
  en: "English (US)", en_GB: "English (UK)", ur: "Urdu", ar: "Arabic",
  es: "Spanish", fr: "French", de: "German", pt_BR: "Portuguese", hi: "Hindi", tr: "Turkish",
};

const STATUS_TONE = { approved: "success", pending: "attention", rejected: "critical", draft: undefined };
const TYPE_TONE = { utility: "info", marketing: "warning" };

export default function Templates() {
  const { templates, whatsappConnected, totalPages, currentPage } = useLoaderData();
  const [searchParams, setSearchParams] = useSearchParams();
  const navigate = useNavigate();
  const fetcher = useFetcher();

  const goToPage = (page) => {
    const params = new URLSearchParams(searchParams);
    params.set("page", page.toString());
    setSearchParams(params);
  };

  const [toastActive, setToastActive] = useState(false);
  const [toastMessage, setToastMessage] = useState("");
  const [toastError, setToastError] = useState(false);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState([]);
  const [typeFilter, setTypeFilter] = useState([]);
  const [activePopoverId, setActivePopoverId] = useState(null);

  const showToast = (message, error = false) => {
    setToastMessage(message);
    setToastError(error);
    setToastActive(true);
  };

  useEffect(() => {
    if (fetcher.data?.success) {
      if (fetcher.data.type === "deleted") showToast("Template deleted");
      if (fetcher.data.type === "synced") showToast(`${fetcher.data.count} updated, ${fetcher.data.imported} imported from Meta`);
      if (fetcher.data.type === "duplicated") showToast("Template duplicated as draft");
    }
    if (fetcher.data?.error) showToast(fetcher.data.error, true);
  }, [fetcher.data]);

  const filtered = templates.filter((t) => {
    const matchSearch =
      t.name.toLowerCase().includes(search.toLowerCase()) ||
      (t.displayName || "").toLowerCase().includes(search.toLowerCase());
    const matchStatus = statusFilter.length === 0 || statusFilter.includes(t.status);
    const matchType = typeFilter.length === 0 || typeFilter.includes(t.type);
    return matchSearch && matchStatus && matchType;
  });

  const totalTemplates = templates.length;
  const approvedCount = templates.filter((t) => t.status === "approved").length;
  const pendingCount = templates.filter((t) => t.status === "pending").length;
  const rejectedCount = templates.filter((t) => t.status === "rejected").length;
  const draftCount = templates.filter((t) => t.status === "draft").length;

  const handleSync = () => {
    const form = new FormData();
    form.set("actionType", "sync_templates");
    fetcher.submit(form, { method: "POST" });
  };

  const handleDelete = (template) => {
    setActivePopoverId(null);
    if (confirm(`Delete "${template.displayName}"? This cannot be undone.`)) {
      const form = new FormData();
      form.set("actionType", "delete");
      form.set("templateId", template.id);
      fetcher.submit(form, { method: "POST" });
    }
  };

  const handleDuplicate = (template) => {
    setActivePopoverId(null);
    const form = new FormData();
    form.set("actionType", "duplicate");
    form.set("templateId", template.id);
    fetcher.submit(form, { method: "POST" });
  };

  const filters = [
    {
      key: "status", label: "Status",
      filter: (
        <ChoiceList title="Status" titleHidden
          choices={[
            { label: "Approved", value: "approved" },
            { label: "Pending", value: "pending" },
            { label: "Rejected", value: "rejected" },
            { label: "Draft", value: "draft" },
          ]}
          selected={statusFilter} onChange={setStatusFilter} allowMultiple />
      ),
      shortcut: true,
    },
    {
      key: "type", label: "Type",
      filter: (
        <ChoiceList title="Type" titleHidden
          choices={[
            { label: "Utility", value: "utility" },
            { label: "Marketing", value: "marketing" },
          ]}
          selected={typeFilter} onChange={setTypeFilter} allowMultiple />
      ),
      shortcut: true,
    },
  ];

  const appliedFilters = [];
  if (statusFilter.length > 0) {
    appliedFilters.push({ key: "status", label: `Status: ${statusFilter.join(", ")}`, onRemove: () => setStatusFilter([]) });
  }
  if (typeFilter.length > 0) {
    appliedFilters.push({ key: "type", label: `Type: ${typeFilter.join(", ")}`, onRemove: () => setTypeFilter([]) });
  }

  const rowMarkup = filtered.map((template, index) => {
    const bodyPreview = template.body
      ? template.body.substring(0, 80) + (template.body.length > 80 ? "..." : "")
      : "No content";

    return (
      <IndexTable.Row id={template.id} key={template.id} position={index}
        onClick={() => navigate(`/app/templates/${template.id}`)}>
        <IndexTable.Cell>
          <Text variant="bodySm" tone="subdued" as="span">{index + 1}</Text>
        </IndexTable.Cell>
        <IndexTable.Cell>
          <BlockStack gap="100">
            <Text variant="bodyMd" fontWeight="semibold" as="span">{template.displayName}</Text>
            <Text variant="bodySm" tone="subdued" as="span">{bodyPreview}</Text>
          </BlockStack>
        </IndexTable.Cell>
        <IndexTable.Cell>
          <Badge tone={STATUS_TONE[template.status]}>
            {template.status.charAt(0).toUpperCase() + template.status.slice(1)}
          </Badge>
        </IndexTable.Cell>
        <IndexTable.Cell>
          <Badge tone={TYPE_TONE[template.type]}>
            {template.type === "utility" ? "Utility" : "Marketing"}
          </Badge>
        </IndexTable.Cell>
        <IndexTable.Cell>
          <Text variant="bodySm" as="span">{LANG_LABELS[template.language] || template.language}</Text>
        </IndexTable.Cell>
        <IndexTable.Cell>
          <Text variant="bodySm" tone="subdued" as="span">{template.createdAt}</Text>
        </IndexTable.Cell>
        <IndexTable.Cell>
          <div onClick={(e) => e.stopPropagation()}>
            <Popover
              active={activePopoverId === template.id}
              activator={
                <Button variant="tertiary"
                  onClick={() => setActivePopoverId(activePopoverId === template.id ? null : template.id)}>
                  ⋯
                </Button>
              }
              onClose={() => setActivePopoverId(null)}
              preferredAlignment="right"
            >
              <ActionList
                items={[
                  {
                    content: template.status === "draft" ? "Edit" : "View",
                    onAction: () => { setActivePopoverId(null); navigate(`/app/templates/${template.id}`); },
                  },
                  { content: "Duplicate", onAction: () => handleDuplicate(template) },
                  { content: "Delete", destructive: true, onAction: () => handleDelete(template) },
                ]}
              />
            </Popover>
          </div>
        </IndexTable.Cell>
      </IndexTable.Row>
    );
  });

  const emptyStateMarkup =
    templates.length === 0 ? (
      <EmptyState
        heading="Create your first template"
        action={{
          content: "Create template",
          onAction: () => navigate("/app/templates/create"),
          disabled: !whatsappConnected,
        }}
        image="https://cdn.shopify.com/s/files/1/0262/4071/2726/files/emptystate-files.png"
      >
        <p>WhatsApp message templates need Meta approval before use. Create a template to get started.</p>
      </EmptyState>
    ) : (
      <EmptyState heading="No matching templates" image="">
        <p>Try adjusting your search or filters.</p>
      </EmptyState>
    );

  const isSyncing = fetcher.state === "submitting" && fetcher.formData?.get("actionType") === "sync_templates";

  return (
    <Frame>
      <Page
        title="Templates"
        subtitle="Create and manage WhatsApp message templates. Templates need Meta approval before use."
        primaryAction={{
          content: "Create template",
          onAction: () => navigate("/app/templates/create"),
          disabled: !whatsappConnected,
        }}
        secondaryActions={[
          { content: isSyncing ? "Syncing..." : "Sync with Meta", onAction: handleSync, loading: isSyncing, disabled: isSyncing },
        ]}
      >
        {!whatsappConnected && (
          <Box paddingBlockEnd="400">
            <Banner title="WhatsApp not connected" tone="warning"
              action={{ content: "Connect now", onAction: () => navigate("/app/settings") }}>
              <p>Connect your WhatsApp Business API in Settings to create and send templates.</p>
            </Banner>
          </Box>
        )}

        <Box paddingBlockEnd="400">
          <InlineGrid columns={{ xs: 2, sm: 3, md: 5 }} gap="300">
            {[
              { label: "Total", value: totalTemplates },
              { label: "Approved", value: approvedCount },
              { label: "Pending", value: pendingCount },
              { label: "Rejected", value: rejectedCount },
              { label: "Drafts", value: draftCount },
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

        <Card padding="0">
          <div style={{ padding: "12px 12px 0" }}>
            <Filters
              queryValue={search}
              queryPlaceholder="Search templates..."
              onQueryChange={setSearch}
              onQueryClear={() => setSearch("")}
              filters={filters}
              appliedFilters={appliedFilters}
              onClearAll={() => { setStatusFilter([]); setTypeFilter([]); setSearch(""); }}
            />
          </div>

          {filtered.length > 0 ? (
            <IndexTable
              resourceName={{ singular: "template", plural: "templates" }}
              itemCount={filtered.length}
              headings={[
                { title: "#" }, { title: "Template" }, { title: "Status" },
                { title: "Type" }, { title: "Language" }, { title: "Created" }, { title: "Actions" },
              ]}
              selectable={false}
            >
              {rowMarkup}
            </IndexTable>
          ) : (
            emptyStateMarkup
          )}
        </Card>

        {totalPages > 1 && (
          <Box paddingBlockStart="400" paddingBlockEnd="400">
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