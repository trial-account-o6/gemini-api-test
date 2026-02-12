// Orchestrator - Main workflow engine

const { Workflow, StateTransition } = require('../shared/models');
const { StateMachine, WorkflowStates } = require('../shared/state-machine');
const PlanningAIService = require('./planning-ai');
const ApprovalService = require('./approval-service');
const PiAgentManager = require('./pi-agent-manager');
const QAService = require('./qa-service');

class Orchestrator {
  constructor(config) {
    this.config = config;
    this.workflows = new Map(); // In-memory storage for POC
    this.stateMachines = new Map();
    
    // Initialize services
    this.planningAI = new PlanningAIService(config);
    this.approvalService = new ApprovalService(config);
    this.piAgentManager = new PiAgentManager(config);
    this.qaService = new QAService(config);
  }

  /**
   * Start a new workflow from a ticket
   */
  async startWorkflow(ticketData) {
    console.log(`\n${'='.repeat(60)}`);
    console.log(`🎫 New Ticket Received: #${ticketData.ticketId}`);
    console.log(`${'='.repeat(60)}\n`);

    // Create workflow
    const workflow = new Workflow(ticketData);
    this.workflows.set(workflow.id, workflow);
    
    // Create state machine
    const stateMachine = new StateMachine(WorkflowStates.PENDING);
    this.stateMachines.set(workflow.id, stateMachine);
    
    console.log(`✅ Workflow created: ${workflow.id}`);
    
    // Start processing
    await this.processWorkflow(workflow.id);
    
    return workflow;
  }

  /**
   * Main workflow processing loop
   */
  async processWorkflow(workflowId) {
    const workflow = this.workflows.get(workflowId);
    const stateMachine = this.stateMachines.get(workflowId);
    
    if (!workflow || !stateMachine) {
      throw new Error(`Workflow ${workflowId} not found`);
    }

    try {
      // Transition to PLANNING
      await this.transitionState(workflowId, WorkflowStates.PLANNING, 'system');
      
      // Generate SPEC
      const specResult = await this.planningAI.generateSpec(
        workflow,
        workflowId
      );
      workflow.specPath = specResult.specPath;
      workflow.specContent = specResult.specContent;
      
      // Transition to AWAITING_SPEC_APPROVAL
      await this.transitionState(
        workflowId,
        WorkflowStates.AWAITING_SPEC_APPROVAL,
        'planning-ai'
      );
      
      // Request human approval
      const specApproval = await this.approvalService.requestApproval(
        workflowId,
        'SPEC',
        specResult.specPath
      );
      
      // Auto-approve for POC (in production, wait for human decision)
      await this.approvalService.autoApprove(specApproval.id);
      
      // Transition to SPEC_APPROVED
      await this.transitionState(
        workflowId,
        WorkflowStates.SPEC_APPROVED,
        specApproval.approver
      );
      workflow.specApprovedAt = new Date();
      workflow.specApprovedBy = specApproval.approver;
      
      // Transition to EXECUTING
      await this.transitionState(workflowId, WorkflowStates.EXECUTING, 'system');
      
      // Execute with Pi Agent
      const executionResult = await this.piAgentManager.execute(
        workflowId,
        workflow.specPath,
        workflow.repositoryUrl
      );
      workflow.workspacePath = executionResult.workspacePath;
      workflow.branchName = executionResult.branchName;
      
      // Transition to QA_RUNNING
      await this.transitionState(workflowId, WorkflowStates.QA_RUNNING, 'pi-agent');
      
      // Run QA checks
      const qaResult = await this.qaService.runQualityGates(
        workflowId,
        executionResult.workspacePath
      );
      workflow.qaReportUrl = qaResult.reportUrl;
      workflow.qaPassed = qaResult.passed;
      
      if (!qaResult.passed) {
        await this.transitionState(workflowId, WorkflowStates.QA_FAILED, 'qa-service');
        console.log(`\n❌ Workflow failed at QA stage`);
        return workflow;
      }
      
      // Transition to PR_CREATED
      await this.transitionState(workflowId, WorkflowStates.PR_CREATED, 'qa-service');
      
      // Create PR (mocked)
      const pr = await this.createPullRequest(workflow);
      workflow.prUrl = pr.url;
      workflow.prNumber = pr.number;
      
      // Transition to AWAITING_PR_APPROVAL
      await this.transitionState(
        workflowId,
        WorkflowStates.AWAITING_PR_APPROVAL,
        'github-service'
      );
      
      // Request PR approval
      const prApproval = await this.approvalService.requestApproval(
        workflowId,
        'PR',
        pr.url
      );
      
      // Auto-approve for POC
      await this.approvalService.autoApprove(prApproval.id, 3000);
      
      // Simulate PR merge
      workflow.prMergedAt = new Date();
      
      // Transition to COMPLETED
      await this.transitionState(
        workflowId,
        WorkflowStates.COMPLETED,
        prApproval.approver
      );
      
      console.log(`\n${'='.repeat(60)}`);
      console.log(`🎉 Workflow Completed Successfully!`);
      console.log(`${'='.repeat(60)}\n`);
      console.log(`Ticket: #${workflow.ticketId}`);
      console.log(`PR: ${workflow.prUrl}`);
      console.log(`Duration: ${Math.round((new Date() - workflow.createdAt) / 1000)}s`);
      console.log();
      
      return workflow;
      
    } catch (error) {
      console.error(`\n❌ Workflow error:`, error.message);
      await this.transitionState(workflowId, WorkflowStates.ERROR, 'system');
      workflow.errorMessage = error.message;
      throw error;
    }
  }

