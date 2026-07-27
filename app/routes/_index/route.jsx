import { redirect, Form, useLoaderData } from "react-router";
import { login } from "../../shopify.server";
import styles from "./styles.module.css";
import { useEffect } from "react";
import { Link } from "react-router";

export const loader = async ({ request }) => {
  const url = new URL(request.url);
  if (
    url.searchParams.get("shop") ||
    url.searchParams.get("host") ||
    url.searchParams.get("embedded")
  ) {
    throw redirect(`/app?${url.searchParams.toString()}`);
  }

  return { showForm: Boolean(login) };
};

const STAGES = [
  {
    n: "01",
    title: "Order confirmation",
    desc: "A WhatsApp message goes out the second an order is placed. Customers confirm or cancel with one tap.",
    tag: "reply buttons",
  },
  {
    n: "02",
    title: "Order paid",
    desc: "Payment confirmed? Customers hear it from you before they think to ask.",
  },
  {
    n: "03",
    title: "Order fulfilled",
    desc: "Shipment details and tracking link, sent the moment fulfilment is created.",
    tag: "tracking link",
  },
  {
    n: "04",
    title: "Order delivered",
    desc: "Close the loop with a delivery confirmation — the natural place to ask for a review.",
  },
  {
    n: "05",
    title: "Order cancelled",
    desc: "Cancellations explained clearly, so support tickets never get opened.",
  },
  {
    n: "06",
    title: "Abandoned checkout recovery",
    desc: "A timed WhatsApp reminder brings shoppers back to the checkout they left behind.",
    tag: "recover revenue",
  },
];

const FEATURES = [
  {
    title: "Editable templates",
    desc: "Rewrite any message in your own voice. Merge order number, name, total, and tracking into the copy.",
    icon: "M21 11.5a8.4 8.4 0 0 1-9 8.4 8.5 8.5 0 0 1-4-1L3 21l2.1-5a8.4 8.4 0 0 1-1-4 8.4 8.4 0 0 1 8.4-8.4h.5A8.4 8.4 0 0 1 21 11v.5z",
  },
  {
    title: "Delivery analytics",
    desc: "See what was sent, delivered, read, and replied to. Every message logged with its status.",
    icon: "M3 3v18h18M19 9l-5 5-4-4-3 3",
  },
  {
    title: "Official WhatsApp API",
    desc: "Runs on Meta's Business API — no unofficial workarounds, no risk of a blocked number.",
    icon: "M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z",
  },
  {
    title: "Toggle any service",
    desc: "Turn each notification on or off independently. Start with confirmations, add the rest when ready.",
    icon: "M12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6zM12 2v3M12 19v3M4.2 4.2l2.1 2.1M17.7 17.7l2.1 2.1M2 12h3M19 12h3M4.2 19.8l2.1-2.1M17.7 6.3l2.1-2.1",
  },
  {
    title: "Real-time triggers",
    desc: "Shopify webhooks fire straight into Sendly, so messages land in seconds — not on a schedule.",
    icon: "M13 2 3 14h9l-1 8 10-12h-9l1-8z",
  },
  {
    title: "Lives in Shopify admin",
    desc: "Embedded app — nothing new to learn, no second tab to keep open.",
    icon: "M3 3h18v18H3zM9 3v18M3 9h6",
  },
];

function Icon({ d }) {
  return (
    <svg
      width="20"
      height="20"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d={d} />
    </svg>
  );
}

export default function App() {
  const { showForm } = useLoaderData();
  useEffect(() => {
    if (typeof window !== "undefined" && window.top !== window.self) {
      window.location.href = "/app" + window.location.search;
    }
  }, []);
  if (typeof window !== "undefined" && window.top !== window.self) {
    return null;
  }
  
  return (
    <div className={styles.page}>
      <section className={styles.hero}>
        <div className={styles.heroGrid}>
          <div>
            <span className={styles.eyebrow}>
              <span className={styles.dot} />
              Shopify + WhatsApp Business API
            </span>
            <h1 className={styles.heading}>
              Every order update, <em>on WhatsApp</em>, the moment it happens.
            </h1>
            <p className={styles.lede}>
              Sendly watches your store and messages customers automatically —
              confirmation, fulfilment, delivery, cancellation, payment, and
              abandoned carts. No dashboards to babysit.
            </p>
          </div>

          {showForm && (
            <div className={styles.card} id="start">
              <h2 className={styles.cardHeading}>Open your dashboard</h2>
              <p className={styles.cardText}>
                Enter your store domain to continue.
              </p>
              <Form className={styles.form} method="post" action="/auth/login">
                <label className={styles.label} htmlFor="shop">
                  Shop domain
                </label>
                <div className={styles.field}>
                  <input
                    id="shop"
                    className={styles.input}
                    type="text"
                    name="shop"
                    placeholder="my-store.myshopify.com"
                    autoComplete="off"
                    spellCheck="false"
                    required
                  />
                </div>
                <p className={styles.hint}>
                  Use your permanent Shopify URL, e.g.{" "}
                  <code>my-store.myshopify.com</code>
                </p>
                <button className={styles.button} type="submit">
                  Log in
                </button>
              </Form>
              <ul className={styles.trust}>
                <li>7-day free trial</li>
                <li>No card required</li>
                <li>Setup in minutes</li>
              </ul>
            </div>
          )}
        </div>
      </section>

      <section className={styles.section} id="journey">
        <div className={styles.sectionHead}>
          <h2>The order journey, covered end to end</h2>
          <p>
            Six moments where a silent store loses trust. Sendly speaks at each
            one.
          </p>
        </div>

        <ol className={styles.rail}>
          {STAGES.map((s) => (
            <li key={s.n} className={styles.stage}>
              <span className={styles.marker}>{s.n}</span>
              <div className={styles.stageBody}>
                <h3>{s.title}</h3>
                <p>{s.desc}</p>
                {s.tag && <span className={styles.tag}>{s.tag}</span>}
              </div>
            </li>
          ))}
        </ol>
      </section>

      <section className={styles.section} id="features">
        <div className={styles.sectionHead}>
          <h2>Built to run itself</h2>
          <p>Configure once from inside Shopify admin. Sendly handles the rest.</p>
        </div>
        <ul className={styles.list}>
          {FEATURES.map((f) => (
            <li key={f.title} className={styles.feature}>
              <span className={styles.featureIcon}>
                <Icon d={f.icon} />
              </span>
              <h3>{f.title}</h3>
              <p>{f.desc}</p>
            </li>
          ))}
        </ul>
      </section>

      <section className={styles.section}>
        <div className={styles.cta}>
          <h2>Start with seven days on us</h2>
          <p>
            Switch on every service, send real messages, and see the replies come
            in. Add a card only if you keep it.
          </p>
          <Link to="/app/settings" className={styles.ctaButton}>
            Connect your store
          </Link>
        </div>
      </section>

      <footer className={styles.footer}>
        <span>
          © 2026 DEVMANTIC (PRIVATE) LIMITED — <strong>Sendly</strong>
        </span>
        <nav>
        <a
            href="https://devmantic.com/sendly-privacy-policy/"
            target="_blank"
            rel="noopener noreferrer"
          >
            Privacy Policy
          </a>
          <a
            href="https://devmantic.com/sendly-terms/"
            target="_blank"
            rel="noopener noreferrer"
          >
            Terms &amp; Conditions
          </a>
        </nav>
      </footer>
    </div>
  );
}