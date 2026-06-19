import { Link } from "react-router-dom";
import { Seo } from "@/components/Seo";

export default function PrivacyPolicyPage() {
  return (
    <div className="max-w-3xl mx-auto px-4 py-8 text-foreground">
      <Seo
        title="Privacy Policy — Darpan Academy"
        description="Darpan Academy কীভাবে শিক্ষার্থীদের ব্যক্তিগত তথ্য সংগ্রহ, ব্যবহার ও সুরক্ষা করে — আমাদের গোপনীয়তা নীতি।"
        path="/privacy"
      />

      <h1 className="text-3xl font-bold mb-2">Privacy Policy</h1>
      <p className="text-sm text-muted-foreground mb-8">Last updated: June 17, 2026</p>

      <section className="space-y-6 text-muted-foreground">
        <p>
          Darpan Academy ("we", "us") respects your privacy. This policy explains what
          information we collect, how we use it, and your rights regarding your data.
        </p>

        <div>
          <h2 className="text-lg font-semibold text-foreground mb-1">1. Information We Collect</h2>
          <p>
            We collect your name, email address, phone number, institution, payment reference,
            and learning activity (course progress and exam submissions) when you register and
            use our platform.
          </p>
        </div>

        <div>
          <h2 className="text-lg font-semibold text-foreground mb-1">2. How We Use It</h2>
          <p>
            Your information is used to create and manage your account, verify course enrollment,
            deliver course content and exams, provide customer support, and improve our services.
            We do not use your data for advertising.
          </p>
        </div>

        <div>
          <h2 className="text-lg font-semibold text-foreground mb-1">3. Data Storage</h2>
          <p>
            Your data is stored securely on Google Firebase infrastructure. We do not sell,
            rent, or share your personal data with third parties.
          </p>
        </div>

        <div>
          <h2 className="text-lg font-semibold text-foreground mb-1">4. Cookies &amp; Local Storage</h2>
          <p>
            We use browser storage to keep you signed in and to cache data for a faster
            experience. No third-party tracking cookies are used.
          </p>
        </div>

        <div>
          <h2 className="text-lg font-semibold text-foreground mb-1">5. Your Rights</h2>
          <p>
            You may request access to, correction of, or deletion of your personal data at
            any time by contacting our support team. We will respond within 7 working days.
          </p>
        </div>

        <div>
          <h2 className="text-lg font-semibold text-foreground mb-1">6. Contact</h2>
          <p>
            For privacy-related questions, email us at{" "}
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
        <Link to="/terms" className="text-primary underline underline-offset-2">Terms of Service</Link>
        {" · "}
        <Link to="/refund" className="text-primary underline underline-offset-2">Refund Policy</Link>
        {" · "}
        <Link to="/contact" className="text-primary underline underline-offset-2">Contact</Link>
      </div>
    </div>
  );
}
