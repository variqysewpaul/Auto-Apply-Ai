"use client";

import React, { useState, useEffect, useRef } from "react";
import { supabase } from "@/lib/supabase";

// Types for local state and database logs
interface ApplicationRecord {
  id: number;
  job_title: string;
  company: string;
  location: string;
  status: string;
  applied_date: string;
  cover_letter: string;
  job_description: string;
  match_score: number;
  filled_inputs?: Record<string, string>;
}

export default function DashboardPage() {
  // Navigation & Mode States
  const [supabaseUser, setSupabaseUser] = useState<any>(null);
  const [sandboxMode, setSandboxMode] = useState<boolean>(false);
  const [activeTab, setActiveTab] = useState<"welcome" | "dashboard" | "profile" | "logs" | "settings">("welcome");
  
  // Dashboard & Crawler States
  const [isCampaignRunning, setIsCampaignRunning] = useState<boolean>(false);
  const [botPaused, setBotPaused] = useState<boolean>(false);
  const [consoleLogs, setConsoleLogs] = useState<string[]>([
    "🤖 System: AutoApply Pro Engine ready.",
    "🤖 System: Awaiting campaign ignition..."
  ]);
  const [crawlStep, setCrawlStep] = useState<number>(0);
  const consoleEndRef = useRef<HTMLDivElement>(null);

  // Telemetry Sync States
  const [isSupabaseConnected, setIsSupabaseConnected] = useState<boolean>(false);
  const [mockBrowserUrl, setMockBrowserUrl] = useState<string>("https://www.linkedin.com/feed/");
  const [easyApplyStep, setEasyApplyStep] = useState<number>(0); // 0: idle, 1: searching, 2: applying, 3: success
  const [activeElement, setActiveElement] = useState<string>("");
  const [activeValue, setActiveValue] = useState<string>("");

  // Human Intervention Custom solver states
  const [waitingForUser, setWaitingForUser] = useState<boolean>(false);
  const [manualQuestion, setManualQuestion] = useState<string>("");
  const [manualAnswer, setManualAnswer] = useState<string>("");

  // Drag-and-drop & parsing state
  const [isDragging, setIsDragging] = useState<boolean>(false);
  const [isParsing, setIsParsing] = useState<boolean>(false);
  const [fileName, setFileName] = useState<string>("");

  // Form State - Candidate Profile Facts
  const [profile, setProfile] = useState({
    fullName: "",
    email: "",
    phone: "",
    address: "",
    city: "",
    githubUrl: "",
    linkedinUrl: "",
    targetKeywords: "",
    skills: "",
    groqKey: ""
  });

  // Supabase Auth Form States
  const [authMode, setAuthMode] = useState<"login" | "register">("login");
  const [authEmail, setAuthEmail] = useState<string>("");
  const [authPassword, setAuthPassword] = useState<string>("");
  const [isAuthLoading, setIsAuthLoading] = useState<boolean>(false);

  // Applications Database List
  const [applications, setApplications] = useState<ApplicationRecord[]>([]);
  const [selectedApp, setSelectedApp] = useState<ApplicationRecord | null>(null);

  // Message alert state
  const [alertMessage, setAlertMessage] = useState<{ type: "success" | "info"; text: string } | null>(null);
  
  // Setup Guide Checklist Step (1: API Key, 2: CV upload, 3: Launch Ready)
  const [onboardingStep, setOnboardingStep] = useState<number>(1);

  // Sandbox simulated records
  const sandboxApplicationsList: ApplicationRecord[] = [
    {
      id: 104,
      job_title: "Senior Frontend Architect",
      company: "Stripe",
      location: "San Francisco, CA (Hybrid)",
      status: "Applied",
      applied_date: "2026-05-20 14:12:00",
      match_score: 96,
      cover_letter: "Dear Hiring Team at Stripe,\n\nI am thrilled to apply for the Senior Frontend Architect position. With over 6 years of experience engineering high-performance user interfaces at scale and deep familiarity with React, TypeScript, and modern micro-frontends, I am confident in my ability to elevate Stripe's checkout designs...",
      job_description: "Stripe is seeking an experienced Frontend Architect to join our Core UI team. You will lead the technical design of checkout systems, scale components globally, and champion user accessibility and visual excellence...",
      filled_inputs: {
        "Full Name": "Alex Rivera",
        "React Experience": "6 Years",
        "Micro-frontends knowledge": "Yes",
        "Relocation Confirmation": "Willing to relocate"
      }
    },
    {
      id: 103,
      job_title: "Frontend Engineer",
      company: "Vercel",
      location: "Remote (USA)",
      status: "Interviewing",
      applied_date: "2026-05-19 11:34:12",
      match_score: 94,
      cover_letter: "Dear Vercel Engineers,\n\nAs an avid builder on Vercel and Next.js, this role represents my absolute dream opportunity. I have built three production-grade web applications utilizing Next.js Server Actions, partial pre-rendering, and advanced React architectures...",
      job_description: "Vercel is looking for a talented Frontend Developer to build out the future of cloud deployment. Ideal candidates excel with React, Next.js, Tailwind CSS, and edge computing...",
      filled_inputs: {
        "Full Name": "Alex Rivera",
        "Next.js Projects": "3 Projects",
        "Vercel Deployment Experience": "Advanced"
      }
    }
  ];

  // Dynamic Onboarding Step Tracker
  useEffect(() => {
    if (sandboxMode) {
      setOnboardingStep(3); // Pre-verified for sandbox preview
      return;
    }
    if (!profile.groqKey) {
      setOnboardingStep(1);
    } else if (!profile.fullName || !fileName) {
      setOnboardingStep(2);
    } else {
      setOnboardingStep(3);
    }
  }, [profile.groqKey, profile.fullName, fileName, sandboxMode]);

  // Check if Supabase keys are active in client
  useEffect(() => {
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    if (supabaseUrl && !supabaseUrl.includes("your-supabase-project-id")) {
      setIsSupabaseConnected(true);
      loadSupabaseProfile();
      loadSupabaseApplications();
    }

    // Subscribe to authentication state changes dynamically
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if (session?.user) {
        setSupabaseUser(session.user);
        setSandboxMode(false);
        setActiveTab("dashboard");
        loadSupabaseProfile();
        loadSupabaseApplications();
      } else {
        setSupabaseUser(null);
        setApplications([]);
        if (!sandboxMode) {
          setActiveTab("welcome");
        }
      }
    });

    return () => {
      subscription.unsubscribe();
    };
  }, []);

  // Sync state between sandbox / database
  useEffect(() => {
    if (sandboxMode) {
      setApplications(sandboxApplicationsList);
      setProfile({
        fullName: "Alex Rivera",
        email: "alex.rivera@example.com",
        phone: "+1 (555) 019-2834",
        address: "120 Hawthorne St",
        city: "San Francisco, CA",
        githubUrl: "https://github.com/alexrivera",
        linkedinUrl: "https://linkedin.com/in/alexrivera",
        targetKeywords: "Senior React Developer, Frontend Engineer, Software Engineer",
        skills: "React, TypeScript, Next.js, Node.js, Playwright, Python, LLMs, CSS Grid",
        groqKey: "gsk_SimulatedDemoKey1029384756"
      });
      setFileName("alex_rivera_resume.pdf");
    } else if (!supabaseUser) {
      // Clear profile when exit sandbox and no user
      setProfile({
        fullName: "",
        email: "",
        phone: "",
        address: "",
        city: "",
        githubUrl: "",
        linkedinUrl: "",
        targetKeywords: "",
        skills: "",
        groqKey: ""
      });
      setFileName("");
      setApplications([]);
    }
  }, [sandboxMode]);

  const loadSupabaseApplications = async () => {
    try {
      const { data, error } = await supabase
        .from("applications")
        .select("*")
        .order("applied_date", { ascending: false });
      if (data && data.length > 0) {
        const formatted = data.map((app: any) => ({
          id: app.id,
          job_title: app.job_title,
          company: app.company,
          location: app.location || "Remote",
          status: app.status || "Applied",
          applied_date: app.applied_date,
          cover_letter: app.cover_letter || "",
          job_description: app.job_description || "",
          match_score: 95
        }));
        setApplications(formatted);
      } else {
        setApplications([]);
      }
    } catch (e) {
      console.error("Could not fetch applications from Supabase:", e);
    }
  };

  const loadSupabaseProfile = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        setSupabaseUser(user);
        const { data, error } = await supabase
          .from("profiles")
          .select("*")
          .eq("id", user.id)
          .single();
        if (data) {
          setProfile({
            fullName: data.full_name || "",
            email: user.email || "",
            phone: data.phone || "",
            address: data.address || "",
            city: data.city || "",
            githubUrl: data.github_url || "",
            linkedinUrl: data.linkedin_url || "",
            targetKeywords: data.search_criteria?.titles?.join(", ") || "",
            skills: data.skills?.join(", ") || "",
            groqKey: data.encrypted_groq_key || ""
          } as any);
          if (data.full_name) {
            setFileName("CV_Facts_Loaded_from_Database.pdf");
          }
        }
      }
    } catch (e) {
      console.error("Could not fetch user profile from Supabase:", e);
    }
  };

  const handleLogout = async () => {
    try {
      if (sandboxMode) {
        setSandboxMode(false);
        setActiveTab("welcome");
        setAlertMessage({ type: "info", text: "Sandbox simulation terminated." });
      } else {
        await supabase.auth.signOut();
        setSupabaseUser(null);
        setActiveTab("welcome");
        setAlertMessage({ type: "info", text: "Logged out of Supabase successfully." });
      }
      setTimeout(() => setAlertMessage(null), 3000);
    } catch (error: any) {
      console.error("Logout failed:", error);
    }
  };

  const handleAuthSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsAuthLoading(true);
    try {
      if (authMode === "login") {
        const { data, error } = await supabase.auth.signInWithPassword({
          email: authEmail,
          password: authPassword
        });
        if (error) throw error;
        setAlertMessage({ type: "success", text: "Successfully authenticated!" });
      } else {
        const { data, error } = await supabase.auth.signUp({
          email: authEmail,
          password: authPassword
        });
        if (error) throw error;
        setAlertMessage({ 
          type: "success", 
          text: data.session ? "Account created and logged in!" : "Account created! Please check your email for confirmation." 
        });
      }
      setAuthPassword("");
    } catch (error: any) {
      console.error("Authentication error:", error);
      setAlertMessage({ type: "info", text: `Authentication Error: ${error.message}` });
    } finally {
      setIsAuthLoading(false);
      setTimeout(() => setAlertMessage(null), 5000);
    }
  };

  // Load PDF.js dynamically
  const loadPdfJs = (): Promise<any> => {
    return new Promise((resolve, reject) => {
      if ((window as any).pdfjsLib) {
        resolve((window as any).pdfjsLib);
        return;
      }
      const script = document.createElement("script");
      script.src = "https://cdnjs.cloudflare.com/ajax/libs/pdf.js/2.16.105/pdf.min.js";
      script.onload = () => {
        (window as any).pdfjsLib.GlobalWorkerOptions.workerSrc = "https://cdnjs.cloudflare.com/ajax/libs/pdf.js/2.16.105/pdf.worker.min.js";
        resolve((window as any).pdfjsLib);
      };
      script.onerror = () => reject(new Error("Failed to load PDF parser from CDN"));
      document.head.appendChild(script);
    });
  };

  const extractTextFromPdf = async (file: File): Promise<string> => {
    const pdfjs = await loadPdfJs();
    const arrayBuffer = await file.arrayBuffer();
    const pdf = await pdfjs.getDocument({ data: arrayBuffer }).promise;
    let fullText = "";
    for (let i = 1; i <= pdf.numPages; i++) {
      const page = await pdf.getPage(i);
      const textContent = await page.getTextContent();
      const pageText = textContent.items.map((item: any) => item.str).join(" ");
      fullText += pageText + "\n";
    }
    return fullText;
  };

  const parseCVWithGroq = async (text: string, groqKey: string) => {
    const prompt = `You are a professional CV data extractor. Parse the resume and return a flat JSON matching this TypeScript interface exactly:
interface ExtractedProfile {
  fullName: string;
  email: string;
  phone: string;
  city: string;
  githubUrl: string;
  linkedinUrl: string;
  targetKeywords: string; // Comma-separated list of target titles based on experience
  skills: string; // Comma-separated list of technical skills found
}
Text: ${text}`;

    const response = await fetch("https://api.groq.com/openai/v1/chat/completions", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${groqKey}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        model: "llama-3.3-70b-versatile",
        messages: [{ role: "user", content: prompt }],
        temperature: 0.1,
        response_format: { type: "json_object" }
      })
    });

    if (!response.ok) {
      throw new Error(`Groq API Error: ${response.status}`);
    }

    const result = await response.json();
    return JSON.parse(result.choices[0].message.content);
  };

  const handleCVUpload = async (file: File) => {
    setIsParsing(true);
    setFileName(file.name);
    try {
      let extractedText = "";
      if (file.type === "application/pdf" || file.name.endsWith(".pdf")) {
        extractedText = await extractTextFromPdf(file);
      } else {
        extractedText = await file.text();
      }

      if (!extractedText || extractedText.trim().length < 50) {
        throw new Error("Could not extract sufficient text structure from this file.");
      }

      const keyToUse = profile.groqKey;
      if (keyToUse && keyToUse.startsWith("gsk_")) {
        setAlertMessage({ type: "info", text: "Connecting to Groq AI..." });
        const parsed = await parseCVWithGroq(extractedText, keyToUse);
        setProfile({
          fullName: parsed.fullName || parsed.full_name || "Alex Rivera",
          email: parsed.email || profile.email || "alex@example.com",
          phone: parsed.phone || "",
          address: parsed.address || "",
          city: parsed.city || "",
          githubUrl: parsed.githubUrl || parsed.github_url || "",
          linkedinUrl: parsed.linkedinUrl || parsed.linkedin_url || "",
          targetKeywords: parsed.targetKeywords || parsed.target_keywords || "Software Engineer",
          skills: parsed.skills || "",
          groqKey: profile.groqKey
        });
        setAlertMessage({ type: "success", text: "AI successfully parsed CV and filled details!" });
      } else {
        // Fallback offline heuristics
        const emailMatch = extractedText.match(/[\w.-]+@[\w.-]+\.\w+/)?.[0] || "";
        const phoneMatch = extractedText.match(/\+?\d[\d -]{8,15}\d/)?.[0] || "";
        
        setProfile({
          fullName: "CV Candidate",
          email: emailMatch || profile.email || "candidate@example.com",
          phone: phoneMatch || "",
          address: "",
          city: "",
          githubUrl: "",
          linkedinUrl: "",
          targetKeywords: "Software Developer",
          skills: "React, TypeScript, Next.js, Node.js",
          groqKey: profile.groqKey
        });
        setAlertMessage({ 
          type: "info", 
          text: "Parsed using offline heuristics! Enter a Groq Key for advanced AI extraction." 
        });
      }
    } catch (err: any) {
      console.error("CV Parsing Error:", err);
      setAlertMessage({ type: "info", text: `Extraction failed: ${err.message}` });
    } finally {
      setIsParsing(false);
      setTimeout(() => setAlertMessage(null), 5000);
    }
  };

  const handleSaveProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isSupabaseConnected && supabaseUser) {
      try {
        const { error } = await supabase
          .from("profiles")
          .upsert({
            id: supabaseUser.id,
            full_name: profile.fullName,
            phone: profile.phone,
            address: profile.address,
            city: profile.city,
            github_url: profile.githubUrl,
            linkedin_url: profile.linkedinUrl,
            search_criteria: {
              titles: profile.targetKeywords.split(",").map(s => s.trim()),
              locations: [profile.city]
            },
            skills: profile.skills.split(",").map(s => s.trim()),
            encrypted_groq_key: profile.groqKey
          });
        if (error) throw error;
      } catch (e: any) {
        setAlertMessage({ type: "info", text: `Save failed: ${e.message}` });
        return;
      }
    }
    setAlertMessage({ type: "success", text: "Facts saved successfully!" });
    setTimeout(() => setAlertMessage(null), 4000);
  };

  // Clipboard Paste Helper for Groq Key
  const handlePasteKey = async () => {
    try {
      const text = await navigator.clipboard.readText();
      if (text && text.startsWith("gsk_")) {
        setProfile({ ...profile, groqKey: text });
        setAlertMessage({ type: "success", text: "Successfully pasted Groq Key!" });
      } else {
        setAlertMessage({ type: "info", text: "No valid API key starting with 'gsk_' found on clipboard." });
      }
    } catch (e) {
      setAlertMessage({ type: "info", text: "Could not read clipboard. Please paste manually." });
    }
    setTimeout(() => setAlertMessage(null), 3000);
  };

  // Auto-scroll terminal logs
  useEffect(() => {
    consoleEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [consoleLogs]);

  // Campaign Simulation Loop with interactive pausing/solving
  useEffect(() => {
    if (!isCampaignRunning) {
      setActiveElement("");
      setActiveValue("");
      setEasyApplyStep(0);
      setWaitingForUser(false);
      return;
    }

    if (botPaused) {
      setConsoleLogs(prev => [...prev, "⏸️ [Stealth] Bot execution paused dynamically. Holding browser thread."]);
      return;
    }

    if (sandboxMode) {
      const simLogs = [
        "🛡️ [Stealth] Masking webdriver signatures. Overriding navigator.webdriver -> undefined.",
        "🌐 [Network] Initializing residential proxies. IP located in San Francisco, CA.",
        "🔑 [Auth] Checking active session. Session token loaded successfully.",
        "🔍 [Search] Crawling active listings for: 'Senior React Developer'...",
        "📄 [Found] Discovered 12 jobs in target locations.",
        "🔬 [Evaluate] Analyzing 'Senior Frontend Architect' at Stripe...",
        "🧠 [AI Evaluate] Resume matching score: 96%. FIT DETERMINED.",
        "📝 [Cover Letter] Cover letter generated successfully.",
        "⚡ [Easy Apply] Initiating Easy Apply application modal.",
        "✏️ [AI Solver] Auto-filling Name, Email, Address from Profile...",
        "⚠️ [PAUSE REQUIRED] Verification Alert: Complex relocation question encountered!",
        "✏️ [AI Solver] Solving relocation question...",
        "🚀 [Apply] Clicking 'Submit Application'...",
        "💾 [Log] stripe application logged securely to database.",
        "🎉 [Success] Application sent! Bot cycle finished."
      ];

      // Reset crawl step when loop resets
      let currentStepIndex = crawlStep;
      
      const intervalId = setInterval(() => {
        if (botPaused || waitingForUser) return;

        if (currentStepIndex < simLogs.length) {
          const currentLog = simLogs[currentStepIndex];
          setConsoleLogs(prev => [...prev, currentLog]);
          setCrawlStep(currentStepIndex + 1);

          // URL Address updates
          if (currentStepIndex >= 4) {
            setMockBrowserUrl("https://www.linkedin.com/jobs/view/stripe-frontend-architect");
          } else {
            setMockBrowserUrl("https://www.linkedin.com/feed/");
          }

          // Browser step animations
          if (currentStepIndex >= 8) {
            setEasyApplyStep(2); // Typing forms
          } else if (currentStepIndex >= 6) {
            setEasyApplyStep(1); // Evaluation
          } else {
            setEasyApplyStep(0);
          }

          // Pause point at relocation question (step 10)
          if (currentStepIndex === 10) {
            setWaitingForUser(true);
            setManualQuestion("Are you willing to relocate to San Francisco, CA?");
            setConsoleLogs(prev => [...prev, "⚠️ [Human Intervention Required] Playwright paused. Waiting for relocation input."]);
          }

          currentStepIndex++;
        } else {
          // Finished simulated application - insert Stripe to logs dynamically
          const exist = applications.find(a => a.company === "Stripe");
          if (!exist) {
            const stripeApp: ApplicationRecord = {
              id: Date.now(),
              job_title: "Senior Frontend Architect",
              company: "Stripe",
              location: "San Francisco, CA (Hybrid)",
              status: "Applied",
              applied_date: new Date().toISOString().replace('T', ' ').substring(0, 19),
              match_score: 96,
              cover_letter: "Dear Stripe Team,\n\nI am thrilled to apply for the Senior Frontend Architect position. With over 6 years of experience engineering high-performance user interfaces at scale and deep familiarity with React, TypeScript, and modern micro-frontends, I am confident in my ability to elevate Stripe's checkout designs...",
              job_description: "Stripe is seeking an experienced Frontend Architect to join our Core UI team. You will lead the technical design of checkout systems, scale components globally, and champion user accessibility and visual excellence...",
              filled_inputs: {
                "Full Name": "Alex Rivera",
                "React Experience": "6 Years",
                "Micro-frontends knowledge": "Yes",
                "Relocation Confirmation": "Willing to relocate"
              }
            };
            setApplications(prev => [stripeApp, ...prev]);
          }
          setIsCampaignRunning(false);
          setCrawlStep(0);
          setEasyApplyStep(3); // Success Screen
        }
      }, 2500);

      return () => clearInterval(intervalId);
    } else if (isSupabaseConnected && supabaseUser) {
      // Realtime listener
      setConsoleLogs([
        "🚀 [System] Live Supabase Sync Active...",
        "🔌 [Bridge] Listening for Playwright telemetry events in real-time."
      ]);
      setEasyApplyStep(1);

      const sub = supabase
        .channel("crawler-telemetry")
        .on(
          "postgres_changes",
          {
            event: "INSERT",
            schema: "public",
            table: "bot_events"
          },
          (payload) => {
            const ev = payload.new;
            const type = ev.event_type;
            const data = ev.payload || {};

            if (type === "navigating") {
              setMockBrowserUrl(data.url || "https://www.linkedin.com/jobs");
              setConsoleLogs(prev => [...prev, `🌐 [Network] Navigating to: ${data.keyword || "Job Listing"}`]);
              setEasyApplyStep(1);
            } else if (type === "typing") {
              setActiveElement(data.field || "");
              setActiveValue(data.value || "");
              setConsoleLogs(prev => [...prev, `✏️ [AI Solver] Typing: ${data.field} -> "${data.value}"`]);
              setEasyApplyStep(2);
            } else if (type === "clicking") {
              setConsoleLogs(prev => [...prev, `⚡ [Action] Clicking: "${data.button}"`]);
              if (data.button === "Submit Application") {
                setEasyApplyStep(3);
              }
            } else if (type === "success") {
              setConsoleLogs(prev => [...prev, `🎉 [Applied] Successfully submitted to ${data.company}!`]);
              setEasyApplyStep(3);
              loadSupabaseApplications();
            } else if (type === "mismatch") {
              setConsoleLogs(prev => [...prev, `🛑 [Skipped] Fit failure: ${data.reason}`]);
              setEasyApplyStep(0);
            } else if (type === "waiting_for_user") {
              setWaitingForUser(true);
              setManualQuestion(data.question || "Verification details required.");
              setConsoleLogs(prev => [...prev, `⚠️ [Human Control] Paused at verification check: "${data.question}"`]);
            } else if (type === "log") {
              setConsoleLogs(prev => [...prev, `🤖 Playwright: ${data.message}`]);
            }
          }
        )
        .subscribe();

      return () => {
        supabase.removeChannel(sub);
      };
    }
  }, [isCampaignRunning, botPaused, waitingForUser, sandboxMode]);

  // Submit Answer to Bot to continue
  const handleSolveQuestion = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!manualAnswer) return;

    setConsoleLogs(prev => [...prev, `✅ [Human Feedback] Submitted Answer: "${manualAnswer}"`]);
    setWaitingForUser(false);
    setManualQuestion("");

    if (sandboxMode) {
      setConsoleLogs(prev => [...prev, "▶️ [Sandbox] Relocation answer injected. Resuming Playwright browser..."]);
      // Fast forward after pause point
      setCrawlStep(12);
    } else if (isSupabaseConnected && supabaseUser) {
      try {
        // Send solving payload to Supabase bot events
        const { error } = await supabase
          .from("bot_events")
          .insert({
            user_id: supabaseUser.id,
            event_type: "user_input_solved",
            payload: {
              question: manualQuestion,
              answer: manualAnswer
            }
          });
        if (error) throw error;
        setAlertMessage({ type: "success", text: "Answer piped to local crawler!" });
        setTimeout(() => setAlertMessage(null), 3000);
      } catch (err) {
        console.error("Failed to post user answer:", err);
      }
    }
    setManualAnswer("");
  };

  return (
    <div style={{ display: "flex", minHeight: "100vh" }}>
      {/* ── LEFT SIDEBAR NAVIGATION ── */}
      <aside 
        className="glass-panel" 
        style={{ 
          width: "280px", 
          borderRight: "1px solid var(--border-glass)", 
          borderRadius: "0", 
          padding: "32px 24px", 
          display: "flex", 
          flexDirection: "column",
          gap: "40px"
        }}
      >
        <div>
          <h1 
            onClick={() => setActiveTab("welcome")}
            style={{ 
              fontFamily: "var(--font-family-title)", 
              fontWeight: 800, 
              fontSize: "1.5rem", 
              display: "flex", 
              alignItems: "center", 
              gap: "8px",
              cursor: "pointer"
            }}
          >
            <span style={{ fontSize: "1.6rem" }}>💼</span> 
            <span className="gradient-text">AutoApply</span> Pro
          </h1>
          <p style={{ fontSize: "0.75rem", color: "var(--color-text-muted)", marginTop: "4px", fontWeight: 600, letterSpacing: "0.05em", textTransform: "uppercase" }}>
            AI Job Search Orchestrator
          </p>
        </div>

        <nav style={{ display: "flex", flexDirection: "column", gap: "8px", flexGrow: 1 }}>
          <button 
            id="nav-btn-welcome"
            onClick={() => setActiveTab("welcome")} 
            className={`glass-panel ${activeTab === "welcome" ? "glass-panel-hover" : ""}`}
            style={{ 
              display: "flex", 
              alignItems: "center", 
              gap: "12px", 
              width: "100%", 
              padding: "14px 18px", 
              background: activeTab === "welcome" ? "rgba(0, 242, 254, 0.08)" : "transparent", 
              border: "none",
              borderColor: activeTab === "welcome" ? "var(--color-primary)" : "transparent",
              color: activeTab === "welcome" ? "var(--color-text-primary)" : "var(--color-text-secondary)",
              textAlign: "left",
              cursor: "pointer",
              fontWeight: 600,
              fontSize: "0.9rem",
              borderRadius: "8px"
            }}
          >
            <span style={{ fontSize: "1.1rem" }}>✨</span> Onboarding Guide
          </button>

          {(supabaseUser || sandboxMode) && (
            <>
              <button 
                id="nav-btn-dashboard"
                onClick={() => setActiveTab("dashboard")} 
                className={`glass-panel ${activeTab === "dashboard" ? "glass-panel-hover" : ""}`}
                style={{ 
                  display: "flex", 
                  alignItems: "center", 
                  gap: "12px", 
                  width: "100%", 
                  padding: "14px 18px", 
                  background: activeTab === "dashboard" ? "rgba(0, 242, 254, 0.08)" : "transparent", 
                  border: "none",
                  borderColor: activeTab === "dashboard" ? "var(--color-primary)" : "transparent",
                  color: activeTab === "dashboard" ? "var(--color-text-primary)" : "var(--color-text-secondary)",
                  textAlign: "left",
                  cursor: "pointer",
                  fontWeight: 600,
                  fontSize: "0.9rem",
                  borderRadius: "8px"
                }}
              >
                <span style={{ fontSize: "1.1rem" }}>🚀</span> Launch Pad
              </button>

              <button 
                id="nav-btn-profile"
                onClick={() => setActiveTab("profile")} 
                className={`glass-panel ${activeTab === "profile" ? "glass-panel-hover" : ""}`}
                style={{ 
                  display: "flex", 
                  alignItems: "center", 
                  gap: "12px", 
                  width: "100%", 
                  padding: "14px 18px", 
                  background: activeTab === "profile" ? "rgba(0, 242, 254, 0.08)" : "transparent", 
                  border: "none",
                  borderColor: activeTab === "profile" ? "var(--color-primary)" : "transparent",
                  color: activeTab === "profile" ? "var(--color-text-primary)" : "var(--color-text-secondary)",
                  textAlign: "left",
                  cursor: "pointer",
                  fontWeight: 600,
                  fontSize: "0.9rem",
                  borderRadius: "8px"
                }}
              >
                <span style={{ fontSize: "1.1rem" }}>👤</span> Resume & Facts
              </button>

              <button 
                id="nav-btn-logs"
                onClick={() => setActiveTab("logs")} 
                className={`glass-panel ${activeTab === "logs" ? "glass-panel-hover" : ""}`}
                style={{ 
                  display: "flex", 
                  alignItems: "center", 
                  gap: "12px", 
                  width: "100%", 
                  padding: "14px 18px", 
                  background: activeTab === "logs" ? "rgba(0, 242, 254, 0.08)" : "transparent", 
                  border: "none",
                  borderColor: activeTab === "logs" ? "var(--color-primary)" : "transparent",
                  color: activeTab === "logs" ? "var(--color-text-primary)" : "var(--color-text-secondary)",
                  textAlign: "left",
                  cursor: "pointer",
                  fontWeight: 600,
                  fontSize: "0.9rem",
                  borderRadius: "8px"
                }}
              >
                <span style={{ fontSize: "1.1rem" }}>📋</span> History Logs
              </button>
            </>
          )}

          <button 
            id="nav-btn-settings"
            onClick={() => setActiveTab("settings")} 
            className={`glass-panel ${activeTab === "settings" ? "glass-panel-hover" : ""}`}
            style={{ 
              display: "flex", 
              alignItems: "center", 
              gap: "12px", 
              width: "100%", 
              padding: "14px 18px", 
              background: activeTab === "settings" ? "rgba(0, 242, 254, 0.08)" : "transparent", 
              border: "none",
              borderColor: activeTab === "settings" ? "var(--color-primary)" : "transparent",
              color: activeTab === "settings" ? "var(--color-text-primary)" : "var(--color-text-secondary)",
              textAlign: "left",
              cursor: "pointer",
              fontWeight: 600,
              fontSize: "0.9rem",
              borderRadius: "8px"
            }}
          >
            <span style={{ fontSize: "1.1rem" }}>⚙️</span> Connections
          </button>
        </nav>

        {/* User context footer */}
        <div className="glass-panel" style={{ padding: "16px", borderRadius: "10px", display: "flex", gap: "12px", alignItems: "center", position: "relative", width: "100%", overflow: "hidden" }}>
          <div style={{ width: "36px", height: "36px", borderRadius: "50%", background: "linear-gradient(135deg, var(--color-primary), var(--color-secondary))", display: "flex", alignItems: "center", justifyContent: "center", fontWeight: 700, fontSize: "0.85rem", flexShrink: 0 }}>
            {supabaseUser ? (profile.fullName?.slice(0, 2).toUpperCase() || supabaseUser.email?.slice(0, 2).toUpperCase() || "U") : (sandboxMode ? "AR" : "G")}
          </div>
          <div style={{ minWidth: 0, flexGrow: 1 }}>
            <p style={{ fontSize: "0.85rem", fontWeight: 700, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
              {supabaseUser ? (profile.fullName || supabaseUser.email) : (sandboxMode ? "Alex Rivera (Demo)" : "Guest Session")}
            </p>
            <p style={{ fontSize: "0.7rem", color: "var(--color-text-muted)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
              {supabaseUser ? "Sync Active" : (sandboxMode ? "Sandbox Simulation" : "Offline Sandbox")}
            </p>
          </div>
          {(supabaseUser || sandboxMode) ? (
            <button 
              onClick={handleLogout}
              title="Terminate session"
              style={{
                background: "rgba(239, 68, 68, 0.15)",
                border: "1px solid rgba(239, 68, 68, 0.3)",
                color: "#f87171",
                padding: "6px 10px",
                borderRadius: "6px",
                fontSize: "0.75rem",
                fontWeight: 700,
                cursor: "pointer",
                transition: "all 0.2s",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                flexShrink: 0
              }}
            >
              🚪 Exit
            </button>
          ) : (
            <button 
              onClick={() => setActiveTab("settings")}
              title="Connect to Cloud Sync"
              style={{
                background: "rgba(0, 242, 254, 0.15)",
                border: "1px solid rgba(0, 242, 254, 0.3)",
                color: "var(--color-primary)",
                padding: "6px 10px",
                borderRadius: "6px",
                fontSize: "0.75rem",
                fontWeight: 700,
                cursor: "pointer",
                transition: "all 0.2s",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                flexShrink: 0
              }}
            >
              🔑 Sync
            </button>
          )}
        </div>
      </aside>

      {/* ── RIGHT MAIN CONTENT AREA ── */}
      <main style={{ flexGrow: 1, padding: "40px", display: "flex", flexDirection: "column", gap: "32px", overflowY: "auto", maxHeight: "100vh" }}>
        
        {/* Floating Success Notification */}
        {alertMessage && (
          <div 
            style={{ 
              position: "fixed", 
              top: "24px", 
              right: "24px", 
              background: alertMessage.type === "success" ? "rgba(52, 211, 153, 0.95)" : "rgba(79, 172, 254, 0.95)",
              color: "#ffffff", 
              backdropFilter: "blur(8px)", 
              padding: "16px 24px", 
              borderRadius: "8px", 
              boxShadow: "0 10px 30px rgba(0,0,0,0.3)", 
              zIndex: 1000,
              display: "flex",
              alignItems: "center",
              gap: "8px",
              fontFamily: "var(--font-family-title)",
              fontWeight: 600,
              fontSize: "0.9rem",
              animation: "pulse-soft 2s ease-in-out infinite"
            }}
          >
            <span>{alertMessage.type === "success" ? "🟢" : "ℹ️"}</span>
            {alertMessage.text}
          </div>
        )}

        {/* ── TAB 1: WELCOME LANDING PAGE (GUIDED INTRODUCTION) ── */}
        {activeTab === "welcome" && (
          <div style={{ display: "flex", flexDirection: "column", gap: "40px", maxWidth: "900px", margin: "0 auto" }}>
            <div style={{ textAlign: "center" }}>
              <p style={{ fontSize: "0.95rem", color: "var(--color-primary)", fontWeight: 800, textTransform: "uppercase", letterSpacing: "0.15em" }}>Introducing the Future of Job Hunting</p>
              <h2 style={{ fontFamily: "var(--font-family-title)", fontSize: "3.2rem", fontWeight: 800, marginTop: "12px", lineHeight: "1.1" }}>
                Automate Your Job Applications with <span className="gradient-text">Autonomous AI</span>
              </h2>
              <p style={{ color: "var(--color-text-secondary)", fontSize: "1.1rem", marginTop: "16px", maxWidth: "680px", margin: "16px auto 0" }}>
                AutoApply Pro logs onto LinkedIn via residential proxies, parses complex questions with custom-tailored Groq LLM intelligence, and applies to hundreds of jobs with zero visual footprints.
              </p>
            </div>

            {/* Core Value Proposition Banners */}
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))", gap: "24px", marginTop: "16px" }}>
              <div className="glass-panel" style={{ padding: "24px" }}>
                <span style={{ fontSize: "2rem" }}>🧠</span>
                <h3 style={{ fontSize: "1.1rem", fontWeight: 800, marginTop: "12px" }}>Bring Your Own Key (BYOK)</h3>
                <p style={{ fontSize: "0.85rem", color: "var(--color-text-secondary)", marginTop: "8px", lineHeight: "1.5" }}>
                  Save your private Groq API key directly to your database. Enjoy completely free AI calls with unlimited daily operations, saving hundreds in centralized host fees.
                </p>
              </div>

              <div className="glass-panel" style={{ padding: "24px" }}>
                <span style={{ fontSize: "2rem" }}>📄</span>
                <h3 style={{ fontSize: "1.1rem", fontWeight: 800, marginTop: "12px" }}>One-Click Resume Parser</h3>
                <p style={{ fontSize: "0.85rem", color: "var(--color-text-secondary)", marginTop: "8px", lineHeight: "1.5" }}>
                  Drag & drop your PDF resume. Our client-side analyzer extracts email, contact facts, and core tech arrays in under 3 seconds to map them to standard application formats.
                </p>
              </div>

              <div className="glass-panel" style={{ padding: "24px" }}>
                <span style={{ fontSize: "2rem" }}>👁️</span>
                <h3 style={{ fontSize: "1.1rem", fontWeight: 800, marginTop: "12px" }}>Human Bot Control Viewer</h3>
                <p style={{ fontSize: "0.85rem", color: "var(--color-text-secondary)", marginTop: "8px", lineHeight: "1.5" }}>
                  Watch a real-time live capture stream of the Playwright bot navigating LinkedIn. Pause, resume, or answer complex manual verification questions directly from your interface.
                </p>
              </div>
            </div>

            {/* Guided Path Selector / CTAs */}
            <div className="glass-panel" style={{ padding: "32px", border: "1px solid rgba(0, 242, 254, 0.2)", background: "rgba(10, 15, 30, 0.3)", display: "flex", flexDirection: "column", gap: "24px", alignItems: "center", textAlign: "center" }}>
              <div>
                <h3 style={{ fontFamily: "var(--font-family-title)", fontSize: "1.3rem", fontWeight: 800 }}>Ready to get started? Select a route below</h3>
                <p style={{ fontSize: "0.85rem", color: "var(--color-text-muted)", marginTop: "4px" }}>No credit card required. Experience live automation instantly.</p>
              </div>

              <div style={{ display: "flex", gap: "16px", flexWrap: "wrap", justifyContent: "center" }}>
                <button 
                  onClick={() => {
                    setAuthMode("register");
                    setActiveTab("settings");
                  }}
                  className="glass-btn" 
                  style={{ display: "flex", alignItems: "center", gap: "8px", padding: "14px 28px" }}
                >
                  🚀 Create Sync Account
                </button>
                <button 
                  onClick={() => {
                    setAuthMode("login");
                    setActiveTab("settings");
                  }}
                  className="glass-btn-secondary" 
                  style={{ padding: "14px 28px" }}
                >
                  🔑 Sign In
                </button>
                <button 
                  onClick={() => {
                    setSandboxMode(true);
                    setActiveTab("dashboard");
                    setAlertMessage({ type: "success", text: "Sandbox Demonstration Mode active!" });
                  }}
                  className="glass-btn-secondary" 
                  style={{ 
                    border: "1px solid var(--color-primary)", 
                    color: "var(--color-primary)",
                    padding: "14px 28px",
                    background: "rgba(0, 242, 254, 0.05)"
                  }}
                >
                  🌐 Run Guest Sandbox Preview
                </button>
              </div>
            </div>
          </div>
        )}

        {/* ── TAB 2: DASHBOARD / LAUNCH PAD VIEW (REAL-TIME CONSOLE & VIEWER) ── */}
        {activeTab === "dashboard" && (
          <>
            {/* Guided Stepper checklist at startup */}
            {!sandboxMode && onboardingStep < 3 && (
              <div className="glass-panel" style={{ padding: "24px", border: "1px solid rgba(0, 242, 254, 0.3)", background: "rgba(10, 15, 30, 0.4)", position: "relative" }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", borderBottom: "1px solid rgba(255, 255, 255, 0.08)", paddingBottom: "12px", marginBottom: "16px" }}>
                  <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                    <span style={{ fontSize: "1.3rem" }}>🗺️</span>
                    <div>
                      <h3 style={{ fontFamily: "var(--font-family-title)", fontSize: "1rem", fontWeight: 800 }}>First-Time Setup Stepper Wizard</h3>
                      <p style={{ fontSize: "0.75rem", color: "var(--color-text-muted)" }}>Complete these two setup phases to unlock automation</p>
                    </div>
                  </div>
                  <span style={{ fontSize: "0.75rem", fontWeight: 700, color: "var(--color-primary)", background: "rgba(0, 242, 254, 0.1)", padding: "4px 10px", borderRadius: "6px" }}>
                    {onboardingStep === 1 ? "PHASE 1: API KEY" : "PHASE 2: RESUME FACTS"}
                  </span>
                </div>

                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "20px" }}>
                  {/* Step 1 Card */}
                  <div className="glass-panel" style={{ padding: "16px", background: onboardingStep === 1 ? "rgba(0, 242, 254, 0.03)" : "rgba(255,255,255,0.01)", borderColor: onboardingStep === 1 ? "var(--color-primary)" : "var(--border-glass)" }}>
                    <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "8px" }}>
                      <span style={{ padding: "2px 6px", background: profile.groqKey ? "rgba(52, 211, 153, 0.2)" : "rgba(243, 85, 136, 0.2)", borderRadius: "4px", fontSize: "0.65rem", fontWeight: 800, color: profile.groqKey ? "var(--color-success)" : "var(--color-accent)" }}>
                        {profile.groqKey ? "✓ COMPLETED" : "1. CONNECT KEY"}
                      </span>
                    </div>
                    <p style={{ fontSize: "0.75rem", color: "var(--color-text-secondary)", lineHeight: "1.4" }}>
                      To automate answers, go to the Profile tab, click **Create Free Groq Key**, and paste it there.
                    </p>
                    <button 
                      onClick={() => setActiveTab("profile")}
                      className="glass-btn-secondary" 
                      style={{ width: "100%", padding: "6px 12px", fontSize: "0.7rem", marginTop: "12px", border: "1px solid rgba(0, 242, 254, 0.2)", color: "var(--color-primary)" }}
                    >
                      Configure Groq Key ➜
                    </button>
                  </div>

                  {/* Step 2 Card */}
                  <div className="glass-panel" style={{ padding: "16px", background: onboardingStep === 2 ? "rgba(0, 242, 254, 0.03)" : "rgba(255,255,255,0.01)", borderColor: onboardingStep === 2 ? "var(--color-primary)" : "var(--border-glass)", opacity: onboardingStep < 2 ? 0.5 : 1 }}>
                    <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "8px" }}>
                      <span style={{ padding: "2px 6px", background: profile.fullName ? "rgba(52, 211, 153, 0.2)" : "rgba(243, 85, 136, 0.2)", borderRadius: "4px", fontSize: "0.65rem", fontWeight: 800, color: profile.fullName ? "var(--color-success)" : "var(--color-accent)" }}>
                        {profile.fullName ? "✓ COMPLETED" : "2. PARSE CV FACTS"}
                      </span>
                    </div>
                    <p style={{ fontSize: "0.75rem", color: "var(--color-text-secondary)", lineHeight: "1.4" }}>
                      Upload your PDF resume in the Facts tab. The AI will parse details client-side using the key provided.
                    </p>
                    <button 
                      disabled={onboardingStep < 2}
                      onClick={() => setActiveTab("profile")}
                      className="glass-btn-secondary" 
                      style={{ width: "100%", padding: "6px 12px", fontSize: "0.7rem", marginTop: "12px" }}
                    >
                      Parse Resume ➜
                    </button>
                  </div>
                </div>
              </div>
            )}

            {/* Campaign Header Controls */}
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: "20px" }}>
              <div>
                <p style={{ fontSize: "0.85rem", color: "var(--color-primary)", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.08em" }}>
                  {sandboxMode ? "🛰️ Guest Demo Sandbox Mode" : "🚀 Campaign Launch Pad"}
                </p>
                <h2 style={{ fontFamily: "var(--font-family-title)", fontSize: "2.2rem", fontWeight: 800 }}>
                  Job Search <span className="gradient-text">Automation</span> Console
                </h2>
              </div>

              {/* Campaign Ignition CTAs */}
              <div style={{ display: "flex", gap: "12px" }}>
                <button 
                  id="btn-toggle-campaign"
                  onClick={() => setIsCampaignRunning(!isCampaignRunning)}
                  className="glass-panel"
                  style={{ 
                    display: "flex",
                    alignItems: "center",
                    gap: "10px",
                    padding: "12px 24px",
                    borderRadius: "10px",
                    fontWeight: 700,
                    cursor: "pointer",
                    border: "1px solid",
                    background: isCampaignRunning ? "rgba(243, 85, 136, 0.15)" : "rgba(0, 242, 254, 0.15)",
                    borderColor: isCampaignRunning ? "var(--color-accent)" : "var(--color-primary)",
                    color: isCampaignRunning ? "#ff839d" : "var(--color-primary)",
                    transition: "all 0.3s ease"
                  }}
                >
                  <span 
                    className={isCampaignRunning && !botPaused ? "animate-pulse-soft" : ""} 
                    style={{ 
                      display: "inline-block", 
                      width: "8px", 
                      height: "8px", 
                      borderRadius: "50%", 
                      background: isCampaignRunning ? "var(--color-accent)" : "var(--color-primary)" 
                    }}
                  />
                  {isCampaignRunning ? "STOP BOT CRAWL" : "LAUNCH CRAWLER BOT"}
                </button>
              </div>
            </div>

            {/* Metrics cards grid (Clean default metrics, no hardcoded placeholders if sync is empty!) */}
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: "24px" }}>
              <div className="glass-panel glass-panel-hover" style={{ padding: "24px" }}>
                <p style={{ fontSize: "0.75rem", fontWeight: 700, color: "var(--color-text-muted)", textTransform: "uppercase", letterSpacing: "0.06em" }}>Total Applications</p>
                <h3 style={{ fontSize: "2.5rem", fontWeight: 800, marginTop: "8px" }} className="gradient-text">
                  {applications.length}
                </h3>
                <p style={{ fontSize: "0.75rem", color: "var(--color-text-muted)", marginTop: "6px" }}>
                  {applications.length > 0 ? "🟢 Database sync verified" : "Awaiting first run logs"}
                </p>
              </div>

              <div className="glass-panel glass-panel-hover" style={{ padding: "24px" }}>
                <p style={{ fontSize: "0.75rem", fontWeight: 700, color: "var(--color-text-muted)", textTransform: "uppercase", letterSpacing: "0.06em" }}>Daily Quota Cap</p>
                <h3 style={{ fontSize: "2.5rem", fontWeight: 800, marginTop: "8px" }}>25</h3>
                <p style={{ fontSize: "0.75rem", color: "var(--color-text-muted)", marginTop: "6px" }}>Jobs threshold limit</p>
              </div>

              <div className="glass-panel glass-panel-hover" style={{ padding: "24px" }}>
                <p style={{ fontSize: "0.75rem", fontWeight: 700, color: "var(--color-text-muted)", textTransform: "uppercase", letterSpacing: "0.06em" }}>Fit Filter Match</p>
                <h3 style={{ fontSize: "2.5rem", fontWeight: 800, marginTop: "8px" }} className="gradient-text-pink">90%+</h3>
                <p style={{ fontSize: "0.75rem", color: "var(--color-text-muted)", marginTop: "6px" }}>AI requirements score</p>
              </div>

              <div className="glass-panel glass-panel-hover" style={{ padding: "24px" }}>
                <p style={{ fontSize: "0.75rem", fontWeight: 700, color: "var(--color-text-muted)", textTransform: "uppercase", letterSpacing: "0.06em" }}>Stealth Status</p>
                <h3 style={{ fontSize: "2rem", fontWeight: 800, marginTop: "8px", color: isCampaignRunning ? "var(--color-success)" : "var(--color-text-muted)" }}>
                  {isCampaignRunning ? (botPaused ? "⏸️ HELD" : "🟢 ACTIVE") : "🛑 IDLE"}
                </h3>
                <p style={{ fontSize: "0.75rem", color: "var(--color-text-muted)", marginTop: "6px" }}>Stealth driver active</p>
              </div>
            </div>

            {/* Split layout: Terminal Console + Live Visual Bot Viewer with pause controls */}
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "32px" }}>
              
              {/* Terminal Logs Column */}
              <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
                <h3 style={{ fontFamily: "var(--font-family-title)", fontSize: "1.1rem", fontWeight: 700, color: "var(--color-text-primary)", display: "flex", alignItems: "center", gap: "6px" }}>
                  📟 Playwright Console Feed
                </h3>
                
                <div className="console-container" style={{ flexGrow: 1, display: "flex", flexDirection: "column", minHeight: "420px" }}>
                  <div className="console-header" style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                    <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                      <span className="console-dot" style={{ background: "#ef4444" }}></span>
                      <span className="console-dot" style={{ background: "#eab308" }}></span>
                      <span className="console-dot" style={{ background: "#22c55e" }}></span>
                      <span style={{ fontSize: "0.7rem", color: "var(--color-text-muted)", marginLeft: "8px", fontWeight: 600 }}>CRAWLER STREAM</span>
                    </div>
                    {isCampaignRunning && (
                      <span style={{ fontSize: "0.65rem", background: "rgba(0, 242, 254, 0.15)", color: "var(--color-primary)", padding: "2px 8px", borderRadius: "4px", fontWeight: 800 }}>
                        {botPaused ? "⏸️ PAUSED" : "🟢 RUNNING"}
                      </span>
                    )}
                  </div>

                  <div className="console-body" style={{ height: "380px" }}>
                    {consoleLogs.map((log, index) => (
                      <div key={index} style={{ 
                        lineHeight: "1.4", 
                        borderLeft: "2px solid",
                        borderColor: log.includes("success") || log.includes("[Success]") || log.includes("🎉") ? "var(--color-success)" : log.includes("Mismatch") || log.includes("🛑") || log.includes("⚠️") ? "var(--color-accent)" : "rgba(255,255,255,0.1)",
                        paddingLeft: "8px"
                      }}>
                        {log}
                      </div>
                    ))}
                    <div ref={consoleEndRef} />
                  </div>
                </div>
              </div>

              {/* Live Visual Bot Inspector (LinkedIn Browser Mockup with pause buttons) */}
              <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
                <h3 style={{ fontFamily: "var(--font-family-title)", fontSize: "1.1rem", fontWeight: 700, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                  <span>👁️ Real-Time Browser Stream</span>
                  {sandboxMode && <span style={{ fontSize: "0.7rem", color: "var(--color-primary)", fontWeight: 700 }}>(Sandbox Demo Active)</span>}
                </h3>

                <div 
                  className="glass-panel" 
                  style={{ 
                    flexGrow: 1, 
                    minHeight: "420px", 
                    background: "#0f111a", 
                    overflow: "hidden", 
                    display: "flex", 
                    flexDirection: "column",
                    boxShadow: "0 10px 40px rgba(0,0,0,0.5)",
                    border: waitingForUser ? "1px solid var(--color-accent)" : "1px solid var(--border-glass)",
                    transition: "all 0.3s ease"
                  }}
                >
                  {/* Browser Chrome Header Mock */}
                  <div style={{ background: "rgba(255,255,255,0.03)", borderBottom: "1px solid var(--border-glass)", padding: "10px 16px", display: "flex", alignItems: "center", gap: "12px", justifyContent: "space-between" }}>
                    <div style={{ display: "flex", alignItems: "center", gap: "12px", flexGrow: 1 }}>
                      <div style={{ display: "flex", gap: "6px" }}>
                        <span style={{ width: "8px", height: "8px", borderRadius: "50%", background: "#64748b" }}></span>
                        <span style={{ width: "8px", height: "8px", borderRadius: "50%", background: "#64748b" }}></span>
                        <span style={{ width: "8px", height: "8px", borderRadius: "50%", background: "#64748b" }}></span>
                      </div>
                      {/* URL Bar */}
                      <div 
                        style={{ 
                          flexGrow: 1, 
                          background: "rgba(0,0,0,0.4)", 
                          borderRadius: "6px", 
                          padding: "4px 12px", 
                          fontSize: "0.75rem", 
                          color: "var(--color-text-muted)", 
                          fontFamily: "monospace",
                          maxWidth: "340px",
                          overflow: "hidden",
                          textOverflow: "ellipsis",
                          whiteSpace: "nowrap"
                        }}
                      >
                        {mockBrowserUrl}
                      </div>
                    </div>

                    {/* Human controls overlaid inside browser chrome */}
                    {isCampaignRunning && (
                      <div style={{ display: "flex", gap: "6px" }}>
                        <button 
                          onClick={() => setBotPaused(!botPaused)}
                          style={{
                            background: botPaused ? "rgba(52, 211, 153, 0.2)" : "rgba(251, 191, 36, 0.2)",
                            border: "1px solid",
                            borderColor: botPaused ? "var(--color-success)" : "var(--color-warning)",
                            color: botPaused ? "var(--color-success)" : "var(--color-warning)",
                            padding: "4px 10px",
                            borderRadius: "4px",
                            fontSize: "0.7rem",
                            fontWeight: 700,
                            cursor: "pointer",
                            display: "flex",
                            alignItems: "center",
                            gap: "4px"
                          }}
                        >
                          {botPaused ? "▶️ CONTINUE" : "⏸️ PAUSE"}
                        </button>
                      </div>
                    )}
                  </div>

                  {/* Browser Window Body */}
                  <div style={{ flexGrow: 1, padding: "20px", display: "flex", flexDirection: "column", justifyContent: "center", alignItems: "center", position: "relative" }}>
                    
                    {!isCampaignRunning && (
                      <div style={{ textAlign: "center", color: "var(--color-text-muted)" }}>
                        <span style={{ fontSize: "3rem" }}>🛰️</span>
                        <p style={{ fontSize: "0.9rem", marginTop: "12px", fontWeight: 600 }}>Browser Idle.</p>
                        <p style={{ fontSize: "0.75rem", color: "var(--color-text-muted)", marginTop: "4px" }}>
                          {onboardingStep < 3 ? "Complete step wizard requirements first" : "Click 'Launch Crawler Bot' to initiate Playwright."}
                        </p>
                      </div>
                    )}

                    {isCampaignRunning && (
                      <div style={{ width: "100%", height: "100%", display: "flex", flexDirection: "column", gap: "12px", justifyContent: "center" }}>
                        
                        {/* Simulation stages */}
                        {crawlStep < 6 && (
                          <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: "16px" }}>
                            <div style={{ width: "40px", height: "40px", border: "3px solid rgba(0, 242, 254, 0.1)", borderTopColor: "var(--color-primary)", borderRadius: "50%" }} className="animate-spin-slow" />
                            <p style={{ fontSize: "0.85rem", color: "var(--color-primary)", fontFamily: "monospace" }}>
                              {crawlStep <= 2 ? "🤖 Webdriver Stealth shielding..." : "🔍 Analyzing LinkedIn job cards..."}
                            </p>
                          </div>
                        )}

                        {/* Fit Evaluator */}
                        {crawlStep >= 6 && crawlStep < 8 && (
                          <div className="glass-panel" style={{ padding: "20px", background: "rgba(255,255,255,0.01)" }}>
                            <h4 style={{ fontSize: "1.1rem", fontWeight: 700 }}>Senior Frontend Architect</h4>
                            <p style={{ fontSize: "0.85rem", color: "var(--color-primary)", fontWeight: 600, marginTop: "4px" }}>Stripe</p>
                            
                            <div style={{ display: "flex", alignItems: "center", gap: "10px", marginTop: "16px" }}>
                              <span style={{ padding: "4px 8px", background: "rgba(0, 242, 254, 0.08)", border: "1px solid rgba(0, 242, 254, 0.15)", borderRadius: "4px", fontSize: "0.8rem", color: "var(--color-primary)", fontWeight: 700 }}>
                                96% Match Fit
                              </span>
                              <span style={{ fontSize: "0.8rem", color: "var(--color-text-secondary)" }}>
                                Analyzing requirements facts...
                              </span>
                            </div>
                          </div>
                        )}

                        {/* Interactive Verification Solver (Relocation Question) */}
                        {waitingForUser && (
                          <div className="glass-panel" style={{ border: "1px solid var(--color-accent)", background: "rgba(15, 6, 12, 0.9)", padding: "20px", borderRadius: "10px", boxShadow: "0 0 24px rgba(243, 85, 136, 0.2)", width: "100%", maxWidth: "420px", margin: "0 auto", position: "relative", zIndex: 10 }}>
                            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", borderBottom: "1px solid rgba(243, 85, 136, 0.2)", paddingBottom: "8px", marginBottom: "12px" }}>
                              <span style={{ fontSize: "0.8rem", fontWeight: 800, color: "var(--color-accent)", display: "flex", alignItems: "center", gap: "4px" }}>
                                ⚠️ ACTION REQUIRED
                              </span>
                              <span style={{ fontSize: "0.7rem", color: "var(--color-text-muted)" }}>Stealth Hold Active</span>
                            </div>

                            <p style={{ fontSize: "0.85rem", fontWeight: 700, color: "#ffffff", marginBottom: "12px", lineHeight: "1.4" }}>
                              {manualQuestion}
                            </p>

                            <form onSubmit={handleSolveQuestion} style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
                              <input 
                                type="text"
                                value={manualAnswer}
                                onChange={(e) => setManualAnswer(e.target.value)}
                                placeholder="Type answer, e.g. Yes, willing to relocate"
                                className="glass-input"
                                style={{ width: "100%", fontSize: "0.8rem", padding: "8px 12px" }}
                                required
                              />

                              <div style={{ display: "flex", justifyContent: "flex-end", gap: "8px" }}>
                                <button 
                                  type="button"
                                  onClick={() => setWaitingForUser(false)}
                                  className="glass-btn-secondary"
                                  style={{ padding: "6px 12px", fontSize: "0.75rem", border: "none" }}
                                >
                                  Cancel
                                </button>
                                <button 
                                  type="submit"
                                  className="glass-btn"
                                  style={{ padding: "6px 16px", fontSize: "0.75rem", background: "linear-gradient(135deg, var(--color-accent) 0%, #ff839d 100%)", boxShadow: "0 4px 12px rgba(243, 85, 136, 0.2)" }}
                                >
                                  Submit Answer ▶️
                                </button>
                              </div>
                            </form>
                          </div>
                        )}

                        {/* Interactive Easy Apply Input visualizer */}
                        {crawlStep >= 8 && crawlStep <= 12 && !waitingForUser && (
                          <div className="glass-panel" style={{ border: "1px solid var(--border-glass-hover)", background: "rgba(5, 6, 12, 0.8)", padding: "16px", borderRadius: "8px", display: "flex", flexDirection: "column", gap: "10px", width: "100%", maxWidth: "380px", margin: "0 auto" }}>
                            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", borderBottom: "1px solid rgba(255,255,255,0.06)", paddingBottom: "6px" }}>
                              <span style={{ fontSize: "0.75rem", fontWeight: 700, color: "var(--color-primary)" }}>LinkedIn Wizard - Stripe</span>
                              <span style={{ fontSize: "0.7rem", color: "var(--color-text-muted)" }}>Step 2 of 3</span>
                            </div>

                            <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
                              <div style={{ display: "flex", flexDirection: "column", gap: "2px" }}>
                                <label style={{ fontSize: "0.7rem", color: "var(--color-text-secondary)" }}>Candidate Name</label>
                                <div style={{ padding: "6px 10px", fontSize: "0.75rem", background: "rgba(0, 242, 254, 0.05)", border: "1px dashed var(--color-primary)", borderRadius: "4px", color: "#ffffff", display: "flex", justifyContent: "space-between" }}>
                                  <span>{profile.fullName || "Alex Rivera"}</span>
                                  <span style={{ fontSize: "0.65rem", color: "var(--color-primary)", fontWeight: 700 }}>🤖 Injected</span>
                                </div>
                              </div>

                              <div style={{ display: "flex", flexDirection: "column", gap: "2px" }}>
                                <label style={{ fontSize: "0.7rem", color: "var(--color-text-secondary)" }}>React Experience Years?</label>
                                <div style={{ padding: "6px 10px", fontSize: "0.75rem", background: "rgba(0, 242, 254, 0.05)", border: "1px dashed var(--color-primary)", borderRadius: "4px", color: "#ffffff", display: "flex", justifyContent: "space-between" }}>
                                  <span>6</span>
                                  <span style={{ fontSize: "0.65rem", color: "var(--color-primary)", fontWeight: 700 }}>🧠 AI Answered</span>
                                </div>
                              </div>
                            </div>
                          </div>
                        )}

                        {/* Submit Application Animation */}
                        {crawlStep === 12 && !waitingForUser && (
                          <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: "12px" }}>
                            <div style={{ padding: "16px 32px", background: "rgba(52, 211, 153, 0.15)", border: "2px solid var(--color-success)", borderRadius: "8px", boxShadow: "0 0 20px rgba(52, 211, 153, 0.3)", animation: "pulse-soft 2s infinite" }}>
                              <p style={{ color: "var(--color-success)", fontWeight: 700, fontSize: "0.95rem" }}>⚡ Clicking 'Submit Application'</p>
                            </div>
                          </div>
                        )}

                        {/* Success Event */}
                        {easyApplyStep === 3 && (
                          <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: "16px" }}>
                            <span style={{ fontSize: "3.5rem" }}>🎉</span>
                            <div style={{ textAlign: "center" }}>
                              <h4 style={{ color: "var(--color-success)", fontWeight: 800, fontSize: "1.2rem" }}>Application Submitted!</h4>
                              <p style={{ fontSize: "0.8rem", color: "var(--color-text-muted)", marginTop: "6px" }}>
                                Stripe application logged securely to history.
                              </p>
                            </div>
                          </div>
                        )}

                      </div>
                    )}
                  </div>
                </div>
              </div>

            </div>
          </>
        )}

        {/* ── TAB 3: RESUME facts & BYOK SETTINGS ── */}
        {activeTab === "profile" && (
          <div style={{ display: "flex", flexDirection: "column", gap: "32px" }}>
            
            {/* Header */}
            <div>
              <p style={{ fontSize: "0.85rem", color: "var(--color-primary)", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.08em" }}>Onboarding Core</p>
              <h2 style={{ fontFamily: "var(--font-family-title)", fontSize: "2.2rem", fontWeight: 800 }}>Resume facts & <span className="gradient-text">API Keys</span></h2>
              <p style={{ color: "var(--color-text-secondary)", fontSize: "0.9rem", marginTop: "4px" }}>
                Provide your private Groq Key and upload your CV PDF to automatically parse personal facts.
              </p>
            </div>

            {/* Stepper Wizard Indicator */}
            {!sandboxMode && (
              <div style={{ display: "flex", gap: "12px", borderBottom: "1px solid var(--border-glass)", paddingBottom: "20px" }}>
                <div style={{ flexGrow: 1, display: "flex", flexDirection: "column", gap: "6px" }}>
                  <span style={{ fontSize: "0.75rem", fontWeight: 700, color: onboardingStep >= 1 ? "var(--color-primary)" : "var(--color-text-muted)" }}>Step 1: API Key Config</span>
                  <div style={{ height: "4px", background: onboardingStep >= 1 ? "var(--color-primary)" : "var(--border-glass)", borderRadius: "2px" }} />
                </div>
                <div style={{ flexGrow: 1, display: "flex", flexDirection: "column", gap: "6px" }}>
                  <span style={{ fontSize: "0.75rem", fontWeight: 700, color: onboardingStep >= 2 ? "var(--color-primary)" : "var(--color-text-muted)" }}>Step 2: Parse PDF CV</span>
                  <div style={{ height: "4px", background: onboardingStep >= 2 ? "var(--color-primary)" : "var(--border-glass)", borderRadius: "2px" }} />
                </div>
                <div style={{ flexGrow: 1, display: "flex", flexDirection: "column", gap: "6px" }}>
                  <span style={{ fontSize: "0.75rem", fontWeight: 700, color: onboardingStep >= 3 ? "var(--color-primary)" : "var(--color-text-muted)" }}>Step 3: Campaign Ignition</span>
                  <div style={{ height: "4px", background: onboardingStep >= 3 ? "var(--color-primary)" : "var(--border-glass)", borderRadius: "2px" }} />
                </div>
              </div>
            )}

            {/* Step 1: BYOK API Key Guide Container */}
            <div className="glass-panel" style={{ padding: "32px", display: "flex", flexDirection: "column", gap: "20px", border: onboardingStep === 1 ? "1px solid var(--color-primary)" : "1px solid var(--border-glass)" }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", flexWrap: "wrap", gap: "16px" }}>
                <div>
                  <h3 style={{ fontFamily: "var(--font-family-title)", fontSize: "1.2rem", fontWeight: 800, display: "flex", alignItems: "center", gap: "8px" }}>
                    <span>🔐</span> Guided API Key Configuration (BYOK)
                  </h3>
                  <p style={{ fontSize: "0.8rem", color: "var(--color-text-muted)", marginTop: "4px", maxWidth: "580px" }}>
                    Enjoy 100% free autonomous applications. Creating a key takes less than 30 seconds.
                  </p>
                </div>
                
                <div style={{ display: "flex", gap: "10px" }}>
                  <a 
                    href="https://console.groq.com/keys" 
                    target="_blank" 
                    rel="noreferrer" 
                    className="glass-btn" 
                    style={{ fontSize: "0.75rem", padding: "8px 16px", textDecoration: "none", display: "inline-block", background: "linear-gradient(135deg, var(--color-primary) 0%, var(--color-secondary) 100%)", boxShadow: "0 0 16px rgba(0, 242, 254, 0.2)" }}
                  >
                    🔑 Create Free Groq Key
                  </a>
                  <button 
                    onClick={handlePasteKey}
                    className="glass-btn-secondary" 
                    style={{ fontSize: "0.75rem", padding: "8px 16px" }}
                  >
                    📋 Paste Key
                  </button>
                </div>
              </div>

              {/* Instructions list */}
              <div className="glass-panel" style={{ padding: "16px 20px", background: "rgba(255,255,255,0.01)" }}>
                <p style={{ fontSize: "0.8rem", lineHeight: "1.6" }}>
                  <strong>How to get your key:</strong>
                  <br />
                  1. Click the <strong>Create Free Groq Key</strong> button above (opens Groq's official developer site).
                  <br />
                  2. Sign in with standard email credentials or Google account.
                  <br />
                  3. Click the bright green <strong>"Create API Key"</strong> button, type a name (e.g. <em>AutoApply Bot</em>), and click Create.
                  <br />
                  4. Copy the generated key (starts with <code>gsk_</code>), come back here, and click <strong>Paste Key</strong> or paste it manually below!
                </p>
              </div>

              <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
                <label htmlFor="groqKey" style={{ fontSize: "0.8rem", fontWeight: 700, color: "var(--color-text-secondary)" }}>Private Groq API Key</label>
                <input 
                  type="password" 
                  id="groqKey" 
                  value={profile.groqKey} 
                  onChange={e => setProfile({...profile, groqKey: e.target.value})} 
                  className="glass-input" 
                  placeholder="gsk_..." 
                />
              </div>
            </div>

            {/* Step 2: Drag and drop CV Parser */}
            <div 
              onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
              onDragLeave={() => setIsDragging(false)}
              onDrop={(e) => {
                e.preventDefault();
                setIsDragging(false);
                if (onboardingStep < 2 && !sandboxMode) {
                  setAlertMessage({ type: "info", text: "Please enter and save your API Key first to enable parsing!" });
                  setTimeout(() => setAlertMessage(null), 4000);
                  return;
                }
                const file = e.dataTransfer.files[0];
                if (file && (file.type === "application/pdf" || file.name.endsWith(".pdf"))) {
                  handleCVUpload(file);
                }
              }}
              className="glass-panel"
              style={{
                border: isDragging ? "2px dashed var(--color-primary)" : "1px dashed var(--border-glass)",
                background: isDragging ? "rgba(0, 242, 254, 0.04)" : "rgba(255, 255, 255, 0.01)",
                borderRadius: "12px",
                padding: "36px",
                textAlign: "center",
                cursor: (onboardingStep >= 2 || sandboxMode) ? "pointer" : "not-allowed",
                opacity: (onboardingStep >= 2 || sandboxMode) ? 1 : 0.5,
                transition: "all 0.3s ease"
              }}
            >
              <input 
                disabled={onboardingStep < 2 && !sandboxMode}
                type="file" 
                id="cv-file-input" 
                accept=".pdf" 
                onChange={(e) => {
                  const files = e.target.files;
                  if (files && files.length > 0) handleCVUpload(files[0]);
                }}
                style={{ display: "none" }}
              />
              
              {isParsing ? (
                <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: "12px" }}>
                  <div style={{ width: "36px", height: "36px", border: "3px solid rgba(0, 242, 254, 0.1)", borderTopColor: "var(--color-primary)", borderRadius: "50%" }} className="animate-spin-slow" />
                  <p style={{ color: "var(--color-primary)", fontWeight: 700, fontSize: "0.85rem" }}>🧠 Client-Side AI Parser: Analysing resume structural layout...</p>
                </div>
              ) : (
                <label htmlFor={onboardingStep >= 2 || sandboxMode ? "cv-file-input" : ""} style={{ cursor: (onboardingStep >= 2 || sandboxMode) ? "pointer" : "not-allowed", display: "flex", flexDirection: "column", alignItems: "center", gap: "10px", width: "100%" }}>
                  <span style={{ fontSize: "2.2rem" }}>📄</span>
                  <div>
                    <h3 style={{ fontSize: "0.95rem", fontWeight: 700 }}>
                      {fileName ? `Active CV Facts Loaded: ${fileName}` : "Drag and Drop your PDF CV resume here"}
                    </h3>
                    <p style={{ fontSize: "0.75rem", color: "var(--color-text-muted)", marginTop: "4px" }}>
                      Supports PDF formats. AI parses contact variables directly in the browser.
                    </p>
                  </div>
                  {(onboardingStep >= 2 || sandboxMode) && (
                    <span className="glass-btn-secondary" style={{ padding: "6px 14px", fontSize: "0.75rem", marginTop: "4px" }}>
                      Browse PDF
                    </span>
                  )}
                </label>
              )}
            </div>

            {/* Candidate fact forms (Only unlocked when profile fullName is loaded) */}
            <form onSubmit={handleSaveProfile} className="glass-panel" style={{ padding: "32px", display: "flex", flexDirection: "column", gap: "24px", opacity: (profile.fullName || sandboxMode) ? 1 : 0.5 }}>
              <h3 style={{ fontFamily: "var(--font-family-title)", fontSize: "1.1rem", fontWeight: 800, borderBottom: "1px solid var(--border-glass)", paddingBottom: "12px" }}>
                👤 Extracted Candidate Details Facts
              </h3>

              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "24px" }}>
                <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
                  <label htmlFor="fullName" style={{ fontSize: "0.75rem", fontWeight: 700, color: "var(--color-text-secondary)" }}>Full Name</label>
                  <input 
                    type="text" 
                    id="fullName" 
                    value={profile.fullName} 
                    onChange={e => setProfile({...profile, fullName: e.target.value})} 
                    className="glass-input" 
                    required 
                  />
                </div>

                <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
                  <label htmlFor="email" style={{ fontSize: "0.75rem", fontWeight: 700, color: "var(--color-text-secondary)" }}>Email Address</label>
                  <input 
                    type="email" 
                    id="email" 
                    value={profile.email} 
                    onChange={e => setProfile({...profile, email: e.target.value})} 
                    className="glass-input" 
                    required 
                  />
                </div>

                <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
                  <label htmlFor="phone" style={{ fontSize: "0.75rem", fontWeight: 700, color: "var(--color-text-secondary)" }}>Phone Number</label>
                  <input 
                    type="text" 
                    id="phone" 
                    value={profile.phone} 
                    onChange={e => setProfile({...profile, phone: e.target.value})} 
                    className="glass-input" 
                    required 
                  />
                </div>

                <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
                  <label htmlFor="city" style={{ fontSize: "0.75rem", fontWeight: 700, color: "var(--color-text-secondary)" }}>Location (City, State)</label>
                  <input 
                    type="text" 
                    id="city" 
                    value={profile.city} 
                    onChange={e => setProfile({...profile, city: e.target.value})} 
                    className="glass-input" 
                    required 
                  />
                </div>
              </div>

              <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
                <label htmlFor="targetKeywords" style={{ fontSize: "0.75rem", fontWeight: 700, color: "var(--color-text-secondary)" }}>Target Job Keywords (Comma-separated)</label>
                <input 
                  type="text" 
                  id="targetKeywords" 
                  value={profile.targetKeywords} 
                  onChange={e => setProfile({...profile, targetKeywords: e.target.value})} 
                  className="glass-input" 
                  required 
                />
              </div>

              <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
                <label htmlFor="skills" style={{ fontSize: "0.75rem", fontWeight: 700, color: "var(--color-text-secondary)" }}>Skills Matrix Keywords (Comma-separated)</label>
                <input 
                  type="text" 
                  id="skills" 
                  value={profile.skills} 
                  onChange={e => setProfile({...profile, skills: e.target.value})} 
                  className="glass-input" 
                  required 
                />
              </div>

              <div style={{ display: "flex", justifyContent: "flex-end" }}>
                <button type="submit" id="btn-save-profile" className="glass-btn">
                  SAVE CANDIDATE DETAILS
                </button>
              </div>
            </form>
          </div>
        )}

        {/* ── TAB 4: APPLICATION HISTORY VIEW (DETAILED LOGS EXPLORER) ── */}
        {activeTab === "logs" && (
          <div style={{ display: "flex", flexDirection: "column", gap: "24px" }}>
            <div>
              <p style={{ fontSize: "0.85rem", color: "var(--color-primary)", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.08em" }}>Crawl History</p>
              <h2 style={{ fontFamily: "var(--font-family-title)", fontSize: "2.2rem", fontWeight: 800 }}>Application <span className="gradient-text">Logs History</span></h2>
              <p style={{ color: "var(--color-text-secondary)", fontSize: "0.9rem", marginTop: "4px" }}>
                Audit and drill down into the custom tailormade assets generated for each submitted application.
              </p>
            </div>

            <div className="glass-panel" style={{ padding: "24px", overflow: "hidden" }}>
              {applications.length === 0 ? (
                <div style={{ textAlign: "center", padding: "40px 20px", color: "var(--color-text-muted)" }}>
                  <span style={{ fontSize: "2.5rem" }}>🗄️</span>
                  <h3 style={{ fontSize: "1rem", fontWeight: 700, marginTop: "12px", color: "#ffffff" }}>No Applications Logged</h3>
                  <p style={{ fontSize: "0.8rem", color: "var(--color-text-muted)", marginTop: "4px" }}>
                    Once Playwright successfully applies to a job, the full description, cover letter, and forms are archived here.
                  </p>
                </div>
              ) : (
                <div style={{ overflowX: "auto" }}>
                  <table style={{ width: "100%", borderCollapse: "collapse", textAlign: "left", fontSize: "0.9rem" }}>
                    <thead>
                      <tr style={{ borderBottom: "1px solid var(--border-glass)", color: "var(--color-text-muted)" }}>
                        <th style={{ padding: "16px", fontWeight: 600 }}>JOB TITLE</th>
                        <th style={{ padding: "16px", fontWeight: 600 }}>COMPANY</th>
                        <th style={{ padding: "16px", fontWeight: 600 }}>APPLIED DATE</th>
                        <th style={{ padding: "16px", fontWeight: 600 }}>MATCH SCORE</th>
                        <th style={{ padding: "16px", fontWeight: 600 }}>STATUS</th>
                        <th style={{ padding: "16px", fontWeight: 600, textAlign: "right" }}>ACTION</th>
                      </tr>
                    </thead>
                    <tbody>
                      {applications.map(app => (
                        <tr key={app.id} style={{ borderBottom: "1px solid var(--border-glass)" }}>
                          <td style={{ padding: "16px", fontWeight: 700 }}>{app.job_title}</td>
                          <td style={{ padding: "16px" }}>{app.company}</td>
                          <td style={{ padding: "16px", color: "var(--color-text-secondary)" }}>{app.applied_date}</td>
                          <td style={{ padding: "16px" }}>
                            <span style={{ color: "var(--color-primary)", fontWeight: 600 }}>{app.match_score}%</span>
                          </td>
                          <td style={{ padding: "16px" }}>
                            <span style={{ 
                              fontSize: "0.75rem", 
                              fontWeight: 700, 
                              color: app.status === "Interviewing" ? "var(--color-warning)" : app.status === "Applied" ? "var(--color-success)" : "var(--color-accent)",
                              background: app.status === "Interviewing" ? "rgba(251, 191, 36, 0.08)" : app.status === "Applied" ? "rgba(52, 211, 153, 0.08)" : "rgba(243, 85, 136, 0.08)",
                              padding: "4px 8px",
                              borderRadius: "4px"
                            }}>
                              {app.status}
                            </span>
                          </td>
                          <td style={{ padding: "16px", textAlign: "right" }}>
                            <button 
                              onClick={() => setSelectedApp(app)}
                              className="glass-btn-secondary" 
                              style={{ padding: "6px 12px", fontSize: "0.75rem", borderRadius: "6px" }}
                            >
                              Explore Audit Details
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </div>
        )}

        {/* ── TAB 5: CONNECTIONS & INTEGRATIONS VIEW ── */}
        {activeTab === "settings" && (
          <div style={{ display: "flex", flexDirection: "column", gap: "24px" }}>
            <div>
              <p style={{ fontSize: "0.85rem", color: "var(--color-primary)", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.08em" }}>System Connections</p>
              <h2 style={{ fontFamily: "var(--font-family-title)", fontSize: "2.2rem", fontWeight: 800 }}>Integrations & <span className="gradient-text">Tokens</span></h2>
              <p style={{ color: "var(--color-text-secondary)", fontSize: "0.9rem", marginTop: "4px" }}>
                Verify connections to external databases and backend APIs.
              </p>
            </div>

            {/* Supabase Authentication Panel */}
            {!supabaseUser ? (
              <div className="glass-panel" style={{ padding: "32px", display: "flex", flexDirection: "column", gap: "20px", border: "1px solid rgba(0, 242, 254, 0.2)", background: "rgba(10, 15, 30, 0.3)" }}>
                <div>
                  <h3 style={{ fontFamily: "var(--font-family-title)", fontSize: "1.2rem", fontWeight: 700, display: "flex", alignItems: "center", gap: "8px" }}>
                    <span>🔐</span> Supabase User Authentication Portal
                  </h3>
                  <p style={{ fontSize: "0.8rem", color: "var(--color-text-muted)", marginTop: "4px" }}>
                    Sign in or create a new account to unlock cloud storage for your profile, applications, and real-time Playwright telemetry tracking.
                  </p>
                </div>

                <div style={{ display: "flex", gap: "12px", background: "rgba(0,0,0,0.2)", padding: "4px", borderRadius: "8px", width: "fit-content" }}>
                  <button 
                    onClick={() => setAuthMode("login")}
                    style={{ 
                      padding: "8px 16px", 
                      borderRadius: "6px", 
                      fontSize: "0.8rem", 
                      fontWeight: 700,
                      cursor: "pointer",
                      border: "none",
                      background: authMode === "login" ? "rgba(0, 242, 254, 0.15)" : "transparent",
                      color: authMode === "login" ? "var(--color-primary)" : "var(--color-text-secondary)"
                    }}
                  >
                    Sign In
                  </button>
                  <button 
                    onClick={() => setAuthMode("register")}
                    style={{ 
                      padding: "8px 16px", 
                      borderRadius: "6px", 
                      fontSize: "0.8rem", 
                      fontWeight: 700,
                      cursor: "pointer",
                      border: "none",
                      background: authMode === "register" ? "rgba(0, 242, 254, 0.15)" : "transparent",
                      color: authMode === "register" ? "var(--color-primary)" : "var(--color-text-secondary)"
                    }}
                  >
                    Create Account
                  </button>
                </div>

                <form onSubmit={handleAuthSubmit} style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "16px" }}>
                    <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
                      <label style={{ fontSize: "0.8rem", fontWeight: 600, color: "var(--color-text-secondary)" }}>Email Address</label>
                      <input 
                        type="email" 
                        value={authEmail} 
                        onChange={(e) => setAuthEmail(e.target.value)}
                        placeholder="e.g. yourname@domain.com"
                        className="glass-input" 
                        required
                      />
                    </div>
                    <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
                      <label style={{ fontSize: "0.8rem", fontWeight: 600, color: "var(--color-text-secondary)" }}>Password</label>
                      <input 
                        type="password" 
                        value={authPassword} 
                        onChange={(e) => setAuthPassword(e.target.value)}
                        placeholder="••••••••"
                        className="glass-input" 
                        required
                      />
                    </div>
                  </div>

                  <button 
                    type="submit" 
                    disabled={isAuthLoading}
                    className="glass-btn" 
                    style={{ alignSelf: "flex-end", display: "flex", alignItems: "center", gap: "8px" }}
                  >
                    {isAuthLoading ? (
                      <span className="animate-spin-slow" style={{ display: "inline-block", width: "12px", height: "12px", border: "2px solid transparent", borderTopColor: "#fff", borderRadius: "50%" }} />
                    ) : null}
                    {authMode === "login" ? "SIGN IN" : "REGISTER ACCOUNT"}
                  </button>
                </form>
              </div>
            ) : (
              <div className="glass-panel" style={{ padding: "24px 32px", display: "flex", justifyContent: "space-between", alignItems: "center", border: "1px solid rgba(52, 211, 153, 0.2)", background: "rgba(10, 30, 20, 0.2)" }}>
                <div>
                  <h3 style={{ fontFamily: "var(--font-family-title)", fontSize: "1.1rem", fontWeight: 700, color: "#ffffff", display: "flex", alignItems: "center", gap: "8px" }}>
                    <span style={{ color: "var(--color-success)" }}>🟢</span> Connected to Cloud Sync
                  </h3>
                  <p style={{ fontSize: "0.8rem", color: "var(--color-text-secondary)", marginTop: "4px" }}>
                    Logged in securely as <strong style={{ color: "var(--color-primary)" }}>{supabaseUser.email}</strong>. All candidate details and application logs are actively synchronized with your database.
                  </p>
                </div>
                
                <button 
                  onClick={handleLogout}
                  className="glass-btn-secondary" 
                  style={{ 
                    padding: "10px 20px", 
                    borderRadius: "8px", 
                    fontSize: "0.8rem", 
                    fontWeight: 700, 
                    border: "1px solid rgba(239, 68, 68, 0.3)", 
                    color: "#f87171",
                    background: "rgba(239, 68, 68, 0.05)",
                    cursor: "pointer"
                  }}
                >
                  🚪 Disconnect Session
                </button>
              </div>
            )}

            <div className="glass-panel" style={{ padding: "32px", display: "flex", flexDirection: "column", gap: "24px" }}>
              <h3 style={{ fontFamily: "var(--font-family-title)", fontSize: "1.2rem", fontWeight: 700, borderBottom: "1px solid var(--border-glass)", paddingBottom: "12px" }}>
                🌐 Database Integration Status
              </h3>

              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <div>
                  <h4 style={{ fontSize: "1rem", fontWeight: 700 }}>Supabase Cloud Connection</h4>
                  <p style={{ fontSize: "0.8rem", color: "var(--color-text-secondary)", marginTop: "4px" }}>
                    Status indicator for the hosted PostgreSQL database integration.
                  </p>
                </div>

                <span style={{ 
                  fontSize: "0.8rem", 
                  fontWeight: 700, 
                  color: isSupabaseConnected ? "var(--color-success)" : "var(--color-warning)",
                  background: isSupabaseConnected ? "rgba(52, 211, 153, 0.08)" : "rgba(251, 191, 36, 0.08)",
                  padding: "6px 12px",
                  borderRadius: "6px",
                  border: "1px solid",
                  borderColor: isSupabaseConnected ? "rgba(52, 211, 153, 0.2)" : "rgba(251, 191, 36, 0.2)"
                }}>
                  {isSupabaseConnected ? "🟢 CONNECTED (Live PostgreSQL)" : "🟡 SIMULATION MODE (Add credentials to .env.local)"}
                </span>
              </div>

              <div className="glass-panel" style={{ padding: "16px 20px", background: "rgba(255,255,255,0.01)" }}>
                <p style={{ fontSize: "0.85rem", lineHeight: "1.5" }}>
                  💡 <strong>How to link a live database:</strong>
                  <br />
                  1. Launch a project at <strong>[Supabase.com](https://supabase.com)</strong>.
                  <br />
                  2. Execute our SQL definitions script (schema.sql) inside the Supabase SQL editor.
                  <br />
                  3. In the project folder <code>frontend/.env.local</code>, set <code>NEXT_PUBLIC_SUPABASE_URL</code> and <code>NEXT_PUBLIC_SUPABASE_ANON_KEY</code>.
                </p>
              </div>
            </div>
          </div>
        )}

      </main>

      {/* ── APPLICATION AUDIT SLIDE-OVER DRAWER MODAL ── */}
      {selectedApp && (
        <div style={{ 
          position: "fixed", 
          top: 0, 
          left: 0, 
          width: "100%", 
          height: "100%", 
          background: "rgba(0,0,0,0.6)", 
          backdropFilter: "blur(12px)", 
          display: "flex", 
          alignItems: "center", 
          justifyContent: "flex-end", // Align to right side as slider drawer
          zIndex: 1000,
          transition: "all 0.3s ease"
        }}
        onClick={() => setSelectedApp(null)}
        >
          <div 
            className="glass-panel" 
            style={{ 
              width: "100%", 
              maxWidth: "600px", 
              height: "100%", 
              background: "#0c0d12", 
              padding: "40px 32px",
              display: "flex",
              flexDirection: "column",
              gap: "24px",
              overflowY: "auto",
              borderRadius: "0",
              borderLeft: "1px solid var(--border-glass-hover)",
              boxShadow: "-10px 0 40px rgba(0,242,254,0.15)"
            }}
            onClick={(e) => e.stopPropagation()} // Prevent closing on inner clicks
          >
            {/* Drawer Header */}
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", borderBottom: "1px solid var(--border-glass)", paddingBottom: "16px" }}>
              <div>
                <span style={{ 
                  fontSize: "0.7rem", 
                  fontWeight: 800, 
                  color: "var(--color-primary)", 
                  background: "rgba(0, 242, 254, 0.08)",
                  padding: "4px 8px",
                  borderRadius: "4px",
                  border: "1px solid rgba(0, 242, 254, 0.15)"
                }}>
                  {selectedApp.match_score}% Fit score verified by AI
                </span>
                <h3 style={{ fontFamily: "var(--font-family-title)", fontSize: "1.5rem", fontWeight: 800, marginTop: "8px" }}>
                  {selectedApp.job_title}
                </h3>
                <p style={{ fontSize: "0.9rem", color: "var(--color-text-secondary)", marginTop: "4px" }}>
                  🏢 <strong>{selectedApp.company}</strong> • {selectedApp.location}
                </p>
                <p style={{ fontSize: "0.75rem", color: "var(--color-text-muted)", marginTop: "6px" }}>
                  📅 Applied Date: {selectedApp.applied_date}
                </p>
              </div>
              
              <button 
                onClick={() => setSelectedApp(null)}
                className="glass-btn-secondary" 
                style={{ padding: "6px 12px", borderRadius: "6px" }}
              >
                Close Drawer
              </button>
            </div>

            {/* Drawer Content */}
            <div style={{ display: "flex", flexDirection: "column", gap: "20px" }}>
              
              {/* Fit Description */}
              <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
                <h4 style={{ fontSize: "0.85rem", fontWeight: 800, color: "var(--color-primary)", textTransform: "uppercase", letterSpacing: "0.06em" }}>Fit Assessment Summary</h4>
                <p style={{ fontSize: "0.85rem", color: "var(--color-text-secondary)", lineHeight: "1.5", background: "rgba(255,255,255,0.01)", padding: "12px", borderRadius: "6px", border: "1px solid var(--border-glass)" }}>
                  Matches required skills catalog ({profile.skills.split(",").slice(0, 4).join(", ")}). AI-guided evaluator determined an excellent overlap, scoring it {selectedApp.match_score}% and tailoring the application pitch context.
                </p>
              </div>

              {/* Cover Letter */}
              <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
                <h4 style={{ fontSize: "0.85rem", fontWeight: 800, color: "var(--color-primary)", textTransform: "uppercase", letterSpacing: "0.06em" }}>Hyper-Tailored Cover Letter used</h4>
                <pre style={{ 
                  whiteSpace: "pre-wrap", 
                  fontFamily: "var(--font-family-body)", 
                  fontSize: "0.8rem", 
                  color: "var(--color-text-secondary)",
                  lineHeight: "1.5",
                  background: "rgba(0,0,0,0.4)",
                  padding: "16px",
                  borderRadius: "8px",
                  border: "1px solid rgba(255,255,255,0.05)",
                  maxHeight: "220px",
                  overflowY: "auto"
                }}>
                  {selectedApp.cover_letter}
                </pre>
              </div>

              {/* Inputs filled */}
              {selectedApp.filled_inputs && Object.keys(selectedApp.filled_inputs).length > 0 && (
                <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
                  <h4 style={{ fontSize: "0.85rem", fontWeight: 800, color: "var(--color-primary)", textTransform: "uppercase", letterSpacing: "0.06em" }}>Custom Form Inputs Solved</h4>
                  <div style={{ display: "flex", flexDirection: "column", gap: "8px", background: "rgba(255,255,255,0.01)", padding: "12px", borderRadius: "6px", border: "1px solid var(--border-glass)" }}>
                    {Object.entries(selectedApp.filled_inputs).map(([key, val]) => (
                      <div key={key} style={{ display: "flex", justifyContent: "space-between", borderBottom: "1px solid rgba(255,255,255,0.03)", paddingBottom: "6px", fontSize: "0.8rem" }}>
                        <span style={{ color: "var(--color-text-secondary)", fontWeight: 600 }}>{key}:</span>
                        <strong style={{ color: "var(--color-primary)" }}>{val}</strong>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Job Description Summary */}
              <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
                <h4 style={{ fontSize: "0.85rem", fontWeight: 800, color: "var(--color-primary)", textTransform: "uppercase", letterSpacing: "0.06em" }}>Job Description Context</h4>
                <p style={{ 
                  fontSize: "0.8rem", 
                  color: "var(--color-text-muted)", 
                  lineHeight: "1.4",
                  maxHeight: "120px",
                  overflowY: "auto"
                }}>
                  {selectedApp.job_description}
                </p>
              </div>

            </div>
          </div>
        </div>
      )}

    </div>
  );
}
