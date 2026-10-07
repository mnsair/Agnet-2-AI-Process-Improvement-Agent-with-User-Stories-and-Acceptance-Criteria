import express from 'express';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import OpenAI from 'openai';
import dotenv from 'dotenv';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
dotenv.config(); // Load .env
dotenv.config({ path: path.resolve(__dirname, '.env.local'), override: true }); // Load .env.local

const DEFAULT_SYSTEM_MESSAGE = `ROLE
You are a Senior Systems Analyst, Business Systems Analyst, Agile Product Owner, and QA Lead. Help users discover, document, analyze, and improve business and technology-enabled processes, and write complete Engineering User Stories (with Positive, Negative, and Boundary Acceptance Criteria) and QA/UAT Test Cases in the same unified specification. Use only information supplied or reasonably established through discovery. Do not invent facts, metrics, systems, controls, or root causes.

DISCOVERY GATE
Before generating diagrams, ensure you understand: process name/scope, objective, trigger/start, end condition, major steps, decisions/branches, actors/owners, handoffs, systems where relevant, pain points, controls, and available metrics. If material details are missing, state a discovery status, summarize what is understood, ask no more than 3 focused questions, do not generate Mermaid, and end with PROCESS_FLOW_READY: false.

ANALYSIS PRINCIPLES
Assess wait/queue time, handoffs, ownership, rework, defects, duplicate entry, manual effort, exceptions, system limitations, integration gaps, approval delays, data quality, automation suitability, risk, impact, and dependencies. Do not assume manual work is automatically a bottleneck. Distinguish Confirmed Issue, Likely Bottleneck, Root-Cause Hypothesis, and Assumption. Preserve required security, compliance, approvals, segregation of duties, audit trails, documentation, and human oversight.

FINAL UNIFIED DOCUMENT SECTIONS
When discovery is sufficient, produce the following in order inside ONE unified document:
1. Current Process (Objective, Trigger, End Condition, Metrics, Controls, and AS-IS Process Steps Table)
2. Its Limitations After Analysis (Bottleneck and Root-Cause Analysis Table)
3. Current AS-IS Process Flow Diagram (as ONE fenced Mermaid block with red bottleneck highlighting)
4. Recommendations for TO-BE Process Flow (Recommendations + TO-BE Process Steps Table)
5. TO-BE Process Flow Diagram (as ONE fenced Mermaid block with green improvement highlighting)
6. Functional User Stories (written in the same document with Story ID, Persona, Story statement, Technical notes)
7. Acceptance Criteria with Positive, Negative, and Boundary Scenarios (embedded under each Functional User Story using Given/When/Then)
8. Test Cases for QA and UAT (comprehensive QA Functional, Negative, Boundary, and UAT End-to-End test cases table)

MERMAID RULES
Use conservative standard Mermaid syntax, preferably flowchart TD or LR. Use simple node IDs A, B, C... Activity: A["1. Process Step"]. Decision: D{"4. Decision?"}. Connections: A --> B and D -->|Yes| E. Do not use HTML, icons, click actions, custom themes, JavaScript, or experimental extensions. Final report must contain exactly TWO fenced Mermaid blocks: first AS-IS, second TO-BE.

AS-IS COLORING
Highlight only confirmed or likely bottleneck steps in red:
classDef bottleneck fill:#ffcccc,stroke:#cc0000,stroke-width:3px,color:#000
Use class declarations such as: class D,E bottleneck

TO-BE COLORING
Highlight only new or materially improved steps in green:
classDef improved fill:#ccffcc,stroke:#008000,stroke-width:3px,color:#000
Use class declarations such as: class B,C,D improved

MANDATORY ROUTING MARKER
At the very end of every response output exactly one standalone line. If discovery is incomplete: PROCESS_FLOW_READY: false. If final analysis is complete and contains exactly two Mermaid blocks: PROCESS_FLOW_READY: true. Use lowercase true/false exactly. Do not place the marker inside a code block.`;

interface ChatTurn {
  role: 'user' | 'model';
  text: string;
}

const memoryStore = new Map<string, ChatTurn[]>();
const CONTEXT_WINDOW_LENGTH = 30;

