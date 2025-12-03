import { Link } from "wouter";
import { Button } from "@/components/ui/button";
import { ArrowLeft } from "lucide-react";
import logo from "@assets/SlipSafe Logo_1762888976121.png";

export default function Privacy() {
  return (
    <div className="min-h-screen bg-background" data-testid="page-privacy">
      {/* Header */}
      <header className="sticky top-0 z-50 bg-background/95 backdrop-blur border-b">
        <div className="max-w-4xl mx-auto px-4 py-4 flex items-center justify-between">
          <Link href="/">
            <div className="flex items-center gap-2 cursor-pointer">
              <img src={logo} alt="SlipSafe" className="h-8 w-8" />
              <span className="text-xl font-semibold">SlipSafe</span>
            </div>
          </Link>
          <Link href="/">
            <Button variant="ghost" size="sm" className="gap-2" data-testid="button-back-home">
              <ArrowLeft className="h-4 w-4" />
              Back to Home
            </Button>
          </Link>
        </div>
      </header>

      {/* Content */}
      <main className="max-w-4xl mx-auto px-4 py-12">
        <h1 className="text-3xl font-bold mb-8" data-testid="text-privacy-title">Privacy Policy</h1>
        
        <div className="prose prose-sm max-w-none space-y-6 text-muted-foreground">
          <p className="text-lg">
            Your privacy is important to us. This policy explains how SlipSafe collects, uses, and protects your information.
          </p>

          <section className="space-y-4">
            <h2 className="text-xl font-semibold text-foreground">1. Information We Collect</h2>
            <p>We collect information you provide directly, including:</p>
            <ul className="list-disc pl-6 space-y-2">
              <li>Account information (name, email, phone number)</li>
              <li>Receipt images and extracted data (merchant, amounts, dates)</li>
              <li>Business information for business accounts</li>
              <li>Usage data and analytics</li>
            </ul>
          </section>

          <section className="space-y-4">
            <h2 className="text-xl font-semibold text-foreground">2. How We Use Your Information</h2>
            <p>We use your information to:</p>
            <ul className="list-disc pl-6 space-y-2">
              <li>Provide and improve the SlipSafe service</li>
              <li>Process and store your receipts</li>
              <li>Send notifications about return and warranty deadlines</li>
              <li>Generate reports and summaries for your account</li>
              <li>Provide customer support</li>
            </ul>
          </section>

          <section className="space-y-4">
            <h2 className="text-xl font-semibold text-foreground">3. Data Security</h2>
            <p>
              We implement appropriate security measures to protect your data, including:
            </p>
            <ul className="list-disc pl-6 space-y-2">
              <li>Encryption of data in transit and at rest</li>
              <li>Secure cloud storage infrastructure</li>
              <li>Regular security audits and updates</li>
              <li>Access controls and authentication</li>
            </ul>
          </section>

          <section className="space-y-4">
            <h2 className="text-xl font-semibold text-foreground">4. Data Sharing</h2>
            <p>
              We do not sell your personal information. We may share data with:
            </p>
            <ul className="list-disc pl-6 space-y-2">
              <li>Service providers who help us operate the service</li>
              <li>Merchants for claim verification (only when you initiate a claim)</li>
              <li>Legal authorities when required by law</li>
            </ul>
          </section>

          <section className="space-y-4">
            <h2 className="text-xl font-semibold text-foreground">5. Your Rights</h2>
            <p>You have the right to:</p>
            <ul className="list-disc pl-6 space-y-2">
              <li>Access your personal data</li>
              <li>Correct inaccurate data</li>
              <li>Delete your account and data</li>
              <li>Export your data</li>
              <li>Opt out of marketing communications</li>
            </ul>
          </section>

          <section className="space-y-4">
            <h2 className="text-xl font-semibold text-foreground">6. Cookies</h2>
            <p>
              We use essential cookies to maintain your session and preferences. 
              We do not use third-party tracking cookies for advertising purposes.
            </p>
          </section>

          <section className="space-y-4">
            <h2 className="text-xl font-semibold text-foreground">7. Children's Privacy</h2>
            <p>
              SlipSafe is not intended for users under 18 years of age. We do not 
              knowingly collect information from children.
            </p>
          </section>

          <section className="space-y-4">
            <h2 className="text-xl font-semibold text-foreground">8. Changes to This Policy</h2>
            <p>
              We may update this privacy policy from time to time. We will notify you 
              of any material changes via email or through the service.
            </p>
          </section>

          <section className="space-y-4">
            <h2 className="text-xl font-semibold text-foreground">9. Contact Us</h2>
            <p>
              For questions about this Privacy Policy, please contact us at{" "}
              <a href="mailto:sales@slip-safe.net" className="text-primary hover:underline">
                sales@slip-safe.net
              </a>
            </p>
          </section>

          <p className="text-sm pt-8 border-t">
            Last updated: December 2024
          </p>
        </div>
      </main>

      {/* Footer */}
      <footer className="border-t py-6 px-4">
        <div className="max-w-4xl mx-auto text-center text-sm text-muted-foreground">
          © SlipSafe. All rights reserved. Made in South Africa.
        </div>
      </footer>
    </div>
  );
}
