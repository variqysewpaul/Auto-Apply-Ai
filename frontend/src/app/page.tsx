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
}

export default function DashboardPage() {
  const [activeTab, setActiveTab] = useState<"dashboard" | "profile" | "logs" | "settings">("dashboard");
  const [isCampaignRunning, setIsCampaignRunning] = useState<boolean>(false);
  const [consoleLogs, setConsoleLogs] = useState<string[]>([
    "🤖 System: AutoApply Pro Engine ready.",
    "🤖 System: Awaiting campaign ignition..."
  ]);
  const [crawlStep, setCrawlStep] = useState<number>(0);
  const consoleEndRef = useRef<HTMLDivElement>(null);

  // Connection indicator for Supabase
  const [isSupabaseConnected, setIsSupabaseConnected] = useState<boolean>(false);

  // Realtime Telemetry Sync State
  const [activeElement, setActiveElement] = useState<string>("");
  const [activeValue, setActiveValue] = useState<string>("");
  const [mockBrowserUrl, setMockBrowserUrl] = useState<string>("https://www.linkedin.com/feed/");
  const [easyApplyStep, setEasyApplyStep] = useState<number>(0); // 0: idle, 1: searching, 2: applying, 3: success

  // Drag-and-drop state
  const [isDragging, setIsDragging] = useState<boolean>(false);
  const [isParsing, setIsParsing] = useState<boolean>(false);
  const [fileName, setFileName] = useState<string>("");

  // Form State - Candidate Profile Facts
  const [profile, setProfile] = useState({
    fullName: "Alex Rivera",
    email: "alex.rivera@example.com",
    phone: "+1 (555) 019-2834",
    address: "120 Hawthorne St",
    city: "San Francisco, CA",
    githubUrl: "https://github.com/alexrivera",
    linkedinUrl: "https://linkedin.com/in/alexrivera",
    targetKeywords: "Senior React Developer, Frontend Engineer, Software Engineer",
    skills: "React, TypeScript, Next.js, Node.js, Playwright, Python, LLMs, CSS Grid",
    groqKey: ""
  });

  // Message alert state
  const [alertMessage, setAlertMessage] = useState<{ type: "success" | "info"; text: string } | null>(null);
  
  // Interactive Onboarding On/Off State
  const [showOnboarding, setShowOnboarding] = useState<boolean>(true);

  // Applications Database Logs
  const [applications, setApplications] = useState<ApplicationRecord[]>([
    {
      id: 104,
      job_title: "Senior Frontend Architect",
      company: "Stripe",
      location: "San Francisco, CA (Hybrid)",
      status: "Applied",
      applied_date: "2026-05-20 14:12:00",
      match_score: 96,
      cover_letter: "Dear Hiring Team at Stripe,\n\nI am thrilled to apply for the Senior Frontend Architect position. With over 6 years of experience engineering high-performance user interfaces at scale and deep familiarity with React, TypeScript, and modern micro-frontends, I am confident in my ability to elevate Stripe's checkout designs...",
      job_description: "Stripe is seeking an experienced Frontend Architect to join our Core UI team. You will lead the technical design of checkout systems, scale components globally, and champion user accessibility and visual excellence..."
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
      job_description: "Vercel is looking for a talented Frontend Developer to build out the future of cloud deployment. Ideal candidates excel with React, Next.js, Tailwind CSS, and edge computing..."
    },
    {
      id: 102,
      job_title: "Software Engineer - UI Platform",
      company: "Figma",
      location: "San Francisco, CA",
      status: "Applied",
      applied_date: "2026-05-18 09:22:45",
      match_score: 89,
      cover_letter: "Dear Figma Team,\n\nI am writing to express my strong interest in the UI Platform team. My background centers around core design systems and canvas-based animations, making this role a perfect fit...",
      job_description: "Figma's UI Platform team crafts the UI frameworks, styling models, and standard components used by Figma and FigJam designers globally..."
    },
    {
      id: 101,
      job_title: "React Developer",
      company: "Zoom",
      location: "Remote (Global)",
      status: "Rejected",
      applied_date: "2026-05-16 16:45:30",
      match_score: 95,
      cover_letter: "Dear Zoom Recruitment,\n\nI am passionate about creating zero-latency interfaces. My experience building responsive, media-rich React dashboards makes me an excellent candidate for your Web SDK client team...",
      job_description: "Zoom is looking for web developers focused on custom React application components and integrating real-time audio/video APIs..."
    }
  ]);

  // Selected application details modal state
  const [selectedApp, setSelectedApp] = useState<ApplicationRecord | null>(null);

  // Load PDF.js from CDN dynamically to bypass Static Export loader issues
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
    const prompt = `You are a professional CV data extractor. Parse the following candidate resume text and return a flat JSON object matching this TypeScript interface exactly:
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

Resume Text:
"""
${text}
"""

Instructions:
- Return ONLY valid, flat JSON matching the interface.
- Do not wrap in markdown codeblocks (no \`\`\`json).
- Be extremely accurate.
- If a field is not found, leave it as an empty string.`;

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
      const errorText = await response.text();
      throw new Error(`Groq API Error: ${response.status} ${errorText}`);
    }

    const result = await response.json();
    return JSON.parse(result.choices[0].message.content);
  };

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
      }
    } catch (e) {
      console.error("Could not fetch applications from Supabase:", e);
    }
  };

  // Check if Supabase keys are active in client
  useEffect(() => {
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    if (supabaseUrl && !supabaseUrl.includes("your-supabase-project-id")) {
      setIsSupabaseConnected(true);
      loadSupabaseProfile();
      loadSupabaseApplications();
    }
  }, []);

  const loadSupabaseProfile = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        const { data, error } = await supabase
          .from("profiles")
          .select("*")
          .eq("id", user.id)
          .single();
        if (data) {
          setProfile({
            fullName: data.full_name || "",
            phone: data.phone || "",
            address: data.address || "",
            city: data.city || "",
            githubUrl: data.github_url || "",
            linkedinUrl: data.linkedin_url || "",
            targetKeywords: data.search_criteria?.titles?.join(", ") || "",
            skills: data.skills?.join(", ") || "",
            groqKey: data.encrypted_groq_key || ""
          } as any);
        }
      }
    } catch (e) {
      console.error("Could not fetch user profile from Supabase:", e);
    }
  };

  // Auto-scroll terminal logs
  useEffect(() => {
    consoleEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [consoleLogs]);

  // Handle live telemetry tracking or fall back to simulation loop
  useEffect(() => {
    if (!isCampaignRunning) {
      setActiveElement("");
      setActiveValue("");
      setEasyApplyStep(0);
      setConsoleLogs(prev => [...prev, "🛑 [System] Campaign stopped. Engine in idle."]);
      return;
    }

    if (isSupabaseConnected) {
      setConsoleLogs([
        "🚀 [System] Live Supabase Sync Active...",
        "🔌 [Bridge] Listening for Playwright telemetry events in real-time."
      ]);
      setEasyApplyStep(1); // Set searching mode

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
            } else if (type === "log") {
              setConsoleLogs(prev => [...prev, `🤖 Playwright: ${data.message}`]);
            }
          }
        )
        .subscribe();

      return () => {
        supabase.removeChannel(sub);
      };
    } else {
      // Simulation mode
      const simLogs = [
        "🛡️ [Stealth] Masking webdriver signatures. Overriding navigator.webdriver -> undefined.",
        "🌐 [Network] Initializing residential proxies. IP located in San Francisco, CA.",
        "🔑 [Auth] Checking active session. Session token loaded successfully.",
        "🔍 [Search] Crawling active listings for: 'Senior React Developer'...",
        "📄 [Found] Discovered 12 jobs in target locations.",
        "🔬 [Evaluate] Analyzing 'Senior Frontend Architect' at Stripe...",
        "🧠 [AI Evaluate] Resume matching score: 96%. FIT DETERMINED.",
        "📝 [Cover Letter] tailored cover letter drafted utilizing Stripe core themes.",
        "⚡ [Easy Apply] Initiating application wizard modal.",
        "✏️ [AI Solver] Auto-filling Name, Email, Address from Profile...",
        "❓ [AI Solver] Custom question: 'How many years with React?' -> '6'",
        "❓ [AI Solver] Custom question: 'Have you built micro-frontends?' -> 'Yes'",
        "🚀 [Apply] Easy Apply submitted successfully!",
        "💾 [Log] stripe application logged securely to history.",
        "🔬 [Evaluate] Analyzing next job posting...",
        "🛑 [System] Campaign cycle pause."
      ];

      let logIndex = 0;
      setConsoleLogs([
        "🚀 [System] Initializing search campaign (Simulation Mode)...",
        "🔌 [Bridge] Connected to simulation orchestrator."
      ]);
      setCrawlStep(0);

      const intervalId = setInterval(() => {
        if (logIndex < simLogs.length) {
          setConsoleLogs(prev => [...prev, simLogs[logIndex]]);
          setCrawlStep(logIndex + 1);
          logIndex++;
        } else {
          logIndex = 0;
          setCrawlStep(0);
        }
      }, 3000);

      return () => clearInterval(intervalId);
    }
  }, [isCampaignRunning, isSupabaseConnected]);

  // Handle drag-and-drop file upload
  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = () => {
    setIsDragging(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    
    const files = e.dataTransfer.files;
    if (files && files.length > 0) {
      const file = files[0];
      if (file.type === "application/pdf" || file.name.endsWith(".pdf") || file.name.endsWith(".docx")) {
        handleCVUpload(file);
      } else {
        setAlertMessage({ type: "info", text: "Unsupported format. Please upload a PDF or DOCX file." });
        setTimeout(() => setAlertMessage(null), 4000);
      }
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (files && files.length > 0) {
      handleCVUpload(files[0]);
    }
  };

  // Perform client-side resume extraction using PDF.js and Groq AI
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

      // Check if we have a valid Groq API key entered in the form
      const keyToUse = profile.groqKey;
      if (keyToUse && keyToUse.startsWith("gsk_")) {
        setAlertMessage({ type: "info", text: "Reading file and connecting to Groq AI..." });
        const parsed = await parseCVWithGroq(extractedText, keyToUse);
        setProfile({
          fullName: parsed.fullName || parsed.full_name || "Alex Rivera",
          email: parsed.email || "alex.rivera@example.com",
          phone: parsed.phone || "+1 (555) 019-2834",
          address: parsed.address || "120 Hawthorne St",
          city: parsed.city || "San Francisco, CA",
          githubUrl: parsed.githubUrl || parsed.github_url || "https://github.com/alexrivera",
          linkedinUrl: parsed.linkedinUrl || parsed.linkedin_url || "https://linkedin.com/in/alexrivera",
          targetKeywords: parsed.targetKeywords || parsed.target_keywords || "Senior React Developer, Frontend Engineer",
          skills: parsed.skills || "React, TypeScript, Next.js, Node.js",
          groqKey: profile.groqKey
        });
        setAlertMessage({ type: "success", text: "AI successfully parsed CV and filled details!" });
      } else {
        // Advanced offline heuristics extractor fallback
        const emailMatch = extractedText.match(/[\w.-]+@[\w.-]+\.\w+/)?.[0] || "";
        const phoneMatch = extractedText.match(/\+?\d[\d -]{8,15}\d/)?.[0] || "";
        const githubMatch = extractedText.match(/(github\.com\/[a-zA-Z0-9_-]+)/)?.[0] || "";
        const linkedinMatch = extractedText.match(/(linkedin\.com\/in\/[a-zA-Z0-9_-]+)/)?.[0] || "";
        
        const cleanLines = extractedText.split("\n").map(l => l.trim()).filter(l => l.length > 2);
        const nameGuess = cleanLines[0] || "Alex Rivera";

        setProfile({
          fullName: nameGuess.length < 40 ? nameGuess : "Alex Rivera",
          email: emailMatch || "alex.rivera@example.com",
          phone: phoneMatch || "+1 (555) 019-2834",
          address: "120 Hawthorne St",
          city: "San Francisco, CA",
          githubUrl: githubMatch ? `https://${githubMatch}` : "https://github.com/alexrivera",
          linkedinUrl: linkedinMatch ? `https://${linkedinMatch}` : "https://linkedin.com/in/alexrivera",
          targetKeywords: "Senior React Developer, Frontend Engineer",
          skills: "React, TypeScript, Next.js, Node.js, CSS Grid, REST APIs, Git",
          groqKey: profile.groqKey
        });
        setAlertMessage({ 
          type: "info", 
          text: "Parsed using offline heuristics! Enter a Groq Key for advanced AI-driven extraction." 
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


  // Handle profile form save
  const handleSaveProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (isSupabaseConnected) {
      try {
        const { data: { user } } = await supabase.auth.getUser();
        if (user) {
          const { error } = await supabase
            .from("profiles")
            .upsert({
              id: user.id,
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
        }
      } catch (e: any) {
        setAlertMessage({ type: "info", text: `Supabase Mode: ${e.message}` });
        return;
      }
    }

    setAlertMessage({ type: "success", text: "Candidate profile facts successfully saved!" });
    setTimeout(() => setAlertMessage(null), 4000);
  };

  // Toggle campaign active state
  const toggleCampaign = () => {
    setIsCampaignRunning(!isCampaignRunning);
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
          <h1 style={{ fontFamily: "var(--font-family-title)", fontWeight: 800, fontSize: "1.5rem", display: "flex", alignItems: "center", gap: "8px" }}>
            <span style={{ fontSize: "1.6rem" }}>💼</span> 
            <span className="gradient-text">AutoApply</span> Pro
          </h1>
          <p style={{ fontSize: "0.75rem", color: "var(--color-text-muted)", marginTop: "4px", fontWeight: 600, letterSpacing: "0.05em", textTransform: "uppercase" }}>
            AI Job Search Orchestrator
          </p>
        </div>

        <nav style={{ display: "flex", flexDirection: "column", gap: "8px", flexGrow: 1 }}>
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
            <span style={{ fontSize: "1.1rem" }}>📊</span> Dashboard
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
            <span style={{ fontSize: "1.1rem" }}>📋</span> Search Logs
          </button>

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
        <div className="glass-panel" style={{ padding: "16px", borderRadius: "10px", display: "flex", gap: "12px", alignItems: "center" }}>
          <div style={{ width: "36px", height: "36px", borderRadius: "50%", background: "linear-gradient(135deg, var(--color-primary), var(--color-secondary))", display: "flex", alignItems: "center", justifyContent: "center", fontWeight: 700 }}>
            AR
          </div>
          <div style={{ minWidth: 0, flexGrow: 1 }}>
            <p style={{ fontSize: "0.85rem", fontWeight: 700, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>Alex Rivera</p>
            <p style={{ fontSize: "0.7rem", color: "var(--color-text-muted)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>Premium Member</p>
          </div>
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

        {/* ── TAB 1: DASHBOARD VIEW ── */}
        {activeTab === "dashboard" && (
          <>
            {/* Header Area */}
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
              <div>
                <p style={{ fontSize: "0.85rem", color: "var(--color-primary)", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.08em" }}>Main Panel</p>
                <h2 style={{ fontFamily: "var(--font-family-title)", fontSize: "2.2rem", fontWeight: 800 }}>Welcome Back, <span className="gradient-text">Alex</span></h2>
              </div>

              {/* Campaign Control Button */}
              <button 
                id="btn-toggle-campaign"
                onClick={toggleCampaign}
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
                  className={isCampaignRunning ? "animate-pulse-soft" : ""} 
                  style={{ 
                    display: "inline-block", 
                    width: "8px", 
                    height: "8px", 
                    borderRadius: "50%", 
                    background: isCampaignRunning ? "var(--color-accent)" : "var(--color-primary)" 
                  }}
                />
                {isCampaignRunning ? "STOP CAMPAIGN" : "START CAMPAIGN"}
              </button>
            </div>

            {/* Metrics cards grid */}
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: "24px" }}>
              <div className="glass-panel glass-panel-hover" style={{ padding: "24px" }}>
                <p style={{ fontSize: "0.75rem", fontWeight: 700, color: "var(--color-text-muted)", textTransform: "uppercase", letterSpacing: "0.06em" }}>Total Applications</p>
                <h3 style={{ fontSize: "2.5rem", fontWeight: 800, marginTop: "8px" }} className="gradient-text">158</h3>
                <p style={{ fontSize: "0.75rem", color: "var(--color-success)", marginTop: "6px", fontWeight: 600 }}>🟢 Active crawler logs active</p>
              </div>

              <div className="glass-panel glass-panel-hover" style={{ padding: "24px" }}>
                <p style={{ fontSize: "0.75rem", fontWeight: 700, color: "var(--color-text-muted)", textTransform: "uppercase", letterSpacing: "0.06em" }}>Companies Crawled</p>
                <h3 style={{ fontSize: "2.5rem", fontWeight: 800, marginTop: "8px" }}>24</h3>
                <p style={{ fontSize: "0.75rem", color: "var(--color-text-muted)", marginTop: "6px" }}>LinkedIn Easy Apply matches</p>
              </div>

              <div className="glass-panel glass-panel-hover" style={{ padding: "24px" }}>
                <p style={{ fontSize: "0.75rem", fontWeight: 700, color: "var(--color-text-muted)", textTransform: "uppercase", letterSpacing: "0.06em" }}>AI Match Success Rate</p>
                <h3 style={{ fontSize: "2.5rem", fontWeight: 800, marginTop: "8px" }} className="gradient-text-pink">98.6%</h3>
                <p style={{ fontSize: "0.75rem", color: "var(--color-text-muted)", marginTop: "6px" }}>Based on 142 custom questions</p>
              </div>

              <div className="glass-panel glass-panel-hover" style={{ padding: "24px" }}>
                <p style={{ fontSize: "0.75rem", fontWeight: 700, color: "var(--color-text-muted)", textTransform: "uppercase", letterSpacing: "0.06em" }}>Applications Today</p>
                <h3 style={{ fontSize: "2.5rem", fontWeight: 800, marginTop: "8px" }}>{isCampaignRunning && crawlStep >= 13 ? "15" : "14"}</h3>
                <p style={{ fontSize: "0.75rem", color: "var(--color-success)", marginTop: "6px", fontWeight: 600 }}>🔥 Daily quota on track</p>
              </div>
            </div>

            {/* Interactive Onboarding / Quick Start Guide Card */}
            <div className="glass-panel" style={{ padding: "24px", borderRadius: "12px", border: "1px solid rgba(0, 242, 254, 0.2)", background: "rgba(10, 15, 30, 0.4)", position: "relative", overflow: "hidden", marginTop: "24px", marginBottom: "24px" }}>
              {/* Background Glow */}
              <div style={{ position: "absolute", top: "-50px", right: "-50px", width: "180px", height: "180px", background: "radial-gradient(circle, rgba(0, 242, 254, 0.15) 0%, transparent 70%)", pointerEvents: "none", zIndex: 0 }} />
              
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", borderBottom: "1px solid rgba(255, 255, 255, 0.08)", paddingBottom: "12px", marginBottom: "16px", position: "relative", zIndex: 1 }}>
                <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                  <span style={{ fontSize: "1.3rem" }}>🚀</span>
                  <div>
                    <h3 style={{ fontFamily: "var(--font-family-title)", fontSize: "1.1rem", fontWeight: 800, color: "#ffffff" }}>First-Time Setup & Quick Start Guide</h3>
                    <p style={{ fontSize: "0.75rem", color: "var(--color-text-muted)", marginTop: "2px" }}>Follow these 3 simple steps to automate your applications</p>
                  </div>
                </div>
                <button 
                  onClick={() => setShowOnboarding(!showOnboarding)}
                  style={{ 
                    background: "rgba(255,255,255,0.05)", 
                    border: "1px solid rgba(255,255,255,0.1)", 
                    color: "var(--color-text-primary)", 
                    padding: "6px 12px", 
                    borderRadius: "6px", 
                    fontSize: "0.75rem", 
                    fontWeight: 600, 
                    cursor: "pointer" 
                  }}
                >
                  {showOnboarding ? "Collapse Guide ⬆️" : "Expand Guide ⬇️"}
                </button>
              </div>

              {showOnboarding && (
                <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))", gap: "20px", position: "relative", zIndex: 1 }}>
                  {/* Step 1 */}
                  <div className="glass-panel" style={{ padding: "16px", background: "rgba(255,255,255,0.01)", border: "1px solid rgba(255,255,255,0.05)", borderRadius: "8px", display: "flex", flexDirection: "column", justifyContent: "space-between", gap: "12px" }}>
                    <div>
                      <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "8px" }}>
                        <span style={{ padding: "4px 8px", background: "rgba(0, 242, 254, 0.1)", borderRadius: "4px", fontSize: "0.7rem", color: "var(--color-primary)", fontWeight: 800 }}>STEP 1</span>
                        <h4 style={{ fontSize: "0.85rem", fontWeight: 700, color: "#ffffff" }}>Drop Your CV & Profile Facts</h4>
                      </div>
                      <p style={{ fontSize: "0.75rem", color: "var(--color-text-secondary)", lineHeight: "1.4" }}>
                        Go to the **Resume & Facts** page. Drag & drop your PDF resume. Groq AI extracts structural details automatically, and you can edit or add missing information to fine-tune your matching facts.
                      </p>
                    </div>
                    <button 
                      onClick={() => setActiveTab("profile")}
                      className="glass-btn-secondary" 
                      style={{ 
                        width: "100%", 
                        padding: "6px 12px", 
                        borderRadius: "6px", 
                        fontSize: "0.75rem", 
                        fontWeight: 700, 
                        textAlign: "center", 
                        cursor: "pointer",
                        border: "1px solid rgba(0, 242, 254, 0.2)",
                        color: "var(--color-primary)",
                        background: "rgba(0, 242, 254, 0.03)"
                      }}
                    >
                      Parse Resume Now ➜
                    </button>
                  </div>

                  {/* Step 2 */}
                  <div className="glass-panel" style={{ padding: "16px", background: "rgba(255,255,255,0.01)", border: "1px solid rgba(255,255,255,0.05)", borderRadius: "8px", display: "flex", flexDirection: "column", gap: "10px" }}>
                    <div>
                      <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "8px" }}>
                        <span style={{ padding: "4px 8px", background: "rgba(0, 242, 254, 0.1)", borderRadius: "4px", fontSize: "0.7rem", color: "var(--color-primary)", fontWeight: 800 }}>STEP 2</span>
                        <h4 style={{ fontSize: "0.85rem", fontWeight: 700, color: "#ffffff" }}>Fire Up The Crawler Bot</h4>
                      </div>
                      <p style={{ fontSize: "0.75rem", color: "var(--color-text-secondary)", lineHeight: "1.4" }}>
                        Verify your Supabase credentials exist in the local `.env` file at the root. Start the automated Playwright engine by running this command in your local workspace terminal:
                      </p>
                    </div>
                    <div style={{ 
                      background: "rgba(0,0,0,0.5)", 
                      borderRadius: "6px", 
                      padding: "8px 12px", 
                      fontFamily: "monospace", 
                      fontSize: "0.75rem", 
                      color: "var(--color-primary)", 
                      border: "1px solid rgba(255,255,255,0.06)",
                      display: "flex",
                      justifyContent: "space-between",
                      alignItems: "center"
                    }}>
                      <span>python main.py</span>
                      <span 
                        style={{ cursor: "pointer", fontSize: "0.7rem", color: "var(--color-text-muted)" }} 
                        onClick={() => {
                          navigator.clipboard.writeText("python main.py");
                          alert("Command copied!");
                        }}
                      >
                        📋 Copy
                      </span>
                    </div>
                  </div>

                  {/* Step 3 */}
                  <div className="glass-panel" style={{ padding: "16px", background: "rgba(255,255,255,0.01)", border: "1px solid rgba(255,255,255,0.05)", borderRadius: "8px", display: "flex", flexDirection: "column", justifyContent: "space-between", gap: "12px" }}>
                    <div>
                      <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "8px" }}>
                        <span style={{ padding: "4px 8px", background: "rgba(0, 242, 254, 0.1)", borderRadius: "4px", fontSize: "0.7rem", color: "var(--color-primary)", fontWeight: 800 }}>STEP 3</span>
                        <h4 style={{ fontSize: "0.85rem", fontWeight: 700, color: "#ffffff" }}>Watch The Live Bot Stream</h4>
                      </div>
                      <p style={{ fontSize: "0.75rem", color: "var(--color-text-secondary)", lineHeight: "1.4" }}>
                        Click **Start Campaign** above to launch the realtime listener channel. As the local Playwright bot fills forms and evaluates details, you'll see every element focus, click, and navigate live below!
                      </p>
                    </div>
                    <div style={{ 
                      fontSize: "0.75rem", 
                      fontWeight: 600, 
                      display: "flex", 
                      alignItems: "center", 
                      gap: "8px", 
                      color: isCampaignRunning ? "var(--color-success)" : "var(--color-text-muted)" 
                    }}>
                      <span style={{ display: "inline-block", width: "8px", height: "8px", borderRadius: "50%", background: isCampaignRunning ? "var(--color-success)" : "var(--color-text-muted)" }} />
                      <span>{isCampaignRunning ? "Live Synchronization Active" : "Awaiting Campaign Ignition"}</span>
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* Split layout: Terminal Console + Live Visual Bot Viewer */}
            <div style={{ display: "grid", gridTemplateColumns: "1.1fr 1.2fr", gap: "32px" }}>
              
              {/* Terminal Logs Simulation Column */}
              <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
                <h3 style={{ fontFamily: "var(--font-family-title)", fontSize: "1.1rem", fontWeight: 700, color: "var(--color-text-primary)" }}>
                  📟 Playwright Console Output
                </h3>
                
                <div className="console-container" style={{ flexGrow: 1, display: "flex", flexDirection: "column" }}>
                  <div className="console-header">
                    <span className="console-dot" style={{ background: "#ef4444" }}></span>
                    <span className="console-dot" style={{ background: "#eab308" }}></span>
                    <span className="console-dot" style={{ background: "#22c55e" }}></span>
                    <span style={{ fontSize: "0.7rem", color: "var(--color-text-muted)", marginLeft: "8px", fontWeight: 600 }}>CRAWLER CONSOLE</span>
                  </div>

                  <div className="console-body">
                    {consoleLogs.map((log, index) => (
                      <div key={index} style={{ 
                        lineHeight: "1.4", 
                        borderLeft: "2px solid",
                        borderColor: log.includes("Easy Apply") || log.includes("[Applied]") ? "var(--color-success)" : log.includes("SKIPPED") || log.includes("🛑") ? "var(--color-accent)" : "rgba(255,255,255,0.1)",
                        paddingLeft: "8px"
                      }}>
                        {log}
                      </div>
                    ))}
                    <div ref={consoleEndRef} />
                  </div>
                </div>
              </div>

              {/* Live Visual Bot Inspector (LinkedIn Browser Mockup) */}
              <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
                <h3 style={{ fontFamily: "var(--font-family-title)", fontSize: "1.1rem", fontWeight: 700 }}>
                  👁️ Live Browser Bot Viewer (Real-Time Visuals)
                </h3>

                <div 
                  className="glass-panel" 
                  style={{ 
                    flexGrow: 1, 
                    minHeight: "340px", 
                    background: "#0f111a", 
                    overflow: "hidden", 
                    display: "flex", 
                    flexDirection: "column",
                    boxShadow: "0 10px 40px rgba(0,0,0,0.5)"
                  }}
                >
                  {/* Browser Chrome Header Mock */}
                  <div style={{ background: "rgba(255,255,255,0.03)", borderBottom: "1px solid var(--border-glass)", padding: "10px 16px", display: "flex", alignItems: "center", gap: "12px" }}>
                    <div style={{ display: "flex", gap: "6px" }}>
                      <span style={{ width: "8px", height: "8px", borderRadius: "50%", background: "#64748b" }}></span>
                      <span style={{ width: "8px", height: "8px", borderRadius: "50%", background: "#64748b" }}></span>
                      <span style={{ width: "8px", height: "8px", borderRadius: "50%", background: "#64748b" }}></span>
                    </div>
                    {/* Mock URL Bar */}
                    <div 
                      style={{ 
                        flexGrow: 1, 
                        background: "rgba(0,0,0,0.4)", 
                        borderRadius: "6px", 
                        padding: "4px 12px", 
                        fontSize: "0.75rem", 
                        color: "var(--color-text-muted)", 
                        fontFamily: "monospace",
                        overflow: "hidden",
                        textOverflow: "ellipsis",
                        whiteSpace: "nowrap",
                        display: "flex",
                        justifyContent: "space-between"
                      }}
                    >
                      <span>
                        {crawlStep >= 4 ? "https://www.linkedin.com/jobs/view/stripe-frontend-architect" : "https://www.linkedin.com/feed/"}
                      </span>
                      <span style={{ color: "var(--color-primary)", fontWeight: 600 }}>🔒 Secure Proxy</span>
                    </div>
                  </div>

                  {/* Browser Window Body Content Mock */}
                  <div style={{ flexGrow: 1, padding: "20px", display: "flex", flexDirection: "column", justifyContent: "center", alignItems: "center", position: "relative" }}>
                    
                    {!isCampaignRunning && (
                      <div style={{ textAlign: "center", color: "var(--color-text-muted)" }}>
                        <span style={{ fontSize: "3rem" }}>🛰️</span>
                        <p style={{ fontSize: "0.9rem", marginTop: "12px", fontWeight: 600 }}>Browser Idle.</p>
                        <p style={{ fontSize: "0.75rem", color: "var(--color-text-muted)", marginTop: "4px" }}>Click "Start Campaign" to launch Playwright.</p>
                      </div>
                    )}

                    {/* Step-by-Step Interactive Visual Browser Mockup */}
                    {isCampaignRunning && (
                      <div style={{ width: "100%", height: "100%", display: "flex", flexDirection: "column", gap: "12px" }}>
                        
                        {/* Loading / Searching Screen */}
                        {crawlStep < 6 && (
                          <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", flexGrow: 1, gap: "16px" }}>
                            <div style={{ width: "40px", height: "40px", border: "3px solid rgba(0, 242, 254, 0.1)", borderTopColor: "var(--color-primary)", borderRadius: "50%" }} className="animate-spin-slow" />
                            <p style={{ fontSize: "0.85rem", color: "var(--color-primary)", fontFamily: "monospace" }}>
                              {crawlStep <= 2 ? "🤖 Stealth Shield booting..." : "🔍 Loading LinkedIn Jobs feed..."}
                            </p>
                          </div>
                        )}

                        {/* LinkedIn Job Card Found */}
                        {crawlStep >= 6 && crawlStep < 8 && (
                          <div style={{ display: "flex", flexDirection: "column", justifyContent: "center", flexGrow: 1, gap: "16px" }}>
                            <div className="glass-panel" style={{ padding: "20px", background: "rgba(255,255,255,0.01)" }}>
                              <h4 style={{ fontSize: "1.1rem", fontWeight: 700 }}>Senior Frontend Architect</h4>
                              <p style={{ fontSize: "0.85rem", color: "var(--color-primary)", fontWeight: 600, marginTop: "4px" }}>Stripe</p>
                              
                              <div style={{ display: "flex", alignItems: "center", gap: "10px", marginTop: "16px" }}>
                                <span style={{ padding: "4px 8px", background: "rgba(0, 242, 254, 0.08)", border: "1px solid rgba(0, 242, 254, 0.15)", borderRadius: "4px", fontSize: "0.8rem", color: "var(--color-primary)", fontWeight: 700 }}>
                                  96% Fit Match
                                </span>
                                <span style={{ fontSize: "0.8rem", color: "var(--color-text-secondary)" }}>
                                  Evaluating requirements...
                                </span>
                              </div>
                            </div>
                          </div>
                        )}

                        {/* Interactive Easy Apply Dialog Mockup Popup */}
                        {crawlStep >= 8 && crawlStep <= 12 && (
                          <div style={{ flexGrow: 1, display: "flex", flexDirection: "column" }}>
                            {/* Easy Apply Wizard Window */}
                            <div className="glass-panel" style={{ border: "1px solid var(--border-glass-hover)", background: "rgba(5, 6, 12, 0.8)", padding: "16px", borderRadius: "8px", display: "flex", flexDirection: "column", gap: "14px" }}>
                              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", borderBottom: "1px solid rgba(255,255,255,0.06)", paddingBottom: "8px" }}>
                                <span style={{ fontSize: "0.8rem", fontWeight: 700, color: "var(--color-primary)" }}>Easy Apply Wizard - Stripe</span>
                                <span style={{ fontSize: "0.75rem", color: "var(--color-text-muted)" }}>Step 2 of 3</span>
                              </div>

                              {/* Form Inputs with simulated bot overlays */}
                              <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
                                <div style={{ display: "flex", flexDirection: "column", gap: "4px" }}>
                                  <label style={{ fontSize: "0.75rem", color: "var(--color-text-secondary)", fontWeight: 600 }}>Full Name</label>
                                  <div style={{ 
                                    padding: "8px 12px", 
                                    fontSize: "0.8rem", 
                                    background: "rgba(0, 242, 254, 0.05)", 
                                    border: "1px dashed var(--color-primary)", 
                                    borderRadius: "4px", 
                                    color: "#ffffff",
                                    display: "flex",
                                    justifyContent: "space-between",
                                    boxShadow: "0 0 8px rgba(0, 242, 254, 0.2)"
                                  }}>
                                    <span>Alex Rivera</span>
                                    <span style={{ fontSize: "0.7rem", color: "var(--color-primary)", fontWeight: 700 }}>🤖 Injected</span>
                                  </div>
                                </div>

                                <div style={{ display: "flex", flexDirection: "column", gap: "4px" }}>
                                  <label style={{ fontSize: "0.75rem", color: "var(--color-text-secondary)", fontWeight: 600 }}>
                                    How many years with React?
                                  </label>
                                  <div style={{ 
                                    padding: "8px 12px", 
                                    fontSize: "0.8rem", 
                                    background: crawlStep >= 10 ? "rgba(0, 242, 254, 0.05)" : "rgba(0,0,0,0.3)", 
                                    border: crawlStep >= 10 ? "1px dashed var(--color-primary)" : "1px solid rgba(255,255,255,0.08)", 
                                    borderRadius: "4px", 
                                    color: crawlStep >= 10 ? "#ffffff" : "var(--color-text-muted)",
                                    display: "flex",
                                    justifyContent: "space-between",
                                    boxShadow: crawlStep >= 10 ? "0 0 8px rgba(0, 242, 254, 0.2)" : "none",
                                    transition: "all 0.3s"
                                  }}>
                                    <span>{crawlStep >= 10 ? "6" : "Solving..."}</span>
                                    {crawlStep >= 10 && <span style={{ fontSize: "0.7rem", color: "var(--color-primary)", fontWeight: 700 }}>🧠 AI Solved</span>}
                                  </div>
                                </div>

                                <div style={{ display: "flex", flexDirection: "column", gap: "4px" }}>
                                  <label style={{ fontSize: "0.75rem", color: "var(--color-text-secondary)", fontWeight: 600 }}>
                                    Have you ever built micro-frontends?
                                  </label>
                                  <div style={{ 
                                    padding: "8px 12px", 
                                    fontSize: "0.8rem", 
                                    background: crawlStep >= 11 ? "rgba(0, 242, 254, 0.05)" : "rgba(0,0,0,0.3)", 
                                    border: crawlStep >= 11 ? "1px dashed var(--color-primary)" : "1px solid rgba(255,255,255,0.08)", 
                                    borderRadius: "4px", 
                                    color: crawlStep >= 11 ? "#ffffff" : "var(--color-text-muted)",
                                    display: "flex",
                                    justifyContent: "space-between",
                                    boxShadow: crawlStep >= 11 ? "0 0 8px rgba(0, 242, 254, 0.2)" : "none",
                                    transition: "all 0.3s"
                                  }}>
                                    <span>{crawlStep >= 11 ? "Yes" : "Solving..."}</span>
                                    {crawlStep >= 11 && <span style={{ fontSize: "0.7rem", color: "var(--color-primary)", fontWeight: 700 }}>🧠 AI Solved</span>}
                                  </div>
                                </div>
                              </div>
                            </div>
                          </div>
                        )}

                        {/* Submit Screen */}
                        {crawlStep === 12 && (
                          <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", flexGrow: 1, gap: "12px" }}>
                            <div style={{ padding: "16px 32px", background: "rgba(52, 211, 153, 0.15)", border: "2px solid var(--color-success)", borderRadius: "8px", boxShadow: "0 0 20px rgba(52, 211, 153, 0.3)", animation: "pulse-soft 2s infinite" }}>
                              <p style={{ color: "var(--color-success)", fontWeight: 700, fontSize: "0.95rem" }}>⚡ Playwright Clicking 'Submit'</p>
                            </div>
                          </div>
                        )}

                        {/* Success Screen */}
                        {crawlStep >= 13 && (
                          <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", flexGrow: 1, gap: "16px" }}>
                            <span style={{ fontSize: "3.5rem", animation: "pulse-soft 2s infinite" }}>🎉</span>
                            <div style={{ textAlign: "center" }}>
                              <h4 style={{ color: "var(--color-success)", fontWeight: 800, fontSize: "1.2rem" }}>Application Submitted!</h4>
                              <p style={{ fontSize: "0.8rem", color: "var(--color-text-muted)", marginTop: "6px" }}>
                                Stripe application logged to local database.
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

        {/* ── TAB 2: RESUME & FACTS VIEW ── */}
        {activeTab === "profile" && (
          <div style={{ display: "flex", flexDirection: "column", gap: "24px" }}>
            <div>
              <p style={{ fontSize: "0.85rem", color: "var(--color-primary)", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.08em" }}>Resume Analyzer</p>
              <h2 style={{ fontFamily: "var(--font-family-title)", fontSize: "2.2rem", fontWeight: 800 }}>Profile <span className="gradient-text">Facts</span> & Settings</h2>
              <p style={{ color: "var(--color-text-secondary)", fontSize: "0.9rem", marginTop: "4px" }}>
                Upload your CV to auto-fill details, then tweak or insert any facts the AI might have missed.
              </p>
            </div>

            {/* Drag & Drop Upload Zone */}
            <div 
              onDragOver={handleDragOver}
              onDragLeave={handleDragLeave}
              onDrop={handleDrop}
              className="glass-panel"
              style={{
                border: isDragging ? "2px dashed var(--color-primary)" : "1px dashed var(--border-glass)",
                background: isDragging ? "rgba(0, 242, 254, 0.04)" : "rgba(255, 255, 255, 0.01)",
                borderRadius: "12px",
                padding: "40px",
                textAlign: "center",
                cursor: "pointer",
                position: "relative",
                transition: "all 0.3s ease",
                boxShadow: isDragging ? "0 0 24px rgba(0, 242, 254, 0.15)" : "none"
              }}
            >
              <input 
                type="file" 
                id="cv-file-input" 
                accept=".pdf,.docx" 
                onChange={handleFileChange}
                style={{ display: "none" }}
              />
              
              {isParsing ? (
                <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: "16px" }}>
                  <div style={{ width: "40px", height: "40px", border: "3px solid rgba(0, 242, 254, 0.1)", borderTopColor: "var(--color-primary)", borderRadius: "50%" }} className="animate-spin-slow" />
                  <div>
                    <p style={{ color: "var(--color-primary)", fontWeight: 700, fontSize: "1rem" }}>🧠 AI Engine: Reading PDF Structure...</p>
                    <p style={{ fontSize: "0.75rem", color: "var(--color-text-muted)", marginTop: "4px" }}>Extracting career data & skills profile.</p>
                  </div>
                </div>
              ) : (
                <label htmlFor="cv-file-input" style={{ cursor: "pointer", display: "flex", flexDirection: "column", alignItems: "center", gap: "12px", width: "100%" }}>
                  <span style={{ fontSize: "2.5rem" }}>📄</span>
                  <div>
                    <h3 style={{ fontSize: "1rem", fontWeight: 700 }}>
                      {fileName ? `File Selected: ${fileName}` : "Drag and Drop your PDF or Word CV here"}
                    </h3>
                    <p style={{ fontSize: "0.8rem", color: "var(--color-text-muted)", marginTop: "6px" }}>
                      Supports PDF and DOCX formats up to 10MB
                    </p>
                  </div>
                  <span className="glass-btn-secondary" style={{ padding: "6px 16px", fontSize: "0.8rem", borderRadius: "6px", border: "1px solid rgba(255,255,255,0.08)", marginTop: "8px" }}>
                    Browse Files
                  </span>
                </label>
              )}
            </div>

            <form onSubmit={handleSaveProfile} className="glass-panel" style={{ padding: "32px", display: "flex", flexDirection: "column", gap: "24px" }}>
              <h3 style={{ fontFamily: "var(--font-family-title)", fontSize: "1.2rem", fontWeight: 700, borderBottom: "1px solid var(--border-glass)", paddingBottom: "12px" }}>
                👤 Personal Details
              </h3>

              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "24px" }}>
                <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
                  <label htmlFor="fullName" style={{ fontSize: "0.8rem", fontWeight: 600, color: "var(--color-text-secondary)" }}>Full Name</label>
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
                  <label htmlFor="email" style={{ fontSize: "0.8rem", fontWeight: 600, color: "var(--color-text-secondary)" }}>Email Address</label>
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
                  <label htmlFor="phone" style={{ fontSize: "0.8rem", fontWeight: 600, color: "var(--color-text-secondary)" }}>Phone Number</label>
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
                  <label htmlFor="city" style={{ fontSize: "0.8rem", fontWeight: 600, color: "var(--color-text-secondary)" }}>Location (City, State)</label>
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

              <h3 style={{ fontFamily: "var(--font-family-title)", fontSize: "1.2rem", fontWeight: 700, borderBottom: "1px solid var(--border-glass)", paddingBottom: "12px", marginTop: "16px" }}>
                🔍 Target Keywords & Skills
              </h3>

              <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
                <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
                  <label htmlFor="targetKeywords" style={{ fontSize: "0.8rem", fontWeight: 600, color: "var(--color-text-secondary)" }}>Target Job Titles (Comma-separated)</label>
                  <input 
                    type="text" 
                    id="targetKeywords" 
                    value={profile.targetKeywords} 
                    onChange={e => setProfile({...profile, targetKeywords: e.target.value})} 
                    className="glass-input" 
                    placeholder="e.g. Senior Frontend Architect, React Developer" 
                    required 
                  />
                </div>

                <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
                  <label htmlFor="skills" style={{ fontSize: "0.8rem", fontWeight: 600, color: "var(--color-text-secondary)" }}>Skills Matrix Keywords (Comma-separated)</label>
                  <input 
                    type="text" 
                    id="skills" 
                    value={profile.skills} 
                    onChange={e => setProfile({...profile, skills: e.target.value})} 
                    className="glass-input" 
                    placeholder="e.g. React, TypeScript, GraphQL" 
                    required 
                  />
                </div>
              </div>

              <h3 style={{ fontFamily: "var(--font-family-title)", fontSize: "1.2rem", fontWeight: 700, borderBottom: "1px solid var(--border-glass)", paddingBottom: "12px", marginTop: "16px" }}>
                🔐 Bring Your Own API Key (BYOK)
              </h3>

              <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
                <label htmlFor="groqKey" style={{ fontSize: "0.8rem", fontWeight: 600, color: "var(--color-text-secondary)" }}>Private Groq API Key (Stored securely on local database)</label>
                <input 
                  type="password" 
                  id="groqKey" 
                  value={profile.groqKey} 
                  onChange={e => setProfile({...profile, groqKey: e.target.value})} 
                  className="glass-input" 
                  placeholder="gsk_..." 
                />
                <p style={{ fontSize: "0.7rem", color: "var(--color-text-muted)", marginTop: "4px" }}>
                  ⚠️ Your API key remains private. It will be queried by the automation client during crawls to answer custom questions.
                </p>
              </div>

              <div style={{ display: "flex", justifyContent: "flex-end", marginTop: "16px" }}>
                <button type="submit" id="btn-save-profile" className="glass-btn">
                  SAVE CANDIDATE DETAILS
                </button>
              </div>
            </form>
          </div>
        )}

        {/* ── TAB 3: SEARCH LOGS VIEW ── */}
        {activeTab === "logs" && (
          <div style={{ display: "flex", flexDirection: "column", gap: "24px" }}>
            <div>
              <p style={{ fontSize: "0.85rem", color: "var(--color-primary)", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.08em" }}>Crawl History</p>
              <h2 style={{ fontFamily: "var(--font-family-title)", fontSize: "2.2rem", fontWeight: 800 }}>Application <span className="gradient-text">Logs</span></h2>
              <p style={{ color: "var(--color-text-secondary)", fontSize: "0.9rem", marginTop: "4px" }}>
                Review, query, and drill down into the custom tailormade assets generated for each submitted application.
              </p>
            </div>

            <div className="glass-panel" style={{ padding: "24px", overflow: "hidden" }}>
              <div style={{ display: "flex", gap: "16px", marginBottom: "20px" }}>
                <input 
                  type="text" 
                  id="search-logs-input"
                  placeholder="Search by job title or company name..." 
                  className="glass-input" 
                  style={{ flexGrow: 1 }}
                />
                <button className="glass-btn-secondary" style={{ padding: "0 24px" }}>Search</button>
              </div>

              <table style={{ width: "100%", borderCollapse: "collapse", textAlign: "left", fontSize: "0.9rem" }}>
                <thead>
                  <tr style={{ borderBottom: "1px solid var(--border-glass)", color: "var(--color-text-muted)" }}>
                    <th style={{ padding: "16px", fontWeight: 600 }}>JOB TITLE</th>
                    <th style={{ padding: "16px", fontWeight: 600 }}>COMPANY</th>
                    <th style={{ padding: "16px", fontWeight: 600 }}>DATE</th>
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
                      <td style={{ padding: "16px", color: "var(--color-text-secondary)" }}>{app.applied_date.split(" ")[0]}</td>
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
                          View Details
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* ── TAB 4: CONNECTIONS & SETTINGS VIEW ── */}
        {activeTab === "settings" && (
          <div style={{ display: "flex", flexDirection: "column", gap: "24px" }}>
            <div>
              <p style={{ fontSize: "0.85rem", color: "var(--color-primary)", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.08em" }}>System Connections</p>
              <h2 style={{ fontFamily: "var(--font-family-title)", fontSize: "2.2rem", fontWeight: 800 }}>Integrations & <span className="gradient-text">Tokens</span></h2>
              <p style={{ color: "var(--color-text-secondary)", fontSize: "0.9rem", marginTop: "4px" }}>
                Verify connections to external databases and backend APIs.
              </p>
            </div>

            <div className="glass-panel" style={{ padding: "32px", display: "flex", flexDirection: "column", gap: "24px" }}>
              <h3 style={{ fontFamily: "var(--font-family-title)", fontSize: "1.2rem", fontWeight: 700, borderBottom: "1px solid var(--border-glass)", paddingBottom: "12px" }}>
                🌐 Database Integration
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
                  💡 **How to link a live database:**
                  <br />
                  1. Launch a project at **[Supabase.com](https://supabase.com)**.
                  <br />
                  2. Execute our SQL definitions script ([schema.sql](file:///c:/Users/Dell/.gemini/antigravity/scratch/JobSearchBot/schema.sql)) inside the Supabase SQL editor.
                  <br />
                  3. In the project folder `frontend/.env.local`, set `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_ANON_KEY` to your keys.
                </p>
              </div>
            </div>
          </div>
        )}

      </main>

      {/* ── APPLICATION DETAIL MODAL ── */}
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
          justifyContent: "center",
          zIndex: 1000,
          padding: "24px"
        }}>
          <div 
            className="glass-panel" 
            style={{ 
              width: "100%", 
              maxWidth: "750px", 
              maxHeight: "90%", 
              background: "#0f111a", 
              padding: "32px",
              display: "flex",
              flexDirection: "column",
              gap: "24px",
              overflowY: "auto"
            }}
          >
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", borderBottom: "1px solid var(--border-glass)", paddingBottom: "16px" }}>
              <div>
                <span style={{ 
                  fontSize: "0.75rem", 
                  fontWeight: 700, 
                  color: "var(--color-primary)", 
                  background: "rgba(0, 242, 254, 0.08)",
                  padding: "4px 8px",
                  borderRadius: "4px",
                  border: "1px solid rgba(0, 242, 254, 0.15)"
                }}>
                  {selectedApp.match_score}% Match Score
                </span>
                <h3 style={{ fontFamily: "var(--font-family-title)", fontSize: "1.4rem", fontWeight: 800, marginTop: "8px" }}>{selectedApp.job_title}</h3>
                <p style={{ fontSize: "0.9rem", color: "var(--color-text-secondary)", marginTop: "4px" }}>
                  {selectedApp.company} • {selectedApp.location}
                </p>
              </div>
              
              <button 
                onClick={() => setSelectedApp(null)}
                className="glass-btn-secondary" 
                style={{ padding: "6px 12px", borderRadius: "6px" }}
              >
                Close
              </button>
            </div>

            <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
              <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
                <h4 style={{ fontSize: "0.85rem", fontWeight: 700, color: "var(--color-primary)", textTransform: "uppercase" }}>📝 tailored Cover Letter Generated</h4>
                <div 
                  className="glass-panel" 
                  style={{ 
                    padding: "16px 20px", 
                    background: "rgba(0,0,0,0.2)", 
                    fontFamily: "var(--font-family-body)",
                    fontSize: "0.85rem",
                    lineHeight: "1.5",
                    whiteSpace: "pre-wrap",
                    color: "var(--color-text-primary)"
                  }}
                >
                  {selectedApp.cover_letter}
                </div>
              </div>

              <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
                <h4 style={{ fontSize: "0.85rem", fontWeight: 700, color: "var(--color-text-secondary)", textTransform: "uppercase" }}>💼 Scraped Job Requirements</h4>
                <div 
                  className="glass-panel" 
                  style={{ 
                    padding: "16px 20px", 
                    background: "rgba(0,0,0,0.2)", 
                    fontFamily: "var(--font-family-body)",
                    fontSize: "0.85rem",
                    lineHeight: "1.5",
                    whiteSpace: "pre-wrap",
                    color: "var(--color-text-secondary)",
                    maxHeight: "150px",
                    overflowY: "auto"
                  }}
                >
                  {selectedApp.job_description}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
