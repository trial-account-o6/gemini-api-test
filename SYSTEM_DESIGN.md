# Pi Agent Ticket Resolution System - Backend Design

## Table of Contents
1. [System Overview](#system-overview)
2. [Architecture Components](#architecture-components)
3. [Data Flow](#data-flow)
4. [Database Schema](#database-schema)
5. [API Specifications](#api-specifications)
6. [Technology Stack](#technology-stack)
7. [Deployment Architecture](#deployment-architecture)
8. [Security Considerations](#security-considerations)

---

## System Overview

An autonomous ticket resolution system that uses AI planning and Pi Agent execution with human-in-the-loop approval gates.

### Key Principles
- **Human-in-the-loop**: Two approval gates (Intent & Code Review)
- **Scope-bound execution**: Pi Agent strictly follows approved SPEC.md
- **Scalability**: Queue-based architecture handles burst traffic
- **Auditability**: Full workflow tracking and state management

---

## Architecture Components

### 1. API Gateway (Webhook Receiver)
**Technology**: Node.js + Express / FastAPI
**Responsibilities**:
- Receive webhooks from Flux Lens
- Validate webhook signatures
- Enqueue ticket events to task queue
- Return immediate acknowledgment (200 OK)

**Endpoints**:
```
POST /webhooks/flux-lens
  - Receives ticket creation events
  - Validates HMAC signature
  - Pushes to queue
  
GET /health
  - Health check endpoint
```

### 2. Task Queue
**Technology**: Redis (Bull/BullMQ) or RabbitMQ or AWS SQS
**Purpose**: 
- Buffer incoming ticket events
- Prevent system overload during burst traffic
- Enable retry logic for failed processing
- Dead letter queue for failed tasks

**Queue Structure**:
```
Queue: ticket-events
├── Priority levels: high, normal, low
├── Retry: 3 attempts with exponential backoff
└── DLQ: failed-tickets (after max retries)
```

### 3. Orchestration Service (Core Workflow Engine)
**Technology**: Node.js/Python with State Machine (e.g., XState, AWS Step Functions)
**Responsibilities**:
- Process ticket events from queue
- Manage workflow state transitions
- Coordinate between all services
- Handle timeouts and error recovery

**Workflow States**:
```
PENDING → PLANNING → AWAITING_SPEC_APPROVAL → SPEC_APPROVED/REJECTED
       → EXECUTING → QA_RUNNING → PR_CREATED
       → AWAITING_PR_APPROVAL → MERGED → COMPLETED
       
Error States: SPEC_REJECTED, QA_FAILED, PR_CLOSED, ERROR
```

**State Machine Logic**:
```javascript
const workflowStates = {
  PENDING: {
    on: {
      START_PLANNING: 'PLANNING'
    }
  },
  PLANNING: {
    on: {
      SPEC_GENERATED: 'AWAITING_SPEC_APPROVAL',
      PLANNING_FAILED: 'ERROR'
    }
  },
  AWAITING_SPEC_APPROVAL: {
    on: {
      APPROVE: 'SPEC_APPROVED',
      REVISE: 'PLANNING',
      REJECT: 'SPEC_REJECTED'
    }
  },
  SPEC_APPROVED: {
    on: {
      START_EXECUTION: 'EXECUTING'
    }
  },
  EXECUTING: {
    on: {
      EXECUTION_COMPLETE: 'QA_RUNNING',
      EXECUTION_FAILED: 'ERROR'
    }
  },
  QA_RUNNING: {
    on: {
      QA_PASSED: 'PR_CREATED',
      QA_FAILED: 'ERROR'
    }
  },
  PR_CREATED: {
    on: {
      AWAITING_REVIEW: 'AWAITING_PR_APPROVAL'
    }
  },
  AWAITING_PR_APPROVAL: {
    on: {
      PR_MERGED: 'COMPLETED',
      PR_CLOSED: 'ERROR'
    }
  },
  COMPLETED: {
    type: 'final'
  }
}
```

### 4. Planning AI Service
**Technology**: Python + LangChain/LlamaIndex + OpenAI/Anthropic API
**Responsibilities**:
- Pull ticket details from Flux Lens
- Analyze codebase context
- Generate SPEC.md with:
  - Problem statement
  - Files to modify
  - Proposed changes
  - Verification plan
  - Test strategy

**AI Model**: GPT-4, Claude 3.5 Sonnet, or Gemini 2.0 (high-reasoning models)

**Service API**:
```
POST /planning/generate
  Body: {
    ticket_id: string,
    ticket_data: object,
    repository_url: string
  }
  Response: {
    spec_path: string,
    spec_content: string,
    confidence_score: float
  }
```

**SPEC.md Template**:
```markdown
# Ticket #{{ticket_id}}: {{title}}

## Problem Statement
{{description}}

## Proposed Solution
{{high_level_approach}}

## Files to Modify
- `path/to/file1.py` - {{reason}}
- `path/to/file2.js` - {{reason}}

## Implementation Plan
1. {{step1}}
2. {{step2}}

## Testing Strategy
- Unit tests: {{test_files}}
- Integration tests: {{test_scenarios}}

## Verification Checklist
- [ ] Tests pass
- [ ] No breaking changes
- [ ] Documentation updated

## Risks & Mitigations
{{risks}}
```

### 5. Human Approval Service
**Technology**: Node.js/Python + PostgreSQL + WebSocket/SSE
**Responsibilities**:
- Store approval requests
- Notify developers (Slack, Email, Dashboard)
- Track approval decisions
- Enforce timeout policies

**Notification Channels**:
- Slack webhook
- Email (SendGrid/SES)
- Dashboard UI (real-time updates via WebSocket)

**Service API**:
```
POST /approvals/request
  Body: {
    workflow_id: string,
    approval_type: "SPEC" | "PR",
    content_url: string,
    assignee: string
  }
  
POST /approvals/{approval_id}/decision
  Body: {
    decision: "APPROVE" | "REVISE" | "REJECT",
    comments: string
  }

GET /approvals/pending
  Query: { assignee: string }
  
WebSocket: /approvals/subscribe
  - Real-time approval requests
```

**Timeout Policy**:
- SPEC Approval: 24 hours → Auto-reject
- PR Approval: 48 hours → Auto-close PR

### 6. Pi Agent Manager Service
**Technology**: Node.js + Pi Agent SDK
**Responsibilities**:
- Create isolated workspaces (Docker containers or sandboxed directories)
- Initialize Pi Agent with approved SPEC.md
- Monitor agent execution
- Capture agent logs and artifacts
- Enforce scope boundaries

**Workspace Isolation**:
```
/workspaces/
  /{workflow_id}/
    /repo/           # Git clone of target repository
    /SPEC.md         # Approved specification
    /agent.log       # Pi Agent execution log
    /.pi/            # Pi Agent configuration
    /artifacts/      # Generated files
```

**Agent Configuration**:
```javascript
const piAgentConfig = {
  workspacePath: `/workspaces/${workflowId}/repo`,
  specPath: `/workspaces/${workflowId}/SPEC.md`,
  constraints: {
    maxExecutionTime: '30m',
    allowedTools: ['read', 'write', 'bash', 'edit'],
    filePatterns: specApprovedFiles, // Only files listed in SPEC
    networkAccess: false, // No external API calls
  },
  callbacks: {
    onProgress: (step) => updateWorkflowProgress(workflowId, step),
    onComplete: (result) => transitionToQA(workflowId, result),
    onError: (error) => handleExecutionError(workflowId, error)
  }
}
```

**Service API**:
```
POST /agent/execute
  Body: {
    workflow_id: string,
    spec_path: string,
    repository_url: string,
    branch_name: string
  }
  
GET /agent/status/{workflow_id}
  Response: {
    status: "RUNNING" | "COMPLETED" | "FAILED",
    progress: number,
    current_step: string
  }

GET /agent/logs/{workflow_id}
  Response: { logs: string[] }
```

### 7. QA Service
**Technology**: Node.js/Python
**Responsibilities**:
- Run automated tests
- Execute linters and formatters
- Check build status
- Validate against SPEC.md checklist
- Generate QA report

**Quality Gates**:
```javascript
const qualityGates = [
  {
    name: 'Unit Tests',
    command: 'npm test',
    required: true
  },
  {
    name: 'Linting',
    command: 'npm run lint',
    required: true
  },
  {
    name: 'Type Check',
    command: 'npm run typecheck',
    required: false
  },
  {
    name: 'Build',
    command: 'npm run build',
    required: true
  },
  {
    name: 'Integration Tests',
    command: 'npm run test:integration',
    required: false
  }
]
```

**Service API**:
```
POST /qa/run
  Body: {
    workflow_id: string,
    workspace_path: string,
    spec_checklist: object
  }
  Response: {
    passed: boolean,
    results: QAResult[],
    report_url: string
  }
```

### 8. GitHub Integration Service
**Technology**: Node.js + Octokit (GitHub API)
**Responsibilities**:
- Create feature branches
- Push code changes
- Create Pull Requests
- Add PR descriptions (link to ticket, SPEC, QA report)
- Monitor PR status (merged/closed)

**Service API**:
```
POST /github/create-pr
  Body: {
    workflow_id: string,
    repository: string,
    base_branch: string,
    head_branch: string,
    title: string,
    body: string,
    ticket_id: string
  }
  Response: {
    pr_url: string,
    pr_number: number
  }

POST /github/webhook
  # Receives PR merge/close events
```

**PR Template**:
```markdown
## Ticket
Fixes: [Flux Lens #{{ticket_id}}]({{ticket_url}})

## Specification
[SPEC.md]({{spec_url}})

## Changes
{{ai_generated_summary}}

## QA Report
{{qa_report_link}}

## Verification
- [x] All tests passing
- [x] Code follows style guide
- [x] No breaking changes

---
🤖 This PR was automatically generated by Pi Agent
```

### 9. Flux Lens Integration Service
**Technology**: Node.js/Python
**Responsibilities**:
- Fetch ticket details
- Update ticket status
- Add comments with progress updates
- Mark tickets as "Done" on PR merge

**Service API**:
```
GET /fluxlens/ticket/{ticket_id}
  Response: { ticket details }

POST /fluxlens/ticket/{ticket_id}/comment
  Body: { comment: string }

PATCH /fluxlens/ticket/{ticket_id}/status
  Body: { status: "Done" }
```

---

## Data Flow

### End-to-End Flow

```
1. Ticket Created (Flux Lens)
   └─> Webhook → API Gateway → Task Queue

2. Orchestration Service picks up task
   └─> Create Workflow record (DB)
   └─> Transition to PLANNING state

3. Planning AI Service
   └─> Fetch ticket from Flux Lens
   └─> Analyze codebase
   └─> Generate SPEC.md
   └─> Store SPEC in DB + S3
   └─> Transition to AWAITING_SPEC_APPROVAL

4. Human Approval Service
   └─> Send notification (Slack/Email)
   └─> Developer reviews SPEC.md
   └─> Decision: APPROVE/REVISE/REJECT
   └─> Update workflow state

5. [IF APPROVED] Pi Agent Manager
   └─> Create workspace
   └─> Clone repository
   └─> Initialize Pi Agent with SPEC.md
   └─> Execute changes
   └─> Commit to feature branch
   └─> Transition to QA_RUNNING

6. QA Service
   └─> Run automated tests
   └─> Run linters
   └─> Validate SPEC checklist
   └─> Generate QA report
   └─> If PASSED → Transition to PR_CREATED

7. GitHub Service
   └─> Push branch
   └─> Create Pull Request
   └─> Link ticket, SPEC, QA report
   └─> Transition to AWAITING_PR_APPROVAL

8. Human Approval (PR Review)
   └─> Developer reviews code
   └─> Merge PR
   └─> GitHub webhook → Orchestration Service

9. Final Sync
   └─> Update Flux Lens ticket → "Done"
   └─> Cleanup workspace
   └─> Archive workflow data
   └─> Transition to COMPLETED
```

---

## Database Schema

### PostgreSQL Tables

```sql
-- Workflows (main state tracker)
CREATE TABLE workflows (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  ticket_id VARCHAR(255) NOT NULL UNIQUE,
  ticket_url TEXT,
  repository_url TEXT NOT NULL,
  state VARCHAR(50) NOT NULL, -- Current workflow state
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),
  completed_at TIMESTAMP,
  
  -- Planning phase
  spec_path TEXT,
  spec_approved_at TIMESTAMP,
  spec_approved_by VARCHAR(255),
  
  -- Execution phase
  workspace_path TEXT,
  branch_name VARCHAR(255),
  
  -- QA phase
  qa_report_url TEXT,
  qa_passed BOOLEAN,
  
  -- PR phase
  pr_url TEXT,
  pr_number INTEGER,
  pr_merged_at TIMESTAMP,
  
  -- Metadata
  error_message TEXT,
  retry_count INTEGER DEFAULT 0,
  
  INDEX idx_ticket_id (ticket_id),
  INDEX idx_state (state),
  INDEX idx_created_at (created_at)
);

-- State Transitions (audit log)
CREATE TABLE state_transitions (
  id SERIAL PRIMARY KEY,
  workflow_id UUID REFERENCES workflows(id),
  from_state VARCHAR(50),
  to_state VARCHAR(50) NOT NULL,
  triggered_by VARCHAR(255), -- system, user email, webhook
  reason TEXT,
  metadata JSONB, -- Additional context
  created_at TIMESTAMP DEFAULT NOW(),
  
  INDEX idx_workflow_id (workflow_id),
  INDEX idx_created_at (created_at)
);

-- Approval Requests
CREATE TABLE approvals (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workflow_id UUID REFERENCES workflows(id),
  approval_type VARCHAR(50) NOT NULL, -- SPEC, PR
  assignee VARCHAR(255) NOT NULL,
  content_url TEXT,
  status VARCHAR(50) DEFAULT 'PENDING', -- PENDING, APPROVED, REJECTED, EXPIRED
  decision VARCHAR(50), -- APPROVE, REVISE, REJECT
  comments TEXT,
  requested_at TIMESTAMP DEFAULT NOW(),
  decided_at TIMESTAMP,
  expires_at TIMESTAMP,
  
  INDEX idx_workflow_id (workflow_id),
  INDEX idx_assignee (assignee),
  INDEX idx_status (status)
);

-- Agent Execution Logs
CREATE TABLE agent_logs (
  id SERIAL PRIMARY KEY,
  workflow_id UUID REFERENCES workflows(id),
  log_level VARCHAR(20), -- DEBUG, INFO, WARN, ERROR
  message TEXT,
  tool_used VARCHAR(50),
  file_path TEXT,
  created_at TIMESTAMP DEFAULT NOW(),
  
  INDEX idx_workflow_id (workflow_id),
  INDEX idx_created_at (created_at)
);

-- QA Results
CREATE TABLE qa_results (
  id SERIAL PRIMARY KEY,
  workflow_id UUID REFERENCES workflows(id),
  gate_name VARCHAR(100),
  command TEXT,
  passed BOOLEAN,
  output TEXT,
  duration_ms INTEGER,
  created_at TIMESTAMP DEFAULT NOW(),
  
  INDEX idx_workflow_id (workflow_id)
);

-- Notifications
CREATE TABLE notifications (
  id SERIAL PRIMARY KEY,
  workflow_id UUID REFERENCES workflows(id),
  channel VARCHAR(50), -- slack, email, dashboard
  recipient VARCHAR(255),
  subject TEXT,
  body TEXT,
  sent_at TIMESTAMP DEFAULT NOW(),
  status VARCHAR(50), -- SENT, FAILED
  
  INDEX idx_workflow_id (workflow_id)
);
```

### Redis Data Structures

```
# Active workflow locks (prevent duplicate processing)
workflow:lock:{ticket_id} → {workflow_id} (TTL: 1 hour)

# Workflow state cache (fast state lookups)
workflow:state:{workflow_id} → JSON (workflows table row)

# Agent progress tracking
workflow:progress:{workflow_id} → JSON {
  current_step: string,
  progress_percent: number,
  last_activity: timestamp
}

# Approval notification cache
approval:pending:{assignee} → Set of approval IDs
```

---

## API Specifications

### Internal Service APIs

#### Orchestration Service

```yaml
# Start workflow
POST /workflows/start
Request:
  ticket_id: string
  ticket_data: object
  repository_url: string
Response:
  workflow_id: string
  state: string

# Get workflow status
GET /workflows/{workflow_id}
Response:
  id: string
  ticket_id: string
  state: string
  created_at: timestamp
  spec_path: string
  pr_url: string
  # ... all workflow fields

# Transition workflow state
POST /workflows/{workflow_id}/transition
Request:
  to_state: string
  triggered_by: string
  metadata: object
Response:
  success: boolean
  new_state: string

# List workflows
GET /workflows
Query:
  state: string (optional)
  limit: number (default: 50)
  offset: number (default: 0)
Response:
  workflows: Workflow[]
  total: number
```

### Dashboard/Admin API

```yaml
# Get pending approvals for user
GET /api/approvals/pending
Headers:
  Authorization: Bearer {token}
Response:
  approvals: Approval[]

# Submit approval decision
POST /api/approvals/{approval_id}/decide
Request:
  decision: "APPROVE" | "REVISE" | "REJECT"
  comments: string
Response:
  success: boolean
  workflow_updated: boolean

# Get workflow details with timeline
GET /api/workflows/{workflow_id}/timeline
Response:
  workflow: Workflow
  transitions: StateTransition[]
  approvals: Approval[]
  qa_results: QAResult[]

# System metrics
GET /api/metrics
Response:
  active_workflows: number
  pending_approvals: number
  completed_today: number
  success_rate: number
```

---

## Technology Stack

### Backend Services
- **API Gateway**: Node.js + Express or Python + FastAPI
- **Orchestration**: Node.js with XState or Python with Temporal
- **Planning AI**: Python + LangChain + OpenAI/Anthropic API
- **Pi Agent Manager**: Node.js + Pi Agent SDK
- **QA Service**: Node.js/Python (language-agnostic test runner)

### Infrastructure
- **Database**: PostgreSQL 14+ (state management, audit logs)
- **Cache**: Redis 7+ (locks, session, fast lookups)
- **Queue**: Bull (Redis-backed) or RabbitMQ or AWS SQS
- **Storage**: AWS S3 or MinIO (SPEC files, QA reports, logs)
- **Container Runtime**: Docker + Docker Compose (local) or Kubernetes (production)

### External Integrations
- **GitHub**: Octokit (GitHub API v4 - GraphQL)
- **Flux Lens**: REST API (custom integration)
- **Notifications**: Slack SDK, SendGrid/AWS SES
- **AI Models**: OpenAI API, Anthropic API, or Google Gemini API

### Observability
- **Logging**: Winston (Node.js) or Structlog (Python) → Elasticsearch or Loki
- **Metrics**: Prometheus + Grafana
- **Tracing**: OpenTelemetry → Jaeger/Tempo
- **APM**: Datadog or New Relic (optional)

### Development Tools
- **Language**: TypeScript (Node.js services), Python 3.11+
- **Testing**: Jest (Node.js), Pytest (Python)
- **CI/CD**: GitHub Actions
- **Code Quality**: ESLint, Prettier, Black, MyPy

---

## Deployment Architecture

### Docker Compose (Local Development)

```yaml
version: '3.9'

services:
  # API Gateway
  api-gateway:
    build: ./services/api-gateway
    ports:
      - "3000:3000"
    environment:
      - DATABASE_URL=postgresql://postgres:password@postgres:5432/pi_agent_system
      - REDIS_URL=redis://redis:6379
      - FLUX_LENS_WEBHOOK_SECRET=${WEBHOOK_SECRET}
    depends_on:
      - postgres
      - redis

  # Orchestration Service
  orchestrator:
    build: ./services/orchestrator
    environment:
      - DATABASE_URL=postgresql://postgres:password@postgres:5432/pi_agent_system
      - REDIS_URL=redis://redis:6379
      - QUEUE_NAME=ticket-events
    depends_on:
      - postgres
      - redis
      - queue-worker

  # Planning AI Service
  planning-ai:
    build: ./services/planning-ai
    environment:
      - OPENAI_API_KEY=${OPENAI_API_KEY}
      - DATABASE_URL=postgresql://postgres:password@postgres:5432/pi_agent_system
    depends_on:
      - postgres

  # Pi Agent Manager
  pi-agent-manager:
    build: ./services/pi-agent-manager
    volumes:
      - ./workspaces:/workspaces
      - /var/run/docker.sock:/var/run/docker.sock # For container orchestration
    environment:
      - DATABASE_URL=postgresql://postgres:password@postgres:5432/pi_agent_system
      - WORKSPACE_BASE=/workspaces
    depends_on:
      - postgres

  # QA Service
  qa-service:
    build: ./services/qa-service
    volumes:
      - ./workspaces:/workspaces
    environment:
      - DATABASE_URL=postgresql://postgres:password@postgres:5432/pi_agent_system

  # GitHub Integration
  github-service:
    build: ./services/github-service
    environment:
      - GITHUB_TOKEN=${GITHUB_TOKEN}
      - DATABASE_URL=postgresql://postgres:password@postgres:5432/pi_agent_system

  # Human Approval Service
  approval-service:
    build: ./services/approval-service
    ports:
      - "3001:3001"
    environment:
      - DATABASE_URL=postgresql://postgres:password@postgres:5432/pi_agent_system
      - SLACK_WEBHOOK_URL=${SLACK_WEBHOOK_URL}
      - SENDGRID_API_KEY=${SENDGRID_API_KEY}

  # PostgreSQL
  postgres:
    image: postgres:14-alpine
    ports:
      - "5432:5432"
    environment:
      - POSTGRES_DB=pi_agent_system
      - POSTGRES_USER=postgres
      - POSTGRES_PASSWORD=password
    volumes:
      - postgres-data:/var/lib/postgresql/data

  # Redis
  redis:
    image: redis:7-alpine
    ports:
      - "6379:6379"
    volumes:
      - redis-data:/data

  # Queue Worker (Bull)
  queue-worker:
    build: ./services/queue-worker
    environment:
      - REDIS_URL=redis://redis:6379
      - QUEUE_NAME=ticket-events
    depends_on:
      - redis

volumes:
  postgres-data:
  redis-data:
```

### Kubernetes (Production)

```yaml
# Key components only (simplified)

# Deployment: API Gateway
apiVersion: apps/v1
kind: Deployment
metadata:
  name: api-gateway
spec:
  replicas: 3
  selector:
    matchLabels:
      app: api-gateway
  template:
    metadata:
      labels:
        app: api-gateway
    spec:
      containers:
      - name: api-gateway
        image: pi-agent-system/api-gateway:latest
        ports:
        - containerPort: 3000
        env:
        - name: DATABASE_URL
          valueFrom:
            secretKeyRef:
              name: db-credentials
              key: url
        resources:
          requests:
            memory: "256Mi"
            cpu: "250m"
          limits:
            memory: "512Mi"
            cpu: "500m"

# Service: API Gateway (LoadBalancer)
---
apiVersion: v1
kind: Service
metadata:
  name: api-gateway
spec:
  type: LoadBalancer
  selector:
    app: api-gateway
  ports:
  - port: 80
    targetPort: 3000

# StatefulSet: PostgreSQL (or use managed RDS/CloudSQL)
---
apiVersion: apps/v1
kind: StatefulSet
metadata:
  name: postgres
spec:
  serviceName: postgres
  replicas: 1
  selector:
    matchLabels:
      app: postgres
  template:
    metadata:
      labels:
        app: postgres
    spec:
      containers:
      - name: postgres
        image: postgres:14-alpine
        ports:
        - containerPort: 5432
        env:
        - name: POSTGRES_DB
          value: pi_agent_system
        volumeMounts:
        - name: postgres-storage
          mountPath: /var/lib/postgresql/data
  volumeClaimTemplates:
  - metadata:
      name: postgres-storage
    spec:
      accessModes: ["ReadWriteOnce"]
      resources:
        requests:
          storage: 20Gi
```

---

## Security Considerations

### 1. Webhook Security
- **HMAC Signature Verification**: Validate all incoming webhooks from Flux Lens
- **IP Whitelisting**: Only accept webhooks from known IPs
- **Rate Limiting**: Prevent webhook flooding attacks

### 2. Authentication & Authorization
- **Service-to-Service**: JWT tokens or mTLS
- **Human Approvals**: OAuth 2.0 (SSO) with role-based access control
- **API Keys**: Rotate GitHub tokens, AI API keys regularly

### 3. Workspace Isolation
- **Sandboxing**: Run Pi Agent in Docker containers with limited resources
- **Network Policies**: No internet access from agent containers
- **File System**: Read-only mounted repos, write to isolated workspace
- **User Permissions**: Non-root user in containers

### 4. Data Protection
- **Secrets Management**: Use HashiCorp Vault or AWS Secrets Manager
- **Encryption at Rest**: Encrypt S3 buckets, database backups
- **Encryption in Transit**: TLS 1.3 for all API communications
- **PII Handling**: Anonymize logs, comply with GDPR/SOC2

### 5. Code Review Safety
- **Scope Enforcement**: Pi Agent can only modify files listed in approved SPEC
- **Git Hooks**: Pre-commit hooks to detect secrets, large files
- **Branch Protection**: Require PR reviews before merging to main
- **Audit Logs**: Track all code changes, approvals, and state transitions

### 6. Rate Limiting
- **AI API Calls**: Prevent bill shock (OpenAI, Anthropic)
- **GitHub API**: Respect rate limits (5000 req/hour)
- **Webhook Endpoint**: 100 req/min per IP

---

## Monitoring & Alerts

### Key Metrics

```
# Workflow Metrics
- workflow_created_total (counter)
- workflow_completed_total (counter)
- workflow_failed_total (counter)
- workflow_duration_seconds (histogram)
- workflow_state_duration_seconds{state="PLANNING"} (histogram)

# Approval Metrics
- approval_requested_total{type="SPEC|PR"} (counter)
- approval_response_time_seconds (histogram)
- approval_timeout_total (counter)

# Pi Agent Metrics
- agent_execution_duration_seconds (histogram)
- agent_files_modified_total (counter)
- agent_errors_total (counter)

# QA Metrics
- qa_gate_passed_total{gate="tests|lint|build"} (counter)
- qa_gate_failed_total{gate="tests|lint|build"} (counter)

# System Metrics
- queue_depth (gauge)
- active_workspaces (gauge)
- api_request_duration_seconds (histogram)
```

### Alerts

```yaml
# Critical
- Workflow stuck in state > 2 hours
- Queue depth > 1000
- Database connection pool exhausted
- Multiple workflow failures (> 5 in 10 min)

# Warning
- Approval timeout approaching
- QA gate failure rate > 20%
- Pi Agent execution time > 20 minutes
- Disk usage in workspace > 80%
```

---

## Scalability Considerations

### Horizontal Scaling
- **API Gateway**: Stateless, scale to N replicas
- **Orchestrator**: Use distributed locks (Redis) for task claiming
- **Pi Agent Manager**: Scale workers, each handles 1 workspace at a time
- **Database**: Read replicas for queries, primary for writes

### Performance Optimization
- **Caching**: Cache ticket data, SPEC files in Redis
- **Batch Processing**: Process multiple tickets in parallel (respecting rate limits)
- **Lazy Loading**: Stream large log files instead of loading into memory
- **Connection Pooling**: Reuse database connections

### Cost Optimization
- **AI API Calls**: Cache planning results, reuse SPEC for similar tickets
- **Workspace Cleanup**: Auto-delete workspaces after 7 days
- **Log Retention**: Archive old logs to S3 Glacier
- **Right-sizing**: Use spot instances for non-critical workers

---

## Disaster Recovery

### Backup Strategy
- **Database**: Daily automated backups, 30-day retention
- **SPEC Files**: S3 with versioning enabled
- **Logs**: 90-day retention in Elasticsearch/S3

### Recovery Procedures
1. **Database Failure**: Restore from latest backup, replay queue events
2. **Workflow Stuck**: Manual intervention via admin API to reset state
3. **Queue Failure**: Dead letter queue processing, manual retry
4. **Agent Crash**: Auto-retry with exponential backoff

---

## Development Workflow

### Local Setup
```bash
# Clone repository
git clone https://github.com/your-org/pi-agent-system.git
cd pi-agent-system

# Install dependencies
npm install

# Start infrastructure
docker-compose up -d postgres redis

# Run migrations
npm run db:migrate

# Start services
npm run dev
```

### Testing Strategy
- **Unit Tests**: 80%+ coverage for business logic
- **Integration Tests**: Test service interactions
- **End-to-End Tests**: Simulate full workflow with mock Flux Lens
- **Load Tests**: k6 or Locust for performance testing

---

## Future Enhancements

1. **Multi-Repository Support**: Handle tickets affecting multiple repos
2. **Learning Loop**: Analyze merged PRs to improve SPEC generation
3. **Parallel Execution**: Run independent tasks concurrently
4. **Custom Workflows**: Allow teams to define custom approval chains
5. **Analytics Dashboard**: Insights on agent performance, approval bottlenecks
6. **Self-Healing**: Automatically retry failed workflows with adjusted parameters
7. **Multi-Model Support**: A/B test different AI models for planning

---

## Conclusion

This backend system provides a robust, scalable, and secure foundation for the Pi Agent ticket resolution workflow. The architecture balances automation with human oversight, ensuring high-quality code changes while maintaining velocity.

**Key Strengths**:
✅ Human-in-the-loop at critical decision points  
✅ Scope-bound execution prevents runaway agents  
✅ Queue-based architecture handles burst traffic  
✅ Full auditability and observability  
✅ Modular microservices for independent scaling  

**Next Steps**:
1. Set up development environment
2. Implement core orchestration service
3. Integrate Pi Agent SDK
4. Build approval workflow
5. Connect to Flux Lens and GitHub
6. Deploy to staging and test end-to-end