function createDrawioUrl(mermaid: string, title: string): string {
  if (!mermaid) return '';
  const payload = { type: 'mermaid', data: mermaid };
  return (
    'https://app.diagrams.net/?grid=1&pv=0&title=' +
    encodeURIComponent(title) +
    '#create=' +
    encodeURIComponent(JSON.stringify(payload))
  );
}

function processAgentOutput(aiResponse: string) {
  const isReady = aiResponse.includes('PROCESS_FLOW_READY: true');
  const diagrams: string[] = [];
  const re = /```mermaid\s*([\s\S]*?)```/gi;
  let m: RegExpExecArray | null;
  while ((m = re.exec(aiResponse)) !== null) {
    diagrams.push(m[1].trim());
  }

  const currentStateMermaid = diagrams[0] || '';
  const improvedStateMermaid = diagrams[1] || '';
  const currentStateDrawioUrl = isReady
    ? createDrawioUrl(currentStateMermaid, 'AS-IS Process')
    : '';
  const improvedStateDrawioUrl = isReady
    ? createDrawioUrl(improvedStateMermaid, 'TO-BE Process')
    : '';

  let finalResponse = aiResponse
    .replace(/\n*PROCESS_FLOW_READY:\s*(true|false)\s*$/i, '')
    .trim();

  if (isReady && currentStateDrawioUrl && improvedStateDrawioUrl) {
    finalResponse +=
      '\n\n---\n\n## Process Flow Diagrams (draw.io)\n\n### AS-IS Process Flow\n[Open AS-IS Process Flow in draw.io](' +
      currentStateDrawioUrl +
      ')\n\n### TO-BE Process Flow\n[Open TO-BE Process Flow in draw.io](' +
      improvedStateDrawioUrl +
      ')';
  }

  return {
    output: finalResponse,
    processFlowReady: isReady,
    currentStateMermaid,
    improvedStateMermaid,
    currentStateDrawioUrl,
    improvedStateDrawioUrl,
    executedNodes: isReady
      ? [
          'When chat message received',
          'Conversation Memory',
          'Process Improvement AI Agent',
          'Ready to build? (true)',
          'Create Draw.io Link',
          'Return Final Analysis + Draw.io Links',
        ]
      : [
          'When chat message received',
          'Conversation Memory',
          'Process Improvement AI Agent',
          'Ready to build? (false)',
          'Return Discovery Response',
        ],
  };
}

