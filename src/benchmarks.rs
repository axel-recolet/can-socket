#[cfg(test)]
mod benchmarks {
    use super::*;
    use crate::CanSocketWrapper;
    use std::time::Instant;

    #[test]
    #[ignore] // Marqué comme ignoré par défaut car c'est un benchmark
    #[cfg(target_os = "linux")]
    fn benchmark_frame_throughput() {
        let interface = "vcan_bench";

        // Créer l'interface de test
        let _ = std::process::Command::new("sudo")
            .args(&["ip", "link", "delete", interface])
            .output();

        let output = std::process::Command::new("sudo")
            .args(&["ip", "link", "add", "dev", interface, "type", "vcan"])
            .output()
            .expect("Failed to create vcan interface");

        if output.status.success() {
            let _ = std::process::Command::new("sudo")
                .args(&["ip", "link", "set", "up", interface])
                .output();
        } else {
            println!("Skipping benchmark - cannot create vcan interface");
            return;
        }

        let sender = CanSocketWrapper::new(interface.to_string()).expect("Failed to create sender");
        let _receiver =
            CanSocketWrapper::new(interface.to_string()).expect("Failed to create receiver");

        let frame_count = 1000;
        let test_data = vec![0x01, 0x02, 0x03, 0x04, 0x05, 0x06, 0x07, 0x08];

        // Benchmark d'envoi seul (mesurer la vitesse d'envoi pure)
        let start = Instant::now();
        for i in 0..frame_count {
            let result =
                sender.send_frame(0x100 + (i % 100), test_data.clone(), false, false, false);
            assert!(result.is_ok(), "Frame send should succeed");
        }
        let send_duration = start.elapsed();

        // Petite pause pour permettre aux frames d'être transmises
        std::thread::sleep(std::time::Duration::from_millis(100));

        // Benchmark de réception - envoyer et recevoir simultanément
        let sender2 =
            CanSocketWrapper::new(interface.to_string()).expect("Failed to create sender2");
        let receiver2 =
            CanSocketWrapper::new(interface.to_string()).expect("Failed to create receiver2");

        let sender_handle = std::thread::spawn(move || {
            std::thread::sleep(std::time::Duration::from_millis(50)); // Petit délai pour que le receiver soit prêt
            for i in 0..frame_count {
                let result =
                    sender2.send_frame(0x200 + (i % 100), test_data.clone(), false, false, false);
                if result.is_err() {
                    break;
                }
                // Petit délai pour éviter la saturation
                if i % 10 == 0 {
                    std::thread::sleep(std::time::Duration::from_micros(100));
                }
            }
        });

        let start = Instant::now();
        let mut received_count = 0;
        let mut consecutive_timeouts = 0;

        while received_count < frame_count && consecutive_timeouts < 5 {
            match receiver2.read_frame(Some(100)) {
                // Timeout plus court
                Ok(_) => {
                    received_count += 1;
                    consecutive_timeouts = 0;
                }
                Err(_) => {
                    consecutive_timeouts += 1;
                }
            }
        }
        let receive_duration = start.elapsed();

        sender_handle.join().unwrap();

        println!("Benchmark Results:");
        println!(
            "  Sent {} frames in {:?} ({:.2} frames/sec)",
            frame_count,
            send_duration,
            frame_count as f64 / send_duration.as_secs_f64()
        );
        println!(
            "  Received {} frames in {:?} ({:.2} frames/sec)",
            received_count,
            receive_duration,
            received_count as f64 / receive_duration.as_secs_f64()
        );
        println!(
            "  Reception efficiency: {:.1}%",
            (received_count as f64 / frame_count as f64) * 100.0
        );

        // Nettoyer
        let _ = std::process::Command::new("sudo")
            .args(&["ip", "link", "delete", interface])
            .output();

        // Vérifier que nous avons des performances décentes
        let send_fps = frame_count as f64 / send_duration.as_secs_f64();
        assert!(
            send_fps > 100.0,
            "Send throughput should be > 100 fps, got {:.2}",
            send_fps
        );
    }

