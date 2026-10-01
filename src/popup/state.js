export const state = {
  cycleOffset: 0,
  calOffset: 0,
  dayList: {},
  requests: [],
  leaveRequests: [],
  leaveTypes: [],
  requestUsed: 0,
  lastSyncFailed: false,
  view: "overview",
  approvals: {
    status: "idle",
    items: [],
    error: "",
    selected: new Set(),
    busy: new Set(),
    errors: {},
  },
};
