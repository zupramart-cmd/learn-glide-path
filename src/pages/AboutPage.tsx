import { Link } from "react-router-dom";
import { Seo } from "@/components/Seo";

export default function AboutPage() {
  return (
    <div className="max-w-3xl mx-auto px-4 py-8 text-foreground">
      <Seo
        title="About Darpan Academy — দর্পণ একাডেমি সম্পর্কে"
        description="Darpan Academy - দর্পণ একাডেমি একটি EdTech প্ল্যাটফর্ম। যেখানে অল্প সময়ে Zero থেকে গুছিয়ে প্রস্তুতি নেওয়ার জন্য OneShot ব্যাচ; এছাড়াও রয়েছে Tesla ব্যাচ, Admission ব্যাচ। HSC ও এডমিশনের জন্য কম সময়ে সেরা প্রস্তুতি।"
        path="/about"
      />

      <h1 className="text-3xl font-bold mb-4">About Darpan Academy</h1>

      <p className="mb-4 text-muted-foreground">
        Darpan Academy - দর্পণ একাডেমি একটি EdTech প্ল্যাটফর্ম। যেখানে অল্প সময়ে Zero থেকে গুছিয়ে প্রস্তুতি নেওয়ার জন্য OneShot ব্যাচ; এছাড়াও রয়েছে Tesla ব্যাচ, Admission ব্যাচ। HSC ও এডমিশনের জন্য কম সময়ে সেরা প্রস্তুতি।
      </p>

      <p className="mb-6 text-muted-foreground">
        Darpan Academy - Darpan Academy is an EdTech platform. Where OneShot batch is available to prepare from Zero in a short time; There is also Tesla batch, Admission batch. Best preparation for HSC and Admission in a short time.
      </p>

      <h2 className="text-xl font-semibold mt-6 mb-2">Our Mission</h2>
      <p className="text-muted-foreground mb-6">
        মানসম্মত শিক্ষাকে সকল শিক্ষার্থীর কাছে সহজলভ্য করা — সাশ্রয়ী মূল্যে, যেকোনো জায়গা থেকে।
        অল্প সময়ে Zero থেকে গুছিয়ে প্রস্তুতি নেওয়ার জন্য আমাদের OneShot ব্যাচ, Tesla ব্যাচ
        এবং Admission ব্যাচ রয়েছে — HSC ও এডমিশনের জন্য কম সময়ে সেরা প্রস্তুতি।
      </p>

      <h2 className="text-xl font-semibold mt-6 mb-3">Our Batches</h2>
      <div className="space-y-2 mb-6">
        {[
          { name: "OneShot Batch", desc: "Zero থেকে গুছিয়ে প্রস্তুতি — অল্প সময়ে সম্পূর্ণ সিলেবাস কভার।" },
          { name: "Tesla Batch", desc: "গভীর মনোযোগ ও নিয়মিত পরীক্ষার মাধ্যমে শক্তিশালী প্রস্তুতি।" },
          { name: "Admission Batch", desc: "বিশ্ববিদ্যালয় ভর্তি পরীক্ষার জন্য বিশেষভাবে তৈরি ব্যাচ।" },
        ].map((batch) => (
          <div key={batch.name} className="rounded-xl border border-border bg-card px-4 py-3">
            <p className="font-medium text-sm">{batch.name}</p>
            <p className="text-xs text-muted-foreground mt-0.5">{batch.desc}</p>
          </div>
        ))}
      </div>

      <h2 className="text-xl font-semibold mt-6 mb-3">Team</h2>
      <div className="space-y-3 mb-6">
        <div className="rounded-xl border border-border bg-card px-4 py-3">
          <p className="font-medium text-sm">Md Ashikuzzaman</p>
          <p className="text-xs text-muted-foreground mt-0.5">Founder &amp; Director — Darpan Academy</p>
          <div className="flex flex-wrap gap-2 mt-2">
            <a
              href="https://www.facebook.com/Darpan.academy21"
              target="_blank"
              rel="noopener noreferrer"
              className="text-xs text-primary underline underline-offset-2"
            >
              Facebook
            </a>
            <span className="text-xs text-muted-foreground">·</span>
            <a
              href="https://www.youtube.com/Darpanacademy21"
              target="_blank"
              rel="noopener noreferrer"
              className="text-xs text-primary underline underline-offset-2"
            >
              YouTube
            </a>
            <span className="text-xs text-muted-foreground">·</span>
            <a
              href="https://www.facebook.com/groups/761131864771296"
              target="_blank"
              rel="noopener noreferrer"
              className="text-xs text-primary underline underline-offset-2"
            >
              Facebook Group
            </a>
          </div>
        </div>
        <div className="rounded-xl border border-border bg-card px-4 py-3">
          <p className="font-medium text-sm">
            Md Ridoan Mahmud Zisan &nbsp;·&nbsp;{" "}
            <a
              href="/developer.html"
              target="_blank"
              rel="noopener noreferrer"
              className="text-primary underline underline-offset-2"
            >
              OnonnoBit
            </a>
          </p>
          <p className="text-xs text-muted-foreground mt-0.5">Web Application Developer</p>
          <div className="flex flex-wrap gap-2 mt-2">
            <a
              href="https://ridoan-zisan.netlify.app"
              target="_blank"
              rel="noopener noreferrer"
              className="text-xs text-primary underline underline-offset-2"
            >
              Portfolio
            </a>
            <span className="text-xs text-muted-foreground">·</span>
            <a
              href="https://linkedin.com/in/ridoan-zisan"
              target="_blank"
              rel="noopener noreferrer"
              className="text-xs text-primary underline underline-offset-2"
            >
              LinkedIn
            </a>
            <span className="text-xs text-muted-foreground">·</span>
            <a
              href="https://github.com/RidoanDev"
              target="_blank"
              rel="noopener noreferrer"
              className="text-xs text-primary underline underline-offset-2"
            >
              GitHub
            </a>
            <span className="text-xs text-muted-foreground">·</span>
            <a
              href="https://facebook.com/ridoan.zisan"
              target="_blank"
              rel="noopener noreferrer"
              className="text-xs text-primary underline underline-offset-2"
            >
              Facebook
            </a>
          </div>
        </div>
      </div>

      <p className="text-sm text-muted-foreground">
        <Link to="/courses" className="text-primary underline underline-offset-2">Browse Courses</Link>
        {" · "}
        <Link to="/contact" className="text-primary underline underline-offset-2">Contact Us</Link>
        {" · "}
        <Link to="/terms" className="text-primary underline underline-offset-2">Terms</Link>
        {" · "}
        <Link to="/privacy" className="text-primary underline underline-offset-2">Privacy</Link>
      </p>
    </div>
  );
}
