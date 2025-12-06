import { useState, useEffect } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { ScrollArea } from "@/components/ui/scroll-area";
import { FileText } from "lucide-react";

interface TermsModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onAccept: () => void;
  isLoading?: boolean;
}

export function TermsModal({ open, onOpenChange, onAccept, isLoading }: TermsModalProps) {
  const [accepted, setAccepted] = useState(false);

  // Reset checkbox state whenever modal opens
  useEffect(() => {
    if (open) {
      setAccepted(false);
    }
  }, [open]);

  const handleAccept = () => {
    if (accepted) {
      onAccept();
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] flex flex-col" data-testid="modal-terms">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2" data-testid="text-terms-modal-title">
            <FileText className="h-5 w-5" />
            Terms & Conditions
          </DialogTitle>
          <DialogDescription>
            Please read and accept our terms to continue with registration
          </DialogDescription>
        </DialogHeader>

        <ScrollArea className="flex-1 max-h-[50vh] pr-4" data-testid="scroll-terms-content">
          <div className="prose prose-sm max-w-none space-y-4 text-muted-foreground">
            <p className="text-base">
              Welcome to SlipSafe. By using our service, you agree to these terms.
            </p>

            <section className="space-y-2">
              <h3 className="text-base font-semibold text-foreground">1. Acceptance of Terms</h3>
              <p className="text-sm">
                By accessing or using SlipSafe, you agree to be bound by these Terms & Conditions 
                and all applicable laws and regulations. If you do not agree with any of these terms, 
                you are prohibited from using or accessing this service.
              </p>
            </section>

            <section className="space-y-2">
              <h3 className="text-base font-semibold text-foreground">2. Use of Service</h3>
              <p className="text-sm">
                SlipSafe provides a digital receipt management service that allows you to store, 
                organise, and manage your receipts. You are responsible for maintaining the 
                confidentiality of your account and password.
              </p>
            </section>

            <section className="space-y-2">
              <h3 className="text-base font-semibold text-foreground">3. User Data</h3>
              <p className="text-sm">
                You retain ownership of all receipts and data you upload to SlipSafe. We process 
                your data only to provide the service and will not sell or share your personal 
                information with third parties without your consent.
              </p>
            </section>

            <section className="space-y-2">
              <h3 className="text-base font-semibold text-foreground">4. Business Subscriptions</h3>
              <p className="text-sm">
                Business plans are billed monthly or annually as selected. You may cancel your 
                subscription at any time. Refunds are provided according to our refund policy.
              </p>
            </section>

            <section className="space-y-2">
              <h3 className="text-base font-semibold text-foreground">5. Limitation of Liability</h3>
              <p className="text-sm">
                SlipSafe shall not be liable for any indirect, incidental, special, consequential, 
                or punitive damages resulting from your use of or inability to use the service.
              </p>
            </section>

            <section className="space-y-2">
              <h3 className="text-base font-semibold text-foreground">6. Changes to Terms</h3>
              <p className="text-sm">
                We reserve the right to modify these terms at any time. We will notify users of 
                any material changes via email or through the service.
              </p>
            </section>

            <section className="space-y-2">
              <h3 className="text-base font-semibold text-foreground">7. Contact</h3>
              <p className="text-sm">
                For questions about these Terms & Conditions, please contact us at{" "}
                <a href="mailto:sales@slip-safe.net" className="text-primary hover:underline">
                  sales@slip-safe.net
                </a>
              </p>
            </section>

            <p className="text-xs pt-4 border-t">
              Last updated: December 2024
            </p>
          </div>
        </ScrollArea>

        <div className="flex items-start gap-3 pt-4 border-t">
          <Checkbox
            id="accept-terms"
            checked={accepted}
            onCheckedChange={(checked) => setAccepted(checked === true)}
            data-testid="checkbox-accept-terms"
          />
          <label
            htmlFor="accept-terms"
            className="text-sm leading-relaxed cursor-pointer"
          >
            I have read and agree to the SlipSafe Terms & Conditions
          </label>
        </div>

        <DialogFooter className="gap-2 sm:gap-0">
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={isLoading}
            data-testid="button-cancel-terms"
          >
            Cancel
          </Button>
          <Button
            onClick={handleAccept}
            disabled={!accepted || isLoading}
            data-testid="button-agree-continue"
          >
            {isLoading ? "Creating Account..." : "Agree & Continue"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
