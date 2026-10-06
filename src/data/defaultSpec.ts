export interface AsIsStep {
  stepNumber: number;
  stepName: string;
  description: string;
  owner: string;
  system: string;
  input: string;
  output: string;
  bottleneckStatus: 'None' | 'Confirmed Bottleneck' | 'Likely Bottleneck';
  controlOrDependency: string;
}

export interface ProcessLimitation {
  id: string;
  relatedSteps: string;
  title: string;
  evidence: string;
  classification: 'Confirmed Issue' | 'Likely Bottleneck' | 'Root-Cause Hypothesis';
  impact: string;
  priority: 'Critical' | 'High' | 'Medium';
  rootCauseHypothesis: string;
  recommendedAction: string;
}

export interface ToBeRecommendation {
  id: string;
  category: 'Automation' | 'Integration' | 'Workflow' | 'Data Quality' | 'Governance & Control';
  title: string;
  description: string;
  addressesLimitation: string;
  preservedControls: string;
  expectedBenefit: string;
}

export interface ToBeStep {
  stepNumber: number;
  stepName: string;
  description: string;
  owner: string;
  system: string;
  improvementType: 'Automated' | 'Integrated' | 'Streamlined' | 'Control Preserved';
  controlOrDependency: string;
  kpiTarget: string;
}

export interface AcceptanceCriterion {
  id: string;
  scenarioType: 'Positive' | 'Negative' | 'Boundary';
  title: string;
  given: string;
  when: string;
  then: string;
}

export interface FunctionalUserStory {
  storyId: string;
  title: string;
  persona: string;
  relatedToBeSteps: string;
  priority: 'High' | 'Medium' | 'Low';
  storyPoints: number;
  userStoryStatement: string;
  businessValue: string;
  technicalNotes: string;
  acceptanceCriteria: AcceptanceCriterion[];
}

export interface QaUatTestCase {
  testCaseId: string;
  linkedStoryId: string;
  suite: 'QA' | 'UAT';
  scenarioCategory: 'Positive' | 'Negative' | 'Boundary' | 'End-to-End Control';
  title: string;
  preconditions: string;
  testSteps: string[];
  testData: string;
  expectedResult: string;
  controlVerified: string;
}

export interface ProcessPortalSpec {
  processName: string;
  documentVersion: string;
  generatedAt: string;
  businessObjective: string;
  triggerCondition: string;
  endCondition: string;
  currentMetrics: string[];
  preservedControls: string[];
  executiveSummary: string;
  asIsSteps: AsIsStep[];
  limitations: ProcessLimitation[];
  currentStateMermaid: string;
  currentStateDrawioUrl: string;
  recommendations: ToBeRecommendation[];
  toBeSteps: ToBeStep[];
  improvedStateMermaid: string;
  improvedStateDrawioUrl: string;
  functionalStories: FunctionalUserStory[];
  testCases: QaUatTestCase[];
}

export function buildDrawioUrl(mermaid: string, title: string): string {
  if (!mermaid) return '';
  const payload = { type: 'mermaid', data: mermaid };
  return (
    'https://app.diagrams.net/?grid=1&pv=0&title=' +
    encodeURIComponent(title) +
    '#create=' +
    encodeURIComponent(JSON.stringify(payload))
  );
}

const DEFAULT_AS_IS_MERMAID = `flowchart TD
    A["1. Employee submits software access request in portal"] --> B{"2. Manager reviews request"}
    B -->|Rejected| Z["Document rejection & close ticket"]
    B -->|Approved| C["3. Request enters IT Service Desk queue"]
    C --> D["4. Service Desk manually checks license pool & approved software catalog"]
    D --> E{"5. Required info complete?"}
    E -->|No - 15% returned| A
    E -->|Yes| F{"6. Elevated access required?"}
    F -->|Yes| G["6. Service Desk manually emails Security team"]
    G --> H["7. Security reviews & replies via email (4-6 hr wait)"]
    H --> I["8. Service Desk manually updates ticket with Security decision"]
    I --> J{"Security Approved?"}
    J -->|No| Z
    J -->|Yes| K["9. Service Desk assigns ticket to Application Support"]
    F -->|No| K
    K --> L["10. Application Support provisions software access"]
    L --> M["11. Service Desk confirms access with employee & closes ticket"]

    classDef bottleneck fill:#ffcccc,stroke:#cc0000,stroke-width:3px,color:#000
    class D,E,G,H,I bottleneck`;

const DEFAULT_TO_BE_MERMAID = `flowchart TD
    A["1. Employee selects software from dynamic catalog with mandatory form validation"] --> B["2. Automated license & catalog eligibility pre-check via IAM/SAM API"]
    B --> C{"3. Manager digital approval in portal"}
    C -->|Rejected| Z["Automated audit log & employee notification"]
    C -->|Approved| D{"4. Elevated access required?"}
    D -->|Yes| E["5. Automated in-portal Security approval workflow with SLA escalation"]
    E --> F{"Security Approved?"}
    F -->|No| Z
    F -->|Yes| G["6. Automated SCIM/SSO provisioning or routed App Support queue"]
    D -->|No| G
    G --> H["7. Automated access verification, employee confirmation & immutable audit trail"]

    classDef improved fill:#ccffcc,stroke:#008000,stroke-width:3px,color:#000
    class A,B,E,G,H improved`;

