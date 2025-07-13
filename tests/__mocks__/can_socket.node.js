// Mock implementation of the native can_socket.node module for Jest
module.exports = {
  createSocket: () => 1,
  sendFrame: () => {},
  readFrame: () => ({
    id: 0,
    data: [],
    fd: false,
    remote: false,
    error: false,
  }),
  setFilters: () => {},
  clearFilters: () => {},
  closeSocket: () => {},
};
