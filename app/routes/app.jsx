import { Outlet, useLoaderData, useRouteError } from "react-router";
import { boundary } from "@shopify/shopify-app-react-router/server";
import { AppProvider as ShopifyAppProvider } from "@shopify/shopify-app-react-router/react";
import { AppProvider as PolarisProvider } from "@shopify/polaris";
import { authenticate } from "../shopify.server";
import { ensureStore } from "../utils/ensureStore.server";
import "@shopify/polaris/build/esm/styles.css";
import enTranslations from "@shopify/polaris/locales/en.json";

export const loader = async ({ request }) => {
  const { session, admin } = await authenticate.admin(request);
  await ensureStore(session, admin);
  return { apiKey: process.env.SHOPIFY_API_KEY || "" };
};

export default function App() {
  const { apiKey } = useLoaderData();

  return (
    <PolarisProvider i18n={enTranslations}>
      <ShopifyAppProvider embedded apiKey={apiKey}>
        <s-app-nav>
          <s-link href="/app">Dashboard</s-link>
          <s-link href="/app/plans">Pricing & Plans</s-link>
          <s-link href="/app/analytics">Analytics</s-link>
          <s-link href="/app/services">Services</s-link>
          <s-link href="/app/templates">Templates</s-link>
          <s-link href="/app/message-logs">Message Logs</s-link>
          <s-link href="/app/campaigns">Campaign Tracking</s-link>
          <s-link href="/app/chat-button">Chat Button</s-link>
          <s-link href="/app/settings">Settings</s-link>
        </s-app-nav>
        <Outlet />
      </ShopifyAppProvider>
    </PolarisProvider>
  );
}

export function ErrorBoundary() {
  return boundary.error(useRouteError());
}

export const headers = (headersArgs) => {
  return boundary.headers(headersArgs);
};