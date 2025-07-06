import {
  SocketCAN,
  SocketCANError,
  SocketCANUtils,
  CAN_CONSTANTS,
} from "./socketcan";
import { formatError, getErrorMessage, getErrorCode } from "./utils";

/**
 * Advanced usage example of the SocketCAN module in TypeScript
 */
async function exempleAvanceTypeScript(): Promise<void> {
  console.log("=== Advanced SocketCAN TypeScript Example ===\n");

  const can = new SocketCAN("vcan0", {
    defaultTimeout: 500,
  });

  try {
    // 1. Open the socket
    await can.open();

    // 2. Send multiple frames with different IDs
    interface TestFrame {
      id: number;
      data: number[];
      description: string;
    }

    const frames: TestFrame[] = [
      {
        id: 0x100,
        data: [0x01, 0x02, 0x03, 0x04],
        description: "Simple data frame",
      },
      {
        id: 0x200,
        data: SocketCANUtils.numberToBytes(0xdeadbeef, 4),
        description: "Frame with converted number",
      },
      {
        id: CAN_CONSTANTS.MAX_STANDARD_ID,
        data: [0x12],
        description: "Maximum ID for 11-bit",
      },
    ];

    console.log("Sending multiple frames...");
    for (const frame of frames) {
      try {
        await can.send(frame.id, frame.data);
        console.log(
          `✓ ${frame.description} - ID: ${SocketCANUtils.formatCanId(
            frame.id
          )}, Data: ${SocketCANUtils.formatCanData(frame.data)}`
        );
      } catch (error) {
        if (error instanceof SocketCANError) {
          console.log(`✗ Error [${error.code}]: ${error.message}`);
        }
      }
    }

    // 3. Simulate a communication protocol
    console.log("\nSimulating a communication protocol...");

    // Heartbeat
    await sendHeartbeat(can, 0x700);

    // Request/Response pattern
    await sendRequest(can, 0x600, 0x01); // Request node 1 status

    // Data logging
    const sensorData = {
      temperature: 25.5,
      pressure: 1013.25,
      humidity: 60,
    };
    await sendSensorData(can, 0x300, sensorData);

    // 4. Try to receive frames in a loop
    console.log("\nListening for frames (500ms timeout per attempt)...");
    for (let i = 0; i < 3; i++) {
      try {
        const frame = await can.receive();
        console.log(
          `Frame received: ID=${SocketCANUtils.formatCanId(
            frame.id
          )}, Data=${SocketCANUtils.formatCanData(frame.data)}`
        );

        // Analyze the received frame
        analyzeFrame(frame);
      } catch (error) {
        if (error instanceof SocketCANError) {
          console.log(`Attempt ${i + 1}: ${error.message}`);
        }
      }
    }

    // 5. Advanced validation tests
    console.log("\nAdvanced validation tests...");
    await testValidation(can);

    // 6. Close the socket
    can.close();
    console.log("\n=== End of TypeScript example ===");
  } catch (error) {
    if (error instanceof SocketCANError) {
      console.error(`SocketCAN Error [${error.code}]: ${error.message}`);
    } else {
      console.error(
        "General error:",
        error instanceof Error ? error.message : "Unknown error"
      );
    }
    console.log(
      "\nNote: This example requires a Linux environment with SocketCAN."
    );
    printLinuxSetupTypeScript();
    can.close();
  }
}

/**
 * Send a heartbeat
 */
async function sendHeartbeat(can: SocketCAN, baseId: number): Promise<void> {
  const nodeId = 0x01;
  const heartbeatId = baseId + nodeId;
  const statusData = [0x00]; // Status: operational

  try {
    await can.send(heartbeatId, statusData);
    console.log(`💓 Heartbeat sent - Node ${nodeId} operational`);
  } catch (error) {
    if (error instanceof SocketCANError) {
      console.log(`❌ Heartbeat error: ${error.message}`);
    }
  }
}

/**
 * Send a request
 */
async function sendRequest(
  can: SocketCAN,
  baseId: number,
  nodeId: number
): Promise<void> {
  const requestId = baseId + nodeId;
  const requestData = [0x40, 0x00, 0x10, 0x01, 0x00, 0x00, 0x00, 0x00]; // SDO request

  try {
    await can.send(requestId, requestData);
    console.log(`📤 Request sent to node ${nodeId}`);
  } catch (error) {
    if (error instanceof SocketCANError) {
      console.log(`❌ Request error: ${error.message}`);
    }
  }
}

/**
 * Send sensor data
 */
