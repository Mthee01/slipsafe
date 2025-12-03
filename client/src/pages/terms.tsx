import { Link } from "wouter";
import { Button } from "@/components/ui/button";
import { ArrowLeft } from "lucide-react";
import logo from "@assets/SlipSafe Logo_1762888976121.png";

export default function Terms() {
  return (
    <div className="min-h-screen bg-background" data-testid="page-terms">
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
        <h1 className="text-3xl font-bold mb-8" data-testid="text-terms-title">Terms & Conditions</h1>
        
        <div className="prose prose-sm max-w-none space-y-6 text-muted-foreground">
          <p className="text-lg">
            Welcome to SlipSafe. By using our service, you agree to these terms.
          </p>

          <section className="space-y-4">
            <h2 className="text-xl font-semibold text-foreground">1. Acceptance of Terms</h2>
            <p>
              By accessing or using SlipSafe, you agree to be bound by these Terms & Conditions 
              and all applicable laws and regulations. If you do not agree with any of these terms, 
              you are prohibited from using or accessing this service.
            </p>
          </section>

          <section className="space-y-4">
            <h2 className="text-xl font-semibold text-foreground">2. Use of Service</h2>
            <p>
              SlipSafe provides a digital receipt management service that allows you to store, 
              organise, and manage your receipts. You are responsible for maintaining the 
              confidentiality of your account and password.
            </p>
          </section>

          <section className="space-y-4">
            <h2 className="text-xl font-semibold text-foreground">3. User Data</h2>
            <p>
              You retain ownership of all receipts and data you upload to SlipSafe. We process 
              your data only to provide the service and will not sell or share your personal 
              information with third parties without your consent.
            </p>
          </section>

          <section className="space-y-4">
            <h2 className="text-xl font-semibold text-foreground">4. Business Subscriptions</h2>
            <p>
              Business plans are billed monthly or annually as selected. You may cancel your 
              subscription at any time. Refunds are provided according to our refund policy.
            </p>
          </section>

          <section className="space-y-4">
            <h2 className="text-xl font-semibold text-foreground">5. Limitation of Liability</h2>
            <p>
              SlipSafe shall not be liable for any indirect, incidental, special, consequential, 
              or punitive damages resulting from your use of or inability to use the service.
            </p>
          </section>

          <section className="space-y-4">
            <h2 className="text-xl font-semibold text-foreground">6. Changes to Terms</h2>
            <p>
              We reserve the right to modify these terms at any time. We will notify users of 
              any material changes via email or through the service.
            </p>
          </section>

          <section className="space-y-4">
            <h2 className="text-xl font-semibold text-foreground">7. Contact</h2>
            <p>
              For questions about these Terms & Conditions, please contact us at{" "}
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
