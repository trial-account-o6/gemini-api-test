// Approval Service - Handles human approvals

const { Approval } = require('../shared/models');

class ApprovalService {
  constructor(config) {
    this.config = config;
    this.approvals = new Map(); // In-memory storage for POC
  }

  /**
   * Request approval from a human
   */
  async requestApproval(workflowId, type, contentUrl, assignee = null) {
    const approvalAssignee = assignee || this.config.approval.defaultAssignee;
    
    const approval = new Approval(workflowId, type, approvalAssignee);
    this.approvals.set(approval.id, approval);
    
    console.log(`\n⏳ Approval requested:`);
    console.log(`   Type: ${type}`);
    console.log(`   Assignee: ${approvalAssignee}`);
    console.log(`   Content: ${contentUrl}`);
    console.log(`   Approval ID: ${approval.id}`);
    
    // In production, send notifications via Slack/Email
    await this.sendNotification(approval, contentUrl);
    
    return approval;
  }

  /**
   * Submit approval decision
   */
  async submitDecision(approvalId, decision, approver, comments = '') {
    const approval = this.approvals.get(approvalId);
    
    if (!approval) {
      throw new Error(`Approval ${approvalId} not found`);
    }

    if (approval.status !== 'PENDING') {
      throw new Error(`Approval ${approvalId} already decided: ${approval.status}`);
    }

    switch (decision) {
      case 'APPROVE':
        approval.approve(approver, comments);
        console.log(`✅ ${approval.type} approved by ${approver}`);
        break;
      case 'REJECT':
        approval.reject(approver, comments);
        console.log(`❌ ${approval.type} rejected by ${approver}`);
        break;
      case 'REVISE':
        approval.revise(approver, comments);
        console.log(`🔄 ${approval.type} revision requested by ${approver}`);
        break;
      default:
        throw new Error(`Invalid decision: ${decision}`);
    }

    return approval;
  }

  /**
   * Get approval status
   */
  getApproval(approvalId) {
    return this.approvals.get(approvalId);
  }

  /**
   * Get pending approvals for an assignee
   */
  getPendingApprovals(assignee) {
    return Array.from(this.approvals.values()).filter(
      approval => approval.assignee === assignee && approval.status === 'PENDING'
    );
  }

  /**
   * Send notification (mocked for POC)
   */
  async sendNotification(approval, contentUrl) {
    // In production: Send Slack message, email, etc.
    console.log(`   📧 Notification sent to ${approval.assignee}`);
  }

  /**
   * Auto-approve for POC demonstration
   */
  async autoApprove(approvalId, delayMs = 2000) {
    await new Promise(resolve => setTimeout(resolve, delayMs));
    return this.submitDecision(
      approvalId,
      'APPROVE',
      'auto-approver@poc.com',
      'Auto-approved for POC demonstration'
    );
  }
}

module.exports = ApprovalService;
