# Pi Agent System - Proof of Concept

A simplified proof of concept demonstrating the core workflow of the Pi Agent ticket resolution system.

## POC Scope

This POC implements:
- ✅ Workflow state machine (simplified)
- ✅ Mock ticket ingestion
- ✅ Planning AI service (mock SPEC generation)
- ✅ Human approval simulation
- ✅ Pi Agent execution (simulated)
- ✅ State persistence (in-memory)
- ✅ End-to-end workflow demonstration

## Structure

```
poc/
├── services/
│   ├── orchestrator.js      # Main workflow engine
│   ├── planning-ai.js       # SPEC.md generation (mocked)
│   ├── approval-service.js  # Approval handling
│   ├── pi-agent-manager.js  # Agent execution (simulated)
│   └── qa-service.js        # Quality checks (mocked)
├── shared/
│   ├── state-machine.js     # Workflow state definitions
│   └── models.js            # Data models
├── config/
│   └── config.js            # Configuration
└── workspaces/              # Isolated agent workspaces
```

## Quick Start

```bash
# Install dependencies
npm install

# Run the POC
npm run poc

# Run with approval interface
npm run poc:interactive
```

## Workflow States

```
PENDING → PLANNING → AWAITING_SPEC_APPROVAL → SPEC_APPROVED
       → EXECUTING → QA_RUNNING → PR_CREATED
       → AWAITING_PR_APPROVAL → COMPLETED
```

## Example Output

```
🎫 Ticket #1234 received
📋 Generating SPEC.md...
✅ SPEC.md generated
⏳ Waiting for approval...
✓ SPEC approved by developer@example.com
🤖 Starting Pi Agent execution...
✅ Changes implemented
🧪 Running QA checks...
✅ All tests passed
📦 Creating Pull Request...
✅ PR #42 created
⏳ Waiting for PR approval...
✓ PR merged
🎉 Workflow completed!
```

## API Endpoints (if running HTTP server)

```
POST /webhook/ticket       # Receive ticket
POST /approval/:id/decide  # Approve/Reject
GET /workflow/:id          # Get workflow status
GET /workflows             # List all workflows
```
