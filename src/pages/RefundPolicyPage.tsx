import { Link } from "react-router-dom";
import { Seo } from "@/components/Seo";

export default function RefundPolicyPage() {
  return (
    <div className="max-w-3xl mx-auto px-4 py-8 text-foreground">
      <Seo
        title="Refund Policy — Darpan Academy"
        description="Darpan Academy এর কোর্স পেমেন্ট রিফান্ড সংক্রান্ত নীতিমালা।"
        path="/refund"
      />

      <h1 className="text-3xl font-bold mb-2">Refund Policy</h1>
      <p className="text-sm text-muted-foreground mb-8">Last updated: June 17, 2026</p>

      <section className="space-y-6 text-muted-foreground">
        <p>
          Due to the digital nature of our courses, all payments are generally non-refundable
          once content access has been granted. Please read the course details carefully before
          making a payment.
        </p>

        <div>
          <h2 className="text-lg font-semibold text-foreground mb-2">Eligible Cases for Refund</h2>
          <ul className="space-y-2 pl-1">
            {[
              "Duplicate payment made for the same course.",
              "Payment received but enrollment not approved by admin within 7 days.",
              "Course cancelled or discontinued by Darpan Academy.",
            ].map((item, i) => (
              <li key={i} className="flex items-start gap-2">
                <span className="mt-1 h-1.5 w-1.5 rounded-full bg-muted-foreground/50 shrink-0" />
                {item}
              </li>
            ))}
          </ul>
        </div>

        <div>
          <h2 className="text-lg font-semibold text-foreground mb-1">How to Request a Refund</h2>
          <p>
            Email{" "}
            <a
              href="mailto:darpanaca@gmail.com"
              className="text-primary underline underline-offset-2"
            >
              darpanaca@gmail.com
            </a>{" "}
            with your transaction ID and reason within <strong className="text-foreground">7 days</strong> of
            payment. Approved refunds are processed within <strong className="text-foreground">14 working days</strong>.
          </p>
        </div>

        <div>
          <h2 className="text-lg font-semibold text-foreground mb-1">Non-Refundable Cases</h2>
          <p>
            Refunds will not be issued for change of mind, lack of time, or dissatisfaction with
            content after access has been used.
          </p>
        </div>
      </section>

      <div className="mt-8 pt-6 border-t border-border text-sm text-muted-foreground">
        <Link to="/terms" className="text-primary underline underline-offset-2">Terms of Service</Link>
        {" · "}
        <Link to="/privacy" className="text-primary underline underline-offset-2">Privacy Policy</Link>
        {" · "}
        <Link to="/contact" className="text-primary underline underline-offset-2">Contact</Link>
      </div>
    </div>
  );
}
