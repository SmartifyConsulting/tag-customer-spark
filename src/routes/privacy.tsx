import { createFileRoute } from "@tanstack/react-router";
import { MarketingHeader, MarketingFooter } from "@/components/marketing-page";

export const Route = createFileRoute("/privacy")({
  ssr: false,
  head: () => ({
    meta: [
      { title: "Privacy Policy — Tag" },
      { name: "description", content: "How Tag collects, uses, and protects your data." },
    ],
  }),
  component: PrivacyPage,
});

function PrivacyPage() {
  return (
    <div className="min-h-screen bg-background text-foreground">
      <MarketingHeader />
      <article className="mx-auto max-w-3xl px-6 py-12">
        <h1 className="text-3xl font-bold tracking-tight">Privacy Policy</h1>
        <p className="mt-2 text-sm text-muted-foreground">Last updated: 17 July 2026</p>
        <p className="mt-2 rounded-lg border border-border/60 bg-muted/40 p-3 text-xs text-muted-foreground">
          This is a standard template covering the sections a retail SaaS platform typically
          needs. It has not been reviewed by a lawyer — have it checked against your specific
          data flows and applicable law (e.g. POPIA, GDPR) before relying on it.
        </p>

        <div className="prose prose-sm mt-8 max-w-none space-y-6 text-sm leading-relaxed text-muted-foreground">
          <section>
            <h2 className="text-lg font-semibold text-foreground">1. Introduction</h2>
            <p>
              This Privacy Policy explains how [Company Legal Name] ("Tag", "we", "us", "our")
              collects, uses, discloses, and protects information when you use the Tag platform,
              including our website, dashboard, QR/product tagging tools, and WhatsApp messaging
              features (together, the "Service"). It applies to retailers who create an account
              ("Retailers") and to their customers whose data Retailers process through the
              Service ("End Customers").
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-foreground">2. Information We Collect</h2>
            <p>From Retailers, we collect:</p>
            <ul className="list-disc space-y-1 pl-5">
              <li>Account details — name, email, phone, company name, branch/store name, province, and country;</li>
              <li>Billing details — processed by our payment providers (PayFast, PayPal); we don't store full card numbers ourselves;</li>
              <li>Company website URL, used to automatically retrieve a logo for your workspace;</li>
              <li>Product, inventory, and store data you upload to the Service; and</li>
              <li>Usage data — pages visited, features used, device and browser information, and log data.</li>
            </ul>
            <p className="mt-2">
              From End Customers (collected by Retailers through the Service, and processed by us
              on the Retailer's behalf), we may process: QR scan events, product interest and
              intent signals, and WhatsApp contact details and message history where an End
              Customer opts in to be contacted by a Retailer.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-foreground">3. How We Use Information</h2>
            <p>We use the information we collect to:</p>
            <ul className="list-disc space-y-1 pl-5">
              <li>Provide, operate, and maintain the Service, including your dashboard and analytics;</li>
              <li>Generate intent scores, forecasts, and recommendations from interest signals;</li>
              <li>Process payments and manage subscriptions;</li>
              <li>Send transactional communications (e.g. confirmation emails, billing receipts, product updates);</li>
              <li>Detect, investigate, and prevent fraud, abuse, and security incidents; and</li>
              <li>Comply with legal obligations.</li>
            </ul>
            <p className="mt-2">
              We don't sell personal information to third parties, and we don't use End Customer
              data collected on behalf of a Retailer for our own independent marketing purposes.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-foreground">4. Legal Basis for Processing</h2>
            <p>
              Where applicable data protection law requires it, we rely on: performance of a
              contract (providing the Service you signed up for), your consent (e.g. for
              WhatsApp/marketing messages, which End Customers must opt into separately), our
              legitimate interests (e.g. fraud prevention, service improvement), and compliance
              with legal obligations.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-foreground">5. Sharing of Information</h2>
            <p>We share information with:</p>
            <ul className="list-disc space-y-1 pl-5">
              <li>Infrastructure and processing providers — including Supabase (database, authentication, file storage) and our hosting provider;</li>
              <li>Payment providers — PayFast and PayPal, to process subscription billing;</li>
              <li>Messaging providers — WhatsApp/Meta and our transactional email provider, to deliver notifications you or your End Customers have opted into;</li>
              <li>Logo lookup providers — Clearbit, to retrieve a public logo image for the website you provide; and</li>
              <li>Law enforcement or regulators, where required by law or to protect our rights and the safety of our users.</li>
            </ul>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-foreground">6. Data Retention</h2>
            <p>
              We retain account and Retailer Data for as long as your account is active, and for a
              reasonable period afterwards to comply with legal, tax, and accounting obligations
              or to resolve disputes. You can request earlier deletion of your data, subject to
              those obligations, by contacting us.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-foreground">7. Data Security</h2>
            <p>
              We use industry-standard measures to protect your data, including encryption in
              transit, role-based access controls, and row-level security on our database. No
              method of transmission or storage is completely secure, and we can't guarantee
              absolute security.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-foreground">8. International Transfers</h2>
            <p>
              Our infrastructure providers may process data outside South Africa. Where this
              happens, we take reasonable steps to ensure an adequate level of protection for your
              data, consistent with POPIA and, where applicable, GDPR.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-foreground">9. Your Rights</h2>
            <p>
              Subject to applicable law, you may have the right to access, correct, delete, or
              export your personal information, to object to or restrict certain processing, and
              to withdraw consent (e.g. for WhatsApp messages) at any time. To exercise these
              rights, contact us using the details below.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-foreground">10. Cookies</h2>
            <p>
              We use essential cookies to keep you signed in and to remember your preferences. We
              may use additional analytics cookies to understand how the Service is used; where
              required, we'll ask for your consent before setting these.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-foreground">11. Children's Privacy</h2>
            <p>
              The Service is intended for business use by adults and isn't directed at children.
              We don't knowingly collect personal information from children.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-foreground">12. Changes to This Policy</h2>
            <p>
              We may update this Privacy Policy from time to time. We'll notify you of material
              changes (e.g. by email or an in-app notice) before they take effect.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-foreground">13. Contact Us</h2>
            <p>
              Questions about this Privacy Policy or your data? Contact us at{" "}
              <a href="mailto:hello@mypenguin.co.za" className="font-medium text-foreground underline">
                hello@mypenguin.co.za
              </a>
              . See also our{" "}
              <a href="/terms" className="font-medium text-foreground underline">
                Terms and Conditions
              </a>
              .
            </p>
          </section>
        </div>
      </article>
      <MarketingFooter />
    </div>
  );
}
