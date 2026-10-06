import React, { useEffect, useRef, useState } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import {
  Send,
  RotateCcw,
  ExternalLink,
  Download,
  Printer,
  Copy,
  Check,
  Search,
  Play,
  FileText,
} from 'lucide-react';
import { MermaidDiagram } from './components/MermaidDiagram';
import {
  DEFAULT_PORTAL_SPEC,
  ProcessPortalSpec,
  renderUnifiedMarkdownDocument,
  buildDrawioUrl,
} from './data/defaultSpec';

interface ChatMessage {
  id: string;
  role: 'user' | 'agent';
  content: string;
  timestamp: string;
  processFlowReady?: boolean;
  currentStateMermaid?: string;
  improvedStateMermaid?: string;
  currentStateDrawioUrl?: string;
  improvedStateDrawioUrl?: string;
}

const PRESET_PROCESSES = [
  {
    id: 'software-access',
    label: 'Employee Software Access Request',
    processName: 'Employee Software Access Request',
    businessObjective:
      'Provide employees access to approved software quickly while maintaining manager approval and security controls.',
    triggerCondition: 'An employee submits a software access request in the service portal.',
    endCondition: 'Access is granted or the request is rejected and documented.',
    processStepsText: `1. Employee submits a software access request in the service portal.
2. Manager reviews and approves or rejects the request.
3. Approved requests enter the IT Service Desk queue.
4. Service Desk manually checks whether the employee already has a license and whether the requested software is approved.
5. If information is missing, the Service Desk sends the request back to the employee for clarification.
6. Service Desk manually emails the Security team for approval when the software requires elevated access.
7. Security reviews the request and responds by email.
8. Service Desk updates the ticket manually with the Security decision.
9. If approved, Service Desk assigns the request to the Application Support team.
10. Application Support provisions the software.
11. Service Desk confirms access with the employee and closes the ticket.`,
    knownBottlenecksText: `- Bottleneck 1 (Step 4): Manual license and software-approval checks take time and are repeated for many requests.
- Bottleneck 2 (Steps 6-8): Security approval is handled through email, creating waiting time and manual ticket updates.`,
    currentMetricsText: `- About 60 requests per day.
- Average completion time: 2 business days.
- About 15% of requests are returned because required information is missing.
- Security-related requests can wait 4-6 hours for approval.`,
    requiredControlsText: `- Manager approval.
- Security approval for elevated-access software.
- Audit trail of approvals.
- Final access confirmation.`,
  },
  {
    id: 'vendor-onboarding',
    label: 'Enterprise Vendor Onboarding & Risk Review',
    processName: 'Enterprise Vendor Onboarding & Risk Review',
    businessObjective:
      'Onboard new suppliers into the ERP procurement system efficiently while enforcing tax, banking fraud, legal, and InfoSec controls.',
    triggerCondition: 'Business requester submits a New Vendor Request form.',
    endCondition: 'Vendor master record is active in ERP or rejected with compliance documentation.',
    processStepsText: `1. Requester emails a spreadsheet intake form to Procurement.
2. Procurement manually checks if the vendor already exists in the ERP vendor master.
3. Procurement emails W-9/W-8 tax forms and ACH banking PDF forms to the vendor contact.
4. Vendor emails back scanned PDFs; 25% have missing tax IDs or unsigned banking letters.
5. Procurement manually emails InfoSec when the vendor will access corporate data.
6. InfoSec conducts security questionnaire via email attachments (takes 5-8 business days).
7. Accounts Payable calls the vendor by phone to verify bank routing/account numbers and types notes into an email.
8. Procurement manually keys all vendor details into the ERP system.
9. Finance Manager reviews and activates the vendor profile in ERP.`,
    knownBottlenecksText: `- Step 1 & 4: Emailing spreadsheets and PDFs causes 25% rework due to missing tax/banking fields.
- Step 5 & 6: InfoSec questionnaire handled via manual email attachments adds 5-8 days of queue delay.
- Step 8: Duplicate manual data entry from PDFs into ERP causes typos and payment holds.`,
    currentMetricsText: `- 25 new vendor requests per week.
- Average end-to-end onboarding time: 14 business days.
- 25% of vendor packets returned due to incomplete tax or banking forms.`,
    requiredControlsText: `- Duplicate vendor check before creation.
- Validated tax ID (TIN/EIN) and OFAC sanctions screening.
- Out-of-band bank account verification for fraud prevention.
- InfoSec approval for vendors handling sensitive data.
- Finance Manager final activation approval (segregation of duties).`,
  },
];