    #[test]
    #[ignore]
    #[cfg(target_os = "linux")]
    fn benchmark_filter_performance() {
        let interface = "vcan_filter";

        // Créer l'interface de test
        let _ = std::process::Command::new("sudo")
            .args(&["ip", "link", "delete", interface])
            .output();

        let output = std::process::Command::new("sudo")
            .args(&["ip", "link", "add", "dev", interface, "type", "vcan"])
            .output()
            .expect("Failed to create vcan interface");

        if output.status.success() {
            let _ = std::process::Command::new("sudo")
                .args(&["ip", "link", "set", "up", interface])
                .output();
        } else {
            println!("Skipping benchmark - cannot create vcan interface");
            return;
        }

        let sender = CanSocketWrapper::new(interface.to_string()).expect("Failed to create sender");
        let receiver =
            CanSocketWrapper::new(interface.to_string()).expect("Failed to create receiver");

        // Test sans filtres
        let start = Instant::now();
        let frame_count = 100;

        for i in 0..frame_count {
            let _ = sender.send_frame(0x100 + i, vec![i as u8], false, false, false);
        }

        let mut received_without_filter = 0;
        let timeout_start = Instant::now();
        while received_without_filter < frame_count && timeout_start.elapsed().as_millis() < 2000 {
            if let Ok(_) = receiver.read_frame(Some(100)) {
                received_without_filter += 1;
            }
        }
        let no_filter_duration = start.elapsed();

        // Test avec filtres restrictifs
        let filters = vec![(0x150, 0x7FF, false)]; // Filtre pour une seule ID
        let _ = receiver.set_filters(filters);

        let start = Instant::now();

        for i in 0..frame_count {
            let _ = sender.send_frame(0x100 + i, vec![i as u8], false, false, false);
        }

        let mut received_with_filter = 0;
        let timeout_start = Instant::now();
        while timeout_start.elapsed().as_millis() < 2000 {
            if let Ok(_) = receiver.read_frame(Some(100)) {
                received_with_filter += 1;
            } else {
                break;
            }
        }
        let filter_duration = start.elapsed();

        println!("Filter Benchmark Results:");
        println!(
            "  Without filters: {} frames received in {:?}",
            received_without_filter, no_filter_duration
        );
        println!(
            "  With filters: {} frames received in {:?}",
            received_with_filter, filter_duration
        );

        // Nettoyer
        let _ = std::process::Command::new("sudo")
            .args(&["ip", "link", "delete", interface])
            .output();

        // Le filtre devrait bloquer la plupart des frames
        assert!(
            received_with_filter < received_without_filter / 2,
            "Filter should significantly reduce received frames"
        );
    }

    #[test]
    #[ignore]
    #[cfg(target_os = "linux")]
    fn stress_test_multiple_sockets() {
        let interface = "vcan_stress";

        // Créer l'interface de test
        let _ = std::process::Command::new("sudo")
            .args(&["ip", "link", "delete", interface])
            .output();

        let output = std::process::Command::new("sudo")
            .args(&["ip", "link", "add", "dev", interface, "type", "vcan"])
            .output()
            .expect("Failed to create vcan interface");

        if output.status.success() {
            let _ = std::process::Command::new("sudo")
                .args(&["ip", "link", "set", "up", interface])
                .output();
        } else {
            println!("Skipping stress test - cannot create vcan interface");
            return;
        }

        let socket_count = 10;
        let frames_per_socket = 50;

        // Créer plusieurs sockets
        let mut sockets = Vec::new();
        for _ in 0..socket_count {
            let socket =
                CanSocketWrapper::new(interface.to_string()).expect("Failed to create socket");
            sockets.push(socket);
        }

        // Envoyer des frames depuis chaque socket
        let start = Instant::now();
        for (socket_idx, socket) in sockets.iter().enumerate() {
            for frame_idx in 0..frames_per_socket {
                let id = (socket_idx * 100 + frame_idx) as u32;
                let data = vec![socket_idx as u8, frame_idx as u8];
                let result = socket.send_frame(id, data, false, false, false);
                assert!(result.is_ok(), "Frame send should succeed");
            }
        }

        // Recevoir toutes les frames avec un socket de réception
        let receiver =
            CanSocketWrapper::new(interface.to_string()).expect("Failed to create receiver");

        let total_expected = socket_count * frames_per_socket;
        let mut received_count = 0;
        let timeout_start = Instant::now();

        while received_count < total_expected && timeout_start.elapsed().as_millis() < 5000 {
            if let Ok(_) = receiver.read_frame(Some(100)) {
                received_count += 1;
            }
        }

        let total_duration = start.elapsed();

        println!("Stress Test Results:");
        println!(
            "  {} sockets sent {} frames each",
            socket_count, frames_per_socket
        );
        println!(
            "  Total expected: {}, received: {}",
            total_expected, received_count
        );
        println!("  Duration: {:?}", total_duration);
        println!(
            "  Overall throughput: {:.2} frames/sec",
            received_count as f64 / total_duration.as_secs_f64()
        );

        // Nettoyer
        let _ = std::process::Command::new("sudo")
            .args(&["ip", "link", "delete", interface])
            .output();

        // Vérifier que nous avons reçu la plupart des frames
        let success_rate = received_count as f64 / total_expected as f64;
        assert!(
            success_rate > 0.9,
            "Should receive > 90% of frames, got {:.1}%",
            success_rate * 100.0
        );
    }

