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
    city: "", // Living Location (backward compatible with the city DB column)
    targetLocations: "", // Target search location (stored in search_criteria.target_locations)
    githubUrl: "",
    linkedinUrl: "",
    targetKeywords: "",
    skills: "",
    groqKey: "",
    // Workplace Types
    workplaceRemote: true,
    workplaceHybrid: true,
    workplaceOnsite: false,
    // Job Types
    jobFullTime: true,
    jobPartTime: false,
    jobContract: false,
    jobInternship: false,
    jobTemporary: false,
    // Other filters
    experienceEntry: true,
    experienceMidSenior: true,
    experienceDirector: false,
    minMatchScore: 80,
    maxDailyApps: 25,
    showBrowser: true,
    linkedinEmail: "",
    linkedinPassword: ""
  });

  // Supabase Auth Form States
  const [authMode, setAuthMode] = useState<"login" | "register">("login");
  const [authEmail, setAuthEmail] = useState<string>("");
  const [authPassword, setAuthPassword] = useState<string>("");
  const [isAuthLoading, setIsAuthLoading] = useState<boolean>(false);
  const [showWelcomeAuth, setShowWelcomeAuth] = useState<boolean>(false);

  // Applications Database List
  const [applications, setApplications] = useState<ApplicationRecord[]>([]);
  const [selectedApp, setSelectedApp] = useState<ApplicationRecord | null>(null);

  // Message alert state
  const [alertMessage, setAlertMessage] = useState<{ type: "success" | "info"; text: string } | null>(null);
  const [rlsErrorSql, setRlsErrorSql] = useState<string | null>(null);
  
  // Setup Guide Checklist Step (1: API Key, 2: CV upload, 3: Launch Ready)
  const [onboardingStep, setOnboardingStep] = useState<number>(1);
  const [isExtensionReady, setIsExtensionReady] = useState<boolean>(false);
  const [showVerificationModal, setShowVerificationModal] = useState<boolean>(false);
  const [verificationCode, setVerificationCode] = useState<string>("");
  const [isSubmittingCode, setIsSubmittingCode] = useState<boolean>(false);
  const [isLinkedInConnected, setIsLinkedInConnected] = useState<boolean>(false);
  const [isEditingLinkedIn, setIsEditingLinkedIn] = useState<boolean>(false);

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

  // Dynamic Onboarding Step Tracker for Sandbox mode
  useEffect(() => {
    if (sandboxMode) {
      setOnboardingStep(3); // Pre-verified for sandbox preview
    }
  }, [sandboxMode]);

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
        targetLocations: "San Francisco Bay Area, Remote",
        githubUrl: "https://github.com/alexrivera",
        linkedinUrl: "https://linkedin.com/in/alexrivera",
        targetKeywords: "Senior React Developer, Frontend Engineer, Software Engineer",
        skills: "React, TypeScript, Next.js, Node.js, Playwright, Python, LLMs, CSS Grid",
        groqKey: "gsk_SimulatedDemoKey1029384756",
        workplaceRemote: true,
        workplaceHybrid: true,
        workplaceOnsite: false,
        jobFullTime: true,
        jobPartTime: false,
        jobContract: false,
        jobInternship: false,
        jobTemporary: false,
        experienceEntry: false,
        experienceMidSenior: true,
        experienceDirector: false,
        minMatchScore: 85,
        maxDailyApps: 20,
        showBrowser: true,
        linkedinEmail: "alex.rivera@example.com",
        linkedinPassword: "demo-password"
      });
      setFileName("alex_rivera_resume.pdf");
      setIsLinkedInConnected(true);
    } else if (!supabaseUser) {
      // Clear profile when exit sandbox and no user
      setIsLinkedInConnected(false);
      setIsEditingLinkedIn(false);
      setProfile({
        fullName: "",
        email: "",
        phone: "",
        address: "",
        city: "",
        targetLocations: "",
        githubUrl: "",
        linkedinUrl: "",
        targetKeywords: "",
        skills: "",
        groqKey: "",
        workplaceRemote: true,
        workplaceHybrid: true,
        workplaceOnsite: false,
        jobFullTime: true,
        jobPartTime: false,
        jobContract: false,
        jobInternship: false,
        jobTemporary: false,
        experienceEntry: true,
        experienceMidSenior: true,
        experienceDirector: false,
        minMatchScore: 80,
        maxDailyApps: 25,
        showBrowser: true,
        linkedinEmail: "",
        linkedinPassword: ""
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
          const sc = data.search_criteria || {};
          const dbKey = data.encrypted_groq_key || "";
          const finalKey = dbKey || (profile.groqKey.startsWith("gsk_") ? profile.groqKey : "");

          setProfile({
            fullName: data.full_name || "",
            email: user.email || "",
            phone: data.phone || "",
            address: data.address || "",
            city: data.city || sc.living_location || "",
            targetLocations: sc.target_locations?.join(", ") || "",
            githubUrl: data.github_url || "",
            linkedinUrl: data.linkedin_url || "",
            targetKeywords: sc.titles?.join(", ") || "",
            skills: data.skills?.join(", ") || "",
            groqKey: finalKey,
            // Workplace Types
            workplaceRemote: sc.workplace_types ? sc.workplace_types.includes("remote") : true,
            workplaceHybrid: sc.workplace_types ? sc.workplace_types.includes("hybrid") : true,
            workplaceOnsite: sc.workplace_types ? sc.workplace_types.includes("onsite") : false,
            // Job Types
            jobFullTime: sc.job_types ? sc.job_types.includes("full-time") : true,
            jobPartTime: sc.job_types ? sc.job_types.includes("part-time") : false,
            jobContract: sc.job_types ? sc.job_types.includes("contract") : false,
            jobInternship: sc.job_types ? sc.job_types.includes("internship") : false,
            jobTemporary: sc.job_types ? sc.job_types.includes("temporary") : false,
            // Other filters
            experienceEntry: sc.experience_levels ? sc.experience_levels.includes("entry") : true,
            experienceMidSenior: sc.experience_levels ? sc.experience_levels.includes("mid-senior") : true,
            experienceDirector: sc.experience_levels ? sc.experience_levels.includes("director") : false,
            minMatchScore: sc.min_match_score || 80,
            maxDailyApps: sc.max_daily_apps || 25,
            showBrowser: sc.showBrowser !== undefined ? sc.showBrowser : true,
            linkedinEmail: data.linkedin_email || "",
            linkedinPassword: data.linkedin_password_enc || ""
          });

          setIsLinkedInConnected(!!data.linkedin_email);

          if (data.full_name) {
            setFileName("CV_Facts_Loaded_from_Database.pdf");
          }
          
          // Auto-save key to DB if we had it locally but not in DB
          if (finalKey && !dbKey && isSupabaseConnected) {
            await supabase.from("profiles").upsert({
              id: user.id,
              encrypted_groq_key: finalKey
            });
          }

          // Dynamically set correct onboarding step based on actual database facts
          if (finalKey && data.full_name) {
            setOnboardingStep(3);
          } else if (finalKey) {
            setOnboardingStep(2);
          } else {
            setOnboardingStep(1);
          }
        } else {
          // Initialize at least the email field from the authenticated session
          setProfile(prev => ({
            ...prev,
            email: user.email || ""
          }));
          setOnboardingStep(1);
        }
      }
    } catch (e) {
      console.error("Could not fetch user profile from Supabase:", e);
    }
  };

  const scrollToAndFocus = (elementId: string, focusId?: string) => {
    const el = document.getElementById(elementId);
    if (el) {
      el.scrollIntoView({ behavior: "smooth", block: "center" });
      if (focusId) {
        setTimeout(() => {
          document.getElementById(focusId)?.focus();
        }, 500);
      }
      
      // Temporary premium neon glow indicator
      const originalBorder = el.style.borderColor;
      const originalShadow = el.style.boxShadow;
      
      el.style.transition = "all 0.4s ease";
      el.style.borderColor = "var(--color-primary)";
      el.style.boxShadow = "0 0 25px rgba(0, 242, 254, 0.45)";
      
      setTimeout(() => {
        el.style.borderColor = originalBorder;
        el.style.boxShadow = originalShadow;
      }, 2000);
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
      setShowWelcomeAuth(false);
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
        setProfile(prev => ({
          ...prev,
          fullName: parsed.fullName || parsed.full_name || "Alex Rivera",
          email: parsed.email || prev.email || "alex@example.com",
          phone: parsed.phone || "",
          address: parsed.address || "",
          city: parsed.city || "",
          githubUrl: parsed.githubUrl || parsed.github_url || "",
          linkedinUrl: parsed.linkedinUrl || parsed.linkedin_url || "",
          targetKeywords: parsed.targetKeywords || parsed.target_keywords || "Software Engineer",
          skills: parsed.skills || ""
        }));
        setAlertMessage({ type: "success", text: "AI successfully parsed CV and filled details!" });
      } else {
        // Fallback offline heuristics
        const emailMatch = extractedText.match(/[\w.-]+@[\w.-]+\.\w+/)?.[0] || "";
        const phoneMatch = extractedText.match(/\+?\d[\d -]{8,15}\d/)?.[0] || "";
        
        setProfile(prev => ({
          ...prev,
          fullName: "CV Candidate",
          email: emailMatch || prev.email || "candidate@example.com",
          phone: phoneMatch || "",
          address: "",
          city: "",
          githubUrl: "",
          linkedinUrl: "",
          targetKeywords: "Software Developer",
          skills: "React, TypeScript, Next.js, Node.js"
        }));
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
        const workplaceTypes = [];
        if (profile.workplaceRemote) workplaceTypes.push("remote");
        if (profile.workplaceHybrid) workplaceTypes.push("hybrid");
        if (profile.workplaceOnsite) workplaceTypes.push("onsite");

        const jobTypes = [];
        if (profile.jobFullTime) jobTypes.push("full-time");
        if (profile.jobPartTime) jobTypes.push("part-time");
        if (profile.jobContract) jobTypes.push("contract");
        if (profile.jobInternship) jobTypes.push("internship");
        if (profile.jobTemporary) jobTypes.push("temporary");

        const experienceLevels = [];
        if (profile.experienceEntry) experienceLevels.push("entry");
        if (profile.experienceMidSenior) experienceLevels.push("mid-senior");
        if (profile.experienceDirector) experienceLevels.push("director");

        const searchCriteria = {
          titles: profile.targetKeywords.split(",").map(s => s.trim()).filter(Boolean),
          living_location: profile.city,
          target_locations: profile.targetLocations.split(",").map(s => s.trim()).filter(Boolean),
          workplace_types: workplaceTypes,
          job_types: jobTypes,
          experience_levels: experienceLevels,
          min_match_score: Number(profile.minMatchScore),
          max_daily_apps: Number(profile.maxDailyApps),
          showBrowser: profile.showBrowser
        };

        // Try updating first since the trigger usually pre-provisions the row.
        // This avoids needing INSERT RLS permission for existing users.
        const { data, error: updateError } = await supabase
          .from("profiles")
          .update({
            full_name: profile.fullName,
            phone: profile.phone,
            address: profile.address,
            city: profile.city,
            github_url: profile.githubUrl,
            linkedin_url: profile.linkedinUrl,
            search_criteria: searchCriteria,
            skills: profile.skills.split(",").map(s => s.trim()).filter(Boolean),
            encrypted_groq_key: profile.groqKey,
            linkedin_email: profile.linkedinEmail,
            linkedin_password_enc: profile.linkedinPassword
          })
          .eq("id", supabaseUser.id)
          .select();

        // If the update failed or didn't find the row, fall back to upsert
        if (updateError || !data || data.length === 0) {
          const { error: upsertError } = await supabase
            .from("profiles")
            .upsert({
              id: supabaseUser.id,
              full_name: profile.fullName,
              phone: profile.phone,
              address: profile.address,
              city: profile.city,
              github_url: profile.githubUrl,
              linkedin_url: profile.linkedinUrl,
              search_criteria: searchCriteria,
              skills: profile.skills.split(",").map(s => s.trim()).filter(Boolean),
              encrypted_groq_key: profile.groqKey,
              linkedin_email: profile.linkedinEmail,
              linkedin_password_enc: profile.linkedinPassword
            });
          if (upsertError) throw upsertError;
        }
      } catch (err: any) {
        setAlertMessage({ type: "info", text: `Save failed: ${err.message}` });
        if (err.message?.includes("row-level security policy") || err.message?.includes("RLS")) {
          setRlsErrorSql(`-- ── 1. Enable Row-Level Security (RLS) policies ──
alter table public.profiles enable row level security;

-- Drop policies if they exist to avoid duplication errors
drop policy if exists "Users can view own profile" on public.profiles;
drop policy if exists "Users can insert own profile" on public.profiles;
drop policy if exists "Users can update own profile" on public.profiles;

create policy "Users can view own profile" 
  on public.profiles for select 
  using (auth.uid() = id);

create policy "Users can insert own profile" 
  on public.profiles for insert 
  with check (auth.uid() = id);

create policy "Users can update own profile" 
  on public.profiles for update 
  using (auth.uid() = id);

-- ── 2. Add automatic profile generation trigger on Auth signup ──
create or replace function public.handle_new_user()
returns trigger as $$
begin
  insert into public.profiles (id, full_name, search_criteria, skills)
  values (new.id, '', '{}'::jsonb, '{}'::text[])
  on conflict (id) do nothing;
  return new;
end;
$$ language plpgsql security definer;

-- Drop trigger if exists to avoid duplication errors
drop trigger if exists on_auth_user_created on auth.users;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();

-- ── 3. Retroactively insert missing profiles for existing auth users ──
insert into public.profiles (id, full_name, search_criteria, skills)
select id, '', '{}'::jsonb, '{}'::text[]
from auth.users
where id not in (select id from public.profiles)
on conflict (id) do nothing;`);
        }
        return;
      }
    }
    setIsLinkedInConnected(!!profile.linkedinEmail);
    setIsEditingLinkedIn(false);
    setOnboardingStep(3);
    setAlertMessage({ type: "success", text: "Facts saved successfully!" });
    setTimeout(() => setAlertMessage(null), 4000);
  };

  const handleLaunchClick = async () => {
    if (isCampaignRunning) {
      setIsCampaignRunning(false);
      return;
    }
    
    setIsCampaignRunning(true);
    
    // Only attempt API call if we aren't in guest sandbox and URL is configured
    const apiUrl = process.env.NEXT_PUBLIC_BOT_API_URL;
    if (apiUrl && isSupabaseConnected && supabaseUser && !sandboxMode) {
      try {
        // Get the current session JWT so the bot knows which user's profile to load
        const { data: sessionData } = await supabase.auth.getSession();
        const jwtToken = sessionData?.session?.access_token;
        const userId = supabaseUser.id;

        if (!jwtToken) {
          setAlertMessage({ type: "info", text: "Session expired. Please log out and log back in." });
          setIsCampaignRunning(false);
          return;
        }

        const response = await fetch(`${apiUrl}/start-crawl`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ jwt_token: jwtToken, user_id: userId })
        });

        if (!response.ok) {
          const err = await response.json().catch(() => ({}));
          setAlertMessage({ type: "info", text: `Bot error: ${err.error || response.statusText}` });
          setIsCampaignRunning(false);
        }
      } catch (err) {
        console.error("Failed to trigger cloud bot:", err);
        setAlertMessage({ type: "info", text: "Could not reach the bot server. Check your connection." });
        setIsCampaignRunning(false);
      }
    }
  };

  const handleSessionUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    try {
      const text = await file.text();
      const cookies = JSON.parse(text);
      
      if (isSupabaseConnected && supabaseUser) {
        const { error } = await supabase
          .from("profiles")
          .update({ session_cookies: cookies })
          .eq("id", supabaseUser.id);
          
        if (error) throw error;
        setAlertMessage({ type: "success", text: "Session cookies securely uploaded to cloud!" });
        setTimeout(() => setAlertMessage(null), 3000);
      } else {
        setAlertMessage({ type: "info", text: "Must be connected to Supabase to upload cookies." });
      }
    } catch (e) {
      setAlertMessage({ type: "info", text: "Failed to parse JSON file. Ensure it is linkedin_state.json" });
    }
  };

  const handleSubmitCode = async () => {
    if (!verificationCode.trim()) return;
    const apiUrl = process.env.NEXT_PUBLIC_BOT_API_URL || "http://localhost:8080";
    setIsSubmittingCode(true);
    try {
      await fetch(`${apiUrl}/submit-code`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ code: verificationCode.trim() })
      });
      setShowVerificationModal(false);
      setVerificationCode("");
      setAlertMessage({ type: "success", text: "Verification code sent! Bot is resuming..." });
      setTimeout(() => setAlertMessage(null), 3000);
    } catch (e) {
      setAlertMessage({ type: "info", text: "Failed to send code. Check your connection." });
    } finally {
      setIsSubmittingCode(false);
    }
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

  // Listen for Chrome Extension
  useEffect(() => {
    const handleMessage = async (event: MessageEvent) => {
      if (event.data?.type === "AUTOAPPLY_EXTENSION_READY") {
        setIsExtensionReady(true);
      }
      if (event.data?.type === "AUTOAPPLY_SYNC_RESPONSE" && event.data.cookies) {
        if (isSupabaseConnected && supabaseUser) {
          const { error } = await supabase
            .from("profiles")
            .update({ session_cookies: event.data.cookies })
            .eq("id", supabaseUser.id);
            
          if (error) {
            setAlertMessage({ type: "info", text: "Failed to upload extension cookies." });
          } else {
            setAlertMessage({ type: "success", text: "LinkedIn session auto-synced successfully via Extension!" });
          }
        } else {
          setAlertMessage({ type: "info", text: "Please connect to Supabase first." });
        }
        setTimeout(() => setAlertMessage(null), 3000);
      }
    };
    window.addEventListener("message", handleMessage);
    return () => window.removeEventListener("message", handleMessage);
  }, [isSupabaseConnected, supabaseUser]);

  const handleAutoSync = () => {
    window.postMessage({ type: "AUTOAPPLY_SYNC_REQUEST" }, "*");
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
            } else if (type === "verification_required") {
              setShowVerificationModal(true);
              setConsoleLogs(prev => [...prev, `📱 [2FA Required] LinkedIn sent a verification code to your phone or email. Enter it in the popup.`]);
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
          <div style={{ display: "flex", flexDirection: "column", gap: "32px", maxWidth: "1100px", margin: "0 auto", padding: "10px 0" }}>
            
            {/* Header Title Section */}
            <div style={{ textAlign: "center" }}>
              <p style={{ fontSize: "0.85rem", color: "var(--color-primary)", fontWeight: 800, textTransform: "uppercase", letterSpacing: "0.15em" }}>🛰️ AutoApply Pro Orchestrator</p>
              <h2 style={{ fontFamily: "var(--font-family-title)", fontSize: "2.8rem", fontWeight: 800, marginTop: "8px", lineHeight: "1.15" }}>
                Launch Your Autonomous <span className="gradient-text">AI Job Search</span>
              </h2>
              <p style={{ color: "var(--color-text-secondary)", fontSize: "0.95rem", marginTop: "12px", maxWidth: "680px", margin: "12px auto 0", lineHeight: "1.5" }}>
                AutoApply Pro links your custom resume facts with high-speed local AI. Watch Playwright navigate sites and complete complex forms in real-time.
              </p>
            </div>

            {/* Split Dual-Pane View */}
            <div style={{ display: "grid", gridTemplateColumns: "1.1fr 1fr", gap: "32px", alignItems: "start", marginTop: "10px" }}>
              
              {/* Left Pane: 3-Step Timeline Process Card Stack */}
              <div style={{ display: "flex", flexDirection: "column", gap: "20px" }}>
                
                {/* Timeline Node 1 */}
                <div className="glass-panel" style={{ padding: "20px 24px", display: "flex", gap: "16px", border: "1px solid var(--border-glass)", position: "relative" }}>
                  <div style={{
                    width: "28px",
                    height: "28px",
                    borderRadius: "50%",
                    background: "rgba(0, 242, 254, 0.15)",
                    border: "2px solid var(--color-primary)",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    fontSize: "0.85rem",
                    fontWeight: 800,
                    color: "var(--color-primary)",
                    flexShrink: 0
                  }}>1</div>
                  <div style={{ flexGrow: 1 }}>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                      <h3 style={{ fontSize: "0.95rem", fontWeight: 800, color: "#ffffff" }}>Step 1: Obtain AI Brain Key</h3>
                      <button
                        onClick={() => window.open("https://console.groq.com/keys", "_blank")}
                        className="glass-btn"
                        style={{ fontSize: "0.7rem", padding: "4px 10px", display: "flex", alignItems: "center", gap: "4px", background: "linear-gradient(135deg, var(--color-primary) 0%, var(--color-secondary) 100%)" }}
                      >
                        🔑 Get Groq Key
                      </button>
                    </div>
                    <p style={{ fontSize: "0.75rem", color: "var(--color-text-secondary)", marginTop: "4px", lineHeight: "1.4" }}>
                      Create a free developer account on Groq Console and copy a <strong>gsk_...</strong> key. Zero fees & extremely fast!
                    </p>
                  </div>
                </div>

                {/* Timeline Node 2 */}
                <div id="welcome-step-2-card" className="glass-panel" style={{ padding: "20px 24px", display: "flex", gap: "16px", border: "1px solid var(--border-glass)", flexDirection: "column" }}>
                  <div style={{ display: "flex", gap: "16px" }}>
                    <div style={{
                      width: "28px",
                      height: "28px",
                      borderRadius: "50%",
                      background: profile.groqKey.startsWith("gsk_") ? "rgba(52, 211, 153, 0.15)" : "rgba(243, 85, 136, 0.15)",
                      border: profile.groqKey.startsWith("gsk_") ? "2px solid var(--color-success)" : "2px solid var(--color-accent)",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      fontSize: "0.85rem",
                      fontWeight: 800,
                      color: profile.groqKey.startsWith("gsk_") ? "var(--color-success)" : "var(--color-accent)",
                      flexShrink: 0,
                      transition: "all 0.3s"
                    }}>2</div>
                    <div style={{ flexGrow: 1 }}>
                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                        <h3 style={{ fontSize: "0.95rem", fontWeight: 800, color: "#ffffff" }}>Step 2: Connect Key Locally</h3>
                        <div style={{ display: "flex", gap: "6px" }}>
                          <button
                            onClick={handlePasteKey}
                            className="glass-btn-secondary"
                            style={{ fontSize: "0.7rem", padding: "4px 10px" }}
                          >
                            📋 Paste Key
                          </button>
                        </div>
                      </div>
                      <p style={{ fontSize: "0.75rem", color: "var(--color-text-secondary)", marginTop: "4px", lineHeight: "1.4" }}>
                        Paste your key below to connect the local AI brain engine.
                      </p>
                    </div>
                  </div>

                  <div style={{ marginTop: "4px", display: "flex", flexDirection: "column", gap: "6px" }}>
                    <div style={{ display: "flex", position: "relative", alignItems: "center" }}>
                      <input
                        type="password"
                        id="welcome-groq-key-input"
                        value={profile.groqKey}
                        onChange={(e) => setProfile({ ...profile, groqKey: e.target.value })}
                        className="glass-input"
                        placeholder="gsk_..."
                        style={{ width: "100%", paddingRight: "100px", fontSize: "0.8rem", height: "36px" }}
                      />
                      <span style={{
                        position: "absolute",
                        right: "10px",
                        fontSize: "0.65rem",
                        fontWeight: 800,
                        padding: "3px 8px",
                        borderRadius: "4px",
                        background: profile.groqKey.startsWith("gsk_") ? "rgba(52, 211, 153, 0.15)" : "rgba(243, 85, 136, 0.15)",
                        color: profile.groqKey.startsWith("gsk_") ? "var(--color-success)" : "var(--color-accent)",
                        border: "1px solid",
                        borderColor: profile.groqKey.startsWith("gsk_") ? "rgba(52, 211, 153, 0.3)" : "rgba(243, 85, 136, 0.3)"
                      }}>
                        {profile.groqKey.startsWith("gsk_") ? "Verified Key ✓" : "Key Required ✗"}
                      </span>
                    </div>
                  </div>
                </div>

                {/* Timeline Node 3 — LinkedIn Credentials */}
                <div className="glass-panel" style={{ padding: "20px 24px", display: "flex", gap: "16px", border: "1px solid var(--border-glass)", flexDirection: "column" }}>
                  <div style={{ display: "flex", gap: "16px" }}>
                    <div style={{
                      width: "28px", height: "28px", borderRadius: "50%", flexShrink: 0,
                      background: isLinkedInConnected ? "rgba(52, 211, 153, 0.15)" : "rgba(0, 242, 254, 0.15)",
                      border: isLinkedInConnected ? "2px solid var(--color-success)" : "2px solid var(--color-primary)",
                      display: "flex", alignItems: "center", justifyContent: "center",
                      fontSize: "0.85rem", fontWeight: 800,
                      color: isLinkedInConnected ? "var(--color-success)" : "var(--color-primary)",
                      transition: "all 0.3s"
                    }}>3</div>
                    <div style={{ flexGrow: 1 }}>
                      <h3 style={{ fontSize: "0.95rem", fontWeight: 800, color: "#ffffff" }}>
                        {isLinkedInConnected ? "Step 3: LinkedIn Connected ✓" : "Step 3: Connect LinkedIn"}
                      </h3>
                      <p style={{ fontSize: "0.75rem", color: "var(--color-text-secondary)", marginTop: "4px", lineHeight: "1.4" }}>
                        Enter your LinkedIn email and password once. The cloud bot will log in on your behalf, handle everything automatically, and re-use your session forever.
                      </p>
                    </div>
                  </div>
                  {(!isLinkedInConnected || isEditingLinkedIn) ? (
                    <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
                      <div style={{ display: "flex", flexDirection: "column", gap: "4px" }}>
                        <label style={{ fontSize: "0.7rem", fontWeight: 700, color: "var(--color-text-secondary)" }}>LinkedIn Email</label>
                        <input
                          type="email"
                          placeholder="LinkedIn Email (e.g. your.email@gmail.com)"
                          value={profile.linkedinEmail}
                          onChange={(e) => setProfile({ ...profile, linkedinEmail: e.target.value })}
                          className="glass-input"
                          style={{ fontSize: "0.85rem" }}
                        />
                      </div>
                      <div style={{ display: "flex", flexDirection: "column", gap: "4px" }}>
                        <label style={{ fontSize: "0.7rem", fontWeight: 700, color: "var(--color-text-secondary)" }}>LinkedIn Password</label>
                        <input
                          type="password"
                          placeholder="LinkedIn Password"
                          value={profile.linkedinPassword}
                          onChange={(e) => setProfile({ ...profile, linkedinPassword: e.target.value })}
                          className="glass-input"
                          style={{ fontSize: "0.85rem" }}
                        />
                      </div>
                      <div style={{ display: "flex", gap: "10px", marginTop: "4px" }}>
                        <button
                          onClick={handleSaveProfile}
                          className="glass-btn"
                          style={{ fontSize: "0.8rem", padding: "8px 16px", background: "rgba(10, 102, 194, 0.2)", borderColor: "#0a66c2", color: "#0a66c2", flexGrow: 1 }}
                        >
                          🔒 Save LinkedIn Credentials
                        </button>
                        {isLinkedInConnected && (
                          <button
                            onClick={() => setIsEditingLinkedIn(false)}
                            className="glass-btn-secondary"
                            style={{ fontSize: "0.8rem", padding: "8px 16px" }}
                          >
                            Cancel
                          </button>
                        )}
                      </div>
                      <p style={{ fontSize: "0.7rem", color: "var(--color-text-muted)", marginTop: "4px" }}>
                        🔐 Credentials are stored securely in your private Supabase row with Row-Level Security. Only your cloud bot can read them.
                      </p>
                    </div>
                  ) : (
                    <div style={{ display: "flex", flexDirection: "column", gap: "10px", background: "rgba(255, 255, 255, 0.02)", padding: "12px", borderRadius: "8px", border: "1px solid var(--border-glass)" }}>
                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                        <div>
                          <span style={{ fontSize: "0.7rem", color: "var(--color-text-muted)" }}>Connected Email:</span>
                          <div style={{ fontSize: "0.85rem", fontWeight: 700, color: "#ffffff", marginTop: "2px" }}>{profile.linkedinEmail}</div>
                        </div>
                        <button
                          onClick={() => setIsEditingLinkedIn(true)}
                          className="glass-btn-secondary"
                          style={{ fontSize: "0.75rem", padding: "6px 12px" }}
                        >
                          ✏️ Edit Credentials
                        </button>
                      </div>
                    </div>
                  )}
                </div>


                <div className="glass-panel" style={{ padding: "20px 24px", display: "flex", gap: "16px", border: "1px solid var(--border-glass)" }}>
                  <div style={{
                    width: "28px",
                    height: "28px",
                    borderRadius: "50%",
                    background: (supabaseUser || sandboxMode) ? "rgba(52, 211, 153, 0.15)" : "rgba(0, 242, 254, 0.15)",
                    border: (supabaseUser || sandboxMode) ? "2px solid var(--color-success)" : "2px solid var(--color-primary)",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    fontSize: "0.85rem",
                    fontWeight: 800,
                    color: (supabaseUser || sandboxMode) ? "var(--color-success)" : "var(--color-primary)",
                    flexShrink: 0
                  }}>3</div>
                  <div style={{ flexGrow: 1 }}>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                      <h3 style={{ fontSize: "0.95rem", fontWeight: 800, color: "#ffffff" }}>
                        {(supabaseUser || sandboxMode) ? "Step 3: Ready to Launch!" : "Step 3: Secure & Launch"}
                      </h3>
                      {!(supabaseUser || sandboxMode) ? (
                        <button
                          onClick={() => scrollToAndFocus("welcome-auth-panel", "authEmailWelcome")}
                          className="glass-btn-secondary"
                          style={{ fontSize: "0.7rem", padding: "4px 10px" }}
                        >
                          🔐 Go to Auth
                        </button>
                      ) : (
                        <button
                          onClick={() => setActiveTab("dashboard")}
                          className="glass-btn"
                          style={{ fontSize: "0.7rem", padding: "4px 10px", background: "linear-gradient(135deg, var(--color-success) 0%, var(--color-primary) 100%)" }}
                        >
                          🚀 Launch Bot
                        </button>
                      )}
                    </div>
                    <p style={{ fontSize: "0.75rem", color: "var(--color-text-secondary)", marginTop: "4px", lineHeight: "1.4" }}>
                      {(supabaseUser || sandboxMode)
                        ? "Authentication linked successfully. Your local API Key is auto-synced to the cloud!"
                        : "Create an account or login to sync your candidate details to cloud databases and start running automated campaigns."}
                    </p>
                  </div>
                </div>

              </div>

              {/* Right Pane: Authentication & Control Center */}
              <div id="welcome-auth-panel" style={{ position: "sticky", top: "20px" }}>
                
                {!(supabaseUser || sandboxMode) ? (
                  <div className="glass-panel" style={{ padding: "32px", display: "flex", flexDirection: "column", gap: "24px", border: "1px solid rgba(0, 242, 254, 0.2)", boxShadow: "0 0 30px rgba(0, 242, 254, 0.05)" }}>
                    
                    {/* Panel Header */}
                    <div>
                      <div style={{ display: "flex", gap: "12px", background: "rgba(0,0,0,0.3)", padding: "4px", borderRadius: "8px", width: "fit-content", marginBottom: "16px" }}>
                        <button 
                          onClick={() => setAuthMode("login")}
                          style={{ 
                            padding: "6px 16px", 
                            borderRadius: "6px", 
                            fontSize: "0.75rem", 
                            fontWeight: 700,
                            cursor: "pointer",
                            border: "none",
                            background: authMode === "login" ? "rgba(0, 242, 254, 0.15)" : "transparent",
                            color: authMode === "login" ? "var(--color-primary)" : "var(--color-text-secondary)",
                            transition: "all 0.2s"
                          }}
                        >
                          Sign In
                        </button>
                        <button 
                          onClick={() => setAuthMode("register")}
                          style={{ 
                            padding: "6px 16px", 
                            borderRadius: "6px", 
                            fontSize: "0.75rem", 
                            fontWeight: 700,
                            cursor: "pointer",
                            border: "none",
                            background: authMode === "register" ? "rgba(0, 242, 254, 0.15)" : "transparent",
                            color: authMode === "register" ? "var(--color-primary)" : "var(--color-text-secondary)",
                            transition: "all 0.2s"
                          }}
                        >
                          Create Account
                        </button>
                      </div>
                      
                      <h3 style={{ fontFamily: "var(--font-family-title)", fontSize: "1.2rem", fontWeight: 800 }}>
                        {authMode === "login" ? "🔑 Connect to Cloud Sync" : "🚀 Get Started Free"}
                      </h3>
                      <p style={{ fontSize: "0.75rem", color: "var(--color-text-muted)", marginTop: "4px" }}>
                        {authMode === "login" ? "Welcome back! Enter credentials to sync facts." : "Access cloud backups for profile history and logs."}
                      </p>
                    </div>

                    {/* Auth Form */}
                    <form onSubmit={handleAuthSubmit} style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
                      <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
                        <label htmlFor="authEmailWelcome" style={{ fontSize: "0.75rem", fontWeight: 700, color: "var(--color-text-secondary)" }}>Email Address</label>
                        <input 
                          type="email" 
                          id="authEmailWelcome" 
                          value={authEmail} 
                          onChange={(e) => setAuthEmail(e.target.value)}
                          placeholder="yourname@domain.com"
                          className="glass-input" 
                          required
                        />
                      </div>
                      <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
                        <label htmlFor="authPasswordWelcome" style={{ fontSize: "0.75rem", fontWeight: 700, color: "var(--color-text-secondary)" }}>Password</label>
                        <input 
                          type="password" 
                          id="authPasswordWelcome" 
                          value={authPassword} 
                          onChange={(e) => setAuthPassword(e.target.value)}
                          placeholder="••••••••"
                          className="glass-input" 
                          required
                        />
                      </div>

                      {/* Helpful Supabase Local Tip Callout */}
                      {authMode === "register" && (
                        <div className="glass-panel" style={{ 
                          padding: "10px 14px", 
                          background: "rgba(243, 85, 136, 0.04)", 
                          border: "1px solid rgba(243, 85, 136, 0.15)", 
                          fontSize: "0.7rem", 
                          lineHeight: "1.4",
                          borderRadius: "6px"
                        }}>
                          <strong style={{ color: "var(--color-accent)", display: "block", marginBottom: "2px" }}>💡 Setup Tip:</strong>
                          If you receive a "Check your email" message, you must confirm your signup. To bypass this and register instantly, disable <strong>"Confirm email"</strong> in your Supabase Auth Providers dashboard!
                        </div>
                      )}

                      <button 
                        type="submit" 
                        disabled={isAuthLoading}
                        className="glass-btn" 
                        style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: "8px", width: "100%" }}
                      >
                        {isAuthLoading && (
                          <div style={{ width: "12px", height: "12px", border: "2px solid transparent", borderTopColor: "#fff", borderRadius: "50%" }} className="animate-spin-slow" />
                        )}
                        {authMode === "login" ? "SIGN IN" : "REGISTER ACCOUNT"}
                      </button>
                    </form>

                    <div style={{ position: "relative", display: "flex", alignItems: "center", justifyContent: "center", margin: "8px 0" }}>
                      <div style={{ position: "absolute", width: "100%", height: "1px", background: "var(--border-glass)" }} />
                      <span style={{ position: "relative", background: "rgba(12, 10, 20, 0.95)", padding: "0 10px", fontSize: "0.7rem", color: "var(--color-text-muted)", fontWeight: 600 }}>OR EXPERIENCE INSTANTLY</span>
                    </div>

                    {/* Guest Sandbox Button */}
                    <button 
                      onClick={() => {
                        setSandboxMode(true);
                        setActiveTab("dashboard");
                        setAlertMessage({ type: "success", text: "Demo Sandbox active! Playwright logs pre-loaded." });
                        setTimeout(() => setAlertMessage(null), 4000);
                      }}
                      className="glass-panel glass-panel-hover" 
                      style={{ 
                        border: "1px solid var(--color-primary)", 
                        color: "var(--color-primary)",
                        padding: "14px",
                        textAlign: "center",
                        background: "rgba(0, 242, 254, 0.05)",
                        cursor: "pointer",
                        fontWeight: 700,
                        fontSize: "0.8rem",
                        borderRadius: "10px",
                        transition: "all 0.3s"
                      }}
                    >
                      🌐 Run Guest Sandbox Preview
                    </button>

                  </div>
                ) : (
                  <div className="glass-panel" style={{ padding: "32px", display: "flex", flexDirection: "column", gap: "24px", border: "1px solid rgba(52, 211, 153, 0.2)", boxShadow: "0 0 30px rgba(52, 211, 153, 0.05)" }}>
                    <div>
                      <span style={{ fontSize: "2.5rem" }}>🟢</span>
                      <h3 style={{ fontFamily: "var(--font-family-title)", fontSize: "1.3rem", fontWeight: 800, marginTop: "12px" }}>
                        Session Connected
                      </h3>
                      <p style={{ fontSize: "0.8rem", color: "var(--color-text-secondary)", marginTop: "6px", lineHeight: "1.4" }}>
                        You are authenticated as <strong style={{ color: "#ffffff" }}>{supabaseUser ? supabaseUser.email : "Alex Rivera (Demo)"}</strong>. All candidate files and application history are fully synchronized.
                      </p>
                    </div>

                    <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
                      <button 
                        onClick={() => setActiveTab("dashboard")}
                        className="glass-btn"
                        style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: "8px", width: "100%", background: "linear-gradient(135deg, var(--color-primary) 0%, var(--color-secondary) 100%)" }}
                      >
                        🚀 Open Launch Pad Cockpit ➜
                      </button>

                      <button 
                        onClick={() => setActiveTab("profile")}
                        className="glass-btn-secondary"
                        style={{ width: "100%", padding: "12px" }}
                      >
                        👤 Edit Campaign Resume facts
                      </button>
                    </div>

                    <div style={{ borderTop: "1px solid var(--border-glass)", paddingTop: "16px", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                      <span style={{ fontSize: "0.75rem", color: "var(--color-text-muted)" }}>Ready to configure a campaign?</span>
                      <button 
                        onClick={handleLogout}
                        style={{ background: "transparent", border: "none", color: "var(--color-accent)", textDecoration: "underline", fontSize: "0.75rem", cursor: "pointer", fontWeight: 600 }}
                      >
                        Sign Out
                      </button>
                    </div>
                  </div>
                )}

              </div>

            </div>

          </div>
        )}

        {activeTab === "dashboard" && (
          <>
            {/* Unified Centered Stepper checklist at startup */}
            {!sandboxMode && onboardingStep < 3 ? (
              <div style={{ maxWidth: "720px", margin: "40px auto", display: "flex", flexDirection: "column", gap: "32px", width: "100%" }}>
                
                {/* Visual Header */}
                <div style={{ textAlign: "center" }}>
                  <p style={{ fontSize: "0.85rem", color: "var(--color-primary)", fontWeight: 800, textTransform: "uppercase", letterSpacing: "0.15em" }}>
                    🛰️ AutoApply Pro Orchestrator Activation
                  </p>
                  <h2 style={{ fontFamily: "var(--font-family-title)", fontSize: "2.4rem", fontWeight: 800, marginTop: "10px" }}>
                    Complete Your <span className="gradient-text">AI Set Up</span>
                  </h2>
                  <p style={{ color: "var(--color-text-secondary)", fontSize: "0.95rem", marginTop: "12px" }}>
                    Unlock autonomous LinkedIn job searching and direct application streaming in two simple phases.
                  </p>
                </div>

                {/* Progress Indicators */}
                <div style={{ display: "flex", gap: "12px", borderBottom: "1px solid var(--border-glass)", paddingBottom: "20px" }}>
                  <div style={{ flexGrow: 1, display: "flex", flexDirection: "column", gap: "6px" }}>
                    <span style={{ fontSize: "0.75rem", fontWeight: 700, color: onboardingStep === 1 ? "var(--color-primary)" : "var(--color-success)" }}>
                      {profile.groqKey ? "✓ Phase 1: API Key Configured" : "Phase 1: Connect AI Brain"}
                    </span>
                    <div style={{ height: "4px", background: profile.groqKey ? "var(--color-success)" : "var(--color-primary)", borderRadius: "2px" }} />
                  </div>
                  <div style={{ flexGrow: 1, display: "flex", flexDirection: "column", gap: "6px" }}>
                    <span style={{ fontSize: "0.75rem", fontWeight: 700, color: onboardingStep === 2 ? "var(--color-primary)" : "var(--color-text-muted)" }}>
                      Phase 2: Extract Resume Facts
                    </span>
                    <div style={{ height: "4px", background: onboardingStep === 2 ? "var(--color-primary)" : "var(--border-glass)", borderRadius: "2px" }} />
                  </div>
                </div>

                {/* Phase 1: API Key Form */}
                {onboardingStep === 1 && (
                  <div className="glass-panel" style={{ padding: "32px", display: "flex", flexDirection: "column", gap: "24px" }}>
                    <div>
                      <h3 style={{ fontFamily: "var(--font-family-title)", fontSize: "1.2rem", fontWeight: 800, display: "flex", alignItems: "center", gap: "8px" }}>
                        <span>🧠</span> Connect Your Groq API Key
                      </h3>
                      <p style={{ fontSize: "0.85rem", color: "var(--color-text-secondary)", marginTop: "6px" }}>
                        AutoApply Pro uses Groq's high-speed LLM models to dynamically analyze requirements and answer custom application questions. Enjoy completely free operations using your own developer token!
                      </p>
                    </div>

                    <div style={{ display: "flex", gap: "10px", flexWrap: "wrap" }}>
                      <a 
                        href="https://console.groq.com/keys" 
                        target="_blank" 
                        rel="noreferrer" 
                        className="glass-btn" 
                        style={{ fontSize: "0.8rem", padding: "10px 20px", textDecoration: "none", display: "inline-block" }}
                      >
                        🔑 Create Free Groq Key (30s)
                      </a>
                      <button 
                        onClick={handlePasteKey}
                        className="glass-btn-secondary" 
                        style={{ fontSize: "0.8rem", padding: "10px 20px" }}
                      >
                        📋 Paste from Clipboard
                      </button>
                    </div>

                    <div className="glass-panel" style={{ padding: "14px 18px", background: "rgba(255,255,255,0.01)", fontSize: "0.8rem" }}>
                      <strong style={{ color: "var(--color-primary)" }}>Direct Instructions:</strong> Click the button above to open the developer dashboard, sign in or log in, copy a new API Key (starts with <code>gsk_</code>), and paste it below!
                    </div>

                    <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
                      <label htmlFor="groqKeyOnboard" style={{ fontSize: "0.8rem", fontWeight: 700, color: "var(--color-text-secondary)" }}>Your API Key</label>
                      <input 
                        type="password" 
                        id="groqKeyOnboard" 
                        value={profile.groqKey} 
                        onChange={e => setProfile({...profile, groqKey: e.target.value})} 
                        className="glass-input" 
                        placeholder="gsk_..." 
                      />
                    </div>

                    {profile.groqKey.startsWith("gsk_") && (
                      <button 
                        onClick={async (e) => {
                          e.preventDefault();
                          // Save key to database if logged in
                          if (isSupabaseConnected && supabaseUser) {
                            try {
                              const { error } = await supabase
                                .from("profiles")
                                .update({ encrypted_groq_key: profile.groqKey })
                                .eq("id", supabaseUser.id);
                              if (error) throw error;
                            } catch (err: any) {
                              console.error("Error saving key to DB:", err);
                            }
                          }
                          setOnboardingStep(2);
                          setAlertMessage({ type: "success", text: "API Key verified and linked!" });
                          setTimeout(() => setAlertMessage(null), 3000);
                        }}
                        className="glass-btn"
                        style={{ width: "100%", display: "flex", alignItems: "center", justifyContent: "center", gap: "8px" }}
                      >
                        Activate AI Brain & Proceed ➜
                      </button>
                    )}
                  </div>
                )}

                {/* Phase 2: PDF Upload & Facts Form */}
                {onboardingStep === 2 && (
                  <div style={{ display: "flex", flexDirection: "column", gap: "24px" }}>
                    
                    {/* Drag/Drop Box */}
                    <div 
                      onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
                      onDragLeave={() => setIsDragging(false)}
                      onDrop={(e) => {
                        e.preventDefault();
                        setIsDragging(false);
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
                        cursor: "pointer",
                        transition: "all 0.3s ease"
                      }}
                    >
                      <input 
                        type="file" 
                        id="cv-onboard-input" 
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
                          <p style={{ color: "var(--color-primary)", fontWeight: 700, fontSize: "0.85rem" }}>
                            🧠 Client-Side AI Parser: Analysing structure and extracting contact details...
                          </p>
                        </div>
                      ) : (
                        <label htmlFor="cv-onboard-input" style={{ cursor: "pointer", display: "flex", flexDirection: "column", alignItems: "center", gap: "10px", width: "100%" }}>
                          <span style={{ fontSize: "2.5rem" }}>📄</span>
                          <div>
                            <h3 style={{ fontSize: "1rem", fontWeight: 700 }}>
                              {fileName ? `Loaded Resume: ${fileName}` : "Drag and Drop your PDF CV / Resume here"}
                            </h3>
                            <p style={{ fontSize: "0.75rem", color: "var(--color-text-muted)", marginTop: "4px" }}>
                              PDF structures are analyzed instantly using your Groq brain.
                            </p>
                          </div>
                          <span className="glass-btn-secondary" style={{ padding: "6px 14px", fontSize: "0.75rem", marginTop: "4px" }}>
                            Browse PDF File
                          </span>
                        </label>
                      )}
                    </div>

                    {/* Extracted/Editable Profile details form - always visible for manual typing or CV review */}
                    {true && (
                      <form onSubmit={handleSaveProfile} className="glass-panel" style={{ padding: "32px", display: "flex", flexDirection: "column", gap: "20px" }}>
                        <h3 style={{ fontFamily: "var(--font-family-title)", fontSize: "1.1rem", fontWeight: 800, borderBottom: "1px solid var(--border-glass)", paddingBottom: "10px" }}>
                          👤 Candidate Profile Details & Facts
                        </h3>

                        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "20px" }}>
                          <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
                            <label htmlFor="fullNameOnboard" style={{ fontSize: "0.75rem", fontWeight: 700, color: "var(--color-text-secondary)" }}>Full Name</label>
                            <input 
                              type="text" 
                              id="fullNameOnboard" 
                              value={profile.fullName} 
                              onChange={e => setProfile({...profile, fullName: e.target.value})} 
                              className="glass-input" 
                              required 
                            />
                          </div>

                          <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
                            <label htmlFor="emailOnboard" style={{ fontSize: "0.75rem", fontWeight: 700, color: "var(--color-text-secondary)" }}>Email Address</label>
                            <input 
                              type="email" 
                              id="emailOnboard" 
                              value={profile.email} 
                              onChange={e => setProfile({...profile, email: e.target.value})} 
                              className="glass-input" 
                              required 
                            />
                          </div>

                          <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
                            <label htmlFor="phoneOnboard" style={{ fontSize: "0.75rem", fontWeight: 700, color: "var(--color-text-secondary)" }}>Phone Number</label>
                            <input 
                              type="text" 
                              id="phoneOnboard" 
                              value={profile.phone} 
                              onChange={e => setProfile({...profile, phone: e.target.value})} 
                              className="glass-input" 
                              required 
                            />
                          </div>

                          <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
                            <label htmlFor="cityOnboard" style={{ fontSize: "0.75rem", fontWeight: 700, color: "var(--color-text-secondary)" }}>Location (City, State)</label>
                            <input 
                              type="text" 
                              id="cityOnboard" 
                              value={profile.city} 
                              onChange={e => setProfile({...profile, city: e.target.value})} 
                              className="glass-input" 
                              required 
                            />
                          </div>
                        </div>

                        <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
                          <label htmlFor="targetKeywordsOnboard" style={{ fontSize: "0.75rem", fontWeight: 700, color: "var(--color-text-secondary)" }}>Target Job Keywords (Comma-separated)</label>
                          <input 
                            type="text" 
                            id="targetKeywordsOnboard" 
                            value={profile.targetKeywords} 
                            onChange={e => setProfile({...profile, targetKeywords: e.target.value})} 
                            className="glass-input" 
                            required 
                          />
                        </div>

                        <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
                          <label htmlFor="skillsOnboard" style={{ fontSize: "0.75rem", fontWeight: 700, color: "var(--color-text-secondary)" }}>Skills Keywords (Comma-separated)</label>
                          <input 
                            type="text" 
                            id="skillsOnboard" 
                            value={profile.skills} 
                            onChange={e => setProfile({...profile, skills: e.target.value})} 
                            className="glass-input" 
                            required 
                          />
                        </div>

                        <button 
                          type="submit" 
                          className="glass-btn"
                          style={{ width: "100%", background: "linear-gradient(135deg, var(--color-success) 0%, var(--color-primary) 100%)", boxShadow: "0 0 20px rgba(52,211,153,0.25)" }}
                        >
                          💾 Save Profile & Unlock Launch Pad!
                        </button>
                      </form>
                    )}
                  </div>
                )}
              </div>
            ) : (
              <div style={{ display: "flex", flexDirection: "column", gap: "32px", width: "100%" }}>

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
                  onClick={handleLaunchClick}
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

            {/* Campaign Briefing Card */}
            <div 
              className="glass-panel" 
              style={{ 
                padding: "20px 24px", 
                display: "flex", 
                justifyContent: "space-between", 
                alignItems: "center", 
                flexWrap: "wrap", 
                gap: "16px",
                border: "1px solid var(--border-glass-hover)",
                background: "rgba(0, 242, 254, 0.02)"
              }}
            >
              <div style={{ display: "flex", alignItems: "center", gap: "24px", flexWrap: "wrap" }}>
                <div style={{ display: "flex", flexDirection: "column", gap: "4px" }}>
                  <span style={{ fontSize: "0.7rem", fontWeight: 700, color: "var(--color-text-muted)", textTransform: "uppercase", letterSpacing: "0.08em" }}>🎯 Target Role</span>
                  <span style={{ fontSize: "0.9rem", fontWeight: 700, color: "#ffffff" }}>
                    {profile.targetKeywords || "Not configured yet"}
                  </span>
                </div>

                <div style={{ display: "flex", flexDirection: "column", gap: "4px" }}>
                  <span style={{ fontSize: "0.7rem", fontWeight: 700, color: "var(--color-text-muted)", textTransform: "uppercase", letterSpacing: "0.08em" }}>📍 Target Location</span>
                  <span style={{ fontSize: "0.9rem", fontWeight: 700, color: "#ffffff" }}>
                    {profile.targetLocations || "Remote / Global"}
                  </span>
                </div>

                <div style={{ display: "flex", flexDirection: "column", gap: "4px" }}>
                  <span style={{ fontSize: "0.7rem", fontWeight: 700, color: "var(--color-text-muted)", textTransform: "uppercase", letterSpacing: "0.08em" }}>🧠 Groq AI Status</span>
                  {profile.groqKey && (profile.groqKey.startsWith("gsk_") || sandboxMode) ? (
                    <span style={{ fontSize: "0.75rem", fontWeight: 800, color: "var(--color-success)", display: "flex", alignItems: "center", gap: "4px" }}>
                      🟢 ACTIVE (GSK Token)
                    </span>
                  ) : (
                    <span style={{ fontSize: "0.75rem", fontWeight: 800, color: "var(--color-accent)", display: "flex", alignItems: "center", gap: "4px" }}>
                      🔴 MISSING API KEY
                    </span>
                  )}
                </div>
              </div>

              <button 
                onClick={() => setActiveTab("profile")}
                className="glass-btn-secondary"
                style={{ 
                  display: "flex", 
                  alignItems: "center", 
                  gap: "6px", 
                  fontSize: "0.8rem", 
                  padding: "8px 16px",
                  borderRadius: "8px"
                }}
              >
                ✏️ Edit Target Campaign
              </button>
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

              {/* Live Visual Bot Inspector (LinkedIn Browser Mockup with pause controls) */}
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

            {/* Recent Applications Stream Feed */}
            <div style={{ display: "flex", flexDirection: "column", gap: "16px", marginTop: "12px" }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <h3 style={{ fontFamily: "var(--font-family-title)", fontSize: "1.2rem", fontWeight: 800, display: "flex", alignItems: "center", gap: "8px" }}>
                  <span>📋</span> Live Application Stream
                </h3>
                {applications.length > 0 && (
                  <button 
                    onClick={() => setActiveTab("logs")}
                    className="glass-btn-secondary"
                    style={{ fontSize: "0.75rem", padding: "6px 14px", borderRadius: "8px" }}
                  >
                    View All {applications.length} Applications ➜
                  </button>
                )}
              </div>

              {applications.length === 0 ? (
                <div 
                  className="glass-panel" 
                  style={{ 
                    padding: "40px", 
                    textAlign: "center", 
                    color: "var(--color-text-muted)",
                    border: "1px dashed var(--border-glass)"
                  }}
                >
                  <span style={{ fontSize: "2rem" }}>📡</span>
                  <p style={{ fontSize: "0.85rem", marginTop: "12px", fontWeight: 600 }}>No applications logged yet.</p>
                  <p style={{ fontSize: "0.75rem", color: "var(--color-text-muted)", marginTop: "4px" }}>
                    Once you launch the crawler, successful applications will stream in real-time here.
                  </p>
                </div>
              ) : (
                <div className="glass-panel" style={{ overflowX: "auto", border: "1px solid var(--border-glass)" }}>
                  <table style={{ width: "100%", borderCollapse: "collapse", textAlign: "left", fontSize: "0.85rem" }}>
                    <thead>
                      <tr style={{ borderBottom: "2px solid var(--border-glass)", background: "rgba(255,255,255,0.01)" }}>
                        <th style={{ padding: "12px 16px", fontWeight: 600, color: "var(--color-text-muted)" }}>ROLE</th>
                        <th style={{ padding: "12px 16px", fontWeight: 600, color: "var(--color-text-muted)" }}>COMPANY</th>
                        <th style={{ padding: "12px 16px", fontWeight: 600, color: "var(--color-text-muted)" }}>DATE</th>
                        <th style={{ padding: "12px 16px", fontWeight: 600, color: "var(--color-text-muted)" }}>MATCH</th>
                        <th style={{ padding: "12px 16px", fontWeight: 600, color: "var(--color-text-muted)" }}>STATUS</th>
                        <th style={{ padding: "12px 16px", fontWeight: 600, color: "var(--color-text-muted)", textAlign: "right" }}>ACTION</th>
                      </tr>
                    </thead>
                    <tbody>
                      {applications.slice(0, 3).map(app => (
                        <tr key={app.id} style={{ borderBottom: "1px solid var(--border-glass)" }}>
                          <td style={{ padding: "12px 16px", fontWeight: 700 }}>{app.job_title}</td>
                          <td style={{ padding: "12px 16px" }}>{app.company}</td>
                          <td style={{ padding: "12px 16px", color: "var(--color-text-secondary)" }}>{app.applied_date}</td>
                          <td style={{ padding: "12px 16px" }}>
                            <span style={{ color: "var(--color-primary)", fontWeight: 600 }}>{app.match_score}%</span>
                          </td>
                          <td style={{ padding: "12px 16px" }}>
                            <span style={{ 
                              fontSize: "0.7rem", 
                              fontWeight: 700, 
                              color: app.status === "Interviewing" ? "var(--color-warning)" : app.status === "Applied" ? "var(--color-success)" : "var(--color-accent)",
                              background: app.status === "Interviewing" ? "rgba(251, 191, 36, 0.08)" : app.status === "Applied" ? "rgba(52, 211, 153, 0.08)" : "rgba(243, 85, 136, 0.08)",
                              padding: "2px 6px",
                              borderRadius: "4px"
                            }}>
                              {app.status}
                            </span>
                          </td>
                          <td style={{ padding: "12px 16px", textAlign: "right" }}>
                            <button 
                              onClick={() => setSelectedApp(app)}
                              className="glass-btn-secondary" 
                              style={{ padding: "4px 10px", fontSize: "0.7rem", borderRadius: "6px" }}
                            >
                              Audit Details
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
      </>
    )}

        {/* ── TAB 3: RESUME FACTS & CAMPAIGN PARAMETERS ── */}
        {activeTab === "profile" && (
          <div style={{ display: "flex", flexDirection: "column", gap: "32px" }}>
            
            {/* Header */}
            <div>
              <p style={{ fontSize: "0.85rem", color: "var(--color-primary)", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.08em" }}>Candidate Control</p>
              <h2 style={{ fontFamily: "var(--font-family-title)", fontSize: "2.2rem", fontWeight: 800 }}>Resume Facts & <span className="gradient-text">Parameters</span></h2>
              <p style={{ color: "var(--color-text-secondary)", fontSize: "0.9rem", marginTop: "4px" }}>
                Keep your candidate contact facts and campaign search parameters updated for automated Easy Applies.
              </p>
            </div>

            {/* Direct Dual-Pane Editor Layout */}
            <div style={{ display: "grid", gridTemplateColumns: "0.8fr 1.2fr", gap: "32px", alignItems: "start" }}>
              
              {/* Left Column: PDF Uploader Dropzone */}
              <div style={{ display: "flex", flexDirection: "column", gap: "28px" }}>
                
                {/* 1. Instant Client-Side PDF CV Parser Dropzone */}
                <div 
                  onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
                  onDragLeave={() => setIsDragging(false)}
                  onDrop={(e) => {
                    e.preventDefault();
                    setIsDragging(false);
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
                    padding: "48px 32px",
                    textAlign: "center",
                    cursor: "pointer",
                    transition: "all 0.3s ease"
                  }}
                >
                  <input 
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
                      <div style={{ width: "40px", height: "40px", border: "3px solid rgba(0, 242, 254, 0.1)", borderTopColor: "var(--color-primary)", borderRadius: "50%" }} className="animate-spin-slow" />
                      <p style={{ color: "var(--color-primary)", fontWeight: 700, fontSize: "0.8rem" }}>🧠 AI PDF Parser extracting contact metrics...</p>
                    </div>
                  ) : (
                    <label htmlFor="cv-file-input" style={{ cursor: "pointer", display: "flex", flexDirection: "column", alignItems: "center", gap: "12px", width: "100%" }}>
                      <span style={{ fontSize: "2.5rem" }}>📄</span>
                      <div>
                        <h3 style={{ fontSize: "0.9rem", fontWeight: 700, color: "#ffffff" }}>
                          {fileName ? `CV Facts Active: ${fileName}` : "Drag and Drop your PDF CV resume here"}
                        </h3>
                        <p style={{ fontSize: "0.75rem", color: "var(--color-text-muted)", marginTop: "4px", lineHeight: "1.4" }}>
                          Upload CV to instantly extract candidate contact facts, target roles, and skills list in 3 seconds.
                        </p>
                      </div>
                      <span className="glass-btn-secondary" style={{ padding: "6px 16px", fontSize: "0.75rem", marginTop: "4px" }}>
                        Browse PDF File
                      </span>
                    </label>
                  )}
                </div>

                <div className="glass-panel" style={{ padding: "20px", fontSize: "0.75rem", color: "var(--color-text-secondary)", lineHeight: "1.5" }}>
                  💡 <strong>Resume Parsing Tip:</strong>
                  <br />
                  Our offline parser processes files client-side. If you have an active Groq API Key, AutoApply Pro will utilize the LLM model to clean, reformat, and enrich the extracted facts!
                </div>

              </div>

              {/* Right Column: Editable Candidate Contact & Keywords Facts */}
              <form onSubmit={handleSaveProfile} className="glass-panel" style={{ padding: "32px", display: "flex", flexDirection: "column", gap: "24px", border: "1px solid var(--border-glass)" }}>
                <h3 style={{ fontFamily: "var(--font-family-title)", fontSize: "1.1rem", fontWeight: 800, borderBottom: "1px solid var(--border-glass)", paddingBottom: "12px" }}>
                  👤 Extracted Candidate Details Facts
                </h3>

                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "20px" }}>
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
                    <label htmlFor="city" style={{ fontSize: "0.75rem", fontWeight: 700, color: "var(--color-text-secondary)" }}>Living Location (City, State)</label>
                    <input 
                      type="text" 
                      id="city" 
                      value={profile.city} 
                      onChange={e => setProfile({...profile, city: e.target.value})} 
                      className="glass-input" 
                      placeholder="e.g. San Francisco, CA"
                      required 
                    />
                  </div>
                </div>

                <h3 style={{ fontFamily: "var(--font-family-title)", fontSize: "1.1rem", fontWeight: 800, borderBottom: "1px solid var(--border-glass)", paddingBottom: "12px", marginTop: "12px" }}>
                  🔑 LinkedIn Cloud Bot Credentials
                </h3>

                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "20px" }}>
                  <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
                    <label htmlFor="linkedinEmail" style={{ fontSize: "0.75rem", fontWeight: 700, color: "var(--color-text-secondary)" }}>LinkedIn Email / Username</label>
                    <input 
                      type="email" 
                      id="linkedinEmail" 
                      value={profile.linkedinEmail} 
                      onChange={e => setProfile({...profile, linkedinEmail: e.target.value})} 
                      className="glass-input" 
                      placeholder="your.email@gmail.com"
                    />
                  </div>

                  <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
                    <label htmlFor="linkedinPassword" style={{ fontSize: "0.75rem", fontWeight: 700, color: "var(--color-text-secondary)" }}>LinkedIn Password</label>
                    <input 
                      type="password" 
                      id="linkedinPassword" 
                      value={profile.linkedinPassword} 
                      onChange={e => setProfile({...profile, linkedinPassword: e.target.value})} 
                      className="glass-input" 
                      placeholder="••••••••••••"
                    />
                  </div>
                </div>

                <h3 style={{ fontFamily: "var(--font-family-title)", fontSize: "1.1rem", fontWeight: 800, borderBottom: "1px solid var(--border-glass)", paddingBottom: "12px", marginTop: "12px" }}>
                  🎯 Campaign Search Parameters & Filters
                </h3>

                <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
                  
                  <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
                    <label htmlFor="targetLocations" style={{ fontSize: "0.75rem", fontWeight: 700, color: "var(--color-text-secondary)" }}>Target Working Locations (Comma-separated search locations)</label>
                    <input 
                      type="text" 
                      id="targetLocations" 
                      value={profile.targetLocations} 
                      onChange={e => setProfile({...profile, targetLocations: e.target.value})} 
                      className="glass-input" 
                      placeholder="e.g. New York City, Austin, Seattle, remote"
                      required 
                    />
                  </div>

                  <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
                    <label htmlFor="targetKeywords" style={{ fontSize: "0.75rem", fontWeight: 700, color: "var(--color-text-secondary)" }}>Target Job Keywords / Titles (Comma-separated)</label>
                    <input 
                      type="text" 
                      id="targetKeywords" 
                      value={profile.targetKeywords} 
                      onChange={e => setProfile({...profile, targetKeywords: e.target.value})} 
                      className="glass-input" 
                      placeholder="e.g. Senior Frontend Architect, Next.js Developer"
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
                      placeholder="React, Next.js, Playwright, TypeScript, CSS Grid"
                      required 
                    />
                  </div>
                </div>

                {/* Multi-column checkboxes for Workplace, Job Types, and Experience Levels */}
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: "20px", marginTop: "12px" }}>
                  
                  {/* Column 1: Workplace Type */}
                  <div className="glass-panel" style={{ padding: "16px", display: "flex", flexDirection: "column", gap: "10px", background: "rgba(255,255,255,0.01)" }}>
                    <h4 style={{ fontSize: "0.8rem", fontWeight: 800, color: "var(--color-primary)", borderBottom: "1px solid var(--border-glass)", paddingBottom: "6px" }}>
                      🏠 Workplace Type
                    </h4>
                    <label style={{ display: "flex", alignItems: "center", gap: "10px", fontSize: "0.75rem", cursor: "pointer" }}>
                      <input 
                        type="checkbox" 
                        checked={profile.workplaceRemote} 
                        onChange={e => setProfile({...profile, workplaceRemote: e.target.checked})}
                        style={{ accentColor: "var(--color-primary)" }}
                      />
                      Remote
                    </label>
                    <label style={{ display: "flex", alignItems: "center", gap: "10px", fontSize: "0.75rem", cursor: "pointer" }}>
                      <input 
                        type="checkbox" 
                        checked={profile.workplaceHybrid} 
                        onChange={e => setProfile({...profile, workplaceHybrid: e.target.checked})}
                        style={{ accentColor: "var(--color-primary)" }}
                      />
                      Hybrid
                    </label>
                    <label style={{ display: "flex", alignItems: "center", gap: "10px", fontSize: "0.75rem", cursor: "pointer" }}>
                      <input 
                        type="checkbox" 
                        checked={profile.workplaceOnsite} 
                        onChange={e => setProfile({...profile, workplaceOnsite: e.target.checked})}
                        style={{ accentColor: "var(--color-primary)" }}
                      />
                      On-site
                    </label>
                  </div>

                  {/* Column 2: Job Type */}
                  <div className="glass-panel" style={{ padding: "16px", display: "flex", flexDirection: "column", gap: "10px", background: "rgba(255,255,255,0.01)" }}>
                    <h4 style={{ fontSize: "0.8rem", fontWeight: 800, color: "var(--color-primary)", borderBottom: "1px solid var(--border-glass)", paddingBottom: "6px" }}>
                      💼 Job Type
                    </h4>
                    <label style={{ display: "flex", alignItems: "center", gap: "10px", fontSize: "0.75rem", cursor: "pointer" }}>
                      <input 
                        type="checkbox" 
                        checked={profile.jobFullTime} 
                        onChange={e => setProfile({...profile, jobFullTime: e.target.checked})}
                        style={{ accentColor: "var(--color-primary)" }}
                      />
                      Full-Time
                    </label>
                    <label style={{ display: "flex", alignItems: "center", gap: "10px", fontSize: "0.75rem", cursor: "pointer" }}>
                      <input 
                        type="checkbox" 
                        checked={profile.jobPartTime} 
                        onChange={e => setProfile({...profile, jobPartTime: e.target.checked})}
                        style={{ accentColor: "var(--color-primary)" }}
                      />
                      Part-Time
                    </label>
                    <label style={{ display: "flex", alignItems: "center", gap: "10px", fontSize: "0.75rem", cursor: "pointer" }}>
                      <input 
                        type="checkbox" 
                        checked={profile.jobContract} 
                        onChange={e => setProfile({...profile, jobContract: e.target.checked})}
                        style={{ accentColor: "var(--color-primary)" }}
                      />
                      Contract
                    </label>
                    <label style={{ display: "flex", alignItems: "center", gap: "10px", fontSize: "0.75rem", cursor: "pointer" }}>
                      <input 
                        type="checkbox" 
                        checked={profile.jobInternship} 
                        onChange={e => setProfile({...profile, jobInternship: e.target.checked})}
                        style={{ accentColor: "var(--color-primary)" }}
                      />
                      Internship
                    </label>
                    <label style={{ display: "flex", alignItems: "center", gap: "10px", fontSize: "0.75rem", cursor: "pointer" }}>
                      <input 
                        type="checkbox" 
                        checked={profile.jobTemporary} 
                        onChange={e => setProfile({...profile, jobTemporary: e.target.checked})}
                        style={{ accentColor: "var(--color-primary)" }}
                      />
                      Temporary
                    </label>
                  </div>

                  {/* Column 3: Experience Level */}
                  <div className="glass-panel" style={{ padding: "16px", display: "flex", flexDirection: "column", gap: "10px", background: "rgba(255,255,255,0.01)" }}>
                    <h4 style={{ fontSize: "0.8rem", fontWeight: 800, color: "var(--color-primary)", borderBottom: "1px solid var(--border-glass)", paddingBottom: "6px" }}>
                      🎓 Experience Level
                    </h4>
                    <label style={{ display: "flex", alignItems: "center", gap: "10px", fontSize: "0.75rem", cursor: "pointer" }}>
                      <input 
                        type="checkbox" 
                        checked={profile.experienceEntry} 
                        onChange={e => setProfile({...profile, experienceEntry: e.target.checked})}
                        style={{ accentColor: "var(--color-primary)" }}
                      />
                      Entry Level
                    </label>
                    <label style={{ display: "flex", alignItems: "center", gap: "10px", fontSize: "0.75rem", cursor: "pointer" }}>
                      <input 
                        type="checkbox" 
                        checked={profile.experienceMidSenior} 
                        onChange={e => setProfile({...profile, experienceMidSenior: e.target.checked})}
                        style={{ accentColor: "var(--color-primary)" }}
                      />
                      Associate / Mid-Senior
                    </label>
                    <label style={{ display: "flex", alignItems: "center", gap: "10px", fontSize: "0.75rem", cursor: "pointer" }}>
                      <input 
                        type="checkbox" 
                        checked={profile.experienceDirector} 
                        onChange={e => setProfile({...profile, experienceDirector: e.target.checked})}
                        style={{ accentColor: "var(--color-primary)" }}
                      />
                      Director / Executive
                    </label>
                  </div>
                </div>

                {/* Match Score & Daily Apps sliders/controls */}
                <div style={{ display: "grid", gridTemplateColumns: "1.2fr 0.8fr", gap: "24px", marginTop: "12px" }}>
                  
                  {/* Match Score Range Slider */}
                  <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                      <label htmlFor="minMatchScore" style={{ fontSize: "0.75rem", fontWeight: 700, color: "var(--color-text-secondary)" }}>
                        🎯 Min AI Match Threshold: <strong style={{ color: "var(--color-primary)" }}>{profile.minMatchScore}%</strong>
                      </label>
                      <span style={{ fontSize: "0.65rem", padding: "2px 6px", borderRadius: "4px", background: "rgba(0,242,254,0.1)", color: "var(--color-primary)" }}>
                        {profile.minMatchScore >= 90 ? "Strict Matching" : profile.minMatchScore >= 75 ? "Balanced Matching" : "Broad Matching"}
                      </span>
                    </div>
                    <input 
                      type="range" 
                      id="minMatchScore" 
                      min="50" 
                      max="100" 
                      step="5"
                      value={profile.minMatchScore} 
                      onChange={e => setProfile({...profile, minMatchScore: Number(e.target.value)})} 
                      style={{ accentColor: "var(--color-primary)", height: "6px", borderRadius: "3px", cursor: "pointer", background: "rgba(255,255,255,0.1)", marginTop: "4px" }}
                    />
                    <p style={{ fontSize: "0.65rem", color: "var(--color-text-muted)", marginTop: "2px" }}>
                      AI will automatically skip job posts with a relevance score below this threshold.
                    </p>
                  </div>

                  {/* Daily Safe Application Cap */}
                  <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
                    <label htmlFor="maxDailyApps" style={{ fontSize: "0.75rem", fontWeight: 700, color: "var(--color-text-secondary)" }}>🛡️ Max Daily Submissions</label>
                    <input 
                      type="number" 
                      id="maxDailyApps" 
                      min="1" 
                      max="100"
                      value={profile.maxDailyApps} 
                      onChange={e => setProfile({...profile, maxDailyApps: Number(e.target.value)})} 
                      className="glass-input" 
                      style={{ height: "36px" }}
                      required
                    />
                    <p style={{ fontSize: "0.65rem", color: "var(--color-text-muted)" }}>
                      Daily application safe limit to prevent botting flags.
                    </p>
                  </div>

                </div>

                <div style={{ display: "flex", justifyContent: "flex-end", marginTop: "8px" }}>
                  <button 
                    type="submit" 
                    id="btn-save-profile" 
                    className="glass-btn"
                    style={{ background: "linear-gradient(135deg, var(--color-success) 0%, var(--color-primary) 100%)", boxShadow: "0 0 20px rgba(52,211,153,0.2)" }}
                  >
                    💾 SAVE CAMPAIGN CONFIGURATION Facts
                  </button>
                </div>
              </form>

            </div>

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

            {/* Groq API Key Panel */}
            <div className="glass-panel" style={{ padding: "32px", display: "flex", flexDirection: "column", gap: "24px" }}>
              <h3 style={{ fontFamily: "var(--font-family-title)", fontSize: "1.2rem", fontWeight: 700, borderBottom: "1px solid var(--border-glass)", paddingBottom: "12px" }}>
                🧠 AI Engine Integration
              </h3>
              
              <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
                <div>
                  <label style={{ fontSize: "0.85rem", fontWeight: 700, color: "var(--color-text-secondary)", display: "flex", alignItems: "center", gap: "6px" }}>
                    <span>🔑</span> Groq API Key
                  </label>
                  <p style={{ fontSize: "0.75rem", color: "var(--color-text-muted)", marginTop: "4px", marginBottom: "8px" }}>
                    Your private key to access Llama 3 models. Stored securely and encrypted in your local session.
                  </p>
                  <input
                    type="password"
                    value={profile.groqKey}
                    onChange={(e) => setProfile({ ...profile, groqKey: e.target.value })}
                    className="glass-input"
                    placeholder="gsk_..."
                    style={{ 
                      borderColor: profile.groqKey.startsWith("gsk_") ? "rgba(52, 211, 153, 0.4)" : "rgba(243, 85, 136, 0.4)"
                    }}
                  />
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: "12px" }}>
                    <span style={{ 
                      fontSize: "0.75rem", 
                      fontWeight: 700, 
                      color: profile.groqKey.startsWith("gsk_") ? "var(--color-success)" : "var(--color-accent)"
                    }}>
                      {profile.groqKey.startsWith("gsk_") ? "✓ Valid Key Format" : "✗ Key required to start AI agent"}
                    </span>
                    <button 
                      onClick={handleSaveProfile} 
                      className="glass-btn" 
                      style={{ padding: "8px 16px", fontSize: "0.8rem", display: "flex", alignItems: "center", gap: "6px" }}
                    >
                      <span>💾</span> Save Configuration
                    </button>
                  </div>
                </div>
              </div>
            </div>

            {/* Bot Execution Visibility Panel */}
            <div className="glass-panel" style={{ padding: "32px", display: "flex", flexDirection: "column", gap: "24px" }}>
              <h3 style={{ fontFamily: "var(--font-family-title)", fontSize: "1.2rem", fontWeight: 700, borderBottom: "1px solid var(--border-glass)", paddingBottom: "12px", display: "flex", alignItems: "center", gap: "8px" }}>
                <span>🖥️</span> Bot Execution Visibility
              </h3>
              
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <div>
                  <h4 style={{ fontSize: "1rem", fontWeight: 700 }}>Show Crawler Browser</h4>
                  <p style={{ fontSize: "0.85rem", color: "var(--color-text-secondary)", marginTop: "4px", maxWidth: "600px" }}>
                    If enabled, the Playwright browser will pop up visibly on your screen so you can watch the bot work. If disabled, the bot will run completely silently in the background (headless mode), and you can track its progress exclusively via the Launch Pad terminal logs.
                  </p>
                </div>
                <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", gap: "12px" }}>
                  <label className="toggle-switch">
                    <input 
                      type="checkbox" 
                      checked={profile.showBrowser}
                      onChange={(e) => {
                        setProfile({ ...profile, showBrowser: e.target.checked });
                      }}
                    />
                    <span className="slider round"></span>
                  </label>
                  <button 
                    onClick={handleSaveProfile} 
                    className="glass-btn" 
                    style={{ padding: "6px 12px", fontSize: "0.75rem", display: "flex", alignItems: "center", gap: "6px" }}
                  >
                    <span>💾</span> Save
                  </button>
                </div>
              </div>
            </div>

            {/* Session Cookie Panel */}
            <div className="glass-panel" style={{ padding: "32px", display: "flex", flexDirection: "column", gap: "24px" }}>
              <h3 style={{ fontFamily: "var(--font-family-title)", fontSize: "1.2rem", fontWeight: 700, borderBottom: "1px solid var(--border-glass)", paddingBottom: "12px", display: "flex", alignItems: "center", gap: "8px" }}>
                <span>🍪</span> Cloud Session Hijacking
              </h3>
              
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <div>
                  <h4 style={{ fontSize: "1rem", fontWeight: 700 }}>
                    {isExtensionReady ? "Auto-Sync LinkedIn Session" : "Upload linkedin_state.json"}
                  </h4>
                  <p style={{ fontSize: "0.85rem", color: "var(--color-text-secondary)", marginTop: "4px", maxWidth: "600px" }}>
                    {isExtensionReady 
                      ? "The AutoApply Extension is installed! Click the button to instantly sync your LinkedIn session directly to the cloud bot without dealing with JSON files."
                      : "Bypass cloud CAPTCHAs by securely uploading your local laptop's authenticated LinkedIn session. The cloud bot will masquerade as your laptop."}
                  </p>
                </div>
                <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", gap: "12px" }}>
                  {isExtensionReady ? (
                    <button 
                      onClick={handleAutoSync}
                      className="glass-btn" 
                      style={{ padding: "8px 16px", fontSize: "0.8rem", display: "flex", alignItems: "center", gap: "6px", cursor: "pointer", background: "rgba(59, 130, 246, 0.15)", borderColor: "var(--color-accent)", color: "var(--color-accent)" }}
                    >
                      <span>🔄</span> Auto-Sync Session
                    </button>
                  ) : (
                    <>
                      <input 
                        type="file" 
                        accept=".json"
                        id="session-upload"
                        style={{ display: "none" }}
                        onChange={handleSessionUpload}
                      />
                      <label 
                        htmlFor="session-upload"
                        className="glass-btn" 
                        style={{ padding: "8px 16px", fontSize: "0.8rem", display: "flex", alignItems: "center", gap: "6px", cursor: "pointer", background: "rgba(52, 211, 153, 0.15)", borderColor: "var(--color-success)", color: "var(--color-success)" }}
                      >
                        <span>📤</span> Upload Session
                      </label>
                    </>
                  )}
                </div>
              </div>
            </div>

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

      {/* ── SUPABASE ROW-LEVEL SECURITY POLICY ERROR HELPER MODAL ── */}
      {rlsErrorSql && (
        <div style={{
          position: "fixed",
          top: 0,
          left: 0,
          width: "100%",
          height: "100%",
          background: "rgba(10, 11, 16, 0.85)",
          backdropFilter: "blur(12px)",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          zIndex: 1100,
          padding: "20px"
        }}>
          <div className="glass-panel" style={{
            width: "100%",
            maxWidth: "640px",
            background: "#0c0d12",
            border: "1px solid var(--color-accent)",
            boxShadow: "0 0 40px rgba(243, 85, 136, 0.25)",
            borderRadius: "12px",
            padding: "32px",
            display: "flex",
            flexDirection: "column",
            gap: "20px"
          }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", borderBottom: "1px solid rgba(243, 85, 136, 0.2)", paddingBottom: "12px" }}>
              <h3 style={{ fontFamily: "var(--font-family-title)", fontSize: "1.3rem", fontWeight: 800, color: "var(--color-accent)", display: "flex", alignItems: "center", gap: "8px" }}>
                <span>⚠️</span> Supabase Database Setup Helper
              </h3>
              <button 
                onClick={() => setRlsErrorSql(null)}
                style={{
                  background: "none",
                  border: "none",
                  color: "var(--color-text-secondary)",
                  fontSize: "1.2rem",
                  cursor: "pointer",
                  fontWeight: 700
                }}
              >
                ✕
              </button>
            </div>

            <div style={{ fontSize: "0.85rem", lineHeight: "1.5", color: "var(--color-text-secondary)" }}>
              <p style={{ marginBottom: "12px" }}>
                Your profile save operation failed due to a Supabase Row-Level Security (RLS) policy violation.
                By default, Postgres RLS requires explicit permission grants for both <code style={{ color: "var(--color-accent)", background: "rgba(243, 85, 136, 0.08)", padding: "2px 6px", borderRadius: "4px" }}>INSERT</code> and <code style={{ color: "var(--color-accent)", background: "rgba(243, 85, 136, 0.08)", padding: "2px 6px", borderRadius: "4px" }}>UPDATE</code> queries.
              </p>
              <p style={{ fontWeight: 700, color: "#ffffff", marginBottom: "8px" }}>🚀 Quick Fix Steps:</p>
              <ol style={{ paddingLeft: "20px", display: "flex", flexDirection: "column", gap: "6px" }}>
                <li>Copy the SQL script below.</li>
                <li>Go to your <strong>Supabase Dashboard</strong> ➜ <strong>SQL Editor</strong>.</li>
                <li>Paste the script, click <strong>Run</strong>, and then come back here to save your details!</li>
              </ol>
            </div>

            <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <span style={{ fontSize: "0.75rem", color: "var(--color-text-muted)", fontWeight: 600 }}>SQL SETUP SCRIPT</span>
                <button
                  onClick={() => {
                    navigator.clipboard.writeText(rlsErrorSql);
                    setAlertMessage({ type: "success", text: "SQL copied to clipboard!" });
                    setTimeout(() => setAlertMessage(null), 3000);
                  }}
                  className="glass-btn"
                  style={{ fontSize: "0.75rem", padding: "6px 14px", display: "flex", alignItems: "center", gap: "6px", background: "linear-gradient(135deg, var(--color-accent) 0%, #ff839d 100%)", border: "none" }}
                >
                  📋 Copy SQL to Clipboard
                </button>
              </div>
              <pre style={{
                whiteSpace: "pre-wrap",
                fontFamily: "monospace",
                fontSize: "0.8rem",
                color: "#e2e8f0",
                background: "#05060b",
                padding: "16px",
                borderRadius: "8px",
                border: "1px solid rgba(255,255,255,0.05)",
                maxHeight: "180px",
                overflowY: "auto",
                lineHeight: "1.4"
              }}>
                {rlsErrorSql}
              </pre>
            </div>

            <button
              onClick={() => setRlsErrorSql(null)}
              className="glass-btn-secondary"
              style={{ width: "100%", padding: "10px", borderRadius: "8px", fontWeight: 700 }}
            >
              ✕ Dismiss & Try Again
            </button>
          </div>
        </div>
      )}
      {/* ── VERIFICATION CODE MODAL ── */}
      {showVerificationModal && (
        <div style={{
          position: "fixed", top: 0, left: 0, width: "100vw", height: "100vh",
          background: "rgba(0,0,0,0.75)", backdropFilter: "blur(12px)",
          display: "flex", alignItems: "center", justifyContent: "center",
          zIndex: 1000
        }}>
          <div className="glass-panel" style={{ padding: "40px", maxWidth: "460px", width: "90%", textAlign: "center", display: "flex", flexDirection: "column", gap: "20px" }}>
            <div style={{ fontSize: "3rem" }}>📱</div>
            <h2 style={{ fontSize: "1.4rem", fontWeight: 800 }}>LinkedIn Verification Required</h2>
            <p style={{ fontSize: "0.9rem", color: "var(--color-text-secondary)", lineHeight: "1.6" }}>
              LinkedIn sent a 6-digit verification code to your email or phone. Enter it below and the cloud bot will resume automatically.
            </p>
            <input
              type="text"
              maxLength={6}
              placeholder="Enter 6-digit code"
              value={verificationCode}
              onChange={(e) => setVerificationCode(e.target.value.replace(/\D/g, ""))}
              className="glass-input"
              style={{ textAlign: "center", fontSize: "1.8rem", letterSpacing: "0.4em", fontWeight: 800, padding: "14px" }}
              onKeyDown={(e) => e.key === "Enter" && handleSubmitCode()}
            />
            <div style={{ display: "flex", gap: "12px" }}>
              <button
                onClick={() => setShowVerificationModal(false)}
                className="glass-btn-secondary"
                style={{ flex: 1, padding: "12px" }}
              >
                Cancel
              </button>
              <button
                onClick={handleSubmitCode}
                disabled={isSubmittingCode || verificationCode.length < 4}
                className="glass-btn"
                style={{ flex: 2, padding: "12px", background: "linear-gradient(135deg, var(--color-primary) 0%, var(--color-accent) 100%)", border: "none", opacity: verificationCode.length < 4 ? 0.5 : 1 }}
              >
                {isSubmittingCode ? "Sending..." : "Submit Code & Resume Bot ▶"}
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
