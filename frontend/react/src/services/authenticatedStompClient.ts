import { Client } from '@stomp/stompjs';
import keycloak from './keycloak';

export function createAuthenticatedStompClient(brokerURL: string): Client {
    const client = new Client({
        brokerURL,
        reconnectDelay: 5000,
        heartbeatIncoming: 10000,
        heartbeatOutgoing: 10000,
    });

    client.beforeConnect = async () => {
        await keycloak.updateToken(30);
        if (!keycloak.token) {
            throw new Error('Cannot connect notification WebSocket without an access token');
        }
        client.connectHeaders = { Authorization: `Bearer ${keycloak.token}` };
    };

    return client;
}