async function startServer() {
  const app = express();
  app.use(express.json({ limit: '4mb' }));

  app.get('/api/workflow', (_req, res) => {
    try {
      const workflowPath = path.join(
        __dirname,
        'workflow',
        'Process_Improvement_AI_Agent_Drawio_Links.json'
      );
      const raw = fs.readFileSync(workflowPath, 'utf-8');
      res.json(JSON.parse(raw));
    } catch (_error) {
      res.status(500).json({ error: 'Failed to load workflow JSON' });
    }
  });

  app.get('/api/example-case', (_req, res) => {
    try {
      const examplePath = path.join(
        __dirname,
        'examples',
        'employee-software-access-request.md'
      );
      const content = fs.readFileSync(examplePath, 'utf-8');
      res.json({ content, defaultSystemMessage: DEFAULT_SYSTEM_MESSAGE });
    } catch (_error) {
      res.json({ content: '', defaultSystemMessage: DEFAULT_SYSTEM_MESSAGE });
    }
  });

  app.post('/api/memory/clear', (req, res) => {
    const { sessionId = 'default' } = req.body || {};
    memoryStore.delete(sessionId);
    res.json({ ok: true });
  });

  // HTTP Portal Endpoint: Full Process Analysis + Draw.io Flows + Unified Document + User Stories (Positive/Negative/Boundary ACs) + QA/UAT Test Cases
  app.post('/api/portal/analyze', async (req, res) => {
    try {
      const {
        processName,
        businessObjective,
        triggerCondition,
        endCondition,
        processStepsText,
        knownBottlenecksText,
        currentMetricsText,
        requiredControlsText,
        rawNotes,
      } = req.body || {};

      const apiKey = process.env.OPENAI_API_KEY;
      if (!apiKey) {
        res.status(500).json({
          error:
            'OPENAI_API_KEY is not configured on the server. Please check Settings > Secrets.',
        });
        return;
      }

      const openai = new OpenAI({
        apiKey,
      });

      const prompt = `Analyze the following business process and generate a complete, traceable Process Improvement & Agile Requirements Specification JSON object.

PROCESS INPUT:
- Process Name: ${processName || 'Unspecified Process'}
- Business Objective: ${businessObjective || 'Improve process efficiency while preserving controls'}
- Trigger Condition: ${triggerCondition || 'Process initiated by requester'}
- End Condition: ${endCondition || 'Process completed or rejected with audit trail'}
- Current Process Steps:
${processStepsText || ''}
- Known Pain Points / Bottlenecks:
${knownBottlenecksText || ''}
- Current Operational Metrics:
${currentMetricsText || ''}
- Mandatory Controls That Must Remain:
${requiredControlsText || ''}
- Additional Context / Discovery Notes:
${rawNotes || ''}

REQUIREMENTS FOR OUTPUT:
1. Document all current AS-IS steps sequentially starting at 1.
2. Identify evidence-supported limitations/bottlenecks after analysis, separating Confirmed Issue, Likely Bottleneck, and Root-Cause Hypothesis.
3. Build a clean, valid Mermaid flowchart TD for the Current AS-IS Process Flow (currentStateMermaid) with sequential step numbers and highlight confirmed/likely bottleneck nodes in red using:
   classDef bottleneck fill:#ffcccc,stroke:#cc0000,stroke-width:3px,color:#000
   and class declarations (e.g., class D,E bottleneck). Do NOT wrap the Mermaid string in markdown backticks.
4. Provide actionable Recommendations for the TO-BE Process Flow and sequential TO-BE Process Steps starting at 1 that preserve all mandatory controls.
5. Build a clean, valid Mermaid flowchart TD for the TO-BE Process Flow (improvedStateMermaid) with sequential step numbers and highlight new or materially improved nodes in green using:
   classDef improved fill:#ccffcc,stroke:#008000,stroke-width:3px,color:#000
   and class declarations (e.g., class A,B,E improved). Do NOT wrap the Mermaid string in markdown backticks.
6. Write comprehensive Functional User Stories (at least 4 stories) for the development team.
7. Inside EVERY Functional User Story, include Acceptance Criteria covering Positive, Negative, AND Boundary scenarios (using Given / When / Then).
8. Write a complete suite of Test Cases for both QA and UAT (at least 6 test cases across QA Positive, QA Negative, QA Boundary, and UAT End-to-End Control verification).`;

      const schemaString = JSON.stringify({
        type: 'object',
        properties: {
          processName: { type: 'string' },
          documentVersion: { type: 'string' },
          generatedAt: { type: 'string' },
          businessObjective: { type: 'string' },
          triggerCondition: { type: 'string' },
          endCondition: { type: 'string' },
          currentMetrics: {
            type: 'array',
            items: { type: 'string' },
          },
          preservedControls: {
            type: 'array',
            items: { type: 'string' },
          },
          executiveSummary: { type: 'string' },
          asIsSteps: {
            type: 'array',
            items: {
              type: 'object',
              properties: {
                stepNumber: { type: 'number' },
                stepName: { type: 'string' },
                description: { type: 'string' },
                owner: { type: 'string' },
                system: { type: 'string' },
                input: { type: 'string' },
                output: { type: 'string' },
                bottleneckStatus: {
                  type: 'string',
                  description: 'None, Confirmed Bottleneck, or Likely Bottleneck',
                },
                controlOrDependency: { type: 'string' },
              },
              required: [
                'stepNumber',
                'stepName',
                'description',
                'owner',
                'system',
                'input',
                'output',
                'bottleneckStatus',
                'controlOrDependency',
              ],
            },
          },
          limitations: {
            type: 'array',
            items: {
              type: 'object',
              properties: {
                id: { type: 'string' },
                relatedSteps: { type: 'string' },
                title: { type: 'string' },
                evidence: { type: 'string' },
                classification: {
                  type: 'string',
                  description: 'Confirmed Issue, Likely Bottleneck, or Root-Cause Hypothesis',
                },
                impact: { type: 'string' },
                priority: { type: 'string', description: 'Critical, High, or Medium' },
                rootCauseHypothesis: { type: 'string' },
                recommendedAction: { type: 'string' },
              },
              required: [
                'id',
                'relatedSteps',
                'title',
                'evidence',
                'classification',
                'impact',
                'priority',
                'rootCauseHypothesis',
                'recommendedAction',
              ],
            },
          },
          currentStateMermaid: {
            type: 'string',
            description:
              'Valid Mermaid flowchart TD string for AS-IS process with classDef bottleneck',
          },
          recommendations: {
            type: 'array',
            items: {
              type: 'object',
              properties: {
                id: { type: 'string' },
                category: {
                  type: 'string',
                  description:
                    'Automation, Integration, Workflow, Data Quality, or Governance & Control',
                },
                title: { type: 'string' },
                description: { type: 'string' },
                addressesLimitation: { type: 'string' },
                preservedControls: { type: 'string' },
                expectedBenefit: { type: 'string' },
              },
              required: [
                'id',
                'category',
                'title',
                'description',
                'addressesLimitation',
                'preservedControls',
                'expectedBenefit',
              ],
            },
          },
          toBeSteps: {
            type: 'array',
            items: {
              type: 'object',
              properties: {
                stepNumber: { type: 'number' },
                stepName: { type: 'string' },
                description: { type: 'string' },
                owner: { type: 'string' },
                system: { type: 'string' },
                improvementType: {
                  type: 'string',
                  description: 'Automated, Integrated, Streamlined, or Control Preserved',
                },
                controlOrDependency: { type: 'string' },
                kpiTarget: { type: 'string' },
              },
              required: [
                'stepNumber',
                'stepName',
                'description',
                'owner',
                'system',
                'improvementType',
                'controlOrDependency',
                'kpiTarget',
              ],
            },
          },
          improvedStateMermaid: {
            type: 'string',
            description:
              'Valid Mermaid flowchart TD string for TO-BE process with classDef improved',
          },
          functionalStories: {
            type: 'array',
            items: {
              type: 'object',
              properties: {
                storyId: { type: 'string' },
                title: { type: 'string' },
                persona: { type: 'string' },
                relatedToBeSteps: { type: 'string' },
                priority: { type: 'string' },
                storyPoints: { type: 'number' },
                userStoryStatement: { type: 'string' },
                businessValue: { type: 'string' },
                technicalNotes: { type: 'string' },
                acceptanceCriteria: {
                  type: 'array',
                  items: {
                    type: 'object',
                    properties: {
                      id: { type: 'string' },
                      scenarioType: {
                        type: 'string',
                        description: 'Positive, Negative, or Boundary',
                      },
                      title: { type: 'string' },
                      given: { type: 'string' },
                      when: { type: 'string' },
                      then: { type: 'string' },
                    },
                    required: ['id', 'scenarioType', 'title', 'given', 'when', 'then'],
                  },
                },
              },
              required: [
                'storyId',
                'title',
                'persona',
                'relatedToBeSteps',
                'priority',
                'storyPoints',
                'userStoryStatement',
                'businessValue',
                'technicalNotes',
                'acceptanceCriteria',
              ],
            },
          },
          testCases: {
            type: 'array',
            items: {
              type: 'object',
              properties: {
                testCaseId: { type: 'string' },
                linkedStoryId: { type: 'string' },
                suite: { type: 'string', description: 'QA or UAT' },
                scenarioCategory: {
                  type: 'string',
                  description: 'Positive, Negative, Boundary, or End-to-End Control',
                },
                title: { type: 'string' },
                preconditions: { type: 'string' },
                testSteps: {
                  type: 'array',
                  items: { type: 'string' },
                },
                testData: { type: 'string' },
                expectedResult: { type: 'string' },
                controlVerified: { type: 'string' },
              },
              required: [
                'testCaseId',
                'linkedStoryId',
                'suite',
                'scenarioCategory',
                'title',
                'preconditions',
                'testSteps',
                'testData',
                'expectedResult',
                'controlVerified',
              ],
            },
          },
        },
        required: [
          'processName',
          'documentVersion',
          'generatedAt',
          'businessObjective',
          'triggerCondition',
          'endCondition',
          'currentMetrics',
          'preservedControls',
          'executiveSummary',
          'asIsSteps',
          'limitations',
          'currentStateMermaid',
          'recommendations',
          'toBeSteps',
          'improvedStateMermaid',
          'functionalStories',
          'testCases',
        ],
      });

      const response = await openai.chat.completions.create({
        model: 'gpt-4o',
        temperature: 0.2,
        messages: [{ role: 'user', content: prompt + '\n\nIMPORTANT: Respond ONLY with a valid JSON object matching this schema:\n' + schemaString }],
        response_format: { type: 'json_object' },
      });

      const rawJson = (response.choices[0].message.content || '{}').trim();
      const parsed = JSON.parse(rawJson);

      const cleanAsIsMermaid = (parsed.currentStateMermaid || '')
        .replace(/^```mermaid\s*/i, '')
        .replace(/```$/i, '')
        .trim();
      const cleanToBeMermaid = (parsed.improvedStateMermaid || '')
        .replace(/^```mermaid\s*/i, '')
        .replace(/```$/i, '')
        .trim();

      const fullSpec = {
        ...parsed,
        generatedAt: new Date().toISOString().slice(0, 10),
        currentStateMermaid: cleanAsIsMermaid,
        improvedStateMermaid: cleanToBeMermaid,
        currentStateDrawioUrl: createDrawioUrl(
          cleanAsIsMermaid,
          `${parsed.processName || 'Process'} - AS-IS`
        ),
        improvedStateDrawioUrl: createDrawioUrl(
          cleanToBeMermaid,
          `${parsed.processName || 'Process'} - TO-BE`
        ),
      };

      res.json({ spec: fullSpec });
    } catch (error: unknown) {
      console.error('Error in /api/portal/analyze:', error);
      const errMsg =
        error instanceof Error
          ? error.message
          : 'Failed to analyze process and generate specification.';
      res.status(500).json({ error: errMsg });
    }
  });

  app.post('/api/chat', async (req, res) => {
    try {
      const {
        message,
        sessionId = 'default',
        systemInstruction,
      } = req.body || {};

      if (!message || typeof message !== 'string') {
        res.status(400).json({ error: 'Message is required.' });
        return;
      }

      const apiKey = process.env.OPENAI_API_KEY;
      if (!apiKey) {
        res.status(500).json({
          error:
            'OPENAI_API_KEY is not configured on the server. Please check Settings > Secrets.',
        });
        return;
      }

      const openai = new OpenAI({
        apiKey,
      });

      const history = memoryStore.get(sessionId) || [];
      const windowedHistory = history.slice(-CONTEXT_WINDOW_LENGTH);

      const messages: any[] = [
        {
          role: 'system',
          content: systemInstruction && systemInstruction.trim()
            ? systemInstruction
            : DEFAULT_SYSTEM_MESSAGE
        },
        ...windowedHistory.map((turn) => ({
          role: turn.role === 'model' ? 'assistant' : 'user',
          content: turn.text,
        })),
        {
          role: 'user',
          content: message,
        },
      ];

      const response = await openai.chat.completions.create({
        model: 'gpt-4o',
        messages,
        temperature: 0.3,
      });

      const rawText = response.choices[0].message.content || '';

      const newTurns: ChatTurn[] = [
        ...windowedHistory,
        { role: 'user', text: message },
        { role: 'model', text: rawText },
      ];
      const updatedHistory: ChatTurn[] = newTurns.slice(-CONTEXT_WINDOW_LENGTH);
      memoryStore.set(sessionId, updatedHistory);

      const processed = processAgentOutput(rawText);
      res.json(processed);
    } catch (error: unknown) {
      console.error('Error in /api/chat:', error);
      const errMsg =
        error instanceof Error
          ? error.message
          : 'An unexpected error occurred while running the Process Improvement AI Agent.';
      res.status(500).json({ error: errMsg });
    }
  });

  const distPath = path.join(__dirname, 'dist');
  const isProd = process.env.NODE_ENV === 'production' && fs.existsSync(distPath);

  if (isProd) {
    app.use(express.static(distPath));
    app.get('*', (_req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  } else {
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  }

  const port = 3000;
  app.listen(port, '0.0.0.0', () => {
    console.log(`AI Process Flow Improvement Portal listening on http://0.0.0.0:${port}`);
  });
}

startServer();
