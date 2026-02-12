# Pi Agent Ticket Resolution System

An autonomous AI-powered system that automatically resolves tickets using Pi Agent with human-in-the-loop approval gates.

## 📚 Documentation

- **[System Design](./SYSTEM_DESIGN.md)** - Comprehensive backend architecture and component specifications
- **[POC Documentation](./poc/README.md)** - Proof of concept implementation details

## 🏗️ Architecture Overview

```
Ticket Creation (Flux Lens)
         ↓
    Webhook → Queue
         ↓
   Orchestration Service
         ↓
  ┌──────┴──────┐
  ↓             ↓
Planning AI   Approval Gate #1 (SPEC Review)
  ↓             ↓
SPEC.md    [APPROVE/REJECT/REVISE]
  ↓
Pi Agent Execution (Scope-bound)
  ↓
QA Service (Automated Tests)
  ↓
GitHub PR Creation
  ↓
Approval Gate #2 (Code Review)
  ↓
PR Merge → Ticket Closure
```

## 🎯 Key Features

### 1. **Two-Stage Human Approval**
- **SPEC Approval**: Review the implementation plan before any code is written
- **PR Approval**: Final code review before merging

### 2. **Scope-Bound Execution**
- Pi Agent can only modify files explicitly listed in the approved SPEC.md
- Prevents runaway changes and hallucinations
- Full audit trail of all modifications

### 3. **Automated Quality Gates**
- Unit tests
- Linting
- Build verification
- Integration tests
- Customizable QA pipeline

### 4. **Scalable Architecture**
- Queue-based design handles burst traffic
- Isolated workspaces for parallel execution
- Microservices architecture for independent scaling

## 🚀 Quick Start with POC

```bash
# Clone the repository
git clone https://github.com/trial-account-o6/gemini-api-test.git
cd gemini-api-test/poc

# Install dependencies
npm install

# Run the automated POC
npm run poc

# Or run the interactive version
npm run poc:interactive
```

### POC Output Example

```
🎫 Ticket #1234 received
📋 Generating SPEC.md...
✅ SPEC.md generated
⏳ Waiting for SPEC approval...
✓ SPEC approved by developer@example.com
🤖 Starting Pi Agent execution...
✅ Changes implemented (3 files modified)
🧪 Running QA checks...
✅ All tests passed
📦 Creating Pull Request #42...
⏳ Waiting for PR approval...
✓ PR merged
🎉 Workflow completed! (Duration: 14s)
```

## 📋 Workflow States

The system uses a state machine to track workflow progress:

1. **PENDING** - Ticket received, queued for processing
2. **PLANNING** - AI analyzing ticket and generating SPEC.md
3. **AWAITING_SPEC_APPROVAL** - Human reviewing implementation plan
4. **SPEC_APPROVED** - Plan approved, ready for execution
5. **EXECUTING** - Pi Agent implementing changes
6. **QA_RUNNING** - Running automated quality checks
7. **PR_CREATED** - Pull request opened on GitHub
8. **AWAITING_PR_APPROVAL** - Human reviewing code changes
9. **COMPLETED** - PR merged, ticket resolved

Error states: `SPEC_REJECTED`, `QA_FAILED`, `ERROR`

## 🛠️ Technology Stack

### Backend Services
- **Node.js** - Orchestration, approvals, GitHub integration
- **Python** - Planning AI, Pi Agent execution
- **PostgreSQL** - Workflow state and audit logs
- **Redis** - Task queue and caching
- **Docker** - Workspace isolation

### External Integrations
- **Pi Agent SDK** - Code generation and modification
- **OpenAI/Anthropic API** - SPEC.md generation
- **GitHub API** - PR creation and management
- **Flux Lens API** - Ticket management
- **Slack/Email** - Approval notifications

## 📊 System Components

### 1. API Gateway
Receives webhooks from Flux Lens and enqueues tickets for processing.

### 2. Orchestration Service
Core workflow engine that coordinates all services and manages state transitions.

### 3. Planning AI Service
Analyzes tickets and generates detailed SPEC.md documents with:
- Problem statement
- Files to modify
- Implementation plan
- Testing strategy
- Verification checklist

### 4. Approval Service
Manages human approval requests with:
- Multi-channel notifications (Slack, Email, Dashboard)
- Timeout policies
- Decision tracking

### 5. Pi Agent Manager
Creates isolated workspaces and executes Pi Agent with:
- Scope enforcement (only approved files)
- Resource limits
- Real-time progress monitoring

### 6. QA Service
Runs automated quality gates:
- Unit tests
- Integration tests
- Linting
- Build verification
- SPEC checklist validation

### 7. GitHub Integration
- Creates feature branches
- Pushes code changes
- Opens pull requests with detailed descriptions
- Monitors PR status

## 🔒 Security Features

- **Webhook Signature Verification** - HMAC validation
- **Workspace Isolation** - Sandboxed execution environments
- **Scope Enforcement** - File-level access control
- **Audit Logging** - Complete activity trail
- **Secrets Management** - Vault integration
- **Network Isolation** - No external access from agents

## 📈 Monitoring & Observability

### Key Metrics
- Workflow completion rate
- Average resolution time
- Approval response time
- QA pass/fail rates
- System resource utilization

### Alerting
- Workflow failures
- Approval timeouts
- Queue depth warnings
- Resource exhaustion

## 🎓 Example Use Cases

### 1. Bug Fixes
```
Ticket: "Fix login timeout issue"
→ SPEC: Update session expiry configuration
→ Execution: Modify config file, add tests
→ QA: All tests pass
→ Result: PR merged in 15 minutes
```

### 2. Feature Additions
```
Ticket: "Add status endpoint"
→ SPEC: New GET /api/status endpoint
→ Execution: Add route, handler, tests
→ QA: Integration tests pass
→ Result: Feature deployed
```

### 3. Refactoring
```
Ticket: "Extract common utility functions"
→ SPEC: Create utils module, update imports
→ Execution: Refactor 5 files
→ QA: No breaking changes
→ Result: Code quality improved
```

## 🔄 Deployment

### Local Development
```bash
docker-compose up -d
npm run migrate
npm run dev
```

### Production (Kubernetes)
```bash
kubectl apply -f k8s/
helm install pi-agent-system ./helm-chart
```

## 📝 Configuration

Key configuration options:

```javascript
{
  approval: {
    specTimeout: '24h',     // Auto-reject after 24h
    prTimeout: '48h'        // Auto-close PR after 48h
  },
  piAgent: {
    maxExecutionTime: '30m',
    workspaceCleanup: '7d'
  },
  qa: {
    requiredGates: ['tests', 'lint', 'build'],
    optionalGates: ['integration', 'e2e']
  }
}
```

## 🤝 Contributing

This is a proof of concept demonstrating the architecture. For production deployment:

1. Implement actual AI integration (replace mocks)
2. Set up real database and queue infrastructure
3. Configure GitHub OAuth and webhooks
4. Integrate with your ticket system
5. Add comprehensive error handling
6. Set up monitoring and alerting

## 📄 License

MIT

## 🔗 Links

- **Repository**: https://github.com/trial-account-o6/gemini-api-test
- **System Design**: [SYSTEM_DESIGN.md](./SYSTEM_DESIGN.md)
- **POC**: [poc/README.md](./poc/README.md)

---

**Note**: This is a demonstration project showcasing an AI-powered ticket resolution workflow built around Pi Agent. The POC uses mocked services to illustrate the core concepts without requiring external API keys or infrastructure.
