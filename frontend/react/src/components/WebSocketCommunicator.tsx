// WebSocketComponent.tsx
import React, { useEffect, useState } from 'react';
import SockJS from 'sockjs-client';
import Stomp from 'stompjs';

function WebSocketComponent() {
    const [messages, setMessages] = useState<string[]>([]);
    const [connected, setConnected] = useState(false);
    const [stompClient, setStompClient] = useState<Stomp.Client | null>(null);
    const socketUrl = 'http://localhost:8080/ws'; // Update this with your backend URL

    useEffect(() => {
        const socket = new SockJS(socketUrl);
        const client = Stomp.over(socket);

        client.connect({}, (frame) => {
            console.log('Connected: ' + frame);
            setConnected(true);
            setStompClient(client);

            client.subscribe('/topic/event', (message) => {
                if (message.body) {
                    setMessages((prevMessages) => [...prevMessages, message.body]);
                }
            });


        }, (error) => {
            console.error('Error: ' + error);
            setConnected(false);
        });

        return () => {
            if (client) {
                client.disconnect(() => {
                    console.log('Disconnected');
                    setConnected(false);
                });
            }
        };
    }, [socketUrl]);

    return (
        <div>
            <h2>WebSocket Messages</h2>
            <p>Status: {connected ? 'Connected' : 'Disconnected'}</p>
            <ul>
                {messages.map((message, index) => (
                    <li key={index}>{message}</li>
                ))}
            </ul>
        </div>
    );
}

export default WebSocketComponent;