export const DEFAULT_PORTAL_SPEC: ProcessPortalSpec = {
  processName: 'Employee Software Access Request',
  documentVersion: '1.0',
  generatedAt: '2026-10-06',
  businessObjective:
    'Provide employees access to approved software quickly while maintaining mandatory manager approval, security governance for elevated privileges, and full auditability.',
  triggerCondition: 'An employee submits a software access request in the IT service portal.',
  endCondition: 'Software access is provisioned and confirmed, or the request is rejected with a complete audit trail.',
  currentMetrics: [
    '60 software access requests submitted per business day',
    '2 business days (48 hours) average end-to-end completion time',
    '15% of requests returned to requester due to missing or incomplete fields',
    '4 to 6 hours wait time for email-based Security approval on elevated access',
  ],
  preservedControls: [
    'Mandatory Manager approval before fulfillment',
    'Mandatory Security approval for elevated-access software',
    'Immutable audit trail of all approvals and rejections',
    'Final employee access confirmation before ticket closure',
  ],
  executiveSummary:
    'The current Employee Software Access Request process handles ~60 requests/day with an average cycle time of 2 business days. Analysis reveals three primary bottlenecks: (1) free-text portal intake causes a 15% rework loop due to missing information, (2) IT Service Desk agents manually verify existing license entitlements and software catalog approval on every ticket, and (3) elevated-access requests rely on unstructured email threads with the Security team, adding 4–6 hours of queue time and manual ticket transcription. By introducing structured catalog intake validation, automated Software Asset Management (SAM) API lookups, and native in-portal Security approval workflows, the TO-BE process preserves all cuatro governance controls while reducing projected cycle time from 2 business days to under 4 hours.',
  asIsSteps: [
    {
      stepNumber: 1,
      stepName: 'Submit Software Request',
      description: 'Employee submits a software access request in the service portal.',
      owner: 'Employee',
      system: 'IT Service Portal',
      input: 'Software name, business justification',
      output: 'Submitted Request Ticket',
      bottleneckStatus: 'None',
      controlOrDependency: 'Portal authentication',
    },
    {
      stepNumber: 2,
      stepName: 'Manager Review & Approval',
      description: 'Manager reviews and approves or rejects the request.',
      owner: 'Line Manager',
      system: 'IT Service Portal',
      input: 'Submitted Request Ticket',
      output: 'Manager Approval Decision',
      bottleneckStatus: 'None',
      controlOrDependency: 'Mandatory Control: Manager Approval',
    },
    {
      stepNumber: 3,
      stepName: 'Enter IT Service Desk Queue',
      description: 'Approved requests enter the central IT Service Desk triage queue.',
      owner: 'IT Service Desk',
      system: 'ITSM Ticketing System',
      input: 'Manager-Approved Ticket',
      output: 'Queued Ticket',
      bottleneckStatus: 'None',
      controlOrDependency: 'Depends on Step 2 approval',
    },
    {
      stepNumber: 4,
      stepName: 'Manual License & Catalog Check',
      description:
        'Service Desk manually checks whether the employee already has a license and whether the requested software is on the approved list.',
      owner: 'IT Service Desk',
      system: 'License Spreadsheet / SAM Tool',
      input: 'Employee ID, Software Name',
      output: 'License & Catalog Status',
      bottleneckStatus: 'Confirmed Bottleneck',
      controlOrDependency: 'Software license compliance check',
    },
    {
      stepNumber: 5,
      stepName: 'Missing Information Clarification Loop',
      description:
        'If required information is missing (15% of volume), Service Desk sends the request back to the employee for clarification.',
      owner: 'IT Service Desk / Employee',
      system: 'ITSM Ticketing System',
      input: 'Incomplete Ticket',
      output: 'Clarified Ticket or Rework Delay',
      bottleneckStatus: 'Confirmed Bottleneck',
      controlOrDependency: 'Complete provisioning parameters',
    },
    {
      stepNumber: 6,
      stepName: 'Manual Email to Security Team',
      description:
        'Service Desk manually composes and emails the Security team for approval when the software requires elevated access.',
      owner: 'IT Service Desk',
      system: 'Corporate Email Client',
      input: 'Ticket Details & Elevated Role',
      output: 'Outbound Security Approval Email',
      bottleneckStatus: 'Confirmed Bottleneck',
      controlOrDependency: 'Mandatory Control: Security Approval trigger',
    },
    {
      stepNumber: 7,
      stepName: 'Security Email Review',
      description: 'Security team reviews the request and responds by email (4–6 hours average wait time).',
      owner: 'Security Operations Team',
      system: 'Corporate Email Client',
      input: 'Approval Request Email',
      output: 'Email Approval / Rejection Reply',
      bottleneckStatus: 'Confirmed Bottleneck',
      controlOrDependency: 'Mandatory Control: Security Approval for elevated access',
    },
    {
      stepNumber: 8,
      stepName: 'Manual Ticket Transcription',
      description: 'Service Desk reads the email reply and manually updates the ticket with the Security decision.',
      owner: 'IT Service Desk',
      system: 'ITSM Ticketing System & Email',
      input: 'Security Email Reply',
      output: 'Updated Ticket Audit Note',
      bottleneckStatus: 'Confirmed Bottleneck',
      controlOrDependency: 'Mandatory Control: Audit Trail of Approvals',
    },
    {
      stepNumber: 9,
      stepName: 'Assign to Application Support',
      description: 'If approved, Service Desk assigns the fulfillment task to the Application Support team.',
      owner: 'IT Service Desk',
      system: 'ITSM Ticketing System',
      input: 'Fully Approved Ticket',
      output: 'Assigned Fulfillment Task',
      bottleneckStatus: 'Likely Bottleneck',
      controlOrDependency: 'Handoff between Service Desk and App Support',
    },
    {
      stepNumber: 10,
      stepName: 'Software Provisioning',
      description: 'Application Support provisions the software license and user entitlements.',
      owner: 'Application Support Team',
      system: 'Identity Provider / App Admin Console',
      input: 'Assigned Fulfillment Task',
      output: 'Provisioned Software Access',
      bottleneckStatus: 'None',
      controlOrDependency: 'Requires valid license & prior approvals',
    },
    {
      stepNumber: 11,
      stepName: 'Confirm Access & Close Ticket',
      description: 'Service Desk confirms access with the employee and closes the ticket.',
      owner: 'IT Service Desk / Employee',
      system: 'ITSM Ticketing System',
      input: 'Provisioned Software Access',
      output: 'Confirmed & Closed Ticket',
      bottleneckStatus: 'None',
      controlOrDependency: 'Mandatory Control: Final Access Confirmation',
    },
  ],
  limitations: [
    {
      id: 'LIM-01',
      relatedSteps: 'Step 4',
      title: 'Repetitive Manual License Entitlement & Approved Software Checks',
      evidence:
        'Service Desk agents manually cross-reference every approved request (~60/day) against license pools and approved software lists.',
      classification: 'Confirmed Issue',
      impact:
        'Consumes high daily analyst effort, delays non-elevated tickets in the triage queue, and introduces human lookup errors.',
      priority: 'Critical',
      rootCauseHypothesis:
        'Lack of API integration between the IT Service Portal, Identity/Access Management (IAM), and the Software Asset Management (SAM) inventory.',
      recommendedAction:
        'Integrate automated pre-submission or post-submission API checks against SAM/IAM to validate duplicate assignments, approved catalog status, and available license seats.',
    },
    {
      id: 'LIM-02',
      relatedSteps: 'Step 1, Step 5',
      title: '15% Rework Rate Due to Missing Request Information',
      evidence:
        'Approximately 15% of requests (~9 tickets/day) are returned to the employee by the Service Desk for clarification.',
      classification: 'Confirmed Issue',
      impact:
        'Adds multi-hour back-and-forth wait states and forces Service Desk analysts to re-triage the same ticket multiple times.',
      priority: 'High',
      rootCauseHypothesis:
        'Portal intake form uses generic free-text fields instead of software-specific dynamic required fields (e.g., environment, role tier, cost center).',
      recommendedAction:
        'Replace free-text portal forms with a structured Software Catalog selector that enforces mandatory software-specific fields prior to submission.',
    },
    {
      id: 'LIM-03',
      relatedSteps: 'Step 6, Step 7, Step 8',
      title: 'Out-of-Band Email Security Approval & Manual Ticket Updates',
      evidence:
        'Elevated-access requests are emailed manually to Security, waiting 4–6 hours for an email response, followed by manual ticket updates by Service Desk.',
      classification: 'Confirmed Issue',
      impact:
        'Creates 4–6 hour wait states, fragments the compliance audit trail across email inboxes and tickets, and wastes analyst time copying email replies.',
      priority: 'Critical',
      rootCauseHypothesis:
        'Security Operations lacks a dedicated approval queue and automated routing rule inside the ITSM platform.',
      recommendedAction:
        'Implement native in-portal Security approval tasks triggered automatically by software risk classification, with immutable system timestamps.',
    },
    {
      id: 'LIM-04',
      relatedSteps: 'Step 9, Step 10, Step 11',
      title: 'Multi-Team Manual Handoffs for Standard Provisioning & Confirmation',
      evidence:
        'Service Desk acts as a manual router between Manager, Security, Application Support, and the Employee.',
      classification: 'Likely Bottleneck',
      impact:
        'Increases queue hops (3 separate Service Desk touchpoints per ticket), driving the 2-business-day average turnaround time.',
      priority: 'Medium',
      rootCauseHypothesis:
        'Absence of workflow orchestration rules to auto-assign approved requests directly to Application Support or SCIM group provisioning.',
      recommendedAction:
        'Auto-route approved tickets directly to Application Support (or SCIM auto-provisioning for standard birthright/catalog apps) and trigger automated confirmation surveys.',
    },
  ],
  currentStateMermaid: DEFAULT_AS_IS_MERMAID,
  currentStateDrawioUrl: buildDrawioUrl(DEFAULT_AS_IS_MERMAID, 'AS-IS Process'),
  recommendations: [
    {
      id: 'REC-01',
      category: 'Data Quality',
      title: 'Dynamic Software Catalog Intake & Pre-Submission Field Validation',
      description:
        'Replace unstructured request forms with a searchable Approved Software Catalog. Enforce required attributes (access tier, environment, cost center, business justification) dynamically based on the selected software.',
      addressesLimitation: 'LIM-02 (Step 1 & Step 5 — 15% missing info rework)',
      preservedControls: 'Preserves requester accountability and pre-validates approved software policy.',
      expectedBenefit: 'Eliminates the 15% rework loop (~9 tickets/day saved from manual return).',
    },
    {
      id: 'REC-02',
      category: 'Integration',
      title: 'Automated License & Duplicate Entitlement Check via SAM/IAM API',
      description:
        'Execute an automated REST API lookup against the Identity Provider and Software Asset Management database immediately upon request submission to check if the user already holds an active license and whether seats are available.',
      addressesLimitation: 'LIM-01 (Step 4 — Manual license & catalog checks)',
      preservedControls: 'Enforces software license compliance automatically and logs verification output on the ticket.',
      expectedBenefit: 'Reduces manual Service Desk triage effort by 80% across all 60 daily requests.',
    },
    {
      id: 'REC-03',
      category: 'Workflow',
      title: 'In-Portal Automated Security Approval Workflow for Elevated Access',
      description:
        'Eliminate manual emails in Steps 6–8. When a software item is flagged as "Elevated Access" in the catalog, automatically route a digital approval task to the Security queue after Manager approval.',
      addressesLimitation: 'LIM-03 (Steps 6–8 — Email-based Security approval & manual ticket updates)',
      preservedControls:
        'Strictly preserves Security approval for elevated-access software and strengthens the audit trail with cryptographic actor/timestamp logs.',
      expectedBenefit: 'Cuts Security approval turnaround from 4–6 hours to <90 minutes and removes manual email transcription.',
    },
    {
      id: 'REC-04',
      category: 'Automation',
      title: 'Direct Fulfillment Routing, Auto-Provisioning & Automated Employee Confirmation',
      description:
        'Upon final approval, automatically trigger SCIM group assignment for standard cloud applications or route directly to Application Support without Service Desk re-triage, followed by an automated employee access confirmation prompt.',
      addressesLimitation: 'LIM-04 (Steps 9–11 — Manual queue handoffs)',
      preservedControls: 'Preserves Final Access Confirmation before ticket closure and full approval audit trail.',
      expectedBenefit: 'Reduces overall end-to-end completion time from 2 business days to <4 business hours.',
    },
  ],
  toBeSteps: [
    {
      stepNumber: 1,
      stepName: 'Validated Catalog Request Submission',
      description:
        'Employee selects software from the Approved Software Catalog; dynamic form enforces all required fields and blocks submission if incomplete.',
      owner: 'Employee',
      system: 'IT Service Portal (Catalog UI)',
      improvementType: 'Streamlined',
      controlOrDependency: 'Mandatory schema validation',
      kpiTarget: '<1% returned requests (down from 15%)',
    },
    {
      stepNumber: 2,
      stepName: 'Automated License & Entitlement Pre-Check',
      description:
        'System automatically queries IAM and SAM APIs to block duplicate active licenses and attach current seat availability to the ticket.',
      owner: 'System (Automated)',
      system: 'ITSM + IAM / SAM API',
      improvementType: 'Integrated',
      controlOrDependency: 'Automated license compliance check',
      kpiTarget: '<5 seconds automated verification time',
    },
    {
      stepNumber: 3,
      stepName: 'Manager Digital Approval',
      description:
        'Line Manager receives an actionable portal/notification card with pre-validated license cost and approves or rejects with one click.',
      owner: 'Line Manager',
      system: 'IT Service Portal',
      improvementType: 'Control Preserved',
      controlOrDependency: 'Mandatory Control: Manager Approval & Audit Trail',
      kpiTarget: '100% logged manager approvals',
    },
    {
      stepNumber: 4,
      stepName: 'Automated Risk Tier Evaluation',
      description:
        'Workflow engine inspects the catalog item security classification (Standard vs. Elevated Access).',
      owner: 'System (Workflow Engine)',
      system: 'ITSM Workflow Engine',
      improvementType: 'Automated',
      controlOrDependency: 'Catalog risk classification metadata',
      kpiTarget: '100% routing accuracy',
    },
    {
      stepNumber: 5,
      stepName: 'In-Portal Security Approval Task (Elevated Access Only)',
      description:
        'For elevated-access software, system creates a native Security approval task with SLA reminders; decision updates the ticket automatically.',
      owner: 'Security Operations Team',
      system: 'ITSM Security Approval Queue',
      improvementType: 'Automated',
      controlOrDependency: 'Mandatory Control: Security Approval & Audit Trail',
      kpiTarget: '<90 min average approval wait (down from 4–6 hrs)',
    },
    {
      stepNumber: 6,
      stepName: 'Automated SCIM Provisioning or Direct App Support Fulfillment',
      description:
        'Standard apps provision automatically via SCIM/SSO group membership; custom apps route directly to Application Support queue.',
      owner: 'System / Application Support',
      system: 'IAM SCIM Engine / App Support Queue',
      improvementType: 'Automated',
      controlOrDependency: 'Executes only after verified approvals',
      kpiTarget: '<2 hours fulfillment time',
    },
    {
      stepNumber: 7,
      stepName: 'Automated Access Confirmation & Audit Closure',
      description:
        'Employee receives an interactive access confirmation prompt; confirming access closes the ticket and seals the immutable audit record.',
      owner: 'Employee / System',
      system: 'IT Service Portal',
      improvementType: 'Control Preserved',
      controlOrDependency: 'Mandatory Control: Final Access Confirmation & Audit Trail',
      kpiTarget: '<4 hours total end-to-end cycle time (down from 2 days)',
    },
  ],
  improvedStateMermaid: DEFAULT_TO_BE_MERMAID,
  improvedStateDrawioUrl: buildDrawioUrl(DEFAULT_TO_BE_MERMAID, 'TO-BE Process'),
  functionalStories: [
    {
      storyId: 'US-001',
      title: 'Dynamic Software Catalog Intake & Mandatory Field Validation',
      persona: 'Employee (Requester)',
      relatedToBeSteps: 'TO-BE Step 1',
      priority: 'High',
      storyPoints: 5,
      userStoryStatement:
        'As an Employee requesting software, I want to select from an approved software catalog that dynamically displays required fields for that application, so that my request is complete on first submission and not returned for clarification.',
      businessValue: 'Eliminates the 15% ticket return rate caused by missing request details.',
      technicalNotes:
        'Bind catalog item schema JSON to portal form renderer; enforce client-side and server-side schema validation before ticket creation.',
      acceptanceCriteria: [
        {
          id: 'AC-001-P1',
          scenarioType: 'Positive',
          title: 'Valid submission of approved catalog software with all required fields',
          given: 'An authenticated employee selects an approved software item (e.g., "Figma Enterprise") from the portal catalog',
          when: 'The employee completes all mandatory dynamic fields (Cost Center, Role Tier, Business Justification) and clicks Submit',
          then: 'The portal creates the request ticket in status "Pending Manager Approval" and displays a confirmation number.',
        },
        {
          id: 'AC-001-N1',
          scenarioType: 'Negative',
          title: 'Block submission when mandatory software-specific fields are missing',
          given: 'An employee selects an elevated-access software item that requires "Target Environment" and "Data Sensitivity Ack"',
          when: 'The employee leaves "Target Environment" blank and attempts to submit the form',
          then: 'The system blocks submission, highlights the missing field with an inline error message, and does not create a ticket.',
        },
        {
          id: 'AC-001-B1',
          scenarioType: 'Boundary',
          title: 'Business justification character length boundaries (minimum 20 chars, maximum 500 chars)',
          given: 'An employee is filling out the "Business Justification" field on the software request form',
          when: 'The employee enters 19 characters (below minimum) or 501 characters (above maximum), vs. exactly 20 or 500 characters',
          then: 'Inputs of 19 or 501 characters are rejected with a validation message, while inputs of exactly 20 and 500 characters are accepted.',
        },
      ],
    },
    {
      storyId: 'US-002',
      title: 'Automated Duplicate License & Entitlement Pre-Check via SAM/IAM API',
      persona: 'IT Service Desk Analyst / System',
      relatedToBeSteps: 'TO-BE Step 2',
      priority: 'High',
      storyPoints: 8,
      userStoryStatement:
        'As an IT Service Operations Owner, I want the system to automatically check whether the requester already holds an active license and whether license seats are available upon submission, so that Service Desk analysts do not perform repetitive manual lookups on 60 requests per day.',
      businessValue: 'Removes Bottleneck 1 (Step 4 manual checks) and prevents duplicate license allocation.',
      technicalNotes:
        'Integrate with IAM group membership API and SAM license entitlement endpoint with a 5-second timeout and fallback flag.',
      acceptanceCriteria: [
        {
          id: 'AC-002-P1',
          scenarioType: 'Positive',
          title: 'Automated verification succeeds for eligible employee with available license pool',
          given: 'An employee without an existing license submits a request for software with >0 available seats',
          when: 'The system executes the SAM/IAM pre-check API call',
          then: 'The ticket is stamped with "License Pre-Check: Eligible (Seats Available)" and routed immediately to the Line Manager.',
        },
        {
          id: 'AC-002-N1',
          scenarioType: 'Negative',
          title: 'Prevent duplicate request when employee already has an active license',
          given: 'An employee who already holds an active "Adobe Creative Cloud" license attempts to submit a new request for the same software',
          when: 'The automated pre-check queries the IAM/SAM entitlement endpoint',
          then: 'The system blocks duplicate ticket creation and informs the employee that an active license is already assigned to their profile.',
        },
        {
          id: 'AC-002-B1',
          scenarioType: 'Boundary',
          title: 'License pool boundary at 0 remaining seats vs. 1 remaining seat',
          given: 'A software pool has exactly 1 remaining license seat vs. 0 remaining seats',
          when: 'Two sequential requests are evaluated by the pre-check service',
          then: 'The request at 1 remaining seat passes pre-check and reserves the seat; the request at 0 remaining seats is flagged "License Pool Exhausted — Procurement Required" while still preserving approval workflow.',
        },
      ],
    },
    {
      storyId: 'US-003',
      title: 'In-Portal Security Approval Workflow & Immutable Audit Trail for Elevated Access',
      persona: 'Security Operations Reviewer',
      relatedToBeSteps: 'TO-BE Step 3, Step 4, Step 5',
      priority: 'High',
      storyPoints: 8,
      userStoryStatement:
        'As a Security Operations Reviewer, I want elevated-access software requests to route automatically to an in-portal Security approval queue after Manager approval, so that we eliminate unstructured email threads, manual Service Desk ticket updates, and 4–6 hour wait times while maintaining a complete audit trail.',
      businessValue: 'Eliminates Bottleneck 2 (Steps 6–8 email loop) and guarantees audit compliance.',
      technicalNotes:
        'Enforce sequential gate: Security task only activates after Manager approval = Approved AND software.elevatedAccess === true.',
      acceptanceCriteria: [
        {
          id: 'AC-003-P1',
          scenarioType: 'Positive',
          title: 'Automatic routing to Security Queue after Manager approves elevated-access software',
          given: 'A Manager approves a request for software flagged as "Elevated Access = True"',
          when: 'The Manager decision is recorded in the portal',
          then: 'The system automatically creates a Security Approval task, notifies the Security queue, and records the Security reviewer decision directly into the ticket audit log without Service Desk intervention.',
        },
        {
          id: 'AC-003-N1',
          scenarioType: 'Negative',
          title: 'Block provisioning if Security rejects or if Manager has not approved',
          given: 'An elevated-access request is approved by the Manager but rejected by the Security Reviewer (or attempted without Manager approval)',
          when: 'The Security Reviewer clicks "Reject" with a mandatory rejection reason',
          then: 'The system immediately terminates fulfillment, sets ticket status to "Rejected by Security", logs the immutable audit entry, and notifies the employee.',
        },
        {
          id: 'AC-003-B1',
          scenarioType: 'Boundary',
          title: 'SLA escalation trigger at exactly 120 minutes of pending Security review',
          given: 'An elevated-access request enters the Security approval queue with a 120-minute SLA threshold',
          when: 'The elapsed pending duration reaches 119 minutes vs. 120 minutes',
          then: 'At 119 minutes no escalation alert is sent; at exactly 120 minutes an automated high-priority escalation notification is dispatched to the On-Call Security Lead.',
        },
      ],
    },
    {
      storyId: 'US-004',
      title: 'Direct Fulfillment Routing & Mandatory Employee Access Confirmation',
      persona: 'Application Support Engineer / Employee',
      relatedToBeSteps: 'TO-BE Step 6, Step 7',
      priority: 'Medium',
      storyPoints: 5,
      userStoryStatement:
        'As a Process Owner, I want fully approved requests to trigger automated provisioning (or direct Application Support assignment) and require final employee access confirmation before closure, so that fulfillment is fast and every closed ticket has verified working access.',
      businessValue: 'Reduces queue handoffs and preserves the mandatory Final Access Confirmation control.',
      technicalNotes:
        'Ticket cannot transition to "Closed" until employee clicks "Confirm Working Access" or 5-business-day auto-verified confirmation rule completes.',
      acceptanceCriteria: [
        {
          id: 'AC-004-P1',
          scenarioType: 'Positive',
          title: 'Direct fulfillment and employee confirmation closes ticket with full audit log',
          given: 'All required approvals (Manager, plus Security if elevated) are completed and software is provisioned',
          when: 'The employee clicks "Confirm Access Granted" in the portal notification',
          then: 'The ticket transitions to "Closed — Confirmed", storing Manager approval, Security approval, provisioning timestamp, and employee confirmation in the audit trail.',
        },
        {
          id: 'AC-004-N1',
          scenarioType: 'Negative',
          title: 'Prevent premature ticket closure before employee access confirmation',
          given: 'Application Support marks the software provisioning task as "Provisioned"',
          when: 'An agent attempts to manually set the parent ticket status to "Closed" before employee confirmation is received',
          then: 'The system blocks manual closure and keeps the ticket in "Awaiting Employee Access Confirmation" status.',
        },
        {
          id: 'AC-004-B1',
          scenarioType: 'Boundary',
          title: 'Employee reports access issue during confirmation window (Day 5 boundary)',
          given: 'A ticket has been in "Awaiting Employee Confirmation" for up to 5 business days',
          when: 'The employee clicks "Access Not Working" on Day 5 prior to timeout',
          then: 'The ticket automatically re-opens in the Application Support queue with priority elevated instead of closing.',
        },
      ],
    },
  ],
  testCases: [
    {
      testCaseId: 'TC-QA-001',
      linkedStoryId: 'US-001',
      suite: 'QA',
      scenarioCategory: 'Positive',
      title: 'Verify dynamic required fields and successful request submission for approved catalog software',
      preconditions: 'User is logged in as standard Employee; "Figma Enterprise" is active in Approved Software Catalog.',
      testSteps: [
        'Navigate to the Software Access Request Portal.',
        'Select "Figma Enterprise" from the Approved Software Catalog dropdown.',
        'Verify dynamic required fields (Cost Center, Role Tier, Business Justification) render.',
        'Populate valid values (Cost Center: "CC-410", Role Tier: "Editor", Justification: "Required for Q4 UI design sprint").',
        'Click "Submit Request".',
      ],
      testData: 'Software: Figma Enterprise | Cost Center: CC-410 | Justification: 32 chars',
      expectedResult: 'Ticket is created with status "Pending Manager Approval" and no missing-info return occurs.',
      controlVerified: 'Approved Software Catalog Validation',
    },
    {
      testCaseId: 'TC-QA-002',
      linkedStoryId: 'US-001',
      suite: 'QA',
      scenarioCategory: 'Negative',
      title: 'Verify form submission is blocked when mandatory catalog fields are omitted',
      preconditions: 'User is logged in as standard Employee.',
      testSteps: [
        'Select "AWS Production Console (Elevated)" from the catalog.',
        'Leave mandatory "Environment" and "Justification" fields blank.',
        'Click "Submit Request".',
      ],
      testData: 'Software: AWS Production Console | Environment: NULL | Justification: ""',
      expectedResult: 'Form submission is blocked; inline error messages identify missing fields; zero tickets created.',
      controlVerified: 'Intake Data Completeness Gate',
    },
    {
      testCaseId: 'TC-QA-003',
      linkedStoryId: 'US-001',
      suite: 'QA',
      scenarioCategory: 'Boundary',
      title: 'Verify Business Justification character length boundary at 19, 20, 500, and 501 characters',
      preconditions: 'User is on the Software Access Request form.',
      testSteps: [
        'Enter 19 characters in Business Justification and click Submit -> verify rejection.',
        'Enter 20 characters in Business Justification and click Submit -> verify acceptance.',
        'Enter 500 characters in Business Justification and click Submit -> verify acceptance.',
        'Enter 501 characters in Business Justification and click Submit -> verify rejection.',
      ],
      testData: 'Strings of length 19, 20, 500, and 501 characters',
      expectedResult: '19 and 501 chars fail validation; 20 and 500 chars pass validation.',
      controlVerified: 'Input Boundary Validation',
    },
    {
      testCaseId: 'TC-QA-004',
      linkedStoryId: 'US-002',
      suite: 'QA',
      scenarioCategory: 'Negative',
      title: 'Verify duplicate software request is blocked when user already holds an active license',
      preconditions: 'Employee "emp_104" already has an active license for "Jira Software" in SAM/IAM.',
      testSteps: [
        'Log in as "emp_104".',
        'Select "Jira Software" and click Submit.',
        'Observe automated SAM/IAM pre-check response.',
      ],
      testData: 'User: emp_104 (Active Entitlement = True) | Software: Jira Software',
      expectedResult: 'System blocks duplicate request creation and displays existing license details.',
      controlVerified: 'Automated License Entitlement Control',
    },
    {
      testCaseId: 'TC-QA-005',
      linkedStoryId: 'US-003',
      suite: 'QA',
      scenarioCategory: 'Positive',
      title: 'Verify automated in-portal Security approval task creation and ticket update for elevated software',
      preconditions: 'Request for "Snowflake Admin Role (Elevated)" is approved by Line Manager.',
      testSteps: [
        'Approve the request as Line Manager.',
        'Verify ticket status transitions to "Pending Security Approval" and appears in the Security Queue.',
        'Log in as Security Reviewer and click "Approve" with comment "Least privilege verified".',
        'Inspect ticket audit history and routing status.',
      ],
      testData: 'Ticket #REQ-901 | Elevated: True | Security Decision: Approved',
      expectedResult:
        'Ticket updates automatically without email or Service Desk intervention; immutable audit log records Manager + Security timestamps; ticket routes directly to fulfillment.',
      controlVerified: 'Security Approval for Elevated Access & Audit Trail',
    },
    {
      testCaseId: 'TC-UAT-001',
      linkedStoryId: 'US-003',
      suite: 'UAT',
      scenarioCategory: 'End-to-End Control',
      title: 'UAT End-to-End: Standard vs. Elevated Software Request with Full Control Preservation',
      preconditions: 'Staging portal connected to mock IAM/SAM and Manager/Security test accounts.',
      testSteps: [
        'Employee submits request for elevated software ("Production DB Read/Write").',
        'System completes SAM license pre-check in <5 seconds.',
        'Line Manager approves in portal -> verify audit log entry #1.',
        'Security Reviewer approves in portal -> verify audit log entry #2.',
        'Application Support / SCIM provisions access.',
        'Employee clicks "Confirm Working Access" -> verify ticket closes with complete audit trail.',
      ],
      testData: 'End-to-End UAT Scenario (Employee -> Manager -> Security -> Fulfillment -> Confirmation)',
      expectedResult:
        'All 4 mandatory controls (Manager approval, Security approval, Audit trail, Final access confirmation) are verified and total active workflow time is under 15 minutes.',
      controlVerified: 'All 4 Mandatory Governance Controls',
    },
    {
      testCaseId: 'TC-UAT-002',
      linkedStoryId: 'US-004',
      suite: 'UAT',
      scenarioCategory: 'Negative',
      title: 'UAT Governance Verification: Attempt to provision or close ticket without required approvals or confirmation',
      preconditions: 'Elevated software ticket is in "Pending Security Approval" state.',
      testSteps: [
        'Attempt to trigger provisioning before Security approval -> verify system blocks action.',
        'After provisioning, attempt to close ticket as Service Desk before Employee confirms access -> verify system blocks closure.',
      ],
      testData: 'Ticket #REQ-902 (Unapproved / Unconfirmed states)',
      expectedResult: 'System strictly enforces segregation of duties and blocks unauthorized provisioning or premature closure.',
      controlVerified: 'Segregation of Duties & Final Access Confirmation',
    },
  ],
};