    #[test]
    #[ignore]
    #[cfg(target_os = "linux")]
    fn benchmark_bidirectional_performance() {
        let interface = "vcan_bidir";

        // Créer l'interface de test
        let _ = std::process::Command::new("sudo")
            .args(&["ip", "link", "delete", interface])
            .output();

        let output = std::process::Command::new("sudo")
            .args(&["ip", "link", "add", "dev", interface, "type", "vcan"])
            .output();

        if output.is_ok() {
            let _ = std::process::Command::new("sudo")
                .args(&["ip", "link", "set", "up", interface])
                .output();
        } else {
            println!("Skipping bidirectional benchmark - cannot create vcan interface");
            return;
        }

        let frame_count = 500;
        let test_data = vec![0xAA, 0xBB, 0xCC, 0xDD];

        // Créer des sockets pour communication bidirectionnelle
        let node_a = CanSocketWrapper::new(interface.to_string()).expect("Failed to create node A");
        let node_b = CanSocketWrapper::new(interface.to_string()).expect("Failed to create node B");

        let node_a_clone =
            CanSocketWrapper::new(interface.to_string()).expect("Failed to create node A clone");
        let node_b_clone =
            CanSocketWrapper::new(interface.to_string()).expect("Failed to create node B clone");

        let start = Instant::now();

        // Thread A -> B
        let test_data_a = test_data.clone();
        let handle_a = std::thread::spawn(move || {
            let mut sent = 0;
            for i in 0..frame_count {
                match node_a.send_frame(0x100 + i, test_data_a.clone(), false, false, false) {
                    Ok(_) => sent += 1,
                    Err(_) => break,
                }
                std::thread::sleep(std::time::Duration::from_micros(200));
            }
            sent
        });

        // Thread B -> A
        let test_data_b = test_data.clone();
        let handle_b = std::thread::spawn(move || {
            let mut sent = 0;
            for i in 0..frame_count {
                match node_b.send_frame(0x200 + i, test_data_b.clone(), false, false, false) {
                    Ok(_) => sent += 1,
                    Err(_) => break,
                }
                std::thread::sleep(std::time::Duration::from_micros(200));
            }
            sent
        });

        // Réception A (reçoit de B)
        let recv_handle_a = std::thread::spawn(move || {
            let mut received = 0;
            let mut timeouts = 0;
            while received < frame_count && timeouts < 10 {
                match node_a_clone.read_frame(Some(100)) {
                    Ok((id, _, _, _, _, _)) => {
                        if id >= 0x200 && id < 0x200 + frame_count {
                            received += 1;
                        }
                        timeouts = 0;
                    }
                    Err(_) => timeouts += 1,
                }
            }
            received
        });

        // Réception B (reçoit de A)
        let recv_handle_b = std::thread::spawn(move || {
            let mut received = 0;
            let mut timeouts = 0;
            while received < frame_count && timeouts < 10 {
                match node_b_clone.read_frame(Some(100)) {
                    Ok((id, _, _, _, _, _)) => {
                        if id >= 0x100 && id < 0x100 + frame_count {
                            received += 1;
                        }
                        timeouts = 0;
                    }
                    Err(_) => timeouts += 1,
                }
            }
            received
        });

        let sent_a = handle_a.join().unwrap();
        let sent_b = handle_b.join().unwrap();
        let recv_a = recv_handle_a.join().unwrap();
        let recv_b = recv_handle_b.join().unwrap();

        let duration = start.elapsed();

        println!("Bidirectional Benchmark Results:");
        println!("  Duration: {:?}", duration);
        println!(
            "  Node A: sent {}/{}, received {}/{}",
            sent_a, frame_count, recv_a, frame_count
        );
        println!(
            "  Node B: sent {}/{}, received {}/{}",
            sent_b, frame_count, recv_b, frame_count
        );
        println!(
            "  Total throughput: {:.2} frames/sec",
            (sent_a + sent_b) as f64 / duration.as_secs_f64()
        );
        println!(
            "  Reception efficiency A: {:.1}%",
            (recv_a as f64 / sent_b as f64) * 100.0
        );
        println!(
            "  Reception efficiency B: {:.1}%",
            (recv_b as f64 / sent_a as f64) * 100.0
        );

        // Nettoyer
        let _ = std::process::Command::new("sudo")
            .args(&["ip", "link", "delete", interface])
            .output();
    }
}