export default function App() {
  const [activeView, setActiveView] = useState<
    'document' | 'intake' | 'diagrams' | 'stories-qa' | 'chat'
  >('document');

  const [spec, setSpec] = useState<ProcessPortalSpec>(DEFAULT_PORTAL_SPEC);
  const [analyzingPortal, setAnalyzingPortal] = useState(false);
  const [portalError, setPortalError] = useState<string | null>(null);
  const [copiedMarkdown, setCopiedMarkdown] = useState(false);

  // Portal Intake Form State
  const [processName, setProcessName] = useState(PRESET_PROCESSES[0].processName);
  const [businessObjective, setBusinessObjective] = useState(
    PRESET_PROCESSES[0].businessObjective
  );
  const [triggerCondition, setTriggerCondition] = useState(
    PRESET_PROCESSES[0].triggerCondition
  );
  const [endCondition, setEndCondition] = useState(PRESET_PROCESSES[0].endCondition);
  const [processStepsText, setProcessStepsText] = useState(
    PRESET_PROCESSES[0].processStepsText
  );
  const [knownBottlenecksText, setKnownBottlenecksText] = useState(
    PRESET_PROCESSES[0].knownBottlenecksText
  );
  const [currentMetricsText, setCurrentMetricsText] = useState(
    PRESET_PROCESSES[0].currentMetricsText
  );
  const [requiredControlsText, setRequiredControlsText] = useState(
    PRESET_PROCESSES[0].requiredControlsText
  );
  const [rawNotes, setRawNotes] = useState('');

  // Filters for Stories & QA Matrix view
  const [acScenarioFilter, setAcScenarioFilter] = useState<
    'All' | 'Positive' | 'Negative' | 'Boundary'
  >('All');
  const [testSuiteFilter, setTestSuiteFilter] = useState<'All' | 'QA' | 'UAT'>('All');
  const [searchQuery, setSearchQuery] = useState('');

  // Interactive Chat State
  const [sessionId] = useState(
    () => 'session-' + Math.random().toString(36).slice(2, 10)
  );
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [chatInput, setChatInput] = useState('');
  const [chatLoading, setChatLoading] = useState(false);
  const [chatError, setChatError] = useState<string | null>(null);
  const chatEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, chatLoading]);

  const loadPreset = (presetId: string) => {
    const found = PRESET_PROCESSES.find((p) => p.id === presetId);
    if (!found) return;
    setProcessName(found.processName);
    setBusinessObjective(found.businessObjective);
    setTriggerCondition(found.triggerCondition);
    setEndCondition(found.endCondition);
    setProcessStepsText(found.processStepsText);
    setKnownBottlenecksText(found.knownBottlenecksText);
    setCurrentMetricsText(found.currentMetricsText);
    setRequiredControlsText(found.requiredControlsText);
    if (presetId === 'software-access') {
      setSpec(DEFAULT_PORTAL_SPEC);
    }
  };

  const handleAnalyzeProcessPortal = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (analyzingPortal) return;

    setPortalError(null);
    setAnalyzingPortal(true);

    try {
      const res = await fetch('/api/portal/analyze', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          processName,
          businessObjective,
          triggerCondition,
          endCondition,
          processStepsText,
          knownBottlenecksText,
          currentMetricsText,
          requiredControlsText,
          rawNotes,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Failed to analyze process flow.');
      }

      if (data.spec) {
        setSpec(data.spec);
        setActiveView('document');
      }
    } catch (err: unknown) {
      setPortalError(
        err instanceof Error ? err.message : 'Error generating portal specification.'
      );
    } finally {
      setAnalyzingPortal(false);
    }
  };

  const handleSendChat = async (overridePrompt?: string) => {
    const textToSend = (overridePrompt ?? chatInput).trim();
    if (!textToSend || chatLoading) return;

    setChatError(null);
    if (!overridePrompt) setChatInput('');

    const userMsg: ChatMessage = {
      id: 'user-' + Date.now(),
      role: 'user',
      content: textToSend,
      timestamp: new Date().toLocaleTimeString([], {
        hour: '2-digit',
        minute: '2-digit',
      }),
    };

    setMessages((prev) => [...prev, userMsg]);
    setChatLoading(true);

    try {
      const res = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: textToSend,
          sessionId,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Failed to communicate with AI Agent.');
      }

      const agentMsg: ChatMessage = {
        id: 'agent-' + Date.now(),
        role: 'agent',
        content: data.output,
        timestamp: new Date().toLocaleTimeString([], {
          hour: '2-digit',
          minute: '2-digit',
        }),
        processFlowReady: data.processFlowReady,
        currentStateMermaid: data.currentStateMermaid,
        improvedStateMermaid: data.improvedStateMermaid,
        currentStateDrawioUrl: data.currentStateDrawioUrl,
        improvedStateDrawioUrl: data.improvedStateDrawioUrl,
      };

      setMessages((prev) => [...prev, agentMsg]);

      // If chat produced new AS-IS and TO-BE Mermaid diagrams, update the live diagram links in the portal spec too
      if (
        data.processFlowReady &&
        data.currentStateMermaid &&
        data.improvedStateMermaid
      ) {
        setSpec((prev) => ({
          ...prev,
          currentStateMermaid: data.currentStateMermaid,
          improvedStateMermaid: data.improvedStateMermaid,
          currentStateDrawioUrl:
            data.currentStateDrawioUrl ||
            buildDrawioUrl(data.currentStateMermaid, 'AS-IS Process'),
          improvedStateDrawioUrl:
            data.improvedStateDrawioUrl ||
            buildDrawioUrl(data.improvedStateMermaid, 'TO-BE Process'),
        }));
      }
    } catch (err: unknown) {
      setChatError(
        err instanceof Error ? err.message : 'Error communicating with chat endpoint.'
      );
    } finally {
      setChatLoading(false);
    }
  };

  const handleConvertChatToFullPortalSpec = async () => {
    if (messages.length === 0 || analyzingPortal) return;
    const transcript = messages
      .map((m) => `${m.role.toUpperCase()}:\n${m.content}`)
      .join('\n\n---\n\n');
    setRawNotes(transcript);
    setAnalyzingPortal(true);
    setPortalError(null);
    try {
      const res = await fetch('/api/portal/analyze', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          processName: processName || 'Chat-Discovered Business Process',
          businessObjective,
          triggerCondition,
          endCondition,
          processStepsText,
          knownBottlenecksText,
          currentMetricsText,
          requiredControlsText,
          rawNotes: transcript,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to build specification');
      if (data.spec) {
        setSpec(data.spec);
        setActiveView('document');
      }
    } catch (err: unknown) {
      setChatError(
        err instanceof Error ? err.message : 'Failed to convert chat to specification'
      );
    } finally {
      setAnalyzingPortal(false);
    }
  };

  const handleResetChat = async () => {
    await fetch('/api/memory/clear', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ sessionId }),
    }).catch(() => {});
    setMessages([]);
    setChatError(null);
  };

  const handleDownloadUnifiedMarkdown = () => {
    const md = renderUnifiedMarkdownDocument(spec);
    const blob = new Blob([md], { type: 'text/markdown;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    const slug = spec.processName.toLowerCase().replace(/[^a-z0-9]+/g, '-');
    a.href = url;
    a.download = `${slug}-process-improvement-and-user-stories.md`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleCopyUnifiedMarkdown = async () => {
    const md = renderUnifiedMarkdownDocument(spec);
    await navigator.clipboard.writeText(md);
    setCopiedMarkdown(true);
    setTimeout(() => setCopiedMarkdown(false), 2000);
  };

  const scrollToSection = (sectionId: string) => {
    setActiveView('document');
    setTimeout(() => {
      const el = document.getElementById(sectionId);
      el?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }, 50);
  };

  const filteredStories = spec.functionalStories.filter((story) => {
    if (!searchQuery.trim()) return true;
    const q = searchQuery.toLowerCase();
    return (
      story.storyId.toLowerCase().includes(q) ||
      story.title.toLowerCase().includes(q) ||
      story.userStoryStatement.toLowerCase().includes(q) ||
      story.persona.toLowerCase().includes(q)
    );
  });

  const filteredTestCases = spec.testCases.filter((tc) => {
    const matchesSuite = testSuiteFilter === 'All' || tc.suite === testSuiteFilter;
    const matchesScenario =
      acScenarioFilter === 'All' || tc.scenarioCategory === acScenarioFilter;
    const matchesSearch =
      !searchQuery.trim() ||
      tc.testCaseId.toLowerCase().includes(searchQuery.toLowerCase()) ||
      tc.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      tc.linkedStoryId.toLowerCase().includes(searchQuery.toLowerCase());
    return matchesSuite && matchesScenario && matchesSearch;
  });

  return (
    <div className="min-h-screen flex flex-col bg-slate-950 text-slate-100">
      {/* Strict 3-Zone Top Bar Contract */}
      <header className="sticky top-0 z-30 border-b border-slate-800 bg-slate-950/95 backdrop-blur-sm no-print">
        <div className="max-w-[1440px] mx-auto px-6 h-16 flex items-center justify-between gap-6">
          {/* Zone 1: Single text element wordmark */}
          <a
            href="#top"
            onClick={(e) => {
              e.preventDefault();
              setActiveView('document');
            }}
            className="text-lg font-bold tracking-tight text-white whitespace-nowrap shrink-0 no-underline"
          >
            ProcessFlow Portal
          </a>

          {/* Zone 2: 5 clean text navigation links */}
          <nav className="hidden md:flex items-center gap-6 text-sm font-medium text-slate-400">
            <button
              type="button"
              onClick={() => setActiveView('document')}
              className={`py-1 transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                activeView === 'document'
                  ? 'text-white border-b-2 border-sky-400 font-semibold'
                  : 'hover:text-slate-200'
              }`}
            >
              Unified Document
            </button>
            <button
              type="button"
              onClick={() => setActiveView('intake')}
              className={`py-1 transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                activeView === 'intake'
                  ? 'text-white border-b-2 border-sky-400 font-semibold'
                  : 'hover:text-slate-200'
              }`}
            >
              Process Intake
            </button>
            <button
              type="button"
              onClick={() => setActiveView('diagrams')}
              className={`py-1 transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                activeView === 'diagrams'
                  ? 'text-white border-b-2 border-sky-400 font-semibold'
                  : 'hover:text-slate-200'
              }`}
            >
              Draw.io Flows
            </button>
            <button
              type="button"
              onClick={() => setActiveView('stories-qa')}
              className={`py-1 transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                activeView === 'stories-qa'
                  ? 'text-white border-b-2 border-sky-400 font-semibold'
                  : 'hover:text-slate-200'
              }`}
            >
              Stories &amp; QA
            </button>
            <button
              type="button"
              onClick={() => setActiveView('chat')}
              className={`py-1 transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                activeView === 'chat'
                  ? 'text-white border-b-2 border-sky-400 font-semibold'
                  : 'hover:text-slate-200'
              }`}
            >
              Discovery Chat
            </button>
          </nav>

          {/* Zone 3: 2 primary actions */}
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={handleDownloadUnifiedMarkdown}
              className="inline-flex items-center gap-2 px-4 py-2 text-xs font-semibold text-slate-200 bg-slate-900 border border-slate-700 rounded-lg hover:bg-slate-800 transition-colors whitespace-nowrap shrink-0 cursor-pointer"
            >
              <Download className="w-3.5 h-3.5" />
              Export Document (.md)
            </button>
            <button
              type="button"
              onClick={() => window.print()}
              className="inline-flex items-center gap-2 px-4 py-2 text-xs font-semibold text-slate-950 bg-sky-400 rounded-lg hover:bg-sky-300 transition-colors whitespace-nowrap shrink-0 cursor-pointer"
            >
              <Printer className="w-3.5 h-3.5" />
              Print / Save PDF
            </button>
          </div>
        </div>

        {/* Mobile navigation bar */}
        <div className="flex md:hidden items-center gap-4 px-6 py-2.5 border-t border-slate-800/80 overflow-x-auto text-xs font-medium text-slate-400">
          <button
            type="button"
            onClick={() => setActiveView('document')}
            className={`whitespace-nowrap shrink-0 ${
              activeView === 'document' ? 'text-sky-400 font-semibold' : ''
            }`}
          >
            Unified Document
          </button>
          <button
            type="button"
            onClick={() => setActiveView('intake')}
            className={`whitespace-nowrap shrink-0 ${
              activeView === 'intake' ? 'text-sky-400 font-semibold' : ''
            }`}
          >
            Process Intake
          </button>
          <button
            type="button"
            onClick={() => setActiveView('diagrams')}
            className={`whitespace-nowrap shrink-0 ${
              activeView === 'diagrams' ? 'text-sky-400 font-semibold' : ''
            }`}
          >
            Draw.io Flows
          </button>
          <button
            type="button"
            onClick={() => setActiveView('stories-qa')}
            className={`whitespace-nowrap shrink-0 ${
              activeView === 'stories-qa' ? 'text-sky-400 font-semibold' : ''
            }`}
          >
            Stories &amp; QA
          </button>
          <button
            type="button"
            onClick={() => setActiveView('chat')}
            className={`whitespace-nowrap shrink-0 ${
              activeView === 'chat' ? 'text-sky-400 font-semibold' : ''
            }`}
          >
            Discovery Chat
          </button>
        </div>
      </header>

      {/* Main Workspace Container (1440px baseline) */}
      <div className="flex-1 max-w-[1440px] w-full mx-auto px-6 py-8 flex flex-col lg:flex-row gap-8">
        {/* Left Sidebar Navigation & Quick Process Switcher */}
        <aside className="w-full lg:w-64 shrink-0 space-y-6 no-print">
          <div className="p-4 rounded-lg border border-slate-800 bg-slate-900/60 space-y-3">
            <div className="text-xs font-semibold text-slate-300">
              Active Process Specification
            </div>
            <div className="text-sm font-semibold text-white leading-snug">
              {spec.processName}
            </div>
            <div className="text-xs text-slate-400 tabular-nums">
              <span>v{spec.documentVersion}</span>
              <span aria-hidden="true"> · </span>
              <span>{spec.asIsSteps.length} AS-IS Steps</span>
              <span aria-hidden="true"> · </span>
              <span>{spec.toBeSteps.length} TO-BE Steps</span>
            </div>
            <div className="text-xs text-slate-400 tabular-nums">
              <span>{spec.functionalStories.length} User Stories</span>
              <span aria-hidden="true"> · </span>
              <span>{spec.testCases.length} QA/UAT Cases</span>
            </div>
            <div className="pt-2 flex flex-col gap-2">
              <button
                type="button"
                onClick={() => setActiveView('intake')}
                className="w-full px-3 py-2 rounded-md text-xs font-semibold bg-sky-500 hover:bg-sky-400 text-slate-950 transition-colors whitespace-nowrap cursor-pointer"
              >
                Analyze New / Edit Process
              </button>
              <button
                type="button"
                onClick={handleCopyUnifiedMarkdown}
                className="w-full inline-flex items-center justify-center gap-1.5 px-3 py-2 rounded-md text-xs font-medium bg-slate-800 hover:bg-slate-700 text-slate-200 transition-colors whitespace-nowrap cursor-pointer"
              >
                {copiedMarkdown ? (
                  <Check className="w-3.5 h-3.5 text-emerald-400" />
                ) : (
                  <Copy className="w-3.5 h-3.5" />
                )}
                {copiedMarkdown ? 'Copied Full Markdown' : 'Copy Full Document'}
              </button>
            </div>
          </div>

          {/* Document Section Outline */}
          <div className="p-4 rounded-lg border border-slate-800 bg-slate-900/60 space-y-2.5">
            <div className="text-xs font-semibold text-slate-300 mb-2">
              Unified Document Sections
            </div>
            {[
              { id: 'sec-1-current', label: '01. Current Process (AS-IS)' },
              { id: 'sec-2-limitations', label: '02. Process Limitations & Bottlenecks' },
              { id: 'sec-3-asis-flow', label: '03. Current AS-IS Flow Diagram' },
              { id: 'sec-4-recommendations', label: '04. TO-BE Recommendations' },
              { id: 'sec-5-tobe-flow', label: '05. TO-BE Process Flow Image' },
              { id: 'sec-6-stories-ac', label: '06. Functional Stories & 07. Acceptance Criteria' },
              { id: 'sec-8-test-cases', label: '08. QA & UAT Test Cases' },
            ].map((item) => (
              <button
                key={item.id}
                type="button"
                onClick={() => scrollToSection(item.id)}
                className="w-full text-left px-2.5 py-1.5 rounded text-xs text-slate-400 hover:text-white hover:bg-slate-800/70 transition-colors block truncate cursor-pointer"
              >
                {item.label}
              </button>
            ))}
          </div>

          {/* Direct Draw.io Quick Links */}
          <div className="p-4 rounded-lg border border-slate-800 bg-slate-900/60 space-y-2.5">
            <div className="text-xs font-semibold text-slate-300">
              Direct draw.io Editors
            </div>
            <a
              href={spec.currentStateDrawioUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="w-full flex items-center justify-between px-3 py-2 rounded-md text-xs font-medium bg-slate-950 hover:bg-slate-800 text-red-300 border border-slate-800 transition-colors no-underline"
            >
              <span>Open AS-IS in draw.io</span>
              <ExternalLink className="w-3.5 h-3.5 shrink-0" />
            </a>
            <a
              href={spec.improvedStateDrawioUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="w-full flex items-center justify-between px-3 py-2 rounded-md text-xs font-medium bg-slate-950 hover:bg-slate-800 text-emerald-300 border border-slate-800 transition-colors no-underline"
            >
              <span>Open TO-BE in draw.io</span>
              <ExternalLink className="w-3.5 h-3.5 shrink-0" />
            </a>
          </div>
        </aside>

        {/* Main Viewport */}
        <main className="flex-1 min-w-0">
          {/* VIEW 1: UNIFIED SPECIFICATION DOCUMENT (All 8 Required Sections in One Document) */}
          {activeView === 'document' && (
            <div className="space-y-10">
              {/* Document Header Banner */}
              <div className="pb-6 border-b border-slate-800 flex flex-wrap items-start justify-between gap-4">
                <div className="space-y-2 max-w-3xl">
                  <div className="text-xs text-slate-400 tabular-nums">
                    <span>Business Process &amp; Agile Engineering Specification</span>
                    <span aria-hidden="true"> · </span>
                    <span>Version {spec.documentVersion}</span>
                    <span aria-hidden="true"> · </span>
                    <span>Generated {spec.generatedAt}</span>
                  </div>
                  <h1 className="text-2xl sm:text-3xl font-bold text-white tracking-tight">
                    {spec.processName}
                  </h1>
                  <p className="text-sm text-slate-300 leading-relaxed">
                    {spec.businessObjective}
                  </p>
                </div>

                <div className="flex items-center gap-2 no-print">
                  <button
                    type="button"
                    onClick={() => setActiveView('intake')}
                    className="px-3.5 py-2 rounded-lg text-xs font-medium bg-slate-900 hover:bg-slate-800 text-slate-200 border border-slate-700 transition-colors whitespace-nowrap cursor-pointer"
                  >
                    Edit Process Input
                  </button>
                  <button
                    type="button"
                    onClick={() => setActiveView('chat')}
                    className="px-3.5 py-2 rounded-lg text-xs font-semibold bg-sky-500 hover:bg-sky-400 text-slate-950 transition-colors whitespace-nowrap cursor-pointer"
                  >
                    Refine via AI Chat
                  </button>
                </div>
              </div>

              {/* SECTION 1: CURRENT PROCESS */}
              <section id="sec-1-current" className="space-y-5 scroll-mt-24">
                <div className="border-b border-slate-800 pb-3">
                  <h2 className="text-xl font-semibold text-white">
                    01. Current Process (AS-IS State)
                  </h2>
                  <p className="text-xs text-slate-400 mt-1">
                    End-to-end scope, operational baseline metrics, mandatory controls, and sequential AS-IS steps.
                  </p>
                </div>

                <p className="text-sm text-slate-300 leading-relaxed">
                  {spec.executiveSummary}
                </p>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6 py-2">
                  <div className="p-4 rounded-lg border border-slate-800 bg-slate-900/40 space-y-2">
                    <div className="text-xs font-semibold text-slate-300">
                      Process Boundaries
                    </div>
                    <div className="text-xs text-slate-300 space-y-1.5">
                      <p>
                        <strong className="text-white">Trigger / Start:</strong>{' '}
                        {spec.triggerCondition}
                      </p>
                      <p>
                        <strong className="text-white">End Condition:</strong>{' '}
                        {spec.endCondition}
                      </p>
                    </div>
                  </div>

                  <div className="p-4 rounded-lg border border-slate-800 bg-slate-900/40 space-y-2">
                    <div className="text-xs font-semibold text-slate-300">
                      Baseline Operational Metrics &amp; Mandatory Controls
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs text-slate-300">
                      <ul className="list-disc pl-4 space-y-1 tabular-nums">
                        {spec.currentMetrics.map((m, i) => (
                          <li key={i}>{m}</li>
                        ))}
                      </ul>
                      <ul className="list-disc pl-4 space-y-1">
                        {spec.preservedControls.map((c, i) => (
                          <li key={i}>{c}</li>
                        ))}
                      </ul>
                    </div>
                  </div>
                </div>

                {/* AS-IS Process Steps Table */}
                <div className="overflow-x-auto border border-slate-800 rounded-lg">
                  <table className="w-full text-left border-collapse text-xs tabular-nums">
                    <thead>
                      <tr className="bg-slate-900 border-b border-slate-800 text-slate-200">
                        <th className="py-2.5 px-3 font-semibold w-14">Step #</th>
                        <th className="py-2.5 px-3 font-semibold">Process Step</th>
                        <th className="py-2.5 px-3 font-semibold">Detailed Description</th>
                        <th className="py-2.5 px-3 font-semibold">Owner</th>
                        <th className="py-2.5 px-3 font-semibold">System</th>
                        <th className="py-2.5 px-3 font-semibold">Input / Output</th>
                        <th className="py-2.5 px-3 font-semibold">Bottleneck Status</th>
                        <th className="py-2.5 px-3 font-semibold">Control / Dependency</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-800/80 text-slate-300">
                      {spec.asIsSteps.map((step) => {
                        const isBottleneck = step.bottleneckStatus !== 'None';
                        return (
                          <tr
                            key={step.stepNumber}
                            className={
                              isBottleneck
                                ? 'bg-red-950/20 hover:bg-red-950/30'
                                : 'hover:bg-slate-900/40'
                            }
                          >
                            <td className="py-2.5 px-3 font-mono font-semibold text-white">
                              {step.stepNumber}
                            </td>
                            <td className="py-2.5 px-3 font-semibold text-white">
                              {step.stepName}
                            </td>
                            <td className="py-2.5 px-3 leading-relaxed">
                              {step.description}
                            </td>
                            <td className="py-2.5 px-3">{step.owner}</td>
                            <td className="py-2.5 px-3">{step.system}</td>
                            <td className="py-2.5 px-3 text-slate-400">
                              <div>In: {step.input}</div>
                              <div>Out: {step.output}</div>
                            </td>
                            <td
                              className={`py-2.5 px-3 font-semibold ${
                                step.bottleneckStatus === 'Confirmed Bottleneck'
                                  ? 'text-red-400'
                                  : step.bottleneckStatus === 'Likely Bottleneck'
                                  ? 'text-amber-400'
                                  : 'text-slate-400'
                              }`}
                            >
                              {step.bottleneckStatus}
                            </td>
                            <td className="py-2.5 px-3">{step.controlOrDependency}</td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </section>

              {/* SECTION 2: ITS LIMITATIONS AFTER ANALYSIS */}
              <section id="sec-2-limitations" className="space-y-5 scroll-mt-24">
                <div className="border-b border-slate-800 pb-3">
                  <h2 className="text-xl font-semibold text-white">
                    02. Its Limitations After Analysis (Bottlenecks &amp; Root Causes)
                  </h2>
                  <p className="text-xs text-slate-400 mt-1">
                    Evidence-backed bottlenecks, operational wait states, manual rework loops, and root-cause hypotheses.
                  </p>
                </div>

                <div className="overflow-x-auto border border-slate-800 rounded-lg">
                  <table className="w-full text-left border-collapse text-xs tabular-nums">
                    <thead>
                      <tr className="bg-slate-900 border-b border-slate-800 text-slate-200">
                        <th className="py-2.5 px-3 font-semibold">ID</th>
                        <th className="py-2.5 px-3 font-semibold">AS-IS Steps</th>
                        <th className="py-2.5 px-3 font-semibold">Limitation / Bottleneck</th>
                        <th className="py-2.5 px-3 font-semibold">Evidence &amp; Classification</th>
                        <th className="py-2.5 px-3 font-semibold">Business Impact</th>
                        <th className="py-2.5 px-3 font-semibold">Root-Cause Hypothesis</th>
                        <th className="py-2.5 px-3 font-semibold">Priority</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-800/80 text-slate-300">
                      {spec.limitations.map((lim) => (
                        <tr key={lim.id} className="hover:bg-slate-900/40">
                          <td className="py-3 px-3 font-mono font-semibold text-red-400 whitespace-nowrap">
                            {lim.id}
                          </td>
                          <td className="py-3 px-3 font-mono text-white whitespace-nowrap">
                            {lim.relatedSteps}
                          </td>
                          <td className="py-3 px-3 font-semibold text-white">
                            {lim.title}
                          </td>
                          <td className="py-3 px-3 leading-relaxed">
                            <div className="font-medium text-slate-200 mb-1">
                              {lim.classification}
                            </div>
                            <div className="text-slate-400">{lim.evidence}</div>
                          </td>
                          <td className="py-3 px-3 leading-relaxed">{lim.impact}</td>
                          <td className="py-3 px-3 leading-relaxed text-slate-400">
                            {lim.rootCauseHypothesis}
                          </td>
                          <td
                            className={`py-3 px-3 font-semibold ${
                              lim.priority === 'Critical'
                                ? 'text-red-400'
                                : lim.priority === 'High'
                                ? 'text-amber-400'
                                : 'text-slate-300'
                            }`}
                          >
                            {lim.priority}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </section>

              {/* SECTION 3: CURRENT AS-IS PROCESS FLOW DIAGRAM */}
              <section id="sec-3-asis-flow" className="space-y-4 scroll-mt-24">
                <div className="border-b border-slate-800 pb-3 flex flex-wrap items-center justify-between gap-4">
                  <div>
                    <h2 className="text-xl font-semibold text-white">
                      03. Current AS-IS Process Flow Diagram
                    </h2>
                    <p className="text-xs text-slate-400 mt-1">
                      Step numbers correspond 1:1 with the AS-IS Process Table. Confirmed bottlenecks are highlighted in red.
                    </p>
                  </div>
                  <a
                    href={spec.currentStateDrawioUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-md text-xs font-semibold bg-red-500/20 hover:bg-red-500/30 text-red-200 border border-red-500/40 no-underline whitespace-nowrap shrink-0 no-print"
                  >
                    <ExternalLink className="w-3.5 h-3.5" />
                    Open AS-IS Flow in draw.io
                  </a>
                </div>

                <MermaidDiagram
                  chart={spec.currentStateMermaid}
                  title={`${spec.processName} — Current AS-IS Flow`}
                  badgeType="asis"
                  drawioUrl={spec.currentStateDrawioUrl}
                />
              </section>

              {/* SECTION 4: RECOMMENDATIONS FOR TO-BE PROCESS FLOW */}
              <section id="sec-4-recommendations" className="space-y-5 scroll-mt-24">
                <div className="border-b border-slate-800 pb-3">
                  <h2 className="text-xl font-semibold text-white">
                    04. Recommendations for TO-BE Process Flow
                  </h2>
                  <p className="text-xs text-slate-400 mt-1">
                    Process, system integration, data validation, and workflow automation improvements that preserve all required governance controls.
                  </p>
                </div>

                {/* Recommendations Table */}
                <div className="overflow-x-auto border border-slate-800 rounded-lg">
                  <table className="w-full text-left border-collapse text-xs tabular-nums">
                    <thead>
                      <tr className="bg-slate-900 border-b border-slate-800 text-slate-200">
                        <th className="py-2.5 px-3 font-semibold">ID</th>
                        <th className="py-2.5 px-3 font-semibold">Category</th>
                        <th className="py-2.5 px-3 font-semibold">Recommendation &amp; Design</th>
                        <th className="py-2.5 px-3 font-semibold">Addresses Limitation</th>
                        <th className="py-2.5 px-3 font-semibold">Preserved Controls</th>
                        <th className="py-2.5 px-3 font-semibold">Expected Measurable Benefit</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-800/80 text-slate-300">
                      {spec.recommendations.map((rec) => (
                        <tr key={rec.id} className="hover:bg-slate-900/40">
                          <td className="py-3 px-3 font-mono font-semibold text-emerald-400 whitespace-nowrap">
                            {rec.id}
                          </td>
                          <td className="py-3 px-3 font-medium text-slate-200 whitespace-nowrap">
                            {rec.category}
                          </td>
                          <td className="py-3 px-3 leading-relaxed">
                            <div className="font-semibold text-white mb-1">{rec.title}</div>
                            <div className="text-slate-400">{rec.description}</div>
                          </td>
                          <td className="py-3 px-3 font-mono text-slate-300">
                            {rec.addressesLimitation}
                          </td>
                          <td className="py-3 px-3 leading-relaxed">{rec.preservedControls}</td>
                          <td className="py-3 px-3 leading-relaxed text-emerald-300 font-medium">
                            {rec.expectedBenefit}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                {/* TO-BE Process Steps Table */}
                <div className="space-y-2 pt-2">
                  <h3 className="text-sm font-semibold text-white">
                    Future-State TO-BE Process Steps
                  </h3>
                  <div className="overflow-x-auto border border-slate-800 rounded-lg">
                    <table className="w-full text-left border-collapse text-xs tabular-nums">
                      <thead>
                        <tr className="bg-slate-900 border-b border-slate-800 text-slate-200">
                          <th className="py-2.5 px-3 font-semibold w-14">Step #</th>
                          <th className="py-2.5 px-3 font-semibold">TO-BE Process Step</th>
                          <th className="py-2.5 px-3 font-semibold">Detailed Description</th>
                          <th className="py-2.5 px-3 font-semibold">Owner</th>
                          <th className="py-2.5 px-3 font-semibold">System</th>
                          <th className="py-2.5 px-3 font-semibold">Improvement Type</th>
                          <th className="py-2.5 px-3 font-semibold">Control / Dependency</th>
                          <th className="py-2.5 px-3 font-semibold">KPI Target</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-800/80 text-slate-300">
                        {spec.toBeSteps.map((step) => (
                          <tr
                            key={step.stepNumber}
                            className="bg-emerald-950/10 hover:bg-emerald-950/20"
                          >
                            <td className="py-2.5 px-3 font-mono font-semibold text-white">
                              {step.stepNumber}
                            </td>
                            <td className="py-2.5 px-3 font-semibold text-white">
                              {step.stepName}
                            </td>
                            <td className="py-2.5 px-3 leading-relaxed">
                              {step.description}
                            </td>
                            <td className="py-2.5 px-3">{step.owner}</td>
                            <td className="py-2.5 px-3">{step.system}</td>
                            <td className="py-2.5 px-3 font-semibold text-emerald-400">
                              {step.improvementType}
                            </td>
                            <td className="py-2.5 px-3">{step.controlOrDependency}</td>
                            <td className="py-2.5 px-3 font-medium text-slate-200">
                              {step.kpiTarget}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              </section>

              {/* SECTION 5: TO-BE PROCESS FLOW IMAGE & DRAW.IO DIAGRAM */}
              <section id="sec-5-tobe-flow" className="space-y-4 scroll-mt-24">
                <div className="border-b border-slate-800 pb-3 flex flex-wrap items-center justify-between gap-4">
                  <div>
                    <h2 className="text-xl font-semibold text-white">
                      05. TO-BE Process Flow Image &amp; Diagram
                    </h2>
                    <p className="text-xs text-slate-400 mt-1">
                      Visual TO-BE architecture with automated and improved steps highlighted in green. Save as PNG/SVG image or edit directly in draw.io.
                    </p>
                  </div>
                  <a
                    href={spec.improvedStateDrawioUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-md text-xs font-semibold bg-emerald-500/20 hover:bg-emerald-500/30 text-emerald-200 border border-emerald-500/40 no-underline whitespace-nowrap shrink-0 no-print"
                  >
                    <ExternalLink className="w-3.5 h-3.5" />
                    Open TO-BE Flow in draw.io
                  </a>
                </div>

                <MermaidDiagram
                  chart={spec.improvedStateMermaid}
                  title={`${spec.processName} — Improved TO-BE Flow`}
                  badgeType="tobe"
                  drawioUrl={spec.improvedStateDrawioUrl}
                />
              </section>

              {/* SECTIONS 6 & 7: FUNCTIONAL USER STORIES + ACCEPTANCE CRITERIA (POSITIVE, NEGATIVE & BOUNDARY SCENARIOS) IN THE SAME DOCUMENT */}
              <section id="sec-6-stories-ac" className="space-y-6 scroll-mt-24">
                <div className="border-b border-slate-800 pb-3">
                  <h2 className="text-xl font-semibold text-white">
                    06. Functional User Stories &amp; 07. Acceptance Criteria (Positive, Negative &amp; Boundary Scenarios)
                  </h2>
                  <p className="text-xs text-slate-400 mt-1">
                    Engineering-ready user stories written in the same unified document alongside Given/When/Then acceptance criteria covering Positive, Negative, and Boundary scenarios.
                  </p>
                </div>

                <div className="space-y-6">
                  {spec.functionalStories.map((story) => (
                    <div
                      key={story.storyId}
                      className="rounded-lg border border-slate-800 bg-slate-900/40 overflow-hidden"
                    >
                      <div className="px-5 py-4 bg-slate-900 border-b border-slate-800 flex flex-wrap items-center justify-between gap-3">
                        <div className="space-y-1">
                          <div className="flex items-center gap-2 text-xs text-slate-400 tabular-nums">
                            <span className="font-mono font-semibold text-sky-400">
                              {story.storyId}
                            </span>
                            <span aria-hidden="true">·</span>
                            <span>Persona: {story.persona}</span>
                            <span aria-hidden="true">·</span>
                            <span>Traceability: {story.relatedToBeSteps}</span>
                            <span aria-hidden="true">·</span>
                            <span>Priority: {story.priority}</span>
                            <span aria-hidden="true">·</span>
                            <span>{story.storyPoints} Story Points</span>
                          </div>
                          <h3 className="text-base font-semibold text-white">
                            {story.title}
                          </h3>
                        </div>
                      </div>

                      <div className="p-5 space-y-4">
                        <div className="p-3.5 rounded-md bg-slate-950 border border-slate-800/90 text-sm text-slate-200 leading-relaxed">
                          <strong className="text-sky-400 font-semibold">User Story: </strong>
                          {story.userStoryStatement}
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs text-slate-300">
                          <div>
                            <strong className="text-white">Business Value: </strong>
                            {story.businessValue}
                          </div>
                          <div>
                            <strong className="text-white">Technical Implementation Notes: </strong>
                            {story.technicalNotes}
                          </div>
                        </div>

                        {/* Embedded Acceptance Criteria Table (Positive, Negative, Boundary) */}
                        <div className="space-y-2 pt-1">
                          <div className="text-xs font-semibold text-slate-200">
                            Acceptance Criteria — Positive, Negative &amp; Boundary Scenarios
                          </div>
                          <div className="overflow-x-auto border border-slate-800 rounded-md">
                            <table className="w-full text-left border-collapse text-xs tabular-nums">
                              <thead>
                                <tr className="bg-slate-950 border-b border-slate-800 text-slate-300">
                                  <th className="py-2 px-3 font-semibold w-24">AC ID</th>
                                  <th className="py-2 px-3 font-semibold w-28">Scenario Type</th>
                                  <th className="py-2 px-3 font-semibold">Scenario Title</th>
                                  <th className="py-2 px-3 font-semibold">Given (Precondition)</th>
                                  <th className="py-2 px-3 font-semibold">When (Action / Trigger)</th>
                                  <th className="py-2 px-3 font-semibold">Then (Expected Outcome)</th>
                                </tr>
                              </thead>
                              <tbody className="divide-y divide-slate-800/80 text-slate-300">
                                {story.acceptanceCriteria.map((ac) => (
                                  <tr key={ac.id} className="hover:bg-slate-900/60">
                                    <td className="py-2.5 px-3 font-mono font-semibold text-white whitespace-nowrap">
                                      {ac.id}
                                    </td>
                                    <td
                                      className={`py-2.5 px-3 font-semibold whitespace-nowrap ${
                                        ac.scenarioType === 'Positive'
                                          ? 'text-emerald-400'
                                          : ac.scenarioType === 'Negative'
                                          ? 'text-red-400'
                                          : 'text-amber-400'
                                      }`}
                                    >
                                      {ac.scenarioType}
                                    </td>
                                    <td className="py-2.5 px-3 font-medium text-white">
                                      {ac.title}
                                    </td>
                                    <td className="py-2.5 px-3 leading-relaxed">{ac.given}</td>
                                    <td className="py-2.5 px-3 leading-relaxed">{ac.when}</td>
                                    <td className="py-2.5 px-3 leading-relaxed text-slate-200">
                                      {ac.then}
                                    </td>
                                  </tr>
                                ))}
                              </tbody>
                            </table>
                          </div>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </section>

              {/* SECTION 8: TEST CASES FOR QA AND UAT */}
              <section id="sec-8-test-cases" className="space-y-5 scroll-mt-24">
                <div className="border-b border-slate-800 pb-3">
                  <h2 className="text-xl font-semibold text-white">
                    08. Test Cases for QA and UAT
                  </h2>
                  <p className="text-xs text-slate-400 mt-1">
                    Traceable Quality Assurance (Positive, Negative, Boundary) and User Acceptance Testing (End-to-End Governance &amp; Control) test execution scripts.
                  </p>
                </div>

                <div className="overflow-x-auto border border-slate-800 rounded-lg">
                  <table className="w-full text-left border-collapse text-xs tabular-nums">
                    <thead>
                      <tr className="bg-slate-900 border-b border-slate-800 text-slate-200">
                        <th className="py-2.5 px-3 font-semibold">Test ID</th>
                        <th className="py-2.5 px-3 font-semibold">Story ID</th>
                        <th className="py-2.5 px-3 font-semibold">Suite</th>
                        <th className="py-2.5 px-3 font-semibold">Scenario</th>
                        <th className="py-2.5 px-3 font-semibold">Title &amp; Preconditions</th>
                        <th className="py-2.5 px-3 font-semibold">Execution Steps</th>
                        <th className="py-2.5 px-3 font-semibold">Test Data</th>
                        <th className="py-2.5 px-3 font-semibold">Expected Result</th>
                        <th className="py-2.5 px-3 font-semibold">Control Verified</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-800/80 text-slate-300">
                      {spec.testCases.map((tc) => (
                        <tr key={tc.testCaseId} className="hover:bg-slate-900/40">
                          <td className="py-3 px-3 font-mono font-semibold text-white whitespace-nowrap">
                            {tc.testCaseId}
                          </td>
                          <td className="py-3 px-3 font-mono text-sky-400 whitespace-nowrap">
                            {tc.linkedStoryId}
                          </td>
                          <td className="py-3 px-3 font-semibold text-white whitespace-nowrap">
                            {tc.suite}
                          </td>
                          <td
                            className={`py-3 px-3 font-semibold whitespace-nowrap ${
                              tc.scenarioCategory === 'Positive'
                                ? 'text-emerald-400'
                                : tc.scenarioCategory === 'Negative'
                                ? 'text-red-400'
                                : tc.scenarioCategory === 'Boundary'
                                ? 'text-amber-400'
                                : 'text-sky-400'
                            }`}
                          >
                            {tc.scenarioCategory}
                          </td>
                          <td className="py-3 px-3 leading-relaxed">
                            <div className="font-semibold text-white mb-1">{tc.title}</div>
                            <div className="text-slate-400">
                              <strong>Precondition:</strong> {tc.preconditions}
                            </div>
                          </td>
                          <td className="py-3 px-3 leading-relaxed">
                            <ol className="list-decimal pl-4 space-y-1">
                              {tc.testSteps.map((stepText, idx) => (
                                <li key={idx}>{stepText}</li>
                              ))}
                            </ol>
                          </td>
                          <td className="py-3 px-3 font-mono text-slate-300">
                            {tc.testData}
                          </td>
                          <td className="py-3 px-3 leading-relaxed text-slate-200">
                            {tc.expectedResult}
                          </td>
                          <td className="py-3 px-3 font-medium text-emerald-300">
                            {tc.controlVerified}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </section>
            </div>
          )}

          {/* VIEW 2: HTTP PORTAL PROCESS INTAKE & GENERATOR */}
          {activeView === 'intake' && (
            <div className="space-y-6">
              <div className="border-b border-slate-800 pb-4 flex flex-wrap items-center justify-between gap-4">
                <div>
                  <h1 className="text-2xl font-bold text-white">
                    Process Flow Intake &amp; Specification Generator
                  </h1>
                  <p className="text-xs text-slate-400 mt-1">
                    Enter your current AS-IS process steps, metrics, bottlenecks, and required controls to generate draw.io diagrams, TO-BE recommendations, User Stories (Positive/Negative/Boundary ACs), and QA/UAT Test Cases.
                  </p>
                </div>

                <div className="flex items-center gap-2">
                  {PRESET_PROCESSES.map((preset) => (
                    <button
                      key={preset.id}
                      type="button"
                      onClick={() => loadPreset(preset.id)}
                      className="px-3 py-1.5 rounded-md text-xs font-medium bg-slate-900 hover:bg-slate-800 text-slate-200 border border-slate-700 transition-colors whitespace-nowrap cursor-pointer"
                    >
                      Load: {preset.label}
                    </button>
                  ))}
                </div>
              </div>

              {portalError && (
                <div className="p-4 rounded-lg border border-red-500/40 bg-red-950/30 text-red-300 text-xs flex items-center justify-between">
                  <span>{portalError}</span>
                  <button
                    type="button"
                    onClick={() => setPortalError(null)}
                    className="underline cursor-pointer"
                  >
                    Dismiss
                  </button>
                </div>
              )}

              <form onSubmit={handleAnalyzeProcessPortal} className="space-y-6">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="space-y-1.5">
                    <label className="block text-xs font-semibold text-slate-300">
                      Process Name
                    </label>
                    <input
                      type="text"
                      required
                      value={processName}
                      onChange={(e) => setProcessName(e.target.value)}
                      className="w-full rounded-lg bg-slate-900 border border-slate-800 focus:border-sky-500 focus:outline-none px-3.5 py-2.5 text-sm text-white"
                    />
                  </div>

                  <div className="space-y-1.5">
                    <label className="block text-xs font-semibold text-slate-300">
                      Business Objective
                    </label>
                    <input
                      type="text"
                      required
                      value={businessObjective}
                      onChange={(e) => setBusinessObjective(e.target.value)}
                      className="w-full rounded-lg bg-slate-900 border border-slate-800 focus:border-sky-500 focus:outline-none px-3.5 py-2.5 text-sm text-white"
                    />
                  </div>

                  <div className="space-y-1.5">
                    <label className="block text-xs font-semibold text-slate-300">
                      Trigger / Start Condition
                    </label>
                    <input
                      type="text"
                      value={triggerCondition}
                      onChange={(e) => setTriggerCondition(e.target.value)}
                      className="w-full rounded-lg bg-slate-900 border border-slate-800 focus:border-sky-500 focus:outline-none px-3.5 py-2.5 text-sm text-white"
                    />
                  </div>

                  <div className="space-y-1.5">
                    <label className="block text-xs font-semibold text-slate-300">
                      End Condition
                    </label>
                    <input
                      type="text"
                      value={endCondition}
                      onChange={(e) => setEndCondition(e.target.value)}
                      className="w-full rounded-lg bg-slate-900 border border-slate-800 focus:border-sky-500 focus:outline-none px-3.5 py-2.5 text-sm text-white"
                    />
                  </div>
                </div>

                <div className="space-y-1.5">
                  <label className="block text-xs font-semibold text-slate-300">
                    Current Process Steps (AS-IS Sequence, Actors, Systems, Handoffs)
                  </label>
                  <textarea
                    rows={8}
                    required
                    value={processStepsText}
                    onChange={(e) => setProcessStepsText(e.target.value)}
                    className="w-full rounded-lg bg-slate-900 border border-slate-800 focus:border-sky-500 focus:outline-none p-3.5 text-sm text-white font-mono leading-relaxed"
                  />
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                  <div className="space-y-1.5">
                    <label className="block text-xs font-semibold text-slate-300">
                      Known Bottlenecks &amp; Pain Points
                    </label>
                    <textarea
                      rows={5}
                      value={knownBottlenecksText}
                      onChange={(e) => setKnownBottlenecksText(e.target.value)}
                      className="w-full rounded-lg bg-slate-900 border border-slate-800 focus:border-sky-500 focus:outline-none p-3 text-xs text-slate-200 leading-relaxed"
                    />
                  </div>

                  <div className="space-y-1.5">
                    <label className="block text-xs font-semibold text-slate-300">
                      Current Operational Metrics (Volume, Cycle Time, Rework %)
                    </label>
                    <textarea
                      rows={5}
                      value={currentMetricsText}
                      onChange={(e) => setCurrentMetricsText(e.target.value)}
                      className="w-full rounded-lg bg-slate-900 border border-slate-800 focus:border-sky-500 focus:outline-none p-3 text-xs text-slate-200 leading-relaxed"
                    />
                  </div>

                  <div className="space-y-1.5">
                    <label className="block text-xs font-semibold text-slate-300">
                      Controls That Must Remain (Approvals, Security, Audit)
                    </label>
                    <textarea
                      rows={5}
                      value={requiredControlsText}
                      onChange={(e) => setRequiredControlsText(e.target.value)}
                      className="w-full rounded-lg bg-slate-900 border border-slate-800 focus:border-sky-500 focus:outline-none p-3 text-xs text-slate-200 leading-relaxed"
                    />
                  </div>
                </div>

                <div className="flex items-center justify-end gap-3 pt-2">
                  <button
                    type="button"
                    onClick={() => setActiveView('document')}
                    className="px-4 py-2.5 rounded-lg text-xs font-medium bg-slate-900 hover:bg-slate-800 text-slate-300 border border-slate-800 cursor-pointer"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={analyzingPortal}
                    className="inline-flex items-center gap-2 px-5 py-2.5 rounded-lg text-xs font-semibold bg-sky-400 hover:bg-sky-300 disabled:opacity-50 text-slate-950 transition-colors cursor-pointer"
                  >
                    <Play className="w-4 h-4" />
                    {analyzingPortal
                      ? 'Analyzing Process, Building draw.io Flows & Writing User Stories...'
                      : 'Analyze Process & Build Full Specification Document'}
                  </button>
                </div>
              </form>
            </div>
          )}

          {/* VIEW 3: SIDE-BY-SIDE DRAW.IO FLOWS & IMAGE STUDIO */}
          {activeView === 'diagrams' && (
            <div className="space-y-6">
              <div className="border-b border-slate-800 pb-4 flex flex-wrap items-center justify-between gap-4">
                <div>
                  <h1 className="text-2xl font-bold text-white">
                    AS-IS &amp; TO-BE Process Flow Diagrams (draw.io &amp; Image Export)
                  </h1>
                  <p className="text-xs text-slate-400 mt-1">
                    Compare the current AS-IS workflow (red bottlenecks) against the improved TO-BE workflow (green improvements). Download high-resolution PNG/SVG images or open directly in draw.io.
                  </p>
                </div>

                <div className="flex items-center gap-2">
                  <a
                    href={spec.currentStateDrawioUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg text-xs font-semibold bg-red-500/20 hover:bg-red-500/30 text-red-200 border border-red-500/40 no-underline whitespace-nowrap"
                  >
                    <ExternalLink className="w-3.5 h-3.5" />
                    Edit AS-IS in draw.io
                  </a>
                  <a
                    href={spec.improvedStateDrawioUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg text-xs font-semibold bg-emerald-500/20 hover:bg-emerald-500/30 text-emerald-200 border border-emerald-500/40 no-underline whitespace-nowrap"
                  >
                    <ExternalLink className="w-3.5 h-3.5" />
                    Edit TO-BE in draw.io
                  </a>
                </div>
              </div>

              <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
                <MermaidDiagram
                  chart={spec.currentStateMermaid}
                  title="Current AS-IS Process Flow"
                  badgeType="asis"
                  drawioUrl={spec.currentStateDrawioUrl}
                />
                <MermaidDiagram
                  chart={spec.improvedStateMermaid}
                  title="Future TO-BE Process Flow Image"
                  badgeType="tobe"
                  drawioUrl={spec.improvedStateDrawioUrl}
                />
              </div>
            </div>
          )}

          {/* VIEW 4: INTERACTIVE STORIES, ACCEPTANCE CRITERIA & QA/UAT EXPLORER */}
          {activeView === 'stories-qa' && (
            <div className="space-y-6">
              <div className="border-b border-slate-800 pb-4 flex flex-wrap items-center justify-between gap-4">
                <div>
                  <h1 className="text-2xl font-bold text-white">
                    Functional Stories, Acceptance Criteria &amp; QA/UAT Test Matrix
                  </h1>
                  <p className="text-xs text-slate-400 mt-1">
                    Filter by Positive, Negative, and Boundary scenarios or search across User Stories and QA/UAT Test Cases.
                  </p>
                </div>

                {/* Filter Controls */}
                <div className="flex flex-wrap items-center gap-3">
                  <div className="relative">
                    <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                    <input
                      type="text"
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      placeholder="Filter stories or test cases..."
                      className="pl-8 pr-3 py-1.5 rounded-lg bg-slate-900 border border-slate-800 text-xs text-white focus:border-sky-500 focus:outline-none"
                    />
                  </div>

                  {/* Interactive Scenario Filter */}
                  <div className="flex items-center gap-1 p-1 bg-slate-900 border border-slate-800 rounded-lg">
                    {(['All', 'Positive', 'Negative', 'Boundary'] as const).map((type) => (
                      <button
                        key={type}
                        type="button"
                        onClick={() => setAcScenarioFilter(type)}
                        className={`px-2.5 py-1 text-xs font-medium rounded transition-colors cursor-pointer ${
                          acScenarioFilter === type
                            ? 'bg-sky-400 text-slate-950 font-semibold'
                            : 'text-slate-400 hover:text-white'
                        }`}
                      >
                        {type}
                      </button>
                    ))}
                  </div>

                  {/* Interactive Suite Filter */}
                  <div className="flex items-center gap-1 p-1 bg-slate-900 border border-slate-800 rounded-lg">
                    {(['All', 'QA', 'UAT'] as const).map((suite) => (
                      <button
                        key={suite}
                        type="button"
                        onClick={() => setTestSuiteFilter(suite)}
                        className={`px-2.5 py-1 text-xs font-medium rounded transition-colors cursor-pointer ${
                          testSuiteFilter === suite
                            ? 'bg-sky-400 text-slate-950 font-semibold'
                            : 'text-slate-400 hover:text-white'
                        }`}
                      >
                        {suite}
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              {/* Filtered Functional Stories & Acceptance Criteria */}
              <div className="space-y-4">
                <h2 className="text-base font-semibold text-white">
                  Functional User Stories &amp; Acceptance Criteria ({filteredStories.length})
                </h2>
                {filteredStories.map((story) => {
                  const visibleAcs = story.acceptanceCriteria.filter(
                    (ac) =>
                      acScenarioFilter === 'All' || ac.scenarioType === acScenarioFilter
                  );
                  return (
                    <div
                      key={story.storyId}
                      className="rounded-lg border border-slate-800 bg-slate-900/40 p-5 space-y-4"
                    >
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <div className="text-xs text-slate-400 tabular-nums">
                          <span className="font-mono font-semibold text-sky-400">
                            {story.storyId}
                          </span>
                          <span aria-hidden="true"> · </span>
                          <span className="font-semibold text-white">{story.title}</span>
                          <span aria-hidden="true"> · </span>
                          <span>{story.relatedToBeSteps}</span>
                          <span aria-hidden="true"> · </span>
                          <span>{story.storyPoints} pts</span>
                        </div>
                      </div>

                      <p className="text-xs text-slate-200">{story.userStoryStatement}</p>

                      <div className="overflow-x-auto border border-slate-800 rounded-md">
                        <table className="w-full text-left border-collapse text-xs tabular-nums">
                          <thead>
                            <tr className="bg-slate-950 border-b border-slate-800 text-slate-300">
                              <th className="py-2 px-3 font-semibold w-24">AC ID</th>
                              <th className="py-2 px-3 font-semibold w-28">Scenario</th>
                              <th className="py-2 px-3 font-semibold">Title</th>
                              <th className="py-2 px-3 font-semibold">Given</th>
                              <th className="py-2 px-3 font-semibold">When</th>
                              <th className="py-2 px-3 font-semibold">Then</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-slate-800/80 text-slate-300">
                            {visibleAcs.map((ac) => (
                              <tr key={ac.id}>
                                <td className="py-2 px-3 font-mono text-white">{ac.id}</td>
                                <td
                                  className={`py-2 px-3 font-semibold ${
                                    ac.scenarioType === 'Positive'
                                      ? 'text-emerald-400'
                                      : ac.scenarioType === 'Negative'
                                      ? 'text-red-400'
                                      : 'text-amber-400'
                                  }`}
                                >
                                  {ac.scenarioType}
                                </td>
                                <td className="py-2 px-3 font-medium text-white">
                                  {ac.title}
                                </td>
                                <td className="py-2 px-3">{ac.given}</td>
                                <td className="py-2 px-3">{ac.when}</td>
                                <td className="py-2 px-3 text-slate-200">{ac.then}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* Filtered QA & UAT Test Cases */}
              <div className="space-y-3 pt-4">
                <h2 className="text-base font-semibold text-white">
                  QA &amp; UAT Test Cases ({filteredTestCases.length})
                </h2>
                <div className="overflow-x-auto border border-slate-800 rounded-lg">
                  <table className="w-full text-left border-collapse text-xs tabular-nums">
                    <thead>
                      <tr className="bg-slate-900 border-b border-slate-800 text-slate-200">
                        <th className="py-2.5 px-3 font-semibold">Test ID</th>
                        <th className="py-2.5 px-3 font-semibold">Story</th>
                        <th className="py-2.5 px-3 font-semibold">Suite</th>
                        <th className="py-2.5 px-3 font-semibold">Scenario</th>
                        <th className="py-2.5 px-3 font-semibold">Title</th>
                        <th className="py-2.5 px-3 font-semibold">Test Steps</th>
                        <th className="py-2.5 px-3 font-semibold">Expected Result</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-800/80 text-slate-300">
                      {filteredTestCases.map((tc) => (
                        <tr key={tc.testCaseId}>
                          <td className="py-2.5 px-3 font-mono font-semibold text-white">
                            {tc.testCaseId}
                          </td>
                          <td className="py-2.5 px-3 font-mono text-sky-400">
                            {tc.linkedStoryId}
                          </td>
                          <td className="py-2.5 px-3 font-semibold text-white">
                            {tc.suite}
                          </td>
                          <td className="py-2.5 px-3 font-medium">{tc.scenarioCategory}</td>
                          <td className="py-2.5 px-3 font-medium text-white">{tc.title}</td>
                          <td className="py-2.5 px-3">
                            <ol className="list-decimal pl-4 space-y-0.5">
                              {tc.testSteps.map((s, i) => (
                                <li key={i}>{s}</li>
                              ))}
                            </ol>
                          </td>
                          <td className="py-2.5 px-3 text-slate-200">
                            {tc.expectedResult}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}

          {/* VIEW 5: INTERACTIVE DISCOVERY & REFINEMENT CHAT */}
          {activeView === 'chat' && (
            <div className="flex flex-col h-[calc(100vh-10rem)] rounded-lg border border-slate-800 bg-slate-900/40 overflow-hidden">
              <div className="px-5 py-3.5 bg-slate-900 border-b border-slate-800 flex flex-wrap items-center justify-between gap-3">
                <div>
                  <h2 className="text-sm font-semibold text-white">
                    Interactive Process Discovery &amp; Agent Chat
                  </h2>
                  <p className="text-xs text-slate-400">
                    Chat interactively with the AI Agent to discover missing process details, or click &ldquo;Sync Chat to Unified Portal Document&rdquo; to build the full structured specification.
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  {messages.length > 0 && (
                    <>
                      <button
                        type="button"
                        onClick={handleConvertChatToFullPortalSpec}
                        disabled={analyzingPortal}
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-semibold bg-sky-400 hover:bg-sky-300 text-slate-950 transition-colors cursor-pointer"
                      >
                        <FileText className="w-3.5 h-3.5" />
                        {analyzingPortal
                          ? 'Building Portal Document...'
                          : 'Sync Chat to Unified Portal Document'}
                      </button>
                      <button
                        type="button"
                        onClick={handleResetChat}
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium bg-slate-800 hover:bg-slate-700 text-slate-300 transition-colors cursor-pointer"
                      >
                        <RotateCcw className="w-3.5 h-3.5" />
                        Reset Chat
                      </button>
                    </>
                  )}
                </div>
              </div>

              <div className="flex-1 overflow-y-auto p-5 space-y-5">
                {messages.length === 0 ? (
                  <div className="max-w-2xl mx-auto py-8 space-y-4">
                    <h3 className="text-base font-semibold text-white">
                      Start an Interactive Discovery Session
                    </h3>
                    <p className="text-xs text-slate-400 leading-relaxed">
                      Paste a partial or complete process description below. If details are missing, the agent asks up to 3 focused discovery questions. When complete, it generates AS-IS and TO-BE draw.io flows, user stories, acceptance criteria, and QA/UAT test cases.
                    </p>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <button
                        type="button"
                        onClick={() =>
                          handleSendChat(
                            `Analyze the Employee Software Access Request process:\n${PRESET_PROCESSES[0].processStepsText}\nBottlenecks:\n${PRESET_PROCESSES[0].knownBottlenecksText}\nMetrics:\n${PRESET_PROCESSES[0].currentMetricsText}\nControls:\n${PRESET_PROCESSES[0].requiredControlsText}\nWrite the complete analysis, AS-IS and TO-BE flows, Functional User Stories with Positive, Negative, and Boundary Acceptance Criteria, and QA/UAT Test Cases.`
                          )
                        }
                        className="text-left p-3.5 rounded-lg border border-slate-800 bg-slate-950 hover:border-sky-500/50 transition-colors cursor-pointer"
                      >
                        <div className="text-xs font-semibold text-sky-400 mb-1">
                          Run Full Software Access Request Prompt
                        </div>
                        <p className="text-xs text-slate-400">
                          Sends the 11-step Employee Software Access Request case to the chat agent.
                        </p>
                      </button>

                      <button
                        type="button"
                        onClick={() =>
                          handleSendChat(
                            'We want to improve our customer refund approval process. Currently support agents log requests in a shared sheet and email finance for refunds over $100.'
                          )
                        }
                        className="text-left p-3.5 rounded-lg border border-slate-800 bg-slate-950 hover:border-amber-500/50 transition-colors cursor-pointer"
                      >
                        <div className="text-xs font-semibold text-amber-400 mb-1">
                          Test Discovery Gate (Incomplete Process)
                        </div>
                        <p className="text-xs text-slate-400">
                          Demonstrates the agent asking focused discovery questions before generating diagrams.
                        </p>
                      </button>
                    </div>
                  </div>
                ) : (
                  messages.map((msg) => (
                    <div
                      key={msg.id}
                      className={`flex flex-col ${
                        msg.role === 'user' ? 'items-end' : 'items-start'
                      }`}
                    >
                      <div className="text-xs text-slate-400 mb-1 tabular-nums">
                        <span>
                          {msg.role === 'user'
                            ? 'You'
                            : 'Process Improvement AI Agent'}
                        </span>
                        <span aria-hidden="true"> · </span>
                        <span>{msg.timestamp}</span>
                        {msg.role === 'agent' && msg.processFlowReady !== undefined && (
                          <>
                            <span aria-hidden="true"> · </span>
                            <span
                              className={
                                msg.processFlowReady
                                  ? 'text-emerald-400 font-semibold'
                                  : 'text-amber-400 font-semibold'
                              }
                            >
                              {msg.processFlowReady
                                ? 'PROCESS_FLOW_READY: true'
                                : 'Discovery Mode (PROCESS_FLOW_READY: false)'}
                            </span>
                          </>
                        )}
                      </div>

                      <div
                        className={`rounded-lg px-4 py-3 ${
                          msg.role === 'user'
                            ? 'bg-sky-500/15 border border-sky-500/30 text-slate-100 max-w-2xl text-xs whitespace-pre-wrap'
                            : 'bg-slate-950 border border-slate-800 text-slate-200 w-full text-xs'
                        }`}
                      >
                        {msg.role === 'user' ? (
                          msg.content
                        ) : (
                          <div className="markdown-content overflow-x-auto">
                            <ReactMarkdown
                              remarkPlugins={[remarkGfm]}
                              components={{
                                code: ({ className, children }) => {
                                  const match = /language-(\w+)/.exec(className || '');
                                  const codeText = String(children).replace(/\n$/, '');
                                  if (match && match[1].toLowerCase() === 'mermaid') {
                                    const isAsIs = codeText.includes('classDef bottleneck');
                                    const isToBe = codeText.includes('classDef improved');
                                    return (
                                      <MermaidDiagram
                                        chart={codeText}
                                        badgeType={
                                          isAsIs ? 'asis' : isToBe ? 'tobe' : 'neutral'
                                        }
                                        drawioUrl={buildDrawioUrl(
                                          codeText,
                                          isAsIs ? 'AS-IS Process' : 'TO-BE Process'
                                        )}
                                      />
                                    );
                                  }
                                  return (
                                    <code className="px-1.5 py-0.5 rounded bg-slate-800 text-sky-300 font-mono text-xs">
                                      {children}
                                    </code>
                                  );
                                },
                              }}
                            >
                              {msg.content}
                            </ReactMarkdown>
                          </div>
                        )}
                      </div>
                    </div>
                  ))
                )}

                {chatLoading && (
                  <div className="p-4 rounded-lg bg-slate-950 border border-slate-800 text-xs text-slate-300">
                    Analyzing process, evaluating bottlenecks, and generating response...
                  </div>
                )}

                {chatError && (
                  <div className="p-3 rounded-lg bg-red-950/30 border border-red-500/40 text-xs text-red-300">
                    {chatError}
                  </div>
                )}

                <div ref={chatEndRef} />
              </div>

              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  handleSendChat();
                }}
                className="p-4 bg-slate-900 border-t border-slate-800 flex gap-3"
              >
                <input
                  type="text"
                  value={chatInput}
                  onChange={(e) => setChatInput(e.target.value)}
                  placeholder="Describe your process or answer discovery questions..."
                  className="flex-1 rounded-lg bg-slate-950 border border-slate-800 focus:border-sky-500 focus:outline-none px-4 py-2.5 text-xs text-white"
                />
                <button
                  type="submit"
                  disabled={chatLoading || !chatInput.trim()}
                  className="inline-flex items-center gap-1.5 px-4 py-2.5 rounded-lg text-xs font-semibold bg-sky-400 hover:bg-sky-300 disabled:opacity-50 text-slate-950 transition-colors whitespace-nowrap cursor-pointer"
                >
                  <Send className="w-3.5 h-3.5" />
                  Send
                </button>
              </form>
            </div>
          )}
        </main>
      </div>
    </div>
  );
}
