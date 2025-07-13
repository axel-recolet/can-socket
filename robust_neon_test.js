const SocketCAN = require("./dist/src/socketcan").SocketCAN;

console.log("🚀 Test Neon Performance Robuste");

try {
    const socket = new SocketCAN();
    
    // Test simple sans ouverture du socket d'abord
    console.log("✅ Socket créé avec succès");
    
    // Maintenant essayons l'ouverture
    try {
        socket.open("vcan0");
        console.log("✅ Socket ouvert sur vcan0");
        
        const start = process.hrtime.bigint();
        const iterations = 1000;
        
        for (let i = 0; i < iterations; i++) {
            socket.send(0x123, [1, 2, 3, 4, 5, 6, 7, 8]);
        }
        
        const end = process.hrtime.bigint();
        const duration = Number(end - start) / 1_000_000;
        const fps = Math.round((iterations / duration) * 1000);
        
        console.log(`📊 RÉSULTAT NEON: ${fps} fps pour ${iterations} frames`);
        console.log(`⏱️  Temps total: ${duration.toFixed(2)}ms`);
        
        socket.close();
        console.log("✅ Socket fermé");
        
    } catch (openError) {
        console.log("❌ Erreur ouverture:", openError.message);
        console.log("ℹ️  Test de performance sans interface réseau...");
        
        // Test de performance de la création d'objets
        const start = process.hrtime.bigint();
        const iterations = 10000;
        
        for (let i = 0; i < iterations; i++) {
            // Test de performance de création d'objets seulement
            const frame = {id: 0x123, data: [1,2,3,4,5,6,7,8]};
        }
        
        const end = process.hrtime.bigint();
        const duration = Number(end - start) / 1_000_000;
        const fps = Math.round((iterations / duration) * 1000);
        
        console.log(`📊 RÉSULTAT JS: ${fps} fps pour ${iterations} objects`);
    }
    
} catch (error) {
    console.error("❌ Erreur critique:", error.message);
}
