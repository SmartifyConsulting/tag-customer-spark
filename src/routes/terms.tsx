import { createFileRoute } from "@tanstack/react-router";
import { MarketingHeader, MarketingFooter } from "@/components/marketing-page";

export const Route = createFileRoute("/terms")({
  ssr: false,
  head: () => ({
    meta: [
      { title: "Terms and Conditions — Tag" },
      { name: "description", content: "The terms that govern your use of Tag." },
    ],
  }),
  component: TermsPage,
});

function TermsPage() {
  return (
    <div className="min-h-screen bg-background text-foreground">
      <MarketingHeader />
      <article className="mx-auto max-w-3xl px-6 py-12">
        <h1 className="text-3xl font-bold tracking-tight">Terms and Conditions</h1>
        <p className="mt-2 text-sm text-muted-foreground">Last updated: 17 July 2026</p>
        <p className="mt-2 rounded-lg border border-border/60 bg-muted/40 p-3 text-xs text-muted-foreground">
          This is a standard template covering the sections a retail SaaS platform typically
          needs. It has not been reviewed by a lawyer — have it checked against your specific
          business and local law (and the placeholder company details below filled in) before
          relying on it.
        </p>

        <div className="prose prose-sm mt-8 max-w-none space-y-6 text-sm leading-relaxed text-muted-foreground">
          <section>
            <h2 className="text-lg font-semibold text-foreground">1. Agreement to Terms</h2>
            <p>
              These Terms and Conditions ("Terms") form a binding agreement between you ("you",
              "your", the "Retailer") and [Company Legal Name] ("Tag", "we", "us", "our"),
              governing your access to and use of the Tag platform, including our website,
              dashboard, QR/product tagging tools, WhatsApp messaging features, and any related
              services (together, the "Service"). By creating an account or using the Service,
              you agree to these Terms. If you don't agree, don't use the Service.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-foreground">2. Eligibility and Accounts</h2>
            <p>
              You must be at least 18 years old and able to form a binding contract to create an
              account. You're responsible for the accuracy of the information you provide, for
              keeping your login credentials confidential, and for all activity that occurs under
              your account. Notify us immediately of any unauthorised use.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-foreground">3. The Service</h2>
            <p>
              Tag helps retailers generate QR-based digital product experiences, capture customer
              interest and intent signals, and re-engage shoppers via WhatsApp and other
              notification channels. We may add, change, or remove features at any time. We aim
              for high availability but don't guarantee the Service will be uninterrupted,
              error-free, or available at all times.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-foreground">4. Subscriptions, Billing and Cancellation</h2>
            <p>
              Paid plans are billed in advance on a monthly or annual cycle via the payment
              provider you select (currently PayFast or PayPal). Fees are non-refundable except
              where required by law. You can cancel at any time; cancellation takes effect at the
              end of your current billing period, and you'll retain access until then. We may
              change our pricing with reasonable advance notice; continued use after a price
              change takes effect constitutes acceptance of the new pricing.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-foreground">5. Acceptable Use</h2>
            <p>You agree not to use the Service to:</p>
            <ul className="list-disc space-y-1 pl-5">
              <li>Send unsolicited, misleading, or unlawful messages to customers;</li>
              <li>Upload content you don't have the rights to, or that infringes someone else's intellectual property;</li>
              <li>Attempt to gain unauthorised access to the Service, other accounts, or our infrastructure;</li>
              <li>Reverse-engineer, scrape, or resell the Service without our written consent; or</li>
              <li>Use the Service in a way that breaches applicable consumer protection, data protection, or electronic communications law in your jurisdiction.</li>
            </ul>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-foreground">6. Your Data and Customer Data</h2>
            <p>
              You retain ownership of the product, store, and customer data you upload or that is
              collected through your use of the Service ("Retailer Data"). You're responsible for
              having a lawful basis (e.g. consent) to collect and process your customers'
              personal information, including for WhatsApp messaging, and for complying with
              applicable data protection law (such as South Africa's POPIA or the EU's GDPR where
              relevant). We process Retailer Data on your behalf as described in our{" "}
              <a href="/privacy" className="font-medium text-foreground underline">
                Privacy Policy
              </a>
              .
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-foreground">7. Intellectual Property</h2>
            <p>
              The Service, including its software, design, and branding, is owned by us or our
              licensors and is protected by intellectual property law. These Terms don't grant
              you any rights to our trademarks or branding. You grant us a limited licence to use
              your Retailer Data solely to provide and improve the Service to you.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-foreground">8. Third-Party Services</h2>
            <p>
              The Service integrates with third-party providers (e.g. WhatsApp/Meta, PayFast,
              PayPal, Google, and others) whose own terms and privacy policies also apply to your
              use of those integrations. We aren't responsible for the availability or conduct of
              third-party services.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-foreground">9. Disclaimers</h2>
            <p>
              The Service is provided "as is" and "as available" without warranties of any kind,
              whether express or implied, including warranties of merchantability, fitness for a
              particular purpose, or non-infringement, to the fullest extent permitted by law.
              Intent scores, forecasts, and AI-generated insights are estimates based on available
              data and are not guarantees of sales outcomes.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-foreground">10. Limitation of Liability</h2>
            <p>
              To the fullest extent permitted by law, we won't be liable for any indirect,
              incidental, special, consequential, or punitive damages, or any loss of profits,
              revenue, or data, arising from your use of the Service. Our total liability for any
              claim arising out of these Terms is limited to the amount you paid us in the twelve
              months preceding the claim.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-foreground">11. Termination</h2>
            <p>
              You may stop using the Service and close your account at any time. We may suspend or
              terminate your access if you materially breach these Terms, fail to pay fees when
              due, or if required by law. On termination, your right to use the Service ends, and
              we may delete your data after a reasonable retention period, subject to our Privacy
              Policy and any legal retention obligations.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-foreground">12. Changes to These Terms</h2>
            <p>
              We may update these Terms from time to time. We'll notify you of material changes
              (e.g. by email or an in-app notice) before they take effect. Continued use of the
              Service after changes take effect constitutes acceptance of the updated Terms.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-foreground">13. Governing Law</h2>
            <p>
              These Terms are governed by the laws of South Africa, without regard to conflict of
              law principles, unless otherwise required by mandatory local consumer protection law
              in your jurisdiction.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-foreground">14. Contact</h2>
            <p>
              Questions about these Terms? Contact us at{" "}
              <a href="mailto:hello@tag-tech.co.za" className="font-medium text-foreground underline">
                hello@tag-tech.co.za
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
