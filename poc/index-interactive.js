// Interactive POC - Manual approval simulation

const readline = require('readline');
const Orchestrator = require('./services/orchestrator');
const config = require('./config/config');
const { WorkflowStates } = require('./shared/state-machine');

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

function question(prompt) {
  return new Promise(resolve => {
    rl.question(prompt, resolve);
  });
}

async function runInteractivePOC() {
  console.log(`
╔═══════════════════════════════════════════════════════════════╗
║                                                               ║
║      Pi Agent System - Interactive POC                        ║
║                                                               ║
║  You'll be prompted to approve each step manually             ║
║                                                               ║
╚═══════════════════════════════════════════════════════════════╝
  `);

  const orchestrator = new Orchestrator(config);

  // Mock ticket
  const mockTicket = {
    ticketId: '5678',
    ticketUrl: 'https://fluxlens.example.com/tickets/5678',
    title: 'Fix authentication bug',
    description: 'Users are unable to login with valid credentials',
    repositoryUrl: 'https://github.com/example/auth-service.git'
  };

  try {
    console.log(`\n🎫 Ticket #${mockTicket.ticketId}: ${mockTicket.title}\n`);
    
    // Create workflow
    const workflow = await orchestrator.workflows.set(
      'interactive-test',
      new (require('./shared/models').Workflow)(mockTicket)
    );
    
    // Manual workflow steps
    console.log('📋 Step 1: Planning Phase');
    console.log('Generating SPEC.md...\n');
    
    const specResult = await orchestrator.planningAI.generateSpec(
      mockTicket,
      'interactive-test'
    );
    
    console.log('\n📄 SPEC.md generated. Preview:');
    console.log('─'.repeat(60));
    console.log(specResult.specContent.substring(0, 500) + '...\n');
    console.log('─'.repeat(60));
    
    const specDecision = await question(
      '\n❓ Approve SPEC? (approve/reject/revise): '
    );
    
    if (specDecision.toLowerCase() !== 'approve') {
      console.log('\n❌ SPEC not approved. Workflow stopped.');
      rl.close();
      return;
    }
    
    console.log('\n✅ SPEC approved!\n');
    
    console.log('🤖 Step 2: Pi Agent Execution');
    console.log('Running Pi Agent...\n');
    
    await new Promise(resolve => setTimeout(resolve, 2000));
    console.log('✅ Code changes implemented\n');
    
    console.log('🧪 Step 3: QA Checks');
    console.log('Running automated tests...\n');
    
    await new Promise(resolve => setTimeout(resolve, 1500));
    console.log('✅ All tests passed\n');
    
    console.log('📦 Step 4: Pull Request');
    const prUrl = 'https://github.com/example/repo/pull/123';
    console.log(`PR created: ${prUrl}\n`);
    
    const prDecision = await question(
      '❓ Merge PR? (yes/no): '
    );
    
    if (prDecision.toLowerCase() === 'yes') {
      console.log('\n✅ PR merged!');
      console.log('🎉 Workflow completed successfully!\n');
    } else {
      console.log('\n❌ PR not merged. Workflow stopped.\n');
    }
    
    rl.close();
    
  } catch (error) {
    console.error('\n❌ Error:', error.message);
    rl.close();
  }
}

if (require.main === module) {
  runInteractivePOC().catch(console.error);
}

module.exports = { runInteractivePOC };
