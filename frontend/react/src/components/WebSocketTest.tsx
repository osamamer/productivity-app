import React, { useState, useRef } from 'react';
import * as StompJs from '@stomp/stompjs';

const WebSocketTest: React.FC = () => {
    // State to track connection and received greetings
    const [connected, setConnected] = useState<boolean>(false);
    const [greetings, setGreetings] = useState<string[]>([]);
    const nameInputRef = useRef<HTMLInputElement>(null);

    // Ref for the STOMP client (persisting across renders)
    const stompClientRef = useRef<StompJs.Client | null>(null);

    // Add a greeting to the state
    const showGreeting = (message: string) => {
        setGreetings((prev) => [...prev, message]);
    };

    // Connect the STOMP client
    const connect = () => {
        console.log('Connect button clicked');
        if (!stompClientRef.current) {
            stompClientRef.current = new StompJs.Client({
                brokerURL: 'ws://localhost:8080/gs-guide-websocket',
                reconnectDelay: 5000,
                debug: (msg) => console.log(new Date().toISOString(), msg),
                onConnect: (frame) => {
                    console.log('Connected:', frame);
                    setConnected(true);
                    stompClientRef.current?.subscribe('/topic/greetings', (message) => {
                        console.log('Received message:', message.body);
                        const body = JSON.parse(message.body);
                        showGreeting(body.content);
                    });
                },
                onWebSocketError: (error) => {
                    console.error('WebSocket error:', error);
                },
                onStompError: (frame) => {
                    console.error('Broker reported error:', frame.headers['message']);
                    console.error('Additional details:', frame.body);
                },
            });
        }
        stompClientRef.current.activate();
    };

    // Disconnect the STOMP client
    const disconnect = () => {
        stompClientRef.current?.deactivate();
        setConnected(false);
        console.log('Disconnected');
    };

    // Publish a message to the backend
    const sendName = () => {
        if (stompClientRef.current && nameInputRef.current && nameInputRef.current.value) {
            stompClientRef.current.publish({
                destination: '/app/hello',
                body: JSON.stringify({ name: nameInputRef.current.value }),
            });
        }
    };

    // Prevent form submission from reloading the page
    const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
        e.preventDefault();
    };

    return (
        <div>
            <form onSubmit={handleSubmit}>
                <div>
                    <label>WebSocket connection:</label>
                    <button type="button" id="connect" onClick={connect} disabled={connected}>
                        Connect
                    </button>
                    <button type="button" id="disconnect" onClick={disconnect} disabled={!connected}>
                        Disconnect
                    </button>
                </div>
                {connected && (
                    <div>
                        <label>What is your name?</label>
                        <input type="text" ref={nameInputRef} />
                        <button type="button" id="send" onClick={sendName}>
                            Send
                        </button>
                        <table>
                            <thead>
                            <tr>
                                <th>Greetings</th>
                            </tr>
                            </thead>
                            <tbody>
                            {greetings.map((g, index) => (
                                <tr key={index}>
                                    <td>{g}</td>
                                </tr>
                            ))}
                            </tbody>
                        </table>
                    </div>
                )}
            </form>
        </div>
    );
};

export default WebSocketTest;