export function renderUnifiedMarkdownDocument(spec: ProcessPortalSpec): string {
  const lines: string[] = [];

  lines.push(`# ${spec.processName} — Process Improvement & Agile Requirements Specification`);
  lines.push(
    `Document Version: ${spec.documentVersion} · Generated: ${spec.generatedAt} · Traceable AS-IS / TO-BE / User Stories / QA & UAT`
  );
  lines.push('');
  lines.push('---');
  lines.push('');

  // 1. Current Process
  lines.push('## 1. Current Process');
  lines.push(`**Business Objective:** ${spec.businessObjective}`);
  lines.push('');
  lines.push(`**Trigger Condition:** ${spec.triggerCondition}`);
  lines.push('');
  lines.push(`**End Condition:** ${spec.endCondition}`);
  lines.push('');
  lines.push('### Executive Summary');
  lines.push(spec.executiveSummary);
  lines.push('');
  lines.push('### Current Operational Metrics');
  for (const m of spec.currentMetrics) {
    lines.push(`- ${m}`);
  }
  lines.push('');
  lines.push('### Mandatory Governance Controls to Preserve');
  for (const c of spec.preservedControls) {
    lines.push(`- ${c}`);
  }
  lines.push('');
  lines.push('### Current AS-IS Process Steps');
  lines.push(
    '| Step # | Process Step | Detailed Description | Owner | System | Input | Output | Bottleneck Status | Control / Dependency |'
  );
  lines.push('| :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- |');
  for (const s of spec.asIsSteps) {
    lines.push(
      `| ${s.stepNumber} | **${s.stepName}** | ${s.description} | ${s.owner} | ${s.system} | ${s.input} | ${s.output} | ${s.bottleneckStatus} | ${s.controlOrDependency} |`
    );
  }
  lines.push('');

  // 2. Its Limitations after analysis
  lines.push('## 2. Its Limitations After Analysis (Bottlenecks & Root Causes)');
  lines.push(
    '| ID | Related AS-IS Steps | Limitation / Bottleneck | Evidence | Classification | Impact | Priority | Root-Cause Hypothesis | Recommended Action |'
  );
  lines.push('| :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- |');
  for (const lim of spec.limitations) {
    lines.push(
      `| **${lim.id}** | ${lim.relatedSteps} | **${lim.title}** | ${lim.evidence} | ${lim.classification} | ${lim.impact} | ${lim.priority} | ${lim.rootCauseHypothesis} | ${lim.recommendedAction} |`
    );
  }
  lines.push('');

  // 3. Current AS-IS Process Flow Diagram
  lines.push('## 3. Current AS-IS Process Flow Diagram');
  lines.push(
    `Confirmed and likely bottlenecks are highlighted in **red** (\`classDef bottleneck\`). [Open Editable AS-IS Process Flow in draw.io](${spec.currentStateDrawioUrl})`
  );
  lines.push('');
  lines.push('```mermaid');
  lines.push(spec.currentStateMermaid);
  lines.push('```');
  lines.push('');

  // 4. Recommendations for To-Be Process Flow
  lines.push('## 4. Recommendations for TO-BE Process Flow');
  lines.push(
    '| ID | Category | Recommendation | Detailed Design | Addresses Limitation | Preserved Controls | Expected Benefit |'
  );
  lines.push('| :--- | :--- | :--- | :--- | :--- | :--- | :--- |');
  for (const rec of spec.recommendations) {
    lines.push(
      `| **${rec.id}** | ${rec.category} | **${rec.title}** | ${rec.description} | ${rec.addressesLimitation} | ${rec.preservedControls} | ${rec.expectedBenefit} |`
    );
  }
  lines.push('');
  lines.push('### Future-State TO-BE Process Steps');
  lines.push(
    '| Step # | TO-BE Process Step | Detailed Description | Owner | System | Improvement Type | Control / Dependency | KPI Target |'
  );
  lines.push('| :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- |');
  for (const ts of spec.toBeSteps) {
    lines.push(
      `| ${ts.stepNumber} | **${ts.stepName}** | ${ts.description} | ${ts.owner} | ${ts.system} | ${ts.improvementType} | ${ts.controlOrDependency} | ${ts.kpiTarget} |`
    );
  }
  lines.push('');

  // 5. To-BE process flow image / diagram
  lines.push('## 5. TO-BE Process Flow Diagram & Image');
  lines.push(
    `New and materially improved steps are highlighted in **green** (\`classDef improved\`). [Open Editable TO-BE Process Flow in draw.io](${spec.improvedStateDrawioUrl})`
  );
  lines.push('');
  lines.push('```mermaid');
  lines.push(spec.improvedStateMermaid);
  lines.push('```');
  lines.push('');

  // 6 & 7. Functional Stories + Acceptance Criteria (Positive, Negative, Boundary) in the SAME document
  lines.push('## 6. Functional User Stories & 7. Acceptance Criteria (Positive, Negative & Boundary Scenarios)');
  lines.push(
    'Each functional user story below is directly traceable to the TO-BE process steps and includes complete **Positive**, **Negative**, and **Boundary** acceptance criteria for engineering and QA.'
  );
  lines.push('');

  for (const story of spec.functionalStories) {
    lines.push(`### ${story.storyId}: ${story.title}`);
    lines.push(
      `Persona: **${story.persona}** · Traceability: **${story.relatedToBeSteps}** · Priority: **${story.priority}** · Effort: **${story.storyPoints} Story Points**`
    );
    lines.push('');
    lines.push(`> **User Story:** ${story.userStoryStatement}`);
    lines.push('');
    lines.push(`- **Business Value:** ${story.businessValue}`);
    lines.push(`- **Technical Implementation Notes:** ${story.technicalNotes}`);
    lines.push('');
    lines.push('#### Acceptance Criteria (Positive, Negative & Boundary Scenarios)');
    lines.push('| AC ID | Scenario Type | Scenario Title | Given (Precondition) | When (Action) | Then (Expected Outcome) |');
    lines.push('| :--- | :--- | :--- | :--- | :--- | :--- |');
    for (const ac of story.acceptanceCriteria) {
      lines.push(
        `| **${ac.id}** | **${ac.scenarioType}** | ${ac.title} | ${ac.given} | ${ac.when} | ${ac.then} |`
      );
    }
    lines.push('');
  }

  // 8. Test Cases for QA and UAT
  lines.push('## 8. Test Cases for QA and UAT');
  lines.push(
    '| Test Case ID | Story ID | Suite | Scenario Category | Title | Preconditions | Test Steps | Test Data | Expected Result | Control Verified |'
  );
  lines.push('| :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- |');
  for (const tc of spec.testCases) {
    const formattedSteps = tc.testSteps.map((st, idx) => `${idx + 1}. ${st}`).join(' ');
    lines.push(
      `| **${tc.testCaseId}** | ${tc.linkedStoryId} | **${tc.suite}** | ${tc.scenarioCategory} | **${tc.title}** | ${tc.preconditions} | ${formattedSteps} | ${tc.testData} | ${tc.expectedResult} | ${tc.controlVerified} |`
    );
  }
  lines.push('');

  return lines.join('\n');
}
