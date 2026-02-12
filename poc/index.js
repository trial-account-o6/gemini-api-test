// Main POC Entry Point

const Orchestrator = require('./services/orchestrator');
const config = require('./config/config');

async function runPOC() {
  console.log(`
╔═══════════════════════════════════════════════════════════════╗
║                                                               ║
║         Pi Agent Ticket Resolution System - POC               ║
║                                                               ║
║  Demonstrating automated workflow with human approval gates   ║
║                                                               ║
╚═══════════════════════════════════════════════════════════════╝
  `);

  // Create orchestrator
  const orchestrator = new Orchestrator(config);

  // Mock ticket from Flux Lens
  const mockTicket = {
    ticketId: '1234',
    ticketUrl: 'https://fluxlens.example.com/tickets/1234',
    title: 'Add status endpoint to API',
    description: `
We need a new GET endpoint at /api/status that returns the current 
status of the service. This will be used by our monitoring systems 
to check if the API is healthy.

Expected response:
{
  "status": "active",
  "timestamp": "2024-02-12T18:00:00Z"
}
    `.trim(),
    repositoryUrl: 'https://github.com/example/api-service.git',
    feature: 'status endpoint'
  };

  try {
    // Start the workflow
    const workflow = await orchestrator.startWorkflow(mockTicket);
    
    // Display final summary
    displaySummary(workflow, orchestrator);
    
  } catch (error) {
    console.error('\n❌ POC failed:', error);
    process.exit(1);
  }
}

function displaySummary(workflow, orchestrator) {
  const history = orchestrator.getWorkflowHistory(workflow.id);
  
  console.log(`
╔═══════════════════════════════════════════════════════════════╗
║                      WORKFLOW SUMMARY                         ║
╚═══════════════════════════════════════════════════════════════╝

📋 Workflow Details:
   ID: ${workflow.id}
   Ticket: #${workflow.ticketId}
   Status: ${workflow.state}
   Created: ${workflow.createdAt.toISOString()}
   Completed: ${workflow.updatedAt.toISOString()}
   Duration: ${Math.round((workflow.updatedAt - workflow.createdAt) / 1000)}s

📄 Artifacts:
   SPEC: ${workflow.specPath || 'N/A'}
   Branch: ${workflow.branchName || 'N/A'}
   PR: ${workflow.prUrl || 'N/A'}
   QA Report: ${workflow.qaReportUrl || 'N/A'}

📊 State Transitions (${history.length}):
${history.map((h, i) => `   ${i + 1}. ${h.from ? h.from + ' → ' : ''}${h.to || h.state}`).join('\n')}

✅ POC completed successfully!
  `);
}

// Run the POC
if (require.main === module) {
  runPOC().catch(console.error);
}

module.exports = { runPOC };
