import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ArrowLeft, FileText } from "lucide-react";
import { Link } from "wouter";
import { ScrollArea } from "@/components/ui/scroll-area";

export default function BusinessTerms() {
  return (
    <div className="min-h-screen bg-background">
      <div className="max-w-4xl mx-auto px-4 py-8">
        <div className="mb-6">
          <Link href="/pricing">
            <Button variant="ghost" size="sm" className="gap-2" data-testid="button-back-pricing">
              <ArrowLeft className="h-4 w-4" />
              Back to Pricing
            </Button>
          </Link>
        </div>

        <Card>
          <CardHeader className="border-b">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-primary/10">
                <FileText className="h-6 w-6 text-primary" />
              </div>
              <div>
                <CardTitle className="text-2xl">SlipSafe Business Pricing & Subscription Terms</CardTitle>
                <p className="text-sm text-muted-foreground mt-1">Version 1.0 - Effective December 2024</p>
              </div>
            </div>
          </CardHeader>
          <CardContent className="p-0">
            <ScrollArea className="h-[calc(100vh-280px)]">
              <div className="p-6 space-y-8 text-sm leading-relaxed">
                
                <section>
                  <h2 className="text-lg font-semibold mb-3" data-testid="section-overview">1. Overview</h2>
                  <p className="text-muted-foreground">
                    SlipSafe is a digital receipt, returns, and warranty management platform designed to help individuals and businesses digitise, store, and manage their purchase receipts. The platform provides OCR-based receipt scanning, automatic policy extraction for returns, refunds, exchanges, and warranties, as well as tools for generating verifiable claims.
                  </p>
                  <p className="text-muted-foreground mt-2">
                    Individual users may use SlipSafe free of charge for personal, non-commercial purposes. Small and Medium-sized Enterprises (SMMEs) and business users who require business-specific features, including business profiles, team workspaces, advanced reporting, and data exports, must subscribe to one of our paid Business plans.
                  </p>
                </section>

                <section>
                  <h2 className="text-lg font-semibold mb-3" data-testid="section-definitions">2. Definitions</h2>
                  <ul className="space-y-2 text-muted-foreground list-disc pl-5">
                    <li><strong>"SlipSafe"</strong> refers to the platform, including the Progressive Web Application (PWA), merchant verification portal, and all associated services.</li>
                    <li><strong>"Customer"</strong> means the SMME, business entity, or individual who subscribes to a SlipSafe Business plan.</li>
                    <li><strong>"User"</strong> refers to any individual authorised by the Customer to access and use SlipSafe under the Customer's subscription.</li>
                    <li><strong>"Business Receipts"</strong> are receipts stored and managed within a business profile or workspace, as opposed to personal receipts.</li>
                    <li><strong>"Subscription"</strong> refers to the paid agreement between the Customer and SlipSafe for access to Business plan features.</li>
                  </ul>
                </section>

                <section>
                  <h2 className="text-lg font-semibold mb-3" data-testid="section-eligibility">3. Eligibility and Scope</h2>
                  <ul className="space-y-2 text-muted-foreground list-disc pl-5">
                    <li>The SlipSafe Free plan is intended for personal, non-commercial use only. Users may not use the Free plan for business purposes.</li>
                    <li>Business plans (Business Solo, Business Team, and Enterprise) are designed for SMMEs, freelancers, sole traders, and business entities that require business-specific features.</li>
                    <li>The Customer is responsible for ensuring that SlipSafe is suitable for their specific reporting, tax, VAT, and compliance requirements. SlipSafe is a management tool and does not provide legal, tax, or accounting advice.</li>
                    <li>By subscribing to a Business plan, the Customer confirms that they have the authority to enter into this agreement on behalf of their business entity.</li>
                  </ul>
                </section>

                <section>
                  <h2 className="text-lg font-semibold mb-3" data-testid="section-billing">4. Billing and Payment</h2>
                  <ul className="space-y-2 text-muted-foreground list-disc pl-5">
                    <li><strong>Billing Options:</strong> Business plans are available on a month-to-month or annual subscription basis.</li>
                    <li><strong>Month-to-Month Subscriptions:</strong> Billed monthly in advance. The subscription automatically renews each month until cancelled. To avoid being charged for the next billing period, cancellation must be made before the next billing date.</li>
                    <li><strong>Annual Subscriptions:</strong> Represent a 12-month commitment, typically at a discounted rate compared to month-to-month pricing. Annual subscriptions may be billed upfront or as a fixed monthly amount over the 12-month term, as specified at the time of subscription. Early termination of an annual subscription may result in penalties, including reversal of any discounts applied.</li>
                    <li><strong>Payment Methods:</strong> We accept card payments and other methods as made available through our payment processor. Payment is due at the time of subscription and at each renewal period.</li>
                    <li><strong>Taxes:</strong> All prices are exclusive of applicable taxes, including Value Added Tax (VAT). Taxes will be added to your invoice where required by law.</li>
                    <li><strong>Non-Payment:</strong> Failure to pay subscription fees may result in suspension or termination of access to Business plan features. SlipSafe reserves the right to pursue collection of outstanding amounts.</li>
                  </ul>
                </section>

                <section>
                  <h2 className="text-lg font-semibold mb-3" data-testid="section-changes">5. Upgrades, Downgrades and Plan Changes</h2>
                  <ul className="space-y-2 text-muted-foreground list-disc pl-5">
                    <li>Customers may upgrade from Business Solo to Business Team or Enterprise at any time. Upgraded pricing takes effect from the next billing cycle.</li>
                    <li>If the Customer's usage exceeds the limits of their current plan, SlipSafe may notify the Customer and recommend an upgrade to a higher-tier plan.</li>
                    <li>Downgrades are permitted with reasonable notice, provided the Customer's usage fits within the limits of the new plan. Any unused prepaid amounts are non-refundable unless otherwise stated.</li>
                    <li>Plan changes made during a billing cycle will be reflected in the next billing period.</li>
                  </ul>
                </section>

                <section>
                  <h2 className="text-lg font-semibold mb-3" data-testid="section-limits">6. Fair Use and Limits</h2>
                  <ul className="space-y-2 text-muted-foreground list-disc pl-5">
                    <li><strong>Business Solo:</strong> Designed for sole traders and one-person businesses. Limited to 1 user and up to 1,000 business receipts per month.</li>
                    <li><strong>Business Team:</strong> Designed for teams of 2-10 users with up to 5,000 business receipts per month. Additional users above 10 may be available at an additional cost per user per month.</li>
                    <li><strong>Enterprise:</strong> Custom pricing and limits for organisations requiring more than 5,000 receipts per month or more than 10 users. Contact SlipSafe for a tailored solution.</li>
                    <li>Exceeding the receipt or user limits of your plan may require an upgrade to a higher-tier plan or Enterprise arrangement.</li>
                    <li>SlipSafe reserves the right to apply fair-use measures to protect platform stability and ensure service quality for all users.</li>
                  </ul>
                </section>

                <section>
                  <h2 className="text-lg font-semibold mb-3" data-testid="section-security">7. User Accounts and Security</h2>
                  <ul className="space-y-2 text-muted-foreground list-disc pl-5">
                    <li>The Customer is responsible for managing user access, roles, and permissions within their workspace.</li>
                    <li>Users must keep their login credentials confidential and must not share accounts with unauthorised individuals.</li>
                    <li>SlipSafe implements reasonable security measures to protect user data. However, SlipSafe is not liable for any misuse resulting from compromised credentials or unauthorised access caused by the Customer's or User's actions or negligence.</li>
                  </ul>
                </section>

                <section>
                  <h2 className="text-lg font-semibold mb-3" data-testid="section-privacy">8. Data, Privacy and Retention</h2>
                  <ul className="space-y-2 text-muted-foreground list-disc pl-5">
                    <li>SlipSafe processes personal and business data in accordance with applicable data protection laws, including the Protection of Personal Information Act (POPIA) in South Africa.</li>
                    <li>Receipt data is retained for as long as necessary to provide the service and for a reasonable period thereafter, or as required by law.</li>
                    <li>The Customer remains solely responsible for meeting their own tax, audit, and record-keeping obligations. SlipSafe is intended as an aid to receipt management, not as a replacement for proper business record-keeping practices.</li>
                    <li>For more information on how we handle your data, please refer to our Privacy Policy.</li>
                  </ul>
                </section>

                <section>
                  <h2 className="text-lg font-semibold mb-3" data-testid="section-support">9. Support and Service Levels</h2>
                  <ul className="space-y-2 text-muted-foreground list-disc pl-5">
                    <li>SlipSafe uses reasonable efforts to maintain platform uptime and provide email-based support during business hours.</li>
                    <li>Formal Service Level Agreements (SLAs) with guaranteed uptime and response times may be negotiated as part of Enterprise plans.</li>
                    <li>SlipSafe may perform maintenance or updates from time to time, which may temporarily affect service availability. Where possible, advance notice will be provided for scheduled maintenance.</li>
                  </ul>
                </section>

                <section>
                  <h2 className="text-lg font-semibold mb-3" data-testid="section-pricing-changes">10. Changes to Pricing and Terms</h2>
                  <ul className="space-y-2 text-muted-foreground list-disc pl-5">
                    <li>SlipSafe reserves the right to adjust pricing, features, or these terms at any time.</li>
                    <li>Active Business subscribers will be notified of material changes with reasonable advance notice (typically at least 30 days).</li>
                    <li>Continued use of the service after such changes take effect constitutes acceptance of the revised terms.</li>
                    <li>If you do not agree with the changes, you may cancel your subscription before the changes take effect.</li>
                  </ul>
                </section>

                <section>
                  <h2 className="text-lg font-semibold mb-3" data-testid="section-cancellation">11. Cancellation and Termination</h2>
                  <ul className="space-y-2 text-muted-foreground list-disc pl-5">
                    <li><strong>Month-to-Month:</strong> The subscription continues until cancelled. You may cancel at any time through the billing management portal. Access to Business features will continue until the end of the current billing period.</li>
                    <li><strong>Annual:</strong> Annual subscriptions are typically fixed 12-month commitments. Early cancellation may incur penalties, including reversal of annual discounts and payment of the remaining subscription value.</li>
                    <li>SlipSafe reserves the right to suspend or terminate access for non-payment, abuse of the platform, violation of these terms, or any illegal activity.</li>
                    <li>Upon termination, the Customer may lose access to Business plan features and data stored within business workspaces. Customers are encouraged to export their data before cancellation.</li>
                  </ul>
                </section>

                <section>
                  <h2 className="text-lg font-semibold mb-3" data-testid="section-liability">12. Liability and Disclaimer</h2>
                  <ul className="space-y-2 text-muted-foreground list-disc pl-5">
                    <li>SlipSafe is provided on a "reasonable-effort" basis as Software-as-a-Service (SaaS). It is not intended to provide legal, tax, or accounting advice.</li>
                    <li>To the maximum extent permitted by law, SlipSafe's liability for any claims arising from or related to this agreement or the use of the service is limited to the subscription fees paid by the Customer for the relevant period (typically the preceding 12 months).</li>
                    <li>SlipSafe shall not be liable for any indirect, incidental, special, consequential, or punitive damages, including but not limited to loss of profits, data, or business opportunities.</li>
                    <li>The Customer is solely responsible for ensuring compliance with their own tax, VAT, and regulatory obligations.</li>
                  </ul>
                </section>

                <section>
                  <h2 className="text-lg font-semibold mb-3" data-testid="section-general">13. General Provisions</h2>
                  <ul className="space-y-2 text-muted-foreground list-disc pl-5">
                    <li><strong>Governing Law:</strong> These terms shall be governed by and construed in accordance with the laws of the Republic of South Africa.</li>
                    <li><strong>Dispute Resolution:</strong> Any disputes arising from these terms shall first be attempted to be resolved through good-faith negotiation. If unresolved, disputes may be referred to mediation or arbitration as agreed by the parties.</li>
                    <li><strong>Entire Agreement:</strong> These terms, together with any applicable pricing information and policies referenced herein, constitute the entire agreement between the Customer and SlipSafe regarding the subject matter.</li>
                    <li><strong>Severability:</strong> If any provision of these terms is found to be invalid or unenforceable, the remaining provisions shall continue in full force and effect.</li>
                  </ul>
                </section>

                <section className="bg-amber-50 dark:bg-amber-950/30 p-4 rounded-lg border border-amber-200 dark:border-amber-800">
                  <p className="text-amber-800 dark:text-amber-200 text-sm font-medium">
                    These terms are a working draft and should be reviewed with legal counsel before being considered final.
                  </p>
                </section>

                <section className="pt-4 border-t">
                  <p className="text-muted-foreground text-xs">
                    Last updated: December 2024. If you have any questions about these terms, please contact us at Support@slip-safe.net.
                  </p>
                </section>

              </div>
            </ScrollArea>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
