const WebSocket = require('ws');

const wss = new WebSocket.Server({ 
    port: 8080,
    clientTracking: true
});

// Store connected clients with their meeting IDs
const clients = new Map();

// Log when server starts
console.log('\x1b[32m%s\x1b[0m', 'WebSocket server starting on port 8080...');

wss.on('listening', () => {
    console.log('\x1b[32m%s\x1b[0m', '✓ WebSocket server is ready and listening on port 8080');
});

wss.on('connection', (ws, req) => {
    const clientId = Math.random().toString(36).substring(7);
    console.log('\x1b[36m%s\x1b[0m', `[${clientId}] New connection established`);

    // Send welcome message
    ws.send(JSON.stringify({
        type: 'welcome',
        message: 'Connected to video call server'
    }));

    ws.on('message', (message) => {
        const data = JSON.parse(message);
        console.log('Received message:', data);

        if (data.type === 'join') {
            const { meeting_id, role } = data;
            console.log(`Client joining meeting ${meeting_id} as ${role}`);

            // Store the client information
            clients.set(ws, { meeting_id, role });

            // Notify other clients in the same meeting
            clients.forEach((client, clientWs) => {
                if (client.meeting_id === meeting_id && clientWs !== ws) {
                    clientWs.send(JSON.stringify({ type: 'peer_joined', peerRole: role }));
                }
            });
        } else if (data.type === 'video') {
            // Relay video stream data to the other participant
            const { meeting_id } = data;
            clients.forEach((client, clientWs) => {
                if (client.meeting_id === meeting_id && clientWs !== ws) {
                    clientWs.send(JSON.stringify(data));
                }
            });
        }
    });

    ws.on('close', () => {
        const clientInfo = clients.get(ws);
        if (clientInfo) {
            console.log('\x1b[35m%s\x1b[0m', `[${clientId}] Client disconnected from meeting ${clientInfo.meeting_id}`);
            
            // Notify peers about disconnection
            for (const [client, info] of clients) {
                if (client !== ws && info.meeting_id === clientInfo.meeting_id) {
                    client.send(JSON.stringify({
                        type: 'peer_left',
                        role: clientInfo.role
                    }));
                }
            }
            
            clients.delete(ws);
        }
    });

    ws.on('error', (error) => {
        console.error('\x1b[31m%s\x1b[0m', `[${clientId}] WebSocket error:`, error);
    });
});

// Print active connections every 5 seconds
setInterval(() => {
    const activeConnections = Array.from(clients.values());
    console.log('\x1b[36m%s\x1b[0m', '\nActive connections:', activeConnections.length);
    if (activeConnections.length > 0) {
        console.log('Meeting participants:');
        const meetings = {};
        activeConnections.forEach(({ meeting_id, role, clientId }) => {
            if (!meetings[meeting_id]) meetings[meeting_id] = [];
            meetings[meeting_id].push({ role, clientId });
        });
        console.log(meetings);
    }
}, 5000);

// Handle server errors
wss.on('error', (error) => {
    console.error('\x1b[31m%s\x1b[0m', 'WebSocket server error:', error);
});

// Graceful shutdown
process.on('SIGINT', () => {
    console.log('\n\x1b[33m%s\x1b[0m', 'Shutting down WebSocket server...');
    wss.close(() => {
        console.log('\x1b[32m%s\x1b[0m', 'WebSocket server closed successfully');
        process.exit(0);
    });
});