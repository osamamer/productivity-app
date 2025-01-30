import React, { useEffect, useState } from 'react';
import { Client } from '@stomp/stompjs';
import SockJS from 'sockjs-client';

const WebSocketTest = () => {
    const [status, setStatus] = useState('Disconnected');
    const [messages, setMessages] = useState<string[]>([]);

    useEffect(() => {
        let client: Client | null = null;

        const connect = () => {
            try {
                const socket = new SockJS('http://localhost:8080/ws');
                console.log('SockJS instance created');

                client = new Client({
                    webSocketFactory: () => socket,
                    debug: (str) => {
                        console.log('STOMP Debug:', str);
                    },
                    reconnectDelay: 5000,
                    heartbeatIncoming: 4000,
                    heartbeatOutgoing: 4000
                });

                client.onConnect = () => {
                    setStatus('Connected');
                    console.log('Connected to WebSocket');

                    // Subscribe to test topic
                    client.subscribe('/topic/test', (message) => {
                        console.log('Received message:', message);
                        setMessages(prev => [...prev, message.body]);
                    });

                    // Send a test message
                    client.publish({
                        destination: '/app/test',
                        body: 'Hello from React!'
                    });
                };

                client.onDisconnect = () => {
                    setStatus('Disconnected');
                    console.log('Disconnected from WebSocket');
                };

                client.onWebSocketError = (error) => {
                    console.error('WebSocket Error:', error);
                    setStatus('Error: ' + error.toString());
                };

                client.onStompError = (frame) => {
                    console.error('STOMP Error:', frame);
                    setStatus('STOMP Error: ' + frame.headers.message);
                };

                console.log('Activating STOMP client...');
                client.activate();
            } catch (error) {
                console.error('Error during connection setup:', error);
                setStatus('Setup Error: ' + error.toString());
            }
        };

        connect();

        return () => {
            if (client && client.active) {
                console.log('Deactivating STOMP client...');
                client.deactivate();
            }
        };
    }, []);

    return (
        <div>
            <h2>WebSocket Test</h2>
            <p>Status: {status}</p>
            <h3>Messages:</h3>
            <ul>
                {messages.map((msg, index) => (
                    <li key={index}>{msg}</li>
                ))}
            </ul>
        </div>
    );
};

export default WebSocketTest;