async function sendSensorData(
  can: SocketCAN,
  baseId: number,
  data: { temperature: number; pressure: number; humidity: number }
): Promise<void> {
  // Encode data (simple example)
  const tempBytes = SocketCANUtils.numberToBytes(
    Math.round(data.temperature * 10),
    2
  );
  const pressureBytes = SocketCANUtils.numberToBytes(
    Math.round(data.pressure * 10),
    2
  );
  const humidityBytes = SocketCANUtils.numberToBytes(
    Math.round(data.humidity),
    1
  );

  const sensorFrame = [
    ...tempBytes,
    ...pressureBytes,
    ...humidityBytes,
    0x00, // padding
  ];

  try {
    await can.send(baseId, sensorFrame);
    console.log(
      `🌡️ Sensor data sent - Temp: ${data.temperature}°C, Pressure: ${data.pressure}hPa, Humidity: ${data.humidity}%`
    );
  } catch (error) {
    if (error instanceof SocketCANError) {
      console.log(`❌ Sensor data error: ${error.message}`);
    }
  }
}

/**
 * Analyze a received frame
 */
function analyzeFrame(frame: { id: number; data: number[] }): void {
  const idHex = SocketCANUtils.formatCanId(frame.id);

  // Basic analysis according to ID
  if (frame.id >= 0x700 && frame.id <= 0x77f) {
    console.log(
      `  🔍 Heartbeat detected - Node ${
        frame.id - 0x700
      }, Status: 0x${frame.data[0]?.toString(16)}`
    );
  } else if (frame.id >= 0x580 && frame.id <= 0x5ff) {
    console.log(`  🔍 SDO response detected - Node ${frame.id - 0x580}`);
  } else if (frame.id >= 0x300 && frame.id <= 0x3ff) {
    console.log(`  🔍 Sensor data detected`);
    if (frame.data.length >= 6) {
      const temp = SocketCANUtils.bytesToNumber(frame.data.slice(0, 2)) / 10;
      const pressure =
        SocketCANUtils.bytesToNumber(frame.data.slice(2, 4)) / 10;
      const humidity = frame.data[4];
      console.log(
        `      Temperature: ${temp}°C, Pressure: ${pressure}hPa, Humidity: ${humidity}%`
      );
    }
  } else {
    console.log(`  🔍 Unknown frame - ID: ${idHex}`);
  }
}

/**
 * Validation tests
 */
async function testValidation(can: SocketCAN): Promise<void> {
  const tests = [
    {
      name: "Data too long",
      id: 0x123,
      data: [1, 2, 3, 4, 5, 6, 7, 8, 9],
      expectedError: "DATA_TOO_LONG",
    },
    {
      name: "Invalid ID (too large)",
      id: 0x800,
      data: [1, 2, 3],
      expectedError: "INVALID_CAN_ID",
    },
    {
      name: "Invalid byte",
      id: 0x123,
      data: [1, 2, 256],
      expectedError: "INVALID_BYTE",
    },
    {
      name: "Negative ID",
      id: -1,
      data: [1, 2, 3],
      expectedError: "INVALID_CAN_ID",
    },
  ];

  for (const test of tests) {
    try {
      await can.send(test.id, test.data);
      console.log(`❌ Test '${test.name}' should fail`);
    } catch (error) {
      if (
        error instanceof SocketCANError &&
        error.code === test.expectedError
      ) {
        console.log(`✅ Test '${test.name}' validated: ${error.code}`);
      } else {
        console.log(
          `⚠️ Test '${test.name}' unexpected error: ${
            error instanceof Error ? error.message : "Unknown error"
          }`
        );
      }
    }
  }
}

/**
 * Linux setup instructions
 */
function printLinuxSetupTypeScript(): void {
  console.log("\n=== Virtual CAN Interface Setup (Linux) ===");
  console.log("# Load the vcan module");
  console.log("sudo modprobe vcan");
  console.log("");
  console.log("# Create a virtual CAN interface");
  console.log("sudo ip link add dev vcan0 type vcan");
  console.log("sudo ip link set up vcan0");
  console.log("");
  console.log("# Verify that the interface is active");
  console.log("ip link show vcan0");
  console.log("");
  console.log("# Optional: use can-utils for testing");
  console.log("# sudo apt-get install can-utils");
  console.log("# cansend vcan0 123#DEADBEEF");
  console.log("# candump vcan0");
  console.log("======================================================\n");
}

// Run the example if this file is executed directly
if (require.main === module) {
  printLinuxSetupTypeScript();
  exempleAvanceTypeScript().catch(console.error);
}

export { exempleAvanceTypeScript, printLinuxSetupTypeScript };
