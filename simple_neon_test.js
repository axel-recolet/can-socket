const SocketCAN = require("./dist/src/socketcan").SocketCAN;

console.log("🚀 Test Neon Performance Simple");

try {
    const socket = new SocketCAN();
    socket.open("vcan0");
    
    const start = process.hrtime.bigint();
    const iterations = 1000;
    
    for (let i = 0; i < iterations; i++) {
        socket.send(0x123, [1, 2, 3, 4, 5, 6, 7, 8]);
    }
    
    const end = process.hrtime.bigint();
    const duration = Number(end - start) / 1_000_000; // Convert to ms
    const fps = Math.round((iterations / duration) * 1000);
    
    console.log(`📊 RÉSULTAT: ${fps} fps pour ${iterations} frames`);
    console.log(`⏱️  Temps total: ${duration.toFixed(2)}ms`);
    
    socket.close();
} catch (error) {
    console.error("❌ Erreur:", error.message);
}