  /**
   * Transition workflow state
   */
  async transitionState(workflowId, targetState, triggeredBy) {
    const workflow = this.workflows.get(workflowId);
    const stateMachine = this.stateMachines.get(workflowId);
    
    const fromState = stateMachine.getCurrentState();
    
    try {
      stateMachine.transition(targetState);
      workflow.updateState(targetState);
      
      const transition = new StateTransition(
        workflowId,
        fromState,
        targetState,
        triggeredBy
      );
      
      console.log(`\n🔄 State transition: ${fromState} → ${targetState}`);
      
    } catch (error) {
      console.error(`Failed to transition: ${error.message}`);
      throw error;
    }
  }

  /**
   * Create Pull Request (mocked)
   */
  async createPullRequest(workflow) {
    console.log(`\n📦 Creating Pull Request...`);
    
    await new Promise(resolve => setTimeout(resolve, 1000));
    
    const prNumber = Math.floor(Math.random() * 1000) + 1;
    const prUrl = `https://github.com/example/repo/pull/${prNumber}`;
    
    console.log(`✅ PR created: ${prUrl}`);
    
    return {
      number: prNumber,
      url: prUrl,
      title: `Fix: Ticket #${workflow.ticketId}`,
      body: this.generatePRDescription(workflow)
    };
  }

  /**
   * Generate PR description
   */
  generatePRDescription(workflow) {
    return this.config.github.prTemplate
      .replace('{{ticketId}}', workflow.ticketId)
      .replace('{{ticketUrl}}', workflow.ticketUrl)
      .replace('{{specUrl}}', workflow.specPath)
      .replace('{{qaReportUrl}}', workflow.qaReportUrl)
      .replace('{{summary}}', 'Automated fix generated by Pi Agent');
  }

  /**
   * Get workflow status
   */
  getWorkflow(workflowId) {
    return this.workflows.get(workflowId);
  }

  /**
   * List all workflows
   */
  listWorkflows() {
    return Array.from(this.workflows.values());
  }

  /**
   * Get workflow history
   */
  getWorkflowHistory(workflowId) {
    const stateMachine = this.stateMachines.get(workflowId);
    return stateMachine ? stateMachine.getHistory() : [];
  }
}

module.exports = Orchestrator;
