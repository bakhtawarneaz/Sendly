import { useLoaderData, useNavigate, useFetcher, useSearchParams } from "react-router";
import { useState, useEffect, useCallback } from "react";
import { boundary } from "@shopify/shopify-app-react-router/server";
import { authenticate } from "../shopify.server";
import { loadCampaigns, deleteCampaign, toggleCampaignStatus } from "../services/campaignService.server.js";
import {
  Page, Card, IndexTable, Text, Badge, EmptyState, Toast, Frame,
  Filters, ChoiceList, BlockStack, InlineStack, Box, InlineGrid,
  Button, Popover, ActionList, Pagination,
} from "@shopify/polaris";

export const loader = async ({ request }) => {
  const { session } = await authenticate.admin(request);
  const url = new URL(request.url);
  const page = parseInt(url.searchParams.get("page") || "1");
  return await loadCampaigns(session, page);
};

export const action = async ({ request }) => {
  const { session } = await authenticate.admin(request);
  const formData = await request.formData();
  const actionType = formData.get("actionType");
  const campaignId = formData.get("campaignId");

  if (actionType === "delete") return await deleteCampaign(session, campaignId);
  if (actionType === "toggle_status") return await toggleCampaignStatus(session, campaignId);
  return { success: false };
};

const STATUS_TONE = { active: "success", paused: "attention", completed: undefined };

