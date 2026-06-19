import { Link } from "react-router-dom";
import { Seo } from "@/components/Seo";

export default function TermsPage() {
  return (
    <div className="max-w-3xl mx-auto px-4 py-8 text-foreground">
      <Seo
        title="Terms of Service — Darpan Academy"
        description="Darpan Academy ব্যবহারের নিয়ম ও শর্তাবলী — অ্যাকাউন্ট, এনরোলমেন্ট, কন্টেন্ট ও আচরণবিধি।"
        path="/terms"
      />

      <h1 className="text-3xl font-bold mb-2">Terms of Service</h1>
      <p className="text-sm text-muted-foreground mb-8">Last updated: June 17, 2026</p>

      <section className="space-y-6 text-muted-foreground">

        <div>
          <h2 className="text-lg font-semibold text-foreground mb-1">1. Acceptance</h2>
          <p>
            By creating an account or using Darpan Academy in any way, you agree to be bound
            by these Terms of Service. If you do not agree, please do not use the platform.
          </p>
        </div>

        <div>
          <h2 className="text-lg font-semibold text-foreground mb-1">2. Account Responsibility</h2>
          <p>
            You are solely responsible for maintaining the security of your account credentials.
            Do not share your login with others. A single account may only be active on a limited
            number of devices at a time.
          </p>
        </div>

        <div>
          <h2 className="text-lg font-semibold text-foreground mb-1">3. Enrollment &amp; Payment</h2>
          <p>
            Access to paid courses is granted only after admin approval of your payment.
            All prices are displayed in BDT (Bangladeshi Taka). Darpan Academy reserves the
            right to update course pricing at any time.
          </p>
        </div>

        <div>
          <h2 className="text-lg font-semibold text-foreground mb-1">4. Content Usage</h2>
          <p>
            All videos, notes, exam questions, and other materials are the intellectual property
            of Darpan Academy and its instructors. Downloading, screen-recording, redistributing,
            or sharing course content in any form is strictly prohibited and may result in
            immediate account termination without refund.
          </p>
        </div>

        <div>
          <h2 className="text-lg font-semibold text-foreground mb-1">5. Acceptable Use</h2>
          <p>
            Cheating on exams, impersonating other users, abusing support staff, or attempting
            to bypass platform security measures will result in immediate account termination
            without refund.
          </p>
        </div>

        <div>
          <h2 className="text-lg font-semibold text-foreground mb-1">6. Changes to Terms</h2>
          <p>
            We may update these Terms at any time. Continued use of Darpan Academy after
            changes are posted constitutes your acceptance of the revised Terms.
          </p>
        </div>

        <div>
          <h2 className="text-lg font-semibold text-foreground mb-1">7. Contact</h2>
          <p>
            For questions about these Terms, email{" "}
            <a
              href="mailto:darpanaca@gmail.com"
              className="text-primary underline underline-offset-2"
            >
              darpanaca@gmail.com
            </a>
            .
          </p>
        </div>

      </section>

      <div className="mt-8 pt-6 border-t border-border text-sm text-muted-foreground">
        <Link to="/privacy" className="text-primary underline underline-offset-2">Privacy Policy</Link>
        {" · "}
        <Link to="/refund" className="text-primary underline underline-offset-2">Refund Policy</Link>
        {" · "}
        <Link to="/contact" className="text-primary underline underline-offset-2">Contact</Link>
      </div>
    </div>
  );
}
