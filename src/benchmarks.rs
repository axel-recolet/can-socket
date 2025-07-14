#[cfg(test)]
mod benchmarks {
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

    #[test]
    #[ignore]
    #[cfg(target_os = "linux")]
    fn benchmark_can_fd_performance() {
        let interface = "vcan_fd";

        // Créer l'interface de test CAN FD
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
            println!("Skipping CAN FD benchmark - cannot create vcan interface");
            return;
        }

        // Test avec socket CAN FD
        let fd_sender =
            CanSocketWrapper::new_fd(interface.to_string()).expect("Failed to create FD sender");
        let fd_receiver =
            CanSocketWrapper::new_fd(interface.to_string()).expect("Failed to create FD receiver");

        let frame_count = 500;
        let test_data_small = vec![0x01, 0x02, 0x03, 0x04]; // 4 bytes
        let test_data_large = vec![0xFF; 64]; // 64 bytes (max CAN FD)

        // Benchmark frames CAN FD petites
        let start = Instant::now();
        for i in 0..frame_count {
            let result =
                fd_sender.send_frame(0x300 + i, test_data_small.clone(), false, true, false);
            assert!(result.is_ok(), "CAN FD small frame send should succeed");
        }
        let small_fd_duration = start.elapsed();

        // Benchmark frames CAN FD grandes
        let start = Instant::now();
        for i in 0..frame_count {
            let result =
                fd_sender.send_frame(0x400 + i, test_data_large.clone(), false, true, false);
            assert!(result.is_ok(), "CAN FD large frame send should succeed");
        }
        let large_fd_duration = start.elapsed();

        println!("CAN FD Benchmark Results:");
        println!(
            "  Small frames (4 bytes): {} frames in {:?} ({:.2} frames/sec)",
            frame_count,
            small_fd_duration,
            frame_count as f64 / small_fd_duration.as_secs_f64()
        );
        println!(
            "  Large frames (64 bytes): {} frames in {:?} ({:.2} frames/sec)",
            frame_count,
            large_fd_duration,
            frame_count as f64 / large_fd_duration.as_secs_f64()
        );

        // Test réception CAN FD
        let mut received_fd = 0;
        let timeout_start = Instant::now();
        while received_fd < frame_count * 2 && timeout_start.elapsed().as_millis() < 3000 {
            if let Ok((_, _, _, is_fd, _, _)) = fd_receiver.read_frame(Some(50)) {
                if is_fd {
                    received_fd += 1;
                }
            }
        }

        println!(
            "  CAN FD frames received: {}/{}",
            received_fd,
            frame_count * 2
        );

