import { io } from "socket.io-client";

// In a real app, this might come from an environment variable
const SOCKET_URL = "http://localhost:5000";

export const socket = io(SOCKET_URL, {
    autoConnect: true,
});

/**
 * Join a job room to listen for updates
 * @param {string} jobId 
 */
export function joinJob(jobId) {
    socket.emit('join-job', jobId);
}

/**
 * Leave a job room
 * @param {string} jobId 
 */
export function leaveJob(jobId) {
    socket.emit('leave', jobId);
}
