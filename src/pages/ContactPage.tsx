import { Seo } from "@/components/Seo";
import { Link } from "react-router-dom";

export default function ContactPage() {
  return (
    <div className="max-w-3xl mx-auto px-4 py-8 text-foreground">
      <Seo
        title="Contact — Darpan Academy"
        description="দর্পণ একাডেমির সাথে যোগাযোগ করুন — সাপোর্ট, এনরোলমেন্ট ও সাধারণ জিজ্ঞাসার জন্য।"
        path="/contact"
      />

      <h1 className="text-3xl font-bold mb-2">Contact Us</h1>
      <p className="text-muted-foreground mb-6">
        কোর্স, এনরোলমেন্ট, পেমেন্ট বা টেকনিক্যাল সাপোর্ট সংক্রান্ত যেকোনো প্রশ্নের জন্য আমাদের
        সাথে যোগাযোগ করুন। আমরা সাধারণত ২৪ ঘণ্টার মধ্যে উত্তর দিই।
      </p>

      <div className="space-y-3 mb-8">
        <div className="rounded-xl border border-border bg-card px-4 py-3 flex flex-col gap-0.5">
          <span className="text-xs text-muted-foreground font-medium uppercase tracking-wide">Email</span>
          <a
            href="mailto:darpanaca@gmail.com"
            className="text-sm text-primary underline underline-offset-2"
          >
            darpanaca@gmail.com
          </a>
        </div>

        <div className="rounded-xl border border-border bg-card px-4 py-3 flex flex-col gap-0.5">
          <span className="text-xs text-muted-foreground font-medium uppercase tracking-wide">Phone / WhatsApp</span>
          <a
            href="tel:+8801793370879"
            className="text-sm text-primary underline underline-offset-2"
          >
            +880 1793-370879
          </a>
        </div>

        <div className="rounded-xl border border-border bg-card px-4 py-3 flex flex-col gap-0.5">
          <span className="text-xs text-muted-foreground font-medium uppercase tracking-wide">Facebook Page</span>
          <a
            href="https://www.facebook.com/Darpan.academy21"
            target="_blank"
            rel="noopener noreferrer"
            className="text-sm text-primary underline underline-offset-2"
          >
            facebook.com/Darpan.academy21
          </a>
        </div>

        <div className="rounded-xl border border-border bg-card px-4 py-3 flex flex-col gap-0.5">
          <span className="text-xs text-muted-foreground font-medium uppercase tracking-wide">Facebook Group</span>
          <a
            href="https://www.facebook.com/groups/761131864771296"
            target="_blank"
            rel="noopener noreferrer"
            className="text-sm text-primary underline underline-offset-2"
          >
            Darpan Academy Community Group
          </a>
        </div>

        <div className="rounded-xl border border-border bg-card px-4 py-3 flex flex-col gap-0.5">
          <span className="text-xs text-muted-foreground font-medium uppercase tracking-wide">YouTube</span>
          <a
            href="https://www.youtube.com/Darpanacademy21"
            target="_blank"
            rel="noopener noreferrer"
            className="text-sm text-primary underline underline-offset-2"
          >
            youtube.com/Darpanacademy21
          </a>
        </div>

        <div className="rounded-xl border border-border bg-card px-4 py-3 flex flex-col gap-0.5">
          <span className="text-xs text-muted-foreground font-medium uppercase tracking-wide">Location</span>
          <span className="text-sm text-muted-foreground">Bangladesh</span>
        </div>
      </div>

      <p className="text-sm text-muted-foreground">
        <Link to="/about" className="text-primary underline underline-offset-2">About Us</Link>
        {" · "}
        <Link to="/refund" className="text-primary underline underline-offset-2">Refund Policy</Link>
        {" · "}
        <Link to="/privacy" className="text-primary underline underline-offset-2">Privacy Policy</Link>
      </p>
    </div>
  );
}
