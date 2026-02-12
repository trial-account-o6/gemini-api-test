// Workflow state definitions and transitions

const WorkflowStates = {
  PENDING: 'PENDING',
  PLANNING: 'PLANNING',
  AWAITING_SPEC_APPROVAL: 'AWAITING_SPEC_APPROVAL',
  SPEC_APPROVED: 'SPEC_APPROVED',
  SPEC_REJECTED: 'SPEC_REJECTED',
  EXECUTING: 'EXECUTING',
  QA_RUNNING: 'QA_RUNNING',
  QA_FAILED: 'QA_FAILED',
  PR_CREATED: 'PR_CREATED',
  AWAITING_PR_APPROVAL: 'AWAITING_PR_APPROVAL',
  COMPLETED: 'COMPLETED',
  ERROR: 'ERROR'
};

const StateTransitions = {
  [WorkflowStates.PENDING]: {
    allowedTransitions: [WorkflowStates.PLANNING, WorkflowStates.ERROR],
    canTransitionTo(targetState) {
      return this.allowedTransitions.includes(targetState);
    }
  },
  [WorkflowStates.PLANNING]: {
    allowedTransitions: [
      WorkflowStates.AWAITING_SPEC_APPROVAL,
      WorkflowStates.ERROR
    ],
    canTransitionTo(targetState) {
      return this.allowedTransitions.includes(targetState);
    }
  },
  [WorkflowStates.AWAITING_SPEC_APPROVAL]: {
    allowedTransitions: [
      WorkflowStates.SPEC_APPROVED,
      WorkflowStates.SPEC_REJECTED,
      WorkflowStates.PLANNING // For revisions
    ],
    canTransitionTo(targetState) {
      return this.allowedTransitions.includes(targetState);
    }
  },
  [WorkflowStates.SPEC_APPROVED]: {
    allowedTransitions: [WorkflowStates.EXECUTING, WorkflowStates.ERROR],
    canTransitionTo(targetState) {
      return this.allowedTransitions.includes(targetState);
    }
  },
  [WorkflowStates.EXECUTING]: {
    allowedTransitions: [
      WorkflowStates.QA_RUNNING,
      WorkflowStates.ERROR
    ],
    canTransitionTo(targetState) {
      return this.allowedTransitions.includes(targetState);
    }
  },
  [WorkflowStates.QA_RUNNING]: {
    allowedTransitions: [
      WorkflowStates.PR_CREATED,
      WorkflowStates.QA_FAILED,
      WorkflowStates.ERROR
    ],
    canTransitionTo(targetState) {
      return this.allowedTransitions.includes(targetState);
    }
  },
  [WorkflowStates.PR_CREATED]: {
    allowedTransitions: [
      WorkflowStates.AWAITING_PR_APPROVAL,
      WorkflowStates.ERROR
    ],
    canTransitionTo(targetState) {
      return this.allowedTransitions.includes(targetState);
    }
  },
  [WorkflowStates.AWAITING_PR_APPROVAL]: {
    allowedTransitions: [WorkflowStates.COMPLETED, WorkflowStates.ERROR],
    canTransitionTo(targetState) {
      return this.allowedTransitions.includes(targetState);
    }
  }
};

class StateMachine {
  constructor(initialState = WorkflowStates.PENDING) {
    this.currentState = initialState;
    this.history = [{ state: initialState, timestamp: new Date() }];
  }

  transition(targetState, metadata = {}) {
    const currentTransitions = StateTransitions[this.currentState];
    
    if (!currentTransitions) {
      throw new Error(`No transitions defined for state: ${this.currentState}`);
    }

    if (!currentTransitions.canTransitionTo(targetState)) {
      throw new Error(
        `Invalid transition from ${this.currentState} to ${targetState}`
      );
    }

    this.history.push({
      from: this.currentState,
      to: targetState,
      timestamp: new Date(),
      metadata
    });

    this.currentState = targetState;
    return this.currentState;
  }

  getCurrentState() {
    return this.currentState;
  }

  getHistory() {
    return this.history;
  }

  isTerminalState() {
    return [
      WorkflowStates.COMPLETED,
      WorkflowStates.SPEC_REJECTED,
      WorkflowStates.QA_FAILED,
      WorkflowStates.ERROR
    ].includes(this.currentState);
  }
}

module.exports = {
  WorkflowStates,
  StateTransitions,
  StateMachine
};
