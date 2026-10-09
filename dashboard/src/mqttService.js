// mqttService.js (For Web/React UI using WebSockets)
import * as mqttLib from 'mqtt';

// Support both ESM import and browser global fallback
const mqtt = (typeof window !== 'undefined' && window.mqtt) ? window.mqtt : (mqttLib.default || mqttLib);

const BROKER_URL = 'wss://broker.hivemq.com:8084/mqtt'; // Public WebSocket Port
const TOPIC = 'antigravity/sensors/data';

/**
 * Connect to public HiveMQ WebSocket MQTT broker and subscribe to sensor topic.
 * @param {Function} onDataReceived Callback when sensor payload arrives
 * @param {Function} onStatusChange Callback when connection status changes
 * @returns {Object} MQTT Client instance
 */
export const connectMQTT = (onDataReceived, onStatusChange) => {
  if (onStatusChange) onStatusChange('Connecting...');

  const clientId = 'AntiGravity_UI_' + Math.random().toString(16).substring(2, 8);
  console.log(`[MQTT] Initializing client connection (${clientId}) to ${BROKER_URL}...`);

  const client = mqtt.connect(BROKER_URL, {
    clientId: clientId,
    clean: true,
    connectTimeout: 4000,
    reconnectPeriod: 2000,
  });

  client.on('connect', () => {
    console.log('[MQTT] Connected successfully to HiveMQ broker!');
    if (onStatusChange) onStatusChange('Connected');
    client.subscribe(TOPIC, (err) => {
      if (!err) {
        console.log(`[MQTT] Subscribed to topic: ${TOPIC}`);
      } else {
        console.error('[MQTT] Subscription error:', err);
      }
    });
  });

  client.on('message', (topic, message) => {
    try {
      const payload = JSON.parse(message.toString());
      console.log('[MQTT] Received payload on', topic, payload);
      if (onDataReceived) {
        onDataReceived(payload); // Passes real-time payload to UI state
      }
    } catch (err) {
      console.error('[MQTT] Failed to parse JSON message:', err, message.toString());
    }
  });

  client.on('reconnect', () => {
    console.log('[MQTT] Reconnecting to broker...');
    if (onStatusChange) onStatusChange('Reconnecting...');
  });

  client.on('close', () => {
    console.log('[MQTT] Connection closed.');
    if (onStatusChange) onStatusChange('Disconnected');
  });

  client.on('offline', () => {
    console.log('[MQTT] Client is offline.');
    if (onStatusChange) onStatusChange('Offline');
  });

  client.on('error', (err) => {
    console.error('[MQTT] Connection error:', err);
    if (onStatusChange) onStatusChange('Error');
  });

  return client;
};

export default connectMQTT;