export default function Campaigns() {
  const { campaigns, stats, currency, totalPages, currentPage } = useLoaderData();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const fetcher = useFetcher();

  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState([]);
  const [activePopoverId, setActivePopoverId] = useState(null);
  const [toastActive, setToastActive] = useState(false);
  const [toastMessage, setToastMessage] = useState("");

  const showToast = (message) => {
    setToastMessage(message);
    setToastActive(true);
  };

  useEffect(() => {
    if (fetcher.data?.success) {
      if (fetcher.data.type === "deleted") showToast("Campaign deleted");
      if (fetcher.data.type === "toggled") showToast("Campaign status updated");
    }
    if (fetcher.data?.error) showToast(fetcher.data.error);
  }, [fetcher.data]);

  const goToPage = (page) => {
    const params = new URLSearchParams(searchParams);
    params.set("page", page.toString());
    setSearchParams(params);
  };

  const filtered = campaigns.filter((c) => {
    const matchSearch =
      c.campaignName.toLowerCase().includes(search.toLowerCase()) ||
      c.campaignCode.toLowerCase().includes(search.toLowerCase());
    const matchStatus = statusFilter.length === 0 || statusFilter.includes(c.status);
    return matchSearch && matchStatus;
  });

  const handleToggleStatus = (campaignId) => {
    setActivePopoverId(null);
    const form = new FormData();
    form.set("actionType", "toggle_status");
    form.set("campaignId", campaignId);
    fetcher.submit(form, { method: "POST" });
  };

  const handleDelete = (campaign) => {
    setActivePopoverId(null);
    if (confirm(`Delete "${campaign.campaignName}"?`)) {
      const form = new FormData();
      form.set("actionType", "delete");
      form.set("campaignId", campaign.id);
      fetcher.submit(form, { method: "POST" });
    }
  };

  const filters = [
    {
      key: "status", label: "Status",
      filter: (
        <ChoiceList title="Status" titleHidden
          choices={[
            { label: "Active", value: "active" },
            { label: "Paused", value: "paused" },
            { label: "Completed", value: "completed" },
          ]}
          selected={statusFilter} onChange={setStatusFilter} allowMultiple />
      ),
      shortcut: true,
    },
  ];

  const appliedFilters = [];
  if (statusFilter.length > 0) {
    appliedFilters.push({ key: "status", label: `Status: ${statusFilter.join(", ")}`, onRemove: () => setStatusFilter([]) });
  }

  const rowMarkup = filtered.map((c, index) => (
    <IndexTable.Row id={c.id} key={c.id} position={index} onClick={() => navigate(`/app/campaigns/${c.id}`)}>
      <IndexTable.Cell>
        <BlockStack gap="050">
          <Text variant="bodyMd" fontWeight="semibold" as="span">{c.campaignName}</Text>
          <Text variant="bodySm" tone="subdued" as="span">{c.campaignCode}</Text>
        </BlockStack>
      </IndexTable.Cell>
      <IndexTable.Cell>
        <Badge tone={STATUS_TONE[c.status]}>{c.status.charAt(0).toUpperCase() + c.status.slice(1)}</Badge>
      </IndexTable.Cell>
      <IndexTable.Cell>
        <Text variant="bodySm" as="span">{c.startDate} — {c.endDate}</Text>
      </IndexTable.Cell>
      <IndexTable.Cell>
        <Text variant="bodyMd" fontWeight="bold" tone="success" as="span">
          {currency} {c.totalRevenue.toLocaleString()}
        </Text>
      </IndexTable.Cell>
      <IndexTable.Cell>
        <Text variant="bodySm" as="span">{c.totalOrders}</Text>
      </IndexTable.Cell>
      <IndexTable.Cell>
        <div onClick={(e) => e.stopPropagation()}>
          <Popover
            active={activePopoverId === c.id}
            activator={
              <Button variant="tertiary" onClick={() => setActivePopoverId(activePopoverId === c.id ? null : c.id)}>⋯</Button>
            }
            onClose={() => setActivePopoverId(null)}
            preferredAlignment="right"
          >
            <ActionList
              items={[
                { content: "View details", onAction: () => { setActivePopoverId(null); navigate(`/app/campaigns/${c.id}`); } },
                { content: c.status === "active" ? "Pause campaign" : "Activate campaign", onAction: () => handleToggleStatus(c.id) },
                { content: "Delete", destructive: true, onAction: () => handleDelete(c) },
              ]}
            />
          </Popover>
        </div>
      </IndexTable.Cell>
    </IndexTable.Row>
  ));

  const emptyStateMarkup =
    campaigns.length === 0 ? (
      <EmptyState
        heading="No campaigns yet"
        action={{ content: "Create campaign", onAction: () => navigate("/app/campaigns/create") }}
        image="https://cdn.shopify.com/s/files/1/0262/4071/2726/files/emptystate-files.png"
      >
        <p>Create your first campaign to start tracking WhatsApp marketing revenue.</p>
      </EmptyState>
    ) : (
      <EmptyState heading="No matching campaigns" image="">
        <p>Try adjusting your search or filters.</p>
      </EmptyState>
    );

  return (
    <Frame>
      <Page
        title="Campaign Tracking"
        subtitle="Track revenue from WhatsApp marketing campaigns."
        primaryAction={{ content: "Create campaign", onAction: () => navigate("/app/campaigns/create") }}
      >
        <Box paddingBlockEnd="400">
          <InlineGrid columns={{ xs: 2, sm: 4 }} gap="300">
            {[
              { label: "Total Campaigns", value: stats.total },
              { label: "Active", value: stats.active },
              { label: "Total Revenue", value: `${currency} ${stats.totalRevenue.toLocaleString()}` },
              { label: "Attributed Orders", value: stats.totalOrders },
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
              queryPlaceholder="Search campaigns..."
              onQueryChange={setSearch}
              onQueryClear={() => setSearch("")}
              filters={filters}
              appliedFilters={appliedFilters}
              onClearAll={() => { setSearch(""); setStatusFilter([]); }}
            />
          </div>

          {filtered.length > 0 ? (
            <IndexTable
              resourceName={{ singular: "campaign", plural: "campaigns" }}
              itemCount={filtered.length}
              headings={[
                { title: "Campaign" }, { title: "Status" }, { title: "Duration" },
                { title: "Revenue" }, { title: "Orders" }, { title: "Actions" },
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

        <Box paddingBlockEnd="800" />
        {toastActive && <Toast content={toastMessage} onDismiss={() => setToastActive(false)} duration={3000} />}
      </Page>
    </Frame>
  );
}

export const headers = (headersArgs) => {
  return boundary.headers(headersArgs);
};