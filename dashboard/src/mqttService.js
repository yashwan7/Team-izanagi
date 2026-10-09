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

export const BROKER_CANDIDATES = [
  'wss://broker.hivemq.com:8884/mqtt', // Verified unblocked secure WebSocket
  'wss://broker.hivemq.com:8084/mqtt', // Primary port
  'ws://broker.hivemq.com:8000/mqtt'   // Plain WS fallback
];
export const BROKER_URL = 'wss://broker.hivemq.com:8084/mqtt'; // Public HiveMQ WebSocket URL
export const TOPIC = 'izanagi/sensors/data'; // Izanagi telemetry topic

/**
 * Connect to HiveMQ WebSocket MQTT broker and subscribe to izanagi/sensors/data.
 * Implements candidate failover, auto-reconnection and zero UI freeze through RAF-batched message dispatch.
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
  const candidateUrls = options.brokerUrls || (options.brokerUrl ? [options.brokerUrl] : BROKER_CANDIDATES);
  const targetTopic = options.topic || TOPIC;

  let currentIdx = 0;
  let client = null;
  let fallbackTimer = null;

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

  const tryConnect = () => {
    if (client) {
      try { client.end(true); } catch(e) {}
      client = null;
    }
    if (fallbackTimer) {
      clearTimeout(fallbackTimer);
      fallbackTimer = null;
    }

    const currentUrl = candidateUrls[currentIdx];
    console.log(`[MQTT] Initializing client connection (${clientId}) to ${currentUrl}...`);

    try {
      client = mqttLib.connect(currentUrl, {
        clientId: clientId,
        clean: true,
        connectTimeout: 4000,
        reconnectPeriod: 2500,
        keepalive: 60,
        ...options.mqttOptions,
      });
    } catch (err) {
      console.error('[MQTT] Connection initialization failed:', err);
      if (onStatusChange) onStatusChange('Error');
      return null;
    }

    // Failover if port is blocked or timed out
    fallbackTimer = setTimeout(() => {
      if (!client || !client.connected) {
        console.warn(`[MQTT] Timeout on ${currentUrl}, switching to fallback candidate...`);
        currentIdx = (currentIdx + 1) % candidateUrls.length;
        tryConnect();
      }
    }, 2500);

    client.on('connect', () => {
      if (fallbackTimer) clearTimeout(fallbackTimer);
      console.log(`[MQTT] Connected successfully to HiveMQ broker at ${currentUrl}!`);
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
        pendingData = pendingData ? { ...pendingData, ...payload } : payload;

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
    });

    client.on('offline', () => {
      console.log('[MQTT] Client is offline.');
    });

    client.on('error', (err) => {
      console.error('[MQTT] Connection error:', err);
      if (!client.connected && fallbackTimer) {
        clearTimeout(fallbackTimer);
        currentIdx = (currentIdx + 1) % candidateUrls.length;
        setTimeout(tryConnect, 500);
      }
    });
  };

  tryConnect();

  return {
    end: () => {
      if (fallbackTimer) clearTimeout(fallbackTimer);
      if (rafId && typeof window !== 'undefined' && typeof window.cancelAnimationFrame === 'function') {
        window.cancelAnimationFrame(rafId);
        rafId = null;
      }
      pendingData = null;
      if (client && client.end) {
        client.end(true);
      }
    }
  };
};

export { mqtt };
export default connectMQTT;
