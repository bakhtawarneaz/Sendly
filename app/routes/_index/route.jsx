import { redirect } from "react-router";

export const loader = async ({ request }) => {
  const url = new URL(request.url);
  const search = url.search;
  throw redirect(`/app${search}`);
};

export default function Index() {
  return null;
}