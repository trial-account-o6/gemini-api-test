// Data models

class Workflow {
  constructor(ticketData) {
    this.id = require('uuid').v4();
    this.ticketId = ticketData.ticketId;
    this.ticketUrl = ticketData.ticketUrl;
    this.repositoryUrl = ticketData.repositoryUrl;
    this.state = 'PENDING';
    this.createdAt = new Date();
    this.updatedAt = new Date();
    
    // Planning phase
    this.specPath = null;
    this.specContent = null;
    this.specApprovedAt = null;
    this.specApprovedBy = null;
    
    // Execution phase
    this.workspacePath = null;
    this.branchName = null;
    
    // QA phase
    this.qaReportUrl = null;
    this.qaPassed = null;
    
    // PR phase
    this.prUrl = null;
    this.prNumber = null;
    this.prMergedAt = null;
    
    // Metadata
    this.errorMessage = null;
    this.retryCount = 0;
  }

  updateState(newState) {
    this.state = newState;
    this.updatedAt = new Date();
  }

  toJSON() {
    return {
      id: this.id,
      ticketId: this.ticketId,
      state: this.state,
      createdAt: this.createdAt,
      updatedAt: this.updatedAt,
      specPath: this.specPath,
      prUrl: this.prUrl,
      qaReportUrl: this.qaReportUrl
    };
  }
}

class Approval {
  constructor(workflowId, type, assignee) {
    this.id = require('uuid').v4();
    this.workflowId = workflowId;
    this.type = type; // 'SPEC' or 'PR'
    this.assignee = assignee;
    this.status = 'PENDING';
    this.decision = null;
    this.comments = null;
    this.requestedAt = new Date();
    this.decidedAt = null;
  }

  approve(approver, comments = '') {
    this.status = 'APPROVED';
    this.decision = 'APPROVE';
    this.comments = comments;
    this.decidedAt = new Date();
    this.approver = approver;
  }

  reject(approver, comments = '') {
    this.status = 'REJECTED';
    this.decision = 'REJECT';
    this.comments = comments;
    this.decidedAt = new Date();
    this.approver = approver;
  }

  revise(approver, comments = '') {
    this.status = 'REVISION_REQUESTED';
    this.decision = 'REVISE';
    this.comments = comments;
    this.decidedAt = new Date();
    this.approver = approver;
  }
}

class StateTransition {
  constructor(workflowId, fromState, toState, triggeredBy, reason = '') {
    this.id = require('uuid').v4();
    this.workflowId = workflowId;
    this.fromState = fromState;
    this.toState = toState;
    this.triggeredBy = triggeredBy;
    this.reason = reason;
    this.timestamp = new Date();
  }
}

class QAResult {
  constructor(workflowId, gateName, command) {
    this.id = require('uuid').v4();
    this.workflowId = workflowId;
    this.gateName = gateName;
    this.command = command;
    this.passed = null;
    this.output = null;
    this.durationMs = null;
    this.createdAt = new Date();
  }

  setResult(passed, output, durationMs) {
    this.passed = passed;
    this.output = output;
    this.durationMs = durationMs;
  }
}

module.exports = {
  Workflow,
  Approval,
  StateTransition,
  QAResult
};
