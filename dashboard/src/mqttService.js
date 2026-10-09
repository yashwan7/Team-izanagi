// mqttService.js (For Web/React UI using WebSockets)
import mqtt from 'mqtt';

// Support both ESM import and browser global fallback
const getMqttClient = () => {
  if (typeof window !== 'undefined' && window.mqtt) {
    return window.mqtt;
  }
  if (mqtt && typeof mqtt.connect === 'function') {
    return mqtt;
  }
  if (mqtt && mqtt.default && typeof mqtt.default.connect === 'function') {
    return mqtt.default;
  }
  return mqtt;
};

export const BROKER_URL = 'wss://broker.hivemq.com:8084/mqtt'; // Public HiveMQ WebSocket URL
export const TOPIC = 'izanagi/sensors/data'; // Izanagi telemetry topic

/**
 * Connect to HiveMQ WebSocket MQTT broker and subscribe to izanagi/sensors/data.
 * Implements auto-reconnection and zero UI freeze through RAF-batched message dispatch.
 * 
 * @param {Function} onDataReceived Callback when parsed sensor payload arrives
 * @param {Function} onStatusChange Callback when connection status changes
 * @param {Object} [options] Optional configuration overrides
 * @returns {Object} MQTT Client instance
 */
export const connectMQTT = (onDataReceived, onStatusChange, options = {}) => {
  const mqttLib = getMqttClient();

  if (onStatusChange) onStatusChange('Connecting...');

  const clientId = options.clientId || 'Izanagi_UI_' + Math.random().toString(16).substring(2, 8);
  const brokerUrl = options.brokerUrl || BROKER_URL;
  const targetTopic = options.topic || TOPIC;

  console.log(`[MQTT] Initializing client connection (${clientId}) to ${brokerUrl}...`);

  let client;
  try {
    client = mqttLib.connect(brokerUrl, {
      clientId: clientId,
      clean: true,
      connectTimeout: 5000,
      reconnectPeriod: 2000, // Automatic reconnection every 2000ms
      keepalive: 60,
      ...options.mqttOptions,
    });
  } catch (err) {
    console.error('[MQTT] Connection initialization failed:', err);
    if (onStatusChange) onStatusChange('Error');
    return null;
  }

  // Zero UI Freeze: Accumulate high-frequency incoming packets and batch-dispatch on animation frame
  let pendingData = null;
  let rafId = null;

  const flushBatchedUpdates = () => {
    rafId = null;
    if (pendingData && onDataReceived) {
      const payloadToEmit = pendingData;
      pendingData = null;
      onDataReceived(payloadToEmit);
    }
  };

  client.on('connect', () => {
    console.log(`[MQTT] Connected successfully to HiveMQ broker at ${brokerUrl}!`);
    if (onStatusChange) onStatusChange('Connected');

    client.subscribe(targetTopic, { qos: 0 }, (err) => {
      if (!err) {
        console.log(`[MQTT] Subscribed to topic: ${targetTopic}`);
      } else {
        console.error('[MQTT] Subscription error on topic ' + targetTopic + ':', err);
      }
    });
  });

  client.on('message', (incomingTopic, message) => {
    try {
      const payload = JSON.parse(message.toString());
      // Merge latest incoming fields to prevent loss of partial updates
      pendingData = pendingData ? { ...pendingData, ...payload } : payload;

      // Ensure zero UI freeze by batching updates with requestAnimationFrame
      if (!rafId) {
        if (typeof window !== 'undefined' && typeof window.requestAnimationFrame === 'function') {
          rafId = window.requestAnimationFrame(flushBatchedUpdates);
        } else {
          flushBatchedUpdates();
        }
      }
    } catch (err) {
      console.error('[MQTT] Failed to parse JSON message:', err, message.toString());
    }
  });

  client.on('reconnect', () => {
    console.log('[MQTT] Auto-reconnecting to HiveMQ broker...');
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

  // Provide enhanced end() to ensure clean cancellation of any pending RAF
  const originalEnd = client.end ? client.end.bind(client) : null;
  if (originalEnd) {
    client.end = (...args) => {
      if (rafId && typeof window !== 'undefined' && typeof window.cancelAnimationFrame === 'function') {
        window.cancelAnimationFrame(rafId);
        rafId = null;
      }
      pendingData = null;
      return originalEnd(...args);
    };
  }

  return client;
};

export { mqtt };
export default connectMQTT;