        // Nettoyer
        let _ = std::process::Command::new("sudo")
            .args(&["ip", "link", "delete", interface])
            .output();
    }

    #[test]
    #[ignore]
    #[cfg(target_os = "linux")]
    fn benchmark_filter_operations() {
        let interface = "vcan_filter_ops";

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
            println!("Skipping filter operations benchmark");
            return;
        }

        let socket = CanSocketWrapper::new(interface.to_string()).expect("Failed to create socket");

        // Benchmark set_filters
        let filters = vec![
            (0x100, 0x7FF, false),
            (0x200, 0x7FF, false),
            (0x300, 0x7FF, false),
        ];

        let start = Instant::now();
        for _ in 0..1000 {
            let result = socket.set_filters(filters.clone());
            assert!(result.is_ok(), "set_filters should succeed");
        }
        let set_filters_duration = start.elapsed();

        // Benchmark clear_filters
        let start = Instant::now();
        for _ in 0..1000 {
            let result = socket.clear_filters();
            assert!(result.is_ok(), "clear_filters should succeed");
        }
        let clear_filters_duration = start.elapsed();

        println!("Filter Operations Benchmark Results:");
        println!(
            "  set_filters: 1000 operations in {:?} ({:.2} ops/sec)",
            set_filters_duration,
            1000.0 / set_filters_duration.as_secs_f64()
        );
        println!(
            "  clear_filters: 1000 operations in {:?} ({:.2} ops/sec)",
            clear_filters_duration,
            1000.0 / clear_filters_duration.as_secs_f64()
        );

        // Test close
        let start = Instant::now();
        let result = socket.close();
        let close_duration = start.elapsed();
        assert!(result.is_ok(), "close should succeed");

        println!("  close: {:?}", close_duration);

        // Nettoyer
        let _ = std::process::Command::new("sudo")
            .args(&["ip", "link", "delete", interface])
            .output();
    }

    #[test]
    #[ignore]
    #[cfg(target_os = "linux")]
    fn benchmark_batch_operations() {
        let interface = "vcan_batch";

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
            println!("Skipping batch operations benchmark");
            return;
        }

        let sender = CanSocketWrapper::new(interface.to_string()).expect("Failed to create sender");
        let receiver =
            CanSocketWrapper::new(interface.to_string()).expect("Failed to create receiver");

        let batch_size = 100;
        let test_data = vec![0xAA, 0xBB, 0xCC, 0xDD];

        // Simuler send_frames_batch en envoyant plusieurs frames d'affilée
        let start = Instant::now();
        for batch in 0..10 {
            for i in 0..batch_size {
                let id = (batch * batch_size + i) as u32;
                let result = sender.send_frame(id, test_data.clone(), false, false, false);
                assert!(result.is_ok(), "Batch send should succeed");
            }
        }
        let batch_send_duration = start.elapsed();

        // Simuler read_frames_batch en lisant plusieurs frames d'affilée
        let start = Instant::now();
        let mut total_received = 0;
        let mut consecutive_timeouts = 0;

        while total_received < 1000 && consecutive_timeouts < 10 {
            let mut batch_received = 0;
            for _ in 0..batch_size {
                match receiver.read_frame(Some(10)) {
                    Ok(_) => {
                        batch_received += 1;
                        consecutive_timeouts = 0;
                    }
                    Err(_) => {
                        consecutive_timeouts += 1;
                        break;
                    }
                }
            }
            total_received += batch_received;
            if batch_received == 0 {
                break;
            }
        }
        let batch_read_duration = start.elapsed();

        println!("Batch Operations Benchmark Results:");
        println!(
            "  Batch send (10 batches of {} frames): {:?} ({:.2} frames/sec)",
            batch_size,
            batch_send_duration,
            1000.0 / batch_send_duration.as_secs_f64()
        );
        println!(
            "  Batch read ({} frames): {:?} ({:.2} frames/sec)",
            total_received,
            batch_read_duration,
            total_received as f64 / batch_read_duration.as_secs_f64()
        );

        // Nettoyer
        let _ = std::process::Command::new("sudo")
            .args(&["ip", "link", "delete", interface])
            .output();
    }

    #[test]
    #[ignore]
    #[cfg(target_os = "linux")]
    fn benchmark_socket_lifecycle() {
        let interface = "vcan_lifecycle";

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
            println!("Skipping socket lifecycle benchmark");
            return;
        }

        // Benchmark création/fermeture de sockets
        let socket_count = 100;

        // Test création de sockets CAN normaux
        let start = Instant::now();
        let mut sockets = Vec::new();
        for _ in 0..socket_count {
            let socket = CanSocketWrapper::new(interface.to_string());
            assert!(socket.is_ok(), "Socket creation should succeed");
            sockets.push(socket.unwrap());
        }
        let creation_duration = start.elapsed();

        // Test fermeture de sockets
        let start = Instant::now();
        for socket in sockets {
            let result = socket.close();
            assert!(result.is_ok(), "Socket close should succeed");
        }
        let close_duration = start.elapsed();

        // Test création de sockets CAN FD
        let start = Instant::now();
        let mut fd_sockets = Vec::new();
        for _ in 0..socket_count {
            let socket = CanSocketWrapper::new_fd(interface.to_string());
            assert!(socket.is_ok(), "FD Socket creation should succeed");
            fd_sockets.push(socket.unwrap());
        }
        let fd_creation_duration = start.elapsed();

        // Test fermeture de sockets FD
        let start = Instant::now();
        for socket in fd_sockets {
            let result = socket.close();
            assert!(result.is_ok(), "FD Socket close should succeed");
        }
        let fd_close_duration = start.elapsed();

        println!("Socket Lifecycle Benchmark Results:");
        println!(
            "  CAN socket creation: {} sockets in {:?} ({:.2} ops/sec)",
            socket_count,
            creation_duration,
            socket_count as f64 / creation_duration.as_secs_f64()
        );
        println!(
            "  CAN socket close: {} sockets in {:?} ({:.2} ops/sec)",
            socket_count,
            close_duration,
            socket_count as f64 / close_duration.as_secs_f64()
        );
        println!(
            "  CAN FD socket creation: {} sockets in {:?} ({:.2} ops/sec)",
            socket_count,
            fd_creation_duration,
            socket_count as f64 / fd_creation_duration.as_secs_f64()
        );
        println!(
            "  CAN FD socket close: {} sockets in {:?} ({:.2} ops/sec)",
            socket_count,
            fd_close_duration,
            socket_count as f64 / fd_close_duration.as_secs_f64()
        );

        // Nettoyer
        let _ = std::process::Command::new("sudo")
            .args(&["ip", "link", "delete", interface])
            .output();
    }

    #[test]
    #[ignore]
    #[cfg(target_os = "linux")]
    fn benchmark_buffer_pool_performance() {
        let interface = "vcan0";

        // Créer des sockets de test
        let sender = CanSocketWrapper::new(interface.to_string()).expect("Failed to create sender");
        let receiver =
            CanSocketWrapper::new(interface.to_string()).expect("Failed to create receiver");

        // Vider le buffer
        while let Ok(_) = receiver.read_frame(Some(5)) {}

        // Test de performance : envoyer et recevoir des frames avec délai réaliste
        let num_frames = 100; // Réduire le nombre pour plus de stabilité
        let test_data = vec![0x01, 0x02, 0x03, 0x04, 0x05, 0x06, 0x07, 0x08];

        println!(
            "🚀 Test de performance du pool de buffers - {} frames",
            num_frames
        );

        let start_time = Instant::now();

        // Envoyer et recevoir alternativement pour éviter la surcharge du buffer
        let mut received = 0;
        for i in 0..num_frames {
            let id = 0x100 + (i % 50); // Varier les IDs

            // Envoyer
            let _ = sender.send_frame(id, test_data.clone(), false, false, false);

            // Essayer de recevoir immédiatement
            match receiver.read_frame(Some(50)) {
                Ok(_) => received += 1,
                Err(_) => {
                    // Si pas de frame dispo, réessayer avec timeout plus long
                    match receiver.read_frame(Some(100)) {
                        Ok(_) => received += 1,
                        Err(_) => {} // Frame perdue, continuer
                    }
                }
            }
        }

        let elapsed = start_time.elapsed();
        let frames_per_sec = (received as f64) / elapsed.as_secs_f64();

        println!("✅ Pool de buffers actif:");
        println!("   Frames reçues: {}/{}", received, num_frames);
        println!("   Temps total: {:?}", elapsed);
        println!("   Throughput: {:.0} frames/sec", frames_per_sec);
        println!(
            "   Latence moyenne: {:.2} µs/frame",
            elapsed.as_micros() as f64 / received as f64
        );

        // Vérifier un throughput minimum acceptable (plus réaliste)
        assert!(
            frames_per_sec > 500.0,
            "Performance too low: {} frames/sec",
            frames_per_sec
        );
        assert!(
            received >= num_frames * 70 / 100,
            "Too many lost frames: {}/{}",
            received,
            num_frames
        );
    }

    #[test]
    #[ignore]
    #[cfg(target_os = "linux")]
    fn benchmark_buffer_pool_memory_efficiency() {
        let interface = "vcan0";
        let receiver =
            CanSocketWrapper::new(interface.to_string()).expect("Failed to create receiver");
        let sender = CanSocketWrapper::new(interface.to_string()).expect("Failed to create sender");

        // Test de l'efficacité mémoire avec différentes tailles de données
        let test_sizes = vec![1, 4, 8, 16, 32, 64]; // Différentes tailles de payload

        for &size in &test_sizes {
            let test_data = vec![0xFF; size];
            let num_iterations = 100;

            let start_time = Instant::now();

            for i in 0..num_iterations {
                let id = 0x200 + i;
                let _ = sender.send_frame(id, test_data.clone(), false, false, false);

                // Lire immédiatement pour tester l'allocation/déallocation
                let _ = receiver.read_frame(Some(50));
            }

            let elapsed = start_time.elapsed();
            println!(
                "📊 Taille {} bytes: {:.2} µs/operation",
                size,
                elapsed.as_micros() as f64 / num_iterations as f64
            );
        }
    }

    #[test]
    #[ignore]
    #[cfg(target_os = "linux")]
    fn test_buffer_pool_functionality() {
        let interface = "vcan0";
        let sender = CanSocketWrapper::new(interface.to_string()).expect("Failed to create sender");
        let receiver =
            CanSocketWrapper::new(interface.to_string()).expect("Failed to create receiver");

        // Vider le buffer
        while let Ok(_) = receiver.read_frame(Some(5)) {}

        println!("🧪 Test de fonctionnalité du pool de buffers");

        // Envoyer quelques frames de tailles différentes
        let test_cases = vec![
            (0x101, vec![0x01]),                                           // 1 byte
            (0x102, vec![0x01, 0x02, 0x03, 0x04]),                         // 4 bytes
            (0x103, vec![0x01, 0x02, 0x03, 0x04, 0x05, 0x06, 0x07, 0x08]), // 8 bytes (max CAN)
        ];

        for (id, data) in test_cases {
            println!("  Test frame ID=0x{:X}, size={} bytes", id, data.len());

            // Envoyer
            let send_result = sender.send_frame(id, data.clone(), false, false, false);
            assert!(send_result.is_ok(), "Failed to send frame ID=0x{:X}", id);

            // Recevoir
            match receiver.read_frame(Some(500)) {
                Ok((recv_id, recv_data, extended, is_fd, is_remote, is_error)) => {
                    assert_eq!(recv_id, id, "ID mismatch");
                    assert_eq!(recv_data, data, "Data mismatch for ID=0x{:X}", id);
                    assert!(!extended, "Should not be extended");
                    assert!(!is_fd, "Should not be FD");
                    assert!(!is_remote, "Should not be remote");
                    assert!(!is_error, "Should not be error");
                    println!("    ✅ Frame reçue correctement");
                }
                Err(e) => panic!("Failed to receive frame ID=0x{:X}: {}", id, e),
            }
        }

        println!("✅ Test de fonctionnalité du pool terminé avec succès");
    }
}
